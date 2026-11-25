-- ═══════════════════════════════════════════════════════════════════════════
-- WS-1C · Messaging engine (part 1 of 2): outbox, consent, settings, enqueue.
--
-- Everything here is safe on top of production data and idempotent:
--   • new columns are nullable or have defaults that every row satisfies;
--   • new tables are CREATE TABLE IF NOT EXISTS with RLS enabled and
--     least-privilege policies (anon gets nothing);
--   • functions are CREATE OR REPLACE, SECURITY DEFINER with a pinned
--     search_path and explicit grants.
--
-- This file runs BEFORE 1D (002300) on a fresh database, so nothing here
-- references appointment_services. The appointment triggers, the dispatcher
-- claim/complete RPCs and the magic-link (/m/[token]) RPCs live in
-- 20250101003100_messaging_triggers.sql.
--
-- 1C never modifies create_public_booking.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 0. Helpers ────────────────────────────────────────────────────────────

-- Phone → international digits without "+" (Jordan-aware; mirrors
-- normalizePhoneForWa in src/lib/messaging). NULL when unusable.
CREATE OR REPLACE FUNCTION public.messaging_normalize_phone(p text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  d text := regexp_replace(translate(COALESCE(p, ''), '٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹', '01234567890123456789'), '[^0-9]', '', 'g');
BEGIN
  IF d = '' THEN RETURN NULL; END IF;
  IF d LIKE '00%' THEN d := substr(d, 3); END IF;
  IF d LIKE '0%' AND length(d) = 10 THEN
    d := '962' || substr(d, 2);
  ELSIF d LIKE '7%' AND length(d) = 9 THEN
    d := '962' || d;
  END IF;
  IF length(d) < 8 OR length(d) > 15 THEN RETURN NULL; END IF;
  RETURN d;
END;
$$;
REVOKE ALL ON FUNCTION public.messaging_normalize_phone(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.messaging_normalize_phone(text) TO anon, authenticated, service_role;

-- The template registry (kept in sync with TEMPLATE_IDS in the engine).
CREATE OR REPLACE FUNCTION public.messaging_template_known(p text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p IN ('confirmation', 'reminder', 'rescheduled', 'cancelled', 'thank_you',
               'waitlist_offer', 'opt_out_confirmation', 'schedule_change',
               'appointment_cancelled', 'receipt', 'generic');
$$;

-- Optional (non-transactional) templates: an opt-out (STOP / إلغاء) stops them.
CREATE OR REPLACE FUNCTION public.messaging_template_optional(p text)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p IN ('reminder', 'thank_you', 'waitlist_offer', 'generic');
$$;

CREATE OR REPLACE FUNCTION public.messaging_template_category(p text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT 'utility'::text;
$$;

-- Reminder offsets: 0..4 values, each 15 min .. 7 days, no duplicates.
CREATE OR REPLACE FUNCTION public.messaging_offsets_valid(p int[])
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p IS NOT NULL
     AND COALESCE(cardinality(p), 0) <= 4
     AND NOT EXISTS (SELECT 1 FROM unnest(p) v WHERE v IS NULL OR v < 15 OR v > 10080)
     AND (SELECT count(DISTINCT v) FROM unnest(p) v) = COALESCE(cardinality(p), 0);
$$;

REVOKE ALL ON FUNCTION public.messaging_template_known(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.messaging_template_optional(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.messaging_template_category(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.messaging_offsets_valid(int[]) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.messaging_template_known(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.messaging_template_optional(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.messaging_template_category(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.messaging_offsets_valid(int[]) TO anon, authenticated, service_role;

-- Random URL-safe token (32 chars, 192 bits).
CREATE OR REPLACE FUNCTION public.new_manage_token()
RETURNS text
LANGUAGE sql VOLATILE
SET search_path = public, extensions, pg_temp
AS $$
  SELECT translate(encode(extensions.gen_random_bytes(24), 'base64'), '+/', '-_');
$$;
REVOKE ALL ON FUNCTION public.new_manage_token() FROM PUBLIC;
-- Column defaults run with the inserting role's privileges (a random value;
-- harmless to expose).
GRANT EXECUTE ON FUNCTION public.new_manage_token() TO anon, authenticated, service_role;

-- True for requests made with the service-role key (PostgREST JWT role).
CREATE OR REPLACE FUNCTION public.messaging_is_service()
RETURNS boolean
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE(
    NULLIF(current_setting('request.jwt.claims', true), '')::jsonb ->> 'role',
    NULLIF(current_setting('request.jwt.claim.role', true), ''),
    ''
  ) = 'service_role';
$$;
REVOKE ALL ON FUNCTION public.messaging_is_service() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.messaging_is_service() TO authenticated, service_role;

-- ─── 1. Columns on existing tables ─────────────────────────────────────────

-- clients.preferred_language (NULL = unknown → Arabic).
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS preferred_language text;
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'clients_preferred_language_check') THEN
    ALTER TABLE public.clients
      ADD CONSTRAINT clients_preferred_language_check
      CHECK (preferred_language IS NULL OR preferred_language IN ('ar', 'en'));
  END IF;
END $$;

-- appointments.manage_token: random, unique, set on insert by default.
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS manage_token text;
ALTER TABLE public.appointments ALTER COLUMN manage_token SET DEFAULT public.new_manage_token();
CREATE UNIQUE INDEX IF NOT EXISTS appointments_manage_token_key
  ON public.appointments (manage_token) WHERE manage_token IS NOT NULL;
-- Back-fill only bookings that can still be managed (keeps the write small).
UPDATE public.appointments
SET manage_token = public.new_manage_token()
WHERE manage_token IS NULL
  AND end_time > now() - interval '1 day'
  AND COALESCE(status, 'pending') IN ('pending', 'confirmed', 'awaiting_deposit');

-- shops: messaging settings (private to the shop: SELECT for authenticated
-- only, RLS on shops limits UPDATE to the shop admin).
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS reminder_offsets int[] NOT NULL DEFAULT '{1440,120}';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS quiet_hours jsonb NOT NULL
  DEFAULT '{"enabled": true, "start": "23:00", "end": "08:00", "jumuah": true, "jumuah_start": "11:30", "jumuah_end": "13:30"}'::jsonb;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS messaging_enabled boolean NOT NULL DEFAULT true;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS messaging_channel text NOT NULL DEFAULT 'whatsapp';
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS sms_fallback boolean NOT NULL DEFAULT false;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS message_templates jsonb NOT NULL DEFAULT '{}'::jsonb;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS review_request_delay_minutes int NOT NULL DEFAULT 120;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_reminder_offsets_check') THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_reminder_offsets_check
      CHECK (public.messaging_offsets_valid(reminder_offsets));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_quiet_hours_check') THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_quiet_hours_check
      CHECK (jsonb_typeof(quiet_hours) = 'object' AND pg_column_size(quiet_hours) < 2048);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_messaging_channel_check') THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_messaging_channel_check
      CHECK (messaging_channel IN ('whatsapp', 'sms'));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_message_templates_check') THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_message_templates_check
      CHECK (jsonb_typeof(message_templates) = 'object' AND pg_column_size(message_templates) < 2048);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_review_request_delay_check') THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_review_request_delay_check
      CHECK (review_request_delay_minutes BETWEEN 0 AND 2880);
  END IF;
END $$;

-- shops uses column-level SELECT grants: expose the new columns to
-- authenticated only (anon cannot read a shop's messaging setup).
GRANT SELECT (reminder_offsets, quiet_hours, messaging_enabled, messaging_channel,
              sms_fallback, message_templates, review_request_delay_minutes)
  ON public.shops TO authenticated;

-- ─── 2. message_outbox ─────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_outbox (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id              uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  appointment_id       uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  -- No FK: sales (1F) is created by a later migration.
  sale_id              uuid,
  client_id            uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  recipient_profile_id uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  to_phone             text CHECK (to_phone IS NULL OR to_phone ~ '^[0-9]{8,15}$'),
  channel              text NOT NULL DEFAULT 'whatsapp'
                       CHECK (channel IN ('whatsapp', 'sms', 'wa_link')),
  template             text NOT NULL CHECK (public.messaging_template_known(template)),
  template_version     int  NOT NULL DEFAULT 1 CHECK (template_version BETWEEN 1 AND 99),
  category             text NOT NULL DEFAULT 'utility'
                       CHECK (category IN ('utility', 'authentication', 'marketing')),
  locale               text NOT NULL DEFAULT 'ar' CHECK (locale IN ('ar', 'en')),
  payload              jsonb NOT NULL DEFAULT '{}'::jsonb
                       CHECK (jsonb_typeof(payload) = 'object' AND pg_column_size(payload) < 16384),
  body                 text CHECK (body IS NULL OR length(body) <= 4096),
  offset_minutes       int  NOT NULL DEFAULT 0 CHECK (offset_minutes BETWEEN 0 AND 10080),
  dedupe_key           text CHECK (dedupe_key IS NULL OR length(dedupe_key) <= 200),
  scheduled_for        timestamptz NOT NULL DEFAULT now(),
  status               text NOT NULL DEFAULT 'queued'
                       CHECK (status IN ('queued', 'sending', 'sent', 'delivered', 'read',
                                         'failed', 'fallback', 'skipped', 'cancelled')),
  attempts             int  NOT NULL DEFAULT 0 CHECK (attempts >= 0),
  locked_at            timestamptz,
  provider             text CHECK (provider IS NULL OR length(provider) <= 40),
  provider_msg_id      text CHECK (provider_msg_id IS NULL OR length(provider_msg_id) <= 200),
  cost_fils            int  NOT NULL DEFAULT 0 CHECK (cost_fils >= 0),
  error                text CHECK (error IS NULL OR length(error) <= 500),
  sent_at              timestamptz,
  delivered_at         timestamptz,
  read_at              timestamptz,
  created_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at           timestamptz NOT NULL DEFAULT now(),
  updated_at           timestamptz NOT NULL DEFAULT now()
);

-- Idempotency: one row per appointment + template + offset (+ start time for
-- reminders/reschedules, so a moved booking gets fresh reminders).
CREATE UNIQUE INDEX IF NOT EXISTS message_outbox_dedupe_key
  ON public.message_outbox (dedupe_key) WHERE dedupe_key IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS message_outbox_provider_msg_key
  ON public.message_outbox (provider_msg_id) WHERE provider_msg_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS message_outbox_due_idx
  ON public.message_outbox (scheduled_for) WHERE status = 'queued';
CREATE INDEX IF NOT EXISTS message_outbox_sending_idx
  ON public.message_outbox (locked_at) WHERE status = 'sending';
CREATE INDEX IF NOT EXISTS message_outbox_shop_created_idx
  ON public.message_outbox (shop_id, created_at DESC);
CREATE INDEX IF NOT EXISTS message_outbox_appointment_idx
  ON public.message_outbox (appointment_id) WHERE appointment_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS message_outbox_phone_idx
  ON public.message_outbox (to_phone, status) WHERE to_phone IS NOT NULL;

ALTER TABLE public.message_outbox ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.message_outbox FROM anon, authenticated;
GRANT SELECT ON public.message_outbox TO authenticated;
GRANT ALL ON public.message_outbox TO service_role;

DROP POLICY IF EXISTS message_outbox_select_staff ON public.message_outbox;
CREATE POLICY message_outbox_select_staff ON public.message_outbox
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));

DROP TRIGGER IF EXISTS message_outbox_set_updated_at ON public.message_outbox;
CREATE TRIGGER message_outbox_set_updated_at
  BEFORE UPDATE ON public.message_outbox
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ─── 3. Inbound log (WhatsApp 24h session + opt-out audit) ────────────────
CREATE TABLE IF NOT EXISTS public.message_inbound (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id         uuid REFERENCES public.shops(id) ON DELETE SET NULL,
  from_phone      text NOT NULL CHECK (from_phone ~ '^[0-9]{8,15}$'),
  channel         text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms')),
  provider_msg_id text CHECK (provider_msg_id IS NULL OR length(provider_msg_id) <= 200),
  kind            text NOT NULL DEFAULT 'text' CHECK (kind IN ('text', 'button', 'other')),
  body            text CHECK (body IS NULL OR length(body) <= 2000),
  payload         text CHECK (payload IS NULL OR length(payload) <= 300),
  context_msg_id  text CHECK (context_msg_id IS NULL OR length(context_msg_id) <= 200),
  action          text CHECK (action IS NULL OR length(action) <= 40),
  received_at     timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS message_inbound_provider_msg_key
  ON public.message_inbound (provider_msg_id) WHERE provider_msg_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS message_inbound_phone_idx
  ON public.message_inbound (from_phone, received_at DESC);

ALTER TABLE public.message_inbound ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.message_inbound FROM anon, authenticated;
GRANT ALL ON public.message_inbound TO service_role;
-- No policies: service role only (contains raw phone numbers and texts).

-- ─── 4. marketing_consents ─────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.marketing_consents (
  client_id  uuid NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  shop_id    uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  channel    text NOT NULL DEFAULT 'whatsapp' CHECK (channel IN ('whatsapp', 'sms')),
  opted_in   boolean NOT NULL,
  source     text NOT NULL DEFAULT 'staff'
             CHECK (source IN ('staff', 'booking', 'keyword', 'manage_page', 'import', 'system')),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (client_id, channel)
);
CREATE INDEX IF NOT EXISTS marketing_consents_shop_idx ON public.marketing_consents (shop_id);

-- shop_id always follows the client (no cross-shop rows).
CREATE OR REPLACE FUNCTION public.marketing_consents_set_shop()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_shop uuid;
BEGIN
  SELECT c.shop_id INTO v_shop FROM public.clients c WHERE c.id = NEW.client_id;
  IF v_shop IS NULL THEN
    RAISE EXCEPTION 'CLIENT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  NEW.shop_id := v_shop;
  NEW.updated_at := now();
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.marketing_consents_set_shop() FROM PUBLIC, anon, authenticated;

DROP TRIGGER IF EXISTS marketing_consents_set_shop ON public.marketing_consents;
CREATE TRIGGER marketing_consents_set_shop
  BEFORE INSERT OR UPDATE ON public.marketing_consents
  FOR EACH ROW EXECUTE FUNCTION public.marketing_consents_set_shop();

ALTER TABLE public.marketing_consents ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.marketing_consents FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE ON public.marketing_consents TO authenticated;
GRANT ALL ON public.marketing_consents TO service_role;

DROP POLICY IF EXISTS marketing_consents_select_staff ON public.marketing_consents;
CREATE POLICY marketing_consents_select_staff ON public.marketing_consents
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
DROP POLICY IF EXISTS marketing_consents_select_self ON public.marketing_consents;
CREATE POLICY marketing_consents_select_self ON public.marketing_consents
  FOR SELECT TO authenticated
  USING (client_id IN (SELECT public.my_client_ids()));
DROP POLICY IF EXISTS marketing_consents_insert_staff ON public.marketing_consents;
CREATE POLICY marketing_consents_insert_staff ON public.marketing_consents
  FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff())
              AND client_id IN (SELECT c.id FROM public.clients c WHERE c.shop_id = (SELECT public.get_current_shop_id())));
DROP POLICY IF EXISTS marketing_consents_update_staff ON public.marketing_consents;
CREATE POLICY marketing_consents_update_staff ON public.marketing_consents
  FOR UPDATE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));

-- ─── 5. Plan allowance + dispatcher heartbeat ─────────────────────────────
CREATE TABLE IF NOT EXISTS public.message_allowances (
  shop_id           uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  monthly_allowance int NOT NULL DEFAULT 300 CHECK (monthly_allowance BETWEEN 0 AND 1000000),
  updated_at        timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.message_allowances ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.message_allowances FROM anon, authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.message_allowances TO authenticated;
GRANT ALL ON public.message_allowances TO service_role;

DROP POLICY IF EXISTS message_allowances_select_staff ON public.message_allowances;
CREATE POLICY message_allowances_select_staff ON public.message_allowances
  FOR SELECT TO authenticated
  USING ((shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()))
         OR (SELECT public.is_platform_admin()));
DROP POLICY IF EXISTS message_allowances_write_platform ON public.message_allowances;
CREATE POLICY message_allowances_write_platform ON public.message_allowances
  FOR ALL TO authenticated
  USING ((SELECT public.is_platform_admin()))
  WITH CHECK ((SELECT public.is_platform_admin()));

CREATE TABLE IF NOT EXISTS public.messaging_runtime (
  id          smallint PRIMARY KEY DEFAULT 1 CHECK (id = 1),
  providers   text[] NOT NULL DEFAULT '{}',
  last_run_at timestamptz,
  last_result jsonb NOT NULL DEFAULT '{}'::jsonb
);
ALTER TABLE public.messaging_runtime ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.messaging_runtime FROM anon, authenticated;
GRANT ALL ON public.messaging_runtime TO service_role;

-- ─── 6. Monthly cost view ──────────────────────────────────────────────────
CREATE OR REPLACE VIEW public.message_cost_monthly
WITH (security_invoker = true) AS
SELECT
  o.shop_id,
  (date_trunc('month', COALESCE(o.sent_at, o.created_at) AT TIME ZONE 'Asia/Amman'))::date AS month,
  count(*) FILTER (WHERE o.status IN ('sent', 'delivered', 'read'))::int        AS sent_count,
  count(*) FILTER (WHERE o.status IN ('delivered', 'read'))::int                AS delivered_count,
  count(*) FILTER (WHERE o.status = 'read')::int                                AS read_count,
  count(*) FILTER (WHERE o.status = 'failed')::int                              AS failed_count,
  count(*) FILTER (WHERE o.status = 'fallback')::int                            AS fallback_count,
  count(*) FILTER (WHERE o.status IN ('queued', 'sending'))::int                AS pending_count,
  count(*) FILTER (WHERE o.status IN ('sent', 'delivered', 'read') AND o.category = 'utility')::int   AS utility_count,
  count(*) FILTER (WHERE o.status IN ('sent', 'delivered', 'read') AND o.category = 'marketing')::int AS marketing_count,
  count(*) FILTER (WHERE o.status IN ('sent', 'delivered', 'read') AND o.channel = 'sms')::int        AS sms_count,
  COALESCE(sum(o.cost_fils), 0)::bigint                                         AS cost_fils,
  COALESCE(max(a.monthly_allowance), 300)::int                                  AS allowance
FROM public.message_outbox o
LEFT JOIN public.message_allowances a ON a.shop_id = o.shop_id
GROUP BY o.shop_id, 2;

REVOKE ALL ON public.message_cost_monthly FROM anon, authenticated;
GRANT SELECT ON public.message_cost_monthly TO authenticated, service_role;

-- ─── 7. Internal enqueue (triggers, dispatcher, RPCs) ─────────────────────
CREATE OR REPLACE FUNCTION public.message_enqueue_internal(
  p_shop_id        uuid,
  p_template       text,
  p_to             text,
  p_locale         text DEFAULT 'ar',
  p_appointment_id uuid DEFAULT NULL,
  p_client_id      uuid DEFAULT NULL,
  p_body           text DEFAULT NULL,
  p_payload        jsonb DEFAULT '{}'::jsonb,
  p_scheduled_for  timestamptz DEFAULT NULL,
  p_offset         int DEFAULT 0,
  p_dedupe_key     text DEFAULT NULL,
  p_channel        text DEFAULT NULL,
  p_status         text DEFAULT 'queued',
  p_sale_id        uuid DEFAULT NULL,
  p_created_by     uuid DEFAULT NULL
)
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_id      uuid;
  v_channel text;
BEGIN
  IF p_shop_id IS NULL OR NOT public.messaging_template_known(p_template) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  IF p_channel IS NULL THEN
    SELECT s.messaging_channel INTO v_channel FROM public.shops s WHERE s.id = p_shop_id;
  END IF;
  v_channel := COALESCE(p_channel, v_channel, 'whatsapp');

  INSERT INTO public.message_outbox
    (shop_id, appointment_id, client_id, sale_id, to_phone, channel, template, category,
     locale, payload, body, offset_minutes, dedupe_key, scheduled_for, status, created_by)
  VALUES
    (p_shop_id, p_appointment_id, p_client_id, p_sale_id, public.messaging_normalize_phone(p_to),
     v_channel, p_template, public.messaging_template_category(p_template),
     CASE WHEN p_locale = 'en' THEN 'en' ELSE 'ar' END,
     COALESCE(p_payload, '{}'::jsonb), NULLIF(btrim(COALESCE(p_body, '')), ''),
     GREATEST(COALESCE(p_offset, 0), 0), p_dedupe_key, COALESCE(p_scheduled_for, now()),
     COALESCE(p_status, 'queued'), p_created_by)
  ON CONFLICT (dedupe_key) WHERE dedupe_key IS NOT NULL DO NOTHING
  RETURNING id INTO v_id;
  RETURN v_id;
END;
$$;
REVOKE ALL ON FUNCTION public.message_enqueue_internal(uuid, text, text, text, uuid, uuid, text, jsonb, timestamptz, int, text, text, text, uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.message_enqueue_internal(uuid, text, text, text, uuid, uuid, text, jsonb, timestamptz, int, text, text, text, uuid, uuid) TO service_role;

-- Is the dispatcher running with at least one real provider?
CREATE OR REPLACE FUNCTION public.messaging_live()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT COALESCE((SELECT cardinality(r.providers) > 0 AND r.last_run_at > now() - interval '10 minutes'
                   FROM public.messaging_runtime r WHERE r.id = 1), false);
$$;
REVOKE ALL ON FUNCTION public.messaging_live() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.messaging_live() TO authenticated, service_role;

-- ─── 8. Public RPC: enqueue_message ────────────────────────────────────────
-- Staff of the shop (or the service role) queue a message. Without a live
-- provider the row is stored as 'fallback' and the caller opens a wa.me link.
-- Returns {id, status: queued|fallback|skipped, reason?, to, live}.
CREATE OR REPLACE FUNCTION public.enqueue_message(
  p_shop_id        uuid,
  p_template       text,
  p_to             text,
  p_body           text DEFAULT NULL,
  p_locale         text DEFAULT 'ar',
  p_appointment_id uuid DEFAULT NULL,
  p_sale_id        uuid DEFAULT NULL,
  p_channel        text DEFAULT NULL,
  p_vars           jsonb DEFAULT '{}'::jsonb,
  p_scheduled_for  timestamptz DEFAULT NULL,
  p_dedupe_key     text DEFAULT NULL
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid     uuid := auth.uid();
  v_service boolean := public.messaging_is_service();
  v_to      text := public.messaging_normalize_phone(p_to);
  v_client  uuid;
  v_live    boolean;
  v_status  text;
  v_id      uuid;
BEGIN
  IF p_shop_id IS NULL OR p_template IS NULL OR NOT public.messaging_template_known(p_template)
     OR (p_channel IS NOT NULL AND p_channel NOT IN ('whatsapp', 'sms', 'wa_link'))
     OR (p_body IS NOT NULL AND length(p_body) > 4096)
     OR (p_vars IS NOT NULL AND (jsonb_typeof(p_vars) <> 'object' OR pg_column_size(p_vars) > 8192))
     OR (p_dedupe_key IS NOT NULL AND length(p_dedupe_key) > 200) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  IF NOT v_service THEN
    IF v_uid IS NULL OR NOT public.is_staff_of_shop(p_shop_id) THEN
      RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'P0001';
    END IF;
    IF NOT public.check_rate_limit('rpc:enqueue_message:user:' || v_uid::text, 300, 3600) THEN
      RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
    END IF;
  END IF;
  IF p_appointment_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.appointments a WHERE a.id = p_appointment_id AND a.shop_id = p_shop_id) THEN
    RAISE EXCEPTION 'APPT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF v_to IS NULL THEN
    RETURN jsonb_build_object('id', NULL, 'status', 'skipped', 'reason', 'NO_PHONE');
  END IF;
  IF NULLIF(btrim(COALESCE(p_body, '')), '') IS NULL AND p_appointment_id IS NULL THEN
    RETURN jsonb_build_object('id', NULL, 'status', 'skipped', 'reason', 'EMPTY_BODY');
  END IF;

  -- Recipient client (same shop, same number), for consent and language.
  SELECT c.id INTO v_client
  FROM public.clients c
  WHERE c.shop_id = p_shop_id AND c.deleted_at IS NULL
    AND public.messaging_normalize_phone(c.phone) = v_to
  ORDER BY c.updated_at DESC NULLS LAST
  LIMIT 1;

  IF public.messaging_template_optional(p_template) AND v_client IS NOT NULL AND EXISTS (
       SELECT 1 FROM public.marketing_consents mc
       WHERE mc.client_id = v_client AND mc.opted_in = false) THEN
    RETURN jsonb_build_object('id', NULL, 'status', 'skipped', 'reason', 'OPTED_OUT');
  END IF;

  v_live := public.messaging_live();
  v_status := CASE WHEN v_live AND COALESCE(p_channel, '') <> 'wa_link' THEN 'queued' ELSE 'fallback' END;

  v_id := public.message_enqueue_internal(
    p_shop_id, p_template, v_to, p_locale, p_appointment_id, v_client, p_body,
    jsonb_build_object('vars', COALESCE(p_vars, '{}'::jsonb), 'manual', true),
    p_scheduled_for, 0, p_dedupe_key,
    CASE WHEN v_status = 'fallback' THEN 'wa_link' ELSE p_channel END,
    v_status, p_sale_id, v_uid);

  IF v_id IS NULL THEN
    -- Same dedupe key already queued: report the existing row.
    SELECT o.id, o.status INTO v_id, v_status FROM public.message_outbox o WHERE o.dedupe_key = p_dedupe_key;
  END IF;

  RETURN jsonb_build_object('id', v_id, 'status', v_status, 'to', v_to, 'live', v_live);
END;
$$;
REVOKE ALL ON FUNCTION public.enqueue_message(uuid, text, text, text, text, uuid, uuid, text, jsonb, timestamptz, text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.enqueue_message(uuid, text, text, text, text, uuid, uuid, text, jsonb, timestamptz, text) TO authenticated, service_role;

-- Staff confirm they sent a fallback message by hand (wa.me).
CREATE OR REPLACE FUNCTION public.mark_message_sent_manually(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_row public.message_outbox%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.message_outbox WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL OR NOT public.is_staff_of_shop(v_row.shop_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.status NOT IN ('fallback', 'failed', 'queued') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.message_outbox
  SET status = 'sent', channel = 'wa_link', provider = 'wa_link', sent_at = now(), error = NULL, locked_at = NULL
  WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'sent');
END;
$$;
REVOKE ALL ON FUNCTION public.mark_message_sent_manually(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.mark_message_sent_manually(uuid) TO authenticated, service_role;

-- Staff cancel a queued message before it goes out.
CREATE OR REPLACE FUNCTION public.cancel_queued_message(p_id uuid)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_row public.message_outbox%ROWTYPE;
BEGIN
  SELECT * INTO v_row FROM public.message_outbox WHERE id = p_id FOR UPDATE;
  IF v_row.id IS NULL OR NOT public.is_staff_of_shop(v_row.shop_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_row.status NOT IN ('queued', 'fallback', 'failed') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = 'P0001';
  END IF;
  UPDATE public.message_outbox SET status = 'cancelled', locked_at = NULL WHERE id = p_id;
  RETURN jsonb_build_object('id', p_id, 'status', 'cancelled');
END;
$$;
REVOKE ALL ON FUNCTION public.cancel_queued_message(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.cancel_queued_message(uuid) TO authenticated, service_role;

-- Provider + heartbeat status for the dashboard.
CREATE OR REPLACE FUNCTION public.messaging_status()
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'live',        public.messaging_live(),
    'providers',   COALESCE((SELECT to_jsonb(r.providers) FROM public.messaging_runtime r WHERE r.id = 1), '[]'::jsonb),
    'last_run_at', (SELECT r.last_run_at FROM public.messaging_runtime r WHERE r.id = 1)
  )
  WHERE public.is_shop_staff() OR public.messaging_is_service();
$$;
REVOKE ALL ON FUNCTION public.messaging_status() FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.messaging_status() TO authenticated, service_role;

-- ─── 9. Service-role RPCs used by the dispatcher and webhooks ─────────────
CREATE OR REPLACE FUNCTION public.messaging_heartbeat(p_providers text[], p_result jsonb DEFAULT '{}'::jsonb)
RETURNS void
LANGUAGE sql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.messaging_runtime (id, providers, last_run_at, last_result)
  VALUES (1, COALESCE(p_providers, '{}'), now(), COALESCE(p_result, '{}'::jsonb))
  ON CONFLICT (id) DO UPDATE
  SET providers = EXCLUDED.providers, last_run_at = EXCLUDED.last_run_at, last_result = EXCLUDED.last_result;
$$;
REVOKE ALL ON FUNCTION public.messaging_heartbeat(text[], jsonb) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_heartbeat(text[], jsonb) TO service_role;

-- Delivery receipts. Never downgrades (read > delivered > sent); 'failed'
-- only applies to rows that were not delivered yet.
CREATE OR REPLACE FUNCTION public.messaging_record_status(
  p_provider_msg_id text,
  p_status          text,
  p_error           text DEFAULT NULL,
  p_at              timestamptz DEFAULT NULL
)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_at   timestamptz := COALESCE(p_at, now());
  v_rank int := CASE p_status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 WHEN 'failed' THEN 0 ELSE -1 END;
  v_n    int;
BEGIN
  IF p_provider_msg_id IS NULL OR v_rank < 0 THEN
    RETURN false;
  END IF;
  UPDATE public.message_outbox o
  SET status       = CASE
                       WHEN p_status = 'failed' AND o.status IN ('sending', 'sent') THEN 'failed'
                       WHEN v_rank > (CASE o.status WHEN 'sent' THEN 1 WHEN 'delivered' THEN 2 WHEN 'read' THEN 3 ELSE 0 END)
                            AND o.status IN ('sending', 'sent', 'delivered') THEN p_status
                       ELSE o.status END,
      sent_at      = COALESCE(o.sent_at, CASE WHEN v_rank >= 1 THEN v_at END),
      delivered_at = COALESCE(o.delivered_at, CASE WHEN v_rank >= 2 THEN v_at END),
      read_at      = COALESCE(o.read_at, CASE WHEN v_rank = 3 THEN v_at END),
      error        = CASE WHEN p_status = 'failed' THEN left(COALESCE(p_error, 'PROVIDER_FAILED'), 500) ELSE o.error END
  WHERE o.provider_msg_id = p_provider_msg_id;
  GET DIAGNOSTICS v_n = ROW_COUNT;
  RETURN v_n > 0;
END;
$$;
REVOKE ALL ON FUNCTION public.messaging_record_status(text, text, text, timestamptz) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_record_status(text, text, text, timestamptz) TO service_role;

-- Inbound message (WhatsApp/SMS webhook). Records the 24h session, handles
-- opt-out/opt-in keywords and the "Confirm" quick-reply button.
-- Returns {action: none|opted_out|opted_in|confirmed|duplicate, appointment_id?}.
CREATE OR REPLACE FUNCTION public.messaging_handle_inbound(
  p_from            text,
  p_body            text DEFAULT NULL,
  p_button_payload  text DEFAULT NULL,
  p_provider_msg_id text DEFAULT NULL,
  p_context_msg_id  text DEFAULT NULL,
  p_channel         text DEFAULT 'whatsapp'
)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_from    text := public.messaging_normalize_phone(p_from);
  v_text    text := lower(btrim(regexp_replace(COALESCE(p_body, ''), '[[:space:][:punct:]]+', ' ', 'g')));
  v_payload text := upper(btrim(COALESCE(p_button_payload, '')));
  v_action  text := 'none';
  v_appt    uuid;
  v_shop    uuid;
  v_client  uuid;
  v_locale  text := 'ar';
  v_inbound uuid;
BEGIN
  IF v_from IS NULL THEN
    RETURN jsonb_build_object('action', 'none', 'reason', 'INVALID_PHONE');
  END IF;

  -- The outbox row this message replies to (button replies carry its id).
  IF p_context_msg_id IS NOT NULL THEN
    SELECT o.appointment_id, o.shop_id, o.locale INTO v_appt, v_shop, v_locale
    FROM public.message_outbox o WHERE o.provider_msg_id = p_context_msg_id;
  END IF;

  INSERT INTO public.message_inbound (shop_id, from_phone, channel, provider_msg_id, kind, body, payload, context_msg_id)
  VALUES (v_shop, v_from, CASE WHEN p_channel = 'sms' THEN 'sms' ELSE 'whatsapp' END,
          p_provider_msg_id,
          CASE WHEN p_button_payload IS NOT NULL THEN 'button' WHEN p_body IS NOT NULL THEN 'text' ELSE 'other' END,
          left(p_body, 2000), left(p_button_payload, 300), left(p_context_msg_id, 200))
  ON CONFLICT (provider_msg_id) WHERE provider_msg_id IS NOT NULL DO NOTHING
  RETURNING id INTO v_inbound;
  IF v_inbound IS NULL THEN
    RETURN jsonb_build_object('action', 'duplicate');
  END IF;

  IF v_payload LIKE 'CONFIRM%' THEN
    -- Payload may carry the manage token: CONFIRM:<token>.
    IF v_appt IS NULL AND position(':' IN v_payload) > 0 THEN
      SELECT a.id, a.shop_id INTO v_appt, v_shop
      FROM public.appointments a
      WHERE a.manage_token = split_part(btrim(p_button_payload), ':', 2);
    END IF;
    IF v_appt IS NOT NULL THEN
      UPDATE public.appointments a SET status = 'confirmed'
      WHERE a.id = v_appt AND a.status = 'pending' AND a.start_time > now()
        AND EXISTS (SELECT 1 FROM public.clients c
                    WHERE c.id = a.client_id AND public.messaging_normalize_phone(c.phone) = v_from);
      IF FOUND THEN v_action := 'confirmed'; END IF;
    END IF;
  ELSIF v_text IN ('stop', 'unsubscribe', 'إلغاء', 'الغاء', 'ألغاء', 'إيقاف', 'ايقاف', 'توقف', 'stop all')
        OR v_payload IN ('STOP', 'OPT_OUT') THEN
    INSERT INTO public.marketing_consents (client_id, shop_id, channel, opted_in, source)
    SELECT c.id, c.shop_id, ch.channel, false, 'keyword'
    FROM public.clients c
    CROSS JOIN (VALUES ('whatsapp'), ('sms')) AS ch(channel)
    WHERE public.messaging_normalize_phone(c.phone) = v_from AND c.deleted_at IS NULL
    ON CONFLICT (client_id, channel) DO UPDATE
      SET opted_in = false, source = 'keyword', updated_at = now();

    UPDATE public.message_outbox o SET status = 'cancelled', error = 'OPTED_OUT'
    WHERE o.to_phone = v_from AND o.status = 'queued' AND public.messaging_template_optional(o.template);

    SELECT c.id, c.shop_id, COALESCE(c.preferred_language, 'ar') INTO v_client, v_shop, v_locale
    FROM public.clients c
    WHERE public.messaging_normalize_phone(c.phone) = v_from AND c.deleted_at IS NULL
    ORDER BY c.updated_at DESC NULLS LAST LIMIT 1;

    IF v_shop IS NOT NULL THEN
      -- A single confirmation per number per day.
      PERFORM public.message_enqueue_internal(
        v_shop, 'opt_out_confirmation', v_from, v_locale, NULL, v_client, NULL, '{}'::jsonb,
        now(), 0, 'optout:' || v_from || ':' || to_char(now() AT TIME ZONE 'Asia/Amman', 'YYYY-MM-DD'),
        CASE WHEN p_channel = 'sms' THEN 'sms' ELSE 'whatsapp' END);
    END IF;
    v_action := 'opted_out';
  ELSIF v_text IN ('start', 'subscribe', 'اشتراك', 'تفعيل') OR v_payload IN ('START', 'OPT_IN') THEN
    UPDATE public.marketing_consents mc SET opted_in = true, source = 'keyword', updated_at = now()
    WHERE mc.client_id IN (SELECT c.id FROM public.clients c WHERE public.messaging_normalize_phone(c.phone) = v_from);
    v_action := 'opted_in';
  END IF;

  UPDATE public.message_inbound SET action = v_action WHERE id = v_inbound;
  RETURN jsonb_build_object('action', v_action, 'appointment_id', v_appt);
END;
$$;
REVOKE ALL ON FUNCTION public.messaging_handle_inbound(text, text, text, text, text, text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_handle_inbound(text, text, text, text, text, text) TO service_role;

-- Is the WhatsApp 24-hour customer-service window open for this number?
CREATE OR REPLACE FUNCTION public.messaging_session_open(p_phone text)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.message_inbound i
                 WHERE i.from_phone = public.messaging_normalize_phone(p_phone)
                   AND i.channel = 'whatsapp'
                   AND i.received_at > now() - interval '24 hours');
$$;
REVOKE ALL ON FUNCTION public.messaging_session_open(text) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.messaging_session_open(text) TO service_role;

-- ─── 10. Shop messaging settings (shop admin) ─────────────────────────────
-- p_settings keys (all optional): reminder_offsets int[], quiet_hours
-- {enabled, start, end, jumuah, jumuah_start, jumuah_end}, messaging_enabled,
-- messaging_channel whatsapp|sms, sms_fallback, review_request_delay_minutes.
-- Returns the stored settings. Errors: NOT_AUTHORIZED | INVALID_INPUT
-- (DETAIL = field).
CREATE OR REPLACE FUNCTION public.update_messaging_settings(p_settings jsonb)
RETURNS jsonb
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shop    uuid := public.get_current_shop_id();
  v_offsets int[];
  v_quiet   jsonb;
  v_key     text;
  v_out     jsonb;
BEGIN
  IF auth.uid() IS NULL OR v_shop IS NULL OR NOT public.is_admin_of_shop(v_shop) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'P0001';
  END IF;
  IF p_settings IS NULL OR jsonb_typeof(p_settings) <> 'object' OR pg_column_size(p_settings) > 4096 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;

  IF p_settings ? 'reminder_offsets' THEN
    IF jsonb_typeof(p_settings -> 'reminder_offsets') <> 'array' THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'reminder_offsets';
    END IF;
    BEGIN
      SELECT COALESCE(array_agg(v::int ORDER BY v::int DESC), '{}') INTO v_offsets
      FROM jsonb_array_elements_text(p_settings -> 'reminder_offsets') v;
    EXCEPTION WHEN OTHERS THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'reminder_offsets';
    END;
    IF NOT public.messaging_offsets_valid(v_offsets) THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'reminder_offsets';
    END IF;
  END IF;

  IF p_settings ? 'quiet_hours' THEN
    v_quiet := p_settings -> 'quiet_hours';
    IF jsonb_typeof(v_quiet) <> 'object' THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'quiet_hours';
    END IF;
    FOREACH v_key IN ARRAY ARRAY['start', 'end', 'jumuah_start', 'jumuah_end'] LOOP
      IF v_quiet ? v_key AND COALESCE(v_quiet ->> v_key, '') !~ '^([01]\d|2[0-3]):[0-5]\d$' THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'quiet_hours.' || v_key;
      END IF;
    END LOOP;
    FOREACH v_key IN ARRAY ARRAY['enabled', 'jumuah'] LOOP
      IF v_quiet ? v_key AND jsonb_typeof(v_quiet -> v_key) <> 'boolean' THEN
        RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'quiet_hours.' || v_key;
      END IF;
    END LOOP;
    -- Keep only the known keys.
    SELECT COALESCE(jsonb_object_agg(k, v_quiet -> k), '{}'::jsonb) INTO v_quiet
    FROM unnest(ARRAY['enabled', 'start', 'end', 'jumuah', 'jumuah_start', 'jumuah_end']) k
    WHERE v_quiet ? k;
  END IF;

  IF p_settings ? 'messaging_channel' AND COALESCE(p_settings ->> 'messaging_channel', '') NOT IN ('whatsapp', 'sms') THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'messaging_channel';
  END IF;
  FOREACH v_key IN ARRAY ARRAY['messaging_enabled', 'sms_fallback'] LOOP
    IF p_settings ? v_key AND jsonb_typeof(p_settings -> v_key) <> 'boolean' THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = v_key;
    END IF;
  END LOOP;
  IF p_settings ? 'review_request_delay_minutes' AND (
       jsonb_typeof(p_settings -> 'review_request_delay_minutes') <> 'number'
       OR (p_settings ->> 'review_request_delay_minutes')::numeric NOT BETWEEN 0 AND 2880) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001', DETAIL = 'review_request_delay_minutes';
  END IF;

  UPDATE public.shops s
  SET reminder_offsets  = CASE WHEN p_settings ? 'reminder_offsets' THEN v_offsets ELSE s.reminder_offsets END,
      quiet_hours       = CASE WHEN p_settings ? 'quiet_hours' THEN s.quiet_hours || v_quiet ELSE s.quiet_hours END,
      messaging_enabled = COALESCE((p_settings ->> 'messaging_enabled')::boolean, s.messaging_enabled),
      messaging_channel = COALESCE(p_settings ->> 'messaging_channel', s.messaging_channel),
      sms_fallback      = COALESCE((p_settings ->> 'sms_fallback')::boolean, s.sms_fallback),
      review_request_delay_minutes = COALESCE((p_settings ->> 'review_request_delay_minutes')::numeric::int,
                                              s.review_request_delay_minutes)
  WHERE s.id = v_shop
  RETURNING jsonb_build_object(
    'reminder_offsets', to_jsonb(s.reminder_offsets), 'quiet_hours', s.quiet_hours,
    'messaging_enabled', s.messaging_enabled, 'messaging_channel', s.messaging_channel,
    'sms_fallback', s.sms_fallback, 'review_request_delay_minutes', s.review_request_delay_minutes)
  INTO v_out;
  RETURN v_out;
END;
$$;
REVOKE ALL ON FUNCTION public.update_messaging_settings(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.update_messaging_settings(jsonb) TO authenticated, service_role;
