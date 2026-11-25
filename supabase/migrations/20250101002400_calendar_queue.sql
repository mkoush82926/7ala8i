-- ═══════════════════════════════════════════════════════════════════════════
-- WS-1E · Calendar v2, prayer blocks and front desk (walk-in queue)
--
-- Idempotent and safe on production data:
--   * only ADD COLUMN IF NOT EXISTS / CREATE TABLE IF NOT EXISTS /
--     CREATE OR REPLACE; no NOT NULL or CHECK that existing rows can violate;
--   * get_busy_slots, barber_is_working and the appointments status CHECK are
--     NOT touched; appointments_no_overlap still guards double-booking;
--   * anon gets nothing new except the (public, non-personal) prayer times.
--
-- Prayer-time method ("jordan_awqaf"): Fajr 18°, Isha 18°, Asr Shafi'i
-- (shadow factor 1), sunrise/sunset at 0.833°, plus the Ministry's
-- precautionary minutes: sunrise −6, Dhuhr +1, Maghrib = sunset + 6.
-- Validated (±1 min) against the Ministry of Awqaf's Amman times published
-- by the General Iftaa Department (src/lib/prayer/__fixtures__).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. appointments: front-desk timestamps ────────────────────────────────
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS arrived_at timestamptz;
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS started_at timestamptz;
-- Walk-ins can be saved without a name (already nullable in production; kept
-- explicit so a fresh DB matches).
ALTER TABLE public.appointments ALTER COLUMN client_name DROP NOT NULL;

-- Stamps arrived_at / started_at and enforces the no-show time guard.
CREATE OR REPLACE FUNCTION public.appointments_flow_stamps()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- service_role, or a direct DB session with no JWT at all (cron, SQL).
  v_privileged boolean := coalesce(auth.role(), '') = 'service_role'
                          OR (auth.role() IS NULL AND auth.uid() IS NULL);
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'arrived' THEN
      NEW.arrived_at := coalesce(NEW.arrived_at, now());
    ELSIF NEW.status = 'in_chair' THEN
      NEW.arrived_at := coalesce(NEW.arrived_at, now());
      NEW.started_at := coalesce(NEW.started_at, now());
    ELSIF NEW.status = 'no_show' AND NOT v_privileged AND now() < OLD.start_time THEN
      -- A client can't be a no-show before their appointment has started.
      RAISE EXCEPTION 'NO_SHOW_TOO_EARLY' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.appointments_flow_stamps() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS appointments_flow_stamps ON public.appointments;
CREATE TRIGGER appointments_flow_stamps
  BEFORE UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.appointments_flow_stamps();

-- Undo a no-show (the transition table forbids no_show → anything for the
-- generic status API). Staff only; barbers only for their own appointments.
-- Re-activating can collide with a newer booking → 23P01 (SLOT_TAKEN).
CREATE OR REPLACE FUNCTION public.undo_no_show(p_appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appt public.appointments%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_staff_of_shop(v_appt.shop_id) THEN
    RAISE EXCEPTION 'APPT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.is_admin_of_shop(v_appt.shop_id) AND v_appt.barber_id IS DISTINCT FROM auth.uid() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;
  IF v_appt.status <> 'no_show' THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.appointments SET status = 'confirmed' WHERE id = p_appointment_id;
  RETURN jsonb_build_object('appointment_id', p_appointment_id, 'status', 'confirmed');
END;
$$;
REVOKE ALL ON FUNCTION public.undo_no_show(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.undo_no_show(uuid) TO authenticated, service_role;

-- ─── 2. Calendar column order and colour per team member ───────────────────
-- Barbers live on profiles (P0V); the legacy `barbers` table gets the same
-- columns so both shapes named in the roadmap exist.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS calendar_order integer;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS calendar_color text;
ALTER TABLE public.barbers  ADD COLUMN IF NOT EXISTS calendar_order integer;
ALTER TABLE public.barbers  ADD COLUMN IF NOT EXISTS calendar_color text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_calendar_color_format') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_calendar_color_format
      CHECK (calendar_color IS NULL OR calendar_color ~ '^#[0-9a-fA-F]{6}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'profiles_calendar_order_range') THEN
    ALTER TABLE public.profiles ADD CONSTRAINT profiles_calendar_order_range
      CHECK (calendar_order IS NULL OR calendar_order BETWEEN 0 AND 10000) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'barbers_calendar_color_format') THEN
    ALTER TABLE public.barbers ADD CONSTRAINT barbers_calendar_color_format
      CHECK (calendar_color IS NULL OR calendar_color ~ '^#[0-9a-fA-F]{6}$') NOT VALID;
  END IF;
END $$;

-- Staff-only presentation data (not granted to anon).
GRANT SELECT (calendar_order, calendar_color) ON public.profiles TO authenticated;

-- Saves the shared column order (and optional colours) in one call.
-- p_items: [{"id": uuid, "order": int, "color": "#rrggbb" | null}], ≤ 100.
CREATE OR REPLACE FUNCTION public.save_calendar_team(p_items jsonb)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shop uuid := public.get_current_shop_id();
  v_item jsonb;
  v_count integer := 0;
  v_color text;
BEGIN
  IF v_shop IS NULL OR NOT public.is_admin_of_shop(v_shop) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;
  IF jsonb_typeof(p_items) IS DISTINCT FROM 'array' OR jsonb_array_length(p_items) > 100 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  FOR v_item IN SELECT * FROM jsonb_array_elements(p_items) LOOP
    v_color := nullif(v_item->>'color', '');
    IF v_color IS NOT NULL AND v_color !~ '^#[0-9a-fA-F]{6}$' THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;
    UPDATE public.profiles
       SET calendar_order = least(greatest(coalesce((v_item->>'order')::int, 0), 0), 10000),
           calendar_color = CASE WHEN v_item ? 'color' THEN v_color ELSE calendar_color END
     WHERE id = (v_item->>'id')::uuid
       AND shop_id = v_shop
       AND role IN ('barber', 'shop_admin');
    v_count := v_count + 1;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.save_calendar_team(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.save_calendar_team(jsonb) TO authenticated, service_role;

-- ─── 3. Blocked-time types: stable system keys + defaults ──────────────────
ALTER TABLE public.blocked_time_types ADD COLUMN IF NOT EXISTS system_key text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'blocked_time_types_system_key_check') THEN
    ALTER TABLE public.blocked_time_types ADD CONSTRAINT blocked_time_types_system_key_check
      CHECK (system_key IS NULL OR system_key IN ('prayer', 'jumuah', 'lunch', 'admin')) NOT VALID;
  END IF;
END $$;
CREATE UNIQUE INDEX IF NOT EXISTS blocked_time_types_shop_system_key
  ON public.blocked_time_types (shop_id, system_key) WHERE system_key IS NOT NULL;

-- Internal: inserts the four default types for a shop when missing.
CREATE OR REPLACE FUNCTION public.calendar_seed_block_types(p_shop_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.blocked_time_types (shop_id, system_key, name_en, name_ar, default_minutes, is_paid, sort_order)
  SELECT p_shop_id, d.key, d.name_en, d.name_ar, d.minutes, d.paid, d.sort
    FROM (VALUES
      ('prayer', 'Prayer',  'صلاة',       15, true, 0),
      ('jumuah', 'Jumu''ah', 'صلاة الجمعة', 60, true, 1),
      ('lunch',  'Lunch',   'استراحة غداء', 30, false, 2),
      ('admin',  'Admin',   'أعمال إدارية', 30, true, 3)
    ) AS d(key, name_en, name_ar, minutes, paid, sort)
   WHERE NOT EXISTS (SELECT 1 FROM public.blocked_time_types t
                      WHERE t.shop_id = p_shop_id AND t.system_key = d.key)
  ON CONFLICT DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.calendar_seed_block_types(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.calendar_seed_block_types(uuid) TO service_role;

-- Public wrapper for the dashboard (admin of their own shop).
CREATE OR REPLACE FUNCTION public.ensure_default_block_types()
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shop uuid := public.get_current_shop_id();
BEGIN
  IF v_shop IS NULL OR NOT public.is_admin_of_shop(v_shop) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.calendar_seed_block_types(v_shop);
  RETURN (SELECT count(*)::int FROM public.blocked_time_types WHERE shop_id = v_shop);
END;
$$;
REVOKE ALL ON FUNCTION public.ensure_default_block_types() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.ensure_default_block_types() TO authenticated, service_role;

-- ─── 4. Prayer times ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.prayer_time_cache (
  city_id     uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  date        date NOT NULL,
  method      text NOT NULL DEFAULT 'jordan_awqaf',
  fajr        timestamptz NOT NULL,
  sunrise     timestamptz NOT NULL,
  dhuhr       timestamptz NOT NULL,
  asr         timestamptz NOT NULL,
  maghrib     timestamptz NOT NULL,
  isha        timestamptz NOT NULL,
  computed_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (city_id, date, method),
  CONSTRAINT prayer_time_cache_method_check CHECK (method ~ '^[a-z0-9_]{2,32}$'),
  CONSTRAINT prayer_time_cache_order CHECK (fajr < sunrise AND sunrise < dhuhr AND dhuhr < asr AND asr < maghrib AND maghrib < isha)
);
ALTER TABLE public.prayer_time_cache ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prayer_time_cache_select ON public.prayer_time_cache;
CREATE POLICY prayer_time_cache_select ON public.prayer_time_cache
  FOR SELECT TO anon, authenticated USING (true);
REVOKE ALL ON public.prayer_time_cache FROM anon, authenticated;
GRANT SELECT ON public.prayer_time_cache TO anon, authenticated;
GRANT ALL ON public.prayer_time_cache TO service_role;

CREATE TABLE IF NOT EXISTS public.prayer_block_rules (
  shop_id              uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  prayer               text NOT NULL,
  enabled              boolean NOT NULL DEFAULT false,
  minutes              integer NOT NULL DEFAULT 15,
  start_offset_minutes integer NOT NULL DEFAULT 0,
  jumuah_minutes       integer NOT NULL DEFAULT 0,
  allow_online         boolean NOT NULL DEFAULT false,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, prayer),
  CONSTRAINT prayer_block_rules_prayer_check CHECK (prayer IN ('fajr', 'dhuhr', 'asr', 'maghrib', 'isha')),
  CONSTRAINT prayer_block_rules_minutes_check CHECK (minutes BETWEEN 5 AND 180),
  CONSTRAINT prayer_block_rules_offset_check CHECK (start_offset_minutes BETWEEN -60 AND 60),
  -- Only the dhuhr row uses jumuah_minutes (Friday); 0 = no Jumu'ah block.
  CONSTRAINT prayer_block_rules_jumuah_check CHECK (jumuah_minutes BETWEEN 0 AND 180 AND (prayer = 'dhuhr' OR jumuah_minutes = 0))
);
ALTER TABLE public.prayer_block_rules ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS prayer_block_rules_select_staff ON public.prayer_block_rules;
CREATE POLICY prayer_block_rules_select_staff ON public.prayer_block_rules
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
DROP POLICY IF EXISTS prayer_block_rules_write_admin ON public.prayer_block_rules;
CREATE POLICY prayer_block_rules_write_admin ON public.prayer_block_rules
  FOR ALL TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
REVOKE ALL ON public.prayer_block_rules FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.prayer_block_rules TO authenticated;
GRANT ALL ON public.prayer_block_rules TO service_role;
DROP TRIGGER IF EXISTS set_updated_at ON public.prayer_block_rules;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.prayer_block_rules
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- Internal: sun declination and equation of time for a Julian date.
CREATE OR REPLACE FUNCTION public.prayer_sun_position(p_jd double precision, OUT decl double precision, OUT eqt double precision)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  d  double precision := p_jd - 2451545.0;
  g  double precision;
  q  double precision;
  l  double precision;
  e  double precision;
  ra double precision;
BEGIN
  g := mod((357.529 + 0.98560028 * d)::numeric, 360)::double precision;
  q := mod((280.459 + 0.98564736 * d)::numeric, 360)::double precision;
  IF g < 0 THEN g := g + 360; END IF;
  IF q < 0 THEN q := q + 360; END IF;
  l := q + 1.915 * sind(g) + 0.020 * sind(2 * g);
  l := l - 360 * floor(l / 360);
  e := 23.439 - 0.00000036 * d;
  ra := atan2d(cosd(e) * sind(l), cosd(l)) / 15;
  ra := ra - 24 * floor(ra / 24);
  eqt := q / 15 - ra;
  decl := asind(sind(e) * sind(l));
END;
$$;

-- Astronomical prayer times (praytimes.org algorithm, one refinement pass) as
-- UTC instants rounded to the nearest minute. Defaults are the "jordan_awqaf"
-- method: Fajr 18°, Isha 18°, Asr shadow factor 1, sunrise −6, Dhuhr +1,
-- Maghrib = sunset + 6 min.
DROP FUNCTION IF EXISTS public.prayer_compute_times(double precision, double precision, date, double precision, double precision, double precision, double precision);
-- Mirrors src/lib/prayer (adhan) to within a minute at Jordan's latitudes.
CREATE OR REPLACE FUNCTION public.prayer_compute_times(
  p_lat double precision,
  p_lng double precision,
  p_date date,
  p_fajr_angle double precision DEFAULT 18,
  p_isha_angle double precision DEFAULT 18,
  p_maghrib_offset_min double precision DEFAULT 6,
  p_asr_factor double precision DEFAULT 1,
  p_sunrise_offset_min double precision DEFAULT -6,
  p_dhuhr_offset_min double precision DEFAULT 1
)
RETURNS TABLE (fajr timestamptz, sunrise timestamptz, dhuhr timestamptz, asr timestamptz, maghrib timestamptz, isha timestamptz)
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_jd double precision := (p_date - DATE '2000-01-01') + 2451544.5 - p_lng / 360.0;
  v_init double precision[] := ARRAY[5, 6, 12, 13, 18, 18]; -- fajr, sunrise, dhuhr, asr, sunset, isha
  v_out double precision[] := ARRAY[0, 0, 0, 0, 0, 0]::double precision[];
  v_angle double precision;
  v_noon double precision;
  v_t double precision;
  v_x double precision;
  sp record;
  i int;
BEGIN
  FOR i IN 1..6 LOOP
    sp := public.prayer_sun_position(v_jd + v_init[i] / 24.0);
    v_noon := 12 - sp.eqt;
    v_noon := v_noon - 24 * floor(v_noon / 24);
    IF i = 3 THEN
      v_out[i] := v_noon;
      CONTINUE;
    END IF;
    v_angle := CASE i
      WHEN 1 THEN p_fajr_angle
      WHEN 2 THEN 0.833
      WHEN 4 THEN -atand(1.0 / (p_asr_factor + tand(abs(p_lat - sp.decl))))
      WHEN 5 THEN 0.833
      ELSE p_isha_angle
    END;
    v_x := (-sind(v_angle) - sind(sp.decl) * sind(p_lat)) / (cosd(sp.decl) * cosd(p_lat));
    v_t := acosd(greatest(-1.0, least(1.0, v_x))) / 15.0;
    v_out[i] := CASE WHEN i IN (1, 2) THEN v_noon - v_t ELSE v_noon + v_t END;
  END LOOP;

  -- Local solar time → UTC hours.
  FOR i IN 1..6 LOOP
    v_out[i] := v_out[i] - p_lng / 15.0;
  END LOOP;
  v_out[5] := v_out[5] + p_maghrib_offset_min / 60.0;
  v_out[2] := v_out[2] + p_sunrise_offset_min / 60.0;
  v_out[3] := v_out[3] + p_dhuhr_offset_min / 60.0;

  RETURN QUERY SELECT
    date_trunc('minute', ((p_date::timestamp + make_interval(secs => v_out[1] * 3600)) AT TIME ZONE 'UTC') + interval '30 seconds'),
    date_trunc('minute', ((p_date::timestamp + make_interval(secs => v_out[2] * 3600)) AT TIME ZONE 'UTC') + interval '30 seconds'),
    date_trunc('minute', ((p_date::timestamp + make_interval(secs => v_out[3] * 3600)) AT TIME ZONE 'UTC') + interval '30 seconds'),
    date_trunc('minute', ((p_date::timestamp + make_interval(secs => v_out[4] * 3600)) AT TIME ZONE 'UTC') + interval '30 seconds'),
    date_trunc('minute', ((p_date::timestamp + make_interval(secs => v_out[5] * 3600)) AT TIME ZONE 'UTC') + interval '30 seconds'),
    date_trunc('minute', ((p_date::timestamp + make_interval(secs => v_out[6] * 3600)) AT TIME ZONE 'UTC') + interval '30 seconds');
END;
$$;
REVOKE ALL ON FUNCTION public.prayer_sun_position(double precision) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.prayer_compute_times(double precision, double precision, date, double precision, double precision, double precision, double precision, double precision, double precision) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.prayer_sun_position(double precision) TO service_role;
-- Pure astronomy (no data access): callable by anyone, e.g. a public "prayer times" chip.
GRANT EXECUTE ON FUNCTION public.prayer_compute_times(double precision, double precision, date, double precision, double precision, double precision, double precision, double precision, double precision) TO anon, authenticated, service_role;

-- Internal: the city whose timetable a shop follows (own city → nearest city
-- by pin → Amman).
CREATE OR REPLACE FUNCTION public.prayer_city_for_shop(p_shop_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(
    (SELECT c.id FROM public.cities c WHERE c.id = s.city_id AND c.lat IS NOT NULL AND c.lng IS NOT NULL),
    (SELECT c.id FROM public.cities c
      WHERE s.lat IS NOT NULL AND s.lng IS NOT NULL AND c.lat IS NOT NULL AND c.lng IS NOT NULL
      ORDER BY power(c.lat - s.lat, 2) + power((c.lng - s.lng) * cos(radians(s.lat)), 2)
      LIMIT 1),
    (SELECT c.id FROM public.cities c WHERE c.slug_en = 'amman' AND c.lat IS NOT NULL),
    (SELECT c.id FROM public.cities c WHERE c.lat IS NOT NULL AND c.lng IS NOT NULL ORDER BY c.sort, c.created_at LIMIT 1)
  )
  FROM public.shops s
  WHERE s.id = p_shop_id;
$$;
REVOKE ALL ON FUNCTION public.prayer_city_for_shop(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prayer_city_for_shop(uuid) TO service_role;

-- Fills prayer_time_cache for a city and an inclusive date range (≤ 400 days).
-- Existing rows are kept (a server job may have written authoritative times).
CREATE OR REPLACE FUNCTION public.prayer_fill_cache(p_city_id uuid, p_from date, p_to date)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_lat double precision;
  v_lng double precision;
  v_n integer;
BEGIN
  IF p_city_id IS NULL OR p_from IS NULL OR p_to IS NULL OR p_to < p_from OR p_to - p_from > 400 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  SELECT lat, lng INTO v_lat, v_lng FROM public.cities WHERE id = p_city_id;
  IF v_lat IS NULL OR v_lng IS NULL THEN
    RETURN 0;
  END IF;
  INSERT INTO public.prayer_time_cache (city_id, date, method, fajr, sunrise, dhuhr, asr, maghrib, isha)
  SELECT p_city_id, d::date, 'jordan_awqaf', t.fajr, t.sunrise, t.dhuhr, t.asr, t.maghrib, t.isha
    FROM generate_series(p_from, p_to, interval '1 day') AS d
    CROSS JOIN LATERAL public.prayer_compute_times(v_lat, v_lng, d::date) AS t
  ON CONFLICT (city_id, date, method) DO NOTHING;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.prayer_fill_cache(uuid, date, date) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.prayer_fill_cache(uuid, date, date) TO service_role;

-- Writes shop-wide blocked_times (source = 'prayer') for the next p_days
-- (1..31) local days from prayer_time_cache and the shop's rules. Future
-- prayer blocks are replaced; blocks already started are kept.
--   * cron / service_role: p_shop_id NULL = every shop with an active rule;
--   * a shop admin: their own shop only ("Apply now" in the calendar).
CREATE OR REPLACE FUNCTION public.generate_prayer_blocks(p_shop_id uuid DEFAULT NULL, p_days integer DEFAULT 14)
RETURNS integer
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  -- service_role, or a direct DB session with no JWT at all (pg_cron, SQL).
  v_priv boolean := coalesce(auth.role(), '') = 'service_role'
                    OR (auth.role() IS NULL AND auth.uid() IS NULL);
  v_days integer := least(greatest(coalesce(p_days, 14), 1), 31);
  v_shop record;
  v_city uuid;
  v_from date;
  v_to date;
  v_prayer_type uuid;
  v_jumuah_type uuid;
  v_n integer;
  v_total integer := 0;
BEGIN
  IF NOT v_priv AND (p_shop_id IS NULL OR NOT public.is_admin_of_shop(p_shop_id)) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  FOR v_shop IN
    SELECT s.id, coalesce(nullif(s.timezone, ''), 'Asia/Amman') AS tz
      FROM public.shops s
     WHERE (p_shop_id IS NOT NULL AND s.id = p_shop_id)
        OR (p_shop_id IS NULL AND EXISTS (
              SELECT 1 FROM public.prayer_block_rules r
               WHERE r.shop_id = s.id AND (r.enabled OR r.jumuah_minutes > 0)))
  LOOP
    -- Advisory lock: the nightly job and an "Apply now" never interleave.
    PERFORM pg_advisory_xact_lock(hashtext('prayer:' || v_shop.id::text));

    DELETE FROM public.blocked_times
     WHERE shop_id = v_shop.id AND source = 'prayer' AND start_time >= now();

    IF NOT EXISTS (SELECT 1 FROM public.prayer_block_rules r
                    WHERE r.shop_id = v_shop.id AND (r.enabled OR r.jumuah_minutes > 0)) THEN
      CONTINUE;
    END IF;

    v_city := public.prayer_city_for_shop(v_shop.id);
    IF v_city IS NULL THEN
      CONTINUE;
    END IF;
    BEGIN
      v_from := (now() AT TIME ZONE v_shop.tz)::date;
    EXCEPTION WHEN others THEN
      v_from := (now() AT TIME ZONE 'Asia/Amman')::date;
    END;
    v_to := v_from + v_days - 1;
    PERFORM public.prayer_fill_cache(v_city, v_from, v_to);

    PERFORM public.calendar_seed_block_types(v_shop.id);
    SELECT id INTO v_prayer_type FROM public.blocked_time_types WHERE shop_id = v_shop.id AND system_key = 'prayer';
    SELECT id INTO v_jumuah_type FROM public.blocked_time_types WHERE shop_id = v_shop.id AND system_key = 'jumuah';

    INSERT INTO public.blocked_times (shop_id, barber_id, start_time, end_time, type_id, title, source, allow_online, created_by)
    SELECT v_shop.id, NULL, b.s, b.s + make_interval(mins => b.mins), b.type_id, b.title, 'prayer', b.allow_online, NULL
      FROM (
        SELECT
          (CASE r.prayer
             WHEN 'fajr' THEN c.fajr WHEN 'dhuhr' THEN c.dhuhr WHEN 'asr' THEN c.asr
             WHEN 'maghrib' THEN c.maghrib ELSE c.isha END)
            + make_interval(mins => r.start_offset_minutes) AS s,
          CASE WHEN j.is_jumuah THEN r.jumuah_minutes ELSE r.minutes END AS mins,
          CASE WHEN j.is_jumuah THEN coalesce(v_jumuah_type, v_prayer_type) ELSE v_prayer_type END AS type_id,
          CASE WHEN j.is_jumuah THEN 'jumuah' ELSE r.prayer END AS title,
          r.allow_online,
          (r.enabled OR j.is_jumuah) AS active
        FROM public.prayer_time_cache c
        CROSS JOIN public.prayer_block_rules r
        CROSS JOIN LATERAL (
          SELECT (r.prayer = 'dhuhr' AND extract(isodow FROM c.date) = 5 AND r.jumuah_minutes > 0) AS is_jumuah
        ) j
        WHERE c.city_id = v_city AND c.method = 'jordan_awqaf'
          AND c.date BETWEEN v_from AND v_to
          AND r.shop_id = v_shop.id
      ) b
     WHERE b.active AND b.s >= now();
    GET DIAGNOSTICS v_n = ROW_COUNT;
    v_total := v_total + v_n;
  END LOOP;
  RETURN v_total;
END;
$$;
REVOKE ALL ON FUNCTION public.generate_prayer_blocks(uuid, integer) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.generate_prayer_blocks(uuid, integer) TO authenticated, service_role;

-- Nightly at 00:05 Amman time (21:05 UTC), when pg_cron is available.
-- Without pg_cron the server route (see handoffs) or "Apply now" does it.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_cron') THEN
    EXECUTE $q$SELECT cron.unschedule(jobid) FROM cron.job WHERE jobname = 'halaqy_prayer_blocks'$q$;
    EXECUTE $q$SELECT cron.schedule('halaqy_prayer_blocks', '5 21 * * *', 'SELECT public.generate_prayer_blocks(NULL, 14)')$q$;
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'prayer cron not scheduled: %', SQLERRM;
END $$;

-- ─── 5. Walk-in queue ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.walk_in_queue (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  ticket_no           integer NOT NULL DEFAULT 0,
  client_name         text,
  phone               text,
  client_id           uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  service_ids         uuid[] NOT NULL DEFAULT '{}',
  preferred_barber_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  assigned_barber_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  appointment_id      uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'waiting',
  note                text,
  checked_in_at       timestamptz NOT NULL DEFAULT now(),
  called_at           timestamptz,
  started_at          timestamptz,
  finished_at         timestamptz,
  created_by          uuid DEFAULT auth.uid() REFERENCES public.profiles(id) ON DELETE SET NULL,
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT walk_in_queue_status_check CHECK (status IN ('waiting', 'serving', 'done', 'left')),
  CONSTRAINT walk_in_queue_name_len CHECK (client_name IS NULL OR length(client_name) <= 120),
  CONSTRAINT walk_in_queue_phone_len CHECK (phone IS NULL OR length(phone) <= 20),
  CONSTRAINT walk_in_queue_note_len CHECK (note IS NULL OR length(note) <= 300),
  CONSTRAINT walk_in_queue_services_len CHECK (coalesce(array_length(service_ids, 1), 0) <= 10)
);
CREATE INDEX IF NOT EXISTS idx_walk_in_queue_shop_status ON public.walk_in_queue (shop_id, status, checked_in_at);
CREATE INDEX IF NOT EXISTS idx_walk_in_queue_appointment ON public.walk_in_queue (appointment_id) WHERE appointment_id IS NOT NULL;

ALTER TABLE public.walk_in_queue ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS walk_in_queue_select_staff ON public.walk_in_queue;
CREATE POLICY walk_in_queue_select_staff ON public.walk_in_queue
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
DROP POLICY IF EXISTS walk_in_queue_insert_staff ON public.walk_in_queue;
CREATE POLICY walk_in_queue_insert_staff ON public.walk_in_queue
  FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
DROP POLICY IF EXISTS walk_in_queue_update_staff ON public.walk_in_queue;
CREATE POLICY walk_in_queue_update_staff ON public.walk_in_queue
  FOR UPDATE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
DROP POLICY IF EXISTS walk_in_queue_delete_admin ON public.walk_in_queue;
CREATE POLICY walk_in_queue_delete_admin ON public.walk_in_queue
  FOR DELETE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
REVOKE ALL ON public.walk_in_queue FROM anon, authenticated;
GRANT SELECT, DELETE ON public.walk_in_queue TO authenticated;
-- Clients write only these columns; ticket/assignment/appointment come from
-- the trigger and queue_assign().
GRANT INSERT (shop_id, client_name, phone, client_id, service_ids, preferred_barber_id, note)
  ON public.walk_in_queue TO authenticated;
GRANT UPDATE (client_name, phone, client_id, service_ids, preferred_barber_id, note, status)
  ON public.walk_in_queue TO authenticated;
GRANT ALL ON public.walk_in_queue TO service_role;

-- Guard: daily ticket numbers, same-shop references, timestamps, and the
-- waiting → serving → done/left flow (serving only through queue_assign).
CREATE OR REPLACE FUNCTION public.walk_in_queue_guard()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_tz text;
  v_day date;
BEGIN
  NEW.client_name := nullif(btrim(NEW.client_name), '');
  NEW.phone := nullif(btrim(NEW.phone), '');
  NEW.note := nullif(btrim(NEW.note), '');
  NEW.service_ids := coalesce(NEW.service_ids, '{}');

  IF TG_OP = 'UPDATE' AND NEW.shop_id IS DISTINCT FROM OLD.shop_id THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;

  IF cardinality(NEW.service_ids) > 0 AND EXISTS (
       SELECT 1 FROM unnest(NEW.service_ids) AS sid
        WHERE NOT EXISTS (SELECT 1 FROM public.services s WHERE s.id = sid AND s.shop_id = NEW.shop_id)) THEN
    RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.preferred_barber_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.profiles p WHERE p.id = NEW.preferred_barber_id AND p.shop_id = NEW.shop_id
          AND p.role IN ('barber', 'shop_admin')) THEN
    RAISE EXCEPTION 'BARBER_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.client_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.clients c WHERE c.id = NEW.client_id AND c.shop_id = NEW.shop_id) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT coalesce(nullif(timezone, ''), 'Asia/Amman') INTO v_tz FROM public.shops WHERE id = NEW.shop_id;
    v_day := (now() AT TIME ZONE coalesce(v_tz, 'Asia/Amman'))::date;
    PERFORM pg_advisory_xact_lock(hashtext('queue:' || NEW.shop_id::text));
    SELECT coalesce(max(q.ticket_no), 0) + 1 INTO NEW.ticket_no
      FROM public.walk_in_queue q
     WHERE q.shop_id = NEW.shop_id
       AND (q.checked_in_at AT TIME ZONE coalesce(v_tz, 'Asia/Amman'))::date = v_day;
    NEW.status := 'waiting';
    NEW.checked_in_at := now();
    NEW.assigned_barber_id := NULL;
    NEW.appointment_id := NULL;
  ELSIF NEW.status IS DISTINCT FROM OLD.status THEN
    IF NEW.status = 'serving' AND current_setting('halaqy.queue_assign', true) IS DISTINCT FROM 'on' THEN
      RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE = 'P0001';
    END IF;
    IF OLD.status IN ('done', 'left') AND NEW.status <> 'waiting' THEN
      RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE = 'P0001';
    END IF;
    IF NEW.status IN ('done', 'left') THEN
      NEW.finished_at := coalesce(NEW.finished_at, now());
    ELSIF NEW.status = 'waiting' THEN
      -- Back to the queue (e.g. "left" by mistake): keeps the original ticket.
      NEW.finished_at := NULL;
    END IF;
  END IF;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.walk_in_queue_guard() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS walk_in_queue_guard ON public.walk_in_queue;
CREATE TRIGGER walk_in_queue_guard
  BEFORE INSERT OR UPDATE ON public.walk_in_queue
  FOR EACH ROW EXECUTE FUNCTION public.walk_in_queue_guard();

-- Serve a waiting walk-in now: picks the barber (explicit → preferred → next
-- free via pick_any_barber), creates an in_chair appointment starting now and
-- links it. A barber (not admin) can only take a client for themselves.
-- Errors: NOT_AUTHENTICATED, NOT_FOUND, INVALID_STATUS, FORBIDDEN,
-- BARBER_INVALID, NO_BARBER_AVAILABLE, 23P01 (barber busy → SLOT_TAKEN).
CREATE OR REPLACE FUNCTION public.queue_assign(p_entry_id uuid, p_barber_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry public.walk_in_queue%ROWTYPE;
  v_barber uuid;
  v_is_admin boolean;
  v_start timestamptz := date_trunc('minute', now());
  v_duration integer;
  v_price numeric;
  v_names text;
  v_currency text;
  v_appt uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_entry FROM public.walk_in_queue WHERE id = p_entry_id FOR UPDATE;
  IF NOT FOUND OR NOT public.is_staff_of_shop(v_entry.shop_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_entry.status <> 'waiting' THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = 'P0001';
  END IF;
  v_is_admin := public.is_admin_of_shop(v_entry.shop_id);

  v_barber := coalesce(p_barber_id, v_entry.preferred_barber_id);
  IF v_barber IS NULL AND NOT v_is_admin THEN
    v_barber := auth.uid();
  END IF;
  IF v_barber IS NULL AND cardinality(v_entry.service_ids) > 0 THEN
    v_barber := public.pick_any_barber(v_entry.shop_id, v_start, to_jsonb(v_entry.service_ids));
  END IF;
  IF v_barber IS NULL THEN
    RAISE EXCEPTION 'NO_BARBER_AVAILABLE' USING ERRCODE = 'P0001';
  END IF;
  IF NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_barber AND p.shop_id = v_entry.shop_id
                    AND p.role IN ('barber', 'shop_admin')) THEN
    RAISE EXCEPTION 'BARBER_INVALID' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_is_admin AND v_barber <> auth.uid() THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = 'P0001';
  END IF;

  SELECT coalesce(sum(coalesce(bs.duration_override, s.duration)), 0)::int,
         coalesce(sum(coalesce(bs.price_override, s.price)), 0),
         string_agg(s.name, ' + ' ORDER BY array_position(v_entry.service_ids, s.id))
    INTO v_duration, v_price, v_names
    FROM public.services s
    LEFT JOIN public.barber_services bs ON bs.service_id = s.id AND bs.barber_id = v_barber
   WHERE s.shop_id = v_entry.shop_id AND s.id = ANY (v_entry.service_ids);
  IF v_duration <= 0 THEN
    v_duration := 30;
  END IF;
  SELECT coalesce(nullif(currency, ''), 'JOD') INTO v_currency FROM public.shops WHERE id = v_entry.shop_id;

  INSERT INTO public.appointments (shop_id, barber_id, client_id, client_name, service_ids, service_name,
                                   start_time, end_time, status, price, currency, source, notes,
                                   arrived_at, started_at)
  VALUES (v_entry.shop_id, v_barber, v_entry.client_id, v_entry.client_name, v_entry.service_ids, v_names,
          v_start, v_start + make_interval(mins => v_duration), 'in_chair', v_price, v_currency, 'walk_in',
          v_entry.note, v_entry.checked_in_at, now())
  RETURNING id INTO v_appt;

  PERFORM set_config('halaqy.queue_assign', 'on', true);
  UPDATE public.walk_in_queue
     SET status = 'serving', assigned_barber_id = v_barber, appointment_id = v_appt,
         called_at = now(), started_at = now()
   WHERE id = p_entry_id;
  PERFORM set_config('halaqy.queue_assign', 'off', true);

  RETURN jsonb_build_object(
    'entry_id', p_entry_id,
    'appointment_id', v_appt,
    'barber_id', v_barber,
    'start_time', v_start,
    'end_time', v_start + make_interval(mins => v_duration),
    'duration', v_duration
  );
END;
$$;
REVOKE ALL ON FUNCTION public.queue_assign(uuid, uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.queue_assign(uuid, uuid) TO authenticated, service_role;

-- Finishing the linked appointment closes the queue entry.
CREATE OR REPLACE FUNCTION public.walk_in_queue_sync_appointment()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.status IS DISTINCT FROM OLD.status AND NEW.status IN ('completed', 'cancelled', 'no_show') THEN
    UPDATE public.walk_in_queue
       SET status = CASE WHEN NEW.status = 'completed' THEN 'done' ELSE 'left' END
     WHERE appointment_id = NEW.id AND status = 'serving';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.walk_in_queue_sync_appointment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS walk_in_queue_sync_appointment ON public.appointments;
CREATE TRIGGER walk_in_queue_sync_appointment
  AFTER UPDATE OF status ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.walk_in_queue_sync_appointment();

-- Live updates for the front desk and the TV display (RLS still applies).
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_publication WHERE pubname = 'supabase_realtime')
     AND NOT EXISTS (SELECT 1 FROM pg_publication_tables
                      WHERE pubname = 'supabase_realtime' AND schemaname = 'public' AND tablename = 'walk_in_queue') THEN
    EXECUTE 'ALTER PUBLICATION supabase_realtime ADD TABLE public.walk_in_queue';
  END IF;
EXCEPTION WHEN others THEN
  RAISE NOTICE 'walk_in_queue not added to realtime: %', SQLERRM;
END $$;
