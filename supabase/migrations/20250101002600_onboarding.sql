-- ═══════════════════════════════════════════════════════════════════════════
-- WS-1G · Business sign-up and onboarding wizard
--
--   • onboarding_progress  — one resumable wizard draft per shop.
--   • get_onboarding_state()                 → jsonb   (authenticated)
--   • save_onboarding_progress(step, data)   → timestamptz (authenticated)
--   • create_shop_from_wizard(payload)       → jsonb   (authenticated)
--
-- Flow: the owner signs up (handle_new_user creates the profile, the shop
-- and, via the shops trigger, its organization). The wizard saves its draft
-- after every step, then create_shop_from_wizard applies everything in ONE
-- transaction: shop details, services, barbers, weekly hours and publish.
-- A failure rolls everything back, so an abandoned or failed wizard never
-- leaves orphan services, barbers or hours behind.
--
-- Barbers added in the wizard have no login yet. Each one gets a
-- credential-less auth.users row (no email, no phone, no password, so it can
-- never sign in) because profiles.id references auth.users. The owner can
-- later invite the barber to claim the profile.
--
-- Idempotent: safe to re-run. Touches no existing rows outside the caller's
-- own, not-yet-onboarded shop.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Draft table ────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.onboarding_progress (
  shop_id       uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  step          text NOT NULL DEFAULT 'shop',
  data          jsonb NOT NULL DEFAULT '{}'::jsonb,
  started_by    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now()
);

DO $$ BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_progress_step_check') THEN
    ALTER TABLE public.onboarding_progress ADD CONSTRAINT onboarding_progress_step_check
      CHECK (step IN ('shop', 'location', 'services', 'team', 'hours', 'publish', 'done'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'onboarding_progress_data_check') THEN
    ALTER TABLE public.onboarding_progress ADD CONSTRAINT onboarding_progress_data_check
      CHECK (jsonb_typeof(data) = 'object' AND octet_length(data::text) <= 524288);
  END IF;
END $$;

ALTER TABLE public.onboarding_progress ENABLE ROW LEVEL SECURITY;

-- Admins of the shop may read their draft. All writes go through the
-- SECURITY DEFINER functions below (no INSERT/UPDATE/DELETE grants).
DROP POLICY IF EXISTS onboarding_progress_select_admin ON public.onboarding_progress;
CREATE POLICY onboarding_progress_select_admin ON public.onboarding_progress
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));

REVOKE ALL ON public.onboarding_progress FROM anon, authenticated;
GRANT SELECT ON public.onboarding_progress TO authenticated;
GRANT ALL ON public.onboarding_progress TO service_role;

DROP TRIGGER IF EXISTS set_updated_at ON public.onboarding_progress;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.onboarding_progress
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── 2. Internal helpers ───────────────────────────────────────────────────
-- 'HH:MM' (00:00–23:59) → time, or NULL when blank. Raises on garbage.
CREATE OR REPLACE FUNCTION public.onboarding_parse_time(p_value text, p_field text)
RETURNS time
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_value IS NULL OR btrim(p_value) = '' THEN
    RETURN NULL;
  END IF;
  IF btrim(p_value) !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$' THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = p_field;
  END IF;
  RETURN btrim(p_value)::time;
END;
$$;

-- Trimmed, length-capped text or NULL.
CREATE OR REPLACE FUNCTION public.onboarding_text(p_value text, p_max int)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(left(btrim(regexp_replace(COALESCE(p_value, ''), '\s+', ' ', 'g')), p_max), '');
$$;

-- Avatar: an https URL or a small inline image (the wizard sends a ~160px
-- JPEG/WebP data URL until the 1A media bucket exists). Anything else → NULL.
CREATE OR REPLACE FUNCTION public.onboarding_avatar(p_value text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_value IS NULL THEN NULL
    WHEN p_value ~ '^https://[^\s"''<>]+$' AND length(p_value) <= 2000 THEN p_value
    WHEN p_value ~ '^data:image/(jpeg|png|webp);base64,[A-Za-z0-9+/=]+$'
         AND length(p_value) <= 120000 THEN p_value
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.onboarding_parse_time(text, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.onboarding_text(text, int) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.onboarding_avatar(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_parse_time(text, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.onboarding_text(text, int) TO service_role;
GRANT EXECUTE ON FUNCTION public.onboarding_avatar(text) TO service_role;

-- True when the shop may still be (re)configured by the wizard: the draft is
-- not completed and the shop has never taken a booking or recorded a sale
-- (the wizard replaces the service list, so history must not exist yet).
CREATE OR REPLACE FUNCTION public.onboarding_shop_eligible(p_shop_id uuid)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_has_sales boolean := false;
BEGIN
  IF p_shop_id IS NULL THEN
    RETURN false;
  END IF;
  IF EXISTS (SELECT 1 FROM public.appointments a WHERE a.shop_id = p_shop_id)
     OR EXISTS (SELECT 1 FROM public.onboarding_progress o
                WHERE o.shop_id = p_shop_id AND o.completed_at IS NOT NULL) THEN
    RETURN false;
  END IF;
  -- WS-1F tables may not exist yet on this database.
  IF to_regclass('public.sales') IS NOT NULL THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.sales WHERE shop_id = $1)' INTO v_has_sales USING p_shop_id;
    IF v_has_sales THEN RETURN false; END IF;
  END IF;
  IF to_regclass('public.daily_sales') IS NOT NULL
     AND (SELECT c.relkind FROM pg_class c WHERE c.oid = to_regclass('public.daily_sales')) = 'r' THEN
    EXECUTE 'SELECT EXISTS (SELECT 1 FROM public.daily_sales WHERE shop_id = $1)' INTO v_has_sales USING p_shop_id;
    IF v_has_sales THEN RETURN false; END IF;
  END IF;
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.onboarding_shop_eligible(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.onboarding_shop_eligible(uuid) TO service_role;

-- ─── 3. get_onboarding_state() ─────────────────────────────────────────────
-- Everything the /start page needs to resume, in one call.
DROP FUNCTION IF EXISTS public.get_onboarding_state();
CREATE FUNCTION public.get_onboarding_state()
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_prof record;
  v_shop record;
  v_prog record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;

  SELECT p.id, p.role::text AS role, p.shop_id, p.full_name, p.phone
    INTO v_prof FROM public.profiles p WHERE p.id = v_uid;

  IF NOT FOUND OR v_prof.role <> 'shop_admin' THEN
    RETURN jsonb_build_object('role', COALESCE(v_prof.role, 'customer'), 'shop_id', NULL, 'eligible', false);
  END IF;

  IF v_prof.shop_id IS NULL THEN
    RETURN jsonb_build_object('role', 'shop_admin', 'shop_id', NULL, 'eligible', true,
                              'owner', jsonb_build_object('full_name', v_prof.full_name, 'phone', v_prof.phone));
  END IF;

  SELECT s.id, s.name, s.name_ar, s.slug, s.slug_ar, s.phone, s.whatsapp, s.city_id, s.area_id,
         s.lat, s.lng, s.landmark_en, s.landmark_ar, s.is_published, s.marketplace_visible
    INTO v_shop FROM public.shops s WHERE s.id = v_prof.shop_id;

  SELECT o.step, o.data, o.completed_at, o.updated_at
    INTO v_prog FROM public.onboarding_progress o WHERE o.shop_id = v_prof.shop_id;

  RETURN jsonb_build_object(
    'role', 'shop_admin',
    'shop_id', v_prof.shop_id,
    'eligible', public.onboarding_shop_eligible(v_prof.shop_id),
    'has_appointments', EXISTS (SELECT 1 FROM public.appointments a WHERE a.shop_id = v_prof.shop_id),
    'owner', jsonb_build_object('full_name', v_prof.full_name, 'phone', v_prof.phone),
    'shop', jsonb_build_object(
      'name', v_shop.name, 'name_ar', v_shop.name_ar, 'slug', v_shop.slug, 'slug_ar', v_shop.slug_ar,
      'phone', v_shop.phone, 'whatsapp', v_shop.whatsapp, 'city_id', v_shop.city_id,
      'area_id', v_shop.area_id, 'lat', v_shop.lat, 'lng', v_shop.lng,
      'landmark_en', v_shop.landmark_en, 'landmark_ar', v_shop.landmark_ar,
      'is_published', v_shop.is_published, 'marketplace_visible', v_shop.marketplace_visible),
    'progress', CASE WHEN v_prog IS NULL OR v_prog.step IS NULL THEN NULL ELSE jsonb_build_object(
      'step', v_prog.step, 'data', v_prog.data,
      'completed_at', v_prog.completed_at, 'updated_at', v_prog.updated_at) END,
    'services', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('name', sv.name, 'name_ar', sv.name_ar,
                                          'duration', sv.duration, 'price', sv.price)
                       ORDER BY sv.sort_order, sv.created_at)
      FROM public.services sv WHERE sv.shop_id = v_prof.shop_id AND sv.is_active IS TRUE), '[]'::jsonb)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_onboarding_state() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_onboarding_state() TO authenticated, service_role;

-- ─── 4. save_onboarding_progress(step, data) ───────────────────────────────
DROP FUNCTION IF EXISTS public.save_onboarding_progress(text, jsonb);
CREATE FUNCTION public.save_onboarding_progress(p_step text, p_data jsonb)
RETURNS timestamptz
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid  uuid := auth.uid();
  v_shop uuid;
  v_at   timestamptz;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  SELECT p.shop_id INTO v_shop FROM public.profiles p
   WHERE p.id = v_uid AND p.role::text = 'shop_admin';
  IF v_shop IS NULL THEN
    RAISE EXCEPTION 'NOT_SHOP_OWNER' USING ERRCODE = 'P0001';
  END IF;
  IF p_step IS NULL OR p_step NOT IN ('shop', 'location', 'services', 'team', 'hours', 'publish') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'step';
  END IF;
  IF p_data IS NULL OR jsonb_typeof(p_data) <> 'object' OR octet_length(p_data::text) > 524288 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'data';
  END IF;
  IF EXISTS (SELECT 1 FROM public.onboarding_progress o WHERE o.shop_id = v_shop AND o.completed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'ONBOARDING_DONE' USING ERRCODE = 'P0001';
  END IF;

  INSERT INTO public.onboarding_progress AS o (shop_id, step, data, started_by)
  VALUES (v_shop, p_step, p_data, v_uid)
  ON CONFLICT (shop_id) DO UPDATE
    SET step = EXCLUDED.step, data = EXCLUDED.data, updated_at = now()
    WHERE o.completed_at IS NULL
  RETURNING o.updated_at INTO v_at;

  RETURN v_at;
END;
$$;
REVOKE ALL ON FUNCTION public.save_onboarding_progress(text, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_onboarding_progress(text, jsonb) TO authenticated, service_role;

-- ─── 5. create_shop_from_wizard(payload) ───────────────────────────────────
-- payload:
-- {
--   "shop":   {"name_en","name_ar","phone","whatsapp","city_id","area_id",
--              "lat","lng","landmark_en","landmark_ar","address"},
--   "services": [{"name","name_ar","duration","price","category","icon"}],   1–40
--   "owner":  {"is_barber": true},
--   "barbers": [{"full_name","avatar_url"}],                                 0–20
--   "hours":  [{"day_of_week":0-6,"is_working","start","end",
--               "break_start","break_end"}],                                 7 rows
--   "publish": true, "marketplace_visible": true
-- }
-- Returns {shop_id, slug, slug_ar, is_published, marketplace_visible,
--          services, barbers}. Errors (P0001): NOT_AUTHENTICATED,
-- NOT_SHOP_OWNER, ONBOARDING_DONE, NOT_ELIGIBLE, INVALID_INPUT (DETAIL = field).
DROP FUNCTION IF EXISTS public.create_shop_from_wizard(jsonb);
CREATE FUNCTION public.create_shop_from_wizard(payload jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid        uuid := auth.uid();
  v_role       text;
  v_shop_id    uuid;
  v_shop       jsonb := COALESCE(payload->'shop', '{}'::jsonb);
  v_name_en    text;
  v_name_ar    text;
  v_city       uuid;
  v_area       uuid;
  v_lat        float8;
  v_lng        float8;
  v_publish    boolean := COALESCE((payload->>'publish')::boolean, true);
  v_visible    boolean := COALESCE((payload->>'marketplace_visible')::boolean, true);
  v_owner_cuts boolean := COALESCE((payload#>>'{owner,is_barber}')::boolean, true);
  v_item       jsonb;
  v_idx        int := 0;
  v_svc_name   text;
  v_svc_ar     text;
  v_dur        int;
  v_price      numeric;
  v_cat        uuid;
  v_barber_ids uuid[] := ARRAY[]::uuid[];
  v_new_uid    uuid;
  v_bname      text;
  v_day        int;
  v_days       int[] := ARRAY[]::int[];
  v_start      time;
  v_end        time;
  v_bstart     time;
  v_bend       time;
  v_working    boolean;
  v_services   int := 0;
  v_result     record;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  IF payload IS NULL OR jsonb_typeof(payload) <> 'object' OR octet_length(payload::text) > 1048576 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'payload';
  END IF;

  SELECT p.role::text, p.shop_id INTO v_role, v_shop_id
    FROM public.profiles p WHERE p.id = v_uid FOR UPDATE;
  IF v_role IS DISTINCT FROM 'shop_admin' THEN
    RAISE EXCEPTION 'NOT_SHOP_OWNER' USING ERRCODE = 'P0001';
  END IF;

  -- ── Shop fields ──
  v_name_en := public.onboarding_text(v_shop->>'name_en', 100);
  v_name_ar := public.onboarding_text(v_shop->>'name_ar', 100);
  IF v_name_en IS NULL AND v_name_ar IS NULL THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'shop.name';
  END IF;

  BEGIN
    v_city := NULLIF(v_shop->>'city_id', '')::uuid;
    v_area := NULLIF(v_shop->>'area_id', '')::uuid;
    v_lat  := NULLIF(v_shop->>'lat', '')::float8;
    v_lng  := NULLIF(v_shop->>'lng', '')::float8;
  EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'shop.location';
  END;
  IF v_city IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.cities c WHERE c.id = v_city) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'shop.city_id';
  END IF;
  IF v_area IS NOT NULL THEN
    IF NOT EXISTS (SELECT 1 FROM public.areas a WHERE a.id = v_area
                   AND (v_city IS NULL OR a.city_id = v_city)) THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'shop.area_id';
    END IF;
    IF v_city IS NULL THEN
      SELECT a.city_id INTO v_city FROM public.areas a WHERE a.id = v_area;
    END IF;
  END IF;
  -- Jordan's bounding box (with margin). A pin outside it is a mistake.
  IF (v_lat IS NULL) <> (v_lng IS NULL)
     OR (v_lat IS NOT NULL AND (v_lat NOT BETWEEN 29.0 AND 33.6 OR v_lng NOT BETWEEN 34.8 AND 39.4)) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'shop.lat_lng';
  END IF;

  IF jsonb_typeof(payload->'services') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'services') NOT BETWEEN 1 AND 40 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'services';
  END IF;
  IF payload ? 'barbers' AND (jsonb_typeof(payload->'barbers') <> 'array'
                              OR jsonb_array_length(payload->'barbers') > 20) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'barbers';
  END IF;
  IF jsonb_typeof(payload->'hours') IS DISTINCT FROM 'array'
     OR jsonb_array_length(payload->'hours') NOT BETWEEN 1 AND 7 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'hours';
  END IF;

  -- ── Shop row: reuse the signup shop, or create one (org via shops trigger) ──
  IF v_shop_id IS NULL THEN
    INSERT INTO public.shops (name, timezone)
    VALUES (COALESCE(v_name_en, v_name_ar), 'Asia/Amman')
    RETURNING id INTO v_shop_id;
    UPDATE public.profiles SET shop_id = v_shop_id WHERE id = v_uid;
  END IF;

  -- Serialise double submits for this shop.
  PERFORM 1 FROM public.shops s WHERE s.id = v_shop_id FOR UPDATE;
  PERFORM pg_advisory_xact_lock(hashtext('onboarding:' || v_shop_id::text));

  IF EXISTS (SELECT 1 FROM public.onboarding_progress o
             WHERE o.shop_id = v_shop_id AND o.completed_at IS NOT NULL) THEN
    RAISE EXCEPTION 'ONBOARDING_DONE' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.onboarding_shop_eligible(v_shop_id) THEN
    RAISE EXCEPTION 'NOT_ELIGIBLE' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.shops s SET
    name        = COALESCE(v_name_en, v_name_ar),
    name_ar     = v_name_ar,
    phone       = COALESCE(public.onboarding_text(v_shop->>'phone', 30), s.phone),
    whatsapp    = COALESCE(public.onboarding_text(v_shop->>'whatsapp', 30),
                           public.onboarding_text(v_shop->>'phone', 30), s.whatsapp),
    city_id     = v_city,
    area_id     = v_area,
    lat         = v_lat,
    lng         = v_lng,
    landmark_en = public.onboarding_text(v_shop->>'landmark_en', 200),
    landmark_ar = public.onboarding_text(v_shop->>'landmark_ar', 200),
    address     = COALESCE(public.onboarding_text(v_shop->>'address', 300), s.address),
    -- Never-published shops get fresh slugs from the final name.
    slug        = CASE WHEN s.published_at IS NULL THEN NULL ELSE s.slug END,
    slug_ar     = CASE WHEN s.published_at IS NULL THEN NULL ELSE s.slug_ar END,
    is_published        = v_publish,
    marketplace_visible = v_visible
  WHERE s.id = v_shop_id;

  -- ── Services: replace the signup defaults with the wizard's list ──
  DELETE FROM public.services WHERE shop_id = v_shop_id;

  FOR v_item IN SELECT value FROM jsonb_array_elements(payload->'services') LOOP
    v_idx := v_idx + 1;
    v_svc_name := public.onboarding_text(v_item->>'name', 100);
    v_svc_ar   := public.onboarding_text(v_item->>'name_ar', 100);
    IF v_svc_name IS NULL AND v_svc_ar IS NULL THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'services.' || v_idx || '.name';
    END IF;
    BEGIN
      v_dur   := (v_item->>'duration')::int;
      v_price := round((v_item->>'price')::numeric, 2);
    EXCEPTION WHEN invalid_text_representation OR numeric_value_out_of_range THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'services.' || v_idx;
    END;
    IF v_dur IS NULL OR v_dur NOT BETWEEN 5 AND 480 THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'services.' || v_idx || '.duration';
    END IF;
    IF v_price IS NULL OR v_price < 0 OR v_price > 1000 THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'services.' || v_idx || '.price';
    END IF;

    SELECT c.id INTO v_cat FROM public.service_categories c
     WHERE c.slug = (v_item->>'category') AND c.is_active;
    IF v_cat IS NULL THEN
      v_cat := public.guess_service_category(COALESCE(v_svc_name, v_svc_ar), v_svc_ar);
    END IF;

    INSERT INTO public.services (shop_id, name, name_ar, duration, price, icon, sort_order, category_id, is_active)
    VALUES (v_shop_id, COALESCE(v_svc_name, v_svc_ar), v_svc_ar, v_dur, v_price,
            COALESCE(public.onboarding_text(v_item->>'icon', 30), 'scissors'), v_idx, v_cat, true);
    v_services := v_services + 1;
  END LOOP;

  -- ── Team: the owner (optionally) plus credential-less barber profiles ──
  IF v_owner_cuts THEN
    v_barber_ids := v_barber_ids || v_uid;
    UPDATE public.profiles SET online_bookable = true, auto_assignable = true WHERE id = v_uid;
  ELSE
    DELETE FROM public.working_hours WHERE barber_id = v_uid;
    DELETE FROM public.barber_services WHERE barber_id = v_uid;
    UPDATE public.profiles SET online_bookable = false, auto_assignable = false WHERE id = v_uid;
  END IF;

  v_idx := 0;
  FOR v_item IN SELECT value FROM jsonb_array_elements(COALESCE(payload->'barbers', '[]'::jsonb)) LOOP
    v_idx := v_idx + 1;
    v_bname := public.onboarding_text(v_item->>'full_name', 100);
    IF v_bname IS NULL THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'barbers.' || v_idx || '.full_name';
    END IF;
    v_new_uid := gen_random_uuid();
    -- No email, phone or password: this identity can never sign in.
    INSERT INTO auth.users (instance_id, id, aud, role, raw_app_meta_data, raw_user_meta_data,
                            created_at, updated_at)
    VALUES ('00000000-0000-0000-0000-000000000000', v_new_uid, 'authenticated', 'authenticated',
            jsonb_build_object('provider', 'halaqy_staff', 'providers', '[]'::jsonb,
                               'halaqy_placeholder', true, 'shop_id', v_shop_id),
            jsonb_build_object('full_name', v_bname, 'role', 'customer'),
            now(), now());
    -- handle_new_user has created a customer profile; turn it into a barber.
    INSERT INTO public.profiles (id, shop_id, role, full_name, avatar_url)
    VALUES (v_new_uid, v_shop_id, 'barber', v_bname, public.onboarding_avatar(v_item->>'avatar_url'))
    ON CONFLICT (id) DO UPDATE
      SET shop_id = EXCLUDED.shop_id, role = 'barber',
          full_name = EXCLUDED.full_name, avatar_url = EXCLUDED.avatar_url;
    v_barber_ids := v_barber_ids || v_new_uid;
  END LOOP;

  IF cardinality(v_barber_ids) = 0 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'barbers';
  END IF;

  -- Wizard barbers plus any barber already on the team (their old links went
  -- with the replaced services) offer every new service.
  INSERT INTO public.barber_services (barber_id, service_id)
  SELECT b.id, s.id
  FROM (SELECT unnest(v_barber_ids) AS id
        UNION
        SELECT p.id FROM public.profiles p WHERE p.shop_id = v_shop_id AND p.role::text = 'barber') b
  CROSS JOIN public.services s
  WHERE s.shop_id = v_shop_id
  ON CONFLICT (barber_id, service_id) DO UPDATE SET is_active = true;

  -- ── Weekly hours, applied to every bookable barber ──
  FOR v_item IN SELECT value FROM jsonb_array_elements(payload->'hours') LOOP
    BEGIN
      v_day := (v_item->>'day_of_week')::int;
    EXCEPTION WHEN invalid_text_representation THEN
      v_day := NULL;
    END;
    IF v_day IS NULL OR v_day NOT BETWEEN 0 AND 6 OR v_day = ANY (v_days) THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'hours.day_of_week';
    END IF;
    v_days := v_days || v_day;
    v_working := COALESCE((v_item->>'is_working')::boolean, false);
    v_start  := COALESCE(public.onboarding_parse_time(v_item->>'start', 'hours.start'), '09:00'::time);
    v_end    := COALESCE(public.onboarding_parse_time(v_item->>'end', 'hours.end'), '18:00'::time);
    v_bstart := public.onboarding_parse_time(v_item->>'break_start', 'hours.break_start');
    v_bend   := public.onboarding_parse_time(v_item->>'break_end', 'hours.break_end');
    IF v_working AND v_end <= v_start THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'hours.' || v_day;
    END IF;
    IF (v_bstart IS NULL) <> (v_bend IS NULL)
       OR (v_bstart IS NOT NULL AND NOT (v_bend > v_bstart AND v_bstart >= v_start AND v_bend <= v_end)) THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'hours.' || v_day || '.break';
    END IF;

    INSERT INTO public.working_hours (barber_id, day_of_week, start_time, end_time, is_working, break_start, break_end)
    SELECT b, v_day, v_start, v_end, v_working,
           CASE WHEN v_working THEN v_bstart END, CASE WHEN v_working THEN v_bend END
    FROM unnest(v_barber_ids) AS b
    ON CONFLICT (barber_id, day_of_week) DO UPDATE
      SET start_time = EXCLUDED.start_time, end_time = EXCLUDED.end_time,
          is_working = EXCLUDED.is_working,
          break_start = EXCLUDED.break_start, break_end = EXCLUDED.break_end;
  END LOOP;

  IF NOT (v_days @> ARRAY[0, 1, 2, 3, 4, 5, 6]) THEN
    -- Days the wizard did not send are closed.
    INSERT INTO public.working_hours (barber_id, day_of_week, start_time, end_time, is_working)
    SELECT b, d, '09:00', '18:00', false
    FROM unnest(v_barber_ids) AS b CROSS JOIN generate_series(0, 6) AS d
    WHERE NOT (d = ANY (v_days))
    ON CONFLICT (barber_id, day_of_week) DO UPDATE
      SET is_working = false, break_start = NULL, break_end = NULL;
  END IF;

  IF v_publish AND NOT EXISTS (SELECT 1 FROM unnest(v_days) AS d
                               JOIN jsonb_array_elements(payload->'hours') h
                                 ON (h.value->>'day_of_week')::int = d
                               WHERE COALESCE((h.value->>'is_working')::boolean, false)) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'hours.none_open';
  END IF;

  -- ── Mark the wizard done ──
  INSERT INTO public.onboarding_progress AS o (shop_id, step, data, started_by, completed_at)
  VALUES (v_shop_id, 'done', '{}'::jsonb, v_uid, now())
  ON CONFLICT (shop_id) DO UPDATE
    SET step = 'done', data = '{}'::jsonb, completed_at = now(), updated_at = now();

  SELECT s.id, s.slug, s.slug_ar, s.is_published, s.marketplace_visible
    INTO v_result FROM public.shops s WHERE s.id = v_shop_id;

  RETURN jsonb_build_object(
    'shop_id', v_result.id, 'slug', v_result.slug, 'slug_ar', v_result.slug_ar,
    'is_published', v_result.is_published, 'marketplace_visible', v_result.marketplace_visible,
    'services', v_services, 'barbers', cardinality(v_barber_ids));
END;
$$;
REVOKE ALL ON FUNCTION public.create_shop_from_wizard(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.create_shop_from_wizard(jsonb) TO authenticated, service_role;

COMMENT ON TABLE public.onboarding_progress IS
  'WS-1G resumable onboarding wizard draft, one row per shop. Written only by save_onboarding_progress / create_shop_from_wizard.';
COMMENT ON FUNCTION public.create_shop_from_wizard(jsonb) IS
  'WS-1G: applies the onboarding wizard in one transaction (shop, services, barbers, hours, publish).';
