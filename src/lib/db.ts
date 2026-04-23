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
