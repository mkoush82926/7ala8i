-- Explicit Data API grants.
--
-- Older Supabase projects granted anon/authenticated/service_role table
-- privileges in `public` by default. Newer Supabase versions (and fresh local
-- stacks) no longer do, which leaves every table unreachable even when an RLS
-- policy allows the row. This migration states the classic baseline
-- explicitly so the schema behaves the same everywhere. RLS still decides
-- which rows each role can see, and later migrations (e.g.
-- 20250101001600_production_hardening, 20250101001800_private_columns...)
-- narrow these grants further with targeted REVOKEs, which run after this.
--
-- Idempotent and safe on projects that already have these grants.

GRANT USAGE ON SCHEMA public TO anon, authenticated, service_role;

GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO anon, authenticated;
GRANT ALL ON ALL TABLES IN SCHEMA public TO service_role;
GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO anon, authenticated, service_role;

ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO anon, authenticated;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT ALL ON TABLES TO service_role;
ALTER DEFAULT PRIVILEGES IN SCHEMA public
  GRANT USAGE, SELECT ON SEQUENCES TO anon, authenticated, service_role;
