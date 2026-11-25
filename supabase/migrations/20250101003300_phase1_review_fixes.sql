-- ═══════════════════════════════════════════════════════════════════════════
-- Phase 1 review fixes (security + correctness), on top of 003200.
--
--   1. Phone identity is keyed on Jordanian mobiles only (+962 7[789]…):
--      OTP issue, phone login, verified phones and guest-row linking no
--      longer match two numbers that merely share their last 9 digits.
--   2. create_public_booking: direct anon/authenticated calls must prove the
--      phone (OTP token or a confirmed auth phone) unless the caller is shop
--      staff; the trusted server route goes through
--      create_public_booking_gateway (service role), which passes the real
--      client IP for the per-IP bucket. Unpublished shops take no public
--      bookings.
--   3. shops.timezone is validated; search maps unknown zones to Asia/Amman.
--   4. Hidden (moderated) reviews never reach public readers.
--   5. A suspended shop can never become published (also via the wizard).
--   6. Messaging: live sends go to Jordanian mobiles only (others fall back to
--      wa.me); a no-provider sweep (pg_cron when installed) turns due rows
--      into manual-send fallbacks.
--   7. delete_my_account / export_my_data cover staff_push_outbox and
--      walk_in_queue.
--
-- Idempotent (CREATE OR REPLACE / IF EXISTS) and safe on production data.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0. Helpers ────────────────────────────────────────────────────────────

-- Jordanian mobile → '9627XXXXXXXX' (E.164 digits), NULL for anything else.
-- Accepts 07…, 7…, 9627…, 009627…, +962 07… and Arabic-Indic / Persian digits.
CREATE OR REPLACE FUNCTION public.jo_mobile_e164(p_phone text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  d text := regexp_replace(translate(COALESCE(p_phone, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '\D', '', 'g');
BEGIN
  IF d LIKE '00%' THEN d := substr(d, 3); END IF;
  IF length(d) = 13 AND d LIKE '9620%' THEN d := '962' || substr(d, 5); END IF;
  IF length(d) = 10 AND d LIKE '07%' THEN d := '962' || substr(d, 2);
  ELSIF length(d) = 9 AND d LIKE '7%' THEN d := '962' || d;
  END IF;
  IF d ~ '^9627[789][0-9]{7}$' THEN RETURN d; END IF;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.jo_mobile_e164(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.jo_mobile_e164(text) TO anon, authenticated, service_role;

-- A valid IANA zone name, or Asia/Amman. Never raises.
CREATE OR REPLACE FUNCTION public.safe_timezone(p_tz text)
RETURNS text
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tz text := NULLIF(btrim(COALESCE(p_tz, '')), '');
BEGIN
  IF v_tz IS NULL OR v_tz = 'Asia/Amman' THEN RETURN 'Asia/Amman'; END IF;
  IF length(v_tz) > 64 THEN RETURN 'Asia/Amman'; END IF;
  BEGIN
    PERFORM now() AT TIME ZONE v_tz;
    RETURN v_tz;
  EXCEPTION WHEN others THEN
    RETURN 'Asia/Amman';
  END;
END;
$$;
REVOKE ALL ON FUNCTION public.safe_timezone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.safe_timezone(text) TO anon, authenticated, service_role;

-- Client IP of the current request. The trusted booking gateway passes the
-- real client IP (halaqy.client_ip, transaction-local; PostgREST callers
-- cannot set it); otherwise the PostgREST forwarding headers are used.
CREATE OR REPLACE FUNCTION public.request_ip()
RETURNS text
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  h   json;
  ip  text := NULLIF(btrim(COALESCE(current_setting('halaqy.client_ip', true), '')), '');
BEGIN
  IF ip IS NOT NULL AND length(ip) <= 64 THEN
    RETURN ip;
  END IF;
  BEGIN
    h := NULLIF(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  IF h IS NULL THEN
    RETURN NULL;
  END IF;
  ip := COALESCE(h->>'cf-connecting-ip', h->>'x-real-ip', split_part(COALESCE(h->>'x-forwarded-for', ''), ',', 1));
  ip := btrim(ip);
  RETURN CASE WHEN ip IS NULL OR ip = '' OR length(ip) > 64 THEN NULL ELSE ip END;
END;
$$;
REVOKE ALL ON FUNCTION public.request_ip() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.request_ip() TO service_role;

-- ─── 1. Phone identity: Jordanian mobiles only ─────────────────────────────

-- OTP rows are keyed on the full E.164 number. Codes issued before this
-- migration (≤ 10 minutes old) simply expire.
CREATE OR REPLACE FUNCTION public.otp_phone_key(p_phone text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, extensions, pg_temp
AS $$
  SELECT encode(extensions.digest(
    COALESCE('e164:' || public.jo_mobile_e164(p_phone),
             'invalid:' || regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g')), 'sha256'), 'hex');
$$;
REVOKE ALL ON FUNCTION public.otp_phone_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.otp_phone_key(text) TO service_role;

-- Codes go to Jordanian mobiles only (no international SMS pumping).
CREATE OR REPLACE FUNCTION public.otp_issue(p_phone text, p_ttl_seconds int DEFAULT 300)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_e164   text := public.jo_mobile_e164(p_phone);
  v_key    text;
  v_code   text;
  v_exp    timestamptz := now() + make_interval(secs => LEAST(GREATEST(COALESCE(p_ttl_seconds, 300), 60), 900));
BEGIN
  IF v_e164 IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'PHONE_COUNTRY';
  END IF;
  v_key := public.otp_phone_key(v_e164);
  IF (SELECT count(*) FROM public.phone_verifications
      WHERE phone_key = v_key AND created_at > now() - interval '10 minutes') >= 3 THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.phone_verifications WHERE created_at < now() - interval '1 day';
  UPDATE public.phone_verifications SET expires_at = now()
  WHERE phone_key = v_key AND verified_at IS NULL AND expires_at > now();

  v_code := lpad(((('x' || encode(extensions.gen_random_bytes(4), 'hex'))::bit(32)::bigint % 1000000))::text, 6, '0');
  INSERT INTO public.phone_verifications (phone_key, code_hash, expires_at)
  VALUES (v_key, encode(extensions.digest(v_key || ':' || v_code, 'sha256'), 'hex'), v_exp);
  RETURN jsonb_build_object('code', v_code, 'expires_at', v_exp);
END;
$$;
REVOKE ALL ON FUNCTION public.otp_issue(text, int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.otp_issue(text, int) TO service_role;

-- National key of a Jordanian mobile (last 9 digits of its E.164 form), else NULL.
CREATE OR REPLACE FUNCTION public.privacy_phone_key(p_phone text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT right(public.jo_mobile_e164(p_phone), 9);
$$;
REVOKE ALL ON FUNCTION public.privacy_phone_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.privacy_phone_key(text) TO service_role;

-- Verified phones: only Jordanian mobiles, key = national part of `phone`.
DELETE FROM public.customer_verified_phones vp
WHERE public.jo_mobile_e164(vp.phone) IS NULL
   OR right(public.jo_mobile_e164(vp.phone), 9) <> vp.phone_key;
UPDATE public.customer_verified_phones vp
SET phone = public.jo_mobile_e164(vp.phone)
WHERE vp.phone IS DISTINCT FROM public.jo_mobile_e164(vp.phone);
ALTER TABLE public.customer_verified_phones DROP CONSTRAINT IF EXISTS customer_verified_phones_jo_mobile;
ALTER TABLE public.customer_verified_phones ADD CONSTRAINT customer_verified_phones_jo_mobile
  CHECK (phone ~ '^9627[789][0-9]{7}$' AND phone_key = right(phone, 9));

CREATE OR REPLACE FUNCTION public.privacy_store_verified_phone(p_profile_id uuid, p_phone text, p_method text)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_e164 text := public.jo_mobile_e164(p_phone);
  v_key  text;
BEGIN
  IF v_e164 IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'phone';
  END IF;
  v_key := right(v_e164, 9);
  INSERT INTO public.customer_verified_phones (phone_key, profile_id, phone, method, verified_at)
  VALUES (v_key, p_profile_id, v_e164, COALESCE(p_method, 'supabase_otp'), now())
  ON CONFLICT (phone_key) DO UPDATE
    SET profile_id = EXCLUDED.profile_id, phone = EXCLUDED.phone,
        method = EXCLUDED.method, verified_at = now();
  UPDATE public.profiles SET phone = '+' || v_e164
  WHERE id = p_profile_id AND NULLIF(trim(COALESCE(phone, '')), '') IS NULL;
  RETURN v_key;
END;
$$;
REVOKE ALL ON FUNCTION public.privacy_store_verified_phone(uuid, text, text) FROM PUBLIC, anon, authenticated, service_role;

-- Guest rows link only when the full Jordanian number matches a verified one.
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
    AND public.jo_mobile_e164(c.phone_digits) IN (SELECT vp.phone FROM public.customer_verified_phones vp
                                                  WHERE vp.profile_id = p_profile_id);
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
REVOKE ALL ON FUNCTION public.privacy_link_clients(uuid, text) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.claim_customer_identity()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_role   text;
  v_phone  text;
  v_e164   text;
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
  v_e164 := public.jo_mobile_e164(v_phone);
  IF v_e164 IS NOT NULL THEN
    IF EXISTS (SELECT 1 FROM auth.users u WHERE u.id = v_uid AND u.phone_change_sent_at IS NOT NULL
                 AND u.phone_confirmed_at >= u.phone_change_sent_at) THEN
      v_method := 'phone_change';
    END IF;
    IF NOT EXISTS (SELECT 1 FROM public.customer_verified_phones vp
                   WHERE vp.phone_key = right(v_e164, 9) AND vp.profile_id <> v_uid) THEN
      PERFORM public.privacy_store_verified_phone(v_uid, v_e164, v_method);
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

-- Self-hosted phone login: the account owning this exact Jordanian number.
CREATE OR REPLACE FUNCTION public.customer_phone_login_resolve(p_token text, p_phone text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_e164   text := public.jo_mobile_e164(p_phone);
  v_key    text;
  v_ver    uuid;
  v_uid    uuid;
  v_email  text;
  v_role   text;
BEGIN
  IF v_e164 IS NULL OR NULLIF(trim(COALESCE(p_token, '')), '') IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  v_key := right(v_e164, 9);

  UPDATE public.phone_verifications pv SET consumed_at = now()
  WHERE pv.id = (SELECT x.id FROM public.phone_verifications x
                 WHERE x.token_hash = encode(extensions.digest(trim(p_token), 'sha256'), 'hex')
                   AND x.phone_key = public.otp_phone_key(v_e164)
                   AND x.verified_at > now() - interval '30 minutes'
                   AND x.consumed_at IS NULL
                 LIMIT 1 FOR UPDATE)
  RETURNING pv.id INTO v_ver;
  IF v_ver IS NULL THEN
    RAISE EXCEPTION 'OTP_INVALID' USING ERRCODE = 'P0001';
  END IF;

  SELECT vp.profile_id INTO v_uid FROM public.customer_verified_phones vp
  WHERE vp.phone_key = v_key AND vp.phone = v_e164;
  IF v_uid IS NULL THEN
    SELECT u.id INTO v_uid FROM auth.users u
    WHERE u.phone_confirmed_at IS NOT NULL AND u.deleted_at IS NULL
      AND right(regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g'), 9) = v_key
      AND public.jo_mobile_e164(u.phone) = v_e164
    ORDER BY u.created_at LIMIT 1;
  END IF;
  IF v_uid IS NULL THEN
    SELECT u.id INTO v_uid FROM auth.users u
    WHERE lower(u.email) = 'p' || v_e164 || '@phone.halaqy.invalid' AND u.deleted_at IS NULL
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

-- ─── 2. Public booking ─────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_shop_id       uuid,
  p_client_name   text,
  p_client_phone  text,
  p_service_ids   uuid[],               -- legacy shape; ignored when p_items is set
  p_barber_id     uuid,                 -- NULL = any available barber
  p_start_time    timestamptz,
  p_source        text DEFAULT 'online',  -- raw ?src= (mapped to a category)
  p_notes         text DEFAULT NULL,
  p_items         jsonb DEFAULT NULL,   -- [{service_id, variant_id?, note?}] | ["uuid", …]
  p_entry         text DEFAULT NULL,    -- ?entry= (BookingCta entry point)
  p_otp_token     text DEFAULT NULL,    -- from otp_verify (self-hosted OTP route)
  p_captcha_token text DEFAULT NULL     -- verified by the API layer (Turnstile); accepted for the record
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_uid          uuid := auth.uid();
  v_shop         public.shops%ROWTYPE;
  v_tz           text;
  v_name         text := left(trim(COALESCE(p_client_name, '')), 100);
  v_phone        text := left(trim(COALESCE(p_client_phone, '')), 30);
  v_digits       text := regexp_replace(COALESCE(p_client_phone, ''), '\D', '', 'g');
  v_lines        jsonb;      -- normalised [{service_id, variant_id, note, pos}]
  v_services     uuid[];
  v_items        jsonb;      -- engine payload (service ids)
  v_count        int;
  v_detail       jsonb;
  v_duration     int;
  v_engine_dur   int;
  v_price        numeric(10,3);
  v_bad_variant  boolean;
  v_service_name text;
  v_end          timestamptz;
  v_barber       uuid;
  v_client_id    uuid;
  v_appt_id      uuid;
  v_src          text := NULLIF(lower(left(trim(COALESCE(p_source, '')), 40)), '');
  v_entry        text := NULLIF(lower(left(trim(COALESCE(p_entry, '')), 40)), '');
  v_source       text;
  v_staff        boolean;
  v_window_days  int;
  v_verified_phone text;
  v_verified_email text;
  v_phone_verified boolean := false;
  v_ver_id       uuid;
  v_attempt      int;
  -- Set (transaction-local) only by create_public_booking_gateway, which the
  -- API route calls with the service role after its OTP / CAPTCHA checks.
  v_gateway      boolean := COALESCE(current_setting('halaqy.booking_gateway', true), '') = 'on';
BEGIN
  -- ── Input shape ──
  IF p_shop_id IS NULL OR p_start_time IS NULL
     OR length(v_name) < 2 OR length(v_digits) < 7 OR length(v_digits) > 15 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;

  IF p_items IS NOT NULL THEN
    IF jsonb_typeof(p_items) <> 'array' OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 10 THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;
    BEGIN
      SELECT jsonb_agg(jsonb_build_object('service_id', d.sid, 'variant_id', d.vid, 'note', d.note, 'pos', d.pos) ORDER BY d.pos)
        INTO v_lines
      FROM (
        SELECT DISTINCT ON (x.sid) x.sid, x.vid, x.note, x.pos
        FROM (
          SELECT (CASE jsonb_typeof(e) WHEN 'string' THEN e #>> '{}' ELSE e ->> 'service_id' END)::uuid AS sid,
                 NULLIF(CASE WHEN jsonb_typeof(e) = 'object' THEN e ->> 'variant_id' END, '')::uuid AS vid,
                 NULLIF(left(trim(CASE WHEN jsonb_typeof(e) = 'object' THEN COALESCE(e ->> 'note', '') ELSE '' END), 300), '') AS note,
                 pos::int AS pos
          FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(e, pos)
        ) x
        ORDER BY x.sid, x.pos
      ) d;
    EXCEPTION WHEN invalid_text_representation THEN
      RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
    END;
  ELSE
    IF p_service_ids IS NULL OR cardinality(p_service_ids) = 0 OR cardinality(p_service_ids) > 10 THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;
    SELECT jsonb_agg(jsonb_build_object('service_id', d.x, 'variant_id', NULL, 'note', NULL, 'pos', d.o) ORDER BY d.o)
      INTO v_lines
    FROM (SELECT DISTINCT ON (x) x, o::int AS o FROM unnest(p_service_ids) WITH ORDINALITY AS u(x, o) ORDER BY x, o) d;
  END IF;

  IF v_lines IS NULL OR EXISTS (SELECT 1 FROM jsonb_array_elements(v_lines) l WHERE l ->> 'service_id' IS NULL) THEN
    RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT array_agg((l ->> 'service_id')::uuid ORDER BY (l ->> 'pos')::int) INTO v_services
  FROM jsonb_array_elements(v_lines) l;
  v_items := to_jsonb(v_services);

  v_source := public.booking_source_category(v_src);
  IF v_src IS NOT NULL AND v_src !~ '^[a-z0-9_.:-]{1,40}$' THEN v_src := NULL; END IF;
  IF v_entry IS NOT NULL AND v_entry !~ '^[a-z0-9_.:-]{1,40}$' THEN v_entry := NULL; END IF;

  -- ── Abuse limits (apply even when the RPC is called directly with the anon key) ──
  IF NOT public.check_request_rate_limit('booking', 20, 60, v_digits) THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;
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
  v_tz := public.safe_timezone(v_shop.timezone);
  v_staff := public.availability_is_staff(p_shop_id);
  -- Unpublished (draft / unpublished) shops take bookings from their staff only.
  IF NOT v_staff AND v_shop.is_published IS NOT TRUE THEN
    RAISE EXCEPTION 'SHOP_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  -- ── Services: active, in this shop, bookable online (staff may book any) ──
  SELECT count(*) INTO v_count
  FROM public.services s
  WHERE s.id = ANY (v_services) AND s.shop_id = p_shop_id AND s.is_active IS NOT FALSE
    AND (v_staff OR s.online_bookable IS NOT FALSE);
  IF v_count <> cardinality(v_services) THEN
    RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
  END IF;

  -- ── Time: notice + booking window (staff: no notice, 365-day window) ──
  IF p_start_time <= now() THEN
    RAISE EXCEPTION 'SLOT_IN_PAST' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_staff
     AND p_start_time < now() + make_interval(mins => GREATEST(0, COALESCE(v_shop.min_notice_minutes, 0))) THEN
    RAISE EXCEPTION 'SLOT_IN_PAST' USING ERRCODE = 'P0001';
  END IF;
  v_window_days := CASE WHEN v_staff THEN 365 ELSE LEAST(GREATEST(COALESCE(v_shop.booking_window_days, 90), 1), 365) END;
  IF (p_start_time AT TIME ZONE v_tz)::date > (now() AT TIME ZONE v_tz)::date + v_window_days THEN
    RAISE EXCEPTION 'TOO_FAR_AHEAD' USING ERRCODE = 'P0001';
  END IF;

  -- ── Barber ──
  IF p_barber_id IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles p
                   WHERE p.id = p_barber_id AND p.shop_id = p_shop_id
                     AND p.role::text IN ('barber', 'shop_admin')
                     AND (v_staff OR p.online_bookable IS NOT FALSE)) THEN
      RAISE EXCEPTION 'BARBER_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.barber_offers_services(p_barber_id, v_services) THEN
      RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    v_barber := p_barber_id;
  END IF;

  -- Serialise writers per barber, then the exact engine check. For "any
  -- barber" a lost race re-picks (up to 3 times): after the lock the
  -- competing booking is committed and pick_any_barber skips that chair.
  BEGIN
    FOR v_attempt IN 1..3 LOOP
      IF p_barber_id IS NULL THEN
        v_barber := public.pick_any_barber(p_shop_id, p_start_time, v_items, NULL, NULL);
        IF v_barber IS NULL THEN
          RAISE EXCEPTION 'NO_BARBER_AVAILABLE' USING ERRCODE = 'P0001';
        END IF;
      END IF;
      PERFORM pg_advisory_xact_lock(hashtext('appt:barber:' || v_barber::text));
      EXIT WHEN public.is_slot_bookable(p_shop_id, p_start_time, v_items, v_barber, NULL, NULL);
      IF p_barber_id IS NOT NULL THEN
        RAISE EXCEPTION 'SLOT_TAKEN' USING ERRCODE = 'P0001';
      END IF;
      IF v_attempt = 3 THEN
        RAISE EXCEPTION 'NO_BARBER_AVAILABLE' USING ERRCODE = 'P0001';
      END IF;
    END LOOP;
  EXCEPTION WHEN deadlock_detected THEN
    -- Two "any barber" requests re-picking each other's chair.
    RAISE EXCEPTION 'NO_BARBER_AVAILABLE' USING ERRCODE = 'P0001';
  END;

  -- ── Lines for this barber: variant > barber override > catalogue ──
  SELECT
    jsonb_agg(jsonb_build_object(
      'service_id', s.id,
      'variant_id', v.id,
      'name', s.name || COALESCE(' – ' || v.name_en, ''),
      'name_ar', COALESCE(s.name_ar, s.name) || COALESCE(' – ' || COALESCE(v.name_ar, v.name_en), ''),
      'price', CASE WHEN s.price_type = 'free' THEN 0
                    WHEN v.id IS NOT NULL THEN v.price
                    ELSE COALESCE(bs.price_override, s.price) END,
      'duration', COALESCE(v.duration, bs.duration_override, s.duration),
      'note', l.note,
      'sort', l.pos) ORDER BY l.pos),
    COALESCE(sum(CASE WHEN s.price_type = 'free' THEN 0
                      WHEN v.id IS NOT NULL THEN v.price
                      ELSE COALESCE(bs.price_override, s.price) END), 0),
    COALESCE(sum(COALESCE(v.duration, bs.duration_override, s.duration)), 0)::int,
    COALESCE(sum(COALESCE(bs.duration_override, s.duration)), 0)::int,
    bool_or(l.variant_id IS NOT NULL AND v.id IS NULL),
    string_agg(s.name || COALESCE(' – ' || v.name_en, ''), ' + ' ORDER BY l.pos)
  INTO v_detail, v_price, v_duration, v_engine_dur, v_bad_variant, v_service_name
  FROM jsonb_to_recordset(v_lines) AS l(service_id uuid, variant_id uuid, note text, pos int)
  JOIN public.services s ON s.id = l.service_id
  LEFT JOIN public.service_variants v ON v.id = l.variant_id AND v.service_id = s.id AND v.is_active
  LEFT JOIN public.barber_services bs ON bs.barber_id = v_barber AND bs.service_id = s.id;

  IF v_bad_variant THEN
    RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF v_duration < 5 OR v_duration > 720 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  v_end := p_start_time + make_interval(mins => v_duration);

  -- A variant longer than the base service: the engine checks the base
  -- length, so also require the full range inside working time (overlaps
  -- with other bookings are still caught by appointments_no_overlap).
  IF (p_barber_id IS NOT NULL OR v_duration > v_engine_dur)
     AND NOT public.barber_is_working(v_barber, p_start_time, v_end, v_tz) THEN
    RAISE EXCEPTION 'OUTSIDE_WORKING_HOURS' USING ERRCODE = 'P0001';
  END IF;

  -- ── Verified phone (self-hosted OTP). Rolled back with the booking on failure. ──
  IF NULLIF(trim(COALESCE(p_otp_token, '')), '') IS NOT NULL THEN
    UPDATE public.phone_verifications pv SET consumed_at = now()
    WHERE pv.id = (SELECT x.id FROM public.phone_verifications x
                   WHERE x.token_hash = encode(extensions.digest(trim(p_otp_token), 'sha256'), 'hex')
                     AND x.phone_key = public.otp_phone_key(v_digits)
                     AND x.verified_at > now() - interval '30 minutes'
                     AND x.consumed_at IS NULL
                   LIMIT 1 FOR UPDATE)
    RETURNING pv.id INTO v_ver_id;
    IF v_ver_id IS NULL THEN
      RAISE EXCEPTION 'OTP_INVALID' USING ERRCODE = 'P0001';
    END IF;
    v_phone_verified := true;
  END IF;

  -- Confirmed auth phone of the signed-in caller (full number, not the last 9 digits).
  IF v_uid IS NOT NULL THEN
    SELECT regexp_replace(COALESCE(u.phone, ''), '\D', '', 'g') INTO v_verified_phone
    FROM auth.users u WHERE u.id = v_uid AND u.phone_confirmed_at IS NOT NULL;
    IF NULLIF(v_verified_phone, '') IS NOT NULL
       AND public.messaging_normalize_phone(v_verified_phone) = public.messaging_normalize_phone(v_digits) THEN
      v_phone_verified := true;
    END IF;
  END IF;

  -- ── Phone gate for direct RPC calls (the API route enforces OTP / CAPTCHA
  --    and comes through the gateway). Staff booking for their shop is exempt.
  IF NOT v_gateway AND NOT v_staff AND NOT v_phone_verified THEN
    RAISE EXCEPTION 'OTP_REQUIRED' USING ERRCODE = 'P0001';
  END IF;

  -- ── Client row (ownership is auth_user_id only; names are never overwritten) ──
  PERFORM pg_advisory_xact_lock(hashtext('client:' || p_shop_id::text || ':' || v_digits));

  IF v_uid IS NOT NULL THEN
    SELECT c.id INTO v_client_id FROM public.clients c
    WHERE c.shop_id = p_shop_id AND c.auth_user_id = v_uid AND c.deleted_at IS NULL
    ORDER BY (c.phone_digits = v_digits) DESC, c.created_at
    LIMIT 1;

    IF v_client_id IS NULL THEN
      -- Link an existing unlinked row only when the caller's own confirmed
      -- phone is this exact number.
      IF NULLIF(v_verified_phone, '') IS NOT NULL
         AND public.messaging_normalize_phone(v_verified_phone) = public.messaging_normalize_phone(v_digits) THEN
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
      WHERE a.client_id = v_client_id
        AND a.status IN ('pending', 'confirmed', 'awaiting_deposit', 'arrived', 'in_chair')
        AND a.start_time > now()) >= 5 THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  -- ── Appointment + lines ──
  PERFORM set_config('halaqy.booking_v2_writer', 'on', true);
  BEGIN
    INSERT INTO public.appointments (
      shop_id, client_id, barber_id, service_ids, client_name, service_name,
      start_time, end_time, status, price, currency, payment_status,
      amount_total, amount_deposit, amount_paid, source, notes
    ) VALUES (
      p_shop_id, v_client_id, v_barber, v_services, v_name, v_service_name,
      p_start_time, v_end, 'pending', round(v_price, 2), COALESCE(v_shop.currency, 'JOD'), 'unpaid',
      round(v_price, 2), 0, 0, v_source, NULLIF(left(trim(COALESCE(p_notes, '')), 500), '')
    )
    RETURNING id INTO v_appt_id;
  EXCEPTION WHEN exclusion_violation THEN
    PERFORM set_config('halaqy.booking_v2_writer', 'off', true);
    RAISE EXCEPTION 'SLOT_TAKEN' USING ERRCODE = 'P0001';
  END;

  INSERT INTO public.appointment_services
    (appointment_id, shop_id, service_id, variant_id, barber_id, name, name_ar, price, duration, sort, client_note)
  SELECT v_appt_id, p_shop_id, d.service_id, d.variant_id, v_barber, d.name, d.name_ar, d.price, d.duration, d.sort, d.note
  FROM jsonb_to_recordset(v_detail) AS d(service_id uuid, variant_id uuid, name text, name_ar text,
                                         price numeric, duration int, sort int, note text);
  PERFORM set_config('halaqy.booking_v2_writer', 'off', true);

  INSERT INTO public.booking_attribution (appointment_id, shop_id, src, entry, barber_preselected, phone_verified)
  VALUES (v_appt_id, p_shop_id, v_src, v_entry, p_barber_id IS NOT NULL, v_phone_verified)
  ON CONFLICT (appointment_id) DO NOTHING;

  RETURN jsonb_build_object(
    'appointment_id', v_appt_id,
    'barber_id',      v_barber,
    'start_time',     p_start_time,
    'end_time',       v_end,
    'price',          round(v_price, 3),
    'currency',       COALESCE(v_shop.currency, 'JOD'),
    'service_name',   v_service_name,
    'status',         'pending',
    'source',         v_source,
    'phone_verified', v_phone_verified,
    'items',          v_detail
  );
END;
$$;

REVOKE ALL ON FUNCTION public.create_public_booking(uuid, text, text, uuid[], uuid, timestamptz, text, text, jsonb, text, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_booking(uuid, text, text, uuid[], uuid, timestamptz, text, text, jsonb, text, text, text)
  TO anon, authenticated, service_role;

-- Trusted entry point for POST /api/booking (service role only). The route
-- has already applied its OTP / CAPTCHA gate and its per-client-IP limit; it
-- passes the signed-in user (verified by Supabase Auth) and the client IP.
CREATE OR REPLACE FUNCTION public.create_public_booking_gateway(
  p_actor         uuid,
  p_client_ip     text,
  p_shop_id       uuid,
  p_client_name   text,
  p_client_phone  text,
  p_service_ids   uuid[] DEFAULT NULL,
  p_barber_id     uuid DEFAULT NULL,
  p_start_time    timestamptz DEFAULT NULL,
  p_source        text DEFAULT 'online',
  p_notes         text DEFAULT NULL,
  p_items         jsonb DEFAULT NULL,
  p_entry         text DEFAULT NULL,
  p_otp_token     text DEFAULT NULL,
  p_captcha_token text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_result jsonb;
BEGIN
  PERFORM set_config('halaqy.booking_gateway', 'on', true);
  PERFORM set_config('halaqy.client_ip', 'gw:' || left(COALESCE(NULLIF(btrim(p_client_ip), ''), 'unknown'), 60), true);
  PERFORM set_config('request.jwt.claim.sub', COALESCE(p_actor::text, ''), true);
  PERFORM set_config('request.jwt.claims',
    jsonb_build_object('sub', p_actor, 'role', CASE WHEN p_actor IS NULL THEN 'anon' ELSE 'authenticated' END)::text, true);

  v_result := public.create_public_booking(
    p_shop_id, p_client_name, p_client_phone, p_service_ids, p_barber_id, p_start_time,
    p_source, p_notes, p_items, p_entry, p_otp_token, p_captcha_token);

  PERFORM set_config('halaqy.booking_gateway', '', true);
  PERFORM set_config('halaqy.client_ip', '', true);
  RETURN v_result;
END;
$$;
REVOKE ALL ON FUNCTION public.create_public_booking_gateway(uuid, text, uuid, text, text, uuid[], uuid, timestamptz, text, text, jsonb, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.create_public_booking_gateway(uuid, text, uuid, text, text, uuid[], uuid, timestamptz, text, text, jsonb, text, text, text) TO service_role;

-- ─── 3. shops.timezone ────────────────────────────────────────────────────
UPDATE public.shops s SET timezone = 'Asia/Amman'
WHERE s.timezone IS NOT NULL AND btrim(s.timezone) <> ''
  AND public.safe_timezone(s.timezone) IS DISTINCT FROM s.timezone;

CREATE OR REPLACE FUNCTION public.shops_validate_timezone()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.timezone IS NOT NULL AND btrim(NEW.timezone) <> ''
     AND public.safe_timezone(NEW.timezone) IS DISTINCT FROM NEW.timezone THEN
    RAISE EXCEPTION 'INVALID_TIMEZONE' USING ERRCODE = '22023';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.shops_validate_timezone() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS shops_validate_timezone ON public.shops;
CREATE TRIGGER shops_validate_timezone BEFORE INSERT OR UPDATE OF timezone ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.shops_validate_timezone();

-- Search / messaging readers: one bad zone can never abort a query, and
-- hidden reviews never count. Patched in place from the live definitions
-- (bodies are otherwise unchanged; grants are kept by CREATE OR REPLACE).
DO $$
DECLARE
  f   text;
  d0  text;
  d   text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.search_open_until(uuid, text)',
    'public.search_shop_base(uuid, uuid, double precision, double precision, double precision, jsonb)',
    'public.search_shops(text, uuid, double precision, double precision, double precision, date, text, text, text, jsonb, integer, integer, uuid)',
    'public.search_barbers(text, uuid, double precision, double precision, double precision, date, text, text, text, jsonb, integer, integer, uuid)',
    'public.public_stats(uuid)',
    'public.messaging_claim(integer, boolean)'
  ] LOOP
    IF to_regprocedure(f) IS NULL THEN
      RAISE NOTICE 'phase1 review fixes: % not found, skipped', f;
      CONTINUE;
    END IF;
    d0 := pg_get_functiondef(to_regprocedure(f));
    d := d0;
    d := replace(d, $r$coalesce(nullif(b.timezone, ''), 'Asia/Amman')$r$, 'public.safe_timezone(b.timezone)');
    d := replace(d, $r$coalesce(nullif(s.timezone, ''), 'Asia/Amman')$r$, 'public.safe_timezone(s.timezone)');
    d := replace(d, $r$coalesce(nullif(p_tz, ''), 'Asia/Amman')$r$, 'public.safe_timezone(p_tz)');
    d := replace(d, $r$COALESCE(NULLIF(s.timezone, ''), 'Asia/Amman')$r$, 'public.safe_timezone(s.timezone)');
    d := replace(d, E'FROM public.reviews rv\n      WHERE rv.shop_id IN',
                    E'FROM public.reviews rv\n      WHERE rv.hidden_at IS NULL AND rv.shop_id IN');
    d := replace(d, 'FROM public.reviews r WHERE r.shop_id IN', 'FROM public.reviews r WHERE r.hidden_at IS NULL AND r.shop_id IN');
    -- Live provider sends: Jordanian mobiles only; anything else is a wa.me fallback.
    d := replace(d, 'IF NOT COALESCE(p_live, false) THEN',
                    'IF NOT COALESCE(p_live, false) OR public.jo_mobile_e164(r.to_phone) IS NULL THEN');
    IF d <> d0 THEN
      EXECUTE d;
    END IF;
  END LOOP;

  -- Guard: the patterns above must all be gone (fails loudly if a body changed).
  IF EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
             WHERE n.nspname = 'public'
               AND p.proname IN ('search_open_until', 'search_shop_base', 'search_shops', 'search_barbers', 'messaging_claim')
               AND (p.prosrc ILIKE '%nullif(b.timezone, '''')%' OR p.prosrc ILIKE '%nullif(s.timezone, '''')%'
                    OR p.prosrc ILIKE '%nullif(p_tz, '''')%')) THEN
    RAISE EXCEPTION 'phase1 review fixes: an unpatched timezone expression remains';
  END IF;
  IF to_regprocedure('public.search_shops(text, uuid, double precision, double precision, double precision, date, text, text, text, jsonb, integer, integer, uuid)') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                     WHERE n.nspname = 'public' AND p.proname = 'search_shops' AND p.prosrc LIKE '%rv.hidden_at IS NULL%') THEN
    RAISE EXCEPTION 'phase1 review fixes: search_shops rating still counts hidden reviews';
  END IF;
  IF to_regprocedure('public.messaging_claim(integer, boolean)') IS NOT NULL
     AND NOT EXISTS (SELECT 1 FROM pg_proc p JOIN pg_namespace n ON n.oid = p.pronamespace
                     WHERE n.nspname = 'public' AND p.proname = 'messaging_claim' AND p.prosrc LIKE '%jo_mobile_e164(r.to_phone)%') THEN
    RAISE EXCEPTION 'phase1 review fixes: messaging_claim country guard missing';
  END IF;
END $$;

-- ─── 4. Hidden reviews stay hidden ────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.public_recent_reviews(p_city_id uuid DEFAULT NULL, p_limit integer DEFAULT 12)
RETURNS TABLE (
  id            uuid,
  rating        integer,
  comment       text,
  created_at    timestamptz,
  reviewer      text,
  shop_id       uuid,
  shop_slug     text,
  shop_slug_ar  text,
  shop_name     text,
  shop_name_ar  text,
  area_name_en  text,
  area_name_ar  text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.id, r.rating, left(btrim(r.comment), 280), r.created_at,
         CASE
           WHEN coalesce(btrim(r.reviewer_name), '') = '' THEN NULL
           WHEN array_length(regexp_split_to_array(btrim(r.reviewer_name), '\s+'), 1) = 1
             THEN left(btrim(r.reviewer_name), 24)
           ELSE left(split_part(btrim(r.reviewer_name), ' ', 1), 24) || ' '
                || left((regexp_split_to_array(btrim(r.reviewer_name), '\s+'))[
                     array_length(regexp_split_to_array(btrim(r.reviewer_name), '\s+'), 1)], 1) || '.'
         END,
         s.id, s.slug, s.slug_ar, s.name, s.name_ar, a.name_en, a.name_ar
  FROM public.reviews r
  JOIN public.shops s ON s.id = r.shop_id
  LEFT JOIN public.areas a ON a.id = s.area_id
  WHERE s.is_published AND s.marketplace_visible
    AND r.hidden_at IS NULL
    AND (p_city_id IS NULL OR s.city_id = p_city_id)
    AND r.rating >= 4
    AND length(btrim(coalesce(r.comment, ''))) >= 12
  ORDER BY r.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 12), 1), 24);
$$;
REVOKE ALL ON FUNCTION public.public_recent_reviews(uuid, integer) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.public_recent_reviews(uuid, integer) TO anon, authenticated, service_role;

-- Staff of the shop still see their hidden reviews; the public does not.
CREATE OR REPLACE FUNCTION public.get_barber_reviews(p_barber_id uuid, p_limit int DEFAULT 12)
RETURNS TABLE (id uuid, rating int, comment text, created_at timestamptz, reviewer_name text, service_name text, service_name_ar text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.id, r.rating, r.comment, r.created_at, r.reviewer_name,
         sv.name, sv.name_ar
    FROM public.reviews r
    JOIN public.appointments a ON a.id = r.appointment_id
    JOIN public.profiles p     ON p.id = a.barber_id
    LEFT JOIN public.services sv ON sv.id = a.service_ids[1]
   WHERE a.barber_id = p_barber_id
     AND ((p.is_public AND public.shop_is_public(a.shop_id) AND r.hidden_at IS NULL)
          OR public.is_staff_of_shop(a.shop_id))
   ORDER BY r.created_at DESC
   LIMIT least(greatest(coalesce(p_limit, 12), 1), 50);
$$;
REVOKE ALL ON FUNCTION public.get_barber_reviews(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_barber_reviews(uuid, int) TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.barber_rating_view AS
  SELECT a.barber_id,
         a.shop_id,
         round(avg(r.rating)::numeric, 2) AS rating_avg,
         count(*)::int                    AS rating_count
    FROM public.reviews r
    JOIN public.appointments a ON a.id = r.appointment_id
   WHERE a.barber_id IS NOT NULL
     AND r.rating BETWEEN 1 AND 5
     AND r.hidden_at IS NULL
   GROUP BY a.barber_id, a.shop_id;
REVOKE ALL ON public.barber_rating_view FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.barber_rating_view TO anon, authenticated, service_role;

-- ─── 5. A suspended shop never becomes published ──────────────────────────
-- The re-publish guard no longer depends on current_user, so SECURITY
-- DEFINER paths (create_shop_from_wizard, admin_update_shop) are covered.
-- admin_set_shop_suspended clears suspended_at in the same UPDATE, so lifting
-- a suspension still restores publication.
CREATE OR REPLACE FUNCTION public.admin_guard_platform_columns()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_privileged boolean := current_user IN ('postgres', 'supabase_admin', 'service_role');
BEGIN
  -- (nested: NEW has no suspended_at on profiles / reviews)
  IF TG_TABLE_NAME = 'shops' THEN
    IF NEW.suspended_at IS NOT NULL AND COALESCE(NEW.is_published, false) THEN
      IF TG_OP = 'INSERT' THEN
        RAISE EXCEPTION 'SHOP_SUSPENDED' USING ERRCODE = 'P0001';
      ELSIF NOT COALESCE(OLD.is_published, false) THEN
        RAISE EXCEPTION 'SHOP_SUSPENDED' USING ERRCODE = 'P0001';
      END IF;
    END IF;
  END IF;

  IF v_privileged THEN
    RETURN NEW;
  END IF;

  IF TG_TABLE_NAME = 'shops' THEN
    IF (TG_OP = 'INSERT' AND NEW.suspended_at IS NOT NULL)
       OR (TG_OP = 'UPDATE' AND NEW.suspended_at IS DISTINCT FROM OLD.suspended_at) THEN
      RAISE EXCEPTION 'FORBIDDEN: suspended_at is set by the platform' USING ERRCODE = '42501';
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
REVOKE ALL ON FUNCTION public.admin_guard_platform_columns() FROM PUBLIC, anon, authenticated;

-- ─── 6. Messaging without a provider ──────────────────────────────────────
-- With no provider configured (or none seen for a day), due 'queued' rows
-- become 'fallback' (wa.me click-to-send) by the same rules as the
-- dispatcher (quiet hours, stale bookings, opt-outs). Service role / pg_cron.
CREATE OR REPLACE FUNCTION public.messaging_fallback_sweep()
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM public.messaging_runtime r
             WHERE r.id = 1 AND cardinality(r.providers) > 0
               AND r.last_run_at > now() - interval '1 day') THEN
    RETURN jsonb_build_object('skipped', true, 'reason', 'LIVE');
  END IF;
  RETURN public.messaging_claim(200, false);
END;
$$;
REVOKE ALL ON FUNCTION public.messaging_fallback_sweep() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_fallback_sweep() TO service_role;

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE $q$SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'halaqy_messaging_fallback'$q$;
    EXECUTE $q$SELECT cron.schedule('halaqy_messaging_fallback', '*/5 * * * *', 'SELECT public.messaging_fallback_sweep()')$q$;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'messaging fallback cron not scheduled: %', SQLERRM;
END $$;

-- ─── 7. PDPL erasure / export: staff push outbox and walk-in queue ────────
CREATE OR REPLACE FUNCTION public.privacy_scrub_ops_tables(p_appts uuid[], p_clients uuid[], p_keys text[])
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF to_regclass('public.staff_push_outbox') IS NOT NULL THEN
    UPDATE public.staff_push_outbox o
    SET payload = o.payload - 'client_name' - 'client_phone' - 'phone'
    WHERE o.appointment_id = ANY(COALESCE(p_appts, '{}'))
      AND (o.payload ? 'client_name' OR o.payload ? 'client_phone' OR o.payload ? 'phone');
  END IF;
  IF to_regclass('public.walk_in_queue') IS NOT NULL THEN
    UPDATE public.walk_in_queue q
    SET client_name = NULL, phone = NULL, note = NULL, client_id = NULL
    WHERE q.client_id = ANY(COALESCE(p_clients, '{}'))
       OR q.appointment_id = ANY(COALESCE(p_appts, '{}'))
       OR (q.phone IS NOT NULL AND public.privacy_phone_key(q.phone) = ANY(COALESCE(p_keys, '{}')));
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.privacy_scrub_ops_tables(uuid[], uuid[], text[]) FROM PUBLIC, anon, authenticated, service_role;

CREATE OR REPLACE FUNCTION public.privacy_export_ops_tables(p_appts uuid[], p_clients uuid[], p_keys text[])
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_out jsonb := '{}'::jsonb;
BEGIN
  IF to_regclass('public.staff_push_outbox') IS NOT NULL THEN
    v_out := v_out || jsonb_build_object('staff_notifications', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('event', o.event, 'appointment_id', o.appointment_id,
                                          'payload', o.payload, 'created_at', o.created_at) ORDER BY o.created_at)
      FROM public.staff_push_outbox o
      WHERE o.appointment_id = ANY(COALESCE(p_appts, '{}'))), '[]'::jsonb));
  END IF;
  IF to_regclass('public.walk_in_queue') IS NOT NULL THEN
    v_out := v_out || jsonb_build_object('walk_in_queue', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('shop_id', q.shop_id, 'ticket_no', q.ticket_no, 'client_name', q.client_name,
                                          'phone', q.phone, 'status', q.status, 'note', q.note,
                                          'checked_in_at', q.checked_in_at, 'finished_at', q.finished_at)
                       ORDER BY q.checked_in_at)
      FROM public.walk_in_queue q
      WHERE q.client_id = ANY(COALESCE(p_clients, '{}'))
         OR q.appointment_id = ANY(COALESCE(p_appts, '{}'))
         OR (q.phone IS NOT NULL AND public.privacy_phone_key(q.phone) = ANY(COALESCE(p_keys, '{}')))), '[]'::jsonb));
  END IF;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.privacy_export_ops_tables(uuid[], uuid[], text[]) FROM PUBLIC, anon, authenticated, service_role;

DO $$
DECLARE
  d0 text;
  d  text;
BEGIN
  d0 := pg_get_functiondef('public.delete_my_account(text)'::regprocedure);
  IF position('privacy_scrub_ops_tables' IN d0) = 0 THEN
    d := replace(d0, E'  UPDATE public.clients\n  SET name = v_name, phone = NULL',
                     E'  PERFORM public.privacy_scrub_ops_tables(v_appts, v_clients, v_keys);\n\n  UPDATE public.clients\n  SET name = v_name, phone = NULL');
    IF d = d0 THEN
      RAISE EXCEPTION 'phase1 review fixes: delete_my_account anchor not found';
    END IF;
    EXECUTE d;
  END IF;

  d0 := pg_get_functiondef('public.export_my_data()'::regprocedure);
  IF position('privacy_export_ops_tables' IN d0) = 0 THEN
    d := replace(d0, E'\n  RETURN v_out;\nEND;',
                     E'\n  v_out := v_out || public.privacy_export_ops_tables(v_appts, v_clients, public.privacy_my_phone_keys(v_uid, v_clients));\n  RETURN v_out;\nEND;');
    IF d = d0 THEN
      RAISE EXCEPTION 'phase1 review fixes: export_my_data anchor not found';
    END IF;
    EXECUTE d;
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.delete_my_account(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.delete_my_account(text) TO authenticated;
REVOKE ALL ON FUNCTION public.export_my_data() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.export_my_data() TO authenticated, service_role;
