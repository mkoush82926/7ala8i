-- ═══════════════════════════════════════════════════════════════════════════
-- 20250101001600_production_hardening.sql
--
-- One idempotent migration that reconciles schema drift and closes every
-- database-level finding from the production-readiness audit. Every
-- statement is guarded (IF [NOT] EXISTS / CREATE OR REPLACE / DROP POLICY IF
-- EXISTS / catalog checks), so it is a safe no-op where prod already matches,
-- and it also brings a database built from these migrations (`supabase db
-- reset`) up to the shape the app actually uses.
--
-- ─── MIGRATION VERSION RENAME (old → new) ─────────────────────────────────
-- The Supabase CLI takes the version from the prefix before the first "_"
-- and stores it as the primary key of supabase_migrations.schema_migrations.
-- 001–004 were each used twice, which broke `supabase db push/reset`. All
-- files were renamed to unique, monotonic versions, preserving order and
-- content (only two replay guards were added, see those files' comments):
--
--   001_initial_schema.sql                 → 20250101000100_initial_schema.sql
--   001_rls_policies.sql                   → 20250101000110_rls_policies.sql
--   002_add_missing_columns.sql            → 20250101000200_add_missing_columns.sql
--   002_indexes.sql                        → 20250101000210_indexes.sql
--   003_customer_role.sql                  → 20250101000300_customer_role.sql
--   003_public_booking_functions.sql       → 20250101000310_public_booking_functions.sql
--   004_fix_function_name.sql              → 20250101000400_fix_function_name.sql
--   004_secure_booking_rpc.sql             → 20250101000410_secure_booking_rpc.sql
--   005_barber_services.sql                → 20250101000500_barber_services.sql
--   006_working_hours.sql                  → 20250101000600_working_hours.sql
--   007_payments_and_policies.sql          → 20250101000700_payments_and_policies.sql
--   008_reviews.sql                        → 20250101000800_reviews.sql
--   009_notifications.sql                  → 20250101000900_notifications.sql
--   010_consolidate_shop_id_functions.sql  → 20250101001000_consolidate_shop_id_functions.sql
--   011_rename_profiles_name_to_full_name  → 20250101001100_rename_profiles_name_to_full_name.sql
--   012_link_customer_clients.sql          → 20250101001200_link_customer_clients.sql
--   013_shops_whatsapp.sql                 → 20250101001300_shops_whatsapp.sql
--   014_working_hour_breaks_and_invites    → 20250101001400_working_hour_breaks_and_invites.sql
--   015_profiles_rls_hardening.sql         → 20250101001500_profiles_rls_hardening.sql
--   (new) this file                        → 20250101001600_production_hardening.sql
--
-- ─── ALREADY-DEPLOYED DATABASE (production) ───────────────────────────────
-- (Superseded 2026-11.) Production does NOT contain everything in 0100…1500
-- (no barbers/barber_services/working_hours/invites; enum role/stage), so
-- those files must really run there; do NOT mark them as applied. Every file
-- 0100…1800 is replay-safe on top of production and was rehearsed with
-- scripts/rehearse-prod-upgrade.sh against a restored prod backup:
--   supabase migration repair --linked --status reverted <the 6 dashboard versions>
--   supabase db push --linked --include-all --dry-run
--   supabase db push --linked --include-all
-- Recommended pre-flight on prod (read-only):
--   select tablename, policyname, cmd, roles, qual, with_check from pg_policies where schemaname='public' order by 1,2;
--   select conrelid::regclass, conname, pg_get_constraintdef(oid) from pg_constraint where connamespace='public'::regnamespace;
-- From now on create migrations only with `supabase migration new <name>`.
-- CI check: `ls supabase/migrations | cut -d_ -f1 | sort | uniq -d` must print nothing.
--
-- NOTE: indexes are created with plain CREATE INDEX IF NOT EXISTS because
-- migrations run inside a transaction. On a very large prod table you may
-- pre-create them with CREATE INDEX CONCURRENTLY (same names) first; this
-- file then skips them.
-- ═══════════════════════════════════════════════════════════════════════════

-- Supabase installs extensions into the "extensions" schema.
CREATE SCHEMA IF NOT EXISTS extensions;
CREATE EXTENSION IF NOT EXISTS btree_gist WITH SCHEMA extensions;
CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. SCHEMA RECONCILIATION (columns the app reads/writes)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── shops ───
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS description TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS whatsapp TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS timezone TEXT NOT NULL DEFAULT 'Asia/Amman';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'JOD';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS cancellation_policy_hours INT DEFAULT 24;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS cancellation_fee_percent NUMERIC(5,2) DEFAULT 0;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
-- Production was built without 001_initial_schema's shops.settings column;
-- 20250101001800 (get_my_shop_private) reads it.
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS settings JSONB DEFAULT '{}';
ALTER TABLE public.shops ALTER COLUMN currency SET DEFAULT 'JOD';
-- The UI always displayed JOD while the column defaulted to 'USD'; every
-- existing shop is Jordanian, so backfill before the UI switches to
-- shops.currency. (One-time; a shop that deliberately picks USD later keeps it.)
UPDATE public.shops SET currency = 'JOD' WHERE currency IS NULL OR currency = 'USD';
UPDATE public.shops SET cancellation_policy_hours = 24 WHERE cancellation_policy_hours IS NULL;

-- ─── profiles ───
ALTER TABLE public.profiles ALTER COLUMN shop_id DROP NOT NULL;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS avatar_url TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS created_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- Production (built in the SQL editor) has profiles.role as enum user_role and
-- leads.stage as enum lead_stage; a replayed database has TEXT + CHECK. The
-- functions below write TEXT values into these columns (e.g. accept_invite sets
-- role = v_role), which an enum column rejects. Convert the enums to TEXT,
-- values unchanged. Policies that depend on the column block ALTER ... TYPE, so
-- they are captured, dropped and recreated identically (enum literal casts
-- rewritten to ::text); section 7 then replaces them with the canonical set.
-- No-op where the column is already TEXT.
CREATE OR REPLACE FUNCTION pg_temp.enum_column_to_text(p_table regclass, p_column text)
RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE
  v_attnum  int2;
  v_type    regtype;
  v_default text;
  r         record;
  v_sql     text;
  v_defs    text[] := '{}';
BEGIN
  SELECT a.attnum, a.atttypid::regtype INTO v_attnum, v_type
  FROM pg_attribute a WHERE a.attrelid = p_table AND a.attname = p_column AND NOT a.attisdropped;
  IF v_attnum IS NULL OR NOT EXISTS (SELECT 1 FROM pg_type t WHERE t.oid = v_type AND t.typtype = 'e') THEN
    RETURN;
  END IF;

  FOR r IN
    SELECT DISTINCT pol.oid, pol.polname, pol.polrelid::regclass AS tbl,
           CASE WHEN pol.polpermissive THEN 'PERMISSIVE' ELSE 'RESTRICTIVE' END AS kind,
           CASE pol.polcmd WHEN 'r' THEN 'SELECT' WHEN 'a' THEN 'INSERT' WHEN 'w' THEN 'UPDATE'
                           WHEN 'd' THEN 'DELETE' ELSE 'ALL' END AS cmd,
           CASE WHEN pol.polroles = '{0}' THEN 'PUBLIC'
                ELSE (SELECT string_agg(quote_ident(rolname), ', ') FROM pg_roles WHERE oid = ANY (pol.polroles)) END AS roles,
           pg_get_expr(pol.polqual, pol.polrelid)      AS qual,
           pg_get_expr(pol.polwithcheck, pol.polrelid) AS wc
    FROM pg_depend d JOIN pg_policy pol ON pol.oid = d.objid
    WHERE d.classid = 'pg_policy'::regclass AND d.refclassid = 'pg_class'::regclass
      AND d.refobjid = p_table AND d.refobjsubid = v_attnum
  LOOP
    v_sql := format('CREATE POLICY %I ON %s AS %s FOR %s TO %s', r.polname, r.tbl, r.kind, r.cmd, r.roles);
    IF r.qual IS NOT NULL THEN v_sql := v_sql || ' USING (' || r.qual || ')'; END IF;
    IF r.wc   IS NOT NULL THEN v_sql := v_sql || ' WITH CHECK (' || r.wc || ')'; END IF;
    v_defs := v_defs || replace(v_sql, '::' || v_type::text, '::text');
    EXECUTE format('DROP POLICY %I ON %s', r.polname, r.tbl);
  END LOOP;

  SELECT pg_get_expr(ad.adbin, ad.adrelid) INTO v_default
  FROM pg_attrdef ad WHERE ad.adrelid = p_table AND ad.adnum = v_attnum;
  EXECUTE format('ALTER TABLE %s ALTER COLUMN %I DROP DEFAULT', p_table, p_column);
  EXECUTE format('ALTER TABLE %s ALTER COLUMN %I TYPE text USING %I::text', p_table, p_column, p_column);
  IF v_default IS NOT NULL THEN
    EXECUTE format('ALTER TABLE %s ALTER COLUMN %I SET DEFAULT %s', p_table, p_column,
                   replace(v_default, '::' || v_type::text, '::text'));
  END IF;

  FOR i IN 1 .. coalesce(array_length(v_defs, 1), 0) LOOP
    EXECUTE v_defs[i];
  END LOOP;
  RAISE NOTICE '%.% converted from enum % to text (% dependent policies recreated)',
    p_table, p_column, v_type, coalesce(array_length(v_defs, 1), 0);
END $fn$;

SELECT pg_temp.enum_column_to_text('public.profiles', 'role');
SELECT pg_temp.enum_column_to_text('public.leads', 'stage');

DO $$
BEGIN
  -- Normalise the legacy seed role 'professional' (never valid) to 'barber'.
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema = 'public' AND table_name = 'profiles' AND column_name = 'role') = 'text' THEN
    UPDATE public.profiles SET role = 'barber' WHERE role = 'professional';
    ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_role_check;
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_role_check
      CHECK (role IN ('shop_admin', 'barber', 'customer')) NOT VALID;
  ELSE
    RAISE NOTICE 'profiles.role is not TEXT (enum?) — role CHECK left unchanged';
  END IF;
END $$;

-- ─── services ───
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS name_ar TEXT;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'scissors';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
DO $$ BEGIN
  ALTER TABLE public.services ADD CONSTRAINT services_price_nonneg CHECK (price >= 0) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.services ADD CONSTRAINT services_duration_range CHECK (duration BETWEEN 5 AND 480) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── clients ───
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS total_spend NUMERIC(10,2) DEFAULT 0;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS deleted_at TIMESTAMPTZ;
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS auth_user_id UUID;
ALTER TABLE public.clients ALTER COLUMN phone DROP NOT NULL;
-- Normalised phone (digits only) for matching; generated so it can never drift.
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS phone_digits TEXT
  GENERATED ALWAYS AS (regexp_replace(COALESCE(phone, ''), '\D', '', 'g')) STORED;
-- 001_initial_schema restricted clients.source to a list that excludes the
-- 'online' value the booking RPC writes. Replace with a length guard.
ALTER TABLE public.clients DROP CONSTRAINT IF EXISTS clients_source_check;
DO $$ BEGIN
  ALTER TABLE public.clients ADD CONSTRAINT clients_source_len CHECK (source IS NULL OR length(source) <= 50) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── appointments ───
DO $$
BEGIN
  -- Replayed DBs have date + TIME columns; prod has timestamptz. Convert only
  -- when still TIME, combining with the legacy date in the shop time zone.
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='appointments' AND column_name='start_time') = 'time without time zone' THEN
    ALTER TABLE public.appointments
      ALTER COLUMN start_time TYPE TIMESTAMPTZ USING ((date + start_time) AT TIME ZONE 'Asia/Amman'),
      ALTER COLUMN end_time   TYPE TIMESTAMPTZ USING ((date + end_time)   AT TIME ZONE 'Asia/Amman');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='appointments' AND column_name='date') THEN
    -- Kept (non-destructive) but no longer required; nothing reads it.
    ALTER TABLE public.appointments ALTER COLUMN date DROP NOT NULL;
  END IF;
END $$;

ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS client_name TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS price NUMERIC(10,2) NOT NULL DEFAULT 0;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS service_name TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS source TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS currency TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS cancellation_reason TEXT;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS no_show BOOLEAN DEFAULT false;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS amount_total NUMERIC(10,2);
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS amount_deposit NUMERIC(10,2);
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2);
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid';
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS payment_method TEXT;
ALTER TABLE public.appointments ALTER COLUMN client_id DROP NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN barber_id DROP NOT NULL;
-- Prod (SQL editor) has client_name NOT NULL and price without a default;
-- align with the replayed schema the app and tests are built against.
ALTER TABLE public.appointments ALTER COLUMN client_name DROP NOT NULL;
ALTER TABLE public.appointments ALTER COLUMN price SET DEFAULT 0;

-- Canonical status spelling is 'no_show'. Convert legacy values, then
-- (re)assert one CHECK.
DO $$
BEGIN
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='appointments' AND column_name='status') = 'text' THEN
    ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
    UPDATE public.appointments SET status = 'no_show' WHERE status IN ('no-show', 'noshow', 'no show');
    UPDATE public.appointments SET status = 'pending' WHERE status IS NULL;
    UPDATE public.appointments SET status = 'cancelled' WHERE status = 'canceled';
    ALTER TABLE public.appointments ALTER COLUMN status SET DEFAULT 'pending';
    ALTER TABLE public.appointments ALTER COLUMN status SET NOT NULL;
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
      CHECK (status IN ('pending', 'confirmed', 'completed', 'no_show', 'cancelled')) NOT VALID;
  ELSE
    RAISE NOTICE 'appointments.status is not TEXT — status CHECK left unchanged';
  END IF;
END $$;
UPDATE public.appointments SET no_show = true WHERE status = 'no_show' AND no_show IS DISTINCT FROM true;

DO $$ BEGIN
  ALTER TABLE public.appointments ADD CONSTRAINT appointments_time_order CHECK (end_time > start_time) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- ─── leads ───
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS contact TEXT;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS position INT DEFAULT 0;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS client_id UUID;
ALTER TABLE public.leads ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns
             WHERE table_schema='public' AND table_name='leads' AND column_name='phone') THEN
    ALTER TABLE public.leads ALTER COLUMN phone DROP NOT NULL;
  END IF;
  IF (SELECT data_type FROM information_schema.columns
      WHERE table_schema='public' AND table_name='leads' AND column_name='stage') = 'text' THEN
    ALTER TABLE public.leads DROP CONSTRAINT IF EXISTS leads_stage_check;
    UPDATE public.leads SET stage = 'regular' WHERE stage = 'loyal';
    ALTER TABLE public.leads ADD CONSTRAINT leads_stage_check
      CHECK (stage IN ('new', 'contacted', 'booked', 'completed', 'regular')) NOT VALID;
  END IF;
END $$;

-- ─── daily_sales: `time` (replay) vs `sale_time` (prod) ───
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='daily_sales' AND column_name='time')
     AND NOT EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='daily_sales' AND column_name='sale_time') THEN
    ALTER TABLE public.daily_sales RENAME COLUMN "time" TO sale_time;
  ELSIF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema='public' AND table_name='daily_sales' AND column_name='time') THEN
    ALTER TABLE public.daily_sales ALTER COLUMN "time" DROP NOT NULL;
  END IF;
END $$;
ALTER TABLE public.daily_sales ADD COLUMN IF NOT EXISTS sale_time TEXT;
-- Widen payment_method to match appointments/payments.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.daily_sales'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%payment_method%'
  LOOP
    EXECUTE format('ALTER TABLE public.daily_sales DROP CONSTRAINT %I', r.conname);
  END LOOP;
  ALTER TABLE public.daily_sales ADD CONSTRAINT daily_sales_payment_method_check
    CHECK (payment_method IN ('cash', 'card', 'online', 'mixed')) NOT VALID;
END $$;

-- ─── reviews ───
ALTER TABLE public.reviews ADD COLUMN IF NOT EXISTS reviewer_name TEXT;
ALTER TABLE public.reviews ALTER COLUMN client_id DROP NOT NULL;
-- Public display name ("Yousef R.") so the shop page no longer needs to embed
-- clients(name), which anon cannot (and must not) read.
UPDATE public.reviews r
SET reviewer_name = (
  SELECT split_part(trim(c.name), ' ', 1)
         || CASE WHEN split_part(trim(c.name), ' ', 2) <> ''
                 THEN ' ' || upper(left(split_part(trim(c.name), ' ', 2), 1)) || '.' ELSE '' END
  FROM public.clients c WHERE c.id = r.client_id)
WHERE r.reviewer_name IS NULL AND r.client_id IS NOT NULL;

-- ─── notifications ───
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS type TEXT;
ALTER TABLE public.notifications ADD COLUMN IF NOT EXISTS payload JSONB NOT NULL DEFAULT '{}'::jsonb;

-- ─── invites ───
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS accepted_by UUID;
ALTER TABLE public.invites ADD COLUMN IF NOT EXISTS accepted_at TIMESTAMPTZ;
DO $$ BEGIN
  ALTER TABLE public.invites DROP CONSTRAINT IF EXISTS invites_status_check;
  ALTER TABLE public.invites ADD CONSTRAINT invites_status_check
    CHECK (status IN ('pending', 'accepted', 'expired', 'revoked'));
END $$;

-- ─── working_hours / barber_services / payments ───
ALTER TABLE public.working_hours ADD COLUMN IF NOT EXISTS break_start TIME;
ALTER TABLE public.working_hours ADD COLUMN IF NOT EXISTS break_end TIME;
ALTER TABLE public.working_hours ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
DO $$ BEGIN
  ALTER TABLE public.working_hours ADD CONSTRAINT working_hours_time_order
    CHECK (is_working IS NOT TRUE OR end_time > start_time) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE public.working_hours ADD CONSTRAINT working_hours_break_valid
    CHECK (break_start IS NULL OR break_end IS NULL
           OR (break_end > break_start AND break_start >= start_time AND break_end <= end_time)) NOT VALID;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
ALTER TABLE public.barber_services ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();
ALTER TABLE public.payments ADD COLUMN IF NOT EXISTS updated_at TIMESTAMPTZ DEFAULT now();

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. FOREIGN KEYS / CASCADES (history must survive deletes)
--    Recreated NOT VALID so orphaned legacy rows never block the migration;
--    validation is attempted and skipped with a NOTICE if orphans exist.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION pg_temp.reset_fk(
  p_table text, p_column text, p_ref text, p_name text, p_action text
) RETURNS void LANGUAGE plpgsql AS $fn$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT c.conname FROM pg_constraint c
    JOIN pg_attribute a ON a.attrelid = c.conrelid AND a.attnum = ANY (c.conkey)
    WHERE c.conrelid = p_table::regclass AND c.contype = 'f' AND a.attname = p_column
  LOOP
    EXECUTE format('ALTER TABLE %s DROP CONSTRAINT %I', p_table, r.conname);
  END LOOP;
  EXECUTE format('ALTER TABLE %s ADD CONSTRAINT %I FOREIGN KEY (%I) REFERENCES %s ON DELETE %s NOT VALID',
                 p_table, p_name, p_column, p_ref, p_action);
  BEGIN
    EXECUTE format('ALTER TABLE %s VALIDATE CONSTRAINT %I', p_table, p_name);
  EXCEPTION WHEN foreign_key_violation THEN
    RAISE NOTICE '% has orphaned rows; constraint % left NOT VALID (new rows are still enforced)', p_table, p_name;
  END;
END $fn$;

-- barber_id points at profiles (staff), not the legacy barbers table.
SELECT pg_temp.reset_fk('public.appointments', 'barber_id', 'public.profiles(id)', 'appointments_barber_id_fkey', 'SET NULL');
SELECT pg_temp.reset_fk('public.appointments', 'client_id', 'public.clients(id)',  'appointments_client_id_fkey', 'SET NULL');
SELECT pg_temp.reset_fk('public.reviews',      'client_id', 'public.clients(id)',  'reviews_client_id_fkey',      'SET NULL');
SELECT pg_temp.reset_fk('public.clients',      'auth_user_id', 'auth.users(id)',   'clients_auth_user_id_fkey',   'SET NULL');
SELECT pg_temp.reset_fk('public.profiles',     'shop_id',   'public.shops(id)',    'profiles_shop_id_fkey',       'SET NULL');
SELECT pg_temp.reset_fk('public.leads',        'client_id', 'public.clients(id)',  'leads_client_id_fkey',        'SET NULL');
SELECT pg_temp.reset_fk('public.invites',      'accepted_by', 'auth.users(id)',    'invites_accepted_by_fkey',    'SET NULL');

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. updated_at TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$;

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['appointments','clients','leads','profiles','services','working_hours',
                           'barber_services','payments','invites']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I
                    FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t);
  END LOOP;
END $$;
DROP TRIGGER IF EXISTS on_shops_updated ON public.shops;
CREATE TRIGGER on_shops_updated BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. HOT INDEXES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE INDEX IF NOT EXISTS idx_appointments_shop_start   ON public.appointments (shop_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_barber_active ON public.appointments (barber_id, start_time)
  WHERE status IN ('pending', 'confirmed');
CREATE INDEX IF NOT EXISTS idx_appointments_client       ON public.appointments (client_id);
CREATE INDEX IF NOT EXISTS idx_clients_auth_user         ON public.clients (auth_user_id) WHERE auth_user_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_email_lower       ON public.clients (lower(email)) WHERE email IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_clients_shop_phone_digits ON public.clients (shop_id, phone_digits);
CREATE INDEX IF NOT EXISTS idx_barber_services_service   ON public.barber_services (service_id);
CREATE INDEX IF NOT EXISTS idx_working_hours_barber      ON public.working_hours (barber_id, day_of_week);
CREATE INDEX IF NOT EXISTS idx_reviews_shop_created      ON public.reviews (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_invites_shop              ON public.invites (shop_id);
CREATE INDEX IF NOT EXISTS idx_leads_shop_stage_position ON public.leads (shop_id, stage, position);
CREATE INDEX IF NOT EXISTS idx_daily_sales_shop_created  ON public.daily_sales (shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_notifications_user_unread ON public.notifications (user_id, is_read, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_profiles_shop_role        ON public.profiles (shop_id, role);

-- Trigram search indexes (operator class lives in whichever schema pg_trgm is in).
DO $$
DECLARE s text;
BEGIN
  SELECT n.nspname INTO s FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_clients_name_trgm ON public.clients USING gin (name %I.gin_trgm_ops)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_clients_phone_trgm ON public.clients USING gin (phone %I.gin_trgm_ops)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_appointments_client_name_trgm ON public.appointments USING gin (client_name %I.gin_trgm_ops)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_leads_name_trgm ON public.leads USING gin (name %I.gin_trgm_ops)', s);
END $$;

-- One review per appointment; one sale per appointment. Created only when
-- existing data has no duplicates (otherwise a NOTICE asks for cleanup; the
-- RPCs below still prevent new duplicates under a row lock).
DO $$
BEGIN
  IF NOT EXISTS (SELECT appointment_id FROM public.reviews WHERE appointment_id IS NOT NULL
                 GROUP BY appointment_id HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS reviews_appointment_uq ON public.reviews (appointment_id) WHERE appointment_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'Duplicate reviews per appointment exist; reviews_appointment_uq not created';
  END IF;
  IF NOT EXISTS (SELECT appointment_id FROM public.daily_sales WHERE appointment_id IS NOT NULL
                 GROUP BY appointment_id HAVING count(*) > 1) THEN
    CREATE UNIQUE INDEX IF NOT EXISTS daily_sales_appointment_uq ON public.daily_sales (appointment_id) WHERE appointment_id IS NOT NULL;
  ELSE
    RAISE NOTICE 'Duplicate sales per appointment exist; daily_sales_appointment_uq not created';
  END IF;
END $$;

-- Double-booking guard: no two active appointments for one barber may overlap.
-- Staff writes (direct INSERT/UPDATE under RLS) rely on this constraint
-- (23P01 -> SLOT_TAKEN), so this block never finishes without it:
--   * no overlapping active rows (fresh DB)  -> full constraint;
--   * overlaps only among appointments that already ENDED (stale legacy
--     'pending' rows on production) -> the same constraint, restricted to
--     appointments ending after the newest such legacy overlap. Nothing is
--     modified; every current/future booking is fully guarded. Once the
--     legacy rows are resolved the constraint can be recreated without the
--     cutoff (see the COMMENT on it);
--   * an overlap involving an appointment that has not ended yet, or an
--     active row with end_time < start_time -> hard failure (needs a human
--     decision; the migration, and so `db push`, stops here).
DO $$
DECLARE
  v_future_overlaps int;
  v_cutoff timestamptz;
BEGIN
  IF EXISTS (SELECT 1 FROM pg_constraint
             WHERE conname = 'appointments_no_overlap' AND conrelid = 'public.appointments'::regclass) THEN
    RETURN;
  END IF;

  IF EXISTS (SELECT 1 FROM public.appointments
             WHERE end_time < start_time AND status IN ('pending','confirmed') AND barber_id IS NOT NULL) THEN
    RAISE EXCEPTION 'Active appointments with end_time < start_time exist; fix them before applying this migration '
                    '(appointments_no_overlap cannot be created).';
  END IF;

  SELECT count(*) FILTER (WHERE greatest(a.end_time, b.end_time) >= now()),
         max(greatest(a.end_time, b.end_time))
    INTO v_future_overlaps, v_cutoff
  FROM public.appointments a
  JOIN public.appointments b
    ON a.barber_id = b.barber_id AND a.id < b.id
   AND a.status IN ('pending','confirmed') AND b.status IN ('pending','confirmed')
   AND a.start_time < b.end_time AND b.start_time < a.end_time;

  IF v_future_overlaps > 0 THEN
    RAISE EXCEPTION '% overlapping active appointment pair(s) that have not ended yet; resolve them '
                    '(cancel or reassign) before applying this migration.', v_future_overlaps;
  ELSIF v_cutoff IS NULL THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_no_overlap
      EXCLUDE USING gist (barber_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)
      WHERE (status IN ('pending', 'confirmed') AND barber_id IS NOT NULL);
  ELSE
    EXECUTE format(
      'ALTER TABLE public.appointments ADD CONSTRAINT appointments_no_overlap
         EXCLUDE USING gist (barber_id WITH =, tstzrange(start_time, end_time, %L) WITH &&)
         WHERE (status IN (%L, %L) AND barber_id IS NOT NULL AND end_time > %L::timestamptz)',
      '[)', 'pending', 'confirmed', v_cutoff);
    EXECUTE format(
      'COMMENT ON CONSTRAINT appointments_no_overlap ON public.appointments IS %L',
      'Legacy overlapping appointments ending on/before ' || v_cutoff::text || ' are grandfathered. '
      || 'After resolving them, drop and re-add this constraint without the end_time cutoff.');
    RAISE NOTICE 'appointments_no_overlap created for appointments ending after % (older legacy overlaps grandfathered, no rows changed)', v_cutoff;
  END IF;

  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'appointments_no_overlap' AND conrelid = 'public.appointments'::regclass) THEN
    RAISE EXCEPTION 'appointments_no_overlap was not created';
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. HELPER FUNCTIONS (STABLE, SECURITY DEFINER, fixed search_path)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_current_shop_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.shop_id FROM public.profiles p WHERE p.id = auth.uid() LIMIT 1;
$$;

CREATE OR REPLACE FUNCTION public.get_user_shop_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.get_current_shop_id();
$$;

CREATE OR REPLACE FUNCTION public.current_profile_shop_and_role()
RETURNS TABLE (shop_id uuid, role text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.shop_id, p.role::text FROM public.profiles p WHERE p.id = auth.uid();
$$;

-- Caller is a shop_admin attached to a shop.
CREATE OR REPLACE FUNCTION public.is_shop_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.id = auth.uid() AND p.role::text = 'shop_admin' AND p.shop_id IS NOT NULL);
$$;

-- Caller is staff (barber or shop_admin) attached to a shop.
CREATE OR REPLACE FUNCTION public.is_shop_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p
                 WHERE p.id = auth.uid() AND p.role::text IN ('shop_admin', 'barber') AND p.shop_id IS NOT NULL);
$$;

-- Caller is a shop_admin of the shop the given profile belongs to.
CREATE OR REPLACE FUNCTION public.is_admin_of_profile(p_profile_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (
    SELECT 1 FROM public.profiles me JOIN public.profiles target ON target.shop_id = me.shop_id
    WHERE me.id = auth.uid() AND me.role::text = 'shop_admin' AND me.shop_id IS NOT NULL
      AND target.id = p_profile_id);
$$;

-- The client rows owned by the caller (ownership = clients.auth_user_id ONLY).
CREATE OR REPLACE FUNCTION public.my_client_ids()
RETURNS SETOF uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT c.id FROM public.clients c WHERE c.auth_user_id = auth.uid() AND auth.uid() IS NOT NULL;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. RATE LIMITING (DB-backed, shared across serverless instances)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.rate_limits (
  key          text PRIMARY KEY,
  count        integer NOT NULL DEFAULT 0,
  window_start timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.rate_limits ENABLE ROW LEVEL SECURITY;  -- no policies: invisible to anon/authenticated
REVOKE ALL ON public.rate_limits FROM anon, authenticated;

-- Fixed-window counter. Returns true when the call is allowed.
CREATE OR REPLACE FUNCTION public.check_rate_limit(p_key text, p_max int, p_window_seconds int)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_count integer;
BEGIN
  IF p_key IS NULL OR length(p_key) = 0 OR length(p_key) > 200 OR p_max < 1 OR p_window_seconds < 1 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.rate_limits AS rl (key, count, window_start)
  VALUES (p_key, 1, now())
  ON CONFLICT (key) DO UPDATE
    SET count = CASE WHEN rl.window_start + make_interval(secs => p_window_seconds) <= now()
                     THEN 1 ELSE rl.count + 1 END,
        window_start = CASE WHEN rl.window_start + make_interval(secs => p_window_seconds) <= now()
                            THEN now() ELSE rl.window_start END
  RETURNING count INTO v_count;

  -- Opportunistic cleanup (~1% of calls) of windows older than a day.
  IF random() < 0.01 THEN
    DELETE FROM public.rate_limits WHERE window_start < now() - interval '1 day';
  END IF;

  RETURN v_count <= p_max;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. RLS — drop every legacy/duplicate policy, recreate one per (table, cmd)
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── shops ───
DROP POLICY IF EXISTS "Users can view own shop"       ON public.shops;
DROP POLICY IF EXISTS "Users can update own shop"     ON public.shops;
DROP POLICY IF EXISTS "Admins can update their shop"  ON public.shops;
DROP POLICY IF EXISTS shops_select_own                ON public.shops;
DROP POLICY IF EXISTS shops_update_own                ON public.shops;
DROP POLICY IF EXISTS shops_select_anon               ON public.shops;
DROP POLICY IF EXISTS shops_select_public             ON public.shops;
DROP POLICY IF EXISTS shops_update_admin              ON public.shops;

CREATE POLICY shops_select_public ON public.shops
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY shops_update_admin ON public.shops
  FOR UPDATE TO authenticated
  USING (id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
-- (No INSERT/DELETE: shops are created by handle_new_user only.)

-- anon may only read the public storefront columns.
REVOKE SELECT ON public.shops FROM anon;
GRANT SELECT (id, name, description, address, phone, email, instagram, google_maps_url, whatsapp,
              currency, timezone, cancellation_policy_hours, cancellation_fee_percent,
              require_deposit, deposit_type, deposit_value, created_at)
  ON public.shops TO anon;

-- ─── profiles ───
DROP POLICY IF EXISTS "Users can view shop profiles"      ON public.profiles;
DROP POLICY IF EXISTS "Users can update own profile"      ON public.profiles;
DROP POLICY IF EXISTS "Users can read own profile"        ON public.profiles;
DROP POLICY IF EXISTS profiles_select_same_shop           ON public.profiles;
DROP POLICY IF EXISTS profiles_select_anon                ON public.profiles;
DROP POLICY IF EXISTS profiles_update_own                 ON public.profiles;
DROP POLICY IF EXISTS profiles_update_admin_same_shop     ON public.profiles;
DROP POLICY IF EXISTS profiles_insert_admin               ON public.profiles;
DROP POLICY IF EXISTS profiles_select_self                ON public.profiles;
DROP POLICY IF EXISTS profiles_select_public_staff        ON public.profiles;

CREATE POLICY profiles_select_self ON public.profiles
  FOR SELECT TO authenticated USING (id = (SELECT auth.uid()));
CREATE POLICY profiles_select_same_shop ON public.profiles
  FOR SELECT TO authenticated
  USING (shop_id IS NOT NULL AND shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
-- Public storefront: staff only (customers are never public).
CREATE POLICY profiles_select_public_staff ON public.profiles
  FOR SELECT TO anon, authenticated
  USING (shop_id IS NOT NULL AND role::text IN ('barber', 'shop_admin'));
-- Own row: may edit name/avatar/phone, never shop_id or role.
CREATE POLICY profiles_update_own ON public.profiles
  FOR UPDATE TO authenticated
  USING (id = (SELECT auth.uid()))
  WITH CHECK (
    id = (SELECT auth.uid())
    AND shop_id IS NOT DISTINCT FROM (SELECT c.shop_id FROM public.current_profile_shop_and_role() c)
    AND role::text IS NOT DISTINCT FROM (SELECT c.role FROM public.current_profile_shop_and_role() c)
  );
-- Admin on another member of the same shop: change role between staff roles
-- or remove from the shop (shop_id → NULL). Never move into another shop.
CREATE POLICY profiles_update_admin_same_shop ON public.profiles
  FOR UPDATE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin())
         AND id <> (SELECT auth.uid()))
  WITH CHECK ((shop_id IS NULL OR shop_id = (SELECT public.get_current_shop_id()))
              AND role::text IN ('barber', 'shop_admin'));
-- (No INSERT policy: profiles are created by handle_new_user.)

REVOKE SELECT ON public.profiles FROM anon;
GRANT SELECT (id, shop_id, role, full_name, avatar_url, created_at) ON public.profiles TO anon;

-- ─── services ───
DROP POLICY IF EXISTS "Shop members can manage services" ON public.services;
DROP POLICY IF EXISTS "Public can read active services"  ON public.services;
DROP POLICY IF EXISTS "Admins can manage services"       ON public.services;
DROP POLICY IF EXISTS services_select_own_shop           ON public.services;
DROP POLICY IF EXISTS services_select_anon               ON public.services;
DROP POLICY IF EXISTS services_insert_admin              ON public.services;
DROP POLICY IF EXISTS services_update_admin              ON public.services;
DROP POLICY IF EXISTS services_delete_admin              ON public.services;
DROP POLICY IF EXISTS services_select_public             ON public.services;

CREATE POLICY services_select_public ON public.services
  FOR SELECT TO anon, authenticated USING (is_active IS TRUE);
CREATE POLICY services_select_own_shop ON public.services
  FOR SELECT TO authenticated USING (shop_id = (SELECT public.get_current_shop_id()));
CREATE POLICY services_insert_admin ON public.services
  FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
CREATE POLICY services_update_admin ON public.services
  FOR UPDATE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
CREATE POLICY services_delete_admin ON public.services
  FOR DELETE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));

-- ─── legacy barbers table (unused by the app): lock it down ───
DO $$ BEGIN
  IF to_regclass('public.barbers') IS NOT NULL THEN
    DROP POLICY IF EXISTS "Shop members can manage barbers" ON public.barbers;
    DROP POLICY IF EXISTS "Public can read active barbers"  ON public.barbers;
  END IF;
END $$;

-- ─── clients ───
DROP POLICY IF EXISTS "Shop members can manage clients" ON public.clients;
DROP POLICY IF EXISTS "Public can create clients"       ON public.clients;
DROP POLICY IF EXISTS "Public can insert clients"       ON public.clients;
DROP POLICY IF EXISTS clients_select_own_shop           ON public.clients;
DROP POLICY IF EXISTS clients_insert_own_shop           ON public.clients;
DROP POLICY IF EXISTS clients_insert_anon               ON public.clients;
DROP POLICY IF EXISTS clients_update_own_shop           ON public.clients;
DROP POLICY IF EXISTS clients_select_staff              ON public.clients;
DROP POLICY IF EXISTS clients_select_self               ON public.clients;
DROP POLICY IF EXISTS clients_insert_staff              ON public.clients;
DROP POLICY IF EXISTS clients_update_staff              ON public.clients;
DROP POLICY IF EXISTS clients_delete_admin              ON public.clients;

CREATE POLICY clients_select_staff ON public.clients
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
CREATE POLICY clients_select_self ON public.clients
  FOR SELECT TO authenticated USING (auth_user_id = (SELECT auth.uid()));
CREATE POLICY clients_insert_staff ON public.clients
  FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
CREATE POLICY clients_update_staff ON public.clients
  FOR UPDATE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
CREATE POLICY clients_delete_admin ON public.clients
  FOR DELETE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));

-- ─── appointments ───
DROP POLICY IF EXISTS "Shop members can manage appointments"           ON public.appointments;
DROP POLICY IF EXISTS "Public can create appointments"                 ON public.appointments;
DROP POLICY IF EXISTS "Public can read appointments for availability"  ON public.appointments;
DROP POLICY IF EXISTS "Customers can view their appointments"          ON public.appointments;
DROP POLICY IF EXISTS appointments_select                              ON public.appointments;
DROP POLICY IF EXISTS appointments_insert_admin                        ON public.appointments;
DROP POLICY IF EXISTS appointments_insert_anon                         ON public.appointments;
DROP POLICY IF EXISTS appointments_update                              ON public.appointments;
DROP POLICY IF EXISTS appointments_select_staff                        ON public.appointments;
DROP POLICY IF EXISTS appointments_select_customer                     ON public.appointments;
DROP POLICY IF EXISTS appointments_insert_staff                        ON public.appointments;
DROP POLICY IF EXISTS appointments_update_staff                        ON public.appointments;
DROP POLICY IF EXISTS appointments_delete_admin                        ON public.appointments;

-- All staff of the shop see the shop calendar (occupancy is needed to avoid clashes).
CREATE POLICY appointments_select_staff ON public.appointments
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
-- Customers see only appointments on client rows they own.
CREATE POLICY appointments_select_customer ON public.appointments
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT public.my_client_ids()));
-- Staff create appointments in their shop; barbers only for themselves/unassigned.
CREATE POLICY appointments_insert_staff ON public.appointments
  FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff())
              AND ((SELECT public.is_shop_admin()) OR barber_id IS NULL OR barber_id = (SELECT auth.uid())));
-- Admins update any shop appointment; barbers only their own.
CREATE POLICY appointments_update_staff ON public.appointments
  FOR UPDATE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id())
         AND ((SELECT public.is_shop_admin()) OR ((SELECT public.is_shop_staff()) AND barber_id = (SELECT auth.uid()))))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id())
              AND ((SELECT public.is_shop_admin()) OR ((SELECT public.is_shop_staff()) AND barber_id = (SELECT auth.uid()))));
CREATE POLICY appointments_delete_admin ON public.appointments
  FOR DELETE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));

-- All public writes go through create_public_booking().
REVOKE INSERT, UPDATE, DELETE ON public.appointments FROM anon;
REVOKE INSERT, UPDATE, DELETE ON public.clients FROM anon;

-- ─── leads (admin only) ───
DROP POLICY IF EXISTS "Shop members can manage leads" ON public.leads;
DROP POLICY IF EXISTS leads_select_own_shop           ON public.leads;
DROP POLICY IF EXISTS leads_insert_admin              ON public.leads;
DROP POLICY IF EXISTS leads_update_admin              ON public.leads;
DROP POLICY IF EXISTS leads_delete_admin              ON public.leads;
DROP POLICY IF EXISTS leads_select_admin              ON public.leads;

CREATE POLICY leads_select_admin ON public.leads
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
CREATE POLICY leads_insert_admin ON public.leads
  FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
CREATE POLICY leads_update_admin ON public.leads
  FOR UPDATE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
CREATE POLICY leads_delete_admin ON public.leads
  FOR DELETE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));

-- ─── daily_sales (staff read/insert, admin edit/delete) ───
DROP POLICY IF EXISTS "Shop members can manage sales" ON public.daily_sales;
DROP POLICY IF EXISTS daily_sales_select_staff        ON public.daily_sales;
DROP POLICY IF EXISTS daily_sales_insert_staff        ON public.daily_sales;
DROP POLICY IF EXISTS daily_sales_update_admin        ON public.daily_sales;
DROP POLICY IF EXISTS daily_sales_delete_admin        ON public.daily_sales;

CREATE POLICY daily_sales_select_staff ON public.daily_sales
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
CREATE POLICY daily_sales_insert_staff ON public.daily_sales
  FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
CREATE POLICY daily_sales_update_admin ON public.daily_sales
  FOR UPDATE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
CREATE POLICY daily_sales_delete_admin ON public.daily_sales
  FOR DELETE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));

-- ─── payments (staff read/insert, admin edit/delete) ───
DROP POLICY IF EXISTS "Shop members can manage payments" ON public.payments;
DROP POLICY IF EXISTS payments_select_staff              ON public.payments;
DROP POLICY IF EXISTS payments_insert_staff              ON public.payments;
DROP POLICY IF EXISTS payments_update_admin              ON public.payments;
DROP POLICY IF EXISTS payments_delete_admin              ON public.payments;

CREATE POLICY payments_select_staff ON public.payments
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
CREATE POLICY payments_insert_staff ON public.payments
  FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
CREATE POLICY payments_update_admin ON public.payments
  FOR UPDATE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
CREATE POLICY payments_delete_admin ON public.payments
  FOR DELETE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));

-- ─── reviews (public read; writes only via submit_review()) ───
DROP POLICY IF EXISTS "Anyone can view reviews"                        ON public.reviews;
DROP POLICY IF EXISTS "Authenticated users can insert reviews"         ON public.reviews;
DROP POLICY IF EXISTS "Shop owners can delete reviews for their shop"  ON public.reviews;
DROP POLICY IF EXISTS reviews_select_public                            ON public.reviews;
DROP POLICY IF EXISTS reviews_delete_admin                             ON public.reviews;

CREATE POLICY reviews_select_public ON public.reviews
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY reviews_delete_admin ON public.reviews
  FOR DELETE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
REVOKE INSERT, UPDATE ON public.reviews FROM anon, authenticated;

-- ─── notifications (own rows only) ───
DROP POLICY IF EXISTS "Users can view their own notifications"              ON public.notifications;
DROP POLICY IF EXISTS "Users can update their own notifications (mark read)" ON public.notifications;
DROP POLICY IF EXISTS notifications_select_own                              ON public.notifications;
DROP POLICY IF EXISTS notifications_update_own                              ON public.notifications;
DROP POLICY IF EXISTS notifications_delete_own                              ON public.notifications;

CREATE POLICY notifications_select_own ON public.notifications
  FOR SELECT TO authenticated USING (user_id = (SELECT auth.uid()));
CREATE POLICY notifications_update_own ON public.notifications
  FOR UPDATE TO authenticated
  USING (user_id = (SELECT auth.uid())) WITH CHECK (user_id = (SELECT auth.uid()));
CREATE POLICY notifications_delete_own ON public.notifications
  FOR DELETE TO authenticated USING (user_id = (SELECT auth.uid()));

-- ─── working_hours (public read; barber self or admin of barber's shop write) ───
DROP POLICY IF EXISTS working_hours_select              ON public.working_hours;
DROP POLICY IF EXISTS working_hours_all_admin_or_self   ON public.working_hours;
DROP POLICY IF EXISTS working_hours_select_public       ON public.working_hours;
DROP POLICY IF EXISTS working_hours_insert              ON public.working_hours;
DROP POLICY IF EXISTS working_hours_update              ON public.working_hours;
DROP POLICY IF EXISTS working_hours_delete              ON public.working_hours;

CREATE POLICY working_hours_select_public ON public.working_hours
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY working_hours_insert ON public.working_hours
  FOR INSERT TO authenticated
  WITH CHECK ((barber_id = (SELECT auth.uid()) AND (SELECT public.is_shop_staff()))
              OR public.is_admin_of_profile(barber_id));
CREATE POLICY working_hours_update ON public.working_hours
  FOR UPDATE TO authenticated
  USING ((barber_id = (SELECT auth.uid()) AND (SELECT public.is_shop_staff()))
         OR public.is_admin_of_profile(barber_id))
  WITH CHECK ((barber_id = (SELECT auth.uid()) AND (SELECT public.is_shop_staff()))
              OR public.is_admin_of_profile(barber_id));
CREATE POLICY working_hours_delete ON public.working_hours
  FOR DELETE TO authenticated
  USING ((barber_id = (SELECT auth.uid()) AND (SELECT public.is_shop_staff()))
         OR public.is_admin_of_profile(barber_id));

-- ─── barber_services (public read; admin of barber's shop writes, same-shop services only) ───
DROP POLICY IF EXISTS barber_services_select         ON public.barber_services;
DROP POLICY IF EXISTS barber_services_insert_admin   ON public.barber_services;
DROP POLICY IF EXISTS barber_services_update_admin   ON public.barber_services;
DROP POLICY IF EXISTS barber_services_delete_admin   ON public.barber_services;
DROP POLICY IF EXISTS barber_services_select_public  ON public.barber_services;

CREATE POLICY barber_services_select_public ON public.barber_services
  FOR SELECT TO anon, authenticated USING (true);
CREATE POLICY barber_services_insert_admin ON public.barber_services
  FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of_profile(barber_id)
              AND EXISTS (SELECT 1 FROM public.services s
                          WHERE s.id = service_id AND s.shop_id = (SELECT public.get_current_shop_id())));
CREATE POLICY barber_services_update_admin ON public.barber_services
  FOR UPDATE TO authenticated
  USING (public.is_admin_of_profile(barber_id))
  WITH CHECK (public.is_admin_of_profile(barber_id)
              AND EXISTS (SELECT 1 FROM public.services s
                          WHERE s.id = service_id AND s.shop_id = (SELECT public.get_current_shop_id())));
CREATE POLICY barber_services_delete_admin ON public.barber_services
  FOR DELETE TO authenticated
  USING (public.is_admin_of_profile(barber_id));

-- ─── invites (admin of own shop; public lookup only via get_invite_by_token) ───
DROP POLICY IF EXISTS invites_insert_admin            ON public.invites;
DROP POLICY IF EXISTS invites_select_admin_own_shop   ON public.invites;
DROP POLICY IF EXISTS invites_update_admin_own_shop   ON public.invites;
DROP POLICY IF EXISTS invites_delete_admin_own_shop   ON public.invites;

CREATE POLICY invites_insert_admin ON public.invites
  FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
CREATE POLICY invites_select_admin_own_shop ON public.invites
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
CREATE POLICY invites_update_admin_own_shop ON public.invites
  FOR UPDATE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
CREATE POLICY invites_delete_admin_own_shop ON public.invites
  FOR DELETE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));

-- ─── Drop any policy outside the canonical set above ───
-- Production also carries policies created in the SQL editor under names this
-- file never knew (e.g. appointments_select_all / profiles_select_all /
-- shops_select_all USING (true)). Permissive policies are OR-ed, so leaving any
-- of them would silently undo the lockdown above. The allow-list is exactly the
-- set this file creates; on a database built from these migrations this is a
-- no-op.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.tablename, p.policyname FROM pg_policies p
    WHERE p.schemaname = 'public'
      AND (p.tablename, p.policyname) NOT IN (VALUES
    ('appointments', 'appointments_delete_admin'),
    ('appointments', 'appointments_insert_staff'),
    ('appointments', 'appointments_select_customer'),
    ('appointments', 'appointments_select_staff'),
    ('appointments', 'appointments_update_staff'),
    ('barber_services', 'barber_services_delete_admin'),
    ('barber_services', 'barber_services_insert_admin'),
    ('barber_services', 'barber_services_select_public'),
    ('barber_services', 'barber_services_update_admin'),
    ('clients', 'clients_delete_admin'),
    ('clients', 'clients_insert_staff'),
    ('clients', 'clients_select_self'),
    ('clients', 'clients_select_staff'),
    ('clients', 'clients_update_staff'),
    ('daily_sales', 'daily_sales_delete_admin'),
    ('daily_sales', 'daily_sales_insert_staff'),
    ('daily_sales', 'daily_sales_select_staff'),
    ('daily_sales', 'daily_sales_update_admin'),
    ('invites', 'invites_delete_admin_own_shop'),
    ('invites', 'invites_insert_admin'),
    ('invites', 'invites_select_admin_own_shop'),
    ('invites', 'invites_update_admin_own_shop'),
    ('leads', 'leads_delete_admin'),
    ('leads', 'leads_insert_admin'),
    ('leads', 'leads_select_admin'),
    ('leads', 'leads_update_admin'),
    ('notifications', 'notifications_delete_own'),
    ('notifications', 'notifications_select_own'),
    ('notifications', 'notifications_update_own'),
    ('payments', 'payments_delete_admin'),
    ('payments', 'payments_insert_staff'),
    ('payments', 'payments_select_staff'),
    ('payments', 'payments_update_admin'),
    ('profiles', 'profiles_select_public_staff'),
    ('profiles', 'profiles_select_same_shop'),
    ('profiles', 'profiles_select_self'),
    ('profiles', 'profiles_update_admin_same_shop'),
    ('profiles', 'profiles_update_own'),
    ('reviews', 'reviews_delete_admin'),
    ('reviews', 'reviews_select_public'),
    ('services', 'services_delete_admin'),
    ('services', 'services_insert_admin'),
    ('services', 'services_select_own_shop'),
    ('services', 'services_select_public'),
    ('services', 'services_update_admin'),
    ('shops', 'shops_select_public'),
    ('shops', 'shops_update_admin'),
    ('working_hours', 'working_hours_delete'),
    ('working_hours', 'working_hours_insert'),
    ('working_hours', 'working_hours_select_public'),
    ('working_hours', 'working_hours_update')
      )
  LOOP
    RAISE NOTICE 'dropping non-canonical policy % on public.%', r.policyname, r.tablename;
    EXECUTE format('DROP POLICY %I ON public.%I', r.policyname, r.tablename);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. INVARIANT TRIGGERS
-- ═══════════════════════════════════════════════════════════════════════════

-- A shop must always keep at least one shop_admin.
CREATE OR REPLACE FUNCTION public.guard_last_shop_admin()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF OLD.role::text = 'shop_admin' AND OLD.shop_id IS NOT NULL
     AND (NEW.role::text IS DISTINCT FROM 'shop_admin' OR NEW.shop_id IS DISTINCT FROM OLD.shop_id)
     AND EXISTS (SELECT 1 FROM public.shops s WHERE s.id = OLD.shop_id)   -- skip shop-deletion cascades
     AND NOT EXISTS (SELECT 1 FROM public.profiles p
                     WHERE p.shop_id = OLD.shop_id AND p.role::text = 'shop_admin' AND p.id <> OLD.id) THEN
    RAISE EXCEPTION 'LAST_ADMIN' USING ERRCODE = 'P0001',
      HINT = 'A shop must keep at least one admin. Promote another member first.';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_last_shop_admin ON public.profiles;
CREATE TRIGGER guard_last_shop_admin BEFORE UPDATE OF role, shop_id ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_last_shop_admin();

-- Status side effects stay consistent no matter who changes the status.
CREATE OR REPLACE FUNCTION public.appointment_status_side_effects()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'cancelled' AND NEW.cancelled_at IS NULL THEN
      NEW.cancelled_at := now();
    END IF;
    NEW.no_show := (NEW.status = 'no_show');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS appointment_status_side_effects ON public.appointments;
CREATE TRIGGER appointment_status_side_effects BEFORE UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.appointment_status_side_effects();

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. STAFF DEFAULTS (working hours + all services) — used by signup & invites
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.seed_staff_defaults(p_profile_id uuid, p_shop_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  INSERT INTO public.working_hours (barber_id, day_of_week, start_time, end_time, is_working)
  SELECT p_profile_id, d, '09:00', '18:00', true FROM generate_series(0, 6) AS d
  ON CONFLICT (barber_id, day_of_week) DO NOTHING;

  INSERT INTO public.barber_services (barber_id, service_id)
  SELECT p_profile_id, s.id FROM public.services s WHERE s.shop_id = p_shop_id
  ON CONFLICT (barber_id, service_id) DO NOTHING;
END;
$$;

-- Backfill: staff created under the legacy 'professional' seed got nothing.
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT p.id, p.shop_id FROM public.profiles p
           WHERE p.role::text IN ('barber', 'shop_admin') AND p.shop_id IS NOT NULL
             AND NOT EXISTS (SELECT 1 FROM public.working_hours w WHERE w.barber_id = p.id)
  LOOP
    PERFORM public.seed_staff_defaults(r.id, r.shop_id);
  END LOOP;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. SIGNUP TRIGGER — profile (+ shop for shop_admin) created if missing
--     Metadata role is whitelisted: only 'shop_admin' creates a shop;
--     everything else (incl. 'barber', which must come via an invite) is a
--     customer. Never trusts metadata for anything else.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role      text := COALESCE(NEW.raw_user_meta_data->>'role', 'customer');
  v_full_name text := left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'full_name'), ''),
                                    NULLIF(trim(NEW.raw_user_meta_data->>'name'), ''),
                                    NULLIF(split_part(COALESCE(NEW.email, ''), '@', 1), ''),
                                    'User'), 100);
  -- Contact phone only (unverified): stored for display, NEVER used for ownership.
  v_phone     text := NULLIF(left(trim(COALESCE(NEW.raw_user_meta_data->>'phone', '')), 30), '');
  v_shop_name text := left(COALESCE(NULLIF(trim(NEW.raw_user_meta_data->>'shop_name'), ''), 'My Barbershop'), 100);
  v_shop_id   uuid;
BEGIN
  IF EXISTS (SELECT 1 FROM public.profiles WHERE id = NEW.id) THEN
    RETURN NEW;
  END IF;

  IF v_role = 'shop_admin' THEN
    INSERT INTO public.shops (name) VALUES (v_shop_name) RETURNING id INTO v_shop_id;

    INSERT INTO public.profiles (id, shop_id, role, full_name, phone)
    VALUES (NEW.id, v_shop_id, 'shop_admin', v_full_name, v_phone)
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.services (shop_id, name, name_ar, duration, price, icon, sort_order) VALUES
      (v_shop_id, 'Premium Haircut',    'قص شعر فاخر',      45, 12,   'scissors', 1),
      (v_shop_id, 'Beard Trim & Shape', 'تشذيب اللحية',      30, 8,    'scissors', 2),
      (v_shop_id, 'Haircut + Beard',    'قص شعر + لحية',     60, 15,   'scissors', 3),
      (v_shop_id, 'Hot Towel Shave',    'حلاقة بالمنشفة',     30, 10,   'scissors', 4),
      (v_shop_id, 'Kids Haircut',       'قص شعر أطفال',      30, 7,    'scissors', 5),
      (v_shop_id, 'Full Grooming',      'عناية كاملة',       75, 20.5, 'sparkles', 6);

    PERFORM public.seed_staff_defaults(NEW.id, v_shop_id);
  ELSE
    INSERT INTO public.profiles (id, shop_id, role, full_name, phone)
    VALUES (NEW.id, NULL, 'customer', v_full_name, v_phone)
    ON CONFLICT (id) DO NOTHING;
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════════════════
-- 11. PUBLIC AVAILABILITY — replaces anon SELECT on appointments
-- ═══════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.get_busy_slots(uuid, date);
DROP FUNCTION IF EXISTS public.get_busy_slots(uuid, date, uuid);
CREATE FUNCTION public.get_busy_slots(p_shop_id uuid, p_day date, p_barber_id uuid DEFAULT NULL)
RETURNS TABLE (barber_id uuid, start_time timestamptz, end_time timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH s AS (
    SELECT COALESCE(sh.timezone, 'Asia/Amman') AS tz FROM public.shops sh WHERE sh.id = p_shop_id
  )
  SELECT a.barber_id, a.start_time, a.end_time
  FROM public.appointments a, s
  WHERE a.shop_id = p_shop_id
    AND a.status IN ('pending', 'confirmed')
    AND (p_barber_id IS NULL OR a.barber_id = p_barber_id)
    AND a.start_time < ((p_day + 1)::timestamp AT TIME ZONE s.tz)
    AND a.end_time   > (p_day::timestamp AT TIME ZONE s.tz)
  ORDER BY a.start_time;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 12. create_public_booking — owns every business rule
-- ═══════════════════════════════════════════════════════════════════════════
-- Old 9-arg signature (client-supplied end time and price) is removed so no
-- overload remains callable by anon.
DROP FUNCTION IF EXISTS public.create_public_booking(uuid, text, text, uuid[], uuid, timestamptz, timestamptz, numeric, text);
DROP FUNCTION IF EXISTS public.create_public_booking(uuid, text, text, uuid[], uuid, timestamptz, text, text);

-- Internal: can this barber take [p_start, p_end) given shop-local working hours?
CREATE OR REPLACE FUNCTION public.barber_is_working(p_barber_id uuid, p_start timestamptz, p_end timestamptz, p_tz text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_local_start timestamp := p_start AT TIME ZONE p_tz;
  v_local_end   timestamp := p_end   AT TIME ZONE p_tz;
  v_wh          public.working_hours%ROWTYPE;
  v_has_rows    boolean;
BEGIN
  -- Must start and end on the same local day.
  IF v_local_end::date <> v_local_start::date AND v_local_end::time <> '00:00' THEN
    RETURN false;
  END IF;

  SELECT EXISTS (SELECT 1 FROM public.working_hours w WHERE w.barber_id = p_barber_id) INTO v_has_rows;
  IF NOT v_has_rows THEN
    -- Unconfigured barber: same 09:00–18:00 fallback the booking UI uses.
    RETURN v_local_start::time >= '09:00' AND v_local_end::time <= '18:00' AND v_local_end::date = v_local_start::date;
  END IF;

  SELECT * INTO v_wh FROM public.working_hours w
  WHERE w.barber_id = p_barber_id AND w.day_of_week = extract(dow FROM v_local_start)::int;

  IF v_wh.id IS NULL OR v_wh.is_working IS NOT TRUE THEN
    RETURN false;
  END IF;
  IF v_local_start::time < v_wh.start_time OR v_local_end::date <> v_local_start::date
     OR v_local_end::time > v_wh.end_time THEN
    RETURN false;
  END IF;
  IF v_wh.break_start IS NOT NULL AND v_wh.break_end IS NOT NULL
     AND v_local_start::time < v_wh.break_end AND v_local_end::time > v_wh.break_start THEN
    RETURN false;
  END IF;
  RETURN true;
END;
$$;

-- Internal: does the barber offer every requested service? (No rows = offers all,
-- matching the booking UI.)
CREATE OR REPLACE FUNCTION public.barber_offers_services(p_barber_id uuid, p_service_ids uuid[])
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT NOT EXISTS (SELECT 1 FROM public.barber_services bs WHERE bs.barber_id = p_barber_id)
      OR (SELECT count(DISTINCT bs.service_id) FROM public.barber_services bs
          WHERE bs.barber_id = p_barber_id AND bs.is_active IS NOT FALSE
            AND bs.service_id = ANY (p_service_ids)) = cardinality(p_service_ids);
$$;

CREATE FUNCTION public.create_public_booking(
  p_shop_id      uuid,
  p_client_name  text,
  p_client_phone text,
  p_service_ids  uuid[],
  p_barber_id    uuid,                 -- NULL = any available barber
  p_start_time   timestamptz,
  p_source       text DEFAULT 'online',
  p_notes        text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_shop         public.shops%ROWTYPE;
  v_tz           text;
  v_name         text := left(trim(COALESCE(p_client_name, '')), 100);
  v_phone        text := left(trim(COALESCE(p_client_phone, '')), 30);
  v_digits       text := regexp_replace(COALESCE(p_client_phone, ''), '\D', '', 'g');
  v_services     uuid[];
  v_count        int;
  v_duration     int;
  v_price        numeric(10,2);
  v_service_name text;
  v_end          timestamptz;
  v_barber       uuid;
  v_candidate    uuid;
  v_client_id    uuid;
  v_appt_id      uuid;
  v_source       text;
  v_verified_phone text;
  v_verified_email text;
BEGIN
  -- ── Input shape ──
  IF p_shop_id IS NULL OR p_start_time IS NULL OR p_service_ids IS NULL
     OR cardinality(p_service_ids) = 0 OR cardinality(p_service_ids) > 10
     OR length(v_name) < 2 OR length(v_digits) < 7 OR length(v_digits) > 15 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  SELECT array_agg(DISTINCT x) INTO v_services FROM unnest(p_service_ids) AS x;

  v_source := CASE WHEN p_source IN ('online', 'instagram', 'google', 'word_of_mouth', 'walk_in', 'whatsapp', 'other')
                   THEN p_source ELSE 'online' END;

  -- ── Abuse limits (apply even when the RPC is called directly with the anon key) ──
  IF NOT public.check_rate_limit('rpc:booking:phone:' || p_shop_id::text || ':' || v_digits, 5, 3600) THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;
  IF v_uid IS NOT NULL AND NOT public.check_rate_limit('rpc:booking:user:' || v_uid::text, 10, 3600) THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  -- ── Shop ──
  SELECT * INTO v_shop FROM public.shops WHERE id = p_shop_id;
  IF v_shop.id IS NULL THEN
    RAISE EXCEPTION 'SHOP_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  v_tz := COALESCE(v_shop.timezone, 'Asia/Amman');

  -- ── Services: must all be active in this shop; price/duration from DB ──
  SELECT count(*), COALESCE(sum(s.duration), 0), COALESCE(sum(s.price), 0),
         string_agg(s.name, ' + ' ORDER BY s.sort_order NULLS LAST, s.name)
    INTO v_count, v_duration, v_price, v_service_name
  FROM public.services s
  WHERE s.id = ANY (v_services) AND s.shop_id = p_shop_id AND s.is_active IS NOT FALSE;

  IF v_count <> cardinality(v_services) THEN
    RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF v_duration < 5 OR v_duration > 480 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;

  -- ── Time ──
  IF p_start_time <= now() THEN
    RAISE EXCEPTION 'SLOT_IN_PAST' USING ERRCODE = 'P0001';
  END IF;
  IF p_start_time > now() + interval '90 days' THEN
    RAISE EXCEPTION 'TOO_FAR_AHEAD' USING ERRCODE = 'P0001';
  END IF;
  v_end := p_start_time + make_interval(mins => v_duration);

  -- ── Barber ──
  IF p_barber_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles p
                   WHERE p.id = p_barber_id AND p.shop_id = p_shop_id
                     AND p.role::text IN ('barber', 'shop_admin')) THEN
      RAISE EXCEPTION 'BARBER_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.barber_offers_services(p_barber_id, v_services) THEN
      RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.barber_is_working(p_barber_id, p_start_time, v_end, v_tz) THEN
      RAISE EXCEPTION 'OUTSIDE_WORKING_HOURS' USING ERRCODE = 'P0001';
    END IF;
    PERFORM pg_advisory_xact_lock(hashtext('appt:barber:' || p_barber_id::text));
    IF EXISTS (SELECT 1 FROM public.appointments a
               WHERE a.barber_id = p_barber_id AND a.status IN ('pending', 'confirmed')
                 AND a.start_time < v_end AND a.end_time > p_start_time) THEN
      RAISE EXCEPTION 'SLOT_TAKEN' USING ERRCODE = 'P0001';
    END IF;
    v_barber := p_barber_id;
  ELSE
    -- "Any barber": pick a concrete free barber under a lock (barbers first,
    -- then the least-busy that day), so the overlap guard always applies.
    FOR v_candidate IN
      SELECT p.id FROM public.profiles p
      WHERE p.shop_id = p_shop_id AND p.role::text IN ('barber', 'shop_admin')
      ORDER BY (p.role::text = 'barber') DESC,
               (SELECT count(*) FROM public.appointments a
                 WHERE a.barber_id = p.id AND a.status IN ('pending', 'confirmed')
                   AND (a.start_time AT TIME ZONE v_tz)::date = (p_start_time AT TIME ZONE v_tz)::date),
               p.id
    LOOP
      CONTINUE WHEN NOT public.barber_offers_services(v_candidate, v_services);
      CONTINUE WHEN NOT public.barber_is_working(v_candidate, p_start_time, v_end, v_tz);
      PERFORM pg_advisory_xact_lock(hashtext('appt:barber:' || v_candidate::text));
      IF NOT EXISTS (SELECT 1 FROM public.appointments a
                     WHERE a.barber_id = v_candidate AND a.status IN ('pending', 'confirmed')
                       AND a.start_time < v_end AND a.end_time > p_start_time) THEN
        v_barber := v_candidate;
        EXIT;
      END IF;
    END LOOP;
    IF v_barber IS NULL THEN
      RAISE EXCEPTION 'NO_BARBER_AVAILABLE' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- ── Client row (ownership is auth_user_id only; names are never overwritten) ──
  PERFORM pg_advisory_xact_lock(hashtext('client:' || p_shop_id::text || ':' || v_digits));

  IF v_uid IS NOT NULL THEN
    SELECT c.id INTO v_client_id FROM public.clients c
    WHERE c.shop_id = p_shop_id AND c.auth_user_id = v_uid AND c.deleted_at IS NULL
    ORDER BY (c.phone_digits = v_digits) DESC, c.created_at
    LIMIT 1;

    IF v_client_id IS NULL THEN
      -- Link an existing unlinked row only when the caller's phone is OTP-verified.
      SELECT regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') INTO v_verified_phone
      FROM auth.users u WHERE u.id = v_uid AND u.phone_confirmed_at IS NOT NULL;

      IF v_verified_phone IS NOT NULL AND v_verified_phone <> ''
         AND right(v_verified_phone, 9) = right(v_digits, 9) THEN
        UPDATE public.clients c SET auth_user_id = v_uid
        WHERE c.id = (SELECT c2.id FROM public.clients c2
                      WHERE c2.shop_id = p_shop_id AND c2.phone_digits = v_digits
                        AND c2.auth_user_id IS NULL AND c2.deleted_at IS NULL
                      ORDER BY c2.created_at LIMIT 1)
        RETURNING c.id INTO v_client_id;
      END IF;
    END IF;

    IF v_client_id IS NULL THEN
      SELECT lower(u.email) INTO v_verified_email
      FROM auth.users u WHERE u.id = v_uid AND u.email_confirmed_at IS NOT NULL;

      INSERT INTO public.clients (shop_id, name, phone, email, source, auth_user_id)
      VALUES (p_shop_id, v_name, v_phone, v_verified_email, v_source, v_uid)
      RETURNING id INTO v_client_id;
    END IF;
  ELSE
    SELECT c.id INTO v_client_id FROM public.clients c
    WHERE c.shop_id = p_shop_id AND c.phone_digits = v_digits AND c.deleted_at IS NULL
      AND c.auth_user_id IS NULL
    ORDER BY c.created_at LIMIT 1;

    IF v_client_id IS NULL THEN
      INSERT INTO public.clients (shop_id, name, phone, source)
      VALUES (p_shop_id, v_name, v_phone, v_source)
      RETURNING id INTO v_client_id;
    END IF;
  END IF;

  -- Max 5 upcoming active bookings per client per shop.
  IF (SELECT count(*) FROM public.appointments a
      WHERE a.client_id = v_client_id AND a.status IN ('pending', 'confirmed') AND a.start_time > now()) >= 5 THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  -- ── Appointment ──
  BEGIN
    INSERT INTO public.appointments (
      shop_id, client_id, barber_id, service_ids, client_name, service_name,
      start_time, end_time, status, price, currency, payment_status,
      amount_total, amount_deposit, amount_paid, source, notes
    ) VALUES (
      p_shop_id, v_client_id, v_barber, v_services, v_name, v_service_name,
      p_start_time, v_end, 'pending', v_price, COALESCE(v_shop.currency, 'JOD'), 'unpaid',
      v_price, 0, 0, v_source, NULLIF(left(trim(COALESCE(p_notes, '')), 500), '')
    )
    RETURNING id INTO v_appt_id;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'SLOT_TAKEN' USING ERRCODE = 'P0001';
  END;

  RETURN jsonb_build_object(
    'appointment_id', v_appt_id,
    'barber_id',      v_barber,
    'start_time',     p_start_time,
    'end_time',       v_end,
    'price',          v_price,
    'currency',       COALESCE(v_shop.currency, 'JOD'),
    'service_name',   v_service_name,
    'status',         'pending'
  );
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 13. CUSTOMER RPCs
-- ═══════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.cancel_public_booking(uuid);
DROP FUNCTION IF EXISTS public.cancel_customer_booking(uuid);
DROP FUNCTION IF EXISTS public.cancel_customer_booking(uuid, text);
CREATE FUNCTION public.cancel_customer_booking(p_appointment_id uuid, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_appt   public.appointments%ROWTYPE;
  v_hours  int;
  v_now    timestamptz := now();
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.check_rate_limit('rpc:cancel:user:' || v_uid::text, 20, 3600) THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  -- Not found and not-yours look identical (no existence oracle).
  IF v_appt.id IS NULL OR NOT EXISTS (
       SELECT 1 FROM public.clients c WHERE c.id = v_appt.client_id AND c.auth_user_id = v_uid) THEN
    RAISE EXCEPTION 'APPT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_appt.status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = 'P0001';
  END IF;
  IF v_appt.start_time <= v_now THEN
    RAISE EXCEPTION 'ALREADY_STARTED' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(s.cancellation_policy_hours, 0) INTO v_hours FROM public.shops s WHERE s.id = v_appt.shop_id;
  IF v_hours > 0 AND v_appt.start_time - v_now < make_interval(hours => v_hours) THEN
    RAISE EXCEPTION 'INSIDE_CANCELLATION_WINDOW' USING ERRCODE = 'P0001',
      DETAIL = v_hours::text;
  END IF;

  UPDATE public.appointments
  SET status = 'cancelled',
      cancelled_at = v_now,
      cancellation_reason = NULLIF(left(trim(COALESCE(p_reason, '')), 500), '')
  WHERE id = v_appt.id;

  RETURN jsonb_build_object('appointment_id', v_appt.id, 'status', 'cancelled', 'cancelled_at', v_now);
END;
$$;

-- Links the caller's VERIFIED identity to unlinked client rows in every shop.
-- Only auth.users.email with email_confirmed_at, or auth.users.phone with
-- phone_confirmed_at. Never raw_user_meta_data. Returns the most recent
-- linked client id (or NULL).
DROP FUNCTION IF EXISTS public.link_customer_client();
CREATE FUNCTION public.link_customer_client()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_email  text;
  v_phone  text;
  v_id     uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;

  SELECT CASE WHEN u.email_confirmed_at IS NOT NULL THEN lower(u.email) END,
         CASE WHEN u.phone_confirmed_at IS NOT NULL THEN regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') END
    INTO v_email, v_phone
  FROM auth.users u WHERE u.id = v_uid;

  IF COALESCE(v_email, '') <> '' OR COALESCE(v_phone, '') <> '' THEN
    UPDATE public.clients c SET auth_user_id = v_uid
    WHERE c.auth_user_id IS NULL AND c.deleted_at IS NULL
      AND ((COALESCE(v_email, '') <> '' AND lower(c.email) = v_email)
        OR (length(COALESCE(v_phone, '')) >= 7 AND c.phone_digits = v_phone));
  END IF;

  SELECT c.id INTO v_id FROM public.clients c
  WHERE c.auth_user_id = v_uid ORDER BY c.created_at DESC LIMIT 1;
  RETURN v_id;
END;
$$;

-- Caller's appointments with display data (customer portal).
DROP FUNCTION IF EXISTS public.get_my_appointments();
CREATE FUNCTION public.get_my_appointments()
RETURNS TABLE (
  id uuid, shop_id uuid, shop_name text, shop_address text, shop_phone text, shop_timezone text,
  cancellation_policy_hours int, barber_id uuid, barber_name text, client_name text,
  service_name text, service_ids uuid[], start_time timestamptz, end_time timestamptz,
  status text, price numeric, currency text, source text, cancelled_at timestamptz,
  has_review boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT a.id, a.shop_id, s.name, s.address, s.phone, COALESCE(s.timezone, 'Asia/Amman'),
         COALESCE(s.cancellation_policy_hours, 0), a.barber_id, p.full_name, a.client_name,
         a.service_name, a.service_ids, a.start_time, a.end_time,
         a.status::text, a.price, COALESCE(a.currency, s.currency, 'JOD'), a.source, a.cancelled_at,
         EXISTS (SELECT 1 FROM public.reviews r WHERE r.appointment_id = a.id)
  FROM public.appointments a
  JOIN public.clients c ON c.id = a.client_id
  JOIN public.shops s   ON s.id = a.shop_id
  LEFT JOIN public.profiles p ON p.id = a.barber_id
  WHERE c.auth_user_id = auth.uid() AND auth.uid() IS NOT NULL
  ORDER BY a.start_time DESC
  LIMIT 200;
$$;

-- Reviews: only for the caller's own completed appointment, once.
DROP FUNCTION IF EXISTS public.submit_review(uuid, int, text);
CREATE FUNCTION public.submit_review(p_appointment_id uuid, p_rating int, p_comment text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_appt   public.appointments%ROWTYPE;
  v_client public.clients%ROWTYPE;
  v_name   text;
  v_id     uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  IF p_rating IS NULL OR p_rating < 1 OR p_rating > 5 OR length(COALESCE(p_comment, '')) > 1000 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  SELECT * INTO v_client FROM public.clients WHERE id = v_appt.client_id;
  IF v_appt.id IS NULL OR v_client.id IS NULL OR v_client.auth_user_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'APPT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_appt.status <> 'completed' THEN
    RAISE EXCEPTION 'REVIEW_NOT_ALLOWED' USING ERRCODE = 'P0001';
  END IF;
  IF EXISTS (SELECT 1 FROM public.reviews r WHERE r.appointment_id = v_appt.id) THEN
    RAISE EXCEPTION 'ALREADY_REVIEWED' USING ERRCODE = 'P0001';
  END IF;

  v_name := split_part(trim(COALESCE(v_appt.client_name, v_client.name, '')), ' ', 1);
  IF split_part(trim(COALESCE(v_appt.client_name, v_client.name, '')), ' ', 2) <> '' THEN
    v_name := v_name || ' ' || upper(left(split_part(trim(COALESCE(v_appt.client_name, v_client.name)), ' ', 2), 1)) || '.';
  END IF;

  INSERT INTO public.reviews (shop_id, client_id, appointment_id, rating, comment, reviewer_name)
  VALUES (v_appt.shop_id, v_client.id, v_appt.id, p_rating,
          NULLIF(left(trim(COALESCE(p_comment, '')), 1000), ''), NULLIF(v_name, ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 14. STAFF RPC — atomic "mark paid / complete" (POS)
-- ═══════════════════════════════════════════════════════════════════════════
DROP FUNCTION IF EXISTS public.complete_appointment_sale(uuid, text, numeric);
CREATE FUNCTION public.complete_appointment_sale(p_appointment_id uuid, p_payment_method text, p_amount numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_me     public.profiles%ROWTYPE;
  v_appt   public.appointments%ROWTYPE;
  v_amount numeric(10,2);
  v_sale   uuid;
  v_tz     text;
  v_barber text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  IF p_payment_method NOT IN ('cash', 'card', 'online', 'mixed') OR (p_amount IS NOT NULL AND (p_amount < 0 OR p_amount > 100000)) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_me FROM public.profiles WHERE id = v_uid;
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF v_appt.id IS NULL OR v_me.shop_id IS DISTINCT FROM v_appt.shop_id
     OR v_me.role::text NOT IN ('shop_admin', 'barber') THEN
    RAISE EXCEPTION 'APPT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_me.role::text <> 'shop_admin' AND v_appt.barber_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'P0001';
  END IF;
  IF v_appt.status NOT IN ('pending', 'confirmed', 'completed') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE = 'P0001';
  END IF;

  v_amount := COALESCE(p_amount, v_appt.price, 0);
  SELECT COALESCE(timezone, 'Asia/Amman') INTO v_tz FROM public.shops WHERE id = v_appt.shop_id;
  SELECT full_name INTO v_barber FROM public.profiles WHERE id = v_appt.barber_id;

  UPDATE public.appointments
  SET status = 'completed', payment_status = 'paid', payment_method = p_payment_method, amount_paid = v_amount
  WHERE id = v_appt.id;

  SELECT d.id INTO v_sale FROM public.daily_sales d WHERE d.appointment_id = v_appt.id LIMIT 1;
  IF v_sale IS NULL THEN
    INSERT INTO public.daily_sales (shop_id, appointment_id, client_name, service_name, barber_name, amount, payment_method, sale_time)
    VALUES (v_appt.shop_id, v_appt.id, COALESCE(v_appt.client_name, ''), COALESCE(v_appt.service_name, ''),
            COALESCE(v_barber, ''), v_amount, p_payment_method, to_char(now() AT TIME ZONE v_tz, 'HH24:MI'))
    RETURNING id INTO v_sale;

    IF v_appt.client_id IS NOT NULL THEN
      UPDATE public.clients SET total_spend = COALESCE(total_spend, 0) + v_amount WHERE id = v_appt.client_id;
    END IF;
  END IF;

  RETURN jsonb_build_object('appointment_id', v_appt.id, 'sale_id', v_sale, 'status', 'completed', 'amount', v_amount);
END;
$$;

-- Dashboard KPIs in one round trip, in the shop's time zone. SECURITY INVOKER:
-- RLS applies, so a caller only ever sums their own shop's rows.
DROP FUNCTION IF EXISTS public.dashboard_metrics(uuid);
CREATE FUNCTION public.dashboard_metrics(p_shop_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH s AS (
    SELECT sh.id, COALESCE(sh.timezone, 'Asia/Amman') AS tz, COALESCE(sh.daily_goal, 120) AS goal,
           COALESCE(sh.currency, 'JOD') AS currency,
           (now() AT TIME ZONE COALESCE(sh.timezone, 'Asia/Amman')) AS local_now
    FROM public.shops sh WHERE sh.id = p_shop_id
  ), b AS (
    SELECT s.*,
      (date_trunc('day',   local_now) AT TIME ZONE tz)                         AS day0,
      (date_trunc('day',   local_now) + interval '1 day') AT TIME ZONE tz      AS day1,
      (date_trunc('day',   local_now) - interval '1 day') AT TIME ZONE tz      AS yday0,
      (date_trunc('week',  local_now) AT TIME ZONE tz)                         AS week0,
      (date_trunc('week',  local_now) - interval '1 week') AT TIME ZONE tz     AS pweek0,
      (date_trunc('month', local_now) AT TIME ZONE tz)                         AS month0,
      (date_trunc('month', local_now) - interval '1 month') AT TIME ZONE tz    AS pmonth0
    FROM s
  )
  SELECT jsonb_build_object(
    'today_bookings',     (SELECT count(*) FROM public.appointments a WHERE a.shop_id = b.id AND a.status <> 'cancelled' AND a.start_time >= b.day0  AND a.start_time < b.day1),
    'yesterday_bookings', (SELECT count(*) FROM public.appointments a WHERE a.shop_id = b.id AND a.status <> 'cancelled' AND a.start_time >= b.yday0 AND a.start_time < b.day0),
    'today_sales',        COALESCE((SELECT sum(d.amount) FROM public.daily_sales d WHERE d.shop_id = b.id AND d.created_at >= b.day0  AND d.created_at < b.day1), 0),
    'yesterday_sales',    COALESCE((SELECT sum(d.amount) FROM public.daily_sales d WHERE d.shop_id = b.id AND d.created_at >= b.yday0 AND d.created_at < b.day0), 0),
    'week_sales',         COALESCE((SELECT sum(d.amount) FROM public.daily_sales d WHERE d.shop_id = b.id AND d.created_at >= b.week0), 0),
    'prev_week_sales',    COALESCE((SELECT sum(d.amount) FROM public.daily_sales d WHERE d.shop_id = b.id AND d.created_at >= b.pweek0 AND d.created_at < b.week0), 0),
    'month_sales',        COALESCE((SELECT sum(d.amount) FROM public.daily_sales d WHERE d.shop_id = b.id AND d.created_at >= b.month0), 0),
    'prev_month_sales',   COALESCE((SELECT sum(d.amount) FROM public.daily_sales d WHERE d.shop_id = b.id AND d.created_at >= b.pmonth0 AND d.created_at < b.month0), 0),
    'daily_goal',         b.goal,
    'currency',           b.currency,
    'timezone',           b.tz
  )
  FROM b;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 15. INVITES
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS TABLE (shop_id uuid, role text, status text, expires_at timestamptz)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT i.shop_id, i.role, i.status, i.expires_at
  FROM public.invites i
  WHERE i.token = p_token AND length(p_token) BETWEEN 16 AND 500;
$$;

DROP FUNCTION IF EXISTS public.accept_invite(text);
CREATE FUNCTION public.accept_invite(p_token text)
RETURNS TABLE (shop_id uuid, role text)
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_invite public.invites%ROWTYPE;
  v_me     public.profiles%ROWTYPE;
  v_role   text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.check_rate_limit('rpc:invite_accept:user:' || v_uid::text, 10, 60) THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_invite FROM public.invites i WHERE i.token = p_token FOR UPDATE;
  IF v_invite.id IS NULL OR v_invite.status = 'revoked' THEN
    RAISE EXCEPTION 'INVITE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'INVITE_USED' USING ERRCODE = 'P0001';
  END IF;
  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    -- (No status write here: the RAISE would roll it back anyway.)
    RAISE EXCEPTION 'INVITE_EXPIRED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_me FROM public.profiles p WHERE p.id = v_uid FOR UPDATE;

  -- Sole admin of a different shop must transfer ownership first.
  IF v_me.id IS NOT NULL AND v_me.shop_id IS NOT NULL AND v_me.shop_id <> v_invite.shop_id
     AND v_me.role::text = 'shop_admin'
     AND NOT EXISTS (SELECT 1 FROM public.profiles p
                     WHERE p.shop_id = v_me.shop_id AND p.role::text = 'shop_admin' AND p.id <> v_uid) THEN
    RAISE EXCEPTION 'LAST_ADMIN' USING ERRCODE = 'P0001';
  END IF;

  -- Never demote an existing admin of the same shop via a barber invite.
  v_role := CASE WHEN v_me.shop_id = v_invite.shop_id AND v_me.role::text = 'shop_admin'
                 THEN 'shop_admin' ELSE v_invite.role END;

  IF v_me.id IS NULL THEN
    INSERT INTO public.profiles (id, shop_id, role, full_name)
    SELECT v_uid, v_invite.shop_id, v_role,
           left(COALESCE(NULLIF(u.raw_user_meta_data->>'full_name', ''), split_part(u.email, '@', 1), 'Member'), 100)
    FROM auth.users u WHERE u.id = v_uid;
  ELSE
    UPDATE public.profiles p SET shop_id = v_invite.shop_id, role = v_role WHERE p.id = v_uid;
  END IF;

  UPDATE public.invites i
  SET status = 'accepted', accepted_by = v_uid, accepted_at = now()
  WHERE i.id = v_invite.id;

  PERFORM public.seed_staff_defaults(v_uid, v_invite.shop_id);

  RETURN QUERY SELECT v_invite.shop_id, v_role;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 16. NOTIFICATION TRIGGERS — never block the parent write
--     type values: 'booking_created' | 'booking_status_changed' | 'booking_cancelled_by_customer'
--     payload: { appointment_id, status, start_time, client_name, service_name, shop_name }
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.notify_shop_on_appointment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tz      text;
  v_shop    text;
  v_client  text;
  v_when    text;
BEGIN
  BEGIN
    SELECT COALESCE(s.timezone, 'Asia/Amman'), s.name INTO v_tz, v_shop FROM public.shops s WHERE s.id = NEW.shop_id;
    v_tz := COALESCE(v_tz, 'Asia/Amman');
    v_client := COALESCE(NULLIF(NEW.client_name, ''),
                         (SELECT c.name FROM public.clients c WHERE c.id = NEW.client_id), 'A client');
    v_when := to_char(NEW.start_time AT TIME ZONE v_tz, 'Mon DD, HH24:MI');

    INSERT INTO public.notifications (user_id, shop_id, title, message, link, type, payload)
    SELECT DISTINCT r.uid, NEW.shop_id, 'New booking',
           v_client || ' booked ' || COALESCE(NULLIF(NEW.service_name, ''), 'an appointment') || ' for ' || COALESCE(v_when, ''),
           '/calendar?date=' || to_char(NEW.start_time AT TIME ZONE v_tz, 'YYYY-MM-DD'),
           'booking_created',
           jsonb_build_object('appointment_id', NEW.id, 'status', NEW.status, 'start_time', NEW.start_time,
                              'client_name', v_client, 'service_name', NEW.service_name, 'shop_name', v_shop)
    FROM (
      SELECT p.id AS uid FROM public.profiles p WHERE p.shop_id = NEW.shop_id AND p.role::text = 'shop_admin'
      UNION
      SELECT NEW.barber_id WHERE NEW.barber_id IS NOT NULL
    ) r
    WHERE r.uid IS NOT NULL AND r.uid IS DISTINCT FROM auth.uid();
  EXCEPTION WHEN others THEN
    RAISE WARNING 'notify_shop_on_appointment failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE FUNCTION public.notify_client_on_appointment_status()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor    uuid := auth.uid();
  v_customer uuid;
  v_tz       text;
  v_shop     text;
  v_payload  jsonb;
BEGIN
  IF OLD.status IS NOT DISTINCT FROM NEW.status THEN
    RETURN NEW;
  END IF;
  BEGIN
    SELECT c.auth_user_id INTO v_customer FROM public.clients c WHERE c.id = NEW.client_id;
    SELECT COALESCE(s.timezone, 'Asia/Amman'), s.name INTO v_tz, v_shop FROM public.shops s WHERE s.id = NEW.shop_id;
    v_tz := COALESCE(v_tz, 'Asia/Amman');
    v_payload := jsonb_build_object('appointment_id', NEW.id, 'status', NEW.status, 'start_time', NEW.start_time,
                                    'client_name', NEW.client_name, 'service_name', NEW.service_name, 'shop_name', v_shop);

    -- Tell the customer, unless they made the change themselves.
    IF v_customer IS NOT NULL AND v_customer IS DISTINCT FROM v_actor THEN
      INSERT INTO public.notifications (user_id, shop_id, title, message, link, type, payload)
      VALUES (v_customer, NEW.shop_id, 'Appointment update',
              'Your appointment at ' || COALESCE(v_shop, 'the shop') || ' is now ' || replace(NEW.status, '_', ' '),
              '/customer/' || NEW.id, 'booking_status_changed', v_payload);
    END IF;

    -- Customer cancelled: tell the shop admins and the assigned barber.
    IF NEW.status = 'cancelled' AND v_customer IS NOT NULL AND v_customer = v_actor THEN
      INSERT INTO public.notifications (user_id, shop_id, title, message, link, type, payload)
      SELECT DISTINCT r.uid, NEW.shop_id, 'Booking cancelled',
             COALESCE(NULLIF(NEW.client_name, ''), 'A client') || ' cancelled their booking for '
               || to_char(NEW.start_time AT TIME ZONE v_tz, 'Mon DD, HH24:MI'),
             '/calendar?date=' || to_char(NEW.start_time AT TIME ZONE v_tz, 'YYYY-MM-DD'),
             'booking_cancelled_by_customer', v_payload
      FROM (
        SELECT p.id AS uid FROM public.profiles p WHERE p.shop_id = NEW.shop_id AND p.role::text = 'shop_admin'
        UNION
        SELECT NEW.barber_id WHERE NEW.barber_id IS NOT NULL
      ) r
      WHERE r.uid IS NOT NULL;
    END IF;
  EXCEPTION WHEN others THEN
    RAISE WARNING 'notify_client_on_appointment_status failed: %', SQLERRM;
  END;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trigger_notify_shop_on_appointment ON public.appointments;
CREATE TRIGGER trigger_notify_shop_on_appointment
  AFTER INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_shop_on_appointment();
DROP TRIGGER IF EXISTS trigger_notify_client_on_appointment_status ON public.appointments;
CREATE TRIGGER trigger_notify_client_on_appointment_status
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_client_on_appointment_status();

-- ═══════════════════════════════════════════════════════════════════════════
-- 17. ONE-TIME CLEANUP — undo client links made via unverified metadata phone
--     (or an email the user never confirmed). Keeps a link only when the auth
--     user's CONFIRMED email or CONFIRMED phone matches the client row.
-- ═══════════════════════════════════════════════════════════════════════════
UPDATE public.clients c
SET auth_user_id = NULL
WHERE c.auth_user_id IS NOT NULL
  AND NOT EXISTS (
    SELECT 1 FROM auth.users u
    WHERE u.id = c.auth_user_id
      AND ((u.email_confirmed_at IS NOT NULL AND c.email IS NOT NULL AND lower(u.email) = lower(c.email))
        OR (u.phone_confirmed_at IS NOT NULL AND COALESCE(u.phone, '') <> ''
            AND regexp_replace(u.phone, '\D', '', 'g') = c.phone_digits))
  );

-- ═══════════════════════════════════════════════════════════════════════════
-- 18. FUNCTION PRIVILEGES — explicit allow-list (Supabase grants EXECUTE to
--     anon/authenticated by default; revoke first, then grant).
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.get_current_shop_id()', 'public.get_user_shop_id()', 'public.current_profile_shop_and_role()',
    'public.is_shop_admin()', 'public.is_shop_staff()', 'public.is_admin_of_profile(uuid)', 'public.my_client_ids()',
    'public.check_rate_limit(text, integer, integer)',
    'public.handle_updated_at()', 'public.guard_last_shop_admin()', 'public.appointment_status_side_effects()',
    'public.seed_staff_defaults(uuid, uuid)', 'public.handle_new_user()',
    'public.barber_is_working(uuid, timestamptz, timestamptz, text)', 'public.barber_offers_services(uuid, uuid[])',
    'public.get_busy_slots(uuid, date, uuid)',
    'public.create_public_booking(uuid, text, text, uuid[], uuid, timestamptz, text, text)',
    'public.cancel_customer_booking(uuid, text)', 'public.link_customer_client()', 'public.get_my_appointments()',
    'public.submit_review(uuid, integer, text)', 'public.complete_appointment_sale(uuid, text, numeric)',
    'public.get_invite_by_token(text)', 'public.accept_invite(text)', 'public.dashboard_metrics(uuid)',
    'public.notify_shop_on_appointment()', 'public.notify_client_on_appointment_status()'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;

-- RLS helpers (called from policies as the invoking role).
GRANT EXECUTE ON FUNCTION public.get_current_shop_id()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_user_shop_id()               TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_profile_shop_and_role()  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_admin()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_shop_staff()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_admin_of_profile(uuid)        TO authenticated;
GRANT EXECUTE ON FUNCTION public.my_client_ids()                  TO authenticated;
-- Public RPCs.
GRANT EXECUTE ON FUNCTION public.get_busy_slots(uuid, date, uuid) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_booking(uuid, text, text, uuid[], uuid, timestamptz, text, text) TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text)        TO anon, authenticated;
-- Signed-in RPCs.
GRANT EXECUTE ON FUNCTION public.cancel_customer_booking(uuid, text)                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_customer_client()                              TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_appointments()                               TO authenticated;
GRANT EXECUTE ON FUNCTION public.submit_review(uuid, integer, text)                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.complete_appointment_sale(uuid, text, numeric)      TO authenticated;
GRANT EXECUTE ON FUNCTION public.accept_invite(text)                                 TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_metrics(uuid)                             TO authenticated;
-- Server-only (service role): shared rate limiter.
GRANT EXECUTE ON FUNCTION public.check_rate_limit(text, integer, integer)            TO service_role;

-- Belt and braces: any remaining SECURITY DEFINER function in public without
-- a pinned search_path gets one.
DO $$
DECLARE r record;
BEGIN
  FOR r IN
    SELECT p.oid::regprocedure AS sig FROM pg_proc p
    WHERE p.pronamespace = 'public'::regnamespace AND p.prosecdef
      AND NOT EXISTS (SELECT 1 FROM unnest(COALESCE(p.proconfig, '{}'::text[])) c WHERE c LIKE 'search_path=%')
  LOOP
    EXECUTE format('ALTER FUNCTION %s SET search_path = public, pg_temp', r.sig);
  END LOOP;
END $$;
