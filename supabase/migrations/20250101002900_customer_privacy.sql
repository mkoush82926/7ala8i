-- ═══════════════════════════════════════════════════════════════════════════
-- WS-1J · Customer phone login, account hub and privacy (PDPL, Law No. 24 of 2023)
--
--   1. profiles: preferred_language + notification preferences (private columns:
--      no new column SELECT grants for anon/authenticated; read via get_my_account).
--   2. client_profile_links: one row per clients row owned by a customer account
--      (mirrors clients.auth_user_id, kept in sync by trigger, backfilled).
--   3. customer_verified_phones: phones a customer proved by OTP. Linking keeps
--      working on later logins (verified_identity() only proves the FIRST
--      confirmation), so a guest booking made at any time attaches after OTP.
--   4. consent_records: append-only consent history (terms, privacy, reminders,
--      marketing per channel).
--   5. RPCs: claim_customer_identity, get_my_account, update_my_account,
--      record_consent, export_my_data, delete_my_account (authenticated) and
--      customer_phone_login_resolve, customer_attach_verified_phone (service_role,
--      used by the self-hosted OTP login).
--
-- Idempotent and safe on production data: new columns have defaults or are
-- nullable, CHECKs only constrain the new columns, RLS on every new table.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. profiles: language + notification preferences ─────────────────────
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS preferred_language text;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_reminders boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS notify_channel text NOT NULL DEFAULT 'whatsapp';
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS marketing_opt_in boolean NOT NULL DEFAULT false;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_preferred_language_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_preferred_language_check
      CHECK (preferred_language IS NULL OR preferred_language IN ('en', 'ar'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_notify_channel_check') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_notify_channel_check
      CHECK (notify_channel IN ('whatsapp', 'sms', 'email'));
  END IF;
END $$;

-- ─── Helpers (internal) ─────────────────────────────────────────────────────
-- National key: the last 9 digits (07X… and 9627X… agree). NULL when too short.
CREATE OR REPLACE FUNCTION public.privacy_phone_key(p_phone text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN length(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g')) >= 9
              THEN right(regexp_replace(p_phone, '\D', '', 'g'), 9) END;
$$;

-- Accounts created by the self-hosted phone login carry a placeholder address
-- in a reserved TLD; it is never shown or exported as the person's email.
CREATE OR REPLACE FUNCTION public.privacy_is_synthetic_email(p_email text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(lower(p_email) LIKE '%@phone.halaqy.invalid', false);
$$;

REVOKE ALL ON FUNCTION public.privacy_phone_key(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.privacy_is_synthetic_email(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_phone_key(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.privacy_is_synthetic_email(text) TO service_role;

-- Fast lookup of unlinked guest rows by phone key.
CREATE INDEX IF NOT EXISTS idx_clients_unlinked_phone_key
  ON public.clients (right(phone_digits, 9))
  WHERE auth_user_id IS NULL AND deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_clients_auth_user_id ON public.clients (auth_user_id) WHERE auth_user_id IS NOT NULL;

-- ─── 2. client_profile_links ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.client_profile_links (
  client_id  uuid PRIMARY KEY REFERENCES public.clients(id) ON DELETE CASCADE,
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_id    uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  method     text NOT NULL DEFAULT 'booking'
             CHECK (method IN ('legacy', 'booking', 'phone_otp', 'email', 'manual')),
  linked_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_client_profile_links_profile ON public.client_profile_links (profile_id);
ALTER TABLE public.client_profile_links ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.client_profile_links FROM anon, authenticated;
GRANT SELECT ON public.client_profile_links TO authenticated;
GRANT ALL ON public.client_profile_links TO service_role;
DROP POLICY IF EXISTS client_profile_links_select_own ON public.client_profile_links;
CREATE POLICY client_profile_links_select_own ON public.client_profile_links
  FOR SELECT TO authenticated USING (profile_id = auth.uid());

-- Mirrors clients.auth_user_id (written by bookings, link RPCs or staff tools).
CREATE OR REPLACE FUNCTION public.sync_client_profile_link()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_method text := COALESCE(NULLIF(current_setting('halaqy.link_method', true), ''), 'booking');
BEGIN
  IF TG_OP = 'UPDATE' AND NEW.auth_user_id IS NOT DISTINCT FROM OLD.auth_user_id THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'UPDATE' THEN
    DELETE FROM public.client_profile_links WHERE client_id = NEW.id;
  END IF;
  IF NEW.auth_user_id IS NOT NULL THEN
    IF v_method NOT IN ('legacy', 'booking', 'phone_otp', 'email', 'manual') THEN
      v_method := 'booking';
    END IF;
    INSERT INTO public.client_profile_links (client_id, profile_id, shop_id, method)
    SELECT NEW.id, p.id, NEW.shop_id, v_method
    FROM public.profiles p WHERE p.id = NEW.auth_user_id
    ON CONFLICT (client_id) DO UPDATE
      SET profile_id = EXCLUDED.profile_id, shop_id = EXCLUDED.shop_id,
          method = EXCLUDED.method, linked_at = now();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.sync_client_profile_link() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS clients_sync_profile_link ON public.clients;
CREATE TRIGGER clients_sync_profile_link
  AFTER INSERT OR UPDATE OF auth_user_id ON public.clients
  FOR EACH ROW EXECUTE FUNCTION public.sync_client_profile_link();

INSERT INTO public.client_profile_links (client_id, profile_id, shop_id, method, linked_at)
SELECT c.id, c.auth_user_id, c.shop_id, 'legacy', COALESCE(c.updated_at, c.created_at, now())
FROM public.clients c
JOIN public.profiles p ON p.id = c.auth_user_id
WHERE c.auth_user_id IS NOT NULL
ON CONFLICT (client_id) DO NOTHING;

-- ─── 3. customer_verified_phones ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.customer_verified_phones (
  phone_key   text PRIMARY KEY CHECK (phone_key ~ '^\d{9}$'),
  profile_id  uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  phone       text NOT NULL CHECK (phone ~ '^\d{9,15}$'),
  method      text NOT NULL DEFAULT 'supabase_otp'
              CHECK (method IN ('supabase_otp', 'hook_otp', 'phone_change', 'legacy')),
  verified_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_customer_verified_phones_profile ON public.customer_verified_phones (profile_id);
ALTER TABLE public.customer_verified_phones ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.customer_verified_phones FROM anon, authenticated;
GRANT SELECT ON public.customer_verified_phones TO authenticated;
GRANT ALL ON public.customer_verified_phones TO service_role;
DROP POLICY IF EXISTS customer_verified_phones_select_own ON public.customer_verified_phones;
CREATE POLICY customer_verified_phones_select_own ON public.customer_verified_phones
  FOR SELECT TO authenticated USING (profile_id = auth.uid());

-- Backfill: customers whose phone was already proved by Supabase OTP.
INSERT INTO public.customer_verified_phones (phone_key, profile_id, phone, method)
SELECT DISTINCT ON (public.privacy_phone_key(v.phone_digits))
       public.privacy_phone_key(v.phone_digits), p.id, left(v.phone_digits, 15), 'legacy'
FROM public.profiles p
CROSS JOIN LATERAL public.verified_identity(p.id) v
WHERE p.role = 'customer'
  AND public.privacy_phone_key(v.phone_digits) IS NOT NULL
  AND length(v.phone_digits) BETWEEN 9 AND 15
ORDER BY public.privacy_phone_key(v.phone_digits), p.created_at
ON CONFLICT (phone_key) DO NOTHING;

-- ─── 4. consent_records (append-only) ───────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.consent_records (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  purpose        text NOT NULL CHECK (purpose IN ('terms', 'privacy', 'reminders', 'marketing')),
  channel        text CHECK (channel IS NULL OR channel IN ('whatsapp', 'sms', 'email')),
  granted        boolean NOT NULL,
  source         text NOT NULL CHECK (source IN ('signup', 'phone_login', 'account', 'booking', 'system')),
  policy_version text CHECK (policy_version IS NULL OR length(policy_version) <= 32),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_consent_records_profile ON public.consent_records (profile_id, purpose, created_at DESC);
ALTER TABLE public.consent_records ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.consent_records FROM anon, authenticated;
GRANT SELECT ON public.consent_records TO authenticated;
GRANT ALL ON public.consent_records TO service_role;
DROP POLICY IF EXISTS consent_records_select_own ON public.consent_records;
CREATE POLICY consent_records_select_own ON public.consent_records
  FOR SELECT TO authenticated USING (profile_id = auth.uid());

-- ─── 5. Internal: link clients to a profile from its verified identity ──────
CREATE OR REPLACE FUNCTION public.privacy_link_clients(p_profile_id uuid, p_method text DEFAULT 'phone_otp')
RETURNS integer
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_email text;
  v_count integer := 0;
  v_n     integer;
BEGIN
  IF p_profile_id IS NULL THEN RETURN 0; END IF;
  PERFORM set_config('halaqy.link_method', COALESCE(p_method, 'phone_otp'), true);

  UPDATE public.clients c SET auth_user_id = p_profile_id
  WHERE c.auth_user_id IS NULL AND c.deleted_at IS NULL
    AND right(c.phone_digits, 9) IN (SELECT vp.phone_key FROM public.customer_verified_phones vp
                                     WHERE vp.profile_id = p_profile_id)
    AND length(c.phone_digits) >= 9;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  v_count := v_count + v_n;

  SELECT v.email INTO v_email FROM public.verified_identity(p_profile_id) v;
  IF COALESCE(v_email, '') <> '' AND NOT public.privacy_is_synthetic_email(v_email) THEN
    PERFORM set_config('halaqy.link_method', 'email', true);
    UPDATE public.clients c SET auth_user_id = p_profile_id
    WHERE c.auth_user_id IS NULL AND c.deleted_at IS NULL AND lower(c.email) = v_email;
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_count := v_count + v_n;
  END IF;

  PERFORM set_config('halaqy.link_method', '', true);
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.privacy_link_clients(uuid, text) FROM PUBLIC, anon, authenticated;

-- Internal: record a verified phone for a profile (latest verifier owns the number).
CREATE OR REPLACE FUNCTION public.privacy_store_verified_phone(p_profile_id uuid, p_phone text, p_method text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_digits text := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_key    text;
BEGIN
  IF v_digits LIKE '00%' THEN v_digits := substr(v_digits, 3); END IF;
  IF length(v_digits) = 10 AND v_digits LIKE '07%' THEN v_digits := '962' || substr(v_digits, 2); END IF;
  IF length(v_digits) = 9 AND v_digits LIKE '7%' THEN v_digits := '962' || v_digits; END IF;
  IF length(v_digits) < 9 OR length(v_digits) > 15 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'phone';
  END IF;
  v_key := right(v_digits, 9);
  INSERT INTO public.customer_verified_phones (phone_key, profile_id, phone, method, verified_at)
  VALUES (v_key, p_profile_id, v_digits, COALESCE(p_method, 'supabase_otp'), now())
  ON CONFLICT (phone_key) DO UPDATE
    SET profile_id = EXCLUDED.profile_id, phone = EXCLUDED.phone,
        method = EXCLUDED.method, verified_at = now();
  -- Contact phone on the profile, only when the customer has none yet.
  UPDATE public.profiles SET phone = '+' || v_digits
  WHERE id = p_profile_id AND NULLIF(trim(COALESCE(phone, '')), '') IS NULL;
  RETURN v_key;
END;
$$;
REVOKE ALL ON FUNCTION public.privacy_store_verified_phone(uuid, text, text) FROM PUBLIC, anon, authenticated;

-- ─── 6. claim_customer_identity (authenticated) ─────────────────────────────
-- Run after every sign-in and on the account hub. Records the Supabase-verified
-- phone (first confirmation or a phone change) and links every unlinked
-- clients row (any shop) with a verified phone or verified email.
CREATE OR REPLACE FUNCTION public.claim_customer_identity()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_role   text;
  v_phone  text;
  v_method text := 'supabase_otp';
  v_linked integer := 0;
  v_total  integer;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'customer' THEN
    RETURN jsonb_build_object('linked', 0, 'total', 0, 'phone_verified', false, 'eligible', false);
  END IF;
  IF NOT public.check_rate_limit('claim:' || v_uid::text, 30, 300) THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  SELECT v.phone_digits INTO v_phone FROM public.verified_identity(v_uid) v;
  IF length(COALESCE(v_phone, '')) BETWEEN 9 AND 15 THEN
    IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_uid AND u.phone_change_sent_at IS NOT NULL
                 AND u.phone_confirmed_at >= u.phone_change_sent_at) THEN
      v_method := 'phone_change';
    END IF;
    -- Only (re)claim when nobody else holds it, or it is already ours.
    IF NOT EXISTS (SELECT 1 FROM public.customer_verified_phones vp
                   WHERE vp.phone_key = right(v_phone, 9) AND vp.profile_id <> v_uid) THEN
      PERFORM public.privacy_store_verified_phone(v_uid, v_phone, v_method);
    END IF;
  END IF;

  v_linked := public.privacy_link_clients(v_uid, 'phone_otp');
  SELECT count(*) INTO v_total FROM public.client_profile_links WHERE profile_id = v_uid;

  RETURN jsonb_build_object(
    'linked', v_linked,
    'total', v_total,
    'phone_verified', EXISTS (SELECT 1 FROM public.customer_verified_phones WHERE profile_id = v_uid),
    'eligible', true
  );
END;
$$;
REVOKE ALL ON FUNCTION public.claim_customer_identity() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.claim_customer_identity() TO authenticated, service_role;

-- Legacy entry point keeps working and now also uses verified phones.
CREATE OR REPLACE FUNCTION public.link_customer_client()
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

  SELECT v.email, v.phone_digits INTO v_email, v_phone
  FROM public.verified_identity(v_uid) v;

  IF COALESCE(v_email, '') <> '' OR COALESCE(v_phone, '') <> '' THEN
    UPDATE public.clients c SET auth_user_id = v_uid
    WHERE c.auth_user_id IS NULL AND c.deleted_at IS NULL
      AND ((COALESCE(v_email, '') <> '' AND NOT public.privacy_is_synthetic_email(v_email) AND lower(c.email) = v_email)
        OR (length(COALESCE(v_phone, '')) >= 7 AND c.phone_digits = v_phone));
  END IF;
  PERFORM public.privacy_link_clients(v_uid, 'phone_otp');

  SELECT c.id INTO v_id FROM public.clients c
  WHERE c.auth_user_id = v_uid ORDER BY c.created_at DESC LIMIT 1;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.link_customer_client() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.link_customer_client() TO authenticated;

-- ─── 7. Self-hosted OTP login (service_role only) ───────────────────────────
-- Consumes a token from otp_verify() and returns the account that owns the
-- phone (or nulls when a new account must be created). Raises OTP_INVALID.
CREATE OR REPLACE FUNCTION public.customer_phone_login_resolve(p_token text, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_digits text := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_key    text;
  v_ver    uuid;
  v_uid    uuid;
  v_email  text;
  v_role   text;
BEGIN
  IF v_digits LIKE '00%' THEN v_digits := substr(v_digits, 3); END IF;
  IF length(v_digits) = 10 AND v_digits LIKE '07%' THEN v_digits := '962' || substr(v_digits, 2); END IF;
  IF length(v_digits) = 9 AND v_digits LIKE '7%' THEN v_digits := '962' || v_digits; END IF;
  IF length(v_digits) < 9 OR length(v_digits) > 15 OR NULLIF(trim(COALESCE(p_token, '')), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  v_key := right(v_digits, 9);

  UPDATE public.phone_verifications pv SET consumed_at = now()
  WHERE pv.id = (SELECT x.id FROM public.phone_verifications x
                 WHERE x.token_hash = encode(extensions.digest(trim(p_token), 'sha256'), 'hex')
                   AND x.phone_key = public.otp_phone_key(v_digits)
                   AND x.verified_at > now() - interval '30 minutes'
                   AND x.consumed_at IS NULL
                 LIMIT 1 FOR UPDATE)
  RETURNING pv.id INTO v_ver;
  IF v_ver IS NULL THEN
    RAISE EXCEPTION 'OTP_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT vp.profile_id INTO v_uid FROM public.customer_verified_phones vp WHERE vp.phone_key = v_key;
  IF v_uid IS NULL THEN
    SELECT u.id INTO v_uid FROM auth.users u
    WHERE u.phone_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
      AND right(regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g'), 9) = v_key
    ORDER BY u.created_at LIMIT 1;
  END IF;
  IF v_uid IS NULL THEN
    -- A phone-login account whose earlier attach step did not finish.
    SELECT u.id INTO v_uid FROM auth.users u
    WHERE lower(u.email) = 'p' || v_digits || '@phone.halaqy.invalid' AND u.deleted_at IS NULL
    LIMIT 1;
  END IF;
  IF v_uid IS NOT NULL THEN
    SELECT u.email INTO v_email FROM auth.users u WHERE u.id = v_uid;
    SELECT p.role INTO v_role FROM public.profiles p WHERE p.id = v_uid;
  END IF;

  RETURN jsonb_build_object('user_id', v_uid, 'email', NULLIF(v_email, ''), 'role', v_role, 'phone_key', v_key);
END;
$$;
REVOKE ALL ON FUNCTION public.customer_phone_login_resolve(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_phone_login_resolve(text, text) TO service_role;

CREATE OR REPLACE FUNCTION public.customer_attach_verified_phone(p_profile_id uuid, p_phone text, p_method text DEFAULT 'hook_otp')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_role   text;
  v_linked integer;
BEGIN
  SELECT role INTO v_role FROM public.profiles WHERE id = p_profile_id;
  IF v_role IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_role <> 'customer' THEN
    RAISE EXCEPTION 'NOT_CUSTOMER' USING ERRCODE = 'P0001';
  END IF;
  IF p_method NOT IN ('hook_otp', 'supabase_otp', 'phone_change') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'method';
  END IF;
  PERFORM public.privacy_store_verified_phone(p_profile_id, p_phone, p_method);
  v_linked := public.privacy_link_clients(p_profile_id, 'phone_otp');
  RETURN jsonb_build_object('linked', v_linked,
    'total', (SELECT count(*) FROM public.client_profile_links WHERE profile_id = p_profile_id));
END;
$$;
REVOKE ALL ON FUNCTION public.customer_attach_verified_phone(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.customer_attach_verified_phone(uuid, text, text) TO service_role;

-- ─── 8. Consent ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_consent(
  p_purpose text, p_granted boolean, p_source text DEFAULT 'account',
  p_channel text DEFAULT NULL, p_policy_version text DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_id  uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  IF p_purpose IS NULL OR p_purpose NOT IN ('terms', 'privacy', 'reminders', 'marketing')
     OR p_granted IS NULL
     OR COALESCE(p_source, '') NOT IN ('signup', 'phone_login', 'account', 'booking')
     OR (p_channel IS NOT NULL AND p_channel NOT IN ('whatsapp', 'sms', 'email'))
     OR length(COALESCE(p_policy_version, '')) > 32 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.check_rate_limit('consent:' || v_uid::text, 60, 600) THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.consent_records (profile_id, purpose, channel, granted, source, policy_version)
  VALUES (v_uid, p_purpose, p_channel, p_granted, p_source, NULLIF(trim(COALESCE(p_policy_version, '')), ''))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.record_consent(text, boolean, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.record_consent(text, boolean, text, text, text) TO authenticated, service_role;

-- ─── 9. Account hub ─────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.get_my_account()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_out jsonb;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  SELECT jsonb_build_object(
    'id', p.id,
    'role', p.role,
    'full_name', p.full_name,
    'phone', p.phone,
    'email', CASE WHEN public.privacy_is_synthetic_email(u.email) THEN NULL ELSE NULLIF(u.email, '') END,
    'auth_phone', NULLIF(u.phone, ''),
    'created_at', p.created_at,
    'preferred_language', p.preferred_language,
    'digit_preference', p.digit_preference,
    'notify_reminders', p.notify_reminders,
    'notify_channel', p.notify_channel,
    'marketing_opt_in', p.marketing_opt_in,
    'verified_phones', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('phone', vp.phone, 'method', vp.method, 'verified_at', vp.verified_at)
                       ORDER BY vp.verified_at DESC)
      FROM public.customer_verified_phones vp WHERE vp.profile_id = p.id), '[]'::jsonb),
    'linked_shops', COALESCE((
      SELECT jsonb_agg(x ORDER BY x->>'linked_at' DESC) FROM (
        SELECT jsonb_build_object(
          'shop_id', s.id, 'shop_name', s.name, 'shop_name_ar', s.name_ar, 'slug', s.slug,
          'linked_at', min(l.linked_at),
          'visits', (SELECT count(*) FROM public.appointments a
                     WHERE a.client_id IN (SELECT l2.client_id FROM public.client_profile_links l2
                                           WHERE l2.profile_id = p.id AND l2.shop_id = s.id)
                       AND a.status = 'completed')) AS x
        FROM public.client_profile_links l
        JOIN public.shops s ON s.id = l.shop_id
        WHERE l.profile_id = p.id
        GROUP BY s.id, s.name, s.name_ar, s.slug) q), '[]'::jsonb),
    'consents', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('purpose', c.purpose, 'channel', c.channel, 'granted', c.granted,
                                          'source', c.source, 'policy_version', c.policy_version,
                                          'created_at', c.created_at) ORDER BY c.created_at DESC)
      FROM (SELECT * FROM public.consent_records cr WHERE cr.profile_id = p.id
            ORDER BY cr.created_at DESC LIMIT 50) c), '[]'::jsonb)
  ) INTO v_out
  FROM public.profiles p
  LEFT JOIN auth.users u ON u.id = p.id
  WHERE p.id = v_uid;

  IF v_out IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.get_my_account() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.get_my_account() TO authenticated, service_role;

-- Patch keys: full_name, phone, preferred_language, digit_preference,
-- notify_reminders, notify_channel, marketing_opt_in. Unknown keys are ignored.
-- Reminder / marketing changes are written to consent_records.
CREATE OR REPLACE FUNCTION public.update_my_account(p_patch jsonb, p_source text DEFAULT 'account')
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_old    public.profiles%ROWTYPE;
  v_name   text;
  v_phone  text;
  v_lang   text;
  v_digits text;
  v_rem    boolean;
  v_chan   text;
  v_mkt    boolean;
  v_source text := CASE WHEN p_source IN ('signup', 'phone_login', 'account', 'booking') THEN p_source ELSE 'account' END;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  IF p_patch IS NULL OR jsonb_typeof(p_patch) <> 'object' THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.check_rate_limit('account:' || v_uid::text, 60, 600) THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_old FROM public.profiles WHERE id = v_uid FOR UPDATE;
  IF v_old.id IS NULL THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  v_name := v_old.full_name;
  IF p_patch ? 'full_name' THEN
    v_name := regexp_replace(trim(COALESCE(p_patch->>'full_name', '')), '\s+', ' ', 'g');
    IF length(v_name) < 2 OR length(v_name) > 80 THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'full_name';
    END IF;
  END IF;

  v_phone := v_old.phone;
  IF p_patch ? 'phone' THEN
    v_phone := NULLIF(trim(COALESCE(p_patch->>'phone', '')), '');
    IF v_phone IS NOT NULL AND (v_phone !~ '^\+?[0-9\s\-().]+$'
        OR length(regexp_replace(v_phone, '\D', '', 'g')) NOT BETWEEN 7 AND 15) THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'phone';
    END IF;
  END IF;

  v_lang := v_old.preferred_language;
  IF p_patch ? 'preferred_language' THEN
    v_lang := NULLIF(p_patch->>'preferred_language', '');
    IF v_lang IS NOT NULL AND v_lang NOT IN ('en', 'ar') THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'preferred_language';
    END IF;
  END IF;

  v_digits := v_old.digit_preference;
  IF p_patch ? 'digit_preference' THEN
    v_digits := COALESCE(p_patch->>'digit_preference', '');
    IF v_digits NOT IN ('auto', 'arab', 'latn') THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'digit_preference';
    END IF;
  END IF;

  v_rem := v_old.notify_reminders;
  IF p_patch ? 'notify_reminders' THEN
    IF jsonb_typeof(p_patch->'notify_reminders') <> 'boolean' THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'notify_reminders';
    END IF;
    v_rem := (p_patch->>'notify_reminders')::boolean;
  END IF;

  v_chan := v_old.notify_channel;
  IF p_patch ? 'notify_channel' THEN
    v_chan := COALESCE(p_patch->>'notify_channel', '');
    IF v_chan NOT IN ('whatsapp', 'sms', 'email') THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'notify_channel';
    END IF;
  END IF;

  v_mkt := v_old.marketing_opt_in;
  IF p_patch ? 'marketing_opt_in' THEN
    IF jsonb_typeof(p_patch->'marketing_opt_in') <> 'boolean' THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'marketing_opt_in';
    END IF;
    v_mkt := (p_patch->>'marketing_opt_in')::boolean;
  END IF;

  UPDATE public.profiles SET
    full_name = v_name, phone = v_phone, preferred_language = v_lang, digit_preference = v_digits,
    notify_reminders = v_rem, notify_channel = v_chan, marketing_opt_in = v_mkt
  WHERE id = v_uid;

  IF v_rem IS DISTINCT FROM v_old.notify_reminders OR (v_rem AND v_chan IS DISTINCT FROM v_old.notify_channel) THEN
    INSERT INTO public.consent_records (profile_id, purpose, channel, granted, source)
    VALUES (v_uid, 'reminders', v_chan, v_rem, v_source);
  END IF;
  IF v_mkt IS DISTINCT FROM v_old.marketing_opt_in OR (v_mkt AND v_chan IS DISTINCT FROM v_old.notify_channel) THEN
    INSERT INTO public.consent_records (profile_id, purpose, channel, granted, source)
    VALUES (v_uid, 'marketing', v_chan, v_mkt, v_source);
  END IF;

  RETURN public.get_my_account();
END;
$$;
REVOKE ALL ON FUNCTION public.update_my_account(jsonb, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.update_my_account(jsonb, text) TO authenticated, service_role;

-- Internal: national phone keys (last 9 digits) of the caller's verified
-- phones and of the shops' client rows linked to the account.
CREATE OR REPLACE FUNCTION public.privacy_my_phone_keys(p_profile_id uuid, p_clients uuid[])
RETURNS text[]
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(array_agg(DISTINCT k) FILTER (WHERE k IS NOT NULL), '{}')
  FROM (
    SELECT vp.phone_key AS k FROM public.customer_verified_phones vp WHERE vp.profile_id = p_profile_id
    UNION ALL
    SELECT public.privacy_phone_key(c.phone) FROM public.clients c WHERE c.id = ANY(COALESCE(p_clients, '{}'))
  ) x;
$$;
REVOKE ALL ON FUNCTION public.privacy_my_phone_keys(uuid, uuid[]) FROM PUBLIC, anon, authenticated;

-- ─── 10. Export (PDPL right of access) ──────────────────────────────────────
-- Every row tied to the caller: account, profile, verified phones, consents,
-- client links, client rows (all shops), appointments + lines + attribution,
-- reviews, payments, sales + lines + payments, leads, notifications and, when
-- WS-1C is installed, message_outbox / marketing_consents rows.
CREATE OR REPLACE FUNCTION public.export_my_data()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_clients uuid[];
  v_appts   uuid[];
  v_sales   uuid[];
  v_out     jsonb;
  v_extra   jsonb;
  v_where   text;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.check_rate_limit('export:' || v_uid::text, 10, 3600) THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  SELECT COALESCE(array_agg(c.id), '{}') INTO v_clients FROM public.clients c WHERE c.auth_user_id = v_uid;
  SELECT COALESCE(array_agg(a.id), '{}') INTO v_appts FROM public.appointments a WHERE a.client_id = ANY(v_clients);
  SELECT COALESCE(array_agg(s.id), '{}') INTO v_sales FROM public.sales s
  WHERE s.client_id = ANY(v_clients) OR s.appointment_id = ANY(v_appts);

  v_out := jsonb_build_object(
    'format', 'halaqy.export.v1',
    'generated_at', now(),
    'account', (SELECT jsonb_build_object(
        'id', u.id,
        'email', CASE WHEN public.privacy_is_synthetic_email(u.email) THEN NULL ELSE NULLIF(u.email, '') END,
        'phone', NULLIF(u.phone, ''), 'created_at', u.created_at, 'last_sign_in_at', u.last_sign_in_at)
      FROM auth.users u WHERE u.id = v_uid),
    'profile', (SELECT jsonb_build_object(
        'id', p.id, 'role', p.role, 'full_name', p.full_name, 'phone', p.phone, 'avatar_url', p.avatar_url,
        'preferred_language', p.preferred_language, 'digit_preference', p.digit_preference,
        'notify_reminders', p.notify_reminders, 'notify_channel', p.notify_channel,
        'marketing_opt_in', p.marketing_opt_in, 'created_at', p.created_at, 'updated_at', p.updated_at)
      FROM public.profiles p WHERE p.id = v_uid),
    'verified_phones', COALESCE((SELECT jsonb_agg(to_jsonb(vp) - 'profile_id') FROM public.customer_verified_phones vp
                                 WHERE vp.profile_id = v_uid), '[]'::jsonb),
    'consent_records', COALESCE((SELECT jsonb_agg(to_jsonb(cr) - 'profile_id' ORDER BY cr.created_at)
                                 FROM public.consent_records cr WHERE cr.profile_id = v_uid), '[]'::jsonb),
    'client_links', COALESCE((SELECT jsonb_agg(to_jsonb(l) - 'profile_id') FROM public.client_profile_links l
                              WHERE l.profile_id = v_uid), '[]'::jsonb),
    'clients', COALESCE((SELECT jsonb_agg(to_jsonb(c) || jsonb_build_object('shop_name', s.name) ORDER BY c.created_at)
                         FROM public.clients c JOIN public.shops s ON s.id = c.shop_id
                         WHERE c.id = ANY(v_clients)), '[]'::jsonb),
    'appointments', COALESCE((SELECT jsonb_agg(to_jsonb(a) || jsonb_build_object('shop_name', s.name) ORDER BY a.start_time)
                              FROM public.appointments a JOIN public.shops s ON s.id = a.shop_id
                              WHERE a.id = ANY(v_appts)), '[]'::jsonb),
    'appointment_services', COALESCE((SELECT jsonb_agg(to_jsonb(x) ORDER BY x.appointment_id, x.sort)
                                      FROM public.appointment_services x WHERE x.appointment_id = ANY(v_appts)), '[]'::jsonb),
    'booking_attribution', COALESCE((SELECT jsonb_agg(to_jsonb(b)) FROM public.booking_attribution b
                                     WHERE b.appointment_id = ANY(v_appts)), '[]'::jsonb),
    'reviews', COALESCE((SELECT jsonb_agg(to_jsonb(r) ORDER BY r.created_at) FROM public.reviews r
                         WHERE r.client_id = ANY(v_clients) OR r.appointment_id = ANY(v_appts)), '[]'::jsonb),
    'payments', COALESCE((SELECT jsonb_agg(to_jsonb(pm) ORDER BY pm.created_at) FROM public.payments pm
                          WHERE pm.client_id = ANY(v_clients) OR pm.appointment_id = ANY(v_appts)), '[]'::jsonb),
    'sales', COALESCE((SELECT jsonb_agg(to_jsonb(sa) - 'tax_number' - 'created_by' - 'voided_by' ORDER BY sa.created_at)
                       FROM public.sales sa WHERE sa.id = ANY(v_sales)), '[]'::jsonb),
    'sale_items', COALESCE((SELECT jsonb_agg(to_jsonb(si)) FROM public.sale_items si WHERE si.sale_id = ANY(v_sales)), '[]'::jsonb),
    'sale_payments', COALESCE((SELECT jsonb_agg(to_jsonb(sp) - 'created_by') FROM public.sale_payments sp
                               WHERE sp.sale_id = ANY(v_sales)), '[]'::jsonb),
    'leads', COALESCE((SELECT jsonb_agg(to_jsonb(ld)) FROM public.leads ld WHERE ld.client_id = ANY(v_clients)), '[]'::jsonb),
    'notifications', COALESCE((SELECT jsonb_agg(to_jsonb(n) ORDER BY n.created_at) FROM public.notifications n
                               WHERE n.user_id = v_uid), '[]'::jsonb)
  );

  -- WS-1C tables (optional; columns discovered at run time).
  IF to_regclass('public.message_outbox') IS NOT NULL THEN
    v_where := public.privacy_outbox_where();
    IF v_where IS NOT NULL THEN
      EXECUTE format('SELECT COALESCE(jsonb_agg(to_jsonb(m)), ''[]''::jsonb) FROM public.message_outbox m WHERE %s', v_where)
        INTO v_extra USING v_appts, v_uid, v_clients;
      v_out := v_out || jsonb_build_object('message_outbox', v_extra);
    END IF;
  END IF;
  IF to_regclass('public.marketing_consents') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                 AND table_name = 'marketing_consents' AND column_name = 'client_id') THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(m)), ''[]''::jsonb) FROM public.marketing_consents m WHERE m.client_id = ANY($1)'
      INTO v_extra USING v_clients;
    v_out := v_out || jsonb_build_object('marketing_consents', v_extra);
  END IF;
  -- WS-1C inbound replies sent from the caller's verified phones.
  IF to_regclass('public.message_inbound') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                 AND table_name = 'message_inbound' AND column_name = 'from_phone') THEN
    EXECUTE 'SELECT COALESCE(jsonb_agg(to_jsonb(m) ORDER BY m.received_at), ''[]''::jsonb) FROM public.message_inbound m
             WHERE right(regexp_replace(m.from_phone, ''\D'', '''', ''g''), 9) = ANY($1)'
      INTO v_extra USING public.privacy_my_phone_keys(v_uid, v_clients);
    v_out := v_out || jsonb_build_object('message_inbound', v_extra);
  END IF;

  RETURN v_out;
END;
$$;

-- WHERE clause for message_outbox rows tied to $1 appointments, $2 profile, $3 clients.
CREATE OR REPLACE FUNCTION public.privacy_outbox_where()
RETURNS text
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_parts text[] := '{}';
BEGIN
  IF to_regclass('public.message_outbox') IS NULL THEN RETURN NULL; END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'message_outbox' AND column_name = 'appointment_id') THEN
    v_parts := array_append(v_parts, 'm.appointment_id = ANY($1)');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'message_outbox' AND column_name = 'recipient_profile_id') THEN
    v_parts := array_append(v_parts, 'm.recipient_profile_id = $2');
  END IF;
  IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public' AND table_name = 'message_outbox' AND column_name = 'client_id') THEN
    v_parts := array_append(v_parts, 'm.client_id = ANY($3)');
  END IF;
  IF cardinality(v_parts) = 0 THEN RETURN NULL; END IF;
  RETURN '(' || array_to_string(v_parts, ' OR ') || ')';
END;
$$;
REVOKE ALL ON FUNCTION public.privacy_outbox_where() FROM PUBLIC, anon, authenticated;

REVOKE ALL ON FUNCTION public.export_my_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated, service_role;

-- ─── 11. Deletion (PDPL right to erasure) ───────────────────────────────────
-- Customers only. Cancels future bookings, anonymises appointment history
-- (name, notes, line notes), reviews (reviewer name), leads and the shops'
-- client rows, scrubs WS-1C outbox rows, keeps sales (amounts) for accounting
-- with the name replaced, then deletes the auth user (cascades the profile,
-- consents, links, verified phones and notifications).
CREATE OR REPLACE FUNCTION public.delete_my_account(p_confirm text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid       uuid := auth.uid();
  v_role      text;
  v_clients   uuid[];
  v_appts     uuid[];
  v_name      constant text := 'Deleted client';
  v_cancelled integer := 0;
  v_anon      integer := 0;
  v_where     text;
  v_col       record;
  v_set       text[] := '{}';
  v_keys      text[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  IF p_confirm IS DISTINCT FROM 'DELETE' THEN
    RAISE EXCEPTION 'CONFIRM_REQUIRED' USING ERRCODE = 'P0001';
  END IF;
  SELECT role INTO v_role FROM public.profiles WHERE id = v_uid;
  IF v_role IS DISTINCT FROM 'customer' THEN
    RAISE EXCEPTION 'NOT_CUSTOMER' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.check_rate_limit('delete:' || v_uid::text, 5, 3600) THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  -- Pull in any guest rows booked with a verified phone before erasing.
  PERFORM public.privacy_link_clients(v_uid, 'phone_otp');

  SELECT COALESCE(array_agg(c.id), '{}') INTO v_clients FROM public.clients c WHERE c.auth_user_id = v_uid;
  SELECT COALESCE(array_agg(a.id), '{}') INTO v_appts FROM public.appointments a WHERE a.client_id = ANY(v_clients);
  v_keys := public.privacy_my_phone_keys(v_uid, v_clients);

  UPDATE public.appointments a
  SET status = 'cancelled', cancelled_at = now(), cancellation_reason = 'account_deleted'
  WHERE a.id = ANY(v_appts) AND a.start_time > now()
    AND a.status IN ('pending', 'confirmed', 'awaiting_deposit');
  GET DIAGNOSTICS v_cancelled = ROW_COUNT;

  UPDATE public.appointments a
  SET client_name = v_name, notes = NULL,
      cancellation_reason = CASE WHEN a.cancellation_reason IS NULL THEN NULL
                                 WHEN a.cancellation_reason = 'account_deleted' THEN a.cancellation_reason
                                 ELSE 'redacted' END
  WHERE a.id = ANY(v_appts);
  GET DIAGNOSTICS v_anon = ROW_COUNT;

  UPDATE public.appointment_services SET client_note = NULL
  WHERE appointment_id = ANY(v_appts) AND client_note IS NOT NULL;

  UPDATE public.reviews SET reviewer_name = NULL
  WHERE client_id = ANY(v_clients) OR appointment_id = ANY(v_appts);

  UPDATE public.payments SET metadata = metadata - ARRAY['phone', 'client_phone', 'client_name', 'name', 'email']
  WHERE (client_id = ANY(v_clients) OR appointment_id = ANY(v_appts)) AND metadata IS NOT NULL;

  -- Sales stay for accounting; only the name goes.
  UPDATE public.sales SET client_name = v_name
  WHERE (client_id = ANY(v_clients) OR appointment_id = ANY(v_appts)) AND client_name <> v_name;
  IF to_regclass('public.daily_sales_legacy') IS NOT NULL THEN
    UPDATE public.daily_sales_legacy SET client_name = v_name WHERE appointment_id = ANY(v_appts);
  END IF;

  UPDATE public.leads SET name = v_name, phone = NULL, email = NULL, contact = NULL, notes = NULL
  WHERE client_id = ANY(v_clients);

  -- WS-1C outbox: drop unsent messages, scrub the rest.
  IF to_regclass('public.message_outbox') IS NOT NULL THEN
    v_where := public.privacy_outbox_where();
    IF v_where IS NOT NULL THEN
      IF EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                 AND table_name = 'message_outbox' AND column_name = 'status') THEN
        EXECUTE format('DELETE FROM public.message_outbox m WHERE %s AND m.status::text IN (''queued'', ''pending'', ''scheduled'', ''deferred'', ''retry'')', v_where)
          USING v_appts, v_uid, v_clients;
      END IF;
      FOR v_col IN
        SELECT column_name, is_nullable, data_type FROM information_schema.columns
        WHERE table_schema = 'public' AND table_name = 'message_outbox'
          AND column_name IN ('payload', 'vars', 'variables', 'body', 'text', 'rendered', 'rendered_body',
                              'to', 'to_phone', 'recipient', 'recipient_phone', 'recipient_name', 'phone',
                              'address', 'to_address', 'error', 'wa_link')
      LOOP
        IF v_col.data_type IN ('json', 'jsonb') THEN
          v_set := v_set || format('%I = %s', v_col.column_name,
                                   CASE WHEN v_col.is_nullable = 'YES' THEN 'NULL' ELSE '''{}''::' || v_col.data_type END);
        ELSIF v_col.data_type IN ('text', 'character varying') THEN
          v_set := v_set || format('%I = %s', v_col.column_name, CASE WHEN v_col.is_nullable = 'YES' THEN 'NULL' ELSE '''''' END);
        END IF;
      END LOOP;
      IF cardinality(v_set) > 0 THEN
        EXECUTE format('UPDATE public.message_outbox m SET %s WHERE %s', array_to_string(v_set, ', '), v_where)
          USING v_appts, v_uid, v_clients;
      END IF;
    END IF;
  END IF;
  IF to_regclass('public.marketing_consents') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                 AND table_name = 'marketing_consents' AND column_name = 'client_id') THEN
    EXECUTE 'DELETE FROM public.marketing_consents WHERE client_id = ANY($1)' USING v_clients;
  END IF;
  IF to_regclass('public.message_inbound') IS NOT NULL
     AND EXISTS (SELECT 1 FROM information_schema.columns WHERE table_schema = 'public'
                 AND table_name = 'message_inbound' AND column_name = 'from_phone') THEN
    EXECUTE 'DELETE FROM public.message_inbound m
             WHERE right(regexp_replace(m.from_phone, ''\D'', '''', ''g''), 9) = ANY($1)'
      USING v_keys;
  END IF;

  UPDATE public.clients
  SET name = v_name, phone = NULL, email = NULL, notes = NULL, auth_user_id = NULL,
      deleted_at = COALESCE(deleted_at, now())
  WHERE id = ANY(v_clients);

  DELETE FROM auth.users WHERE id = v_uid;

  RETURN jsonb_build_object(
    'deleted', true,
    'clients', cardinality(v_clients),
    'appointments_anonymised', v_anon,
    'appointments_cancelled', v_cancelled
  );
END;
$$;
REVOKE ALL ON FUNCTION public.delete_my_account(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account(text) TO authenticated;

-- Internal helpers stay internal.
REVOKE ALL ON FUNCTION public.privacy_link_clients(uuid, text) FROM service_role;
REVOKE ALL ON FUNCTION public.privacy_store_verified_phone(uuid, text, text) FROM service_role;
