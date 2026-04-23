"use client";

interface Props {
  score: number;
  band: {
    label: string;
    meaning: string;
    nextActions: string;
  };
  categories: Array<{ code: string; name: string; weight: number; categoryPercent: number }>;
}

export default function ScoreCard({ score, band, categories }: Props) {
  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="rounded-2xl bg-navy-900 text-snow-50 p-8 text-center shadow-lg">
        <div className="text-sm uppercase tracking-wider text-snow-300">Your AI Readiness Score</div>
        <div className="text-7xl font-bold leading-none mt-2">{score}</div>
        <div className="text-snow-300 mt-1">out of 100</div>
        <div className="mt-4 inline-block bg-fox-600 rounded-full px-4 py-1 text-sm font-semibold">
          {band.label}
        </div>
      </div>

      <div className="mt-6 rounded-xl border border-snow-200 bg-snow-50 p-6">
        <h3 className="font-semibold text-navy-900">What this means</h3>
        <p className="text-ink-700 mt-1">{band.meaning}</p>
        <h3 className="font-semibold text-navy-900 mt-4">Recommended next actions</h3>
        <p className="text-ink-700 mt-1">{band.nextActions}</p>
      </div>

      <div className="mt-6 rounded-xl border border-snow-200 bg-snow-50 p-6">
        <h3 className="font-semibold text-navy-900">Category breakdown</h3>
        <div className="mt-4 space-y-3">
          {categories.map((c) => (
            <div key={c.code}>
              <div className="flex justify-between text-sm">
                <span className="font-medium text-ink-900">{c.name}</span>
                <span className="text-ink-500">
                  {c.categoryPercent.toFixed(0)}% · weight {(c.weight * 100).toFixed(0)}%
                </span>
              </div>
              <div className="mt-1 h-2 rounded-full bg-snow-200 overflow-hidden">
                <div
                  className="h-full bg-navy-700"
                  style={{ width: `${Math.min(100, c.categoryPercent)}%` }}
                />
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
