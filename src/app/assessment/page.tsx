"use client";

import { useState } from "react";
import ChatShell from "@/components/ChatShell";
import ScoreCard from "@/components/ScoreCard";
import LeadForm from "@/components/LeadForm";

interface FinalScore {
  score: number;
  band: { label: string; meaning: string; nextActions: string };
  categories: Array<{ code: string; name: string; weight: number; categoryPercent: number }>;
}

export default function AssessmentPage() {
  const [sessionId, setSessionId] = useState<string | null>(null);
  const [final, setFinal] = useState<FinalScore | null>(null);
  const [leadSent, setLeadSent] = useState(false);

  if (final && sessionId) {
    return (
      <>
        <ScoreCard score={final.score} band={final.band} categories={final.categories} />
        {!leadSent ? (
          <LeadForm sessionId={sessionId} onSuccess={() => setLeadSent(true)} />
        ) : (
          <div className="max-w-2xl mx-auto px-4 mt-8">
            <div className="rounded-xl border border-snow-200 bg-snow-50 p-6 text-center">
              <div className="text-2xl font-semibold text-navy-900">Thanks — you're all set.</div>
              <p className="text-ink-500 mt-2">
                A copy of your score is on its way to your inbox, and a SnowFox advisor will be in
                touch within one business day.
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  return (
    <ChatShell
      onDone={(sid, score) => {
        setSessionId(sid);
        if (score) setFinal(score);
      }}
    />
  );
}
