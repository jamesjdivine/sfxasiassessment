/**
 * POST /api/turn
 * The heart of the agentic loop.
 *
 * Given a session + (optional) user reply, it:
 *   1. Loads the session.
 *   2. Figures out the next question (or determines we're done).
 *   3. Calls Claude to phrase the question OR resolve the user's reply.
 *   4. If resolved, persists the answer and returns the NEXT question's phrasing.
 *   5. If done, computes the final score and returns it.
 *
 * Body: { sessionId: string, userReply?: string }
 */

import { NextRequest, NextResponse } from "next/server";
import { getSession, updateSession } from "@/lib/db";
import { nextTurn } from "@/lib/claude";
import {
  FOLLOW_UP_BY_ID,
  QUESTION_BY_ID,
} from "@/lib/questionnaire";
import {
  computeScore,
  planNextQuestion,
  type Answers,
} from "@/lib/scoring";

export const runtime = "nodejs";
export const maxDuration = 30; // seconds

export async function POST(req: NextRequest) {
  try {
    const { sessionId, userReply } = (await req.json()) as {
      sessionId: string;
      userReply?: string;
    };
    if (!sessionId) {
      return NextResponse.json({ error: "sessionId required" }, { status: 400 });
    }

    const session = await getSession(sessionId);
    if (!session) return NextResponse.json({ error: "session not found" }, { status: 404 });

    const answers: Answers = {
      core: (session.core_answers ?? {}) as Record<string, string>,
      followUps: (session.followup_answers ?? {}) as Record<string, string | string[]>,
      context: (session.context ?? {}) as Record<string, string>,
    };
    const transcript = (session.transcript ?? []) as Array<{ role: "assistant" | "user"; content: string; ts: string }>;

    const planned = planNextQuestion(answers);

    // --- Already done? Return score. ---
    if (planned.kind === "done") {
      const score = computeScore(answers);
      await updateSession(sessionId, {
        final_score: score.score,
        final_band: score.band.label,
        category_breakdown: { categories: score.categories, firedFollowUpIds: score.firedFollowUpIds },
        completed_at: new Date().toISOString(),
      });
      return NextResponse.json({ kind: "done", score });
    }

    const question =
      planned.kind === "core"
        ? QUESTION_BY_ID[planned.id!]
        : FOLLOW_UP_BY_ID[planned.id!];
    if (!question) {
      return NextResponse.json({ error: `unknown question ${planned.id}` }, { status: 500 });
    }

    // --- Ask Claude to phrase the next turn (or resolve the user's reply) ---
    const turn = await nextTurn({
      question,
      kind: planned.kind,
      transcript: transcript.map((t) => ({ role: t.role, content: t.content })),
      userReply,
    });

    const newTranscript = [...transcript];
    if (userReply) {
      newTranscript.push({ role: "user", content: userReply, ts: new Date().toISOString() });
    }
    newTranscript.push({
      role: "assistant",
      content: turn.assistantMessage,
      ts: new Date().toISOString(),
    });

    // --- If Claude resolved the user's reply, persist it and advance. ---
    if (turn.resolved != null && !turn.ambiguous) {
      if (planned.kind === "core") {
        if (typeof turn.resolved !== "string") {
          return NextResponse.json(
            { error: "core questions are single-select" },
            { status: 500 }
          );
        }
        answers.core[planned.id!] = turn.resolved;
        await updateSession(sessionId, {
          core_answers: answers.core,
          transcript: newTranscript,
        });
      } else {
        answers.followUps[planned.id!] = turn.resolved;
        await updateSession(sessionId, {
          followup_answers: answers.followUps,
          transcript: newTranscript,
        });
      }

      // Check if we're done after this answer.
      const nextPlan = planNextQuestion(answers);
      if (nextPlan.kind === "done") {
        const score = computeScore(answers);
        await updateSession(sessionId, {
          final_score: score.score,
          final_band: score.band.label,
          category_breakdown: { categories: score.categories, firedFollowUpIds: score.firedFollowUpIds },
          completed_at: new Date().toISOString(),
        });
        return NextResponse.json({
          kind: "done",
          assistantMessage: turn.assistantMessage,
          score,
        });
      }

      // Otherwise, recursively phrase the NEXT question so the UI always
      // receives a question to show. (One extra Claude call per resolved turn.)
      const nextQ =
        nextPlan.kind === "core"
          ? QUESTION_BY_ID[nextPlan.id!]
          : FOLLOW_UP_BY_ID[nextPlan.id!];
      const nextTurnOut = await nextTurn({
        question: nextQ,
        kind: nextPlan.kind,
        transcript: newTranscript.map((t) => ({ role: t.role, content: t.content })),
      });
      const finalTranscript = [
        ...newTranscript,
        { role: "assistant" as const, content: nextTurnOut.assistantMessage, ts: new Date().toISOString() },
      ];
      await updateSession(sessionId, { transcript: finalTranscript });

      return NextResponse.json({
        kind: nextPlan.kind,
        questionId: nextPlan.id,
        assistantMessage: nextTurnOut.assistantMessage,
        options: nextQ.options,
        multiSelect: "multiSelect" in nextQ ? nextQ.multiSelect : false,
        progress: progressFromAnswers(answers),
      });
    }

    // --- Otherwise this is the first ask or an ambiguous reply. ---
    await updateSession(sessionId, { transcript: newTranscript });
    return NextResponse.json({
      kind: planned.kind,
      questionId: planned.id,
      assistantMessage: turn.assistantMessage,
      options: question.options,
      multiSelect: "multiSelect" in question ? question.multiSelect : false,
      ambiguous: turn.ambiguous,
      progress: progressFromAnswers(answers),
    });
  } catch (err) {
    return NextResponse.json(
      { error: err instanceof Error ? err.message : "unknown" },
      { status: 500 }
    );
  }
}

function progressFromAnswers(a: Answers): { answered: number; total: number } {
  const core = Object.keys(a.core).length;
  const fu = Object.keys(a.followUps).length;
  // We don't know exactly how many follow-ups will fire until all core answers
  // are in, so use a generous denominator for the progress bar.
  return { answered: core + fu, total: 23 + 3 /* context-ish estimate */ };
}
