import { describe, expect, it } from "vitest";
import { CORE_QUESTIONS, FOLLOW_UPS } from "../lib/questionnaire";
import { computeScore, planNextQuestion, type Answers } from "../lib/scoring";

/** Helper — answer every core question with option at the given index (0..4). */
function uniformCoreAnswers(optionIndex: number): Answers["core"] {
  const core: Record<string, string> = {};
  for (const q of CORE_QUESTIONS) {
    const opt = q.options[Math.min(optionIndex, q.options.length - 1)];
    core[q.id] = opt.id;
  }
  return core;
}

describe("computeScore", () => {
  it("returns 1 for the lowest possible answers (all 0 points)", () => {
    const answers: Answers = {
      core: uniformCoreAnswers(0),
      followUps: {},
      context: {},
    };
    const result = computeScore(answers);
    expect(result.score).toBe(1); // floored to 1
    expect(result.band.label).toBe("Foundational");
  });

  it("returns 100 for the highest possible answers (all 4 points)", () => {
    // Max core points + max follow-up bonuses -> every category capped at 100%.
    const answers: Answers = {
      core: uniformCoreAnswers(4),
      followUps: {
        // Follow-ups that fire at top answers:
        F1: ["a", "b", "c", "d", "e", "f"], // multi-select, 6 * 1 bonus = 6 (capped at 4)
        F2: "e", // +4 (capped at +2)
        F5: "d", // +3 (capped at +2)
        F6: "d", // +4 (capped at +2)
        F7: "a", // informational
      },
      context: {},
    };
    const result = computeScore(answers);
    expect(result.score).toBe(100);
    expect(result.band.label).toBe("Advanced");
    // Every category should be at or near 100% with the caps applied.
    for (const c of result.categories) {
      expect(c.categoryPercent).toBeCloseTo(100, 0);
    }
  });

  it("returns ~50 for mid-point answers (all option index 2)", () => {
    const answers: Answers = {
      core: uniformCoreAnswers(2),
      followUps: {},
      context: {},
    };
    const result = computeScore(answers);
    // 2 / 4 = 50% per category, weights sum to 1.0 -> score = 50
    expect(result.score).toBe(50);
    expect(result.band.label).toBe("Emerging");
  });

  it("weights sum to 1.0 across all categories", () => {
    const answers: Answers = {
      core: uniformCoreAnswers(2),
      followUps: {},
      context: {},
    };
    const result = computeScore(answers);
    const totalWeight = result.categories.reduce((s, c) => s + c.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 5);
  });

  it("does not allow follow-up bonuses to push a category above 100%", () => {
    // Max core answers already saturate each category; bonuses should be fully
    // clipped by the maxPoints cap.
    const answers: Answers = {
      core: uniformCoreAnswers(4),
      followUps: {
        F1: ["a", "b", "c", "d", "e", "f"],
        F2: "e",
        F5: "d",
        F6: "d",
      },
      context: {},
    };
    const result = computeScore(answers);
    for (const c of result.categories) {
      expect(c.cappedPoints).toBeLessThanOrEqual(c.maxPoints);
      expect(c.categoryPercent).toBeLessThanOrEqual(100);
    }
  });

  it("boosts Use Cases & ROI when F1 fires (AI in production)", () => {
    // Q18 at option 'c' (2 pts) fires F1; answering F1 should raise USE category.
    const baseCore = uniformCoreAnswers(0);
    baseCore["Q18"] = "c"; // 2 points -> triggers F1

    const withoutF1 = computeScore({ core: baseCore, followUps: {}, context: {} });
    const withF1 = computeScore({
      core: baseCore,
      followUps: { F1: ["a", "b"] }, // +2 bonus
      context: {},
    });

    const useWithout = withoutF1.categories.find((c) => c.code === "USE")!;
    const useWith = withF1.categories.find((c) => c.code === "USE")!;
    expect(useWith.bonusPoints).toBe(2);
    expect(useWith.cappedPoints).toBeGreaterThan(useWithout.cappedPoints);
    expect(withF1.score).toBeGreaterThan(withoutF1.score);
  });

  it("band boundaries match the spec", () => {
    expect(computeScore({ core: uniformCoreAnswers(0), followUps: {}, context: {} }).band.label).toBe("Foundational");
    expect(computeScore({ core: uniformCoreAnswers(1), followUps: {}, context: {} }).band.label).toBe("Developing");
    expect(computeScore({ core: uniformCoreAnswers(2), followUps: {}, context: {} }).band.label).toBe("Emerging");
    expect(computeScore({ core: uniformCoreAnswers(3), followUps: {}, context: {} }).band.label).toBe("Proficient");
    expect(computeScore({ core: uniformCoreAnswers(4), followUps: {}, context: {} }).band.label).toBe("Advanced");
  });

  it("fires F4 only when Q11 is 0", () => {
    const noStaff = { ...uniformCoreAnswers(0), Q11: "a" }; // 0 pts
    const withTeam = { ...uniformCoreAnswers(0), Q11: "d" }; // 3 pts

    expect(
      computeScore({ core: noStaff, followUps: {}, context: {} }).firedFollowUpIds
    ).toContain("F4");
    expect(
      computeScore({ core: withTeam, followUps: {}, context: {} }).firedFollowUpIds
    ).not.toContain("F4");
  });
});

describe("planNextQuestion", () => {
  it("asks Q1 first when nothing has been answered", () => {
    expect(planNextQuestion({ core: {}, followUps: {}, context: {} })).toEqual({
      kind: "core",
      id: "Q1",
    });
  });

  it("proceeds through core questions in order", () => {
    const partial: Answers = {
      core: { Q1: "a", Q2: "b", Q3: "c" },
      followUps: {},
      context: {},
    };
    expect(planNextQuestion(partial)).toEqual({ kind: "core", id: "Q4" });
  });

  it("returns a follow-up after all core questions are answered", () => {
    const core = uniformCoreAnswers(4); // Q11 = 'e' -> fires F5
    const next = planNextQuestion({ core, followUps: {}, context: {} });
    expect(next.kind).toBe("followUp");
    // Every "all-4" answer fires several follow-ups; F7 always fires. The order
    // matches FOLLOW_UPS declaration order.
    expect(FOLLOW_UPS.some((f) => f.id === next.id)).toBe(true);
  });

  it("returns 'done' when all core + fired follow-ups are answered", () => {
    const core = uniformCoreAnswers(4);
    // Answer every follow-up that should fire at all-4 core answers.
    const followUps: Record<string, string | string[]> = {};
    // Simulate F1, F2, F5, F6, F7 firing; answer each with the first option.
    for (const f of FOLLOW_UPS) {
      if (f.shouldAsk({ points: Object.fromEntries(CORE_QUESTIONS.map((q) => [q.id, 4])) })) {
        followUps[f.id] = f.multiSelect ? [f.options[0].id] : f.options[0].id;
      }
    }
    expect(planNextQuestion({ core, followUps, context: {} })).toEqual({ kind: "done" });
  });
});
