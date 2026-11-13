-- ═══════════════════════════════════════════════════════════════════════
-- WS-1D · Booking flow v2
--
--   1. services: price_type, audience, location_type, descriptions, client
--      notes, online_bookable. barber_services.price_override.
--      shops.important_info_en/ar (public).
--   2. service_variants (public read of active rows, admin write).
--   3. appointment_services: one row per booked line. appointments.service_ids
--      stays populated (back-compat); a sync trigger fills lines for
--      appointments created elsewhere (dashboard, legacy RPCs), and the
--      existing rows are back-filled.
--   4. booking_attribution: ?src= / ?entry= per online booking (staff read).
--   5. phone_verifications + otp_issue / otp_verify (service_role only) for
--      the self-hosted OTP route. No client access at all.
--   6. create_public_booking: same first 8 parameters (live clients keep
--      working) plus p_items, p_entry, p_otp_token, p_captcha_token. Every
--      path re-checks is_slot_bookable under the per-barber advisory lock.
--   7. reschedule_booking(p_id, p_date, p_start[, p_barber_id]): one UPDATE,
--      so the old slot is held until the new one commits.
--
-- Idempotent and safe on production data: ADD COLUMN IF NOT EXISTS with
-- defaults, CREATE TABLE IF NOT EXISTS, CHECKs that every existing row
-- satisfies (new columns) or NOT VALID, CREATE OR REPLACE FUNCTION.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Columns ────────────────────────────────────────────────────────
ALTER TABLE public.services
  ADD COLUMN IF NOT EXISTS price_type      text    NOT NULL DEFAULT 'fixed',
  ADD COLUMN IF NOT EXISTS audience        text    NOT NULL DEFAULT 'everyone',
  ADD COLUMN IF NOT EXISTS location_type   text    NOT NULL DEFAULT 'in_shop',
  ADD COLUMN IF NOT EXISTS description_en  text,
  ADD COLUMN IF NOT EXISTS description_ar  text,
  ADD COLUMN IF NOT EXISTS client_note_en  text,
  ADD COLUMN IF NOT EXISTS client_note_ar  text,
  ADD COLUMN IF NOT EXISTS online_bookable boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_price_type_check') THEN
    ALTER TABLE public.services ADD CONSTRAINT services_price_type_check
      CHECK (price_type IN ('fixed', 'from', 'free'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_audience_check') THEN
    ALTER TABLE public.services ADD CONSTRAINT services_audience_check
      CHECK (audience IN ('everyone', 'men', 'women', 'kids'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_location_type_check') THEN
    ALTER TABLE public.services ADD CONSTRAINT services_location_type_check
      CHECK (location_type IN ('in_shop', 'home'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_texts_len') THEN
    ALTER TABLE public.services ADD CONSTRAINT services_texts_len CHECK (
      (description_en IS NULL OR length(description_en) <= 1000) AND
      (description_ar IS NULL OR length(description_ar) <= 1000) AND
      (client_note_en IS NULL OR length(client_note_en) <= 500) AND
      (client_note_ar IS NULL OR length(client_note_ar) <= 500));
  END IF;
END $$;

ALTER TABLE public.barber_services
  ADD COLUMN IF NOT EXISTS price_override numeric(10,3);
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'barber_services_price_override_range') THEN
    ALTER TABLE public.barber_services ADD CONSTRAINT barber_services_price_override_range
      CHECK (price_override IS NULL OR (price_override >= 0 AND price_override <= 10000));
  END IF;
END $$;

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS important_info_en text,
  ADD COLUMN IF NOT EXISTS important_info_ar text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_important_info_len') THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_important_info_len CHECK (
      (important_info_en IS NULL OR length(important_info_en) <= 1000) AND
      (important_info_ar IS NULL OR length(important_info_ar) <= 1000));
  END IF;
END $$;
-- shops uses column-level SELECT grants; these two are public by design.
GRANT SELECT (important_info_en, important_info_ar) ON public.shops TO anon, authenticated;

-- ─── 2. service_variants ───────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.service_variants (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  service_id  uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name_en     text NOT NULL CHECK (length(trim(name_en)) BETWEEN 1 AND 100),
  name_ar     text CHECK (name_ar IS NULL OR length(name_ar) <= 100),
  price       numeric(10,3) NOT NULL CHECK (price >= 0 AND price <= 10000),
  duration    int NOT NULL CHECK (duration BETWEEN 5 AND 480),
  sort        int NOT NULL DEFAULT 0,
  is_active   boolean NOT NULL DEFAULT true,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_service_variants_service ON public.service_variants (service_id, sort);
CREATE INDEX IF NOT EXISTS idx_service_variants_shop ON public.service_variants (shop_id);

-- shop_id always follows the parent service (clients cannot spoof it).
CREATE OR REPLACE FUNCTION public.service_variants_set_shop()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  SELECT s.shop_id INTO NEW.shop_id FROM public.services s WHERE s.id = NEW.service_id;
  IF NEW.shop_id IS NULL THEN
    RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.service_variants_set_shop() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS service_variants_set_shop ON public.service_variants;
CREATE TRIGGER service_variants_set_shop
  BEFORE INSERT OR UPDATE OF service_id ON public.service_variants
  FOR EACH ROW EXECUTE FUNCTION public.service_variants_set_shop();
DROP TRIGGER IF EXISTS set_updated_at ON public.service_variants;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.service_variants
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

ALTER TABLE public.service_variants ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.service_variants FROM anon, authenticated;
GRANT SELECT ON public.service_variants TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.service_variants TO authenticated;

DROP POLICY IF EXISTS service_variants_select_public ON public.service_variants;
CREATE POLICY service_variants_select_public ON public.service_variants
  FOR SELECT TO anon, authenticated
  USING (is_active AND EXISTS (SELECT 1 FROM public.services s
                               WHERE s.id = service_variants.service_id AND s.is_active IS TRUE));
DROP POLICY IF EXISTS service_variants_select_staff ON public.service_variants;
CREATE POLICY service_variants_select_staff ON public.service_variants
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()));
DROP POLICY IF EXISTS service_variants_insert_admin ON public.service_variants;
CREATE POLICY service_variants_insert_admin ON public.service_variants
  FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
DROP POLICY IF EXISTS service_variants_update_admin ON public.service_variants;
CREATE POLICY service_variants_update_admin ON public.service_variants
  FOR UPDATE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
DROP POLICY IF EXISTS service_variants_delete_admin ON public.service_variants;
CREATE POLICY service_variants_delete_admin ON public.service_variants
  FOR DELETE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));

-- ─── 3. appointment_services ───────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.appointment_services (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  appointment_id uuid NOT NULL REFERENCES public.appointments(id) ON DELETE CASCADE,
  shop_id        uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  service_id     uuid REFERENCES public.services(id) ON DELETE SET NULL,
  variant_id     uuid REFERENCES public.service_variants(id) ON DELETE SET NULL,
  barber_id      uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name           text,
  name_ar        text,
  price          numeric(10,3) NOT NULL DEFAULT 0 CHECK (price >= 0),
  duration       int NOT NULL DEFAULT 0 CHECK (duration >= 0 AND duration <= 720),
  sort           int NOT NULL DEFAULT 0,
  client_note    text CHECK (client_note IS NULL OR length(client_note) <= 300),
  created_at     timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_appointment_services_appt ON public.appointment_services (appointment_id, sort);
CREATE INDEX IF NOT EXISTS idx_appointment_services_shop ON public.appointment_services (shop_id, service_id);

ALTER TABLE public.appointment_services ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.appointment_services FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.appointment_services TO authenticated;

DROP POLICY IF EXISTS appointment_services_select_staff ON public.appointment_services;
CREATE POLICY appointment_services_select_staff ON public.appointment_services
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
DROP POLICY IF EXISTS appointment_services_select_customer ON public.appointment_services;
CREATE POLICY appointment_services_select_customer ON public.appointment_services
  FOR SELECT TO authenticated
  USING (EXISTS (SELECT 1 FROM public.appointments a
                 WHERE a.id = appointment_services.appointment_id
                   AND a.client_id IN (SELECT public.my_client_ids())));
DROP POLICY IF EXISTS appointment_services_write_admin ON public.appointment_services;
CREATE POLICY appointment_services_write_admin ON public.appointment_services
  FOR ALL TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin())
              AND EXISTS (SELECT 1 FROM public.appointments a
                          WHERE a.id = appointment_services.appointment_id AND a.shop_id = appointment_services.shop_id));

-- Lines from service_ids (current catalogue price/duration; a single-service
-- appointment keeps its stored price). Used by the sync trigger + back-fill.
CREATE OR REPLACE FUNCTION public.appointment_services_rebuild(p_appointment_id uuid)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  DELETE FROM public.appointment_services WHERE appointment_id = p_appointment_id;
  INSERT INTO public.appointment_services
    (appointment_id, shop_id, service_id, barber_id, name, name_ar, price, duration, sort)
  SELECT a.id, a.shop_id, s.id, a.barber_id, s.name, s.name_ar,
         CASE WHEN cardinality(a.service_ids) = 1 THEN GREATEST(COALESCE(a.price, 0), 0) ELSE s.price END,
         CASE WHEN cardinality(a.service_ids) = 1
              THEN LEAST(GREATEST((extract(epoch FROM (a.end_time - a.start_time)) / 60)::int, 0), 720)
              ELSE s.duration END,
         u.ord::int - 1
  FROM public.appointments a
  CROSS JOIN LATERAL unnest(a.service_ids) WITH ORDINALITY AS u(sid, ord)
  JOIN public.services s ON s.id = u.sid AND s.shop_id = a.shop_id
  WHERE a.id = p_appointment_id;
END;
$$;
REVOKE ALL ON FUNCTION public.appointment_services_rebuild(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.appointment_services_rebuild(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.appointment_services_sync()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  -- create_public_booking / reschedule_booking write their own detailed lines.
  IF current_setting('halaqy.booking_v2_writer', true) = 'on' THEN
    RETURN NEW;
  END IF;
  IF TG_OP = 'INSERT' THEN
    IF cardinality(NEW.service_ids) > 0 THEN
      PERFORM public.appointment_services_rebuild(NEW.id);
    END IF;
  ELSIF NEW.service_ids IS DISTINCT FROM OLD.service_ids THEN
    -- Only rebuild when the set really changed (keeps variants and notes).
    IF NOT EXISTS (
      SELECT 1 FROM public.appointment_services x
      WHERE x.appointment_id = NEW.id
      HAVING array_agg(x.service_id ORDER BY x.service_id) = (SELECT array_agg(v ORDER BY v) FROM unnest(NEW.service_ids) v)
    ) THEN
      PERFORM public.appointment_services_rebuild(NEW.id);
    END IF;
  ELSIF NEW.barber_id IS DISTINCT FROM OLD.barber_id THEN
    UPDATE public.appointment_services SET barber_id = NEW.barber_id
    WHERE appointment_id = NEW.id AND barber_id IS NOT DISTINCT FROM OLD.barber_id;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.appointment_services_sync() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS appointment_services_sync ON public.appointments;
CREATE TRIGGER appointment_services_sync
  AFTER INSERT OR UPDATE OF service_ids, barber_id ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.appointment_services_sync();

-- Back-fill existing appointments once (idempotent: only those with no lines).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT a.id FROM public.appointments a
           WHERE cardinality(a.service_ids) > 0
             AND NOT EXISTS (SELECT 1 FROM public.appointment_services x WHERE x.appointment_id = a.id)
  LOOP
    PERFORM public.appointment_services_rebuild(r.id);
  END LOOP;
END $$;

-- ─── 4. booking_attribution ────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.booking_attribution (
  appointment_id     uuid PRIMARY KEY REFERENCES public.appointments(id) ON DELETE CASCADE,
  shop_id            uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  src                text CHECK (src IS NULL OR src ~ '^[a-z0-9_.:-]{1,40}$'),
  entry              text CHECK (entry IS NULL OR entry ~ '^[a-z0-9_.:-]{1,40}$'),
  barber_preselected boolean NOT NULL DEFAULT false,
  phone_verified     boolean NOT NULL DEFAULT false,
  created_at         timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_booking_attribution_shop ON public.booking_attribution (shop_id, created_at);
ALTER TABLE public.booking_attribution ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.booking_attribution FROM anon, authenticated;
GRANT SELECT ON public.booking_attribution TO authenticated;
DROP POLICY IF EXISTS booking_attribution_select_staff ON public.booking_attribution;
CREATE POLICY booking_attribution_select_staff ON public.booking_attribution
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));

-- appointments.source stays a small category set (analytics group by it).
CREATE OR REPLACE FUNCTION public.booking_source_category(p_src text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_src IS NULL OR p_src = '' THEN 'online'
    WHEN lower(p_src) IN ('online', 'instagram', 'google', 'word_of_mouth', 'walk_in', 'whatsapp', 'other') THEN lower(p_src)
    WHEN lower(p_src) ~ '^(ig|insta)' THEN 'instagram'
    WHEN lower(p_src) ~ '^(wa|whatsapp)' THEN 'whatsapp'
    WHEN lower(p_src) ~ '^(google|gmb|gbp|maps)' THEN 'google'
    ELSE 'online'
  END;
$$;
GRANT EXECUTE ON FUNCTION public.booking_source_category(text) TO anon, authenticated, service_role;

-- ─── 5. Phone verification (self-hosted OTP route) ─────────────────────
CREATE TABLE IF NOT EXISTS public.phone_verifications (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  phone_key   text NOT NULL,
  code_hash   text NOT NULL,
  attempts    int NOT NULL DEFAULT 0,
  expires_at  timestamptz NOT NULL,
  verified_at timestamptz,
  token_hash  text UNIQUE,
  consumed_at timestamptz,
  created_at  timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_phone_verifications_phone ON public.phone_verifications (phone_key, created_at DESC);
ALTER TABLE public.phone_verifications ENABLE ROW LEVEL SECURITY;
-- No policies: only SECURITY DEFINER functions and service_role touch it.
REVOKE ALL ON public.phone_verifications FROM anon, authenticated;

-- Last 9 digits = the Jordanian national number (07X… / 9627X… agree).
CREATE OR REPLACE FUNCTION public.otp_phone_key(p_phone text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, extensions, pg_temp
AS $$
  SELECT encode(extensions.digest('phone:' || right(regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g'), 9), 'sha256'), 'hex');
$$;
REVOKE ALL ON FUNCTION public.otp_phone_key(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.otp_phone_key(text) TO service_role;

-- Issues a 6-digit code (returned once, to the server that sends it).
CREATE OR REPLACE FUNCTION public.otp_issue(p_phone text, p_ttl_seconds int DEFAULT 300)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_digits text := regexp_replace(COALESCE(p_phone, ''), '\D', '', 'g');
  v_key    text;
  v_code   text;
  v_exp    timestamptz := now() + make_interval(secs => LEAST(GREATEST(COALESCE(p_ttl_seconds, 300), 60), 900));
BEGIN
  IF length(v_digits) < 9 OR length(v_digits) > 15 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  v_key := public.otp_phone_key(v_digits);
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

-- Checks a code. Returns {ok:true, token} or {ok:false, code}; never raises
-- for a wrong code so the attempt counter is kept.
CREATE OR REPLACE FUNCTION public.otp_verify(p_phone text, p_code text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_key   text := public.otp_phone_key(p_phone);
  v_row   public.phone_verifications%ROWTYPE;
  v_token text;
BEGIN
  IF p_code IS NULL OR p_code !~ '^\d{6}$' THEN
    RETURN jsonb_build_object('ok', false, 'code', 'OTP_INVALID');
  END IF;
  SELECT * INTO v_row FROM public.phone_verifications
  WHERE phone_key = v_key AND verified_at IS NULL AND expires_at > now()
  ORDER BY created_at DESC LIMIT 1
  FOR UPDATE;
  IF v_row.id IS NULL THEN
    RETURN jsonb_build_object('ok', false, 'code', 'OTP_EXPIRED');
  END IF;
  IF v_row.attempts >= 5 THEN
    RETURN jsonb_build_object('ok', false, 'code', 'OTP_TOO_MANY_ATTEMPTS');
  END IF;
  IF v_row.code_hash <> encode(extensions.digest(v_key || ':' || p_code, 'sha256'), 'hex') THEN
    UPDATE public.phone_verifications SET attempts = attempts + 1 WHERE id = v_row.id;
    RETURN jsonb_build_object('ok', false, 'code',
      CASE WHEN v_row.attempts + 1 >= 5 THEN 'OTP_TOO_MANY_ATTEMPTS' ELSE 'OTP_INVALID' END);
  END IF;
  v_token := encode(extensions.gen_random_bytes(24), 'hex');
  UPDATE public.phone_verifications
  SET verified_at = now(), token_hash = encode(extensions.digest(v_token, 'sha256'), 'hex')
  WHERE id = v_row.id;
  RETURN jsonb_build_object('ok', true, 'token', v_token, 'expires_at', now() + interval '30 minutes');
END;
$$;
REVOKE ALL ON FUNCTION public.otp_verify(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.otp_verify(text, text) TO service_role;

-- ─── 6. create_public_booking v2 ───────────────────────────────────────
-- Same leading 8 parameters as before, so named calls from live clients
-- resolve to this one function (the old signature is dropped to avoid
-- ambiguous overloads).
DROP FUNCTION IF EXISTS public.create_public_booking(uuid, text, text, uuid[], uuid, timestamptz, text, text);

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
  v_tz := COALESCE(NULLIF(v_shop.timezone, ''), 'Asia/Amman');
  v_staff := public.availability_is_staff(p_shop_id);

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
        v_phone_verified := true;
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

-- ─── 7. reschedule_booking ─────────────────────────────────────────────
-- Moves an active booking to p_date + p_start (shop-local "HH:MM"). The
-- customer who owns it or staff of the shop (a barber: own bookings only).
-- One UPDATE under the barber lock: the old slot stays booked until commit.
CREATE OR REPLACE FUNCTION public.reschedule_booking(
  p_id        uuid,
  p_date      date,
  p_start     text,
  p_barber_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_appt    public.appointments%ROWTYPE;
  v_shop    public.shops%ROWTYPE;
  v_tz      text;
  v_staff   boolean;
  v_admin   boolean;
  v_owner   boolean;
  v_start   timestamptz;
  v_end     timestamptz;
  v_minutes int;
  v_barber  uuid;
  v_items   jsonb;
  v_services uuid[];
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  IF p_id IS NULL OR p_date IS NULL OR p_start IS NULL OR p_start !~ '^([01]\d|2[0-3]):[0-5]\d$' THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.check_rate_limit('rpc:reschedule:user:' || v_uid::text, 20, 3600) THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_appt FROM public.appointments WHERE id = p_id FOR UPDATE;
  IF v_appt.id IS NULL THEN
    RAISE EXCEPTION 'APPT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  v_staff := public.availability_is_staff(v_appt.shop_id);
  v_admin := v_staff AND EXISTS (SELECT 1 FROM public.profiles p
                                 WHERE p.id = v_uid AND p.shop_id = v_appt.shop_id AND p.role::text = 'shop_admin');
  v_owner := v_appt.client_id IS NOT NULL AND v_appt.client_id IN (SELECT public.my_client_ids());
  IF NOT v_staff AND NOT v_owner THEN
    RAISE EXCEPTION 'APPT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_staff AND NOT v_admin AND NOT v_owner AND v_appt.barber_id IS DISTINCT FROM v_uid THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'P0001';
  END IF;
  IF v_appt.status NOT IN ('pending', 'confirmed', 'awaiting_deposit') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = 'P0001';
  END IF;
  IF v_appt.start_time <= now() THEN
    RAISE EXCEPTION 'ALREADY_STARTED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = v_appt.shop_id;
  v_tz := COALESCE(NULLIF(v_shop.timezone, ''), 'Asia/Amman');

  IF NOT v_staff AND COALESCE(v_shop.cancellation_policy_hours, 0) > 0
     AND v_appt.start_time < now() + make_interval(hours => v_shop.cancellation_policy_hours) THEN
    RAISE EXCEPTION 'INSIDE_CANCELLATION_WINDOW' USING ERRCODE = 'P0001';
  END IF;

  v_start := (p_date + p_start::time) AT TIME ZONE v_tz;
  IF v_start <= now() THEN
    RAISE EXCEPTION 'SLOT_IN_PAST' USING ERRCODE = 'P0001';
  END IF;
  v_minutes := GREATEST(5, (extract(epoch FROM (v_appt.end_time - v_appt.start_time)) / 60)::int);
  v_end := v_start + make_interval(mins => v_minutes);

  SELECT array_agg(x.service_id ORDER BY x.sort) INTO v_services
  FROM public.appointment_services x
  WHERE x.appointment_id = p_id AND x.service_id IS NOT NULL;
  v_services := COALESCE(v_services, v_appt.service_ids);
  IF v_services IS NULL OR cardinality(v_services) = 0 THEN
    RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  v_items := to_jsonb(v_services);

  IF p_barber_id IS NOT NULL AND p_barber_id IS DISTINCT FROM v_appt.barber_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles p
                   WHERE p.id = p_barber_id AND p.shop_id = v_appt.shop_id
                     AND p.role::text IN ('barber', 'shop_admin')
                     AND (v_staff OR p.online_bookable IS NOT FALSE)) THEN
      RAISE EXCEPTION 'BARBER_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.barber_offers_services(p_barber_id, v_services) THEN
      RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF v_staff AND NOT v_admin AND p_barber_id <> v_uid THEN
      RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'P0001';
    END IF;
    v_barber := p_barber_id;
  ELSE
    v_barber := v_appt.barber_id;
  END IF;
  IF v_barber IS NULL THEN
    v_barber := public.pick_any_barber(v_appt.shop_id, v_start, v_items, p_id, NULL);
    IF v_barber IS NULL THEN
      RAISE EXCEPTION 'NO_BARBER_AVAILABLE' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NOT public.barber_is_working(v_barber, v_start, v_end, v_tz) THEN
    RAISE EXCEPTION 'OUTSIDE_WORKING_HOURS' USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('appt:barber:' || v_barber::text));
  IF NOT public.is_slot_bookable(v_appt.shop_id, v_start, v_items, v_barber, p_id, NULL) THEN
    RAISE EXCEPTION 'SLOT_TAKEN' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    UPDATE public.appointments
    SET start_time = v_start,
        end_time   = v_end,
        barber_id  = v_barber,
        date       = CASE WHEN date IS NULL THEN NULL ELSE (v_start AT TIME ZONE v_tz)::date END
    WHERE id = p_id;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'SLOT_TAKEN' USING ERRCODE = 'P0001';
  END;

  RETURN jsonb_build_object(
    'appointment_id', p_id,
    'barber_id',      v_barber,
    'start_time',     v_start,
    'end_time',       v_end,
    'price',          v_appt.price,
    'currency',       COALESCE(v_appt.currency, v_shop.currency, 'JOD'),
    'service_name',   v_appt.service_name,
    'status',         v_appt.status
  );
END;
$$;

REVOKE ALL ON FUNCTION public.reschedule_booking(uuid, date, text, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.reschedule_booking(uuid, date, text, uuid) TO authenticated, service_role;
