-- Gate 0: create_public_booking decides bookability with the availability
-- engine (20250101002000). Runs inside a rolled-back transaction (run.sh).
INSERT INTO public.shops (id, name, timezone, booking_window_days, min_notice_minutes)
VALUES ('00000000-0000-4000-8000-00000000c0a1', 'Gate0 Booking Test', 'Asia/Amman', 14, 0);
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-00000000c0b1', 'gate0-barber@example.test', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, shop_id, role, full_name)
VALUES ('00000000-0000-4000-8000-00000000c0b1', '00000000-0000-4000-8000-00000000c0a1', 'barber', 'Gate0 Barber')
ON CONFLICT (id) DO UPDATE SET shop_id = EXCLUDED.shop_id, role = EXCLUDED.role;
INSERT INTO public.services (id, shop_id, name, duration, price)
VALUES ('00000000-0000-4000-8000-00000000c0c1', '00000000-0000-4000-8000-00000000c0a1', 'Cut', 30, 5);
INSERT INTO public.barber_services (barber_id, service_id, duration_override)
VALUES ('00000000-0000-4000-8000-00000000c0b1', '00000000-0000-4000-8000-00000000c0c1', 45);

DO $$
DECLARE
  v_shop   uuid := '00000000-0000-4000-8000-00000000c0a1';
  v_barber uuid := '00000000-0000-4000-8000-00000000c0b1';
  v_svc    uuid[] := ARRAY['00000000-0000-4000-8000-00000000c0c1'::uuid];
  v_day    date := (now() AT TIME ZONE 'Asia/Amman')::date + 2;
  v_t10    timestamptz := ((v_day::timestamp) + time '10:00') AT TIME ZONE 'Asia/Amman';
  v_r      jsonb;
  v_err    text;

BEGIN
  -- Default schedule (no working_hours rows) is 09:00-18:00.
  v_r := public.create_public_booking(v_shop, 'Gate Zero', '+962790000001', v_svc, v_barber, v_t10);
  ASSERT (v_r->>'end_time')::timestamptz = v_t10 + interval '45 minutes', 'duration_override sets end_time';
  RAISE NOTICE 'ok - booking uses duration_override';

  BEGIN
    PERFORM public.create_public_booking(v_shop, 'Gate Zero', '+962790000002', v_svc, v_barber, v_t10 + interval '30 minutes');
    ASSERT false, 'overlap must fail';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    ASSERT v_err = 'SLOT_TAKEN', 'overlap -> SLOT_TAKEN, got ' || v_err;
  END;
  RAISE NOTICE 'ok - overlap with a 45-minute booking is SLOT_TAKEN';

  BEGIN
    PERFORM public.create_public_booking(v_shop, 'Gate Zero', '+962790000003', v_svc, NULL, v_t10);
    ASSERT false, 'any-barber must fail when the only barber is busy';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    ASSERT v_err = 'NO_BARBER_AVAILABLE', 'got ' || v_err;
  END;
  RAISE NOTICE 'ok - any barber: NO_BARBER_AVAILABLE';

  -- Arrived counts as busy.
  UPDATE public.appointments SET status = 'arrived' WHERE id = (v_r->>'appointment_id')::uuid;
  BEGIN
    PERFORM public.create_public_booking(v_shop, 'Gate Zero', '+962790000004', v_svc, v_barber, v_t10);
    ASSERT false, 'arrived appointment must block';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    ASSERT v_err = 'SLOT_TAKEN', 'got ' || v_err;
  END;
  RAISE NOTICE 'ok - arrived is an active status';

  INSERT INTO public.blocked_times (shop_id, barber_id, start_time, end_time, source)
  VALUES (v_shop, NULL, v_t10 + interval '3 hours', v_t10 + interval '4 hours', 'prayer');
  BEGIN
    PERFORM public.create_public_booking(v_shop, 'Gate Zero', '+962790000005', v_svc, v_barber, v_t10 + interval '3 hours');
    ASSERT false, 'blocked time must fail';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    ASSERT v_err = 'SLOT_TAKEN', 'got ' || v_err;
  END;
  RAISE NOTICE 'ok - shop-wide blocked time is SLOT_TAKEN';

  INSERT INTO public.closed_periods (shop_id, start_date, end_date) VALUES (v_shop, v_day + 1, v_day + 1);
  BEGIN
    PERFORM public.create_public_booking(v_shop, 'Gate Zero', '+962790000006', v_svc, v_barber, v_t10 + interval '1 day');
    ASSERT false, 'closed day must fail';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    ASSERT v_err = 'OUTSIDE_WORKING_HOURS', 'got ' || v_err;
  END;
  RAISE NOTICE 'ok - closed period is OUTSIDE_WORKING_HOURS';

  BEGIN
    PERFORM public.create_public_booking(v_shop, 'Gate Zero', '+962790000007', v_svc, v_barber, v_t10 + interval '20 days');
    ASSERT false, 'outside booking window must fail';
  EXCEPTION WHEN raise_exception THEN
    GET STACKED DIAGNOSTICS v_err = MESSAGE_TEXT;
    ASSERT v_err = 'TOO_FAR_AHEAD', 'got ' || v_err;
  END;
  RAISE NOTICE 'ok - booking_window_days is enforced';

  v_r := public.create_public_booking(v_shop, 'Gate Zero', '+962790000008', v_svc, NULL, v_t10 + interval '5 hours');
  ASSERT (v_r->>'barber_id')::uuid = v_barber, 'any barber picks the free barber';
  RAISE NOTICE 'ok - any barber assigns via pick_any_barber';
  RAISE NOTICE 'ALL CREATE_PUBLIC_BOOKING TESTS PASSED';
END $$;
