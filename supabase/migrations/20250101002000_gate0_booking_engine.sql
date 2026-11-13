-- ═══════════════════════════════════════════════════════════════════════
-- Gate 0 integration
--
--   1. idx_appointments_barber_active covers every ACTIVE status
--      (pending, confirmed, awaiting_deposit, arrived, in_chair), matching
--      the appointments_no_overlap exclusion constraint and the engine.
--   2. create_public_booking (same 8-arg signature, same error codes) now
--      decides bookability with the WS-P0V availability engine:
--        • barber_is_working → OUTSIDE_WORKING_HOURS (closures, overrides,
--          special hours, time off, night shifts);
--        • is_slot_bookable under the per-barber advisory lock → SLOT_TAKEN
--          (appointments + buffers, blocks, holds, online_bookable);
--        • "any barber" via pick_any_barber, then lock + recheck;
--        • duration honours barber_services.duration_override;
--        • booking window = shops.booking_window_days, min notice =
--          shops.min_notice_minutes (public callers only);
--        • per-IP + per-phone request rate limit (check_request_rate_limit).
--
-- Idempotent: DROP INDEX IF EXISTS / CREATE INDEX IF NOT EXISTS and
-- CREATE OR REPLACE FUNCTION. No data changes.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Active-appointment index ───────────────────────────────────────
DROP INDEX IF EXISTS public.idx_appointments_barber_active;
CREATE INDEX IF NOT EXISTS idx_appointments_barber_active ON public.appointments (barber_id, start_time)
  WHERE status IN ('pending', 'confirmed', 'awaiting_deposit', 'arrived', 'in_chair');

-- ─── 2. create_public_booking on the availability engine ──────────────
CREATE OR REPLACE FUNCTION public.create_public_booking(
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
  v_items        jsonb;
  v_count        int;
  v_duration     int;
  v_price        numeric(10,2);
  v_service_name text;
  v_end          timestamptz;
  v_barber       uuid;
  v_client_id    uuid;
  v_appt_id      uuid;
  v_source       text;
  v_staff        boolean;
  v_window_days  int;
  v_verified_phone text;
  v_verified_email text;
BEGIN
  -- ── Input shape ──
  IF p_shop_id IS NULL OR p_start_time IS NULL OR p_service_ids IS NULL
     OR cardinality(p_service_ids) = 0 OR cardinality(p_service_ids) > 10
     OR length(v_name) < 2 OR length(v_digits) < 7 OR length(v_digits) > 15 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  -- Keep the customer's order (first occurrence) for the engine's processing gaps.
  SELECT array_agg(x ORDER BY o) INTO v_services
  FROM (SELECT DISTINCT ON (x) x, o FROM unnest(p_service_ids) WITH ORDINALITY AS u(x, o) ORDER BY x, o) d;
  v_items := to_jsonb(v_services);

  v_source := CASE WHEN p_source IN ('online', 'instagram', 'google', 'word_of_mouth', 'walk_in', 'whatsapp', 'other')
                   THEN p_source ELSE 'online' END;

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

  -- ── Services: must all be active in this shop; price from DB ──
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
  ELSE
    v_barber := public.pick_any_barber(p_shop_id, p_start_time, v_items, NULL, NULL);
    IF v_barber IS NULL THEN
      RAISE EXCEPTION 'NO_BARBER_AVAILABLE' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Engine duration for this barber (per-barber duration overrides).
  SELECT COALESCE(sum(COALESCE(bs.duration_override, s.duration)), 0)::int INTO v_duration
  FROM public.services s
  LEFT JOIN public.barber_services bs ON bs.barber_id = v_barber AND bs.service_id = s.id
  WHERE s.id = ANY (v_services);
  IF v_duration < 5 OR v_duration > 720 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  v_end := p_start_time + make_interval(mins => v_duration);

  IF p_barber_id IS NOT NULL
     AND NOT public.barber_is_working(v_barber, p_start_time, v_end, v_tz) THEN
    RAISE EXCEPTION 'OUTSIDE_WORKING_HOURS' USING ERRCODE = 'P0001';
  END IF;

  -- Serialise writers per barber, then the exact engine check.
  PERFORM pg_advisory_xact_lock(hashtext('appt:barber:' || v_barber::text));
  IF NOT public.is_slot_bookable(p_shop_id, p_start_time, v_items, v_barber, NULL, NULL) THEN
    IF p_barber_id IS NULL THEN
      RAISE EXCEPTION 'NO_BARBER_AVAILABLE' USING ERRCODE = 'P0001';
    END IF;
    RAISE EXCEPTION 'SLOT_TAKEN' USING ERRCODE = 'P0001';
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
      WHERE a.client_id = v_client_id
        AND a.status IN ('pending', 'confirmed', 'awaiting_deposit', 'arrived', 'in_chair')
        AND a.start_time > now()) >= 5 THEN
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

REVOKE ALL ON FUNCTION public.create_public_booking(uuid, text, text, uuid[], uuid, timestamptz, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.create_public_booking(uuid, text, text, uuid[], uuid, timestamptz, text, text)
  TO anon, authenticated, service_role;
