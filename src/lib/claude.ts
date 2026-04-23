/**
 * Claude wrapper for the agentic conversational layer.
 *
 * Design principle: the LLM *never* decides the score. It only produces a
 * friendly next-turn phrasing and extracts which of the defined answer options
 * the user's reply best maps to. If extraction is ambiguous, we ask the LLM to
 * return `ambiguous: true` so the UI can re-prompt.
 */

import Anthropic from "@anthropic-ai/sdk";
import type { AnswerOption, FollowUpQuestion, Question } from "./questionnaire";

const MODEL = "claude-sonnet-4-6";

function client() {
  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    throw new Error("ANTHROPIC_API_KEY is not set.");
  }
  return new Anthropic({ apiKey });
}

/**
 * System prompt that turns Claude into a friendly SnowFox assessment consultant.
 * Voice matches snowfoxsolutions.com: "disciplined, human, honest."
 */
export const SYSTEM_PROMPT = `You are the SnowFox AI Readiness assistant, a warm and professional consultant \
conducting a brief AI-readiness assessment for a business leader. SnowFox Solutions is a \
ServiceNow Premier Partner and independent technology advisor based in Blue Ash, Ohio. \
Your tone is disciplined, human, and honest — confident without being hype-y.

RULES
1. You are given the NEXT QUESTION and its fixed ANSWER OPTIONS. You MUST NOT invent new \
   options or ask questions that are not in the script. The scoring happens outside your \
   control and depends on the user selecting one of the defined options.
2. Your job each turn is to:
   a. Rephrase the question naturally, referencing what the user said before when helpful.
   b. Present the options clearly (numbered 1-N, using the exact labels you were given).
   c. If the user's free-text reply clearly maps to one of the options, return that option.
   d. If the reply is ambiguous, asks for clarification, or doesn't map — set ambiguous:true \
      and return a short clarifying message.
3. Never guess the user's industry, size, or score. Never promise what SnowFox will do.
4. Keep every message under ~60 words. No emoji.
5. Respond ONLY with JSON matching the schema provided in each tool call.`;

export interface NextTurnInput {
  question: Question | FollowUpQuestion;
  /** "core" | "followUp" — shapes the phrasing and reminds the model it's informational or scored. */
  kind: "core" | "followUp";
  /** Prior transcript, most recent last. */
  transcript: Array<{ role: "assistant" | "user"; content: string }>;
  /** The user's latest free-text reply, if we're resolving an answer. Empty on first ask. */
  userReply?: string;
}

export interface NextTurnOutput {
  /** Assistant-facing message to show in chat. */
  assistantMessage: string;
  /**
   * If the user's reply resolved cleanly to an option, this is its id; else null.
   * For multi-select follow-ups, an array of option ids.
   */
  resolved: string | string[] | null;
  ambiguous: boolean;
}

const SCHEMA_HINT = `{
  "assistantMessage": "<string, <=60 words>",
  "resolved": "<string|string[]|null>  // option id(s) if the user's reply maps; null if asking or ambiguous",
  "ambiguous": <boolean>
}`;

function describeOptions(options: AnswerOption[], multiSelect: boolean): string {
  const lines = options.map((o, i) => `${i + 1}. [${o.id}] ${o.label}`);
  const suffix = multiSelect ? "\n(User may select more than one.)" : "";
  return lines.join("\n") + suffix;
}

export async function nextTurn(input: NextTurnInput): Promise<NextTurnOutput> {
  const { question, kind, transcript, userReply } = input;
  const multiSelect = "multiSelect" in question ? question.multiSelect : false;
  const qText = "text" in question ? question.text : question.question;
  const userTurn = userReply?.trim()
    ? `\n\nUSER REPLY (resolve to an option if possible):\n"""${userReply.trim()}"""`
    : "\n\n(No user reply yet — introduce the question and present the options.)";

  const prompt = `TASK: ${kind === "followUp" ? "Follow-up question" : "Core assessment question"}.
QUESTION: ${qText}
OPTIONS:
${describeOptions(question.options, multiSelect)}
${userTurn}

Respond with ONLY a JSON object matching this schema:
${SCHEMA_HINT}`;

  const response = await client().messages.create({
    model: MODEL,
    max_tokens: 400,
    system: SYSTEM_PROMPT,
    messages: [
      ...transcript.map((m) => ({ role: m.role, content: m.content })),
      { role: "user" as const, content: prompt },
    ],
  });

  const text = response.content
    .filter((b): b is Anthropic.TextBlock => b.type === "text")
    .map((b) => b.text)
    .join("");

  return parseTurn(text);
}

/** Tolerant JSON parser — strips markdown fences if the model adds them. */
export function parseTurn(raw: string): NextTurnOutput {
  let body = raw.trim();
  if (body.startsWith("```")) {
    body = body.replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  }
  try {
    const parsed = JSON.parse(body);
    return {
      assistantMessage: String(parsed.assistantMessage ?? ""),
      resolved: parsed.resolved ?? null,
      ambiguous: Boolean(parsed.ambiguous),
    };
  } catch {
    // If the model mis-behaves, treat as an ambiguous response so the UI can
    // re-prompt the user rather than crashing.
    return {
      assistantMessage:
        "Sorry, I didn't quite catch that. Could you pick one of the numbered options?",
      resolved: null,
      ambiguous: true,
    };
  }
}
