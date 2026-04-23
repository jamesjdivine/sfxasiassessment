/**
 * Deterministic 1-100 AI Readiness scoring engine.
 *
 * Keeping scoring in pure TypeScript (rather than the LLM) means the math is
 * reproducible, testable, and defensible when a prospect asks "how was my
 * score calculated?" The LLM's job is the conversational surface only.
 */

import {
  CATEGORIES,
  CATEGORY_BY_CODE,
  CORE_QUESTIONS,
  FOLLOW_UPS,
  FOLLOW_UP_BY_ID,
  QUESTION_BY_ID,
  SCORE_BANDS,
  type CategoryCode,
  type ScoreBand,
} from "./questionnaire";

/** User-submitted answers. */
export interface Answers {
  /** QID -> AnswerOption.id (single-select). */
  core: Record<string, string>;
  /**
   * Follow-up ID -> selected option id (single-select) or array of ids
   * (multi-select). Missing = not asked.
   */
  followUps: Record<string, string | string[]>;
  /** Context answers (CID -> option label). Not scored. */
  context: Record<string, string>;
}

export interface CategoryScore {
  code: CategoryCode;
  name: string;
  weight: number;
  maxPoints: number;
  rawPoints: number;
  bonusPoints: number;
  /** rawPoints + bonusPoints, capped at maxPoints. */
  cappedPoints: number;
  /** 0..100 — cappedPoints / maxPoints * 100. */
  categoryPercent: number;
  /** categoryPercent * weight. Sums across categories to produce the final score. */
  weightedContribution: number;
}

export interface ScoreResult {
  /** Final 1-100 score, floored to 1 for a completed questionnaire. */
  score: number;
  band: ScoreBand;
  categories: CategoryScore[];
  /** Follow-ups that fired based on the user's core answers. */
  firedFollowUpIds: string[];
}

function coreQuestionPoints(answers: Answers): Record<string, number> {
  const out: Record<string, number> = {};
  for (const q of CORE_QUESTIONS) {
    const chosen = answers.core[q.id];
    if (chosen == null) continue;
    const opt = q.options.find((o) => o.id === chosen);
    if (opt) out[q.id] = opt.points;
  }
  return out;
}

function followUpBonus(answer: string | string[] | undefined, opts: { id: string; points: number }[]): number {
  if (answer == null) return 0;
  if (Array.isArray(answer)) {
    return answer.reduce((sum, id) => {
      const o = opts.find((x) => x.id === id);
      return sum + (o?.points ?? 0);
    }, 0);
  }
  const o = opts.find((x) => x.id === answer);
  return o?.points ?? 0;
}

export function computeScore(answers: Answers): ScoreResult {
  const corePoints = coreQuestionPoints(answers);

  // Raw + max per category from core questions only.
  const raw: Record<CategoryCode, number> = {
    STR: 0, DAT: 0, TECH: 0, TAL: 0, PRO: 0, USE: 0, ETH: 0, FIN: 0,
  };
  const max: Record<CategoryCode, number> = {
    STR: 0, DAT: 0, TECH: 0, TAL: 0, PRO: 0, USE: 0, ETH: 0, FIN: 0,
  };

  for (const q of CORE_QUESTIONS) {
    const qMax = Math.max(...q.options.map((o) => o.points));
    max[q.category] += qMax;
    raw[q.category] += corePoints[q.id] ?? 0;
  }

  // Follow-up bonuses (only for scored follow-ups whose trigger fired).
  const firedFollowUpIds: string[] = [];
  const bonus: Record<CategoryCode, number> = {
    STR: 0, DAT: 0, TECH: 0, TAL: 0, PRO: 0, USE: 0, ETH: 0, FIN: 0,
  };

  for (const f of FOLLOW_UPS) {
    if (!f.shouldAsk({ points: corePoints })) continue;
    firedFollowUpIds.push(f.id);
    if (!f.scored || !f.targetCategory) continue;
    const earned = followUpBonus(answers.followUps[f.id], f.options);
    const capped = f.maxBonus != null ? Math.min(earned, f.maxBonus) : earned;
    bonus[f.targetCategory] += capped;
  }

  // Build per-category breakdown with capping so no category exceeds 100%.
  const categories: CategoryScore[] = CATEGORIES.map((c) => {
    const rawPts = raw[c.code];
    const bonusPts = bonus[c.code];
    const capped = Math.min(rawPts + bonusPts, max[c.code]);
    const pct = max[c.code] === 0 ? 0 : (capped / max[c.code]) * 100;
    return {
      code: c.code,
      name: c.name,
      weight: c.weight,
      maxPoints: max[c.code],
      rawPoints: rawPts,
      bonusPoints: bonusPts,
      cappedPoints: capped,
      categoryPercent: pct,
      weightedContribution: pct * c.weight,
    };
  });

  const sum = categories.reduce((acc, c) => acc + c.weightedContribution, 0);
  const score = Math.max(1, Math.round(sum));
  const band = bandFor(score);
  return { score, band, categories, firedFollowUpIds };
}

export function bandFor(score: number): ScoreBand {
  for (const b of SCORE_BANDS) {
    if (score >= b.min && score <= b.max) return b;
  }
  // Shouldn't happen once floored to 1-100, but fall back to the first band.
  return SCORE_BANDS[0];
}

/**
 * Returns the ordered list of question IDs the user will be asked, inserting
 * scored follow-ups immediately after the core question that triggered them.
 * Follow-ups are evaluated lazily at each step against the answers so far.
 */
export function planNextQuestion(answers: Answers): { kind: "core" | "followUp" | "done"; id?: string } {
  // Walk core questions in order; if the user hasn't answered one, ask it.
  for (const q of CORE_QUESTIONS) {
    if (answers.core[q.id] == null) {
      return { kind: "core", id: q.id };
    }
  }
  // All core questions answered — ask any fired follow-ups we haven't asked yet.
  const corePoints = coreQuestionPoints(answers);
  for (const f of FOLLOW_UPS) {
    if (!f.shouldAsk({ points: corePoints })) continue;
    if (answers.followUps[f.id] == null) {
      return { kind: "followUp", id: f.id };
    }
  }
  return { kind: "done" };
}

/** Lightweight guard used by the API: ensures answers are complete before scoring. */
export function isComplete(answers: Answers): boolean {
  return planNextQuestion(answers).kind === "done";
}

// Re-export commonly used bits so consumers import from one place.
export { CATEGORY_BY_CODE, QUESTION_BY_ID, FOLLOW_UP_BY_ID };
