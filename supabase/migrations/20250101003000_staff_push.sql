-- ═══════════════════════════════════════════════════════════════════════════
-- WS-1K · Business-side notifications (staff Web Push + WhatsApp fallback)
--
--   notification_prefs        per staff member × event × channel (push|whatsapp)
--   push_subscriptions        one row per browser/PWA push endpoint
--   staff_push_outbox         jobs written by notify_staff(); drained by
--                             /api/push/dispatch (service role)
--   push_dispatch_config      optional pg_net "kick" target (URL + secret)
--
-- Flow: AFTER INSERT/UPDATE on appointments → notify_staff() resolves the event
-- and the recipients (assigned barber, or the shop admins when unassigned),
-- drops recipients who switched both channels off, and writes one outbox row
-- per recipient. A statement-level trigger on the outbox POSTs to the
-- dispatcher through pg_net when it is installed and configured, so a booking
-- reaches the phone in seconds; the dispatcher can also be driven by cron or
-- by the app right after a booking (see src/lib/push/dispatch.ts).
--
-- Safety:
--   • notify_staff() never raises: any failure is downgraded to a WARNING so a
--     booking or cancellation can never fail because of notifications.
--   • Outbox, config and subscription keys are invisible to anon/authenticated.
--   • Idempotent: IF NOT EXISTS / CREATE OR REPLACE / DROP ... IF EXISTS.
-- ═══════════════════════════════════════════════════════════════════════════

-- profiles.phone is used for the WhatsApp fallback (added by 0200/1600; guarded).
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS phone text;

-- pg_net lets the outbox trigger wake the dispatcher immediately. Optional:
-- when the extension is unavailable the cron/app paths still drain the outbox.
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_available_extensions WHERE name = 'pg_net')
     AND NOT EXISTS (SELECT 1 FROM pg_extension WHERE extname = 'pg_net') THEN
    BEGIN
      CREATE EXTENSION IF NOT EXISTS pg_net;
    EXCEPTION WHEN OTHERS THEN
      RAISE NOTICE 'pg_net not installed (%); push dispatch falls back to cron/app kicks', SQLERRM;
    END;
  END IF;
END $$;

-- ─── Events ────────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_push_events()
RETURNS text[]
LANGUAGE sql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT ARRAY['booking_new', 'booking_cancelled', 'booking_rescheduled', 'walk_in_assigned', 'waitlist_filled']::text[];
$$;
GRANT EXECUTE ON FUNCTION public.staff_push_events() TO anon, authenticated, service_role;

-- ─── notification_prefs ───────────────────────────────────────────────────
-- A missing row means the default: push ON, WhatsApp OFF (WhatsApp costs money).
CREATE TABLE IF NOT EXISTS public.notification_prefs (
  profile_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  event      text NOT NULL,
  channel    text NOT NULL,
  enabled    boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (profile_id, event, channel),
  CONSTRAINT notification_prefs_event_check
    CHECK (event IN ('booking_new', 'booking_cancelled', 'booking_rescheduled', 'walk_in_assigned', 'waitlist_filled')),
  CONSTRAINT notification_prefs_channel_check CHECK (channel IN ('push', 'whatsapp'))
);

ALTER TABLE public.notification_prefs ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.notification_prefs FROM anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.notification_prefs TO authenticated;
GRANT ALL ON public.notification_prefs TO service_role;

DROP POLICY IF EXISTS notification_prefs_select_own ON public.notification_prefs;
CREATE POLICY notification_prefs_select_own ON public.notification_prefs
  FOR SELECT TO authenticated USING (profile_id = auth.uid());
DROP POLICY IF EXISTS notification_prefs_insert_own ON public.notification_prefs;
CREATE POLICY notification_prefs_insert_own ON public.notification_prefs
  FOR INSERT TO authenticated WITH CHECK (profile_id = auth.uid() AND public.is_shop_staff());
DROP POLICY IF EXISTS notification_prefs_update_own ON public.notification_prefs;
CREATE POLICY notification_prefs_update_own ON public.notification_prefs
  FOR UPDATE TO authenticated USING (profile_id = auth.uid()) WITH CHECK (profile_id = auth.uid());
DROP POLICY IF EXISTS notification_prefs_delete_own ON public.notification_prefs;
CREATE POLICY notification_prefs_delete_own ON public.notification_prefs
  FOR DELETE TO authenticated USING (profile_id = auth.uid());

DROP TRIGGER IF EXISTS set_updated_at ON public.notification_prefs;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.notification_prefs
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── push_subscriptions ───────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.push_subscriptions (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  shop_id         uuid REFERENCES public.shops(id) ON DELETE CASCADE,
  endpoint        text NOT NULL,
  keys            jsonb NOT NULL,
  user_agent      text,
  locale          text NOT NULL DEFAULT 'ar',
  failure_count   int  NOT NULL DEFAULT 0,
  last_success_at timestamptz,
  last_failure_at timestamptz,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_subscriptions_endpoint_https CHECK (endpoint ~ '^https://' AND length(endpoint) <= 1024),
  CONSTRAINT push_subscriptions_keys_shape CHECK (
    jsonb_typeof(keys) = 'object'
    AND jsonb_typeof(keys -> 'p256dh') = 'string'
    AND jsonb_typeof(keys -> 'auth') = 'string'
  ),
  CONSTRAINT push_subscriptions_locale_check CHECK (locale IN ('en', 'ar')),
  CONSTRAINT push_subscriptions_user_agent_len CHECK (user_agent IS NULL OR length(user_agent) <= 512)
);
CREATE UNIQUE INDEX IF NOT EXISTS push_subscriptions_endpoint_key ON public.push_subscriptions (endpoint);
CREATE INDEX IF NOT EXISTS push_subscriptions_profile_idx ON public.push_subscriptions (profile_id);

ALTER TABLE public.push_subscriptions ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_subscriptions FROM anon, authenticated;
-- Owners see their devices but never the encryption keys; writes go through RPCs.
GRANT SELECT (id, profile_id, shop_id, endpoint, user_agent, locale, failure_count,
              last_success_at, last_failure_at, created_at, updated_at)
  ON public.push_subscriptions TO authenticated;
GRANT DELETE ON public.push_subscriptions TO authenticated;
GRANT ALL ON public.push_subscriptions TO service_role;

DROP POLICY IF EXISTS push_subscriptions_select_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_select_own ON public.push_subscriptions
  FOR SELECT TO authenticated USING (profile_id = auth.uid());
DROP POLICY IF EXISTS push_subscriptions_delete_own ON public.push_subscriptions;
CREATE POLICY push_subscriptions_delete_own ON public.push_subscriptions
  FOR DELETE TO authenticated USING (profile_id = auth.uid());

DROP TRIGGER IF EXISTS set_updated_at ON public.push_subscriptions;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.push_subscriptions
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── staff_push_outbox (service role only) ────────────────────────────────
CREATE TABLE IF NOT EXISTS public.staff_push_outbox (
  id             uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id        uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  profile_id     uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  appointment_id uuid REFERENCES public.appointments(id) ON DELETE CASCADE,
  event          text NOT NULL,
  payload        jsonb NOT NULL DEFAULT '{}'::jsonb,
  status         text NOT NULL DEFAULT 'pending',
  attempts       int  NOT NULL DEFAULT 0,
  result         jsonb,
  error          text,
  created_at     timestamptz NOT NULL DEFAULT now(),
  claimed_at     timestamptz,
  finished_at    timestamptz,
  CONSTRAINT staff_push_outbox_event_check
    CHECK (event IN ('booking_new', 'booking_cancelled', 'booking_rescheduled', 'walk_in_assigned', 'waitlist_filled', 'test')),
  CONSTRAINT staff_push_outbox_status_check
    CHECK (status IN ('pending', 'processing', 'sent', 'failed', 'skipped', 'expired'))
);
CREATE INDEX IF NOT EXISTS staff_push_outbox_pending_idx
  ON public.staff_push_outbox (created_at) WHERE status IN ('pending', 'processing');
CREATE INDEX IF NOT EXISTS staff_push_outbox_profile_idx ON public.staff_push_outbox (profile_id, created_at DESC);

ALTER TABLE public.staff_push_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.staff_push_outbox FROM anon, authenticated;
GRANT ALL ON public.staff_push_outbox TO service_role;

-- ─── push_dispatch_config (singleton, service role only) ──────────────────
-- Set by the operator once per environment:
--   SELECT public.set_push_dispatch_config('https://<site>/api/push/dispatch', '<PUSH_DISPATCH_SECRET>');
CREATE TABLE IF NOT EXISTS public.push_dispatch_config (
  id           boolean PRIMARY KEY DEFAULT true CHECK (id),
  dispatch_url text,
  secret       text,
  updated_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT push_dispatch_config_url CHECK (dispatch_url IS NULL OR dispatch_url ~ '^https?://')
);
ALTER TABLE public.push_dispatch_config ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.push_dispatch_config FROM anon, authenticated;
GRANT ALL ON public.push_dispatch_config TO service_role;

CREATE OR REPLACE FUNCTION public.set_push_dispatch_config(p_url text, p_secret text)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF p_url IS NOT NULL AND p_url !~ '^https?://' THEN
    RAISE 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.push_dispatch_config (id, dispatch_url, secret, updated_at)
  VALUES (true, nullif(trim(p_url), ''), nullif(p_secret, ''), now())
  ON CONFLICT (id) DO UPDATE
    SET dispatch_url = EXCLUDED.dispatch_url, secret = EXCLUDED.secret, updated_at = now();
END;
$$;
REVOKE ALL ON FUNCTION public.set_push_dispatch_config(text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.set_push_dispatch_config(text, text) TO service_role;

-- ─── Preference lookup ────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_pref_enabled(p_profile_id uuid, p_event text, p_channel text)
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_event = 'test' THEN true
    ELSE COALESCE(
      (SELECT np.enabled FROM public.notification_prefs np
        WHERE np.profile_id = p_profile_id AND np.event = p_event AND np.channel = p_channel),
      p_channel = 'push')
  END;
$$;
REVOKE ALL ON FUNCTION public.staff_pref_enabled(uuid, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_pref_enabled(uuid, text, text) TO service_role;

-- ─── Kick the dispatcher (pg_net) ─────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.staff_push_kick()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_url text;
  v_secret text;
BEGIN
  IF to_regnamespace('net') IS NULL THEN
    RETURN NULL;
  END IF;
  SELECT dispatch_url, secret INTO v_url, v_secret FROM public.push_dispatch_config WHERE id;
  IF v_url IS NULL OR v_secret IS NULL THEN
    RETURN NULL;
  END IF;
  BEGIN
    -- Queued by pg_net and sent only after this transaction commits.
    EXECUTE 'SELECT net.http_post(url := $1, body := $2, headers := $3, timeout_milliseconds := 8000)'
      USING v_url,
            jsonb_build_object('reason', 'outbox'),
            jsonb_build_object('Content-Type', 'application/json', 'x-push-secret', v_secret);
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'staff_push_kick failed: %', SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_push_kick() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS staff_push_outbox_kick ON public.staff_push_outbox;
CREATE TRIGGER staff_push_outbox_kick
  AFTER INSERT ON public.staff_push_outbox
  FOR EACH STATEMENT EXECUTE FUNCTION public.staff_push_kick();

-- ─── Enqueue one event for an appointment ─────────────────────────────────
-- Recipients: p_recipient when given; else the assigned barber; else every
-- shop admin. The acting user is never notified about their own change, and
-- a recipient who turned both channels off for the event gets nothing.
CREATE OR REPLACE FUNCTION public.staff_push_enqueue(
  p_appt public.appointments,
  p_event text,
  p_recipient uuid DEFAULT NULL,
  p_extra jsonb DEFAULT '{}'::jsonb
) RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_actor uuid := auth.uid();
  v_shop record;
  v_payload jsonb;
  v_count int := 0;
  v_rid uuid;
BEGIN
  IF NOT (p_event = ANY (public.staff_push_events())) THEN
    RETURN 0;
  END IF;

  SELECT s.name, s.name_ar, COALESCE(s.timezone, 'Asia/Amman') AS timezone
    INTO v_shop FROM public.shops s WHERE s.id = p_appt.shop_id;

  v_payload := jsonb_build_object(
    'client_name', left(COALESCE(p_appt.client_name, ''), 80),
    'service_name', left(COALESCE(p_appt.service_name, ''), 120),
    'start_time', p_appt.start_time,
    'end_time', p_appt.end_time,
    'source', p_appt.source,
    'timezone', COALESCE(v_shop.timezone, 'Asia/Amman'),
    'shop_name', v_shop.name,
    'shop_name_ar', v_shop.name_ar
  ) || COALESCE(p_extra, '{}'::jsonb);

  FOR v_rid IN
    SELECT DISTINCT r.id FROM (
      SELECT p_recipient AS id WHERE p_recipient IS NOT NULL
      UNION ALL
      SELECT p_appt.barber_id WHERE p_recipient IS NULL AND p_appt.barber_id IS NOT NULL
      UNION ALL
      SELECT p.id FROM public.profiles p
       WHERE p_recipient IS NULL AND p_appt.barber_id IS NULL
         AND p.shop_id = p_appt.shop_id AND p.role::text = 'shop_admin'
    ) r
    JOIN public.profiles pr ON pr.id = r.id
   WHERE pr.shop_id = p_appt.shop_id
     AND pr.role::text IN ('barber', 'shop_admin')
     AND r.id IS DISTINCT FROM v_actor
  LOOP
    IF public.staff_pref_enabled(v_rid, p_event, 'push') OR public.staff_pref_enabled(v_rid, p_event, 'whatsapp') THEN
      INSERT INTO public.staff_push_outbox (shop_id, profile_id, appointment_id, event, payload)
      VALUES (p_appt.shop_id, v_rid, p_appt.id, p_event, v_payload);
      v_count := v_count + 1;
    END IF;
  END LOOP;
  RETURN v_count;
END;
$$;
REVOKE ALL ON FUNCTION public.staff_push_enqueue(public.appointments, text, uuid, jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.staff_push_enqueue(public.appointments, text, uuid, jsonb) TO service_role;

-- Explicit entry point for other workstreams (e.g. the waitlist filling a slot
-- or the walk-in queue assigning a chair): notify_staff_event(appt, 'waitlist_filled').
CREATE OR REPLACE FUNCTION public.notify_staff_event(p_appointment_id uuid, p_event text)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_appt public.appointments;
BEGIN
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
  IF NOT FOUND THEN
    RETURN 0;
  END IF;
  -- Authenticated callers must be staff of that shop; service_role skips this.
  IF auth.uid() IS NOT NULL AND NOT public.is_staff_of_shop(v_appt.shop_id) THEN
    RAISE 'NOT_AUTHORIZED' USING ERRCODE = 'P0001';
  END IF;
  RETURN public.staff_push_enqueue(v_appt, p_event, NULL, jsonb_build_object('explicit', true));
END;
$$;
REVOKE ALL ON FUNCTION public.notify_staff_event(uuid, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.notify_staff_event(uuid, text) TO authenticated, service_role;

-- ─── notify_staff(): AFTER trigger on appointments ────────────────────────
CREATE OR REPLACE FUNCTION public.notify_staff()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_src text;
  v_active boolean;
  v_was_active boolean;
  v_new_event text;
BEGIN
  BEGIN
    v_src := lower(COALESCE(NEW.source, ''));
    v_active := COALESCE(NEW.status, 'pending') NOT IN ('cancelled', 'completed', 'no_show');
    v_new_event := CASE
      WHEN v_src IN ('walk_in', 'walk-in', 'walkin') THEN 'walk_in_assigned'
      WHEN v_src = 'waitlist' THEN 'waitlist_filled'
      ELSE 'booking_new'
    END;

    IF TG_OP = 'INSERT' THEN
      -- Ignore back-dated entries (history imports, logging a finished cut).
      IF v_active AND NEW.end_time > now() THEN
        IF v_new_event = 'walk_in_assigned' AND NEW.barber_id IS NULL THEN
          RETURN NULL; -- a walk-in waiting for any chair is not "assigned" yet
        END IF;
        PERFORM public.staff_push_enqueue(NEW, v_new_event);
      END IF;
      RETURN NULL;
    END IF;

    -- UPDATE
    v_was_active := COALESCE(OLD.status, 'pending') NOT IN ('cancelled', 'completed', 'no_show');

    IF NEW.status = 'cancelled' AND OLD.status IS DISTINCT FROM 'cancelled' THEN
      IF NEW.end_time > now() THEN
        -- NULL recipient (never assigned) falls back to the shop admins.
        PERFORM public.staff_push_enqueue(NEW, 'booking_cancelled', COALESCE(OLD.barber_id, NEW.barber_id));
      END IF;
      RETURN NULL;
    END IF;

    IF NOT (v_active AND v_was_active) OR NEW.end_time <= now() THEN
      RETURN NULL;
    END IF;

    IF NEW.barber_id IS DISTINCT FROM OLD.barber_id THEN
      -- Moved to another chair: the new barber gets it as new, the old one as cancelled.
      IF NEW.barber_id IS NOT NULL THEN
        PERFORM public.staff_push_enqueue(NEW, v_new_event, NEW.barber_id,
          jsonb_build_object('reassigned', true, 'old_start_time', OLD.start_time));
      END IF;
      IF OLD.barber_id IS NOT NULL THEN
        PERFORM public.staff_push_enqueue(NEW, 'booking_cancelled', OLD.barber_id,
          jsonb_build_object('reassigned', true));
      END IF;
    ELSIF NEW.start_time IS DISTINCT FROM OLD.start_time THEN
      PERFORM public.staff_push_enqueue(NEW, 'booking_rescheduled', NULL,
        jsonb_build_object('old_start_time', OLD.start_time));
    END IF;
  EXCEPTION WHEN OTHERS THEN
    RAISE WARNING 'notify_staff failed for appointment %: %', NEW.id, SQLERRM;
  END;
  RETURN NULL;
END;
$$;
REVOKE ALL ON FUNCTION public.notify_staff() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS trigger_notify_staff ON public.appointments;
CREATE TRIGGER trigger_notify_staff
  AFTER INSERT OR UPDATE OF status, start_time, end_time, barber_id ON public.appointments
  FOR EACH ROW EXECUTE FUNCTION public.notify_staff();

-- ─── Client RPCs ──────────────────────────────────────────────────────────
-- Register (or move to this user) a browser push endpoint.
CREATE OR REPLACE FUNCTION public.push_subscribe(
  p_endpoint text,
  p_p256dh text,
  p_auth text,
  p_user_agent text DEFAULT NULL,
  p_locale text DEFAULT 'ar',
  p_old_endpoint text DEFAULT NULL
) RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shop uuid;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  SELECT p.shop_id INTO v_shop FROM public.profiles p
   WHERE p.id = v_uid AND p.role::text IN ('barber', 'shop_admin') AND p.shop_id IS NOT NULL;
  IF v_shop IS NULL THEN
    RAISE 'NOT_AUTHORIZED' USING ERRCODE = 'P0001';
  END IF;
  IF p_endpoint IS NULL OR p_endpoint !~ '^https://' OR length(p_endpoint) > 1024
     OR p_p256dh IS NULL OR p_p256dh !~ '^[A-Za-z0-9_-]{20,200}={0,2}$'
     OR p_auth IS NULL OR p_auth !~ '^[A-Za-z0-9_-]{8,100}={0,2}$' THEN
    RAISE 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;

  IF NOT public.check_request_rate_limit('push_subscribe', 30, 3600, v_uid::text) THEN
    RAISE 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  IF p_old_endpoint IS NOT NULL AND p_old_endpoint <> p_endpoint THEN
    DELETE FROM public.push_subscriptions WHERE endpoint = p_old_endpoint AND profile_id = v_uid;
  END IF;

  -- Cap devices per person (oldest go first).
  DELETE FROM public.push_subscriptions
   WHERE id IN (
     SELECT id FROM public.push_subscriptions
      WHERE profile_id = v_uid AND endpoint <> p_endpoint
      ORDER BY COALESCE(last_success_at, created_at) DESC
      OFFSET 9
   );

  INSERT INTO public.push_subscriptions (profile_id, shop_id, endpoint, keys, user_agent, locale)
  VALUES (v_uid, v_shop, p_endpoint,
          jsonb_build_object('p256dh', p_p256dh, 'auth', p_auth),
          left(p_user_agent, 512),
          CASE WHEN p_locale = 'en' THEN 'en' ELSE 'ar' END)
  ON CONFLICT (endpoint) DO UPDATE
    SET profile_id = EXCLUDED.profile_id,
        shop_id = EXCLUDED.shop_id,
        keys = EXCLUDED.keys,
        user_agent = EXCLUDED.user_agent,
        locale = EXCLUDED.locale,
        failure_count = 0,
        updated_at = now()
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.push_subscribe(text, text, text, text, text, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_subscribe(text, text, text, text, text, text) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.push_unsubscribe(p_endpoint text)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_n int;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  DELETE FROM public.push_subscriptions WHERE endpoint = p_endpoint AND profile_id = auth.uid();
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.push_unsubscribe(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_unsubscribe(text) TO authenticated, service_role;

-- Queue a test notification to the caller's own devices.
CREATE OR REPLACE FUNCTION public.push_send_test(p_locale text DEFAULT 'ar')
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid uuid := auth.uid();
  v_shop uuid;
  v_id uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  SELECT p.shop_id INTO v_shop FROM public.profiles p
   WHERE p.id = v_uid AND p.role::text IN ('barber', 'shop_admin') AND p.shop_id IS NOT NULL;
  IF v_shop IS NULL THEN
    RAISE 'NOT_AUTHORIZED' USING ERRCODE = 'P0001';
  END IF;
  IF NOT public.check_request_rate_limit('push_test', 6, 600, v_uid::text) THEN
    RAISE 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;
  INSERT INTO public.staff_push_outbox (shop_id, profile_id, event, payload)
  VALUES (v_shop, v_uid, 'test', jsonb_build_object('locale', CASE WHEN p_locale = 'en' THEN 'en' ELSE 'ar' END))
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.push_send_test(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.push_send_test(text) TO authenticated, service_role;

-- ─── Dispatcher RPCs (service role only) ──────────────────────────────────
-- Claims up to p_limit jobs (pending, or stuck in processing > 2 min) and
-- returns everything the sender needs. Jobs older than a day expire.
CREATE OR REPLACE FUNCTION public.push_claim_jobs(p_limit int DEFAULT 50)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_out jsonb;
BEGIN
  UPDATE public.staff_push_outbox
     SET status = 'expired', finished_at = now()
   WHERE status IN ('pending', 'processing') AND created_at < now() - interval '1 day';

  WITH picked AS (
    SELECT o.id FROM public.staff_push_outbox o
     WHERE (o.status = 'pending' OR (o.status = 'processing' AND o.claimed_at < now() - interval '2 minutes'))
       AND o.attempts < 5
     ORDER BY o.created_at
     LIMIT GREATEST(1, LEAST(COALESCE(p_limit, 50), 200))
     FOR UPDATE SKIP LOCKED
  ), claimed AS (
    UPDATE public.staff_push_outbox o
       SET status = 'processing', claimed_at = now(), attempts = o.attempts + 1
      FROM picked WHERE o.id = picked.id
    RETURNING o.*
  )
  SELECT COALESCE(jsonb_agg(jsonb_build_object(
    'id', c.id,
    'event', c.event,
    'shop_id', c.shop_id,
    'profile_id', c.profile_id,
    'appointment_id', c.appointment_id,
    'payload', c.payload,
    'attempts', c.attempts,
    'created_at', c.created_at,
    'push_enabled', public.staff_pref_enabled(c.profile_id, c.event, 'push'),
    'whatsapp_enabled', public.staff_pref_enabled(c.profile_id, c.event, 'whatsapp') AND c.event <> 'test',
    'phone', CASE WHEN c.event <> 'test' AND public.staff_pref_enabled(c.profile_id, c.event, 'whatsapp')
                  THEN p.phone END,
    'recipient_name', p.full_name,
    'subscriptions', COALESCE((
      SELECT jsonb_agg(jsonb_build_object('endpoint', s.endpoint, 'keys', s.keys, 'locale', s.locale)
                       ORDER BY s.created_at)
        FROM public.push_subscriptions s WHERE s.profile_id = c.profile_id), '[]'::jsonb)
  ) ORDER BY c.created_at), '[]'::jsonb)
  INTO v_out
  FROM claimed c
  JOIN public.profiles p ON p.id = c.profile_id;

  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.push_claim_jobs(int) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_claim_jobs(int) TO service_role;

-- p_results: [{id, status: sent|failed|skipped|retry, error?, result?,
--              delivered: [endpoint], gone: [endpoint], failed: [endpoint]}]
CREATE OR REPLACE FUNCTION public.push_complete_jobs(p_results jsonb)
RETURNS int
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  r jsonb;
  v_n int := 0;
  v_status text;
BEGIN
  IF p_results IS NULL OR jsonb_typeof(p_results) <> 'array' THEN
    RAISE 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  FOR r IN SELECT * FROM jsonb_array_elements(p_results) LOOP
    v_status := r ->> 'status';
    IF v_status NOT IN ('sent', 'failed', 'skipped', 'retry') THEN
      CONTINUE;
    END IF;

    UPDATE public.staff_push_outbox o
       SET status = CASE
                      WHEN v_status = 'retry' AND o.attempts < 5 THEN 'pending'
                      WHEN v_status = 'retry' THEN 'failed'
                      ELSE v_status
                    END,
           finished_at = CASE WHEN v_status = 'retry' AND o.attempts < 5 THEN NULL ELSE now() END,
           error = left(r ->> 'error', 500),
           result = r -> 'result'
     WHERE o.id = (r ->> 'id')::uuid AND o.status = 'processing';
    IF FOUND THEN
      v_n := v_n + 1;
    END IF;

    DELETE FROM public.push_subscriptions
     WHERE endpoint IN (SELECT jsonb_array_elements_text(COALESCE(r -> 'gone', '[]'::jsonb)));
    UPDATE public.push_subscriptions
       SET last_success_at = now(), failure_count = 0
     WHERE endpoint IN (SELECT jsonb_array_elements_text(COALESCE(r -> 'delivered', '[]'::jsonb)));
    UPDATE public.push_subscriptions
       SET last_failure_at = now(), failure_count = failure_count + 1
     WHERE endpoint IN (SELECT jsonb_array_elements_text(COALESCE(r -> 'failed', '[]'::jsonb)));
  END LOOP;

  -- Endpoints that keep failing are dead.
  DELETE FROM public.push_subscriptions WHERE failure_count >= 15;
  -- Keep the outbox small.
  DELETE FROM public.staff_push_outbox
   WHERE status IN ('sent', 'failed', 'skipped', 'expired') AND created_at < now() - interval '30 days';
  RETURN v_n;
END;
$$;
REVOKE ALL ON FUNCTION public.push_complete_jobs(jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.push_complete_jobs(jsonb) TO service_role;

COMMENT ON TABLE public.staff_push_outbox IS 'WS-1K: staff notification jobs written by notify_staff(); service role only.';
COMMENT ON TABLE public.push_subscriptions IS 'WS-1K: Web Push endpoints per staff device. keys are never readable by clients.';
COMMENT ON TABLE public.notification_prefs IS 'WS-1K: per staff member event × channel toggles. Missing row = push on, WhatsApp off.';
