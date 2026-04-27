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
import { sendResultsToProspect, type LeadPayload } from "@/lib/email";
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

    // Single branded email to the prospect, with the SnowFox leads inbox on CC.
    // Captured in a try/catch so DB lead row is preserved even if email fails
    // (e.g. Resend not yet configured).
    let emailed = false;
    let emailError: string | undefined;
    try {
      await sendResultsToProspect(payload);
      emailed = true;
    } catch (err) {
      emailError = err instanceof Error ? err.message : String(err);
    }

    if (emailed) {
      await markLeadEmailed(lead.id, "prospect");
    } else {
      await markLeadEmailed(lead.id, "prospect", emailError);
    }

    return NextResponse.json({
      ok: true,
      leadId: lead.id,
      emailed,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
