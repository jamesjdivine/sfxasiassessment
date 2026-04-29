"use client";

import { useState } from "react";
import IntakeForm from "@/components/IntakeForm";
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
  const [contextAnswers, setContextAnswers] = useState<Record<string, string> | null>(null);
  const [final, setFinal] = useState<FinalScore | null>(null);
  const [leadSent, setLeadSent] = useState(false);

  // Phase 3 — score + lead capture
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
                A copy of your score is on its way to your inbox. One of our senior business
                advisors will review your results as well and will be in touch.
              </p>
            </div>
          </div>
        )}
      </>
    );
  }

  // Phase 2 — chat assessment (intake done, session created)
  if (sessionId && contextAnswers) {
    return (
      <ChatShell
        sessionId={sessionId}
        onDone={(sid, score) => {
          if (score) setFinal(score);
          setSessionId(sid);
        }}
      />
    );
  }

  // Phase 1 — intake form (default landing state)
  return (
    <IntakeForm
      onSubmitted={(sid, ctx) => {
        setSessionId(sid);
        setContextAnswers(ctx);
      }}
    />
  );
}
