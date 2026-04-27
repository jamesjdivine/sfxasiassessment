"use client";

/**
 * Chat shell for the AI Readiness conversational assessment.
 *
 * Receives a pre-created sessionId from the parent (the IntakeForm builds the
 * session when the user submits the intake screen). On mount, the shell calls
 * /api/turn with no userReply to fetch the first scripted question, then
 * advances each turn as the user picks options.
 */

import { useEffect, useRef, useState } from "react";
import type { AnswerOption } from "@/lib/questionnaire";

type Message = { role: "assistant" | "user"; content: string; id: string };

interface TurnResponse {
  kind: "core" | "followUp" | "done";
  questionId?: string;
  assistantMessage?: string;
  options?: AnswerOption[];
  multiSelect?: boolean;
  ambiguous?: boolean;
  progress?: { answered: number; total: number };
  score?: {
    score: number;
    band: { label: string; meaning: string; nextActions: string };
    categories: Array<{ code: string; name: string; weight: number; categoryPercent: number }>;
  };
}

interface Props {
  sessionId: string;
  onDone: (sessionId: string, score: TurnResponse["score"]) => void;
}

export default function ChatShell({ sessionId, onDone }: Props) {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "intro",
      role: "assistant",
      content:
        "Thanks — let's get started. I'll ask a series of questions and you'll get a 1–100 readiness score at the end.",
    },
  ]);
  const [options, setOptions] = useState<AnswerOption[] | null>(null);
  const [multiSelect, setMultiSelect] = useState(false);
  const [selected, setSelected] = useState<string[]>([]);
  const [typing, setTyping] = useState(false);
  const [progress, setProgress] = useState<{ answered: number; total: number } | null>(null);
  const startedRef = useRef(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Scroll to latest message whenever the list changes.
  useEffect(() => {
    scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: "smooth" });
  }, [messages, typing]);

  // Kick off the first scripted question on mount (guarded against React StrictMode double-mount).
  useEffect(() => {
    if (startedRef.current) return;
    startedRef.current = true;
    void advance(undefined);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  async function advance(userReply: string | undefined) {
    setTyping(true);
    setOptions(null);
    try {
      const res = await fetch("/api/turn", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ sessionId, userReply }),
      });
      const data = (await res.json()) as TurnResponse;
      setTyping(false);

      if (data.progress) setProgress(data.progress);

      if (data.kind === "done") {
        setMessages((m) => [
          ...m,
          {
            id: `done-${Date.now()}`,
            role: "assistant",
            content:
              data.assistantMessage ?? "All done — generating your score now.",
          },
        ]);
        onDone(sessionId, data.score);
        return;
      }

      if (data.assistantMessage) {
        setMessages((m) => [
          ...m,
          { id: `a-${Date.now()}`, role: "assistant", content: data.assistantMessage! },
        ]);
      }
      if (data.options) setOptions(data.options);
      setMultiSelect(Boolean(data.multiSelect));
      setSelected([]);
    } catch {
      setTyping(false);
      setMessages((m) => [
        ...m,
        {
          id: `err-${Date.now()}`,
          role: "assistant",
          content:
            "Something went wrong reaching the assistant. Give it a moment and pick an option to continue.",
        },
      ]);
    }
  }

  async function handleOptionPick(optionId: string) {
    if (multiSelect) {
      const newSel = selected.includes(optionId)
        ? selected.filter((x) => x !== optionId)
        : [...selected, optionId];
      setSelected(newSel);
      return;
    }
    // Single-select: echo user + advance.
    const picked = options?.find((o) => o.id === optionId);
    setMessages((m) => [
      ...m,
      { id: `u-${Date.now()}`, role: "user", content: picked?.label ?? optionId },
    ]);
    // Send the option LABEL to Claude as the user reply — Claude maps it back to
    // the canonical option id. Same endpoint also handles free-text replies.
    await advance(picked?.label ?? optionId);
  }

  async function submitMultiSelect() {
    if (selected.length === 0) return;
    const labels = selected
      .map((id) => options?.find((o) => o.id === id)?.label)
      .filter(Boolean)
      .join(", ");
    setMessages((m) => [
      ...m,
      { id: `u-${Date.now()}`, role: "user", content: labels },
    ]);
    await advance(labels);
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-6">
      {progress && (
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs text-ink-400 mb-1">
            <span>Progress</span>
            <span>
              {Math.min(progress.answered, progress.total)} / ~{progress.total}
            </span>
          </div>
          <div className="h-2 rounded-full bg-snow-200 overflow-hidden">
            <div
              className="h-full bg-fox-600 transition-all"
              style={{
                width: `${Math.min(100, (progress.answered / progress.total) * 100)}%`,
              }}
            />
          </div>
        </div>
      )}

      <div
        ref={scrollRef}
        className="rounded-xl border border-snow-200 bg-snow-50 h-[60vh] min-h-[420px] overflow-y-auto p-4 space-y-3"
      >
        {messages.map((m) => (
          <div
            key={m.id}
            className={`bubble-enter max-w-[85%] rounded-2xl px-4 py-3 text-sm leading-relaxed ${
              m.role === "assistant"
                ? "bg-snow-100 text-ink-900"
                : "bg-navy-900 text-snow-50 ml-auto"
            }`}
          >
            {m.content}
          </div>
        ))}
        {typing && (
          <div className="bubble-enter max-w-[85%] rounded-2xl px-4 py-3 text-sm bg-snow-100 text-ink-400 italic">
            …
          </div>
        )}
      </div>

      {options && (
        <div className="mt-4 grid gap-2">
          {options.map((o) => {
            const isSelected = selected.includes(o.id);
            return (
              <button
                key={o.id}
                onClick={() => handleOptionPick(o.id)}
                className={`text-left rounded-lg border px-4 py-3 transition text-sm ${
                  isSelected
                    ? "border-fox-600 bg-fox-600/10 text-ink-900"
                    : "border-snow-300 bg-snow-50 hover:border-navy-700 hover:bg-snow-100 text-ink-900"
                }`}
              >
                {o.label}
              </button>
            );
          })}
          {multiSelect && (
            <button
              onClick={submitMultiSelect}
              disabled={selected.length === 0}
              className="mt-2 rounded-lg bg-fox-600 disabled:bg-snow-300 text-snow-50 font-semibold px-5 py-2.5"
            >
              Submit selection
            </button>
          )}
        </div>
      )}
    </div>
  );
}
