-- ═══════════════════════════════════════════════════════════════════════════
-- WS-1I · Platform admin back office
--
--   Tables (RLS on, no client writes; every write goes through an audited RPC):
--     • admin_audit_log            append-only log of every admin write
--     • review_reports             review report + moderation queue
--     • claim_disputes             claim-dispute queue (stub until P2 claims)
--     • banned_phones              phone bans (keyed by the last 9 digits)
--     • shop_plan_overrides        plan / allowance overrides (§3 pricing)
--     • admin_impersonation_sessions  support "view as shop" sessions
--   Columns:
--     • shops.suspended_at, profiles.banned_at  (platform only, guarded)
--     • reviews.hidden_at, hidden_by, hidden_reason (moderation)
--   Functions:
--     • admin_* RPCs: SECURITY DEFINER, check platform_role via admin_require()
--       and write admin_audit_log via admin_audit() on every write.
--     • report_review(review, reason, details)  (authenticated; 2B calls it)
--   Enforcement:
--     • A suspended shop takes no bookings from non-staff, and its owner cannot
--       re-publish it until the platform lifts the suspension.
--     • A banned phone cannot book with any shop (staff may still add it).
--     • A banned profile cannot sign in (auth.users.banned_until) and its
--       sessions are revoked.
--     • Hidden reviews are invisible to anon; authenticated users see them
--       only as staff of that shop or platform staff.
--
-- Idempotent and additive: no existing row is changed, nothing is dropped
-- except policies/triggers this file recreates.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Columns on existing tables ─────────────────────────────────────────
ALTER TABLE public.shops    ADD COLUMN IF NOT EXISTS suspended_at timestamptz;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS banned_at    timestamptz;
ALTER TABLE public.reviews  ADD COLUMN IF NOT EXISTS hidden_at     timestamptz;
ALTER TABLE public.reviews  ADD COLUMN IF NOT EXISTS hidden_by     uuid;
ALTER TABLE public.reviews  ADD COLUMN IF NOT EXISTS hidden_reason text;

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'reviews_hidden_reason_len') THEN
    ALTER TABLE public.reviews ADD CONSTRAINT reviews_hidden_reason_len
      CHECK (hidden_reason IS NULL OR length(hidden_reason) <= 500);
  END IF;
END $$;

-- Shop staff can see that their shop is suspended (dashboard banner). anon
-- cannot; public surfaces go through shop_is_public()/definer RPCs.
GRANT SELECT (suspended_at) ON public.shops TO authenticated;
-- banned_at stays private (no column grant).
-- Moderation state is readable wherever the review row itself is readable.
GRANT SELECT (hidden_at) ON public.reviews TO anon, authenticated;

CREATE INDEX IF NOT EXISTS idx_shops_suspended ON public.shops (suspended_at) WHERE suspended_at IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_profiles_banned ON public.profiles (banned_at) WHERE banned_at IS NOT NULL;

-- ─── 2. Platform-only column guards ────────────────────────────────────────
-- shops/profiles have table-level UPDATE grants (RLS limits rows), so new
-- columns would otherwise be writable by a shop admin / the user themself.
CREATE OR REPLACE FUNCTION public.admin_guard_platform_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_privileged boolean := current_user IN ('postgres', 'supabase_admin', 'service_role');
BEGIN
  IF v_privileged THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'shops' THEN
    IF (TG_OP = 'INSERT' AND NEW.suspended_at IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.suspended_at IS DISTINCT FROM OLD.suspended_at) THEN
      RAISE EXCEPTION 'FORBIDDEN: suspended_at is set by the platform' USING ERRCODE = '42501';
    END IF;
    -- A suspended shop cannot be re-published by its owner.
    IF TG_OP = 'UPDATE' AND NEW.suspended_at IS NOT NULL
       AND NEW.is_published AND NOT coalesce(OLD.is_published, false) THEN
      RAISE EXCEPTION 'SHOP_SUSPENDED' USING ERRCODE = 'P0001';
    END IF;
  ELSIF TG_TABLE_NAME = 'profiles' THEN
    IF (TG_OP = 'INSERT' AND NEW.banned_at IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.banned_at IS DISTINCT FROM OLD.banned_at) THEN
      RAISE EXCEPTION 'FORBIDDEN: banned_at is set by the platform' USING ERRCODE = '42501';
    END IF;
  ELSIF TG_TABLE_NAME = 'reviews' THEN
    IF (TG_OP = 'INSERT' AND (NEW.hidden_at IS NOT NULL OR NEW.hidden_by IS NOT NULL OR NEW.hidden_reason IS NOT NULL))
       OR (TG_OP = 'UPDATE' AND (NEW.hidden_at IS DISTINCT FROM OLD.hidden_at
                                 OR NEW.hidden_by IS DISTINCT FROM OLD.hidden_by
                                 OR NEW.hidden_reason IS DISTINCT FROM OLD.hidden_reason)) THEN
      RAISE EXCEPTION 'FORBIDDEN: review moderation is set by the platform' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS admin_guard_platform_columns ON public.shops;
CREATE TRIGGER admin_guard_platform_columns BEFORE INSERT OR UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.admin_guard_platform_columns();
DROP TRIGGER IF EXISTS admin_guard_platform_columns ON public.profiles;
CREATE TRIGGER admin_guard_platform_columns BEFORE INSERT OR UPDATE OF banned_at ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.admin_guard_platform_columns();
DROP TRIGGER IF EXISTS admin_guard_platform_columns ON public.reviews;
CREATE TRIGGER admin_guard_platform_columns BEFORE INSERT OR UPDATE ON public.reviews
  FOR EACH ROW EXECUTE FUNCTION public.admin_guard_platform_columns();

-- ─── 3. Audit log (append-only) ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_audit_log (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id         uuid,                 -- no FK: the log outlives deleted accounts
  actor_role       text,
  action           text NOT NULL,
  target_type      text NOT NULL,
  target_id        text,
  reason           text,
  diff             jsonb NOT NULL DEFAULT '{}'::jsonb,
  impersonation_id uuid,
  created_at       timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_log_action_format') THEN
    ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_action_format
      CHECK (action ~ '^[a-z_]+(\.[a-z_]+)+$' AND length(action) <= 64);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_log_target_type_check') THEN
    ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_target_type_check
      CHECK (target_type IN ('shop', 'profile', 'phone', 'review', 'review_report', 'claim', 'plan', 'impersonation', 'service'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_audit_log_reason_len') THEN
    ALTER TABLE public.admin_audit_log ADD CONSTRAINT admin_audit_log_reason_len
      CHECK (reason IS NULL OR length(reason) <= 500);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_audit_created ON public.admin_audit_log (created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_target  ON public.admin_audit_log (target_type, target_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_admin_audit_actor   ON public.admin_audit_log (actor_id, created_at DESC);

ALTER TABLE public.admin_audit_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_audit_log_select_platform ON public.admin_audit_log;
CREATE POLICY admin_audit_log_select_platform ON public.admin_audit_log
  FOR SELECT TO authenticated USING ((SELECT public.is_platform_staff()));
REVOKE ALL ON public.admin_audit_log FROM anon, authenticated;
GRANT SELECT ON public.admin_audit_log TO authenticated;
GRANT SELECT, INSERT ON public.admin_audit_log TO service_role;

CREATE OR REPLACE FUNCTION public.admin_audit_log_immutable()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  RAISE EXCEPTION 'FORBIDDEN: the admin audit log is append-only' USING ERRCODE = '42501';
END;
$$;
DROP TRIGGER IF EXISTS admin_audit_log_immutable ON public.admin_audit_log;
CREATE TRIGGER admin_audit_log_immutable BEFORE UPDATE OR DELETE ON public.admin_audit_log
  FOR EACH ROW EXECUTE FUNCTION public.admin_audit_log_immutable();

-- ─── 4. Review reports ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.review_reports (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id       uuid NOT NULL REFERENCES public.reviews(id) ON DELETE CASCADE,
  shop_id         uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  reporter_id     uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  reporter_kind   text NOT NULL DEFAULT 'customer',
  reason          text NOT NULL,
  details         text,
  status          text NOT NULL DEFAULT 'open',
  resolved_by     uuid,
  resolved_at     timestamptz,
  resolution_note text,
  created_at      timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_reports_reason_check') THEN
    ALTER TABLE public.review_reports ADD CONSTRAINT review_reports_reason_check
      CHECK (reason IN ('spam', 'offensive', 'fake', 'conflict_of_interest', 'privacy', 'other'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_reports_status_check') THEN
    ALTER TABLE public.review_reports ADD CONSTRAINT review_reports_status_check
      CHECK (status IN ('open', 'upheld', 'dismissed'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_reports_kind_check') THEN
    ALTER TABLE public.review_reports ADD CONSTRAINT review_reports_kind_check
      CHECK (reporter_kind IN ('customer', 'shop_staff', 'platform'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'review_reports_text_len') THEN
    ALTER TABLE public.review_reports ADD CONSTRAINT review_reports_text_len
      CHECK (coalesce(length(details), 0) <= 1000 AND coalesce(length(resolution_note), 0) <= 500);
  END IF;
END $$;

CREATE UNIQUE INDEX IF NOT EXISTS review_reports_one_open_per_reporter
  ON public.review_reports (review_id, reporter_id) WHERE status = 'open' AND reporter_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_review_reports_queue ON public.review_reports (status, created_at);
CREATE INDEX IF NOT EXISTS idx_review_reports_review ON public.review_reports (review_id);
CREATE INDEX IF NOT EXISTS idx_review_reports_shop ON public.review_reports (shop_id);

ALTER TABLE public.review_reports ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS review_reports_select ON public.review_reports;
CREATE POLICY review_reports_select ON public.review_reports
  FOR SELECT TO authenticated
  USING (
    reporter_id = (SELECT auth.uid())
    OR (SELECT public.is_platform_staff())
    OR (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()))
  );
REVOKE ALL ON public.review_reports FROM anon, authenticated;
GRANT SELECT ON public.review_reports TO authenticated;
GRANT ALL ON public.review_reports TO service_role;

-- ─── 5. Claim disputes (stub queue until P2 unclaimed listings) ────────────
CREATE TABLE IF NOT EXISTS public.claim_disputes (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  claimant_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  claimant_name       text NOT NULL,
  claimant_phone      text,
  details             text NOT NULL,
  status              text NOT NULL DEFAULT 'open',
  resolution_note     text,
  resolved_by         uuid,
  resolved_at         timestamptz,
  created_by          uuid,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'claim_disputes_status_check') THEN
    ALTER TABLE public.claim_disputes ADD CONSTRAINT claim_disputes_status_check
      CHECK (status IN ('open', 'upheld', 'rejected', 'withdrawn'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'claim_disputes_text_len') THEN
    ALTER TABLE public.claim_disputes ADD CONSTRAINT claim_disputes_text_len
      CHECK (length(claimant_name) BETWEEN 1 AND 120 AND length(details) BETWEEN 1 AND 2000
             AND coalesce(length(claimant_phone), 0) <= 32 AND coalesce(length(resolution_note), 0) <= 500);
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_claim_disputes_queue ON public.claim_disputes (status, created_at);

ALTER TABLE public.claim_disputes ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS claim_disputes_select_platform ON public.claim_disputes;
CREATE POLICY claim_disputes_select_platform ON public.claim_disputes
  FOR SELECT TO authenticated USING ((SELECT public.is_platform_staff()));
REVOKE ALL ON public.claim_disputes FROM anon, authenticated;
GRANT SELECT ON public.claim_disputes TO authenticated;
GRANT ALL ON public.claim_disputes TO service_role;

-- ─── 6. Banned phones ──────────────────────────────────────────────────────
-- Keyed like otp_phone_key(): the last 9 digits, so 0791234567,
-- +962791234567 and 00962 791 234 567 are the same number.
CREATE OR REPLACE FUNCTION public.admin_phone_key(p_phone text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN length(regexp_replace(coalesce(p_phone, ''), '\D', '', 'g')) BETWEEN 7 AND 15
      THEN right(regexp_replace(p_phone, '\D', '', 'g'), 9)
    ELSE NULL
  END;
$$;

CREATE TABLE IF NOT EXISTS public.banned_phones (
  phone_key  text PRIMARY KEY,
  phone_hint text,           -- masked display value, never the full number
  reason     text NOT NULL,
  created_by uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'banned_phones_key_format') THEN
    ALTER TABLE public.banned_phones ADD CONSTRAINT banned_phones_key_format
      CHECK (phone_key ~ '^[0-9]{7,9}$' AND length(reason) BETWEEN 1 AND 500);
  END IF;
END $$;

ALTER TABLE public.banned_phones ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS banned_phones_select_platform ON public.banned_phones;
CREATE POLICY banned_phones_select_platform ON public.banned_phones
  FOR SELECT TO authenticated USING ((SELECT public.is_platform_staff()));
REVOKE ALL ON public.banned_phones FROM anon, authenticated;
GRANT SELECT ON public.banned_phones TO authenticated;
GRANT ALL ON public.banned_phones TO service_role;

-- True when the number is banned. Service-role/definer helper for 1C/1D/1J.
CREATE OR REPLACE FUNCTION public.is_phone_banned(p_phone text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.banned_phones b WHERE b.phone_key = public.admin_phone_key(p_phone));
$$;

-- ─── 7. Plan / allowance overrides ─────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_plan_overrides (
  shop_id                   uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  plan_code                 text NOT NULL DEFAULT 'trial',
  trial_ends_at             timestamptz,
  max_barbers               integer,
  monthly_message_allowance integer,
  note                      text,
  updated_by                uuid,
  created_at                timestamptz NOT NULL DEFAULT now(),
  updated_at                timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shop_plan_overrides_values') THEN
    ALTER TABLE public.shop_plan_overrides ADD CONSTRAINT shop_plan_overrides_values
      CHECK (plan_code IN ('trial', 'solo', 'team', 'pro', 'custom')
             AND (max_barbers IS NULL OR max_barbers BETWEEN 1 AND 200)
             AND (monthly_message_allowance IS NULL OR monthly_message_allowance BETWEEN 0 AND 1000000)
             AND coalesce(length(note), 0) <= 500);
  END IF;
END $$;

ALTER TABLE public.shop_plan_overrides ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_plan_overrides_select ON public.shop_plan_overrides;
CREATE POLICY shop_plan_overrides_select ON public.shop_plan_overrides
  FOR SELECT TO authenticated
  USING (
    (SELECT public.is_platform_staff())
    OR (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  );
REVOKE ALL ON public.shop_plan_overrides FROM anon, authenticated;
GRANT SELECT (shop_id, plan_code, trial_ends_at, max_barbers, monthly_message_allowance, updated_at)
  ON public.shop_plan_overrides TO authenticated;
GRANT ALL ON public.shop_plan_overrides TO service_role;

-- ─── 8. Impersonation sessions ─────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.admin_impersonation_sessions (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  actor_id   uuid NOT NULL,
  shop_id    uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  mode       text NOT NULL DEFAULT 'read',
  reason     text,
  started_at timestamptz NOT NULL DEFAULT now(),
  expires_at timestamptz NOT NULL,
  ended_at   timestamptz,
  end_reason text
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'admin_impersonation_mode_check') THEN
    ALTER TABLE public.admin_impersonation_sessions ADD CONSTRAINT admin_impersonation_mode_check
      CHECK (mode IN ('read', 'write') AND (mode = 'read' OR length(coalesce(reason, '')) >= 10)
             AND coalesce(length(reason), 0) <= 500
             AND (end_reason IS NULL OR end_reason IN ('stopped', 'superseded', 'expired')));
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_admin_impersonation_actor
  ON public.admin_impersonation_sessions (actor_id, started_at DESC);

ALTER TABLE public.admin_impersonation_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS admin_impersonation_select_platform ON public.admin_impersonation_sessions;
CREATE POLICY admin_impersonation_select_platform ON public.admin_impersonation_sessions
  FOR SELECT TO authenticated USING ((SELECT public.is_platform_staff()));
REVOKE ALL ON public.admin_impersonation_sessions FROM anon, authenticated;
GRANT SELECT ON public.admin_impersonation_sessions TO authenticated;
GRANT ALL ON public.admin_impersonation_sessions TO service_role;

-- ─── 9. Review visibility ──────────────────────────────────────────────────
-- Was: reviews_select_public USING (true). Hidden reviews now disappear for
-- anon; authenticated users see them only as staff of that shop or platform
-- staff. (is_platform_staff is not executable by anon, hence two policies.)
DROP POLICY IF EXISTS reviews_select_public ON public.reviews;
DROP POLICY IF EXISTS reviews_select_anon ON public.reviews;
CREATE POLICY reviews_select_anon ON public.reviews
  FOR SELECT TO anon USING (hidden_at IS NULL);
DROP POLICY IF EXISTS reviews_select_authenticated ON public.reviews;
CREATE POLICY reviews_select_authenticated ON public.reviews
  FOR SELECT TO authenticated
  USING (
    hidden_at IS NULL
    OR (SELECT public.is_platform_staff())
    OR (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()))
  );

-- ─── 10. Booking enforcement (suspended shop / banned phone / banned user) ─
CREATE OR REPLACE FUNCTION public.admin_guard_appointment_insert()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid   uuid := auth.uid();
  v_staff boolean;
  v_phone text;
BEGIN
  IF v_uid IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.banned_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'ACCOUNT_BANNED' USING ERRCODE = 'P0001';
  END IF;

  v_staff := v_uid IS NOT NULL AND public.is_staff_of_shop(NEW.shop_id);
  IF v_staff THEN
    RETURN NEW;
  END IF;

  IF EXISTS (SELECT 1 FROM public.shops s WHERE s.id = NEW.shop_id AND s.suspended_at IS NOT NULL) THEN
    RAISE EXCEPTION 'SHOP_SUSPENDED' USING ERRCODE = 'P0001';
  END IF;

  IF NEW.client_id IS NOT NULL THEN
    SELECT c.phone INTO v_phone FROM public.clients c WHERE c.id = NEW.client_id;
    IF v_phone IS NOT NULL AND public.is_phone_banned(v_phone) THEN
      RAISE EXCEPTION 'PHONE_BANNED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS admin_guard_appointment_insert ON public.appointments;
CREATE TRIGGER admin_guard_appointment_insert BEFORE INSERT ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.admin_guard_appointment_insert();

-- ─── 11. Internal helpers ──────────────────────────────────────────────────
-- Returns the caller's platform role, or raises NOT_AUTHORIZED when it is
-- below p_min ('support' < 'admin').
CREATE OR REPLACE FUNCTION public.admin_require(p_min text DEFAULT 'support')
RETURNS text
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text;
BEGIN
  SELECT p.platform_role INTO v_role
  FROM public.profiles p
  WHERE p.id = auth.uid() AND p.banned_at IS NULL;

  IF v_role IS NULL
     OR v_role NOT IN ('support', 'admin')
     OR (p_min = 'admin' AND v_role <> 'admin') THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_role;
END;
$$;

-- Trims a reason; raises REASON_REQUIRED when required and shorter than 5.
CREATE OR REPLACE FUNCTION public.admin_reason(p_reason text, p_required boolean DEFAULT true, p_min int DEFAULT 5)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v text := NULLIF(btrim(coalesce(p_reason, '')), '');
BEGIN
  IF v IS NOT NULL AND length(v) > 500 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'reason';
  END IF;
  IF p_required AND (v IS NULL OR length(v) < p_min) THEN
    RAISE EXCEPTION 'REASON_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  RETURN v;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_audit(
  p_action text,
  p_target_type text,
  p_target_id text,
  p_reason text DEFAULT NULL,
  p_diff jsonb DEFAULT '{}'::jsonb,
  p_impersonation_id uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id uuid;
BEGIN
  INSERT INTO public.admin_audit_log (actor_id, actor_role, action, target_type, target_id, reason, diff, impersonation_id)
  VALUES (auth.uid(), public.current_platform_role(), p_action, p_target_type, p_target_id,
          p_reason, coalesce(p_diff, '{}'::jsonb), p_impersonation_id)
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_clamp(p_value int, p_default int, p_min int, p_max int)
RETURNS int
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT greatest(p_min, least(p_max, coalesce(p_value, p_default)));
$$;

-- ─── 12. Read RPCs (platform staff) ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_whoami()
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role text := public.admin_require('support');
  v_uid  uuid := auth.uid();
BEGIN
  RETURN jsonb_build_object(
    'user_id', v_uid,
    'role', v_role,
    'full_name', (SELECT p.full_name FROM public.profiles p WHERE p.id = v_uid),
    'impersonation', (
      SELECT jsonb_build_object('id', s.id, 'shop_id', s.shop_id, 'shop_name', sh.name, 'mode', s.mode,
                                'reason', s.reason, 'started_at', s.started_at, 'expires_at', s.expires_at)
      FROM public.admin_impersonation_sessions s
      JOIN public.shops sh ON sh.id = s.shop_id
      WHERE s.actor_id = v_uid AND s.ended_at IS NULL AND s.expires_at > now()
      ORDER BY s.started_at DESC LIMIT 1
    )
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_overview()
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.admin_require('support');
  RETURN jsonb_build_object(
    'shops_total',       (SELECT count(*) FROM public.shops),
    'shops_published',   (SELECT count(*) FROM public.shops WHERE is_published AND suspended_at IS NULL),
    'shops_unverified',  (SELECT count(*) FROM public.shops WHERE is_published AND NOT is_verified AND suspended_at IS NULL),
    'shops_suspended',   (SELECT count(*) FROM public.shops WHERE suspended_at IS NOT NULL),
    'open_reports',      (SELECT count(*) FROM public.review_reports WHERE status = 'open'),
    'open_claims',       (SELECT count(*) FROM public.claim_disputes WHERE status = 'open'),
    'banned_profiles',   (SELECT count(*) FROM public.profiles WHERE banned_at IS NOT NULL),
    'banned_phones',     (SELECT count(*) FROM public.banned_phones),
    'bookings_7d',       (SELECT count(*) FROM public.appointments WHERE created_at > now() - interval '7 days'),
    'recent_audit', coalesce((
      SELECT jsonb_agg(row_to_json(a) ORDER BY a.created_at DESC)
      FROM (
        SELECT l.id, l.action, l.target_type, l.target_id, l.reason, l.created_at, l.actor_role,
               (SELECT p.full_name FROM public.profiles p WHERE p.id = l.actor_id) AS actor_name
        FROM public.admin_audit_log l ORDER BY l.created_at DESC LIMIT 8
      ) a
    ), '[]'::jsonb)
  );
END;
$$;

-- p_status: all | published | unpublished | unverified | verified | suspended
CREATE OR REPLACE FUNCTION public.admin_list_shops(
  p_q text DEFAULT NULL,
  p_status text DEFAULT 'all',
  p_city_id uuid DEFAULT NULL,
  p_limit int DEFAULT 25,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_q      text := NULLIF(btrim(coalesce(p_q, '')), '');
  v_limit  int  := public.admin_clamp(p_limit, 25, 1, 100);
  v_offset int  := public.admin_clamp(p_offset, 0, 0, 100000);
  v_status text := coalesce(p_status, 'all');
  v_total  bigint;
  v_rows   jsonb;
BEGIN
  PERFORM public.admin_require('support');
  IF v_status NOT IN ('all', 'published', 'unpublished', 'unverified', 'verified', 'suspended') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'status';
  END IF;
  IF v_q IS NOT NULL AND length(v_q) > 100 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'q';
  END IF;

  WITH base AS (
    SELECT s.*
    FROM public.shops s
    WHERE (p_city_id IS NULL OR s.city_id = p_city_id)
      AND (v_q IS NULL
           OR s.name ILIKE '%' || v_q || '%'
           OR coalesce(s.name_ar, '') ILIKE '%' || v_q || '%'
           OR s.slug ILIKE '%' || v_q || '%'
           OR s.id::text = v_q
           OR (length(regexp_replace(v_q, '\D', '', 'g')) >= 7
               AND regexp_replace(coalesce(s.phone, ''), '\D', '', 'g') LIKE '%' || right(regexp_replace(v_q, '\D', '', 'g'), 9)))
      AND CASE v_status
            WHEN 'published'   THEN s.is_published AND s.suspended_at IS NULL
            WHEN 'unpublished' THEN NOT s.is_published AND s.suspended_at IS NULL
            WHEN 'unverified'  THEN NOT s.is_verified AND s.suspended_at IS NULL
            WHEN 'verified'    THEN s.is_verified
            WHEN 'suspended'   THEN s.suspended_at IS NOT NULL
            ELSE true
          END
  )
  SELECT (SELECT count(*) FROM base),
         coalesce(jsonb_agg(r ORDER BY r.created_at DESC), '[]'::jsonb)
  INTO v_total, v_rows
  FROM (
    SELECT b.id, b.name, b.name_ar, b.slug, b.is_published, b.marketplace_visible, b.is_verified,
           b.suspended_at, b.created_at, b.published_at,
           c.name_en AS city_name,
           (SELECT count(*) FROM public.profiles p WHERE p.shop_id = b.id AND p.role IN ('barber', 'shop_admin')) AS staff_count,
           (SELECT count(*) FROM public.appointments a WHERE a.shop_id = b.id AND a.created_at > now() - interval '30 days') AS bookings_30d,
           (SELECT round(avg(rv.rating)::numeric, 2) FROM public.reviews rv WHERE rv.shop_id = b.id AND rv.hidden_at IS NULL) AS rating_avg,
           (SELECT count(*) FROM public.review_reports rr WHERE rr.shop_id = b.id AND rr.status = 'open') AS open_reports,
           (SELECT o.plan_code FROM public.shop_plan_overrides o WHERE o.shop_id = b.id) AS plan_code
    FROM base b
    LEFT JOIN public.cities c ON c.id = b.city_id
    ORDER BY b.created_at DESC
    LIMIT v_limit OFFSET v_offset
  ) r;

  RETURN jsonb_build_object('total', v_total, 'limit', v_limit, 'offset', v_offset, 'rows', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_get_shop(p_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shop public.shops%ROWTYPE;
BEGIN
  PERFORM public.admin_require('support');
  SELECT * INTO v_shop FROM public.shops WHERE id = p_shop_id;
  IF v_shop.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  RETURN jsonb_build_object(
    'shop', jsonb_build_object(
      'id', v_shop.id, 'name', v_shop.name, 'name_ar', v_shop.name_ar, 'slug', v_shop.slug,
      'slug_ar', v_shop.slug_ar, 'phone_masked', public.mask_phone(v_shop.phone),
      'whatsapp_masked', public.mask_phone(v_shop.whatsapp), 'address', v_shop.address,
      'is_published', v_shop.is_published, 'published_at', v_shop.published_at,
      'marketplace_visible', v_shop.marketplace_visible, 'is_verified', v_shop.is_verified,
      'suspended_at', v_shop.suspended_at, 'created_at', v_shop.created_at,
      'timezone', v_shop.timezone, 'logo_url', v_shop.logo_url,
      'city_name', (SELECT c.name_en FROM public.cities c WHERE c.id = v_shop.city_id),
      'area_name', (SELECT a.name_en FROM public.areas a WHERE a.id = v_shop.area_id)
    ),
    'staff', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'role', p.role,
                                          'phone_masked', public.mask_phone(p.phone), 'banned_at', p.banned_at)
                       ORDER BY p.role DESC, p.full_name)
      FROM public.profiles p WHERE p.shop_id = v_shop.id AND p.role IN ('barber', 'shop_admin')
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'services_active', (SELECT count(*) FROM public.services s WHERE s.shop_id = v_shop.id AND s.is_active),
      'bookings_30d', (SELECT count(*) FROM public.appointments a WHERE a.shop_id = v_shop.id AND a.created_at > now() - interval '30 days'),
      'no_shows_30d', (SELECT count(*) FROM public.appointments a WHERE a.shop_id = v_shop.id AND a.status = 'no_show' AND a.start_time > now() - interval '30 days'),
      'reviews', (SELECT count(*) FROM public.reviews r WHERE r.shop_id = v_shop.id),
      'reviews_hidden', (SELECT count(*) FROM public.reviews r WHERE r.shop_id = v_shop.id AND r.hidden_at IS NOT NULL),
      'rating_avg', (SELECT round(avg(r.rating)::numeric, 2) FROM public.reviews r WHERE r.shop_id = v_shop.id AND r.hidden_at IS NULL),
      'open_reports', (SELECT count(*) FROM public.review_reports rr WHERE rr.shop_id = v_shop.id AND rr.status = 'open')
    ),
    'plan', (
      SELECT jsonb_build_object('plan_code', o.plan_code, 'trial_ends_at', o.trial_ends_at,
                                'max_barbers', o.max_barbers, 'monthly_message_allowance', o.monthly_message_allowance,
                                'note', o.note, 'updated_at', o.updated_at)
      FROM public.shop_plan_overrides o WHERE o.shop_id = v_shop.id
    ),
    'audit', coalesce((
      SELECT jsonb_agg(row_to_json(a) ORDER BY a.created_at DESC)
      FROM (
        SELECT l.id, l.action, l.reason, l.diff, l.created_at, l.actor_role,
               (SELECT p.full_name FROM public.profiles p WHERE p.id = l.actor_id) AS actor_name
        FROM public.admin_audit_log l
        WHERE (l.target_type IN ('shop', 'plan', 'impersonation') AND l.target_id = v_shop.id::text)
           OR (l.diff ->> 'shop_id') = v_shop.id::text
        ORDER BY l.created_at DESC LIMIT 20
      ) a
    ), '[]'::jsonb)
  );
END;
$$;

-- p_status: open | upheld | dismissed | all
CREATE OR REPLACE FUNCTION public.admin_list_review_reports(
  p_status text DEFAULT 'open',
  p_limit int DEFAULT 25,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text := coalesce(p_status, 'open');
  v_limit  int  := public.admin_clamp(p_limit, 25, 1, 100);
  v_offset int  := public.admin_clamp(p_offset, 0, 0, 100000);
  v_total  bigint;
  v_rows   jsonb;
BEGIN
  PERFORM public.admin_require('support');
  IF v_status NOT IN ('open', 'upheld', 'dismissed', 'all') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'status';
  END IF;

  SELECT count(*) INTO v_total FROM public.review_reports rr WHERE v_status = 'all' OR rr.status = v_status;

  SELECT coalesce(jsonb_agg(x ORDER BY x.created_at), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT rr.id, rr.review_id, rr.reason, rr.details, rr.status, rr.reporter_kind, rr.created_at,
           rr.resolved_at, rr.resolution_note,
           (SELECT p.full_name FROM public.profiles p WHERE p.id = rr.reporter_id) AS reporter_name,
           (SELECT count(*) FROM public.review_reports o WHERE o.review_id = rr.review_id AND o.status = 'open') AS open_on_review,
           jsonb_build_object('id', rv.id, 'rating', rv.rating, 'comment', rv.comment,
                              'reviewer_name', rv.reviewer_name, 'created_at', rv.created_at,
                              'hidden_at', rv.hidden_at, 'hidden_reason', rv.hidden_reason) AS review,
           jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug) AS shop
    FROM public.review_reports rr
    JOIN public.reviews rv ON rv.id = rr.review_id
    JOIN public.shops s ON s.id = rr.shop_id
    WHERE v_status = 'all' OR rr.status = v_status
    ORDER BY rr.created_at
    LIMIT v_limit OFFSET v_offset
  ) x;

  RETURN jsonb_build_object('total', v_total, 'limit', v_limit, 'offset', v_offset, 'rows', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_claims(
  p_status text DEFAULT 'open',
  p_limit int DEFAULT 25,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_status text := coalesce(p_status, 'open');
  v_limit  int  := public.admin_clamp(p_limit, 25, 1, 100);
  v_offset int  := public.admin_clamp(p_offset, 0, 0, 100000);
  v_total  bigint;
  v_rows   jsonb;
BEGIN
  PERFORM public.admin_require('support');
  IF v_status NOT IN ('open', 'upheld', 'rejected', 'withdrawn', 'all') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'status';
  END IF;

  SELECT count(*) INTO v_total FROM public.claim_disputes d WHERE v_status = 'all' OR d.status = v_status;
  SELECT coalesce(jsonb_agg(x ORDER BY x.created_at), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT d.id, d.status, d.claimant_name, public.mask_phone(d.claimant_phone) AS claimant_phone_masked,
           d.details, d.resolution_note, d.resolved_at, d.created_at,
           jsonb_build_object('id', s.id, 'name', s.name, 'slug', s.slug) AS shop
    FROM public.claim_disputes d
    JOIN public.shops s ON s.id = d.shop_id
    WHERE v_status = 'all' OR d.status = v_status
    ORDER BY d.created_at
    LIMIT v_limit OFFSET v_offset
  ) x;

  RETURN jsonb_build_object('total', v_total, 'limit', v_limit, 'offset', v_offset, 'rows', v_rows);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_search_profiles(p_q text, p_limit int DEFAULT 20)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_q      text := NULLIF(btrim(coalesce(p_q, '')), '');
  v_digits text;
  v_limit  int := public.admin_clamp(p_limit, 20, 1, 50);
BEGIN
  PERFORM public.admin_require('support');
  IF v_q IS NULL OR length(v_q) < 2 OR length(v_q) > 100 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'q';
  END IF;
  v_digits := regexp_replace(v_q, '\D', '', 'g');

  RETURN coalesce((
    SELECT jsonb_agg(x)
    FROM (
      SELECT p.id, p.full_name, p.role, p.platform_role, p.banned_at, p.created_at,
             public.mask_phone(p.phone) AS phone_masked,
             (SELECT s.name FROM public.shops s WHERE s.id = p.shop_id) AS shop_name
      FROM public.profiles p
      WHERE p.full_name ILIKE '%' || v_q || '%'
         OR p.id::text = v_q
         OR (length(v_digits) >= 7 AND regexp_replace(coalesce(p.phone, ''), '\D', '', 'g') LIKE '%' || right(v_digits, 9))
      ORDER BY p.banned_at DESC NULLS LAST, p.full_name
      LIMIT v_limit
    ) x
  ), '[]'::jsonb);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_bans(p_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit int := public.admin_clamp(p_limit, 50, 1, 200);
BEGIN
  PERFORM public.admin_require('support');
  RETURN jsonb_build_object(
    'phones', coalesce((
      SELECT jsonb_agg(x ORDER BY x.created_at DESC)
      FROM (SELECT b.phone_key, b.phone_hint, b.reason, b.created_at FROM public.banned_phones b
            ORDER BY b.created_at DESC LIMIT v_limit) x
    ), '[]'::jsonb),
    'profiles', coalesce((
      SELECT jsonb_agg(x ORDER BY x.banned_at DESC)
      FROM (SELECT p.id, p.full_name, p.role, p.banned_at, public.mask_phone(p.phone) AS phone_masked
            FROM public.profiles p WHERE p.banned_at IS NOT NULL
            ORDER BY p.banned_at DESC LIMIT v_limit) x
    ), '[]'::jsonb),
    'shops', coalesce((
      SELECT jsonb_agg(x ORDER BY x.suspended_at DESC)
      FROM (SELECT s.id, s.name, s.slug, s.suspended_at FROM public.shops s WHERE s.suspended_at IS NOT NULL
            ORDER BY s.suspended_at DESC LIMIT v_limit) x
    ), '[]'::jsonb)
  );
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_list_audit(
  p_action text DEFAULT NULL,
  p_target_type text DEFAULT NULL,
  p_target_id text DEFAULT NULL,
  p_limit int DEFAULT 50,
  p_offset int DEFAULT 0
)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_action text := NULLIF(btrim(coalesce(p_action, '')), '');
  v_type   text := NULLIF(btrim(coalesce(p_target_type, '')), '');
  v_target text := NULLIF(btrim(coalesce(p_target_id, '')), '');
  v_limit  int  := public.admin_clamp(p_limit, 50, 1, 200);
  v_offset int  := public.admin_clamp(p_offset, 0, 0, 1000000);
  v_total  bigint;
  v_rows   jsonb;
BEGIN
  PERFORM public.admin_require('support');

  SELECT count(*) INTO v_total
  FROM public.admin_audit_log l
  WHERE (v_action IS NULL OR l.action LIKE v_action || '%')
    AND (v_type IS NULL OR l.target_type = v_type)
    AND (v_target IS NULL OR l.target_id = v_target);

  SELECT coalesce(jsonb_agg(x ORDER BY x.created_at DESC), '[]'::jsonb) INTO v_rows
  FROM (
    SELECT l.id, l.action, l.target_type, l.target_id, l.reason, l.diff, l.impersonation_id,
           l.created_at, l.actor_id, l.actor_role,
           (SELECT p.full_name FROM public.profiles p WHERE p.id = l.actor_id) AS actor_name
    FROM public.admin_audit_log l
    WHERE (v_action IS NULL OR l.action LIKE v_action || '%')
      AND (v_type IS NULL OR l.target_type = v_type)
      AND (v_target IS NULL OR l.target_id = v_target)
    ORDER BY l.created_at DESC
    LIMIT v_limit OFFSET v_offset
  ) x;

  RETURN jsonb_build_object('total', v_total, 'limit', v_limit, 'offset', v_offset, 'rows', v_rows);
END;
$$;

-- ─── 13. Write RPCs (each audited) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.admin_set_shop_verified(p_shop_id uuid, p_verified boolean, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_before boolean;
  v_reason text;
BEGIN
  PERFORM public.admin_require('admin');
  v_reason := public.admin_reason(p_reason, false);
  IF p_verified IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  SELECT is_verified INTO v_before FROM public.shops WHERE id = p_shop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.shops SET is_verified = p_verified WHERE id = p_shop_id;
  PERFORM public.admin_audit(
    CASE WHEN p_verified THEN 'shop.verify' ELSE 'shop.unverify' END, 'shop', p_shop_id::text, v_reason,
    jsonb_build_object('before', jsonb_build_object('is_verified', v_before),
                       'after', jsonb_build_object('is_verified', p_verified)));
  RETURN jsonb_build_object('shop_id', p_shop_id, 'is_verified', p_verified);
END;
$$;

-- Suspending unpublishes the shop and blocks non-staff bookings. Lifting the
-- suspension restores the published flag recorded at suspension time.
CREATE OR REPLACE FUNCTION public.admin_set_shop_suspended(p_shop_id uuid, p_suspended boolean, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shop    public.shops%ROWTYPE;
  v_reason  text := public.admin_reason(p_reason, true);
  v_restore boolean;
BEGIN
  PERFORM public.admin_require('admin');
  IF p_suspended IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_shop FROM public.shops WHERE id = p_shop_id FOR UPDATE;
  IF v_shop.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF p_suspended THEN
    IF v_shop.suspended_at IS NOT NULL THEN
      RAISE EXCEPTION 'NO_CHANGE' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.shops SET suspended_at = now(), is_published = false WHERE id = p_shop_id;
    PERFORM public.admin_audit('shop.suspend', 'shop', p_shop_id::text, v_reason,
      jsonb_build_object('before', jsonb_build_object('suspended_at', NULL, 'is_published', v_shop.is_published),
                         'after', jsonb_build_object('suspended_at', now(), 'is_published', false)));
  ELSE
    IF v_shop.suspended_at IS NULL THEN
      RAISE EXCEPTION 'NO_CHANGE' USING ERRCODE = 'P0001';
    END IF;
    SELECT coalesce((l.diff -> 'before' ->> 'is_published')::boolean, false) INTO v_restore
    FROM public.admin_audit_log l
    WHERE l.action = 'shop.suspend' AND l.target_type = 'shop' AND l.target_id = p_shop_id::text
    ORDER BY l.created_at DESC LIMIT 1;
    v_restore := coalesce(v_restore, false);

    UPDATE public.shops SET suspended_at = NULL, is_published = v_restore WHERE id = p_shop_id;
    PERFORM public.admin_audit('shop.unsuspend', 'shop', p_shop_id::text, v_reason,
      jsonb_build_object('before', jsonb_build_object('suspended_at', v_shop.suspended_at, 'is_published', v_shop.is_published),
                         'after', jsonb_build_object('suspended_at', NULL, 'is_published', v_restore)));
  END IF;

  RETURN jsonb_build_object('shop_id', p_shop_id, 'suspended', p_suspended);
END;
$$;

-- Bans block sign-in (auth.users.banned_until) and revoke live sessions.
CREATE OR REPLACE FUNCTION public.admin_set_profile_banned(p_profile_id uuid, p_banned boolean, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_profile public.profiles%ROWTYPE;
  v_reason  text := public.admin_reason(p_reason, true);
BEGIN
  PERFORM public.admin_require('admin');
  IF p_banned IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_profile FROM public.profiles WHERE id = p_profile_id FOR UPDATE;
  IF v_profile.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF p_banned AND (v_profile.id = auth.uid() OR v_profile.platform_role IS NOT NULL) THEN
    RAISE EXCEPTION 'CANNOT_BAN_STAFF' USING ERRCODE = 'P0001';
  END IF;
  IF (v_profile.banned_at IS NOT NULL) = p_banned THEN
    RAISE EXCEPTION 'NO_CHANGE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.profiles SET banned_at = CASE WHEN p_banned THEN now() ELSE NULL END WHERE id = p_profile_id;
  UPDATE auth.users
     SET banned_until = CASE WHEN p_banned THEN 'infinity'::timestamptz ELSE NULL END
   WHERE id = p_profile_id;
  IF p_banned THEN
    DELETE FROM auth.sessions WHERE user_id = p_profile_id;
  END IF;

  PERFORM public.admin_audit(CASE WHEN p_banned THEN 'profile.ban' ELSE 'profile.unban' END,
    'profile', p_profile_id::text, v_reason,
    jsonb_build_object('before', jsonb_build_object('banned_at', v_profile.banned_at),
                       'after', jsonb_build_object('banned', p_banned),
                       'shop_id', v_profile.shop_id, 'role', v_profile.role));
  RETURN jsonb_build_object('profile_id', p_profile_id, 'banned', p_banned);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_phone_banned(p_phone text, p_banned boolean, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_key    text := public.admin_phone_key(p_phone);
  v_reason text := public.admin_reason(p_reason, true);
  v_hint   text;
BEGIN
  PERFORM public.admin_require('admin');
  IF v_key IS NULL OR p_banned IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'phone';
  END IF;
  -- A bare key (from the ban list) is accepted for unbanning.
  v_hint := coalesce(public.mask_phone(p_phone), '•••' || right(v_key, 3));

  IF p_banned THEN
    INSERT INTO public.banned_phones (phone_key, phone_hint, reason, created_by)
    VALUES (v_key, v_hint, v_reason, auth.uid())
    ON CONFLICT (phone_key) DO NOTHING;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'NO_CHANGE' USING ERRCODE = 'P0001';
    END IF;
  ELSE
    DELETE FROM public.banned_phones WHERE phone_key = v_key;
    IF NOT FOUND THEN
      RAISE EXCEPTION 'NO_CHANGE' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  PERFORM public.admin_audit(CASE WHEN p_banned THEN 'phone.ban' ELSE 'phone.unban' END,
    'phone', v_key, v_reason, jsonb_build_object('phone_hint', v_hint, 'banned', p_banned));
  RETURN jsonb_build_object('phone_key', v_key, 'banned', p_banned);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_set_review_hidden(p_review_id uuid, p_hidden boolean, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_review public.reviews%ROWTYPE;
  v_reason text := public.admin_reason(p_reason, p_hidden);
BEGIN
  PERFORM public.admin_require('support');
  IF p_hidden IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_review FROM public.reviews WHERE id = p_review_id FOR UPDATE;
  IF v_review.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF (v_review.hidden_at IS NOT NULL) = p_hidden THEN
    RAISE EXCEPTION 'NO_CHANGE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.reviews
     SET hidden_at = CASE WHEN p_hidden THEN now() ELSE NULL END,
         hidden_by = CASE WHEN p_hidden THEN auth.uid() ELSE NULL END,
         hidden_reason = CASE WHEN p_hidden THEN v_reason ELSE NULL END
   WHERE id = p_review_id;

  PERFORM public.admin_audit(CASE WHEN p_hidden THEN 'review.hide' ELSE 'review.restore' END,
    'review', p_review_id::text, v_reason,
    jsonb_build_object('shop_id', v_review.shop_id,
                       'before', jsonb_build_object('hidden_at', v_review.hidden_at),
                       'after', jsonb_build_object('hidden', p_hidden)));
  RETURN jsonb_build_object('review_id', p_review_id, 'hidden', p_hidden);
END;
$$;

-- p_decision: 'hide' (uphold every open report on the review and hide it) or
-- 'dismiss' (dismiss every open report on the review; the review stays).
CREATE OR REPLACE FUNCTION public.admin_resolve_review_report(p_report_id uuid, p_decision text, p_note text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_report public.review_reports%ROWTYPE;
  v_note   text := public.admin_reason(p_note, p_decision = 'hide');
  v_status text;
  v_count  int;
BEGIN
  PERFORM public.admin_require('support');
  IF p_decision NOT IN ('hide', 'dismiss') OR p_decision IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'decision';
  END IF;
  SELECT * INTO v_report FROM public.review_reports WHERE id = p_report_id FOR UPDATE;
  IF v_report.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_report.status <> 'open' THEN
    RAISE EXCEPTION 'ALREADY_RESOLVED' USING ERRCODE = 'P0001';
  END IF;

  v_status := CASE WHEN p_decision = 'hide' THEN 'upheld' ELSE 'dismissed' END;
  UPDATE public.review_reports
     SET status = v_status, resolved_by = auth.uid(), resolved_at = now(), resolution_note = v_note
   WHERE review_id = v_report.review_id AND status = 'open';
  GET DIAGNOSTICS v_count = ROW_COUNT;

  IF p_decision = 'hide' THEN
    UPDATE public.reviews
       SET hidden_at = now(), hidden_by = auth.uid(), hidden_reason = v_note
     WHERE id = v_report.review_id AND hidden_at IS NULL;
  END IF;

  PERFORM public.admin_audit('review_report.' || v_status, 'review_report', p_report_id::text, v_note,
    jsonb_build_object('review_id', v_report.review_id, 'shop_id', v_report.shop_id,
                       'reason', v_report.reason, 'reports_resolved', v_count,
                       'review_hidden', p_decision = 'hide'));
  RETURN jsonb_build_object('report_id', p_report_id, 'status', v_status, 'reports_resolved', v_count);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_create_claim_dispute(
  p_shop_id uuid, p_claimant_name text, p_claimant_phone text, p_details text
)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_name    text := NULLIF(btrim(coalesce(p_claimant_name, '')), '');
  v_details text := NULLIF(btrim(coalesce(p_details, '')), '');
  v_phone   text := NULLIF(btrim(coalesce(p_claimant_phone, '')), '');
  v_id      uuid;
BEGIN
  PERFORM public.admin_require('support');
  IF v_name IS NULL OR length(v_name) > 120 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'claimant_name';
  END IF;
  IF v_details IS NULL OR length(v_details) > 2000 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'details';
  END IF;
  IF v_phone IS NOT NULL AND public.admin_phone_key(v_phone) IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'claimant_phone';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.claim_disputes (shop_id, claimant_name, claimant_phone, details, created_by)
  VALUES (p_shop_id, v_name, v_phone, v_details, auth.uid())
  RETURNING id INTO v_id;

  PERFORM public.admin_audit('claim.open', 'claim', v_id::text, NULL,
    jsonb_build_object('shop_id', p_shop_id, 'claimant_name', v_name));
  RETURN jsonb_build_object('id', v_id, 'status', 'open');
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_resolve_claim_dispute(p_id uuid, p_decision text, p_note text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_claim public.claim_disputes%ROWTYPE;
  v_note  text := public.admin_reason(p_note, true);
BEGIN
  PERFORM public.admin_require('admin');
  IF p_decision IS NULL OR p_decision NOT IN ('upheld', 'rejected', 'withdrawn') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'decision';
  END IF;
  SELECT * INTO v_claim FROM public.claim_disputes WHERE id = p_id FOR UPDATE;
  IF v_claim.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_claim.status <> 'open' THEN
    RAISE EXCEPTION 'ALREADY_RESOLVED' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.claim_disputes
     SET status = p_decision, resolution_note = v_note, resolved_by = auth.uid(),
         resolved_at = now(), updated_at = now()
   WHERE id = p_id;

  PERFORM public.admin_audit('claim.' || p_decision, 'claim', p_id::text, v_note,
    jsonb_build_object('shop_id', v_claim.shop_id, 'before', jsonb_build_object('status', v_claim.status),
                       'after', jsonb_build_object('status', p_decision)));
  RETURN jsonb_build_object('id', p_id, 'status', p_decision);
END;
$$;

-- p_plan = null clears the override. Otherwise
-- {plan_code, trial_ends_at?, max_barbers?, monthly_message_allowance?, note?}.
CREATE OR REPLACE FUNCTION public.admin_set_plan_override(p_shop_id uuid, p_plan jsonb, p_reason text)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_reason  text := public.admin_reason(p_reason, true);
  v_before  jsonb;
  v_code    text;
  v_trial   timestamptz;
  v_barbers int;
  v_msgs    int;
  v_note    text;
BEGIN
  PERFORM public.admin_require('admin');
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  SELECT to_jsonb(o) - 'shop_id' - 'created_at' - 'updated_at' - 'updated_by' INTO v_before
  FROM public.shop_plan_overrides o WHERE o.shop_id = p_shop_id FOR UPDATE;

  IF p_plan IS NULL OR jsonb_typeof(p_plan) = 'null' THEN
    IF v_before IS NULL THEN
      RAISE EXCEPTION 'NO_CHANGE' USING ERRCODE = 'P0001';
    END IF;
    DELETE FROM public.shop_plan_overrides WHERE shop_id = p_shop_id;
    PERFORM public.admin_audit('plan.clear', 'plan', p_shop_id::text, v_reason,
      jsonb_build_object('before', v_before, 'after', NULL));
    RETURN jsonb_build_object('shop_id', p_shop_id, 'plan', NULL);
  END IF;

  IF jsonb_typeof(p_plan) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'plan';
  END IF;
  BEGIN
    v_code    := p_plan ->> 'plan_code';
    v_trial   := NULLIF(p_plan ->> 'trial_ends_at', '')::timestamptz;
    v_barbers := NULLIF(p_plan ->> 'max_barbers', '')::int;
    v_msgs    := NULLIF(p_plan ->> 'monthly_message_allowance', '')::int;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'plan';
  END;
  v_note := NULLIF(btrim(coalesce(p_plan ->> 'note', '')), '');
  IF v_code IS NULL OR v_code NOT IN ('trial', 'solo', 'team', 'pro', 'custom') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'plan_code';
  END IF;
  IF v_barbers IS NOT NULL AND (v_barbers < 1 OR v_barbers > 200) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'max_barbers';
  END IF;
  IF v_msgs IS NOT NULL AND (v_msgs < 0 OR v_msgs > 1000000) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'monthly_message_allowance';
  END IF;
  IF v_note IS NOT NULL AND length(v_note) > 500 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'note';
  END IF;
  IF v_code = 'trial' AND v_trial IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'trial_ends_at';
  END IF;

  INSERT INTO public.shop_plan_overrides AS o
    (shop_id, plan_code, trial_ends_at, max_barbers, monthly_message_allowance, note, updated_by)
  VALUES (p_shop_id, v_code, v_trial, v_barbers, v_msgs, v_note, auth.uid())
  ON CONFLICT (shop_id) DO UPDATE
    SET plan_code = EXCLUDED.plan_code, trial_ends_at = EXCLUDED.trial_ends_at,
        max_barbers = EXCLUDED.max_barbers, monthly_message_allowance = EXCLUDED.monthly_message_allowance,
        note = EXCLUDED.note, updated_by = EXCLUDED.updated_by, updated_at = now();

  PERFORM public.admin_audit('plan.set', 'plan', p_shop_id::text, v_reason,
    jsonb_build_object('before', v_before,
                       'after', jsonb_build_object('plan_code', v_code, 'trial_ends_at', v_trial,
                                                   'max_barbers', v_barbers, 'monthly_message_allowance', v_msgs,
                                                   'note', v_note)));
  RETURN jsonb_build_object('shop_id', p_shop_id, 'plan_code', v_code);
END;
$$;

-- ─── 14. Impersonation ("support view") ────────────────────────────────────
-- Read mode is the default and needs no reason. Write mode needs a reason of
-- at least 10 characters. Starting a session ends the actor's previous one;
-- start and stop are both audited.
CREATE OR REPLACE FUNCTION public.admin_start_impersonation(p_shop_id uuid, p_mode text DEFAULT 'read', p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_mode   text := coalesce(p_mode, 'read');
  v_reason text;
  v_prev   record;
  v_id     uuid;
  v_exp    timestamptz;
BEGIN
  PERFORM public.admin_require('support');
  IF v_mode NOT IN ('read', 'write') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'mode';
  END IF;
  v_reason := public.admin_reason(p_reason, v_mode = 'write', 10);
  IF NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  FOR v_prev IN
    SELECT s.id, s.shop_id, s.expires_at FROM public.admin_impersonation_sessions s
    WHERE s.actor_id = v_uid AND s.ended_at IS NULL FOR UPDATE
  LOOP
    UPDATE public.admin_impersonation_sessions
       SET ended_at = least(now(), v_prev.expires_at),
           end_reason = CASE WHEN v_prev.expires_at <= now() THEN 'expired' ELSE 'superseded' END
     WHERE id = v_prev.id;
    PERFORM public.admin_audit('impersonation.stop', 'impersonation', v_prev.shop_id::text, NULL,
      jsonb_build_object('session_id', v_prev.id,
                         'end_reason', CASE WHEN v_prev.expires_at <= now() THEN 'expired' ELSE 'superseded' END),
      v_prev.id);
  END LOOP;

  v_exp := now() + CASE WHEN v_mode = 'write' THEN interval '30 minutes' ELSE interval '60 minutes' END;
  INSERT INTO public.admin_impersonation_sessions (actor_id, shop_id, mode, reason, expires_at)
  VALUES (v_uid, p_shop_id, v_mode, v_reason, v_exp)
  RETURNING id INTO v_id;

  PERFORM public.admin_audit('impersonation.start', 'impersonation', p_shop_id::text, v_reason,
    jsonb_build_object('session_id', v_id, 'mode', v_mode, 'expires_at', v_exp), v_id);
  RETURN jsonb_build_object('id', v_id, 'shop_id', p_shop_id, 'mode', v_mode, 'expires_at', v_exp);
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_stop_impersonation(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_s public.admin_impersonation_sessions%ROWTYPE;
  v_end text;
BEGIN
  PERFORM public.admin_require('support');
  SELECT * INTO v_s FROM public.admin_impersonation_sessions
  WHERE id = p_session_id AND actor_id = auth.uid() FOR UPDATE;
  IF v_s.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_s.ended_at IS NOT NULL THEN
    RAISE EXCEPTION 'NO_CHANGE' USING ERRCODE = 'P0001';
  END IF;

  v_end := CASE WHEN v_s.expires_at <= now() THEN 'expired' ELSE 'stopped' END;
  UPDATE public.admin_impersonation_sessions
     SET ended_at = least(now(), v_s.expires_at), end_reason = v_end
   WHERE id = v_s.id;
  PERFORM public.admin_audit('impersonation.stop', 'impersonation', v_s.shop_id::text, NULL,
    jsonb_build_object('session_id', v_s.id, 'end_reason', v_end,
                       'duration_s', extract(epoch FROM (least(now(), v_s.expires_at) - v_s.started_at))::int),
    v_s.id);
  RETURN jsonb_build_object('id', v_s.id, 'end_reason', v_end);
END;
$$;

-- Internal: the caller's live session, or IMPERSONATION_INACTIVE /
-- IMPERSONATION_READ_ONLY.
CREATE OR REPLACE FUNCTION public.admin_live_session(p_session_id uuid, p_need_write boolean)
RETURNS public.admin_impersonation_sessions
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_s public.admin_impersonation_sessions%ROWTYPE;
BEGIN
  PERFORM public.admin_require('support');
  SELECT * INTO v_s FROM public.admin_impersonation_sessions
  WHERE id = p_session_id AND actor_id = auth.uid();
  IF v_s.id IS NULL OR v_s.ended_at IS NOT NULL OR v_s.expires_at <= now() THEN
    RAISE EXCEPTION 'IMPERSONATION_INACTIVE' USING ERRCODE = 'P0001';
  END IF;
  IF p_need_write AND v_s.mode <> 'write' THEN
    RAISE EXCEPTION 'IMPERSONATION_READ_ONLY' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_s;
END;
$$;

-- What the owner sees, with phones masked: profile, team, services, next
-- 7 days of bookings, 30-day stats and the publish checklist.
CREATE OR REPLACE FUNCTION public.admin_impersonation_snapshot(p_session_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_s    public.admin_impersonation_sessions;
  v_shop public.shops%ROWTYPE;
  v_tz   text;
BEGIN
  v_s := public.admin_live_session(p_session_id, false);
  SELECT * INTO v_shop FROM public.shops WHERE id = v_s.shop_id;
  v_tz := coalesce(v_shop.timezone, 'Asia/Amman');

  RETURN jsonb_build_object(
    'session', jsonb_build_object('id', v_s.id, 'mode', v_s.mode, 'reason', v_s.reason,
                                  'started_at', v_s.started_at, 'expires_at', v_s.expires_at),
    'shop', jsonb_build_object(
      'id', v_shop.id, 'name', v_shop.name, 'name_ar', v_shop.name_ar, 'slug', v_shop.slug,
      'description', v_shop.description, 'description_ar', v_shop.description_ar,
      'address', v_shop.address, 'phone_masked', public.mask_phone(v_shop.phone),
      'is_published', v_shop.is_published, 'marketplace_visible', v_shop.marketplace_visible,
      'is_verified', v_shop.is_verified, 'suspended_at', v_shop.suspended_at,
      'min_notice_minutes', v_shop.min_notice_minutes, 'booking_window_days', v_shop.booking_window_days,
      'timezone', v_tz
    ),
    'team', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', p.id, 'full_name', p.full_name, 'role', p.role,
                                          'online_bookable', p.online_bookable) ORDER BY p.role DESC, p.full_name)
      FROM public.profiles p WHERE p.shop_id = v_shop.id AND p.role IN ('barber', 'shop_admin')
    ), '[]'::jsonb),
    'services', coalesce((
      SELECT jsonb_agg(jsonb_build_object('id', s.id, 'name', s.name, 'name_ar', s.name_ar, 'price', s.price,
                                          'duration', s.duration, 'is_active', s.is_active,
                                          'online_bookable', s.online_bookable)
                       ORDER BY s.sort_order NULLS LAST, s.name)
      FROM public.services s WHERE s.shop_id = v_shop.id
    ), '[]'::jsonb),
    'upcoming', coalesce((
      SELECT jsonb_agg(x ORDER BY x.start_time)
      FROM (
        SELECT a.id, a.start_time, a.end_time, a.status, a.source,
               to_char(a.start_time AT TIME ZONE v_tz, 'YYYY-MM-DD HH24:MI') AS local_start,
               coalesce(a.service_name, '') AS service_name,
               (SELECT p.full_name FROM public.profiles p WHERE p.id = a.barber_id) AS barber_name,
               split_part(btrim(coalesce(a.client_name, c.name, '')), ' ', 1) AS client_first_name,
               public.mask_phone(c.phone) AS client_phone_masked
        FROM public.appointments a
        LEFT JOIN public.clients c ON c.id = a.client_id
        WHERE a.shop_id = v_shop.id
          AND a.start_time >= now() - interval '2 hours'
          AND a.start_time < now() + interval '7 days'
        ORDER BY a.start_time
        LIMIT 100
      ) x
    ), '[]'::jsonb),
    'stats', jsonb_build_object(
      'bookings_30d', (SELECT count(*) FROM public.appointments a WHERE a.shop_id = v_shop.id AND a.created_at > now() - interval '30 days'),
      'completed_30d', (SELECT count(*) FROM public.appointments a WHERE a.shop_id = v_shop.id AND a.status = 'completed' AND a.start_time > now() - interval '30 days'),
      'no_shows_30d', (SELECT count(*) FROM public.appointments a WHERE a.shop_id = v_shop.id AND a.status = 'no_show' AND a.start_time > now() - interval '30 days'),
      'revenue_30d', (SELECT coalesce(sum(sa.paid_total), 0) FROM public.sales sa WHERE sa.shop_id = v_shop.id AND sa.status IN ('paid', 'part_paid') AND sa.created_at > now() - interval '30 days')
    ),
    'publish_missing', coalesce((
      SELECT to_jsonb(array_remove(ARRAY[
        CASE WHEN coalesce(btrim(v_shop.name), '') = '' THEN 'name' END,
        CASE WHEN NOT EXISTS (SELECT 1 FROM public.services s WHERE s.shop_id = v_shop.id AND s.is_active) THEN 'services' END,
        CASE WHEN v_shop.lat IS NULL OR v_shop.lng IS NULL THEN 'location' END
      ], NULL))
    ), '[]'::jsonb)
  );
END;
$$;

-- Whitelisted shop fields an impersonating admin may change in write mode.
CREATE OR REPLACE FUNCTION public.admin_impersonation_update_shop(p_session_id uuid, p_patch jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_s       public.admin_impersonation_sessions;
  v_allowed text[] := ARRAY['name', 'name_ar', 'description', 'description_ar', 'address',
                            'is_published', 'marketplace_visible', 'min_notice_minutes', 'booking_window_days'];
  v_key     text;
  v_before  jsonb;
  v_after   jsonb;
  v_shop    public.shops%ROWTYPE;
BEGIN
  v_s := public.admin_live_session(p_session_id, true);
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' OR p_patch = '{}'::jsonb THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'patch';
  END IF;
  FOR v_key IN SELECT jsonb_object_keys(p_patch) LOOP
    IF NOT v_key = ANY (v_allowed) THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = v_key;
    END IF;
  END LOOP;

  SELECT * INTO v_shop FROM public.shops WHERE id = v_s.shop_id FOR UPDATE;
  IF v_shop.suspended_at IS NOT NULL AND coalesce((p_patch ->> 'is_published')::boolean, false) THEN
    RAISE EXCEPTION 'SHOP_SUSPENDED' USING ERRCODE = 'P0001';
  END IF;
  IF p_patch ? 'name' AND coalesce(btrim(p_patch ->> 'name'), '') = '' THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'name';
  END IF;
  IF (p_patch ? 'is_published' AND jsonb_typeof(p_patch -> 'is_published') <> 'boolean')
     OR (p_patch ? 'marketplace_visible' AND jsonb_typeof(p_patch -> 'marketplace_visible') <> 'boolean')
     OR (p_patch ? 'min_notice_minutes' AND jsonb_typeof(p_patch -> 'min_notice_minutes') <> 'number')
     OR (p_patch ? 'booking_window_days' AND jsonb_typeof(p_patch -> 'booking_window_days') <> 'number') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'type';
  END IF;
  -- Publishing on the owner's behalf still has to pass the publish checklist.
  IF coalesce((p_patch ->> 'is_published')::boolean, false) AND NOT v_shop.is_published
     AND coalesce(array_length(public.shop_publish_missing_internal(v_shop.id), 1), 0) > 0 THEN
    RAISE EXCEPTION 'SHOP_INCOMPLETE' USING ERRCODE = 'P0001';
  END IF;

  SELECT jsonb_object_agg(k, to_jsonb(v_shop) -> k) INTO v_before FROM jsonb_object_keys(p_patch) k;

  UPDATE public.shops SET
    name                = CASE WHEN p_patch ? 'name' THEN left(btrim(p_patch ->> 'name'), 120) ELSE name END,
    name_ar             = CASE WHEN p_patch ? 'name_ar' THEN NULLIF(left(btrim(p_patch ->> 'name_ar'), 120), '') ELSE name_ar END,
    description         = CASE WHEN p_patch ? 'description' THEN NULLIF(left(btrim(p_patch ->> 'description'), 2000), '') ELSE description END,
    description_ar      = CASE WHEN p_patch ? 'description_ar' THEN NULLIF(left(btrim(p_patch ->> 'description_ar'), 2000), '') ELSE description_ar END,
    address             = CASE WHEN p_patch ? 'address' THEN NULLIF(left(btrim(p_patch ->> 'address'), 300), '') ELSE address END,
    is_published        = CASE WHEN p_patch ? 'is_published' THEN (p_patch ->> 'is_published')::boolean ELSE is_published END,
    marketplace_visible = CASE WHEN p_patch ? 'marketplace_visible' THEN (p_patch ->> 'marketplace_visible')::boolean ELSE marketplace_visible END,
    min_notice_minutes  = CASE WHEN p_patch ? 'min_notice_minutes' THEN (p_patch ->> 'min_notice_minutes')::int ELSE min_notice_minutes END,
    booking_window_days = CASE WHEN p_patch ? 'booking_window_days' THEN (p_patch ->> 'booking_window_days')::int ELSE booking_window_days END
  WHERE id = v_shop.id
  RETURNING * INTO v_shop;

  SELECT jsonb_object_agg(k, to_jsonb(v_shop) -> k) INTO v_after FROM jsonb_object_keys(p_patch) k;

  PERFORM public.admin_audit('impersonation.shop_update', 'shop', v_shop.id::text, v_s.reason,
    jsonb_build_object('before', v_before, 'after', v_after, 'session_id', v_s.id), v_s.id);
  RETURN jsonb_build_object('shop_id', v_shop.id, 'after', v_after);
EXCEPTION
  WHEN check_violation OR invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
END;
$$;

CREATE OR REPLACE FUNCTION public.admin_impersonation_set_service_active(p_session_id uuid, p_service_id uuid, p_active boolean)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_s      public.admin_impersonation_sessions;
  v_before boolean;
BEGIN
  v_s := public.admin_live_session(p_session_id, true);
  IF p_active IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  SELECT is_active INTO v_before FROM public.services
  WHERE id = p_service_id AND shop_id = v_s.shop_id FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_before = p_active THEN
    RAISE EXCEPTION 'NO_CHANGE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.services SET is_active = p_active WHERE id = p_service_id;
  PERFORM public.admin_audit('impersonation.service_update', 'service', p_service_id::text, v_s.reason,
    jsonb_build_object('shop_id', v_s.shop_id, 'session_id', v_s.id,
                       'before', jsonb_build_object('is_active', v_before),
                       'after', jsonb_build_object('is_active', p_active)), v_s.id);
  RETURN jsonb_build_object('service_id', p_service_id, 'is_active', p_active);
END;
$$;

-- Publish checklist for platform callers (shop_publish_missing() only admits
-- shop staff and platform *admins*; support staff need it too).
CREATE OR REPLACE FUNCTION public.shop_publish_missing_internal(p_shop_id uuid)
RETURNS text[]
LANGUAGE plpgsql STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_missing text[] := '{}';
  v_shop    public.shops%ROWTYPE;
BEGIN
  SELECT * INTO v_shop FROM public.shops WHERE id = p_shop_id;
  IF v_shop.id IS NULL THEN
    RETURN ARRAY['name'];
  END IF;
  IF coalesce(btrim(v_shop.name), '') = '' THEN v_missing := v_missing || 'name'; END IF;
  IF NOT EXISTS (SELECT 1 FROM public.services s WHERE s.shop_id = p_shop_id AND s.is_active) THEN
    v_missing := v_missing || 'services';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.working_hours w WHERE w.shop_id = p_shop_id) THEN
    v_missing := v_missing || 'hours';
  END IF;
  IF v_shop.lat IS NULL OR v_shop.lng IS NULL THEN
    v_missing := v_missing || 'location';
  END IF;
  RETURN v_missing;
END;
$$;

-- ─── 15. Reporting a review (customers and shop staff; 2B wires the UI) ────
CREATE OR REPLACE FUNCTION public.report_review(p_review_id uuid, p_reason text, p_details text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_review  public.reviews%ROWTYPE;
  v_kind    text;
  v_details text := NULLIF(left(btrim(coalesce(p_details, '')), 1000), '');
  v_id      uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  IF p_reason IS NULL OR p_reason NOT IN ('spam', 'offensive', 'fake', 'conflict_of_interest', 'privacy', 'other') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'reason';
  END IF;
  IF p_reason = 'other' AND v_details IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'details';
  END IF;
  IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_uid AND p.banned_at IS NOT NULL) THEN
    RAISE EXCEPTION 'ACCOUNT_BANNED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.check_rate_limit('review_report:' || v_uid::text, 10, 3600) THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_review FROM public.reviews WHERE id = p_review_id;
  IF v_review.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  v_kind := CASE
    WHEN public.is_platform_staff() THEN 'platform'
    WHEN public.is_staff_of_shop(v_review.shop_id) THEN 'shop_staff'
    ELSE 'customer'
  END;

  INSERT INTO public.review_reports (review_id, shop_id, reporter_id, reporter_kind, reason, details)
  VALUES (v_review.id, v_review.shop_id, v_uid, v_kind, p_reason, v_details)
  ON CONFLICT (review_id, reporter_id) WHERE status = 'open' AND reporter_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;

  IF v_id IS NULL THEN
    RAISE EXCEPTION 'ALREADY_REPORTED' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_id;
END;
$$;

-- ─── 16. Grants ────────────────────────────────────────────────────────────
DO $$
DECLARE
  f text;
BEGIN
  -- Internal helpers: never callable by clients.
  FOREACH f IN ARRAY ARRAY[
    'public.admin_guard_platform_columns()', 'public.admin_audit_log_immutable()',
    'public.admin_guard_appointment_insert()',
    'public.admin_require(text)', 'public.admin_reason(text, boolean, integer)',
    'public.admin_audit(text, text, text, text, jsonb, uuid)', 'public.admin_clamp(integer, integer, integer, integer)',
    'public.admin_live_session(uuid, boolean)', 'public.admin_phone_key(text)',
    'public.is_phone_banned(text)', 'public.shop_publish_missing_internal(uuid)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;

  -- Admin RPCs: authenticated (each checks platform_role itself) + service_role.
  FOREACH f IN ARRAY ARRAY[
    'public.admin_whoami()', 'public.admin_overview()',
    'public.admin_list_shops(text, text, uuid, integer, integer)', 'public.admin_get_shop(uuid)',
    'public.admin_list_review_reports(text, integer, integer)', 'public.admin_list_claims(text, integer, integer)',
    'public.admin_search_profiles(text, integer)', 'public.admin_list_bans(integer)',
    'public.admin_list_audit(text, text, text, integer, integer)',
    'public.admin_set_shop_verified(uuid, boolean, text)', 'public.admin_set_shop_suspended(uuid, boolean, text)',
    'public.admin_set_profile_banned(uuid, boolean, text)', 'public.admin_set_phone_banned(text, boolean, text)',
    'public.admin_set_review_hidden(uuid, boolean, text)', 'public.admin_resolve_review_report(uuid, text, text)',
    'public.admin_create_claim_dispute(uuid, text, text, text)', 'public.admin_resolve_claim_dispute(uuid, text, text)',
    'public.admin_set_plan_override(uuid, jsonb, text)',
    'public.admin_start_impersonation(uuid, text, text)', 'public.admin_stop_impersonation(uuid)',
    'public.admin_impersonation_snapshot(uuid)', 'public.admin_impersonation_update_shop(uuid, jsonb)',
    'public.admin_impersonation_set_service_active(uuid, uuid, boolean)',
    'public.report_review(uuid, text, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon', f);
    EXECUTE format('GRANT EXECUTE ON FUNCTION %s TO authenticated, service_role', f);
  END LOOP;
END $$;

GRANT EXECUTE ON FUNCTION public.is_phone_banned(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.admin_phone_key(text) TO service_role;
