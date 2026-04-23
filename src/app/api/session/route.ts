/**
 * POST /api/session
 * Creates a new session and returns the session id + the first question.
 *
 * Request body: { context: { C1, C2, C3 } }  // optional — context questions are
 * typically answered up-front client-side before any Claude calls.
 */

import { NextRequest, NextResponse } from "next/server";
import { createSession } from "@/lib/db";
import { CORE_QUESTIONS } from "@/lib/questionnaire";

export const runtime = "nodejs";

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json().catch(() => ({}))) as { context?: Record<string, string> };
    const userAgent = req.headers.get("user-agent") ?? undefined;
    const session = await createSession({
      context: body.context ?? {},
      userAgent,
    });
    return NextResponse.json({
      sessionId: session.id,
      firstQuestionId: CORE_QUESTIONS[0].id,
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}
