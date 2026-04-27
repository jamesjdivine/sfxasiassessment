"use client";

/**
 * Intake form rendered before the chat assessment begins.
 *
 * Collects the four context questions (industry, employees, revenue, operations)
 * on a single screen with a prominent confidentiality notice. On submit, creates
 * a session via /api/session and hands off the sessionId + context to the chat.
 */

import { useState } from "react";
import { CONTEXT_QUESTIONS } from "@/lib/questionnaire";

interface Props {
  onSubmitted: (sessionId: string, context: Record<string, string>) => void;
}

export default function IntakeForm({ onSubmitted }: Props) {
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const allAnswered = CONTEXT_QUESTIONS.every((q) => answers[q.id]);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!allAnswered) return;
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/session", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ context: answers }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: "unknown" }));
        throw new Error(msg ?? "Failed to start session");
      }
      const { sessionId } = (await res.json()) as { sessionId: string };
      onSubmitted(sessionId, answers);
    } catch (err) {
      setSubmitting(false);
      setError(err instanceof Error ? err.message : "Something went wrong.");
    }
  }

  return (
    <form onSubmit={handleSubmit} className="max-w-3xl mx-auto px-4 py-6">
      <div className="rounded-xl border border-snow-200 bg-snow-50 p-6">
        <h2 className="text-2xl font-semibold text-navy-900">Before we begin</h2>
        <p className="text-ink-500 mt-2">
          A few quick questions about your business to tailor the assessment.
          This takes about a minute.
        </p>

        <div
          role="note"
          aria-label="Confidentiality notice"
          className="mt-5 rounded-lg border border-navy-700/20 bg-navy-700/5 px-4 py-3 text-sm text-ink-700"
        >
          <strong className="text-navy-900">Your responses are confidential.</strong>{" "}
          Information you share here will not be shared with anyone outside of
          SnowFox Solutions. We use it only to generate your readiness score and
          tailor any follow-up if you choose to receive one.
        </div>
      </div>

      <div className="mt-6 space-y-6">
        {CONTEXT_QUESTIONS.map((q, qIdx) => (
          <fieldset
            key={q.id}
            className="rounded-xl border border-snow-200 bg-snow-50 p-6"
          >
            <legend className="text-sm font-semibold text-navy-900 px-2">
              {qIdx + 1}. {q.text}
            </legend>
            <div className="mt-3 grid gap-2">
              {q.options.map((opt) => {
                const selected = answers[q.id] === opt;
                return (
                  <label
                    key={opt}
                    className={`flex items-center gap-3 rounded-lg border px-4 py-3 cursor-pointer transition text-sm ${
                      selected
                        ? "border-fox-600 bg-fox-600/10 text-ink-900"
                        : "border-snow-300 bg-snow-50 hover:border-navy-700 hover:bg-snow-100 text-ink-900"
                    }`}
                  >
                    <input
                      type="radio"
                      name={q.id}
                      value={opt}
                      checked={selected}
                      onChange={() =>
                        setAnswers((a) => ({ ...a, [q.id]: opt }))
                      }
                      className="accent-fox-600"
                    />
                    <span>{opt}</span>
                  </label>
                );
              })}
            </div>
          </fieldset>
        ))}
      </div>

      {error && (
        <div
          role="alert"
          className="mt-6 rounded-lg border border-fox-600/30 bg-fox-600/5 px-4 py-3 text-sm text-fox-600"
        >
          {error}
        </div>
      )}

      <div className="mt-6 flex items-center justify-end">
        <button
          type="submit"
          disabled={!allAnswered || submitting}
          className="rounded-lg bg-fox-600 disabled:bg-snow-300 disabled:text-ink-400 text-snow-50 font-semibold px-6 py-3 transition">
          {submitting ? "Starting…" : "Start the assessment →"}
        </button>
      </div>
    </form>
  );
}
