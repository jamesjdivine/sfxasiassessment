/**
 * Neon serverless Postgres client.
 *
 * Netlify DB injects `NETLIFY_DATABASE_URL` automatically. For local dev,
 * set it in .env.local.
 *
 * The Neon `@neondatabase/serverless` driver uses fetch + WebSocket under the
 * hood, which keeps cold starts fast in Netlify Functions.
 */

import { neon } from "@neondatabase/serverless";

type AnyRecord = Record<string, unknown>;

function getClient() {
  const url = process.env.NETLIFY_DATABASE_URL;
  if (!url) {
    throw new Error(
      "NETLIFY_DATABASE_URL is not set. Enable Netlify DB on the site or set it in .env.local."
    );
  }
  return neon(url);
}

export interface SessionRow {
  id: string;
  created_at: string;
  updated_at: string;
  completed_at: string | null;
  context: AnyRecord;
  transcript: Array<{ role: "assistant" | "user"; content: string; ts: string }>;
  core_answers: Record<string, string>;
  followup_answers: Record<string, string | string[]>;
  final_score: number | null;
  final_band: string | null;
  category_breakdown: AnyRecord | null;
}

export async function createSession(init: {
  context?: AnyRecord;
  userAgent?: string;
  ipHash?: string;
}): Promise<SessionRow> {
  const sql = getClient();
  const rows = (await sql`
    INSERT INTO sessions (context, user_agent, ip_hash)
    VALUES (${JSON.stringify(init.context ?? {})}::jsonb, ${init.userAgent ?? null}, ${init.ipHash ?? null})
    RETURNING *
  `) as unknown as SessionRow[];
  return rows[0];
}

export async function getSession(id: string): Promise<SessionRow | null> {
  const sql = getClient();
  const rows = (await sql`SELECT * FROM sessions WHERE id = ${id}`) as unknown as SessionRow[];
  return rows[0] ?? null;
}

export async function updateSession(
  id: string,
  patch: Partial<
    Pick<
      SessionRow,
      | "transcript"
      | "core_answers"
      | "followup_answers"
      | "final_score"
      | "final_band"
      | "category_breakdown"
      | "completed_at"
      | "context"
    >
  >
): Promise<void> {
  const sql = getClient();
  await sql`
    UPDATE sessions SET
      transcript         = COALESCE(${patch.transcript ? JSON.stringify(patch.transcript) : null}::jsonb, transcript),
      core_answers       = COALESCE(${patch.core_answers ? JSON.stringify(patch.core_answers) : null}::jsonb, core_answers),
      followup_answers   = COALESCE(${patch.followup_answers ? JSON.stringify(patch.followup_answers) : null}::jsonb, followup_answers),
      context            = COALESCE(${patch.context ? JSON.stringify(patch.context) : null}::jsonb, context),
      final_score        = COALESCE(${patch.final_score ?? null}, final_score),
      final_band         = COALESCE(${patch.final_band ?? null}, final_band),
      category_breakdown = COALESCE(${patch.category_breakdown ? JSON.stringify(patch.category_breakdown) : null}::jsonb, category_breakdown),
      completed_at       = COALESCE(${patch.completed_at ?? null}, completed_at)
    WHERE id = ${id}
  `;
}

export interface LeadRow {
  id: string;
  session_id: string;
  created_at: string;
  full_name: string;
  work_email: string;
  company: string | null;
  phone: string | null;
  job_title: string | null;
  notes: string | null;
  consented_to_contact: boolean;
  snowfox_emailed_at: string | null;
  prospect_emailed_at: string | null;
  email_error: string | null;
}

export async function createLead(init: {
  sessionId: string;
  fullName: string;
  workEmail: string;
  company?: string;
  phone?: string;
  jobTitle?: string;
  notes?: string;
}): Promise<LeadRow> {
  const sql = getClient();
  const rows = (await sql`
    INSERT INTO leads (session_id, full_name, work_email, company, phone, job_title, notes)
    VALUES (
      ${init.sessionId},
      ${init.fullName},
      ${init.workEmail},
      ${init.company ?? null},
      ${init.phone ?? null},
      ${init.jobTitle ?? null},
      ${init.notes ?? null}
    )
    RETURNING *
  `) as unknown as LeadRow[];
  return rows[0];
}

export async function markLeadEmailed(
  id: string,
  which: "snowfox" | "prospect",
  errorMessage?: string
): Promise<void> {
  const sql = getClient();
  if (which === "snowfox") {
    await sql`UPDATE leads SET snowfox_emailed_at = NOW(), email_error = ${errorMessage ?? null} WHERE id = ${id}`;
  } else {
    await sql`UPDATE leads SET prospect_emailed_at = NOW(), email_error = ${errorMessage ?? null} WHERE id = ${id}`;
  }
}

// ---------------------------------------------------------------------------
// Admin views — read-only summaries for the password-protected /admin pages.
// ---------------------------------------------------------------------------

export interface AdminLeadSummary {
  lead_id: string;
  session_id: string;
  created_at: string;
  full_name: string;
  work_email: string;
  company: string | null;
  job_title: string | null;
  phone: string | null;
  industry: string | null;
  employees: string | null;
  revenue: string | null;
  operations: string | null;
  final_score: number | null;
  final_band: string | null;
  prospect_emailed_at: string | null;
  email_error: string | null;
}

export async function listRecentLeads(limit = 50): Promise<AdminLeadSummary[]> {
  const sql = getClient();
  const rows = await sql`
    SELECT
      l.id                         AS lead_id,
      l.session_id                 AS session_id,
      l.created_at                 AS created_at,
      l.full_name                  AS full_name,
      l.work_email                 AS work_email,
      l.company                    AS company,
      l.job_title                  AS job_title,
      l.phone                      AS phone,
      s.context->>'C1'             AS industry,
      s.context->>'C2'             AS employees,
      s.context->>'C3'             AS revenue,
      s.context->>'C4'             AS operations,
      s.final_score                AS final_score,
      s.final_band                 AS final_band,
      l.prospect_emailed_at        AS prospect_emailed_at,
      l.email_error                AS email_error
    FROM leads l
    JOIN sessions s ON s.id = l.session_id
    ORDER BY l.created_at DESC
    LIMIT ${limit}
  `;
  return rows as unknown as AdminLeadSummary[];
}

export interface AdminSessionSummary {
  id: string;
  created_at: string;
  completed_at: string | null;
  final_score: number | null;
  final_band: string | null;
  industry: string | null;
  employees: string | null;
  revenue: string | null;
  operations: string | null;
  has_lead: boolean;
}

export async function listRecentSessions(limit = 50): Promise<AdminSessionSummary[]> {
  const sql = getClient();
  const rows = await sql`
    SELECT
      s.id                         AS id,
      s.created_at                 AS created_at,
      s.completed_at               AS completed_at,
      s.final_score                AS final_score,
      s.final_band                 AS final_band,
      s.context->>'C1'             AS industry,
      s.context->>'C2'             AS employees,
      s.context->>'C3'             AS revenue,
      s.context->>'C4'             AS operations,
      EXISTS (SELECT 1 FROM leads l WHERE l.session_id = s.id) AS has_lead
    FROM sessions s
    WHERE s.completed_at IS NOT NULL
    ORDER BY s.completed_at DESC
    LIMIT ${limit}
  `;
  return rows as unknown as AdminSessionSummary[];
}

export interface AdminCounts {
  sessions_total: number;
  completed_total: number;
  completed_7d: number;
  leads_total: number;
  leads_7d: number;
  avg_score: number | null;
}

export async function getAdminCounts(): Promise<AdminCounts> {
  const sql = getClient();
  const rows = await sql`
    SELECT
      (SELECT COUNT(*)::INT FROM sessions)                                              AS sessions_total,
      (SELECT COUNT(*)::INT FROM sessions WHERE completed_at IS NOT NULL)               AS completed_total,
      (SELECT COUNT(*)::INT FROM sessions WHERE completed_at >= NOW() - INTERVAL '7 days')  AS completed_7d,
      (SELECT COUNT(*)::INT FROM leads)                                                 AS leads_total,
      (SELECT COUNT(*)::INT FROM leads WHERE created_at >= NOW() - INTERVAL '7 days')   AS leads_7d,
      (SELECT ROUND(AVG(final_score))::INT FROM sessions WHERE final_score IS NOT NULL) AS avg_score
  `;
  const r = (rows as unknown as AdminCounts[])[0];
  return r;
}

export interface AdminSessionDetail {
  session: SessionRow;
  lead: LeadRow | null;
}

export async function getSessionDetail(sessionId: string): Promise<AdminSessionDetail | null> {
  const sql = getClient();
  const sessionRows = (await sql`SELECT * FROM sessions WHERE id = ${sessionId}`) as unknown as SessionRow[];
  if (sessionRows.length === 0) return null;
  const leadRows = (await sql`SELECT * FROM leads WHERE session_id = ${sessionId} LIMIT 1`) as unknown as LeadRow[];
  return { session: sessionRows[0], lead: leadRows[0] ?? null };
}
