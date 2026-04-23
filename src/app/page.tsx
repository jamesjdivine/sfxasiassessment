import Link from "next/link";
import { CATEGORIES } from "@/lib/questionnaire";

export default function HomePage() {
  return (
    <div className="max-w-4xl mx-auto px-6 py-16">
      <div className="text-sm uppercase tracking-wide text-fox-600 font-semibold mb-3">
        Free · 10 minutes
      </div>
      <h1 className="text-4xl md:text-5xl font-bold text-navy-900 leading-tight">
        See exactly how ready your business is for AI — and what to do next.
      </h1>
      <p className="mt-5 text-lg text-ink-500 max-w-2xl">
        Answer a short set of questions in a friendly, conversational format.
        You'll receive a <strong>1–100 AI Readiness Score</strong> with a category-by-category
        breakdown and a clear recommended roadmap — no sales pitch required.
      </p>

      <div className="mt-8 flex flex-wrap gap-3">
        <Link
          href="/assessment"
          className="inline-flex items-center rounded-md bg-fox-600 hover:bg-fox-500 text-snow-50 font-semibold px-6 py-3 shadow-sm"
        >
          Start the assessment →
        </Link>
        <a
          href="https://snowfoxsolutions.com"
          className="inline-flex items-center rounded-md border border-snow-300 text-ink-700 px-6 py-3 hover:bg-snow-100"
        >
          About SnowFox
        </a>
      </div>

      <section className="mt-16">
        <h2 className="text-xl font-semibold text-navy-900">What we measure</h2>
        <p className="text-ink-500 mt-2">
          Eight dimensions, weighted based on what matters most for practical AI adoption.
        </p>
        <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-4">
          {CATEGORIES.map((c) => (
            <div
              key={c.code}
              className="rounded-lg border border-snow-200 bg-snow-50 p-4"
            >
              <div className="flex items-center justify-between">
                <div className="font-semibold text-ink-900">{c.name}</div>
                <div className="text-xs text-ink-400">
                  Weight {(c.weight * 100).toFixed(0)}%
                </div>
              </div>
              <div className="text-sm text-ink-500 mt-1">{c.description}</div>
            </div>
          ))}
        </div>
      </section>

      <section className="mt-16 border-t border-snow-200 pt-12">
        <h2 className="text-xl font-semibold text-navy-900">How the score works</h2>
        <ol className="mt-4 space-y-3 text-ink-700 list-decimal list-inside">
          <li>You answer a short set of multiple-choice questions, guided by an AI assistant.</li>
          <li>Each answer earns points (0–4). Points are totaled per category.</li>
          <li>Categories are normalized to 100 and weighted to produce a 1–100 score.</li>
          <li>You see your score, band, category breakdown, and recommended next steps.</li>
          <li>Optionally share your results with SnowFox to schedule a follow-up consultation.</li>
        </ol>
      </section>
    </div>
  );
}
