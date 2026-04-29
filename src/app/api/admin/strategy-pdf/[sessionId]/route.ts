/**
 * GET /api/admin/strategy-pdf/[sessionId]
 *
 * Generates the SnowFox AI Strategy Plan PDF for any completed session and
 * streams it back as an attachment. Used by the admin dashboard to manually
 * download a customer-facing strategy plan to send as a follow-up.
 *
 * Auth: requires the same signed sfx_admin cookie as the admin pages. Since
 * this route lives under /api/* it isn't covered by the /admin middleware, so
 * we re-verify the token here.
 */

import { NextRequest, NextResponse } from "next/server";
import { COOKIE_NAME, verifyAdminToken } from "@/lib/admin-auth";
import { getSession, getSessionDetail } from "@/lib/db";
import { generateStrategyPlanPdf } from "@/lib/pdf";
import { computeScore, type Answers } from "@/lib/scoring";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  req: NextRequest,
  { params }: { params: { sessionId: string } }
) {
  const token = req.cookies.get(COOKIE_NAME)?.value;
  const payload = await verifyAdminToken(token);
  if (!payload) {
    return NextResponse.json({ error: "unauthorized" }, { status: 401 });
  }

  const session = await getSession(params.sessionId);
  if (!session) {
    return NextResponse.json({ error: "session not found" }, { status: 404 });
  }

  // Try to enrich with lead info if present.
  const detail = await getSessionDetail(params.sessionId);
  const lead = detail?.lead ?? null;

  const answers: Answers = {
    core: (session.core_answers ?? {}) as Record<string, string>,
    followUps: (session.followup_answers ?? {}) as Record<string, string | string[]>,
    context: (session.context ?? {}) as Record<string, string>,
  };
  const score = computeScore(answers);

  const fullName = lead?.full_name ?? "Assessment Recipient";
  const workEmail = lead?.work_email ?? "—";
  const company = lead?.company ?? undefined;
  const jobTitle = lead?.job_title ?? undefined;
  const notes = lead?.notes ?? undefined;

  const pdf = await generateStrategyPlanPdf({
    fullName,
    workEmail,
    company,
    jobTitle,
    notes,
    context: answers.context,
    coreAnswers: answers.core,
    followupAnswers: answers.followUps,
    score,
  });

  const safeName = (company ?? fullName)
    .replace(/[^a-zA-Z0-9 _-]/g, "")
    .replace(/\s+/g, "_")
    .slice(0, 60) || "Lead";
  const filename = `SnowFox_AI_Strategy_Plan_${safeName}.pdf`;

  return new NextResponse(pdf as unknown as BodyInit, {
    status: 200,
    headers: {
      "Content-Type": "application/pdf",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
