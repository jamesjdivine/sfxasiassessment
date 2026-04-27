/**
 * Admin session detail — full transcript, answers, score breakdown, lead info.
 * Gated by middleware; valid session UUID required.
 */

import Link from "next/link";
import type { Route } from "next";
import { notFound } from "next/navigation";
import { getSessionDetail } from "@/lib/db";
import {
  CONTEXT_QUESTIONS,
  CORE_QUESTIONS,
  FOLLOW_UP_BY_ID,
  QUESTION_BY_ID,
} from "@/lib/questionnaire";
import LogoutButton from "../LogoutButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

interface Params {
  params: { sessionId: string };
}

function fmtDate(iso: string | null | Date): string {
  if (!iso) return "—";
  const d = typeof iso === "string" ? new Date(iso) : iso;
  if (isNaN(d.getTime())) return String(iso);
  return d.toLocaleString("en-US", {
    timeZone: "America/New_York",
    month: "short",
    day: "numeric",
    year: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export default async function SessionDetailPage({ params }: Params) {
  // Cheap UUID sanity check before hitting the DB.
  if (!/^[0-9a-f-]{36}$/i.test(params.sessionId)) {
    notFound();
  }
  const detail = await getSessionDetail(params.sessionId);
  if (!detail) notFound();

  const { session, lead } = detail;
  const ctx = (session.context ?? {}) as Record<string, string>;
  const coreAnswers = (session.core_answers ?? {}) as Record<string, string>;
  const followUpAnswers = (session.followup_answers ?? {}) as Record<string, string | string[]>;
  const breakdown = session.category_breakdown as
    | { categories?: Array<{ name: string; categoryPercent: number; rawPoints: number; bonusPoints: number; maxPoints: number }>; firedFollowUpIds?: string[] }
    | null;
  const transcript = session.transcript as Array<{ role: "assistant" | "user"; content: string; ts: string }>;

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      <header className="flex items-baseline justify-between mb-6">
        <div>
          <Link href={"/admin" as Route} className="text-sm text-navy-700 hover:underline">
            ← Back to dashboard
          </Link>
          <h1 className="text-2xl font-semibold text-navy-900 mt-2">Session detail</h1>
          <code className="text-xs text-ink-400 break-all">{session.id}</code>
        </div>
        <LogoutButton />
      </header>

      {/* Summary strip */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-3 mb-6">
        <Stat label="Score" value={session.final_score ?? "—"} />
        <Stat label="Band" value={session.final_band ?? "—"} />
        <Stat label="Started" value={fmtDate(session.created_at)} small />
        <Stat label="Finished" value={fmtDate(session.completed_at)} small />
      </section>

      {/* Lead */}
      {lead && (
        <Section title="Lead">
          <DefList
            rows={[
              ["Name", lead.full_name],
              ["Job title", lead.job_title],
              ["Company", lead.company],
              ["Email", lead.work_email],
              ["Phone", lead.phone],
              ["Submitted", fmtDate(lead.created_at)],
              [
                "Email status",
                lead.email_error ? `Failed — ${lead.email_error}` : lead.prospect_emailed_at ? `Sent ${fmtDate(lead.prospect_emailed_at)}` : "Pending",
              ],
              ["Notes", lead.notes],
            ]}
          />
        </Section>
      )}

      {/* Business context */}
      <Section title="Business context">
        <DefList
          rows={CONTEXT_QUESTIONS.map((q) => [q.text, ctx[q.id] ?? "—"])}
        />
      </Section>

      {/* Score breakdown */}
      {breakdown?.categories && (
        <Section title="Category breakdown">
          <div className="overflow-x-auto rounded-lg border border-snow-200 bg-snow-50">
            <table className="w-full text-sm">
              <thead className="bg-snow-100 text-ink-700">
                <tr>
                  <Th>Category</Th>
                  <Th align="right">%</Th>
                  <Th align="right">Points</Th>
                  <Th align="right">Bonus</Th>
                </tr>
              </thead>
              <tbody>
                {breakdown.categories.map((c, i) => (
                  <tr key={i} className="border-t border-snow-200">
                    <Td>{c.name}</Td>
                    <Td align="right">{c.categoryPercent.toFixed(0)}%</Td>
                    <Td align="right">
                      {c.rawPoints} / {c.maxPoints}
                    </Td>
                    <Td align="right">{c.bonusPoints || "—"}</Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          {breakdown.firedFollowUpIds && breakdown.firedFollowUpIds.length > 0 && (
            <p className="text-xs text-ink-400 mt-2">
              Fired follow-ups: {breakdown.firedFollowUpIds.join(", ")}
            </p>
          )}
        </Section>
      )}

      {/* Core answers */}
      <Section title={`Core answers (${Object.keys(coreAnswers).length} / ${CORE_QUESTIONS.length})`}>
        <ol className="space-y-3">
          {CORE_QUESTIONS.map((q) => {
            const answerId = coreAnswers[q.id];
            const opt = q.options.find((o) => o.id === answerId);
            return (
              <li key={q.id} className="rounded-lg border border-snow-200 bg-snow-50 p-3">
                <div className="text-xs text-ink-400 uppercase tracking-wide">{q.id} · {q.category}</div>
                <div className="text-sm text-ink-900 mt-1">{q.text}</div>
                <div className="mt-2 text-sm">
                  {opt ? (
                    <span>
                      <strong>{opt.label}</strong>{" "}
                      <span className="text-ink-400">({opt.points} pts)</span>
                    </span>
                  ) : (
                    <span className="text-ink-400">— not answered</span>
                  )}
                </div>
              </li>
            );
          })}
        </ol>
      </Section>

      {/* Follow-up answers */}
      {Object.keys(followUpAnswers).length > 0 && (
        <Section title="Follow-up answers">
          <ol className="space-y-3">
            {Object.entries(followUpAnswers).map(([fid, answer]) => {
              const f = FOLLOW_UP_BY_ID[fid];
              if (!f) return null;
              const labels = (Array.isArray(answer) ? answer : [answer])
                .map((id) => f.options.find((o) => o.id === id)?.label ?? id)
                .join(", ");
              return (
                <li key={fid} className="rounded-lg border border-snow-200 bg-snow-50 p-3">
                  <div className="text-xs text-ink-400 uppercase tracking-wide">{fid}</div>
                  <div className="text-sm text-ink-900 mt-1">{f.question}</div>
                  <div className="mt-2 text-sm"><strong>{labels}</strong></div>
                </li>
              );
            })}
          </ol>
        </Section>
      )}

      {/* Transcript */}
      <Section title={`Transcript (${transcript.length} messages)`}>
        <div className="space-y-2">
          {transcript.map((m, i) => (
            <div
              key={i}
              className={`rounded-lg px-3 py-2 text-sm ${
                m.role === "assistant" ? "bg-snow-100 text-ink-900" : "bg-navy-900 text-snow-50"
              }`}
            >
              <div className="text-xs opacity-70 mb-1">
                {m.role} · {fmtDate(m.ts)}
              </div>
              <div className="whitespace-pre-wrap">{m.content}</div>
            </div>
          ))}
        </div>
      </Section>
    </div>
  );
}

// --- Small presentational helpers ---

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mb-8">
      <h2 className="text-lg font-semibold text-navy-900 mb-3">{title}</h2>
      {children}
    </section>
  );
}

function Stat({ label, value, small }: { label: string; value: string | number; small?: boolean }) {
  return (
    <div className="rounded-xl border border-snow-200 bg-snow-50 p-3">
      <div className="text-xs uppercase tracking-wide text-ink-400">{label}</div>
      <div className={`${small ? "text-sm" : "text-2xl"} font-semibold text-navy-900 mt-1`}>{value}</div>
    </div>
  );
}

function DefList({ rows }: { rows: Array<[string, string | null | undefined]> }) {
  return (
    <dl className="rounded-lg border border-snow-200 bg-snow-50 divide-y divide-snow-200">
      {rows.map(([k, v]) => (
        <div key={k} className="grid grid-cols-3 gap-3 px-3 py-2 text-sm">
          <dt className="text-ink-400">{k}</dt>
          <dd className="col-span-2 text-ink-900 whitespace-pre-wrap">{v || "—"}</dd>
        </div>
      ))}
    </dl>
  );
}

function Th({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return (
    <th className={`px-3 py-2 text-${align} text-xs font-semibold uppercase tracking-wide`}>{children}</th>
  );
}

function Td({ children, align = "left" }: { children: React.ReactNode; align?: "left" | "right" }) {
  return <td className={`px-3 py-2 align-top text-${align}`}>{children}</td>;
}

// silence unused import warning if QUESTION_BY_ID isn't used
void QUESTION_BY_ID;
