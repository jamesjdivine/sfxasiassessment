-- SnowFox AI Readiness Assessment — post-schema verification.
-- Run this in the Neon SQL editor AFTER schema.sql. Expected output:
--   - 2 rows under "tables" (leads, sessions)
--   - 4 rows under "indexes" (excluding primary keys)
--   - 1 row under "triggers" (sessions_touch_updated_at)
--   - 1 row under "extensions" (pgcrypto)

SELECT 'tables' AS object_type, table_name AS object_name
FROM information_schema.tables
WHERE table_schema = 'public'
  AND table_name IN ('sessions', 'leads')

UNION ALL
SELECT 'indexes', indexname
FROM pg_indexes
WHERE schemaname = 'public'
  AND indexname IN (
    'sessions_created_at_idx',
    'sessions_completed_at_idx',
    'leads_session_idx',
    'leads_email_idx'
  )

UNION ALL
SELECT 'triggers', trigger_name
FROM information_schema.triggers
WHERE trigger_schema = 'public'
  AND trigger_name = 'sessions_touch_updated_at'

UNION ALL
SELECT 'extensions', extname
FROM pg_extension
WHERE extname = 'pgcrypto'

ORDER BY object_type, object_name;

-- Quick smoke test: insert + read + cleanup. Should return 1 row, then leave no residue.
-- Uncomment to run.
-- INSERT INTO sessions (context) VALUES ('{"C1":"test"}'::jsonb) RETURNING id, created_at;
-- SELECT id, created_at, updated_at, context FROM sessions ORDER BY created_at DESC LIMIT 1;
-- DELETE FROM sessions WHERE context->>'C1' = 'test';
