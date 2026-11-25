-- ═══════════════════════════════════════════════════════════════════════════
-- WS-1C · Messaging engine (part 2 of 2): appointment triggers, dispatcher
-- RPCs and the magic-link (/m/[token]) RPCs.
--
-- This file runs after 1D (002300), so it may read appointment_services,
-- barber_offers_services and the P0V availability functions.
--
--   • messaging_on_appointment  DEFERRABLE INITIALLY DEFERRED constraint
--     trigger: it runs at COMMIT, so it sees the booking's service lines and
--     its final state. It never aborts the booking (errors become WARNINGs).
--   • messaging_claim / messaging_complete  service role only (dispatcher).
--   • get_booking_by_token / confirm_by_token / cancel_by_token /
--     reschedule_by_token  anon + authenticated, rate-limited per IP and per
--     token through check_request_rate_limit(). They never return phone
--     numbers.
--
-- Idempotent and safe on production data. 1C does not modify
-- create_public_booking or reschedule_booking.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0. Every appointment gets a manage token ─────────────────────────────
CREATE OR REPLACE FUNCTION public.messaging_ensure_manage_token()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.manage_token IS NULL THEN
    NEW.manage_token := public.new_manage_token();
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.messaging_ensure_manage_token() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS messaging_ensure_manage_token ON public.appointments;
CREATE TRIGGER messaging_ensure_manage_token
  BEFORE INSERT OR UPDATE ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.messaging_ensure_manage_token();

-- ─── 1. Quiet hours ────────────────────────────────────────────────────────
-- 'HH:MM' → time, or the default when malformed.
CREATE OR REPLACE FUNCTION public.messaging_time(p text, p_default time)
RETURNS time
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p ~ '^([01]\d|2[0-3]):[0-5]\d$' THEN p::time ELSE p_default END;
$$;
REVOKE ALL ON FUNCTION public.messaging_time(text, time) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.messaging_time(text, time) TO authenticated, service_role;

-- When a deferrable send at p_at falls in the shop's quiet window (night or
-- the Friday Jumu'ah window), returns the first allowed instant; NULL when
-- p_at is already allowed. Mirrors quietUntil() in src/lib/messaging.
CREATE OR REPLACE FUNCTION public.messaging_quiet_until(p_quiet jsonb, p_tz text, p_at timestamptz)
RETURNS timestamptz
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  q        jsonb := CASE WHEN jsonb_typeof(p_quiet) = 'object' THEN p_quiet ELSE '{}'::jsonb END;
  v_tz     text := COALESCE(NULLIF(p_tz, ''), 'Asia/Amman');
  v_on     boolean := COALESCE((q ->> 'enabled')::boolean, true);
  v_start  time := public.messaging_time(q ->> 'start', '23:00');
  v_end    time := public.messaging_time(q ->> 'end', '08:00');
  v_jum    boolean := COALESCE((q ->> 'jumuah')::boolean, true);
  v_jstart time := public.messaging_time(q ->> 'jumuah_start', '11:30');
  v_jend   time := public.messaging_time(q ->> 'jumuah_end', '13:30');
  l0       timestamp;
  l        timestamp;
  t        time;
  moved    boolean;
BEGIN
  IF p_at IS NULL THEN RETURN NULL; END IF;
  BEGIN
    l0 := p_at AT TIME ZONE v_tz;
  EXCEPTION WHEN OTHERS THEN
    v_tz := 'Asia/Amman';
    l0 := p_at AT TIME ZONE v_tz;
  END;
  l := l0;
  FOR i IN 1..4 LOOP
    moved := false;
    t := l::time;
    IF v_on AND v_start <> v_end THEN
      IF v_start > v_end THEN
        IF t >= v_start THEN
          l := (l::date + 1) + v_end; moved := true;
        ELSIF t < v_end THEN
          l := l::date + v_end; moved := true;
        END IF;
      ELSIF t >= v_start AND t < v_end THEN
        l := l::date + v_end; moved := true;
      END IF;
    END IF;
    t := l::time;
    IF v_jum AND v_jstart < v_jend AND extract(isodow FROM l) = 5 AND t >= v_jstart AND t < v_jend THEN
      l := l::date + v_jend; moved := true;
    END IF;
    EXIT WHEN NOT moved;
  END LOOP;
  IF l = l0 THEN RETURN NULL; END IF;
  RETURN l AT TIME ZONE v_tz;
END;
$$;
REVOKE ALL ON FUNCTION public.messaging_quiet_until(jsonb, text, timestamptz) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.messaging_quiet_until(jsonb, text, timestamptz) TO authenticated, service_role;

-- Templates that wait for the end of quiet hours (immediate replies to the
-- client's own action, like a booking confirmation, are never held back).
CREATE OR REPLACE FUNCTION public.messaging_template_deferrable(p text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p IN ('reminder', 'thank_you', 'waitlist_offer');
$$;
REVOKE ALL ON FUNCTION public.messaging_template_deferrable(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.messaging_template_deferrable(text) TO authenticated, service_role;

-- ─── 2. Message context snapshot for an appointment ───────────────────────
-- Everything a template needs, in both languages. Stored in the outbox
-- payload so the dashboard can render the wa.me fallback text later.
CREATE OR REPLACE FUNCTION public.messaging_appointment_context(p_appt uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ctx      jsonb;
  v_tz       text;
  v_names    text;
  v_names_ar text;
BEGIN
  SELECT COALESCE(NULLIF(s.timezone, ''), 'Asia/Amman') INTO v_tz
  FROM public.appointments a JOIN public.shops s ON s.id = a.shop_id
  WHERE a.id = p_appt;
  IF v_tz IS NULL THEN RETURN NULL; END IF;

  SELECT string_agg(x.name, ' + ' ORDER BY x.sort, x.created_at),
         string_agg(COALESCE(NULLIF(x.name_ar, ''), x.name), ' + ' ORDER BY x.sort, x.created_at)
    INTO v_names, v_names_ar
  FROM public.appointment_services x WHERE x.appointment_id = p_appt;

  IF v_names IS NULL THEN
    SELECT string_agg(sv.name, ' + ' ORDER BY array_position(a.service_ids, sv.id)),
           string_agg(COALESCE(NULLIF(sv.name_ar, ''), sv.name), ' + ' ORDER BY array_position(a.service_ids, sv.id))
      INTO v_names, v_names_ar
    FROM public.appointments a JOIN public.services sv ON sv.id = ANY (a.service_ids)
    WHERE a.id = p_appt;
  END IF;

  SELECT jsonb_build_object(
    'appointment_id', a.id,
    'token',          a.manage_token,
    'status',         a.status,
    'source',         a.source,
    'shop_id',        s.id,
    'shop_name',      s.name,
    'shop_name_ar',   COALESCE(NULLIF(s.name_ar, ''), s.name),
    'shop_phone',     public.messaging_normalize_phone(COALESCE(NULLIF(s.whatsapp, ''), s.phone)),
    'shop_slug',      s.slug,
    'maps_url',       s.google_maps_url,
    'lat',            s.lat,
    'lng',            s.lng,
    'client_id',      c.id,
    'client_name',    split_part(btrim(COALESCE(NULLIF(c.name, ''), a.client_name, '')), ' ', 1),
    'phone',          public.messaging_normalize_phone(c.phone),
    'locale',         COALESCE(c.preferred_language, 'ar'),
    'barber_name',    b.full_name,
    'services',       COALESCE(v_names, a.service_name, ''),
    'services_ar',    COALESCE(v_names_ar, v_names, a.service_name, ''),
    'start_time',     a.start_time,
    'end_time',       a.end_time,
    'date',           to_char(a.start_time AT TIME ZONE v_tz, 'YYYY-MM-DD'),
    'time',           to_char(a.start_time AT TIME ZONE v_tz, 'HH24:MI'),
    'timezone',       v_tz
  ) INTO v_ctx
  FROM public.appointments a
  JOIN public.shops s ON s.id = a.shop_id
  LEFT JOIN public.clients c ON c.id = a.client_id AND c.deleted_at IS NULL
  LEFT JOIN public.profiles b ON b.id = a.barber_id
  WHERE a.id = p_appt;

  RETURN v_ctx;
END;
$$;
REVOKE ALL ON FUNCTION public.messaging_appointment_context(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_appointment_context(uuid) TO service_role;

-- ─── 3. Planner: what to queue for an appointment event ───────────────────
CREATE OR REPLACE FUNCTION public.messaging_plan_reminders(p_appt uuid, p_ctx jsonb)
RETURNS int
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shop    public.shops%ROWTYPE;
  v_start   timestamptz := (p_ctx ->> 'start_time')::timestamptz;
  v_offset  int;
  v_due     timestamptz;
  v_n       int := 0;
BEGIN
  SELECT * INTO v_shop FROM public.shops WHERE id = (p_ctx ->> 'shop_id')::uuid;
  IF v_shop.id IS NULL OR v_start IS NULL THEN RETURN 0; END IF;
  FOREACH v_offset IN ARRAY COALESCE(v_shop.reminder_offsets, '{}'::int[]) LOOP
    v_due := v_start - make_interval(mins => v_offset);
    CONTINUE WHEN v_due <= now() + interval '1 minute';
    IF public.message_enqueue_internal(
         v_shop.id, 'reminder', p_ctx ->> 'phone', p_ctx ->> 'locale', p_appt,
         NULLIF(p_ctx ->> 'client_id', '')::uuid, NULL,
         jsonb_build_object('ctx', p_ctx, 'offset', v_offset),
         v_due, v_offset,
         'appt:' || p_appt || ':reminder:' || v_offset || ':' || extract(epoch FROM v_start)::bigint) IS NOT NULL THEN
      v_n := v_n + 1;
    END IF;
  END LOOP;
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.messaging_plan_reminders(uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_plan_reminders(uuid, jsonb) TO service_role;

CREATE OR REPLACE FUNCTION public.messaging_plan_appointment(
  p_appt       uuid,
  p_event      text,              -- insert | moved | status
  p_old_status text DEFAULT NULL
)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_ctx     jsonb := public.messaging_appointment_context(p_appt);
  v_shop    public.shops%ROWTYPE;
  v_status  text;
  v_start   timestamptz;
  v_active  boolean;
  v_client  uuid;
  v_payload jsonb;
BEGIN
  IF v_ctx IS NULL THEN RETURN; END IF;
  v_status := v_ctx ->> 'status';
  v_start  := (v_ctx ->> 'start_time')::timestamptz;
  v_active := v_status IN ('pending', 'confirmed', 'awaiting_deposit');
  v_client := NULLIF(v_ctx ->> 'client_id', '')::uuid;
  v_payload := jsonb_build_object('ctx', v_ctx);
  SELECT * INTO v_shop FROM public.shops WHERE id = (v_ctx ->> 'shop_id')::uuid;

  -- A booking that is no longer upcoming never keeps queued reminders.
  IF p_event IN ('moved', 'status') THEN
    UPDATE public.message_outbox o
    SET status = 'cancelled', error = CASE WHEN p_event = 'moved' THEN 'RESCHEDULED' ELSE 'STATUS_CHANGED' END
    WHERE o.appointment_id = p_appt AND o.status IN ('queued', 'fallback')
      AND o.template IN ('reminder', 'confirmation', 'rescheduled')
      AND (p_event = 'moved' OR NOT v_active);
  END IF;

  IF NOT COALESCE(v_shop.messaging_enabled, false) OR (v_ctx ->> 'phone') IS NULL THEN
    RETURN;
  END IF;

  IF p_event = 'insert' THEN
    IF v_active AND v_start > now() AND COALESCE(v_ctx ->> 'source', '') <> 'walk_in' THEN
      PERFORM public.message_enqueue_internal(
        v_shop.id, 'confirmation', v_ctx ->> 'phone', v_ctx ->> 'locale', p_appt, v_client, NULL,
        v_payload, now(), 0, 'appt:' || p_appt || ':confirmation');
      PERFORM public.messaging_plan_reminders(p_appt, v_ctx);
    END IF;
  ELSIF p_event = 'moved' THEN
    IF v_active AND v_start > now() THEN
      PERFORM public.message_enqueue_internal(
        v_shop.id, 'rescheduled', v_ctx ->> 'phone', v_ctx ->> 'locale', p_appt, v_client, NULL,
        v_payload, now(), 0,
        'appt:' || p_appt || ':rescheduled:' || extract(epoch FROM v_start)::bigint);
      PERFORM public.messaging_plan_reminders(p_appt, v_ctx);
    END IF;
  ELSIF p_event = 'status' THEN
    IF v_status = 'cancelled' AND COALESCE(p_old_status, '') <> 'cancelled' AND v_start > now() - interval '1 hour' THEN
      PERFORM public.message_enqueue_internal(
        v_shop.id, 'cancelled', v_ctx ->> 'phone', v_ctx ->> 'locale', p_appt, v_client, NULL,
        v_payload, now(), 0, 'appt:' || p_appt || ':cancelled');
    ELSIF v_status = 'completed' THEN
      PERFORM public.message_enqueue_internal(
        v_shop.id, 'thank_you', v_ctx ->> 'phone', v_ctx ->> 'locale', p_appt, v_client, NULL,
        v_payload, now() + make_interval(mins => COALESCE(v_shop.review_request_delay_minutes, 120)), 0,
        'appt:' || p_appt || ':thank_you');
    END IF;
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.messaging_plan_appointment(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_plan_appointment(uuid, text, text) TO service_role;

-- Trigger body: never lets messaging break a booking write.
CREATE OR REPLACE FUNCTION public.messaging_on_appointment()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  BEGIN
    IF TG_OP = 'INSERT' THEN
      PERFORM public.messaging_plan_appointment(NEW.id, 'insert');
    ELSE
      IF NEW.start_time IS DISTINCT FROM OLD.start_time THEN
        PERFORM public.messaging_plan_appointment(NEW.id, 'moved');
      END IF;
      IF NEW.status IS DISTINCT FROM OLD.status THEN
        PERFORM public.messaging_plan_appointment(NEW.id, 'status', OLD.status);
      END IF;
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'messaging_on_appointment(%): %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.messaging_on_appointment() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS messaging_appointment_events ON public.appointments;
CREATE CONSTRAINT TRIGGER messaging_appointment_events
  AFTER INSERT OR UPDATE OF status, start_time ON public.appointments
  DEFERRABLE INITIALLY DEFERRED
  FOR EACH ROW EXECUTE FUNCTION public.messaging_on_appointment();

-- ─── 4. Dispatcher RPCs (service role) ────────────────────────────────────
-- Claims due messages. With p_live = false (no provider configured) due rows
-- become 'fallback' so the dashboard offers wa.me click-to-send links.
-- Returns {claimed: [row…], fallback, deferred, skipped, cancelled, recovered}.
CREATE OR REPLACE FUNCTION public.messaging_claim(p_limit int DEFAULT 50, p_live boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_limit     int := LEAST(GREATEST(COALESCE(p_limit, 50), 1), 200);
  r           record;
  v_until     timestamptz;
  v_claimed   jsonb := '[]'::jsonb;
  v_n         int := 0;
  v_fallback  int := 0;
  v_deferred  int := 0;
  v_skipped   int := 0;
  v_cancelled int := 0;
  v_recovered int := 0;
BEGIN
  -- Rows stuck in 'sending' (crashed run): retry, or give up after 5 tries.
  UPDATE public.message_outbox
  SET status = CASE WHEN attempts >= 5 THEN 'failed' ELSE 'queued' END,
      error  = CASE WHEN attempts >= 5 THEN 'STUCK' ELSE error END,
      locked_at = NULL
  WHERE status = 'sending' AND locked_at < now() - interval '10 minutes';
  GET DIAGNOSTICS v_recovered = ROW_COUNT;

  FOR r IN
    SELECT o.id, o.shop_id, o.appointment_id, o.client_id, o.to_phone, o.channel, o.template,
           o.template_version, o.category, o.locale, o.payload, o.body, o.offset_minutes,
           o.attempts, o.scheduled_for,
           s.quiet_hours, COALESCE(NULLIF(s.timezone, ''), 'Asia/Amman') AS tz, s.sms_fallback,
           s.messaging_enabled,
           a.status AS appt_status, a.start_time AS appt_start
    FROM public.message_outbox o
    JOIN public.shops s ON s.id = o.shop_id
    LEFT JOIN public.appointments a ON a.id = o.appointment_id
    WHERE o.status = 'queued' AND o.scheduled_for <= now()
    ORDER BY o.scheduled_for
    LIMIT v_limit * 3
    FOR UPDATE OF o SKIP LOCKED
  LOOP
    EXIT WHEN v_n >= v_limit;

    -- Stale appointment messages.
    IF r.template IN ('reminder', 'confirmation', 'rescheduled')
       AND (r.appointment_id IS NULL OR r.appt_status IS NULL
            OR r.appt_status NOT IN ('pending', 'confirmed', 'awaiting_deposit')
            OR r.appt_start <= now()) THEN
      UPDATE public.message_outbox SET status = 'skipped', error = 'STALE' WHERE id = r.id;
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    IF r.template = 'thank_you' AND COALESCE(r.appt_status, '') <> 'completed' THEN
      UPDATE public.message_outbox SET status = 'skipped', error = 'STALE' WHERE id = r.id;
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    IF r.to_phone IS NULL THEN
      UPDATE public.message_outbox SET status = 'skipped', error = 'NO_PHONE' WHERE id = r.id;
      v_skipped := v_skipped + 1; CONTINUE;
    END IF;
    IF NOT r.messaging_enabled AND NOT COALESCE((r.payload ->> 'manual')::boolean, false)
       AND r.template <> 'opt_out_confirmation' THEN
      UPDATE public.message_outbox SET status = 'cancelled', error = 'DISABLED' WHERE id = r.id;
      v_cancelled := v_cancelled + 1; CONTINUE;
    END IF;

    -- Opt-out: non-transactional templates stop for opted-out clients.
    IF public.messaging_template_optional(r.template) AND EXISTS (
         SELECT 1 FROM public.marketing_consents mc
         JOIN public.clients c ON c.id = mc.client_id
         WHERE mc.opted_in = false
           AND (mc.client_id = r.client_id
                OR (c.shop_id = r.shop_id AND public.messaging_normalize_phone(c.phone) = r.to_phone))) THEN
      UPDATE public.message_outbox SET status = 'cancelled', error = 'OPTED_OUT' WHERE id = r.id;
      v_cancelled := v_cancelled + 1; CONTINUE;
    END IF;

    -- Quiet hours: defer (a reminder that would land after the visit is dropped).
    IF public.messaging_template_deferrable(r.template) THEN
      v_until := public.messaging_quiet_until(r.quiet_hours, r.tz, now());
      IF v_until IS NOT NULL THEN
        IF r.template = 'reminder' AND r.appt_start IS NOT NULL AND v_until >= r.appt_start - interval '10 minutes' THEN
          UPDATE public.message_outbox SET status = 'skipped', error = 'QUIET_HOURS' WHERE id = r.id;
          v_skipped := v_skipped + 1;
        ELSE
          UPDATE public.message_outbox SET scheduled_for = v_until WHERE id = r.id;
          v_deferred := v_deferred + 1;
        END IF;
        CONTINUE;
      END IF;
    END IF;

    IF NOT COALESCE(p_live, false) THEN
      UPDATE public.message_outbox
      SET status = 'fallback', channel = 'wa_link', provider = 'wa_link', error = NULL
      WHERE id = r.id;
      v_fallback := v_fallback + 1; CONTINUE;
    END IF;

    UPDATE public.message_outbox
    SET status = 'sending', locked_at = now(), attempts = attempts + 1
    WHERE id = r.id;
    v_n := v_n + 1;
    v_claimed := v_claimed || jsonb_build_array(jsonb_build_object(
      'id', r.id, 'shop_id', r.shop_id, 'appointment_id', r.appointment_id,
      'to', r.to_phone, 'channel', r.channel, 'template', r.template,
      'template_version', r.template_version, 'category', r.category, 'locale', r.locale,
      'payload', r.payload, 'body', r.body, 'offset_minutes', r.offset_minutes,
      'attempts', r.attempts + 1, 'sms_fallback', r.sms_fallback,
      'session_open', public.messaging_session_open(r.to_phone)));
  END LOOP;

  RETURN jsonb_build_object(
    'claimed', v_claimed, 'fallback', v_fallback, 'deferred', v_deferred,
    'skipped', v_skipped, 'cancelled', v_cancelled, 'recovered', v_recovered);
END;
$$;
REVOKE ALL ON FUNCTION public.messaging_claim(int, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_claim(int, boolean) TO service_role;

-- Records the outcome of one send attempt.
--   sent      → provider accepted it (delivery receipts arrive by webhook)
--   failed    → final failure
--   retry     → back to 'queued' at p_retry_at (attempts < 5), else 'failed'
--   fallback  → no provider could send: staff use the wa.me link
CREATE OR REPLACE FUNCTION public.messaging_complete(
  p_id              uuid,
  p_result          text,
  p_provider        text DEFAULT NULL,
  p_provider_msg_id text DEFAULT NULL,
  p_channel         text DEFAULT NULL,
  p_cost_fils       int DEFAULT 0,
  p_error           text DEFAULT NULL,
  p_retry_at        timestamptz DEFAULT NULL
)
RETURNS text
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_row    public.message_outbox%ROWTYPE;
  v_status text;
BEGIN
  SELECT * INTO v_row FROM public.message_outbox WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL THEN RETURN NULL; END IF;
  IF v_row.status <> 'sending' THEN RETURN v_row.status; END IF;  -- idempotent

  v_status := CASE p_result
    WHEN 'sent' THEN 'sent'
    WHEN 'fallback' THEN 'fallback'
    WHEN 'retry' THEN CASE WHEN v_row.attempts >= 5 THEN 'failed' ELSE 'queued' END
    ELSE 'failed' END;

  UPDATE public.message_outbox
  SET status          = v_status,
      locked_at       = NULL,
      provider        = COALESCE(left(p_provider, 40), provider),
      provider_msg_id = COALESCE(left(p_provider_msg_id, 200), provider_msg_id),
      channel         = CASE WHEN p_channel IN ('whatsapp', 'sms', 'wa_link') THEN p_channel
                             WHEN v_status = 'fallback' THEN 'wa_link' ELSE channel END,
      cost_fils       = cost_fils + GREATEST(COALESCE(p_cost_fils, 0), 0),
      error           = CASE WHEN v_status IN ('sent') THEN NULL ELSE left(p_error, 500) END,
      sent_at         = CASE WHEN v_status = 'sent' THEN now() ELSE sent_at END,
      scheduled_for   = CASE WHEN v_status = 'queued'
                             THEN GREATEST(COALESCE(p_retry_at, now() + make_interval(mins => 2 * v_row.attempts)), now())
                             ELSE scheduled_for END
  WHERE id = p_id;
  RETURN v_status;
END;
$$;
REVOKE ALL ON FUNCTION public.messaging_complete(uuid, text, text, text, text, int, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_complete(uuid, text, text, text, text, int, text, timestamptz) TO service_role;

-- ─── 5. Magic-link RPCs (/m/[token]) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.messaging_token_valid(p_token text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p_token IS NOT NULL AND p_token ~ '^[A-Za-z0-9_-]{20,64}$';
$$;
REVOKE ALL ON FUNCTION public.messaging_token_valid(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.messaging_token_valid(text) TO anon, authenticated, service_role;

-- Per-IP and per-token limits; raises RATE_LIMITED.
CREATE OR REPLACE FUNCTION public.messaging_token_guard(p_token text, p_write boolean)
RETURNS void
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NOT public.check_request_rate_limit(
       CASE WHEN p_write THEN 'manage_token_write' ELSE 'manage_token_read' END,
       CASE WHEN p_write THEN 20 ELSE 120 END, 600, NULL) THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.check_rate_limit(
       'manage_token:' || CASE WHEN p_write THEN 'w:' ELSE 'r:' END || md5(COALESCE(p_token, '')),
       CASE WHEN p_write THEN 10 ELSE 60 END, 600) THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;
END;
$$;
REVOKE ALL ON FUNCTION public.messaging_token_guard(text, boolean) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_token_guard(text, boolean) TO service_role;

-- The booking behind a manage token, or NULL. Never exposes phone numbers.
-- Links stop working 30 days after the visit.
CREATE OR REPLACE FUNCTION public.get_booking_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appt     public.appointments%ROWTYPE;
  v_shop     public.shops%ROWTYPE;
  v_tz       text;
  v_hours    int;
  v_deadline timestamptz;
  v_active   boolean;
  v_items    jsonb;
  v_barber   jsonb;
  v_client   text;
BEGIN
  IF NOT public.messaging_token_valid(p_token) THEN RETURN NULL; END IF;
  PERFORM public.messaging_token_guard(p_token, false);

  SELECT * INTO v_appt FROM public.appointments WHERE manage_token = p_token;
  IF v_appt.id IS NULL OR v_appt.end_time < now() - interval '30 days' THEN RETURN NULL; END IF;
  SELECT * INTO v_shop FROM public.shops WHERE id = v_appt.shop_id;
  v_tz := COALESCE(NULLIF(v_shop.timezone, ''), 'Asia/Amman');
  v_hours := COALESCE(v_shop.cancellation_policy_hours, 0);
  v_deadline := CASE WHEN v_hours > 0 THEN v_appt.start_time - make_interval(hours => v_hours) END;
  v_active := v_appt.status IN ('pending', 'confirmed', 'awaiting_deposit') AND v_appt.start_time > now();

  SELECT COALESCE(jsonb_agg(jsonb_build_object(
           'service_id', x.service_id, 'name', x.name, 'name_ar', COALESCE(NULLIF(x.name_ar, ''), x.name),
           'duration', x.duration, 'price', x.price) ORDER BY x.sort, x.created_at), '[]'::jsonb)
    INTO v_items
  FROM public.appointment_services x WHERE x.appointment_id = v_appt.id;
  IF v_items = '[]'::jsonb THEN
    SELECT COALESCE(jsonb_agg(jsonb_build_object(
             'service_id', sv.id, 'name', sv.name, 'name_ar', COALESCE(NULLIF(sv.name_ar, ''), sv.name),
             'duration', sv.duration, 'price', sv.price) ORDER BY array_position(v_appt.service_ids, sv.id)), '[]'::jsonb)
      INTO v_items
    FROM public.services sv WHERE sv.id = ANY (COALESCE(v_appt.service_ids, '{}'::uuid[]));
  END IF;

  SELECT jsonb_build_object('id', p.id, 'name', p.full_name, 'avatar_url', p.avatar_url)
    INTO v_barber FROM public.profiles p WHERE p.id = v_appt.barber_id;
  SELECT split_part(btrim(COALESCE(NULLIF(c.name, ''), v_appt.client_name, '')), ' ', 1)
    INTO v_client FROM public.clients c WHERE c.id = v_appt.client_id;

  RETURN jsonb_build_object(
    'appointment_id', v_appt.id,
    'status',         v_appt.status,
    'start_time',     v_appt.start_time,
    'end_time',       v_appt.end_time,
    'timezone',       v_tz,
    'price',          v_appt.price,
    'currency',       COALESCE(v_appt.currency, v_shop.currency, 'JOD'),
    'client_name',    COALESCE(v_client, split_part(btrim(COALESCE(v_appt.client_name, '')), ' ', 1)),
    'barber',         v_barber,
    'items',          v_items,
    'service_ids',    COALESCE((SELECT jsonb_agg(e -> 'service_id') FROM jsonb_array_elements(v_items) e
                                WHERE e ->> 'service_id' IS NOT NULL), '[]'::jsonb),
    'shop', jsonb_build_object(
      'id', v_shop.id, 'name', v_shop.name, 'name_ar', COALESCE(NULLIF(v_shop.name_ar, ''), v_shop.name),
      'slug', v_shop.slug, 'phone', v_shop.phone, 'whatsapp', v_shop.whatsapp,
      'address', v_shop.address, 'landmark_en', v_shop.landmark_en, 'landmark_ar', v_shop.landmark_ar,
      'lat', v_shop.lat, 'lng', v_shop.lng, 'google_maps_url', v_shop.google_maps_url),
    'policy', jsonb_build_object(
      'hours', v_hours, 'fee_percent', COALESCE(v_shop.cancellation_fee_percent, 0),
      'deadline', v_deadline),
    'can_confirm',    v_active AND v_appt.status = 'pending',
    'can_cancel',     v_active AND (v_deadline IS NULL OR now() < v_deadline),
    'can_reschedule', v_active AND (v_deadline IS NULL OR now() < v_deadline)
  );
END;
$$;
REVOKE ALL ON FUNCTION public.get_booking_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_booking_by_token(text) TO anon, authenticated, service_role;

-- The client confirms a pending booking.
CREATE OR REPLACE FUNCTION public.confirm_by_token(p_token text)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_appt public.appointments%ROWTYPE;
BEGIN
  IF NOT public.messaging_token_valid(p_token) THEN
    RAISE EXCEPTION 'APPT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.messaging_token_guard(p_token, true);
  SELECT * INTO v_appt FROM public.appointments WHERE manage_token = p_token FOR UPDATE;
  IF v_appt.id IS NULL THEN
    RAISE EXCEPTION 'APPT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_appt.start_time <= now() THEN
    RAISE EXCEPTION 'ALREADY_STARTED' USING ERRCODE = 'P0001';
  END IF;
  IF v_appt.status = 'confirmed' THEN
    RETURN jsonb_build_object('appointment_id', v_appt.id, 'status', 'confirmed');
  END IF;
  IF v_appt.status <> 'pending' THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.appointments SET status = 'confirmed' WHERE id = v_appt.id;
  RETURN jsonb_build_object('appointment_id', v_appt.id, 'status', 'confirmed');
END;
$$;
REVOKE ALL ON FUNCTION public.confirm_by_token(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.confirm_by_token(text) TO anon, authenticated, service_role;

-- The client cancels; same rules as cancel_customer_booking (policy window
-- raises INSIDE_CANCELLATION_WINDOW with DETAIL = hours).
CREATE OR REPLACE FUNCTION public.cancel_by_token(p_token text, p_reason text DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appt  public.appointments%ROWTYPE;
  v_hours int;
  v_now   timestamptz := now();
BEGIN
  IF NOT public.messaging_token_valid(p_token) THEN
    RAISE EXCEPTION 'APPT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.messaging_token_guard(p_token, true);
  SELECT * INTO v_appt FROM public.appointments WHERE manage_token = p_token FOR UPDATE;
  IF v_appt.id IS NULL THEN
    RAISE EXCEPTION 'APPT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_appt.status = 'cancelled' THEN
    RETURN jsonb_build_object('appointment_id', v_appt.id, 'status', 'cancelled', 'cancelled_at', v_appt.cancelled_at);
  END IF;
  IF v_appt.status NOT IN ('pending', 'confirmed', 'awaiting_deposit') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = 'P0001';
  END IF;
  IF v_appt.start_time <= v_now THEN
    RAISE EXCEPTION 'ALREADY_STARTED' USING ERRCODE = 'P0001';
  END IF;
  SELECT COALESCE(s.cancellation_policy_hours, 0) INTO v_hours FROM public.shops s WHERE s.id = v_appt.shop_id;
  IF v_hours > 0 AND v_appt.start_time - v_now < make_interval(hours => v_hours) THEN
    RAISE EXCEPTION 'INSIDE_CANCELLATION_WINDOW' USING ERRCODE = 'P0001', DETAIL = v_hours::text;
  END IF;

  UPDATE public.appointments
  SET status = 'cancelled',
      cancelled_at = v_now,
      cancellation_reason = NULLIF(left(btrim(COALESCE(p_reason, '')), 500), '')
  WHERE id = v_appt.id;
  RETURN jsonb_build_object('appointment_id', v_appt.id, 'status', 'cancelled', 'cancelled_at', v_now);
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_by_token(text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.cancel_by_token(text, text) TO anon, authenticated, service_role;

-- The client moves the booking. Same checks as the customer path of the 1D
-- reschedule_booking RPC (which needs a signed-in user), using the same
-- availability building blocks and barber lock.
CREATE OR REPLACE FUNCTION public.reschedule_by_token(
  p_token     text,
  p_date      date,
  p_start     text,
  p_barber_id uuid DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appt     public.appointments%ROWTYPE;
  v_shop     public.shops%ROWTYPE;
  v_tz       text;
  v_start    timestamptz;
  v_end      timestamptz;
  v_minutes  int;
  v_barber   uuid;
  v_services uuid[];
  v_items    jsonb;
BEGIN
  IF NOT public.messaging_token_valid(p_token) THEN
    RAISE EXCEPTION 'APPT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF p_date IS NULL OR p_start IS NULL OR p_start !~ '^([01]\d|2[0-3]):[0-5]\d$' THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  PERFORM public.messaging_token_guard(p_token, true);

  SELECT * INTO v_appt FROM public.appointments WHERE manage_token = p_token FOR UPDATE;
  IF v_appt.id IS NULL THEN
    RAISE EXCEPTION 'APPT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_appt.status NOT IN ('pending', 'confirmed', 'awaiting_deposit') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = 'P0001';
  END IF;
  IF v_appt.start_time <= now() THEN
    RAISE EXCEPTION 'ALREADY_STARTED' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_shop FROM public.shops WHERE id = v_appt.shop_id;
  v_tz := COALESCE(NULLIF(v_shop.timezone, ''), 'Asia/Amman');
  IF COALESCE(v_shop.cancellation_policy_hours, 0) > 0
     AND v_appt.start_time < now() + make_interval(hours => v_shop.cancellation_policy_hours) THEN
    RAISE EXCEPTION 'INSIDE_CANCELLATION_WINDOW' USING ERRCODE = 'P0001',
      DETAIL = v_shop.cancellation_policy_hours::text;
  END IF;

  v_start := (p_date + p_start::time) AT TIME ZONE v_tz;
  IF v_start <= now() THEN
    RAISE EXCEPTION 'SLOT_IN_PAST' USING ERRCODE = 'P0001';
  END IF;
  IF v_start > now() + make_interval(days => COALESCE(v_shop.booking_window_days, 90)) THEN
    RAISE EXCEPTION 'TOO_FAR_AHEAD' USING ERRCODE = 'P0001';
  END IF;
  v_minutes := GREATEST(5, (extract(epoch FROM (v_appt.end_time - v_appt.start_time)) / 60)::int);
  v_end := v_start + make_interval(mins => v_minutes);

  SELECT array_agg(x.service_id ORDER BY x.sort) INTO v_services
  FROM public.appointment_services x
  WHERE x.appointment_id = v_appt.id AND x.service_id IS NOT NULL;
  v_services := COALESCE(v_services, v_appt.service_ids);
  IF v_services IS NULL OR cardinality(v_services) = 0 THEN
    RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  v_items := to_jsonb(v_services);
  -- Lets the availability engine ignore this booking's own time once
  -- availability_allowed_ignore() honours it (handoff to P0V); harmless before.
  PERFORM set_config('halaqy.manage_appointment', v_appt.id::text, true);

  IF p_barber_id IS NOT NULL AND p_barber_id IS DISTINCT FROM v_appt.barber_id THEN
    IF NOT EXISTS (SELECT 1 FROM public.profiles p
                   WHERE p.id = p_barber_id AND p.shop_id = v_appt.shop_id
                     AND p.role::text IN ('barber', 'shop_admin')
                     AND p.online_bookable IS NOT FALSE) THEN
      RAISE EXCEPTION 'BARBER_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.barber_offers_services(p_barber_id, v_services) THEN
      RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    v_barber := p_barber_id;
  ELSE
    v_barber := v_appt.barber_id;
  END IF;
  IF v_barber IS NULL THEN
    v_barber := public.pick_any_barber(v_appt.shop_id, v_start, v_items, v_appt.id, NULL);
    IF v_barber IS NULL THEN
      RAISE EXCEPTION 'NO_BARBER_AVAILABLE' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  IF NOT public.barber_is_working(v_barber, v_start, v_end, v_tz) THEN
    RAISE EXCEPTION 'OUTSIDE_WORKING_HOURS' USING ERRCODE = 'P0001';
  END IF;
  PERFORM pg_advisory_xact_lock(hashtext('appt:barber:' || v_barber::text));
  IF NOT public.is_slot_bookable(v_appt.shop_id, v_start, v_items, v_barber, v_appt.id, NULL) THEN
    RAISE EXCEPTION 'SLOT_TAKEN' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    UPDATE public.appointments
    SET start_time = v_start,
        end_time   = v_end,
        barber_id  = v_barber,
        date       = CASE WHEN date IS NULL THEN NULL ELSE (v_start AT TIME ZONE v_tz)::date END
    WHERE id = v_appt.id;
  EXCEPTION WHEN exclusion_violation THEN
    RAISE EXCEPTION 'SLOT_TAKEN' USING ERRCODE = 'P0001';
  END;

  RETURN jsonb_build_object(
    'appointment_id', v_appt.id,
    'barber_id',      v_barber,
    'start_time',     v_start,
    'end_time',       v_end,
    'status',         v_appt.status
  );
END;
$$;
REVOKE ALL ON FUNCTION public.reschedule_by_token(text, date, text, uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reschedule_by_token(text, date, text, uuid) TO anon, authenticated, service_role;
