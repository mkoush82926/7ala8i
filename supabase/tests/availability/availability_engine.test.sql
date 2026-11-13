-- ═══════════════════════════════════════════════════════════════════════
-- WS-P0V availability engine — SQL test suite (psql, no extensions).
--
-- Run through ./run.sh, which wraps everything in BEGIN … ROLLBACK (and
-- applies the migration first when it is not applied yet), so it is safe on
-- the shared local database. Every assertion raises on failure; the last
-- line prints "ALL AVAILABILITY TESTS PASSED".
-- ═══════════════════════════════════════════════════════════════════════
\set ON_ERROR_STOP 1
SET client_min_messages = notice;

-- ─── Helpers ───────────────────────────────────────────────────────────
CREATE FUNCTION pg_temp.eq(actual anyelement, expected anyelement, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF actual IS DISTINCT FROM expected THEN
    RAISE EXCEPTION 'FAIL: % — expected %, got %', msg, expected, actual;
  END IF;
  RAISE NOTICE 'ok - %', msg;
END $$;

CREATE FUNCTION pg_temp.ok(cond boolean, msg text) RETURNS void
LANGUAGE plpgsql AS $$
BEGIN
  IF cond IS NOT TRUE THEN
    RAISE EXCEPTION 'FAIL: %', msg;
  END IF;
  RAISE NOTICE 'ok - %', msg;
END $$;

-- Fixed fixture ids.
CREATE FUNCTION pg_temp.shop() RETURNS uuid LANGUAGE sql AS $$ SELECT 'a0000000-0000-4000-8000-000000000001'::uuid $$;
CREATE FUNCTION pg_temp.ba()   RETURNS uuid LANGUAGE sql AS $$ SELECT 'a0000000-0000-4000-8000-0000000000a1'::uuid $$;
CREATE FUNCTION pg_temp.bb()   RETURNS uuid LANGUAGE sql AS $$ SELECT 'a0000000-0000-4000-8000-0000000000b1'::uuid $$;
CREATE FUNCTION pg_temp.adm()  RETURNS uuid LANGUAGE sql AS $$ SELECT 'a0000000-0000-4000-8000-0000000000c1'::uuid $$;
CREATE FUNCTION pg_temp.s30()  RETURNS uuid LANGUAGE sql AS $$ SELECT 'a0000000-0000-4000-8000-000000000301'::uuid $$;
CREATE FUNCTION pg_temp.s60()  RETURNS uuid LANGUAGE sql AS $$ SELECT 'a0000000-0000-4000-8000-000000000601'::uuid $$;
CREATE FUNCTION pg_temp.s90()  RETURNS uuid LANGUAGE sql AS $$ SELECT 'a0000000-0000-4000-8000-000000000901'::uuid $$;
-- Test day: 10 days ahead in Amman (weekly hours are identical every day).
CREATE FUNCTION pg_temp.d() RETURNS date LANGUAGE sql AS $$ SELECT (now() AT TIME ZONE 'Asia/Amman')::date + 10 $$;
CREATE FUNCTION pg_temp.at(p_day date, p_time text) RETURNS timestamptz LANGUAGE sql AS $$
  SELECT (p_day + p_time::time) AT TIME ZONE 'Asia/Amman' $$;
CREATE FUNCTION pg_temp.items(VARIADIC ids uuid[]) RETURNS jsonb LANGUAGE sql AS $$ SELECT to_jsonb(ids) $$;

-- Local "HH:MM" starts for one barber (or any when NULL).
CREATE FUNCTION pg_temp.slots(p_barber uuid, p_items jsonb, p_from date DEFAULT NULL, p_to date DEFAULT NULL)
RETURNS text[] LANGUAGE sql AS $$
  SELECT COALESCE(array_agg(g.local_time ORDER BY g.start_time), '{}')
  FROM public.get_available_slots(pg_temp.shop(), COALESCE(p_from, pg_temp.d()),
                                  COALESCE(p_to, p_from, pg_temp.d()), p_items, p_barber) g $$;

CREATE FUNCTION pg_temp.has(p_barber uuid, p_items jsonb, p_time text) RETURNS boolean LANGUAGE sql AS $$
  SELECT p_time = ANY (pg_temp.slots(p_barber, p_items)) $$;

CREATE FUNCTION pg_temp.as_user(p_uid uuid) RETURNS void LANGUAGE sql AS $$
  SELECT set_config('request.jwt.claims',
                    CASE WHEN p_uid IS NULL THEN '' ELSE json_build_object('sub', p_uid, 'role', 'authenticated')::text END,
                    true) $$;

CREATE FUNCTION pg_temp.appt(p_barber uuid, p_start timestamptz, p_minutes int, p_services uuid[] DEFAULT '{}')
RETURNS uuid LANGUAGE sql AS $$
  INSERT INTO public.appointments (shop_id, barber_id, service_ids, client_name, start_time, end_time, status, price)
  VALUES (pg_temp.shop(), p_barber, p_services, 'Test', p_start, p_start + make_interval(mins => p_minutes), 'confirmed', 0)
  RETURNING id $$;

-- ─── Fixtures ──────────────────────────────────────────────────────────
INSERT INTO public.shops (id, name, timezone) VALUES (pg_temp.shop(), 'Availability Test Shop', 'Asia/Amman');
UPDATE public.shops SET min_notice_minutes = 0, booking_window_days = 90, slot_interval_minutes = 15
WHERE id = pg_temp.shop();

INSERT INTO auth.users (id, email, aud, role)
VALUES (pg_temp.ba(),  'p0v-a@test.local',   'authenticated', 'authenticated'),
       (pg_temp.bb(),  'p0v-b@test.local',   'authenticated', 'authenticated'),
       (pg_temp.adm(), 'p0v-adm@test.local', 'authenticated', 'authenticated');
UPDATE public.profiles SET shop_id = pg_temp.shop(), role = 'barber', full_name = 'Barber A' WHERE id = pg_temp.ba();
UPDATE public.profiles SET shop_id = pg_temp.shop(), role = 'barber', full_name = 'Barber B' WHERE id = pg_temp.bb();
UPDATE public.profiles SET shop_id = pg_temp.shop(), role = 'shop_admin', full_name = 'Owner' WHERE id = pg_temp.adm();

INSERT INTO public.services (id, shop_id, name, duration, price, buffer_minutes, processing_offset_minutes, processing_minutes)
VALUES (pg_temp.s30(), pg_temp.shop(), 'Cut 30',   30, 5, 0, 0, 0),
       (pg_temp.s60(), pg_temp.shop(), 'Fade 60',  60, 8, 10, 0, 0),
       (pg_temp.s90(), pg_temp.shop(), 'Colour 90', 90, 20, 0, 30, 30);  -- barber free 30–60 min in

-- A: 09:00–17:00 with a 13:00–14:00 break, every day. B: 09:00–17:00. Owner: off.
DELETE FROM public.working_hours WHERE barber_id IN (pg_temp.ba(), pg_temp.bb(), pg_temp.adm());
INSERT INTO public.working_hours (barber_id, day_of_week, start_time, end_time, is_working, break_start, break_end)
SELECT pg_temp.ba(), d, '09:00'::time, '17:00'::time, true, '13:00'::time, '14:00'::time FROM generate_series(0, 6) d
UNION ALL SELECT pg_temp.bb(), d, '09:00'::time, '17:00'::time, true, NULL::time, NULL::time FROM generate_series(0, 6) d
UNION ALL SELECT pg_temp.adm(), d, '09:00'::time, '17:00'::time, false, NULL::time, NULL::time FROM generate_series(0, 6) d;
DELETE FROM public.barber_services WHERE barber_id IN (pg_temp.ba(), pg_temp.bb(), pg_temp.adm());

SELECT pg_temp.as_user(NULL);

-- ─── 1. Weekly hours, break, grid ──────────────────────────────────────
SELECT pg_temp.eq(cardinality(pg_temp.slots(pg_temp.ba(), pg_temp.items(pg_temp.s30()))), 26,
                  'weekly: A has 15 morning + 11 afternoon 30-min starts on a 15-min grid');
SELECT pg_temp.eq((pg_temp.slots(pg_temp.ba(), pg_temp.items(pg_temp.s30())))[1], '09:00', 'weekly: first start 09:00');
SELECT pg_temp.ok(pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '12:30'), 'break: 12:30 ends exactly at break');
SELECT pg_temp.ok(NOT pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '12:45'), 'break: 12:45 overlaps break');
SELECT pg_temp.ok(NOT pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '16:45'), 'close: 16:45 would end after 17:00');
SELECT pg_temp.eq(cardinality(pg_temp.slots(pg_temp.adm(), pg_temp.items(pg_temp.s30()))), 0, 'weekly: owner off all week');
SELECT pg_temp.eq(cardinality(pg_temp.slots(NULL, pg_temp.items(pg_temp.s30()))), 31, 'any barber: union of A and B (09:00–16:30)');

-- Items accept [{"service_id":…}] too, and reject foreign/unknown services.
SELECT pg_temp.eq(cardinality(pg_temp.slots(pg_temp.ba(), jsonb_build_array(jsonb_build_object('service_id', pg_temp.s30())))), 26,
                  'items: object form accepted');
DO $$ BEGIN
  PERFORM pg_temp.slots(pg_temp.ba(), '["00000000-0000-4000-8000-000000000000"]'::jsonb);
  RAISE EXCEPTION 'FAIL: unknown service accepted';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'SERVICE_INVALID' THEN RAISE; END IF;
  RAISE NOTICE 'ok - items: unknown service raises SERVICE_INVALID';
END $$;
DO $$ BEGIN
  PERFORM public.get_available_slots(pg_temp.shop(), pg_temp.d(), pg_temp.d() + 90, pg_temp.items(pg_temp.s30()));
  RAISE EXCEPTION 'FAIL: 90-day range accepted';
EXCEPTION WHEN raise_exception THEN
  IF SQLERRM <> 'INVALID_INPUT' THEN RAISE; END IF;
  RAISE NOTICE 'ok - range: more than 62 days raises INVALID_INPUT';
END $$;

-- ─── 2. Interval ───────────────────────────────────────────────────────
UPDATE public.shops SET slot_interval_minutes = 30 WHERE id = pg_temp.shop();
SELECT pg_temp.eq(cardinality(pg_temp.slots(pg_temp.ba(), pg_temp.items(pg_temp.s30()))), 14, 'interval: 30-min grid gives 8 + 6 starts');
UPDATE public.shops SET slot_interval_minutes = 15 WHERE id = pg_temp.shop();

-- ─── 3. Appointments, buffers, exclusion constraint ────────────────────
SELECT pg_temp.appt(pg_temp.ba(), pg_temp.at(pg_temp.d(), '10:00'), 30) \gset first_
SELECT pg_temp.ok(NOT pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '10:00'), 'appointment: 10:00 taken');
SELECT pg_temp.ok(NOT pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '09:45'), 'appointment: 09:45 would overlap');
SELECT pg_temp.ok(pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '10:30'), 'appointment: 10:30 free right after');
SELECT pg_temp.ok(NOT pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s60()), '09:00'),
                  'buffer: 60+10 min from 09:00 runs into the 10:00 booking');
SELECT pg_temp.ok(pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '09:30'), 'buffer: no buffer on 30-min service');

SELECT pg_temp.appt(pg_temp.ba(), pg_temp.at(pg_temp.d(), '11:00'), 60, ARRAY[pg_temp.s60()]) \gset second_
SELECT pg_temp.ok(NOT pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '12:00'),
                  'buffer: existing 60-min fade keeps the barber busy until 12:10');
SELECT pg_temp.ok(pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '12:15'), 'buffer: 12:15 free');

-- Every offered start can actually be inserted without tripping appointments_no_overlap.
DO $$
DECLARE r record; n int := 0;
BEGIN
  FOR r IN SELECT * FROM public.get_available_slots(pg_temp.shop(), pg_temp.d(), pg_temp.d(),
                                                    pg_temp.items(pg_temp.s60()), pg_temp.ba())
  LOOP
    BEGIN
      INSERT INTO public.appointments (shop_id, barber_id, service_ids, client_name, start_time, end_time, status, price)
      VALUES (pg_temp.shop(), pg_temp.ba(), ARRAY[pg_temp.s60()], 'probe', r.start_time, r.end_time, 'pending', 0);
      RAISE EXCEPTION USING ERRCODE = 'P0002';  -- undo the probe
    EXCEPTION
      WHEN no_data_found THEN n := n + 1;
      WHEN exclusion_violation THEN RAISE EXCEPTION 'FAIL: offered slot % violates appointments_no_overlap', r.local_time;
    END;
  END LOOP;
  PERFORM pg_temp.ok(n > 0, format('exclusion: all %s offered starts insert cleanly', n));
END $$;

DO $$ BEGIN
  INSERT INTO public.appointments (shop_id, barber_id, client_name, start_time, end_time, status, price)
  VALUES (pg_temp.shop(), pg_temp.ba(), 'clash', pg_temp.at(pg_temp.d(), '10:15'), pg_temp.at(pg_temp.d(), '10:45'), 'pending', 0);
  RAISE EXCEPTION 'FAIL: overlapping insert accepted';
EXCEPTION WHEN exclusion_violation THEN
  RAISE NOTICE 'ok - exclusion: constraint still rejects an overlapping insert';
END $$;

-- is_slot_bookable / ignore_appointment_id (staff only)
SELECT pg_temp.ok(public.is_slot_bookable(pg_temp.shop(), pg_temp.at(pg_temp.d(), '09:05'), pg_temp.items(pg_temp.s30()), pg_temp.ba()),
                  'is_slot_bookable: off-grid 09:05 fits before 10:00');
SELECT pg_temp.ok(NOT public.is_slot_bookable(pg_temp.shop(), pg_temp.at(pg_temp.d(), '10:00'), pg_temp.items(pg_temp.s30()), pg_temp.ba()),
                  'is_slot_bookable: taken start is rejected');
SELECT pg_temp.ok(NOT public.is_slot_bookable(pg_temp.shop(), pg_temp.at(pg_temp.d(), '10:00'), pg_temp.items(pg_temp.s30()),
                                              pg_temp.ba(), :'first_appt'::uuid),
                  'ignore_appointment_id: ignored for the public');
SELECT pg_temp.as_user(pg_temp.adm());
SELECT pg_temp.ok(public.is_slot_bookable(pg_temp.shop(), pg_temp.at(pg_temp.d(), '10:00'), pg_temp.items(pg_temp.s30()),
                                          pg_temp.ba(), :'first_appt'::uuid),
                  'ignore_appointment_id: staff can move a booking onto its own time');
SELECT pg_temp.as_user(NULL);
DELETE FROM public.appointments WHERE shop_id = pg_temp.shop();

-- ─── 4. Blocked time and processing time ───────────────────────────────
INSERT INTO public.blocked_times (shop_id, barber_id, start_time, end_time, title)
VALUES (pg_temp.shop(), NULL, pg_temp.at(pg_temp.d(), '15:00'), pg_temp.at(pg_temp.d(), '15:30'), 'Team meeting');
SELECT pg_temp.ok(NOT pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '15:00'), 'block: shop-wide block hits A');
SELECT pg_temp.ok(NOT pg_temp.has(pg_temp.bb(), pg_temp.items(pg_temp.s30()), '14:45'), 'block: shop-wide block hits B');
SELECT pg_temp.ok(pg_temp.has(pg_temp.bb(), pg_temp.items(pg_temp.s30()), '15:30'), 'block: free right after');
UPDATE public.blocked_times SET allow_online = true WHERE shop_id = pg_temp.shop();
SELECT pg_temp.ok(pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '15:00'), 'block: allow_online block is informational');
DELETE FROM public.blocked_times WHERE shop_id = pg_temp.shop();

-- Dhuhr-style block 10:30–11:00 for A only; colour (gap 30–60 min) at 10:00 fits around it.
INSERT INTO public.blocked_times (shop_id, barber_id, start_time, end_time, title, source)
VALUES (pg_temp.shop(), pg_temp.ba(), pg_temp.at(pg_temp.d(), '10:30'), pg_temp.at(pg_temp.d(), '11:00'), 'Prayer', 'prayer');
SELECT pg_temp.ok(NOT pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '10:30'), 'block: barber block hits A');
SELECT pg_temp.ok(pg_temp.has(pg_temp.bb(), pg_temp.items(pg_temp.s30()), '10:30'), 'block: barber block does not hit B');
SELECT pg_temp.ok(pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s90()), '10:00'),
                  'processing: block falls inside the processing gap, colour at 10:00 allowed');
SELECT pg_temp.ok(NOT pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s90()), '10:15'),
                  'processing: 10:15 puts active work inside the block');
DELETE FROM public.blocked_times WHERE shop_id = pg_temp.shop();

-- ─── 5. Overrides, special hours, closures, time off ───────────────────
INSERT INTO public.shift_overrides (shop_id, barber_id, date, segments)
VALUES (pg_temp.shop(), pg_temp.ba(), pg_temp.d(), '[{"start":"12:00","end":"14:00"}]');
SELECT pg_temp.eq(pg_temp.slots(pg_temp.ba(), pg_temp.items(pg_temp.s30())),
                  ARRAY['12:00','12:15','12:30','12:45','13:00','13:15','13:30'],
                  'override: replaces the weekly shift and its break');
UPDATE public.shift_overrides SET segments = '[]' WHERE barber_id = pg_temp.ba();
SELECT pg_temp.eq(cardinality(pg_temp.slots(pg_temp.ba(), pg_temp.items(pg_temp.s30()))), 0, 'override: [] = day off');
DELETE FROM public.shift_overrides WHERE barber_id = pg_temp.ba();
DO $$ BEGIN
  INSERT INTO public.shift_overrides (shop_id, barber_id, date, segments)
  VALUES (pg_temp.shop(), pg_temp.ba(), pg_temp.d(), '[{"start":"9am","end":"5pm"}]');
  RAISE EXCEPTION 'FAIL: bad segment accepted';
EXCEPTION WHEN check_violation THEN RAISE NOTICE 'ok - override: malformed segments rejected';
END $$;

INSERT INTO public.closed_periods (shop_id, start_date, end_date, note_en, note_ar)
VALUES (pg_temp.shop(), pg_temp.d() - 1, pg_temp.d() + 1, 'Eid', 'العيد');
SELECT pg_temp.eq(cardinality(pg_temp.slots(NULL, pg_temp.items(pg_temp.s30()))), 0, 'closure: nobody bookable');
DELETE FROM public.closed_periods WHERE shop_id = pg_temp.shop();

INSERT INTO public.special_hours (shop_id, date, is_closed) VALUES (pg_temp.shop(), pg_temp.d(), true);
SELECT pg_temp.eq(cardinality(pg_temp.slots(NULL, pg_temp.items(pg_temp.s30()))), 0, 'special hours: closed day');
UPDATE public.special_hours SET is_closed = false, segments = '[{"start":"10:00","end":"12:00"}]' WHERE shop_id = pg_temp.shop();
SELECT pg_temp.eq((pg_temp.slots(pg_temp.bb(), pg_temp.items(pg_temp.s30())))[1], '10:00', 'special hours: replace weekly hours');
SELECT pg_temp.eq(cardinality(pg_temp.slots(pg_temp.adm(), pg_temp.items(pg_temp.s30()))), 0,
                  'special hours: weekly day-off stays off');
DELETE FROM public.special_hours WHERE shop_id = pg_temp.shop();

INSERT INTO public.time_off (shop_id, barber_id, start_time, end_time, type, status)
VALUES (pg_temp.shop(), pg_temp.ba(), pg_temp.at(pg_temp.d(), '09:00'), pg_temp.at(pg_temp.d(), '12:00'), 'personal', 'pending');
SELECT pg_temp.eq((pg_temp.slots(pg_temp.ba(), pg_temp.items(pg_temp.s30())))[1], '09:00', 'time off: pending request does not block');
UPDATE public.time_off SET status = 'approved' WHERE barber_id = pg_temp.ba();
SELECT pg_temp.eq((pg_temp.slots(pg_temp.ba(), pg_temp.items(pg_temp.s30())))[1], '12:00', 'time off: approved removes the morning');
SELECT pg_temp.ok(NOT public.barber_is_working(pg_temp.ba(), pg_temp.at(pg_temp.d(), '10:00'), pg_temp.at(pg_temp.d(), '10:30'), 'Asia/Amman'),
                  'barber_is_working: respects time off');
DELETE FROM public.time_off WHERE barber_id = pg_temp.ba();

-- ─── 6. Ramadan night shift past midnight (Asia/Amman) ─────────────────
INSERT INTO public.special_hours (shop_id, date, segments, note_en, note_ar)
VALUES (pg_temp.shop(), pg_temp.d(), '[{"start":"20:00","end":"02:00"}]', 'Ramadan', 'رمضان');
-- D+1 keeps the weekly 09:00–17:00 for A (with the break).
SELECT pg_temp.eq((pg_temp.slots(pg_temp.ba(), pg_temp.items(pg_temp.s30()), pg_temp.d(), pg_temp.d()))[1], '20:00',
                  'ramadan: shift starts 20:00 on D');
SELECT pg_temp.eq((SELECT count(*)::int FROM public.get_available_slots(pg_temp.shop(), pg_temp.d() + 1, pg_temp.d() + 1,
                                                                        pg_temp.items(pg_temp.s30()), pg_temp.ba())
                   WHERE local_time < '03:00'), 7, 'ramadan: 00:00–01:30 on D+1 come from D''s shift');
SELECT pg_temp.ok(pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '23:45'), 'ramadan: 23:45 start crosses midnight');
SELECT pg_temp.ok(public.is_slot_bookable(pg_temp.shop(), pg_temp.at(pg_temp.d(), '23:30'), pg_temp.items(pg_temp.s60()), pg_temp.ba()),
                  'ramadan: 23:30–00:30 is bookable');
SELECT pg_temp.ok(NOT public.is_slot_bookable(pg_temp.shop(), pg_temp.at(pg_temp.d() + 1, '01:45'), pg_temp.items(pg_temp.s30()), pg_temp.ba()),
                  'ramadan: 01:45–02:15 runs past the end');
SELECT pg_temp.ok(public.barber_is_working(pg_temp.ba(), pg_temp.at(pg_temp.d(), '23:30'), pg_temp.at(pg_temp.d() + 1, '00:30'), 'Asia/Amman'),
                  'barber_is_working: night shift across midnight');
-- An appointment crossing midnight blocks both sides.
SELECT pg_temp.appt(pg_temp.ba(), pg_temp.at(pg_temp.d(), '23:45'), 30) \gset
SELECT pg_temp.ok(NOT pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '23:30'), 'ramadan: booking across midnight blocks 23:30');
SELECT pg_temp.ok(NOT ('00:00' = ANY (pg_temp.slots(pg_temp.ba(), pg_temp.items(pg_temp.s30()), pg_temp.d() + 1))),
                  'ramadan: booking across midnight blocks 00:00');
DELETE FROM public.appointments WHERE shop_id = pg_temp.shop();
-- Same via a per-barber override (e.g. a barber who only works nights).
DELETE FROM public.special_hours WHERE shop_id = pg_temp.shop();
INSERT INTO public.shift_overrides (shop_id, barber_id, date, segments)
VALUES (pg_temp.shop(), pg_temp.bb(), pg_temp.d(), '[{"start":"21:00","end":"24:00"},{"start":"22:00","end":"01:00"}]');
SELECT pg_temp.eq((pg_temp.slots(pg_temp.bb(), pg_temp.items(pg_temp.s30()), pg_temp.d() + 1))[1:4],
                  ARRAY['00:00','00:15','00:30','09:00'], 'override: overlapping night segments merge across midnight');
DELETE FROM public.shift_overrides WHERE barber_id = pg_temp.bb();

-- ─── 7. Holds ──────────────────────────────────────────────────────────
INSERT INTO public.slot_holds (id, shop_id, barber_id, start_time, end_time, reason, expires_at)
VALUES ('a0000000-0000-4000-8000-00000000d001', pg_temp.shop(), pg_temp.ba(),
        pg_temp.at(pg_temp.d(), '16:00'), pg_temp.at(pg_temp.d(), '16:30'), 'checkout', now() + interval '10 minutes'),
       ('a0000000-0000-4000-8000-00000000d002', pg_temp.shop(), pg_temp.ba(),
        pg_temp.at(pg_temp.d(), '09:00'), pg_temp.at(pg_temp.d(), '09:30'), 'checkout', now() - interval '1 minute');
SELECT pg_temp.ok(NOT pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '16:00'), 'hold: live hold blocks');
SELECT pg_temp.ok(pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '09:00'), 'hold: expired hold ignored');
SELECT pg_temp.ok(public.is_slot_bookable(pg_temp.shop(), pg_temp.at(pg_temp.d(), '16:00'), pg_temp.items(pg_temp.s30()),
                                          pg_temp.ba(), NULL, 'a0000000-0000-4000-8000-00000000d001'),
                  'hold: the holder can book through its own hold');
DELETE FROM public.slot_holds WHERE shop_id = pg_temp.shop();

-- ─── 8. Notice, window, online_bookable, staff bypass ──────────────────
UPDATE public.shops SET booking_window_days = 3 WHERE id = pg_temp.shop();
SELECT pg_temp.eq(cardinality(pg_temp.slots(pg_temp.ba(), pg_temp.items(pg_temp.s30()))), 0, 'window: D is beyond a 3-day window');
SELECT pg_temp.as_user(pg_temp.adm());
SELECT pg_temp.eq(cardinality(pg_temp.slots(pg_temp.ba(), pg_temp.items(pg_temp.s30()))), 26, 'window: staff are not limited');
SELECT pg_temp.as_user(NULL);
UPDATE public.shops SET booking_window_days = 90, min_notice_minutes = 60 * 24 * 11 WHERE id = pg_temp.shop();
SELECT pg_temp.eq(cardinality(pg_temp.slots(pg_temp.ba(), pg_temp.items(pg_temp.s30()))), 0, 'notice: 11-day notice hides D');
UPDATE public.shops SET min_notice_minutes = 0 WHERE id = pg_temp.shop();
SELECT pg_temp.eq(cardinality(pg_temp.slots(pg_temp.ba(), pg_temp.items(pg_temp.s30()), (now() AT TIME ZONE 'Asia/Amman')::date - 1)), 0,
                  'notice: nothing in the past');

UPDATE public.profiles SET online_bookable = false WHERE id = pg_temp.ba();
SELECT pg_temp.eq(cardinality(pg_temp.slots(pg_temp.ba(), pg_temp.items(pg_temp.s30()))), 0, 'online_bookable: hidden from public');
SELECT pg_temp.as_user(pg_temp.adm());
SELECT pg_temp.eq(cardinality(pg_temp.slots(pg_temp.ba(), pg_temp.items(pg_temp.s30()))), 26, 'online_bookable: staff still see A');
SELECT pg_temp.as_user(pg_temp.ba());
DO $$ BEGIN
  UPDATE public.profiles SET online_bookable = true WHERE id = pg_temp.ba();
  RAISE EXCEPTION 'FAIL: barber changed own online_bookable';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok - online_bookable: only an admin may change it';
END $$;
SELECT pg_temp.as_user(NULL);
UPDATE public.profiles SET online_bookable = true WHERE id = pg_temp.ba();

-- ─── 9. Any barber, unassigned load, auto-assign, duration override ────
SELECT pg_temp.appt(NULL, pg_temp.at(pg_temp.d(), '09:00'), 30) \gset u1_
SELECT pg_temp.ok(pg_temp.has(NULL, pg_temp.items(pg_temp.s30()), '09:00'), 'any: one unassigned booking leaves one chair');
SELECT pg_temp.appt(NULL, pg_temp.at(pg_temp.d(), '09:00'), 30) \gset u2_
SELECT pg_temp.ok(NOT pg_temp.has(NULL, pg_temp.items(pg_temp.s30()), '09:00'), 'any: two unassigned bookings fill both chairs');
SELECT pg_temp.ok(pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s30()), '09:00'), 'any: a named barber is still offered');
SELECT pg_temp.ok(NOT public.is_slot_bookable(pg_temp.shop(), pg_temp.at(pg_temp.d(), '09:00'), pg_temp.items(pg_temp.s30())),
                  'is_slot_bookable(any): respects unassigned load');
DELETE FROM public.appointments WHERE shop_id = pg_temp.shop();

SELECT pg_temp.appt(pg_temp.ba(), pg_temp.at(pg_temp.d(), '15:00'), 30) \gset
SELECT pg_temp.eq(public.pick_any_barber(pg_temp.shop(), pg_temp.at(pg_temp.d(), '10:00'), pg_temp.items(pg_temp.s30())),
                  pg_temp.bb(), 'pick_any_barber: least busy barber that day');
UPDATE public.profiles SET auto_assignable = false WHERE id = pg_temp.bb();
SELECT pg_temp.eq(public.pick_any_barber(pg_temp.shop(), pg_temp.at(pg_temp.d(), '10:00'), pg_temp.items(pg_temp.s30())),
                  pg_temp.ba(), 'pick_any_barber: skips auto_assignable = false');
SELECT pg_temp.eq(public.pick_any_barber(pg_temp.shop(), pg_temp.at(pg_temp.d(), '15:00'), pg_temp.items(pg_temp.s30())),
                  NULL::uuid, 'pick_any_barber: NULL when nobody eligible is free');
UPDATE public.profiles SET auto_assignable = true WHERE id = pg_temp.bb();
DELETE FROM public.appointments WHERE shop_id = pg_temp.shop();

INSERT INTO public.barber_services (barber_id, service_id, duration_override) VALUES (pg_temp.bb(), pg_temp.s30(), 45);
SELECT pg_temp.eq((SELECT end_time - start_time FROM public.get_available_slots(pg_temp.shop(), pg_temp.d(), pg_temp.d(),
                    pg_temp.items(pg_temp.s30()), pg_temp.bb()) LIMIT 1), interval '45 minutes',
                  'duration_override: B takes 45 min for the 30-min cut');
SELECT pg_temp.ok(pg_temp.has(pg_temp.ba(), pg_temp.items(pg_temp.s60()), '09:00'), 'capability: A (no rows) offers everything');
SELECT pg_temp.eq(cardinality(pg_temp.slots(pg_temp.bb(), pg_temp.items(pg_temp.s60()))), 0,
                  'capability: B only offers the cut once barber_services rows exist');
DELETE FROM public.barber_services WHERE barber_id = pg_temp.bb();

-- Multi-item: cut + fade back to back = 90 min (+10 buffer).
SELECT pg_temp.eq((SELECT end_time - start_time FROM public.get_available_slots(pg_temp.shop(), pg_temp.d(), pg_temp.d(),
                    pg_temp.items(pg_temp.s30(), pg_temp.s60()), pg_temp.bb()) LIMIT 1), interval '90 minutes',
                  'multi-item: durations add up');

-- ─── 10. next_available_slot ───────────────────────────────────────────
SELECT pg_temp.eq((SELECT local_time FROM public.next_available_slot(pg_temp.shop(), pg_temp.items(pg_temp.s30()), pg_temp.ba(),
                                                                     pg_temp.at(pg_temp.d(), '00:00'))), '09:00',
                  'next_available_slot: first start of D');
INSERT INTO public.closed_periods (shop_id, start_date, end_date) VALUES (pg_temp.shop(), pg_temp.d(), pg_temp.d() + 9);
SELECT pg_temp.eq((SELECT local_date FROM public.next_available_slot(pg_temp.shop(), pg_temp.items(pg_temp.s30()), NULL,
                                                                     pg_temp.at(pg_temp.d(), '00:00'))), pg_temp.d() + 10,
                  'next_available_slot: skips a 10-day closure across chunks');
DELETE FROM public.closed_periods WHERE shop_id = pg_temp.shop();

-- ─── 11. get_busy_slots compatibility ──────────────────────────────────
SELECT pg_temp.appt(pg_temp.ba(), pg_temp.at(pg_temp.d(), '10:00'), 30) \gset busy_
SELECT pg_temp.as_user(pg_temp.adm());
SELECT pg_temp.eq((SELECT array_agg(start_time) FROM public.get_busy_slots(pg_temp.shop(), pg_temp.d(), pg_temp.ba())),
                  ARRAY[pg_temp.at(pg_temp.d(), '10:00')], 'get_busy_slots(staff): legacy rows = appointments only');
SELECT pg_temp.as_user(NULL);
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.get_busy_slots(pg_temp.shop(), pg_temp.d(), pg_temp.ba()) b
                          WHERE b.start_time <= pg_temp.at(pg_temp.d(), '10:00') AND b.end_time >= pg_temp.at(pg_temp.d(), '10:30')),
                  'get_busy_slots(public): covers the appointment');
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.get_busy_slots(pg_temp.shop(), pg_temp.d(), pg_temp.ba()) b
                          WHERE b.start_time <= pg_temp.at(pg_temp.d(), '13:00') AND b.end_time >= pg_temp.at(pg_temp.d(), '14:00')),
                  'get_busy_slots(public): covers the break');
SELECT pg_temp.ok(NOT EXISTS (SELECT 1 FROM public.get_busy_slots(pg_temp.shop(), pg_temp.d(), pg_temp.ba()) b
                              WHERE b.start_time < pg_temp.at(pg_temp.d(), '11:00') AND b.end_time > pg_temp.at(pg_temp.d(), '10:30')),
                  'get_busy_slots(public): 10:30–11:00 stays free');
INSERT INTO public.special_hours (shop_id, date, is_closed) VALUES (pg_temp.shop(), pg_temp.d(), true);
SELECT pg_temp.ok(EXISTS (SELECT 1 FROM public.get_busy_slots(pg_temp.shop(), pg_temp.d(), NULL) b
                          WHERE b.barber_id = pg_temp.bb() AND b.start_time = pg_temp.at(pg_temp.d(), '00:00')
                            AND b.end_time = pg_temp.at(pg_temp.d() + 1, '00:00')),
                  'get_busy_slots(public): closed day is busy for every barber');
DELETE FROM public.special_hours WHERE shop_id = pg_temp.shop();
DELETE FROM public.appointments WHERE shop_id = pg_temp.shop();

-- ─── 12. Security: anon cannot read staff tables or call internals ─────
SET LOCAL ROLE anon;
DO $$ BEGIN
  PERFORM 1 FROM public.blocked_times LIMIT 1;
  RAISE EXCEPTION 'FAIL: anon read blocked_times';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok - rls: anon cannot read blocked_times';
END $$;
DO $$ BEGIN
  PERFORM public.availability_engine(pg_temp.shop(), pg_temp.d(), pg_temp.d(), ARRAY[pg_temp.s30()], NULL, NULL, NULL, NULL, false);
  RAISE EXCEPTION 'FAIL: anon called availability_engine';
EXCEPTION WHEN insufficient_privilege THEN RAISE NOTICE 'ok - grants: engine internals are not exposed';
END $$;
SELECT pg_temp.eq(cardinality(pg_temp.slots(pg_temp.ba(), pg_temp.items(pg_temp.s30()))), 26, 'grants: anon can call get_available_slots');
RESET ROLE;

-- ─── 13. Performance: 1 shop × 6 barbers × 14 days, p95 < 150 ms ──────
INSERT INTO auth.users (id, email, aud, role)
SELECT ('a0000000-0000-4000-8000-0000000000e' || g)::uuid, 'p0v-e' || g || '@test.local', 'authenticated', 'authenticated'
FROM generate_series(1, 4) g;
UPDATE public.profiles SET shop_id = pg_temp.shop(), role = 'barber'
WHERE id IN (SELECT ('a0000000-0000-4000-8000-0000000000e' || g)::uuid FROM generate_series(1, 4) g);
-- ~6 bookings per barber per day and a daily prayer block.
INSERT INTO public.appointments (shop_id, barber_id, client_name, start_time, end_time, status, price)
SELECT pg_temp.shop(), p.id, 'load', pg_temp.at(pg_temp.d() + dd, h || ':00'), pg_temp.at(pg_temp.d() + dd, h || ':40'), 'confirmed', 0
FROM public.profiles p, generate_series(0, 13) dd, unnest(ARRAY['10','11','12','14','15','16']) h
WHERE p.shop_id = pg_temp.shop() AND p.role = 'barber';
INSERT INTO public.blocked_times (shop_id, start_time, end_time, source, title)
SELECT pg_temp.shop(), pg_temp.at(pg_temp.d() + dd, '12:40'), pg_temp.at(pg_temp.d() + dd, '13:00'), 'prayer', 'Dhuhr'
FROM generate_series(0, 13) dd;
UPDATE public.working_hours SET is_working = true WHERE barber_id = pg_temp.adm();
DO $$
DECLARE t0 timestamptz; ms numeric[] := '{}'; n int; p95 numeric;
BEGIN
  FOR i IN 1..20 LOOP
    t0 := clock_timestamp();
    SELECT count(*) INTO n FROM public.get_available_slots(pg_temp.shop(), pg_temp.d(), pg_temp.d() + 13, pg_temp.items(pg_temp.s30()));
    ms := ms || (extract(epoch FROM clock_timestamp() - t0) * 1000)::numeric;
  END LOOP;
  SELECT percentile_cont(0.95) WITHIN GROUP (ORDER BY x) INTO p95 FROM unnest(ms) x;
  RAISE NOTICE 'perf: % slots, p95 = % ms over 20 runs', n, round(p95, 1);
  PERFORM pg_temp.ok(n > 0 AND p95 < 150, format('perf: 6 barbers × 14 days p95 %s ms < 150 ms', round(p95, 1)));
END $$;

\echo 'ALL AVAILABILITY TESTS PASSED'
