/**
 * POST /api/submit-lead
 * Called after the user sees their score and chooses to send it to SnowFox.
 *
 * Body: {
 *   sessionId: string,
 *   fullName: string, workEmail: string,
 *   company?: string, phone?: string, jobTitle?: string, notes?: string
 * }
 */

import { NextRequest, NextResponse } from "next/server";
import { createLead, getSession, markLeadEmailed } from "@/lib/db";
import { sendLeadToSnowFox, sendResultsToProspect, type LeadPayload } from "@/lib/email";
import { computeScore, type Answers } from "@/lib/scoring";

export const runtime = "nodejs";

interface Body {
  sessionId: string;
  fullName: string;
  workEmail: string;
  company?: string;
  phone?: string;
  jobTitle?: string;
  notes?: string;
}

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as Body;

    if (!body.sessionId || !body.fullName || !body.workEmail) {
      return NextResponse.json(
        { error: "sessionId, fullName, and workEmail are required" },
        { status: 400 }
      );
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(body.workEmail)) {
      return NextResponse.json({ error: "invalid work email" }, { status: 400 });
    }

    const session = await getSession(body.sessionId);
    if (!session) {
      return NextResponse.json({ error: "session not found" }, { status: 404 });
    }

    const answers: Answers = {
      core: (session.core_answers ?? {}) as Record<string, string>,
      followUps: (session.followup_answers ?? {}) as Record<string, string | string[]>,
      context: (session.context ?? {}) as Record<string, string>,
    };
    const score = computeScore(answers);

    const lead = await createLead({
      sessionId: body.sessionId,
      fullName: body.fullName,
      workEmail: body.workEmail,
      company: body.company,
      phone: body.phone,
      jobTitle: body.jobTitle,
      notes: body.notes,
    });

    const payload: LeadPayload = {
      sessionId: body.sessionId,
      fullName: body.fullName,
      workEmail: body.workEmail,
      company: body.company,
      phone: body.phone,
      jobTitle: body.jobTitle,
      notes: body.notes,
      context: answers.context,
      score,
    };

    // Fire both emails concurrently. If one fails we still want the other to go.
    const [snowfoxRes, prospectRes] = await Promise.allSettled([
      sendLeadToSnowFox(payload),
      sendResultsToProspect(payload),
    ]);

    if (snowfoxRes.status === "fulfilled") {
      await markLeadEmailed(lead.id, "snowfox");
    } else {
      await markLeadEmailed(lead.id, "snowfox", snowfoxRes.reason?.message ?? String(snowfoxRes.reason));
    }
    if (prospectRes.status === "fulfilled") {
      await markLeadEmailed(lead.id, "prospect");
    } else {
      await markLeadEmailed(lead.id, "prospect", prospectRes.reason?.message ?? String(prospectRes.reason));
    }

    return NextResponse.json({
      ok: true,
      leadId: lead.id,
      snowfoxEmailed: snowfoxRes.status === "fulfilled",
      prospectEmailed: prospectRes.status === "fulfilled",
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
