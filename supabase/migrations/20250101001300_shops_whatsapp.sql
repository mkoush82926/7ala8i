-- 013_shops_whatsapp.sql
-- Fixes a Tier 0 bug: settings-page.tsx already reads/writes a `whatsapp` column
-- that was never added to `shops`, and queried a nonexistent `contact_email`
-- column instead of the real `email` column added in 002_add_missing_columns.sql.
-- This adds the missing column; the `contact_email` -> `email` fix is a
-- code-only change in settings-page.tsx.

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS whatsapp TEXT;
