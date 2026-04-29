/**
 * POST /api/submit-lead
 * Called after the user sees their score and chooses to send it to SnowFox.
 *
 * Body: {
 *   sessionId: string,
 *   fullName: string, workEmail: string,
 *   company?: string, phone?: string, jobTitle?: string, notes?: string
 * }
 *
 * Two emails are dispatched:
 *   1. Prospect-facing branded results email (no CC).
 *   2. SnowFox internal notification to SNOWFOX_LEADS_EMAIL with the
 *      AI Strategy Plan PDF attached.
 * Email failures never block the lead row from being persisted.
 */

import { NextRequest, NextResponse } from "next/server";
import { createLead, getSession, markLeadEmailed } from "@/lib/db";
import {
  sendResultsToProspect,
  sendInternalLeadNotification,
  type LeadPayload,
} from "@/lib/email";
import { generateStrategyPlanPdf } from "@/lib/pdf";
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

    // Prospect-facing email — captured in try/catch so DB row is preserved on failure.
    let prospectEmailed = false;
    let prospectError: string | undefined;
    try {
      await sendResultsToProspect(payload);
      prospectEmailed = true;
    } catch (err) {
      prospectError = err instanceof Error ? err.message : String(err);
    }

    // SnowFox internal email + PDF — independent of prospect email success.
    let internalEmailed = false;
    let internalError: string | undefined;
    try {
      const pdf = await generateStrategyPlanPdf({
        fullName: body.fullName,
        workEmail: body.workEmail,
        company: body.company,
        phone: body.phone,
        jobTitle: body.jobTitle,
        notes: body.notes,
        context: answers.context,
        coreAnswers: answers.core,
        followupAnswers: answers.followUps,
        score,
      });
      const safeCompany = (body.company ?? body.fullName)
        .replace(/[^a-zA-Z0-9 _-]/g, "")
        .replace(/\s+/g, "_")
        .slice(0, 60) || "Lead";
      const filename = `SnowFox_AI_Strategy_Plan_${safeCompany}.pdf`;
      await sendInternalLeadNotification(payload, pdf, filename);
      internalEmailed = true;
    } catch (err) {
      internalError = err instanceof Error ? err.message : String(err);
    }

    // Persist email status — record the prospect-facing outcome under the existing
    // "prospect" recipient slot so the admin UI continues to read correctly.
    if (prospectEmailed) {
      await markLeadEmailed(lead.id, "prospect");
    } else {
      await markLeadEmailed(lead.id, "prospect", prospectError);
    }

    return NextResponse.json({
      ok: true,
      leadId: lead.id,
      emailed: prospectEmailed,
      internalEmailed,
      ...(internalError ? { internalError } : {}),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
