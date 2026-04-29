/**
 * Admin dashboard — recent leads and recent completed sessions.
 * Gated by middleware; reaching here implies a valid sfx_admin cookie.
 */

import Link from "next/link";
import type { Route } from "next";
import {
  getAdminCounts,
  listRecentLeads,
  listRecentSessions,
  type AdminLeadSummary,
  type AdminSessionSummary,
} from "@/lib/db";
import LogoutButton from "./LogoutButton";

export const dynamic = "force-dynamic";
export const revalidate = 0;

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

export default async function AdminPage() {
  const [counts, leads, sessions] = await Promise.all([
    getAdminCounts(),
    listRecentLeads(50),
    listRecentSessions(50),
  ]);

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <header className="flex items-baseline justify-between mb-6">
        <div>
          <h1 className="text-2xl font-semibold text-navy-900">SnowFox Admin</h1>
          <p className="text-ink-500 text-sm">All times Eastern.</p>
        </div>
        <LogoutButton />
      </header>

      {/* Counts strip */}
      <section className="grid grid-cols-2 md:grid-cols-6 gap-3 mb-8">
        <Stat label="Sessions started" value={counts.sessions_total} />
        <Stat label="Completed" value={counts.completed_total} />
        <Stat label="Completed (7d)" value={counts.completed_7d} />
        <Stat label="Leads" value={counts.leads_total} />
        <Stat label="Leads (7d)" value={counts.leads_7d} />
        <Stat label="Avg score" value={counts.avg_score ?? "—"} />
      </section>

      {/* Leads */}
      <section className="mb-10">
        <h2 className="text-lg font-semibold text-navy-900 mb-3">
          Recent leads <span className="text-ink-400 font-normal text-sm">({leads.length})</span>
        </h2>
        {leads.length === 0 ? (
          <Empty>No leads yet.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-snow-200 bg-snow-50">
            <table className="w-full text-sm">
              <thead className="bg-snow-100 text-ink-700">
                <tr>
                  <Th>When</Th>
                  <Th>Name</Th>
                  <Th>Company</Th>
                  <Th>Email</Th>
                  <Th align="right">Score</Th>
                  <Th>Band</Th>
                  <Th>Industry</Th>
                  <Th>Size</Th>
                  <Th>Email status</Th>
                  <Th>Strategy plan</Th>
                </tr>
              </thead>
              <tbody>
                {leads.map((l: AdminLeadSummary) => (
                  <tr key={l.lead_id} className="border-t border-snow-200">
                    <Td>
                      <Link href={`/admin/${l.session_id}` as Route} className="text-navy-700 hover:underline">
                        {fmtDate(l.created_at)}
                      </Link>
                    </Td>
                    <Td>
                      {l.full_name}
                      {l.job_title && <span className="text-ink-400"> · {l.job_title}</span>}
                    </Td>
                    <Td>{l.company || "—"}</Td>
                    <Td>
                      <a href={`mailto:${l.work_email}`} className="text-navy-700 hover:underline">
                        {l.work_email}
                      </a>
                    </Td>
                    <Td align="right">{l.final_score ?? "—"}</Td>
                    <Td>{l.final_band ?? "—"}</Td>
                    <Td>{l.industry ?? "—"}</Td>
                    <Td>{l.employees ?? "—"}</Td>
                    <Td>
                      {l.email_error ? (
                        <span className="text-fox-600" title={l.email_error}>
                          Failed
                        </span>
                      ) : l.prospect_emailed_at ? (
                        <span className="text-emerald-700">Sent</span>
                      ) : (
                        <span className="text-ink-400">Pending</span>
                      )}
                    </Td>
                    <Td>
                      <PdfButton sessionId={l.session_id} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {/* Sessions */}
      <section>
        <h2 className="text-lg font-semibold text-navy-900 mb-3">
          Recent completed sessions <span className="text-ink-400 font-normal text-sm">({sessions.length})</span>
        </h2>
        {sessions.length === 0 ? (
          <Empty>No completed sessions yet.</Empty>
        ) : (
          <div className="overflow-x-auto rounded-xl border border-snow-200 bg-snow-50">
            <table className="w-full text-sm">
              <thead className="bg-snow-100 text-ink-700">
                <tr>
                  <Th>Started</Th>
                  <Th>Finished</Th>
                  <Th align="right">Score</Th>
                  <Th>Band</Th>
                  <Th>Industry</Th>
                  <Th>Size</Th>
                  <Th>Revenue</Th>
                  <Th>Operations</Th>
                  <Th>Lead?</Th>
                  <Th>Strategy plan</Th>
                </tr>
              </thead>
              <tbody>
                {sessions.map((s: AdminSessionSummary) => (
                  <tr key={s.id} className="border-t border-snow-200">
                    <Td>
                      <Link href={`/admin/${s.id}` as Route} className="text-navy-700 hover:underline">
                        {fmtDate(s.created_at)}
                      </Link>
                    </Td>
                    <Td>{fmtDate(s.completed_at)}</Td>
                    <Td align="right">{s.final_score ?? "—"}</Td>
                    <Td>{s.final_band ?? "—"}</Td>
                    <Td>{s.industry ?? "—"}</Td>
                    <Td>{s.employees ?? "—"}</Td>
                    <Td>{s.revenue ?? "—"}</Td>
                    <Td>{s.operations ?? "—"}</Td>
                    <Td>{s.has_lead ? "Yes" : "—"}</Td>
                    <Td>
                      <PdfButton sessionId={s.id} />
                    </Td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: number | string }) {
  return (
    <div className="rounded-xl border border-snow-200 bg-snow-50 p-3">
      <div className="text-xs uppercase tracking-wide text-ink-400">{label}</div>
      <div className="text-2xl font-semibold text-navy-900 mt-1">{value}</div>
    </div>
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

function Empty({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-xl border border-dashed border-snow-300 bg-snow-50 p-6 text-center text-ink-500 text-sm">
      {children}
    </div>
  );
}

function PdfButton({ sessionId }: { sessionId: string }) {
  const href = `/api/admin/strategy-pdf/${sessionId}`;
  return (
    <a
      href={href}
      className="inline-flex items-center rounded-md border border-navy-700 bg-snow-50 px-2 py-1 text-xs font-medium text-navy-700 hover:bg-navy-700 hover:text-snow-50 transition"
      title="Download SnowFox AI Strategy Plan PDF"
      download
    >
      Download PDF
    </a>
  );
}
