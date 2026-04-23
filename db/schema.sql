-- SnowFox AI Readiness Assessment — Postgres schema.
-- Run this once against your Netlify DB / Neon instance.
-- Idempotent: safe to re-run; uses IF NOT EXISTS everywhere.

CREATE EXTENSION IF NOT EXISTS "pgcrypto";

-- A `session` is one in-progress or completed questionnaire.
CREATE TABLE IF NOT EXISTS sessions (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  completed_at    TIMESTAMPTZ,

  -- Context answers (industry, size, revenue) captured up front.
  context         JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Running conversation transcript so the LLM has memory across turns.
  -- Shape: [{ role: 'assistant' | 'user', content: string, ts: iso8601 }, ...]
  transcript      JSONB NOT NULL DEFAULT '[]'::jsonb,

  -- Core answers: { Q1: 'a', Q2: 'b', ... }
  core_answers    JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Follow-up answers: { F1: ['a','c'], F2: 'd', ... }
  followup_answers JSONB NOT NULL DEFAULT '{}'::jsonb,

  -- Final snapshot computed when the user finishes.
  final_score         INTEGER CHECK (final_score BETWEEN 1 AND 100),
  final_band          TEXT,
  category_breakdown  JSONB,

  -- Lightweight client fingerprint for abuse prevention / analytics.
  user_agent      TEXT,
  ip_hash         TEXT
);

CREATE INDEX IF NOT EXISTS sessions_created_at_idx ON sessions (created_at DESC);
CREATE INDEX IF NOT EXISTS sessions_completed_at_idx ON sessions (completed_at DESC)
  WHERE completed_at IS NOT NULL;

-- Leads are created when a prospect opts in to send their results to SnowFox.
CREATE TABLE IF NOT EXISTS leads (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id    UUID NOT NULL REFERENCES sessions(id) ON DELETE CASCADE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),

  full_name     TEXT NOT NULL,
  work_email    TEXT NOT NULL,
  company       TEXT,
  phone         TEXT,
  job_title     TEXT,
  notes         TEXT,

  consented_to_contact BOOLEAN NOT NULL DEFAULT TRUE,

  -- Has the "send to SnowFox" email been delivered?
  snowfox_emailed_at   TIMESTAMPTZ,
  prospect_emailed_at  TIMESTAMPTZ,
  email_error          TEXT
);

CREATE INDEX IF NOT EXISTS leads_session_idx ON leads (session_id);
CREATE INDEX IF NOT EXISTS leads_email_idx ON leads (LOWER(work_email));

-- Auto-update `updated_at` on session row changes.
CREATE OR REPLACE FUNCTION touch_updated_at() RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS sessions_touch_updated_at ON sessions;
CREATE TRIGGER sessions_touch_updated_at
  BEFORE UPDATE ON sessions
  FOR EACH ROW EXECUTE FUNCTION touch_updated_at();
