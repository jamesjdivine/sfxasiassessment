"use client";

import { useState } from "react";

interface Props {
  sessionId: string;
  onSuccess: () => void;
}

export default function LeadForm({ sessionId, onSuccess }: Props) {
  const [state, setState] = useState({
    fullName: "",
    workEmail: "",
    company: "",
    jobTitle: "",
    notes: "",
  });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/submit-lead", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, ...state }),
      });
      if (!res.ok) {
        const { error: msg } = await res.json().catch(() => ({ error: "unknown" }));
        throw new Error(msg ?? "Failed to submit");
      }
      onSuccess();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong.");
    } finally {
      setSubmitting(false);
    }
  }

  function field(key: keyof typeof state, label: string, type = "text", required = false) {
    return (
      <label className="block">
        <span className="text-sm font-medium text-ink-700">
          {label} {required && <span className="text-fox-600">*</span>}
        </span>
        <input
          required={required}
          type={type}
          value={state[key]}
          onChange={(e) => setState((s) => ({ ...s, [key]: e.target.value }))}
          className="mt-1 block w-full rounded-md border border-snow-300 bg-snow-50 px-3 py-2 focus:border-navy-700 focus:outline-none"
        />
      </label>
    );
  }

  return (
    <form onSubmit={submit} className="space-y-4 max-w-2xl mx-auto px-4 mt-8">
      <div className="rounded-xl border border-snow-200 bg-snow-50 p-6">
        <h3 className="font-semibold text-navy-900 text-lg">
          Want SnowFox to review your results?
        </h3>
        <p className="text-ink-500 text-sm mt-1">
          Share your info and a SnowFox advisor will follow up with a personalized next-step
          recommendation — usually within one business day. We'll also email you a copy of your score.
        </p>

        <div className="mt-5 grid grid-cols-1 md:grid-cols-2 gap-4">
          {field("fullName", "Full name", "text", true)}
          {field("workEmail", "Work email", "email", true)}
          {field("company", "Company")}
          {field("jobTitle", "Job title")}
        </div>

        <label className="block mt-4">
          <span className="text-sm font-medium text-ink-700">
            Anything else we should know? (optional)
          </span>
          <textarea
            value={state.notes}
            onChange={(e) => setState((s) => ({ ...s, notes: e.target.value }))}
            rows={3}
            className="mt-1 block w-full rounded-md border border-snow-300 bg-snow-50 px-3 py-2 focus:border-navy-700 focus:outline-none"
          />
        </label>

        {error && (
          <p className="text-sm text-red-600 mt-3">{error}</p>
        )}

        <button
          type="submit"
          disabled={submitting}
          className="mt-5 inline-flex items-center rounded-md bg-fox-600 hover:bg-fox-500 disabled:bg-snow-300 text-snow-50 font-semibold px-6 py-3"
        >
          {submitting ? "Sending…" : "Send my results & request a consultation"}
        </button>
      </div>
    </form>
  );
}
