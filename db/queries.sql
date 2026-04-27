-- SnowFox AI Readiness Assessment — operational queries.
-- Paste these into the Neon SQL editor (console.neon.tech → sfxasiassessment → SQL Editor).
-- Each query is independent; copy the one you need and run it alone.

-- ===========================================================================
-- Q1. Recent leads — prospects who opted in to contact.
--    This is your "new business to follow up on" view. Ordered newest-first.
-- ===========================================================================
SELECT
  l.created_at AT TIME ZONE 'America/New_York'      AS lead_at,
  l.full_name,
  l.work_email,
  l.company,
  l.job_title,
  l.phone,
  s.final_score,
  s.final_band,
  s.context->>'C1'                                  AS industry,
  s.context->>'C2'                                  AS employees,
  s.context->>'C3'                                  AS revenue,
  s.context->>'C4'                                  AS operations,
  l.notes,
  (l.snowfox_emailed_at IS NOT NULL)                AS snowfox_notified,
  (l.prospect_emailed_at IS NOT NULL)               AS prospect_notified,
  l.email_error
FROM leads l
JOIN sessions s ON s.id = l.session_id
ORDER BY l.created_at DESC
LIMIT 50;


-- ===========================================================================
-- Q2. All completed assessments (funnel view).
--    Shows everyone who finished — including those who DIDN'T convert to a lead.
-- ===========================================================================
SELECT
  s.created_at   AT TIME ZONE 'America/New_York'    AS started_at,
  s.completed_at AT TIME ZONE 'America/New_York'    AS finished_at,
  s.final_score,
  s.final_band,
  s.context->>'C1'                                  AS industry,
  s.context->>'C2'                                  AS employees,
  s.context->>'C3'                                  AS revenue,
  s.context->>'C4'                                  AS operations,
  EXISTS (SELECT 1 FROM leads l WHERE l.session_id = s.id)  AS converted_to_lead
FROM sessions s
WHERE s.completed_at IS NOT NULL
ORDER BY s.completed_at DESC
LIMIT 50;


-- ===========================================================================
-- Q3. Weekly funnel summary — one-row report you can glance at.
-- ===========================================================================
SELECT
  (SELECT COUNT(*) FROM sessions)                                             AS sessions_started_total,
  (SELECT COUNT(*) FROM sessions WHERE completed_at IS NOT NULL)              AS completed_total,
  (SELECT COUNT(*) FROM sessions
     WHERE created_at >= NOW() - INTERVAL '7 days')                           AS started_7d,
  (SELECT COUNT(*) FROM sessions
     WHERE completed_at >= NOW() - INTERVAL '7 days')                         AS completed_7d,
  (SELECT COUNT(*) FROM leads)                                                AS leads_total,
  (SELECT COUNT(*) FROM leads WHERE created_at >= NOW() - INTERVAL '7 days')  AS leads_7d,
  (SELECT ROUND(AVG(final_score))::INT
     FROM sessions WHERE final_score IS NOT NULL)                             AS avg_score;


-- ===========================================================================
-- Q4. Score-band distribution — how "ready" are our leads, on average?
-- ===========================================================================
SELECT
  final_band,
  COUNT(*) AS count,
  ROUND(AVG(final_score))::INT AS avg_score
FROM sessions
WHERE completed_at IS NOT NULL
GROUP BY final_band
ORDER BY avg_score DESC NULLS LAST;


-- ===========================================================================
-- Q5. Full detail for one session — paste a session ID to see everything.
--    Useful when prepping for a call with a specific lead.
-- ===========================================================================
-- SELECT
--   id,
--   created_at AT TIME ZONE 'America/New_York' AS created_at_et,
--   completed_at AT TIME ZONE 'America/New_York' AS completed_at_et,
--   final_score,
--   final_band,
--   context,
--   core_answers,
--   followup_answers,
--   category_breakdown,
--   transcript
-- FROM sessions
-- WHERE id = 'PASTE-SESSION-UUID-HERE';


-- ===========================================================================
-- Q6. Emails that failed to send (diagnostic).
--    Until Resend is configured, every lead will show up here with
--    "RESEND_API_KEY is not set." or "SNOWFOX_FROM_EMAIL must be set."
-- ===========================================================================
SELECT
  l.created_at AT TIME ZONE 'America/New_York' AS lead_at,
  l.full_name,
  l.work_email,
  l.email_error
FROM leads l
WHERE l.email_error IS NOT NULL
ORDER BY l.created_at DESC
LIMIT 50;


-- ===========================================================================
-- Q7. Delete a single test/junk session (and its lead, via FK cascade).
--    Paste a session UUID. Use sparingly.
-- ===========================================================================
-- DELETE FROM sessions WHERE id = 'PASTE-SESSION-UUID-HERE';
