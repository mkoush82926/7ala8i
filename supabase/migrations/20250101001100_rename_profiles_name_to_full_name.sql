-- ============================================
-- Fix critical schema drift: every application query and the
-- handle_new_user() trigger (see 003_customer_role.sql) read/write
-- public.profiles.full_name, but 001_initial_schema.sql only ever
-- defined public.profiles.name. A database built strictly from these
-- checked-in migrations would fail on every signup (the trigger inserts
-- a full_name column that doesn't exist) and on nearly every dashboard
-- query. Production almost certainly has full_name already, applied
-- out-of-band and never captured in a migration — this migration makes
-- the checked-in schema history match what the app actually requires,
-- so a fresh local/staging/CI database works correctly.
-- ============================================

DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'name'
  ) AND NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'full_name'
  ) THEN
    ALTER TABLE public.profiles RENAME COLUMN name TO full_name;
  END IF;
END $$;
