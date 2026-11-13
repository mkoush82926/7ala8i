-- ═══════════════════════════════════════════════════════════════════════
-- WS-P0V · Availability engine (sole owner of slot logic)
--
-- One SQL function set that every booking surface calls:
--   get_available_slots(shop, from, to, items, barber?, ignore_appt?, ignore_hold?)
--   next_available_slot(shop, items, barber?, after?)
--   is_slot_bookable(shop, start, items, barber?, ignore_appt?, ignore_hold?)
--   pick_any_barber(shop, start, items, ignore_appt?, ignore_hold?)
--   get_busy_slots(shop, day, barber?)          -- redefined, same signature
--   barber_is_working(barber, start, end, tz)   -- redefined, same signature
--
-- Barbers are modelled as public.profiles (role barber/shop_admin with a
-- shop_id). The legacy public.barbers table is NOT used; per-barber flags
-- (online_bookable, auto_assignable) live on profiles.
--
-- Schedule precedence for a barber on a shop-local date D:
--   1. Shop closed (closed_periods covering D, or special_hours.is_closed) → off.
--   2. shift_overrides(barber, D) → its segments ('[]' = day off).
--   3. special_hours(shop, D) with segments → those segments, for barbers who
--      are scheduled to work that weekday (weekly day-off stays off).
--   4. Weekly working_hours (minus break). No rows at all → 09:00–18:00.
-- Segments are {"start":"HH:MM","end":"HH:MM"}; end <= start means the
-- segment runs past midnight into D+1 (Ramadan night shifts). Approved
-- time_off is subtracted from working time.
--
-- Occupancy for a booking of items at t by barber b:
--   client span   [t, t+D)   D = Σ COALESCE(duration_override, duration)
--   barber span   [t, t+D+B) B = max(buffer_minutes) (cleanup after)
--   active span   barber span minus processing gaps (barber is free while
--                 colour/mask processes, e.g. to pray)
--   • client span must sit inside working time;
--   • barber span must not overlap other active appointments (each extended
--     by its own buffer) or live slot_holds — this is stricter than the
--     appointments_no_overlap exclusion constraint, so a slot offered here
--     never violates it;
--   • active span must not overlap blocked_times (shop-wide or the barber's)
--     unless the block has allow_online = true (informational only).
--
-- Public callers (anon, customers, service_role) get min notice, booking
-- window and online_bookable applied; staff of the shop do not.
--
-- Idempotent and safe on production data: only adds nullable/defaulted
-- columns, new tables, and CREATE OR REPLACE functions.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Booking-rule columns ───────────────────────────────────────────

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS timezone text NOT NULL DEFAULT 'Asia/Amman';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS min_notice_minutes integer NOT NULL DEFAULT 5;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS booking_window_days integer NOT NULL DEFAULT 90;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS slot_interval_minutes integer NOT NULL DEFAULT 15;

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS buffer_minutes integer NOT NULL DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS processing_offset_minutes integer NOT NULL DEFAULT 0;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS processing_minutes integer NOT NULL DEFAULT 0;

ALTER TABLE public.barber_services ADD COLUMN IF NOT EXISTS duration_override integer;

ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS online_bookable boolean NOT NULL DEFAULT true;
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS auto_assignable boolean NOT NULL DEFAULT true;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_min_notice_range') THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_min_notice_range
      CHECK (min_notice_minutes BETWEEN 0 AND 20160) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_booking_window_range') THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_booking_window_range
      CHECK (booking_window_days BETWEEN 1 AND 365) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_slot_interval_range') THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_slot_interval_range
      CHECK (slot_interval_minutes BETWEEN 5 AND 120) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_buffer_range') THEN
    ALTER TABLE public.services ADD CONSTRAINT services_buffer_range
      CHECK (buffer_minutes BETWEEN 0 AND 120) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'services_processing_valid') THEN
    ALTER TABLE public.services ADD CONSTRAINT services_processing_valid
      CHECK (processing_offset_minutes >= 0 AND processing_minutes >= 0
             AND (processing_minutes = 0 OR processing_offset_minutes + processing_minutes < duration)) NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'barber_services_duration_override_range') THEN
    ALTER TABLE public.barber_services ADD CONSTRAINT barber_services_duration_override_range
      CHECK (duration_override IS NULL OR duration_override BETWEEN 5 AND 480) NOT VALID;
  END IF;
END $$;

-- profiles/shops use column-level SELECT grants (20250101001800); expose the
-- new non-sensitive columns explicitly.
GRANT SELECT (online_bookable, auto_assignable) ON public.profiles TO anon, authenticated;
GRANT SELECT (min_notice_minutes, booking_window_days, slot_interval_minutes) ON public.shops TO anon, authenticated;

-- Only a shop admin (or service_role) may change the booking flags on a
-- profile; profiles_update_own would otherwise let a barber flip their own.
CREATE OR REPLACE FUNCTION public.guard_profile_booking_flags()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (NEW.online_bookable IS DISTINCT FROM OLD.online_bookable
      OR NEW.auto_assignable IS DISTINCT FROM OLD.auto_assignable)
     AND auth.uid() IS NOT NULL
     AND NOT public.is_admin_of_profile(NEW.id) THEN
    RAISE EXCEPTION 'NOT_ALLOWED' USING ERRCODE = '42501';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.guard_profile_booking_flags() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS guard_profile_booking_flags ON public.profiles;
CREATE TRIGGER guard_profile_booking_flags
  BEFORE UPDATE OF online_bookable, auto_assignable ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_profile_booking_flags();

-- ─── 2. Segment validation ─────────────────────────────────────────────

CREATE OR REPLACE FUNCTION public.availability_segments_valid(p jsonb)
RETURNS boolean
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p IS NULL OR jsonb_typeof(p) <> 'array' THEN false
    WHEN jsonb_array_length(p) > 8 THEN false
    ELSE NOT EXISTS (
      SELECT 1 FROM jsonb_array_elements(p) e
      WHERE jsonb_typeof(e) <> 'object'
         OR COALESCE(e->>'start', '') !~ '^([01][0-9]|2[0-3]):[0-5][0-9]$'
         OR COALESCE(e->>'end', '')   !~ '^(([01][0-9]|2[0-3]):[0-5][0-9]|24:00)$'
         OR e->>'start' = e->>'end'
    )
  END;
$$;
GRANT EXECUTE ON FUNCTION public.availability_segments_valid(jsonb) TO anon, authenticated, service_role;

-- ─── 3. Tables ─────────────────────────────────────────────────────────

-- Per-barber, per-date replacement of the weekly shift.
CREATE TABLE IF NOT EXISTS public.shift_overrides (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  barber_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  date        date NOT NULL,
  segments    jsonb NOT NULL DEFAULT '[]'::jsonb,
  note        text CHECK (note IS NULL OR length(note) <= 500),
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shift_overrides_segments_valid CHECK (public.availability_segments_valid(segments)),
  CONSTRAINT shift_overrides_barber_date_key UNIQUE (barber_id, date)
);

-- Absences (holiday, sick…). Only status = 'approved' removes working time.
CREATE TABLE IF NOT EXISTS public.time_off (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  barber_id   uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_time  timestamptz NOT NULL,
  end_time    timestamptz NOT NULL,
  type        text NOT NULL DEFAULT 'annual' CHECK (type IN ('annual', 'sick', 'personal', 'training', 'other')),
  status      text NOT NULL DEFAULT 'approved' CHECK (status IN ('pending', 'approved', 'declined')),
  note        text CHECK (note IS NULL OR length(note) <= 500),
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT time_off_time_order CHECK (end_time > start_time),
  CONSTRAINT time_off_max_span CHECK (end_time - start_time <= interval '366 days')
);

-- Whole-shop closures (Eid, renovation…), inclusive dates.
CREATE TABLE IF NOT EXISTS public.closed_periods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  start_date  date NOT NULL,
  end_date    date NOT NULL,
  note_en     text CHECK (note_en IS NULL OR length(note_en) <= 200),
  note_ar     text CHECK (note_ar IS NULL OR length(note_ar) <= 200),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT closed_periods_date_order CHECK (end_date >= start_date),
  CONSTRAINT closed_periods_max_span CHECK (end_date - start_date <= 366)
);

-- Shop-wide hours for one date (Ramadan, eve of Eid…).
CREATE TABLE IF NOT EXISTS public.special_hours (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  date        date NOT NULL,
  is_closed   boolean NOT NULL DEFAULT false,
  segments    jsonb NOT NULL DEFAULT '[]'::jsonb,
  note_en     text CHECK (note_en IS NULL OR length(note_en) <= 200),
  note_ar     text CHECK (note_ar IS NULL OR length(note_ar) <= 200),
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT special_hours_segments_valid CHECK (public.availability_segments_valid(segments)),
  CONSTRAINT special_hours_shop_date_key UNIQUE (shop_id, date)
);

CREATE TABLE IF NOT EXISTS public.blocked_time_types (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name_en         text NOT NULL CHECK (length(name_en) BETWEEN 1 AND 60),
  name_ar         text CHECK (name_ar IS NULL OR length(name_ar) <= 60),
  emoji           text CHECK (emoji IS NULL OR length(emoji) <= 16),
  default_minutes integer NOT NULL DEFAULT 30 CHECK (default_minutes BETWEEN 5 AND 720),
  is_paid         boolean NOT NULL DEFAULT true,
  is_active       boolean NOT NULL DEFAULT true,
  sort_order      integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now()
);

-- One row per occurrence. A recurring series is materialised as rows that
-- share series_id; rrule is kept for editing the series (see
-- src/lib/availability/recurrence.ts expandRecurrence()).
CREATE TABLE IF NOT EXISTS public.blocked_times (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id      uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  barber_id    uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_time   timestamptz NOT NULL,
  end_time     timestamptz NOT NULL,
  type_id      uuid REFERENCES public.blocked_time_types(id) ON DELETE SET NULL,
  title        text CHECK (title IS NULL OR length(title) <= 120),
  rrule        text CHECK (rrule IS NULL OR length(rrule) <= 500),
  series_id    uuid,
  source       text NOT NULL DEFAULT 'manual' CHECK (source IN ('manual', 'prayer')),
  allow_online boolean NOT NULL DEFAULT false,
  created_by   uuid REFERENCES public.profiles(id) ON DELETE SET NULL DEFAULT auth.uid(),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT blocked_times_time_order CHECK (end_time > start_time),
  CONSTRAINT blocked_times_max_span CHECK (end_time - start_time <= interval '31 days')
);

-- Temporary reservations (1D checkout, 2D waitlist offers). Written only by
-- SECURITY DEFINER RPCs; expired rows are ignored by the engine.
CREATE TABLE IF NOT EXISTS public.slot_holds (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  barber_id   uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  start_time  timestamptz NOT NULL,
  end_time    timestamptz NOT NULL,
  reason      text NOT NULL DEFAULT 'checkout' CHECK (reason IN ('checkout', 'waitlist', 'manual')),
  expires_at  timestamptz NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT slot_holds_time_order CHECK (end_time > start_time),
  CONSTRAINT slot_holds_max_span CHECK (end_time - start_time <= interval '12 hours')
);

CREATE INDEX IF NOT EXISTS idx_shift_overrides_shop_date ON public.shift_overrides (shop_id, date);
CREATE INDEX IF NOT EXISTS idx_time_off_barber_time      ON public.time_off (barber_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_time_off_shop_time        ON public.time_off (shop_id, start_time);
CREATE INDEX IF NOT EXISTS idx_closed_periods_shop       ON public.closed_periods (shop_id, start_date, end_date);
CREATE INDEX IF NOT EXISTS idx_blocked_time_types_shop   ON public.blocked_time_types (shop_id, sort_order);
CREATE INDEX IF NOT EXISTS idx_blocked_times_shop_time   ON public.blocked_times (shop_id, start_time, end_time);
CREATE INDEX IF NOT EXISTS idx_blocked_times_barber_time ON public.blocked_times (barber_id, start_time) WHERE barber_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_blocked_times_series      ON public.blocked_times (series_id) WHERE series_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_slot_holds_shop_time      ON public.slot_holds (shop_id, start_time, expires_at);
CREATE INDEX IF NOT EXISTS idx_slot_holds_expires        ON public.slot_holds (expires_at);
CREATE INDEX IF NOT EXISTS idx_appointments_shop_unassigned
  ON public.appointments (shop_id, start_time)
  WHERE barber_id IS NULL AND status IN ('pending', 'confirmed', 'awaiting_deposit', 'arrived', 'in_chair');

DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['shift_overrides','time_off','closed_periods','special_hours','blocked_time_types','blocked_times']
  LOOP
    EXECUTE format('DROP TRIGGER IF EXISTS set_updated_at ON public.%I', t);
    EXECUTE format('CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.%I FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at()', t);
  END LOOP;
END $$;

-- ─── 4. RLS (least privilege) ──────────────────────────────────────────

ALTER TABLE public.shift_overrides    ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.time_off           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.closed_periods     ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.special_hours      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_time_types ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.blocked_times      ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.slot_holds         ENABLE ROW LEVEL SECURITY;

-- Table grants: staff tables are not visible to anon at all.
REVOKE ALL ON public.shift_overrides, public.time_off, public.blocked_time_types,
              public.blocked_times, public.slot_holds FROM anon;
REVOKE ALL ON public.closed_periods, public.special_hours FROM anon;
GRANT SELECT ON public.closed_periods, public.special_hours TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shift_overrides, public.time_off, public.closed_periods,
  public.special_hours, public.blocked_time_types, public.blocked_times TO authenticated;
REVOKE ALL ON public.slot_holds FROM authenticated;
GRANT SELECT, DELETE ON public.slot_holds TO authenticated;
GRANT ALL ON public.shift_overrides, public.time_off, public.closed_periods, public.special_hours,
  public.blocked_time_types, public.blocked_times, public.slot_holds TO service_role;

-- shift_overrides: staff read; admin writes (barber must be in the shop).
DROP POLICY IF EXISTS shift_overrides_select_staff ON public.shift_overrides;
CREATE POLICY shift_overrides_select_staff ON public.shift_overrides FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
DROP POLICY IF EXISTS shift_overrides_write_admin ON public.shift_overrides;
CREATE POLICY shift_overrides_write_admin ON public.shift_overrides FOR ALL TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin())
              AND public.is_admin_of_profile(barber_id));

-- time_off: staff read; admin writes; a barber may request (pending) and
-- withdraw their own pending requests.
DROP POLICY IF EXISTS time_off_select_staff ON public.time_off;
CREATE POLICY time_off_select_staff ON public.time_off FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
DROP POLICY IF EXISTS time_off_write_admin ON public.time_off;
CREATE POLICY time_off_write_admin ON public.time_off FOR ALL TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin())
              AND public.is_admin_of_profile(barber_id));
DROP POLICY IF EXISTS time_off_insert_own_request ON public.time_off;
CREATE POLICY time_off_insert_own_request ON public.time_off FOR INSERT TO authenticated
  WITH CHECK (barber_id = (SELECT auth.uid()) AND status = 'pending'
              AND shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
DROP POLICY IF EXISTS time_off_delete_own_request ON public.time_off;
CREATE POLICY time_off_delete_own_request ON public.time_off FOR DELETE TO authenticated
  USING (barber_id = (SELECT auth.uid()) AND status = 'pending'
         AND shop_id = (SELECT public.get_current_shop_id()));

-- closed_periods / special_hours: public read (shop page shows the note), admin writes.
DROP POLICY IF EXISTS closed_periods_select_public ON public.closed_periods;
CREATE POLICY closed_periods_select_public ON public.closed_periods FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS closed_periods_write_admin ON public.closed_periods;
CREATE POLICY closed_periods_write_admin ON public.closed_periods FOR ALL TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));

DROP POLICY IF EXISTS special_hours_select_public ON public.special_hours;
CREATE POLICY special_hours_select_public ON public.special_hours FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS special_hours_write_admin ON public.special_hours;
CREATE POLICY special_hours_write_admin ON public.special_hours FOR ALL TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));

-- blocked_time_types: staff read, admin writes.
DROP POLICY IF EXISTS blocked_time_types_select_staff ON public.blocked_time_types;
CREATE POLICY blocked_time_types_select_staff ON public.blocked_time_types FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
DROP POLICY IF EXISTS blocked_time_types_write_admin ON public.blocked_time_types;
CREATE POLICY blocked_time_types_write_admin ON public.blocked_time_types FOR ALL TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));

-- blocked_times: staff read (titles may name clients — never anon); admin
-- writes any; a barber writes their own (barber_id = self).
DROP POLICY IF EXISTS blocked_times_select_staff ON public.blocked_times;
CREATE POLICY blocked_times_select_staff ON public.blocked_times FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
DROP POLICY IF EXISTS blocked_times_write_admin ON public.blocked_times;
CREATE POLICY blocked_times_write_admin ON public.blocked_times FOR ALL TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin())
              AND (barber_id IS NULL OR public.is_admin_of_profile(barber_id))
              AND (type_id IS NULL OR EXISTS (SELECT 1 FROM public.blocked_time_types bt
                                              WHERE bt.id = type_id AND bt.shop_id = blocked_times.shop_id)));
DROP POLICY IF EXISTS blocked_times_write_own ON public.blocked_times;
CREATE POLICY blocked_times_write_own ON public.blocked_times FOR ALL TO authenticated
  USING (barber_id = (SELECT auth.uid()) AND shop_id = (SELECT public.get_current_shop_id())
         AND (SELECT public.is_shop_staff()))
  WITH CHECK (barber_id = (SELECT auth.uid()) AND shop_id = (SELECT public.get_current_shop_id())
              AND (SELECT public.is_shop_staff())
              AND (type_id IS NULL OR EXISTS (SELECT 1 FROM public.blocked_time_types bt
                                              WHERE bt.id = type_id AND bt.shop_id = blocked_times.shop_id)));

-- slot_holds: staff read, admin may release; inserts only via definer RPCs.
DROP POLICY IF EXISTS slot_holds_select_staff ON public.slot_holds;
CREATE POLICY slot_holds_select_staff ON public.slot_holds FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
DROP POLICY IF EXISTS slot_holds_delete_admin ON public.slot_holds;
CREATE POLICY slot_holds_delete_admin ON public.slot_holds FOR DELETE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));

-- ─── 5. Engine internals (not callable by API roles) ───────────────────

-- True when the caller is staff of this shop (staff bypass notice/window/
-- online_bookable). anon, customers and service_role are "public".
CREATE OR REPLACE FUNCTION public.availability_is_staff(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT auth.uid() IS NOT NULL AND EXISTS (
    SELECT 1 FROM public.profiles p
    WHERE p.id = auth.uid() AND p.shop_id = p_shop_id AND p.role::text IN ('shop_admin', 'barber'));
$$;

-- Working time of one barber for shifts starting on [p_from - 1, p_to]
-- (the extra day catches night shifts spilling past midnight), minus
-- approved time off.
CREATE OR REPLACE FUNCTION public.availability_work_ranges(
  p_shop_id uuid, p_barber_id uuid, p_tz text, p_from date, p_to date)
RETURNS tstzmultirange
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH has_wh AS (
    SELECT EXISTS (SELECT 1 FROM public.working_hours w WHERE w.barber_id = p_barber_id) AS has
  ),
  days AS (
    SELECT g::date AS d FROM generate_series(p_from - 1, p_to, interval '1 day') g
  ),
  day_src AS (
    SELECT dy.d,
      CASE
        WHEN EXISTS (SELECT 1 FROM public.closed_periods cp
                     WHERE cp.shop_id = p_shop_id AND dy.d BETWEEN cp.start_date AND cp.end_date)
          OR sp.is_closed IS TRUE
          THEN '[]'::jsonb
        WHEN so.id IS NOT NULL THEN so.segments
        WHEN sp.id IS NOT NULL THEN
          CASE WHEN NOT h.has OR w.is_working IS TRUE THEN sp.segments ELSE '[]'::jsonb END
        WHEN NOT h.has THEN '[{"start":"09:00","end":"18:00"}]'::jsonb
        WHEN w.is_working IS TRUE AND w.start_time IS NOT NULL AND w.end_time IS NOT NULL
             AND w.start_time <> w.end_time THEN
          jsonb_build_array(jsonb_build_object('start', to_char(w.start_time, 'HH24:MI'),
                                               'end',   to_char(w.end_time,   'HH24:MI')))
        ELSE '[]'::jsonb
      END AS segs,
      -- the weekly break only applies when the weekly shift is used
      CASE WHEN so.id IS NULL AND sp.id IS NULL AND h.has AND w.is_working IS TRUE
                AND w.break_start IS NOT NULL AND w.break_end IS NOT NULL AND w.break_end <> w.break_start
           THEN w.break_start END AS brk_start,
      w.break_end AS brk_end,
      w.start_time AS wh_start,
      w.end_time AS wh_end
    FROM days dy
    CROSS JOIN has_wh h
    LEFT JOIN public.shift_overrides so ON so.barber_id = p_barber_id AND so.date = dy.d
    LEFT JOIN public.special_hours sp ON sp.shop_id = p_shop_id AND sp.date = dy.d
    LEFT JOIN public.working_hours w ON w.barber_id = p_barber_id AND w.day_of_week = extract(dow FROM dy.d)::int
  ),
  segs AS (
    SELECT tstzrange(
             (ds.d + (e->>'start')::time) AT TIME ZONE p_tz,
             ((CASE WHEN (e->>'end')::time <= (e->>'start')::time AND e->>'end' <> '24:00'
                    THEN ds.d + 1 ELSE ds.d END) + (e->>'end')::time) AT TIME ZONE p_tz,
             '[)') AS r
    FROM day_src ds, jsonb_array_elements(ds.segs) e
  ),
  breaks AS (
    -- in a night shift (end <= start) a break earlier on the clock than the start is on the next day
    SELECT tstzrange(
             ((CASE WHEN ds.wh_end <= ds.wh_start AND ds.brk_start < ds.wh_start THEN ds.d + 1 ELSE ds.d END) + ds.brk_start) AT TIME ZONE p_tz,
             ((CASE WHEN ds.brk_end <= ds.brk_start OR (ds.wh_end <= ds.wh_start AND ds.brk_start < ds.wh_start)
                   THEN ds.d + 1 ELSE ds.d END)
                + ds.brk_end) AT TIME ZONE p_tz,
             '[)') AS r
    FROM day_src ds
    WHERE ds.brk_start IS NOT NULL
  ),
  off AS (
    SELECT tstzrange(t.start_time, t.end_time, '[)') AS r
    FROM public.time_off t
    WHERE t.barber_id = p_barber_id AND t.status = 'approved'
      AND t.start_time < ((p_to + 2)::timestamp AT TIME ZONE p_tz)
      AND t.end_time   > ((p_from - 1)::timestamp AT TIME ZONE p_tz)
  )
  SELECT COALESCE((SELECT range_agg(r) FROM segs WHERE NOT isempty(r)), '{}'::tstzmultirange)
       - COALESCE((SELECT range_agg(r) FROM breaks WHERE NOT isempty(r)), '{}'::tstzmultirange)
       - COALESCE((SELECT range_agg(r) FROM off), '{}'::tstzmultirange);
$$;

-- Parses items jsonb (["uuid", …] or [{"service_id":"uuid"}, …]) into an
-- ordered, de-duplicated array of active services of the shop.
-- Raises SERVICE_INVALID / INVALID_INPUT.
CREATE OR REPLACE FUNCTION public.availability_parse_items(p_shop_id uuid, p_items jsonb)
RETURNS uuid[]
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ids uuid[];
  v_n   int;
BEGIN
  IF p_items IS NULL OR jsonb_typeof(p_items) <> 'array'
     OR jsonb_array_length(p_items) = 0 OR jsonb_array_length(p_items) > 10 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  BEGIN
    SELECT array_agg(id ORDER BY first_pos) INTO v_ids
    FROM (
      SELECT x.id, min(x.pos) AS first_pos
      FROM (
        SELECT (CASE jsonb_typeof(e) WHEN 'string' THEN e #>> '{}' ELSE e ->> 'service_id' END)::uuid AS id, pos
        FROM jsonb_array_elements(p_items) WITH ORDINALITY AS t(e, pos)
      ) x
      GROUP BY x.id
    ) y;
  EXCEPTION WHEN invalid_text_representation THEN
    RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
  END;
  IF v_ids IS NULL OR array_position(v_ids, NULL) IS NOT NULL THEN
    RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  SELECT count(*) INTO v_n FROM public.services s
  WHERE s.id = ANY (v_ids) AND s.shop_id = p_shop_id AND s.is_active IS NOT FALSE;
  IF v_n <> cardinality(v_ids) THEN
    RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_ids;
END;
$$;

-- Core: per-barber free starts. With p_at set, evaluates exactly that
-- start (off-grid allowed) on its local date; otherwise walks every working
-- range on the shop's slot grid (anchored at each range start).
CREATE OR REPLACE FUNCTION public.availability_engine(
  p_shop_id uuid,
  p_from date,
  p_to date,
  p_service_ids uuid[],
  p_barber_id uuid,
  p_ignore_appointment_id uuid,
  p_ignore_hold_id uuid,
  p_at timestamptz,
  p_public boolean)
RETURNS TABLE (barber_id uuid, start_time timestamptz, end_time timestamptz, buffer_minutes int)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_shop      public.shops%ROWTYPE;
  v_tz        text;
  v_step      interval;
  v_earliest  timestamptz;
  v_latest    timestamptz;
  v_lo        timestamptz;
  v_hi        timestamptz;
  v_b         record;
  v_dur       int;
  v_buf       int;
  v_gap_a     int[];
  v_gap_b     int[];
  v_work      tstzmultirange;
  v_appts     tstzmultirange;
  v_holds     tstzmultirange;
  v_blocks    tstzmultirange;
BEGIN
  SELECT * INTO v_shop FROM public.shops s WHERE s.id = p_shop_id;
  IF v_shop.id IS NULL THEN
    RETURN;
  END IF;
  v_tz := COALESCE(NULLIF(v_shop.timezone, ''), 'Asia/Amman');
  v_step := make_interval(mins => GREATEST(5, COALESCE(v_shop.slot_interval_minutes, 15)));

  IF p_at IS NOT NULL THEN
    p_from := (p_at AT TIME ZONE v_tz)::date;
    p_to := p_from;
  END IF;

  IF p_public THEN
    v_earliest := now() + make_interval(mins => GREATEST(0, COALESCE(v_shop.min_notice_minutes, 0)));
    v_latest := ((((now() AT TIME ZONE v_tz)::date) + COALESCE(v_shop.booking_window_days, 90) + 1)::timestamp)
                AT TIME ZONE v_tz;
  ELSE
    -- staff: anything from a few minutes ago (walk-ins), no window
    v_earliest := now() - interval '15 minutes';
    v_latest := 'infinity'::timestamptz;
  END IF;

  v_lo := (p_from::timestamp) AT TIME ZONE v_tz;           -- local midnight of first day
  v_hi := ((p_to + 1)::timestamp) AT TIME ZONE v_tz;       -- local midnight after last day

  -- Shop-wide blocks (barber_id IS NULL) apply to every barber.
  FOR v_b IN
    SELECT p.id
    FROM public.profiles p
    WHERE p.shop_id = p_shop_id
      AND p.role::text IN ('barber', 'shop_admin')
      AND (p_barber_id IS NULL OR p.id = p_barber_id)
      AND (NOT p_public OR p.online_bookable IS NOT FALSE)
      AND public.barber_offers_services(p.id, p_service_ids)
  LOOP
    -- Duration (with per-barber overrides), buffer and processing gaps.
    SELECT COALESCE(sum(x.d), 0)::int,
           COALESCE(max(x.buf), 0)::int,
           array_agg(x.off_start + x.po) FILTER (WHERE x.pm > 0),
           array_agg(x.off_start + x.po + x.pm) FILTER (WHERE x.pm > 0)
      INTO v_dur, v_buf, v_gap_a, v_gap_b
    FROM (
      SELECT d, buf, po, pm,
             COALESCE(sum(d) OVER (ORDER BY ord ROWS BETWEEN UNBOUNDED PRECEDING AND 1 PRECEDING), 0) AS off_start
      FROM (
        SELECT u.ord,
               COALESCE(bs.duration_override, s.duration) AS d,
               COALESCE(s.buffer_minutes, 0) AS buf,
               COALESCE(s.processing_offset_minutes, 0) AS po,
               CASE WHEN COALESCE(s.processing_minutes, 0) > 0
                         AND COALESCE(s.processing_offset_minutes, 0) + s.processing_minutes
                             < COALESCE(bs.duration_override, s.duration)
                    THEN s.processing_minutes ELSE 0 END AS pm
        FROM unnest(p_service_ids) WITH ORDINALITY AS u(sid, ord)
        JOIN public.services s ON s.id = u.sid
        LEFT JOIN public.barber_services bs ON bs.barber_id = v_b.id AND bs.service_id = u.sid
      ) i
    ) x;
    CONTINUE WHEN v_dur < 5 OR v_dur > 720;

    v_work := public.availability_work_ranges(p_shop_id, v_b.id, v_tz, p_from, p_to);
    CONTINUE WHEN isempty(v_work);

    SELECT COALESCE(range_agg(tstzrange(a.start_time,
              a.end_time + make_interval(mins => COALESCE(
                (SELECT max(s.buffer_minutes) FROM public.services s WHERE s.id = ANY (a.service_ids)), 0)),
              '[)')), '{}'::tstzmultirange)
      INTO v_appts
    FROM public.appointments a
    WHERE a.barber_id = v_b.id
      AND a.status IN ('pending', 'confirmed', 'awaiting_deposit', 'arrived', 'in_chair')
      AND (p_ignore_appointment_id IS NULL OR a.id <> p_ignore_appointment_id)
      AND a.start_time < v_hi + interval '2 days'
      AND a.end_time   > v_lo - interval '2 days';

    SELECT COALESCE(range_agg(tstzrange(h.start_time, h.end_time, '[)')), '{}'::tstzmultirange)
      INTO v_holds
    FROM public.slot_holds h
    WHERE h.shop_id = p_shop_id AND h.barber_id = v_b.id
      AND h.expires_at > now()
      AND (p_ignore_hold_id IS NULL OR h.id <> p_ignore_hold_id)
      AND h.start_time < v_hi + interval '2 days'
      AND h.end_time   > v_lo - interval '2 days';

    SELECT COALESCE(range_agg(tstzrange(bt.start_time, bt.end_time, '[)')), '{}'::tstzmultirange)
      INTO v_blocks
    FROM public.blocked_times bt
    WHERE bt.shop_id = p_shop_id
      AND (bt.barber_id IS NULL OR bt.barber_id = v_b.id)
      AND bt.allow_online IS NOT TRUE
      AND bt.start_time < v_hi + interval '2 days'
      AND bt.end_time   > v_lo - interval '2 days';

    RETURN QUERY
    SELECT v_b.id, c.t, c.t + make_interval(mins => v_dur), v_buf
    FROM (
      SELECT p_at AS t WHERE p_at IS NOT NULL
      UNION ALL
      SELECT g AS t
      FROM unnest(v_work) AS r,
           LATERAL generate_series(lower(r), upper(r) - make_interval(mins => v_dur), v_step) AS g
      WHERE p_at IS NULL
    ) c
    WHERE c.t >= v_lo AND c.t < v_hi
      AND c.t >= v_earliest AND c.t < v_latest
      AND v_work @> tstzrange(c.t, c.t + make_interval(mins => v_dur), '[)')
      AND NOT (v_appts && tstzrange(c.t, c.t + make_interval(mins => v_dur + v_buf), '[)'))
      AND NOT (v_holds && tstzrange(c.t, c.t + make_interval(mins => v_dur + v_buf), '[)'))
      AND NOT (v_blocks &&
               (tstzmultirange(tstzrange(c.t, c.t + make_interval(mins => v_dur + v_buf), '[)'))
                - COALESCE((SELECT range_agg(tstzrange(c.t + make_interval(mins => ga),
                                                       c.t + make_interval(mins => gb), '[)'))
                            FROM unnest(v_gap_a, v_gap_b) AS gp(ga, gb)), '{}'::tstzmultirange)));
  END LOOP;
END;
$$;

-- Chairs taken by unassigned bookings / holds overlapping [p_start, p_end).
CREATE OR REPLACE FUNCTION public.availability_unassigned_load(
  p_shop_id uuid, p_start timestamptz, p_end timestamptz, p_ignore_appointment_id uuid, p_ignore_hold_id uuid)
RETURNS int
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT (
    SELECT count(*) FROM public.appointments a
    WHERE a.shop_id = p_shop_id AND a.barber_id IS NULL AND a.status IN ('pending', 'confirmed', 'awaiting_deposit', 'arrived', 'in_chair')
      AND (p_ignore_appointment_id IS NULL OR a.id <> p_ignore_appointment_id)
      AND a.start_time < p_end AND a.end_time > p_start
  )::int + (
    SELECT count(*) FROM public.slot_holds h
    WHERE h.shop_id = p_shop_id AND h.barber_id IS NULL AND h.expires_at > now()
      AND (p_ignore_hold_id IS NULL OR h.id <> p_ignore_hold_id)
      AND h.start_time < p_end AND h.end_time > p_start
  )::int;
$$;

-- p_ignore_appointment_id is honoured for staff of the shop and for the
-- customer who owns that appointment (reschedule); otherwise dropped.
CREATE OR REPLACE FUNCTION public.availability_allowed_ignore(p_shop_id uuid, p_appointment_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_appointment_id IS NULL THEN NULL
    WHEN public.availability_is_staff(p_shop_id) THEN p_appointment_id
    WHEN EXISTS (SELECT 1 FROM public.appointments a
                 WHERE a.id = p_appointment_id AND a.shop_id = p_shop_id
                   AND a.client_id IN (SELECT public.my_client_ids())) THEN p_appointment_id
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.availability_is_staff(uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.availability_work_ranges(uuid, uuid, text, date, date) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.availability_parse_items(uuid, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.availability_engine(uuid, date, date, uuid[], uuid, uuid, uuid, timestamptz, boolean) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.availability_unassigned_load(uuid, timestamptz, timestamptz, uuid, uuid) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.availability_allowed_ignore(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.availability_is_staff(uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.availability_work_ranges(uuid, uuid, text, date, date) TO service_role;
GRANT EXECUTE ON FUNCTION public.availability_parse_items(uuid, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.availability_engine(uuid, date, date, uuid[], uuid, uuid, uuid, timestamptz, boolean) TO service_role;
GRANT EXECUTE ON FUNCTION public.availability_unassigned_load(uuid, timestamptz, timestamptz, uuid, uuid) TO service_role;
GRANT EXECUTE ON FUNCTION public.availability_allowed_ignore(uuid, uuid) TO service_role;

-- ─── 6. Public API ─────────────────────────────────────────────────────

-- Bookable start times in [p_date_from, p_date_to] (shop-local dates, max
-- 62 days per call). One row per start; barber_ids = free barbers. In
-- "any barber" mode a start is kept only while free barbers outnumber
-- overlapping unassigned bookings/holds.
CREATE OR REPLACE FUNCTION public.get_available_slots(
  p_shop_id uuid,
  p_date_from date,
  p_date_to date,
  p_items jsonb,
  p_barber_id uuid DEFAULT NULL,
  p_ignore_appointment_id uuid DEFAULT NULL,
  p_ignore_hold_id uuid DEFAULT NULL)
RETURNS TABLE (start_time timestamptz, end_time timestamptz, local_date date, local_time text, barber_ids uuid[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_tz       text;
  v_services uuid[];
  v_public   boolean;
  v_ignore   uuid;
BEGIN
  IF p_shop_id IS NULL OR p_date_from IS NULL OR p_date_to IS NULL
     OR p_date_to < p_date_from OR p_date_to - p_date_from > 62 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  SELECT COALESCE(NULLIF(s.timezone, ''), 'Asia/Amman') INTO v_tz FROM public.shops s WHERE s.id = p_shop_id;
  IF v_tz IS NULL THEN
    RAISE EXCEPTION 'SHOP_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  v_services := public.availability_parse_items(p_shop_id, p_items);
  v_public := NOT public.availability_is_staff(p_shop_id);
  v_ignore := public.availability_allowed_ignore(p_shop_id, p_ignore_appointment_id);

  RETURN QUERY
  WITH e AS (
    SELECT * FROM public.availability_engine(p_shop_id, p_date_from, p_date_to, v_services,
                                             p_barber_id, v_ignore, p_ignore_hold_id, NULL, v_public)
  ),
  agg AS (
    SELECT e.start_time AS st, min(e.end_time) AS et, array_agg(e.barber_id ORDER BY e.barber_id) AS ids
    FROM e GROUP BY e.start_time
  )
  SELECT agg.st, agg.et, (agg.st AT TIME ZONE v_tz)::date, to_char(agg.st AT TIME ZONE v_tz, 'HH24:MI'), agg.ids
  FROM agg
  WHERE p_barber_id IS NOT NULL
     OR cardinality(agg.ids) > public.availability_unassigned_load(p_shop_id, agg.st, agg.et, v_ignore, p_ignore_hold_id)
  ORDER BY agg.st;
END;
$$;

-- First bookable start at/after p_after (default now), scanning the booking
-- window (public) or 90 days (staff) in 7-day chunks.
CREATE OR REPLACE FUNCTION public.next_available_slot(
  p_shop_id uuid,
  p_items jsonb,
  p_barber_id uuid DEFAULT NULL,
  p_after timestamptz DEFAULT NULL)
RETURNS TABLE (start_time timestamptz, end_time timestamptz, local_date date, local_time text, barber_ids uuid[])
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_tz     text;
  v_window int;
  v_after  timestamptz := GREATEST(COALESCE(p_after, now()), now() - interval '1 day');
  v_day    date;
  v_last   date;
  v_found  boolean;
BEGIN
  SELECT COALESCE(NULLIF(s.timezone, ''), 'Asia/Amman'),
         CASE WHEN public.availability_is_staff(p_shop_id) THEN 90 ELSE COALESCE(s.booking_window_days, 90) END
    INTO v_tz, v_window
  FROM public.shops s WHERE s.id = p_shop_id;
  IF v_tz IS NULL THEN
    RAISE EXCEPTION 'SHOP_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  v_day := (v_after AT TIME ZONE v_tz)::date;
  v_last := (now() AT TIME ZONE v_tz)::date + LEAST(v_window, 365);

  WHILE v_day <= v_last LOOP
    v_found := false;
    FOR start_time, end_time, local_date, local_time, barber_ids IN
      SELECT g.start_time, g.end_time, g.local_date, g.local_time, g.barber_ids
      FROM public.get_available_slots(p_shop_id, v_day, LEAST(v_day + 6, v_last), p_items, p_barber_id) g
      WHERE g.start_time >= v_after
      ORDER BY g.start_time
      LIMIT 1
    LOOP
      v_found := true;
      RETURN NEXT;
    END LOOP;
    EXIT WHEN v_found;
    v_day := v_day + 7;
  END LOOP;
END;
$$;

-- Exact check used by booking writers (call it after taking the
-- per-barber advisory lock 'appt:barber:<id>'). Off-grid starts allowed.
CREATE OR REPLACE FUNCTION public.is_slot_bookable(
  p_shop_id uuid,
  p_start timestamptz,
  p_items jsonb,
  p_barber_id uuid DEFAULT NULL,
  p_ignore_appointment_id uuid DEFAULT NULL,
  p_ignore_hold_id uuid DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_services uuid[];
  v_ignore   uuid;
  v_free     int;
  v_end      timestamptz;
BEGIN
  IF p_shop_id IS NULL OR p_start IS NULL THEN
    RETURN false;
  END IF;
  v_services := public.availability_parse_items(p_shop_id, p_items);
  v_ignore := public.availability_allowed_ignore(p_shop_id, p_ignore_appointment_id);
  SELECT count(*), min(e.end_time) INTO v_free, v_end
  FROM public.availability_engine(p_shop_id, NULL, NULL, v_services, p_barber_id, v_ignore,
                                  p_ignore_hold_id, p_start, NOT public.availability_is_staff(p_shop_id)) e;
  IF v_free = 0 THEN
    RETURN false;
  END IF;
  IF p_barber_id IS NOT NULL THEN
    RETURN true;
  END IF;
  RETURN v_free > public.availability_unassigned_load(p_shop_id, p_start, v_end, v_ignore, p_ignore_hold_id);
END;
$$;

-- Auto-assign: among barbers free at p_start with auto_assignable = true,
-- prefer role 'barber', then the fewest active bookings that local day,
-- then id (deterministic). NULL when nobody is free.
CREATE OR REPLACE FUNCTION public.pick_any_barber(
  p_shop_id uuid,
  p_start timestamptz,
  p_items jsonb,
  p_ignore_appointment_id uuid DEFAULT NULL,
  p_ignore_hold_id uuid DEFAULT NULL)
RETURNS uuid
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_services uuid[];
  v_ignore   uuid;
  v_tz       text;
  v_pick     uuid;
BEGIN
  IF p_shop_id IS NULL OR p_start IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT COALESCE(NULLIF(s.timezone, ''), 'Asia/Amman') INTO v_tz FROM public.shops s WHERE s.id = p_shop_id;
  IF v_tz IS NULL THEN
    RETURN NULL;
  END IF;
  v_services := public.availability_parse_items(p_shop_id, p_items);
  v_ignore := public.availability_allowed_ignore(p_shop_id, p_ignore_appointment_id);

  SELECT e.barber_id INTO v_pick
  FROM public.availability_engine(p_shop_id, NULL, NULL, v_services, NULL, v_ignore,
                                  p_ignore_hold_id, p_start, NOT public.availability_is_staff(p_shop_id)) e
  JOIN public.profiles p ON p.id = e.barber_id
  WHERE p.auto_assignable IS NOT FALSE
  ORDER BY (p.role::text = 'barber') DESC,
           (SELECT count(*) FROM public.appointments a
             WHERE a.barber_id = p.id AND a.status IN ('pending', 'confirmed', 'awaiting_deposit', 'arrived', 'in_chair')
               AND (a.start_time AT TIME ZONE v_tz)::date = (p_start AT TIME ZONE v_tz)::date),
           p.id
  LIMIT 1;
  RETURN v_pick;
END;
$$;

-- ─── 7. Redefined legacy functions (same signatures) ───────────────────

-- Staff of the shop: exactly the legacy rows (their pending/confirmed
-- appointments) so the staff overlap pre-check keeps working.
-- Everyone else: everything that makes time unbookable for the legacy
-- public slot UI — per barber, the complement of their bookable time that
-- local day (closures, special hours, overrides, time off, blocks, holds,
-- buffered appointments, min notice, booking window, online_bookable),
-- plus unassigned appointments with barber_id NULL (each takes one chair).
-- Times only — never client data.
CREATE OR REPLACE FUNCTION public.get_busy_slots(p_shop_id uuid, p_day date, p_barber_id uuid DEFAULT NULL)
RETURNS TABLE (barber_id uuid, start_time timestamptz, end_time timestamptz)
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_shop    public.shops%ROWTYPE;
  v_tz      text;
  v_day     tstzrange;
  v_b       record;
  v_free    tstzmultirange;
  v_notice  timestamptz;
  v_latest  timestamptz;
BEGIN
  SELECT * INTO v_shop FROM public.shops s WHERE s.id = p_shop_id;
  IF v_shop.id IS NULL OR p_day IS NULL THEN
    RETURN;
  END IF;
  v_tz := COALESCE(NULLIF(v_shop.timezone, ''), 'Asia/Amman');
  v_day := tstzrange((p_day::timestamp) AT TIME ZONE v_tz, ((p_day + 1)::timestamp) AT TIME ZONE v_tz, '[)');

  IF public.availability_is_staff(p_shop_id) THEN
    RETURN QUERY
    SELECT a.barber_id, a.start_time, a.end_time
    FROM public.appointments a
    WHERE a.shop_id = p_shop_id
      AND a.status IN ('pending', 'confirmed', 'awaiting_deposit', 'arrived', 'in_chair')
      AND (p_barber_id IS NULL OR a.barber_id = p_barber_id)
      AND a.start_time < upper(v_day)
      AND a.end_time   > lower(v_day)
    ORDER BY a.start_time;
    RETURN;
  END IF;

  v_notice := now() + make_interval(mins => GREATEST(0, COALESCE(v_shop.min_notice_minutes, 0)));
  v_latest := ((((now() AT TIME ZONE v_tz)::date) + COALESCE(v_shop.booking_window_days, 90) + 1)::timestamp)
              AT TIME ZONE v_tz;

  FOR v_b IN
    SELECT p.id, p.online_bookable
    FROM public.profiles p
    WHERE p.shop_id = p_shop_id AND p.role::text IN ('barber', 'shop_admin')
      AND (p_barber_id IS NULL OR p.id = p_barber_id)
    ORDER BY p.id
  LOOP
    IF v_b.online_bookable IS FALSE THEN
      v_free := '{}'::tstzmultirange;
    ELSE
      v_free := public.availability_work_ranges(p_shop_id, v_b.id, v_tz, p_day, p_day)
        * tstzmultirange(v_day)
        * tstzmultirange(tstzrange(v_notice, v_latest, '[)'))
        - COALESCE((SELECT range_agg(tstzrange(bt.start_time, bt.end_time, '[)'))
                    FROM public.blocked_times bt
                    WHERE bt.shop_id = p_shop_id AND (bt.barber_id IS NULL OR bt.barber_id = v_b.id)
                      AND bt.allow_online IS NOT TRUE
                      AND bt.start_time < upper(v_day) AND bt.end_time > lower(v_day)), '{}'::tstzmultirange)
        - COALESCE((SELECT range_agg(tstzrange(h.start_time, h.end_time, '[)'))
                    FROM public.slot_holds h
                    WHERE h.shop_id = p_shop_id AND h.barber_id = v_b.id AND h.expires_at > now()
                      AND h.start_time < upper(v_day) AND h.end_time > lower(v_day)), '{}'::tstzmultirange)
        - COALESCE((SELECT range_agg(tstzrange(a.start_time,
                      a.end_time + make_interval(mins => COALESCE(
                        (SELECT max(s.buffer_minutes) FROM public.services s WHERE s.id = ANY (a.service_ids)), 0)),
                      '[)'))
                    FROM public.appointments a
                    WHERE a.barber_id = v_b.id AND a.status IN ('pending', 'confirmed', 'awaiting_deposit', 'arrived', 'in_chair')
                      AND a.start_time < upper(v_day) AND a.end_time > lower(v_day) - interval '1 day'),
                   '{}'::tstzmultirange);
    END IF;

    RETURN QUERY
    SELECT v_b.id, lower(r), upper(r)
    FROM unnest(tstzmultirange(v_day) - v_free) AS r;
  END LOOP;

  IF p_barber_id IS NULL THEN
    RETURN QUERY
    SELECT a.barber_id, a.start_time, a.end_time
    FROM public.appointments a
    WHERE a.shop_id = p_shop_id AND a.barber_id IS NULL
      AND a.status IN ('pending', 'confirmed', 'awaiting_deposit', 'arrived', 'in_chair')
      AND a.start_time < upper(v_day) AND a.end_time > lower(v_day);
  END IF;
END;
$$;

-- True when [p_start, p_end) lies inside the barber's working time
-- (overrides, special hours, closures, approved time off, night shifts past
-- midnight). Does not look at appointments, blocks or holds — use
-- is_slot_bookable for the full check.
CREATE OR REPLACE FUNCTION public.barber_is_working(p_barber_id uuid, p_start timestamptz, p_end timestamptz, p_tz text)
RETURNS boolean
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shop uuid;
  v_tz   text := COALESCE(NULLIF(p_tz, ''), 'Asia/Amman');
  v_day  date;
BEGIN
  IF p_barber_id IS NULL OR p_start IS NULL OR p_end IS NULL OR p_end <= p_start THEN
    RETURN false;
  END IF;
  SELECT p.shop_id INTO v_shop FROM public.profiles p WHERE p.id = p_barber_id;
  IF v_shop IS NULL THEN
    RETURN false;
  END IF;
  v_day := (p_start AT TIME ZONE v_tz)::date;
  RETURN public.availability_work_ranges(v_shop, p_barber_id, v_tz, v_day, v_day)
         @> tstzrange(p_start, p_end, '[)');
END;
$$;

REVOKE ALL ON FUNCTION public.get_available_slots(uuid, date, date, jsonb, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.next_available_slot(uuid, jsonb, uuid, timestamptz) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.is_slot_bookable(uuid, timestamptz, jsonb, uuid, uuid, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.pick_any_barber(uuid, timestamptz, jsonb, uuid, uuid) FROM PUBLIC, anon;
REVOKE ALL ON FUNCTION public.get_busy_slots(uuid, date, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.barber_is_working(uuid, timestamptz, timestamptz, text) FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_available_slots(uuid, date, date, jsonb, uuid, uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.next_available_slot(uuid, jsonb, uuid, timestamptz) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.is_slot_bookable(uuid, timestamptz, jsonb, uuid, uuid, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.pick_any_barber(uuid, timestamptz, jsonb, uuid, uuid) TO authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_busy_slots(uuid, date, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.barber_is_working(uuid, timestamptz, timestamptz, text) TO service_role;

COMMENT ON FUNCTION public.get_available_slots(uuid, date, date, jsonb, uuid, uuid, uuid) IS
  'WS-P0V: bookable starts for items (["service-uuid"] or [{"service_id":...}]) between two shop-local dates.';
COMMENT ON FUNCTION public.is_slot_bookable(uuid, timestamptz, jsonb, uuid, uuid, uuid) IS
  'WS-P0V: exact bookability check; call under pg_advisory_xact_lock(hashtext(''appt:barber:''||barber_id)).';
COMMENT ON COLUMN public.profiles.online_bookable IS 'WS-P0V: false hides this barber from public/online booking.';
COMMENT ON COLUMN public.profiles.auto_assignable IS 'WS-P0V: false excludes this barber from "any barber" auto-assign.';
