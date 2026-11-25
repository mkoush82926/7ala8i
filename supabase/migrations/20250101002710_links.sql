-- ═══════════════════════════════════════════════════════════════════════════
-- WS-1H · Branded booking links, QR posters and channel attribution.
--
--   1. link_channel(text): one canonical channel per raw ?src= token
--      (ig, fb, wa, qr, web, google, tiktok, link, direct, other).
--   2. booking_source_category(text): extended so QR, Facebook and website
--      bookings keep their own appointments.source value ('qr', 'facebook',
--      'website') instead of folding into 'online'. Every value it returned
--      before is returned unchanged.
--   3. shops.booking_link_theme jsonb: look of the /b/{slug} page
--      ({accent, show_cover, show_logo, welcome_en, welcome_ar}).
--   4. link_visits: one row per branded-link page view, written only by
--      record_link_visit() (anon, rate limited), read by the shop admin.
--   5. get_link_stats(p_days): visits -> bookings -> completed per channel
--      for the caller's own shop (shop admin only, SECURITY INVOKER).
--
-- Version note: 20250101002700 is already taken by
-- 20250101002700_gate1a_service_role_grants.sql, so this file uses 002710
-- (still inside the 1H block) to keep schema_migrations versions unique.
--
-- Idempotent and safe on production data: ADD COLUMN IF NOT EXISTS with a
-- default every row satisfies, CREATE TABLE IF NOT EXISTS, CREATE OR REPLACE
-- FUNCTION, DROP POLICY IF EXISTS before CREATE POLICY.
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Canonical link channel ─────────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.link_channel(p_src text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN v IS NULL OR v = '' THEN 'direct'
    WHEN v ~ '^(ig|insta)' THEN 'ig'
    WHEN v ~ '^(fb|facebook|meta)' THEN 'fb'
    WHEN v ~ '^(wa|whatsapp)' THEN 'wa'
    WHEN v ~ '^qr' THEN 'qr'
    WHEN v ~ '^(web|website|site|embed)' THEN 'web'
    WHEN v ~ '^(google|gmb|gbp|maps)' THEN 'google'
    WHEN v ~ '^(tiktok|tt$)' THEN 'tiktok'
    WHEN v IN ('link', 'bio', 'share') THEN 'link'
    ELSE 'other'
  END
  FROM (SELECT lower(trim(COALESCE(p_src, ''))) AS v) s;
$$;
REVOKE ALL ON FUNCTION public.link_channel(text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.link_channel(text) TO anon, authenticated, service_role;

-- ─── 2. appointments.source categories (superset of the 1D mapping) ────────
-- Before: online | instagram | google | word_of_mouth | walk_in | whatsapp | other.
-- Added:  qr | facebook | website. No CHECK constraint exists on
-- appointments.source; clients.source only limits length (<= 50).
CREATE OR REPLACE FUNCTION public.booking_source_category(p_src text)
RETURNS text
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_src IS NULL OR p_src = '' THEN 'online'
    WHEN lower(p_src) IN ('online', 'instagram', 'google', 'word_of_mouth', 'walk_in', 'whatsapp', 'other',
                          'qr', 'facebook', 'website') THEN lower(p_src)
    WHEN lower(p_src) ~ '^(ig|insta)' THEN 'instagram'
    WHEN lower(p_src) ~ '^(wa|whatsapp)' THEN 'whatsapp'
    WHEN lower(p_src) ~ '^(google|gmb|gbp|maps)' THEN 'google'
    WHEN lower(p_src) ~ '^qr' THEN 'qr'
    WHEN lower(p_src) ~ '^(fb|facebook|meta)' THEN 'facebook'
    WHEN lower(p_src) ~ '^(web|website|site|embed)' THEN 'website'
    ELSE 'online'
  END;
$$;
GRANT EXECUTE ON FUNCTION public.booking_source_category(text) TO anon, authenticated, service_role;

-- ─── 3. shops.booking_link_theme ──────────────────────────────────────────
CREATE OR REPLACE FUNCTION public.booking_link_theme_valid(p jsonb)
RETURNS boolean
LANGUAGE sql IMMUTABLE
SET search_path = public, pg_temp
AS $$
  SELECT p IS NOT NULL
     AND jsonb_typeof(p) = 'object'
     AND octet_length(p::text) <= 2048
     AND NOT EXISTS (
       SELECT 1 FROM jsonb_object_keys(p) k
        WHERE k NOT IN ('accent', 'show_cover', 'show_logo', 'welcome_en', 'welcome_ar')
     )
     AND (NOT p ? 'accent'     OR (jsonb_typeof(p->'accent') = 'string' AND p->>'accent' IN ('ink', 'brass', 'paper')))
     AND (NOT p ? 'show_cover' OR jsonb_typeof(p->'show_cover') = 'boolean')
     AND (NOT p ? 'show_logo'  OR jsonb_typeof(p->'show_logo')  = 'boolean')
     AND (NOT p ? 'welcome_en' OR jsonb_typeof(p->'welcome_en') = 'null'
          OR (jsonb_typeof(p->'welcome_en') = 'string' AND char_length(p->>'welcome_en') <= 160))
     AND (NOT p ? 'welcome_ar' OR jsonb_typeof(p->'welcome_ar') = 'null'
          OR (jsonb_typeof(p->'welcome_ar') = 'string' AND char_length(p->>'welcome_ar') <= 160));
$$;
REVOKE ALL ON FUNCTION public.booking_link_theme_valid(jsonb) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.booking_link_theme_valid(jsonb) TO anon, authenticated, service_role;

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS booking_link_theme jsonb NOT NULL DEFAULT '{}'::jsonb;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
     WHERE conname = 'shops_booking_link_theme_valid' AND conrelid = 'public.shops'::regclass
  ) THEN
    -- Every existing row holds the '{}' default, which is valid.
    ALTER TABLE public.shops
      ADD CONSTRAINT shops_booking_link_theme_valid CHECK (public.booking_link_theme_valid(booking_link_theme));
  END IF;
END $$;

-- Public storefront column (the branded page renders it for anon visitors).
-- Writes go through the existing shops_update_admin RLS policy.
GRANT SELECT (booking_link_theme) ON public.shops TO anon, authenticated;

-- ─── 4. link_visits ───────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.link_visits (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id    uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  src        text NOT NULL DEFAULT 'direct'
             CHECK (src IN ('ig', 'fb', 'wa', 'qr', 'web', 'google', 'tiktok', 'link', 'direct', 'other')),
  entry      text CHECK (entry IS NULL OR entry ~ '^[a-z0-9_.:-]{1,40}$'),
  visited_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_link_visits_shop_time ON public.link_visits (shop_id, visited_at DESC);

ALTER TABLE public.link_visits ENABLE ROW LEVEL SECURITY;
REVOKE ALL ON public.link_visits FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.link_visits TO authenticated;
GRANT ALL ON public.link_visits TO service_role;

DROP POLICY IF EXISTS link_visits_select_admin ON public.link_visits;
CREATE POLICY link_visits_select_admin ON public.link_visits
  FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
-- No INSERT/UPDATE/DELETE policies: rows are written only by record_link_visit().

-- ─── record_link_visit (anon beacon) ──────────────────────────────────────
CREATE OR REPLACE FUNCTION public.record_link_visit(p_shop_id uuid, p_src text DEFAULT NULL, p_entry text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_entry text := NULLIF(lower(left(trim(COALESCE(p_entry, '')), 40)), '');
BEGIN
  IF p_shop_id IS NULL OR NOT EXISTS (SELECT 1 FROM public.shops WHERE id = p_shop_id) THEN
    RETURN false;
  END IF;
  IF v_entry IS NOT NULL AND v_entry !~ '^[a-z0-9_.:-]{1,40}$' THEN
    v_entry := NULL;
  END IF;
  -- Per IP and per (IP-independent) shop: a scripted flood cannot inflate a
  -- shop's funnel or fill the table. Over the limit the visit is dropped.
  IF NOT public.check_request_rate_limit('link_visit', 30, 300, NULL) THEN
    RETURN false;
  END IF;
  IF NOT public.check_rate_limit('rpc:link_visit:shop:' || p_shop_id::text, 600, 3600) THEN
    RETURN false;
  END IF;
  INSERT INTO public.link_visits (shop_id, src, entry)
  VALUES (p_shop_id, public.link_channel(p_src), v_entry);
  RETURN true;
END;
$$;
REVOKE ALL ON FUNCTION public.record_link_visit(uuid, text, text) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.record_link_visit(uuid, text, text) TO anon, authenticated, service_role;

-- ─── 5. get_link_stats (shop admin funnel) ────────────────────────────────
-- SECURITY INVOKER: link_visits, booking_attribution and appointments RLS all
-- apply, and the explicit admin check returns NOT_AUTHORIZED instead of zeros.
CREATE OR REPLACE FUNCTION public.get_link_stats(p_days int DEFAULT 30)
RETURNS TABLE(channel text, visits bigint, bookings bigint, completed bigint)
LANGUAGE plpgsql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_shop  uuid := public.get_current_shop_id();
  v_since timestamptz;
BEGIN
  IF v_shop IS NULL OR NOT public.is_shop_admin() THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'P0001';
  END IF;
  IF p_days IS NULL OR p_days < 1 OR p_days > 365 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  v_since := now() - make_interval(days => p_days);

  RETURN QUERY
  WITH v AS (
    SELECT lv.src AS ch, count(*)::bigint AS n
      FROM public.link_visits lv
     WHERE lv.shop_id = v_shop AND lv.visited_at >= v_since
     GROUP BY lv.src
  ), b AS (
    SELECT public.link_channel(ba.src) AS ch,
           count(*) FILTER (WHERE a.status IS DISTINCT FROM 'cancelled')::bigint AS n,
           count(*) FILTER (WHERE a.status = 'completed')::bigint AS done
      FROM public.booking_attribution ba
      JOIN public.appointments a ON a.id = ba.appointment_id
     WHERE ba.shop_id = v_shop
       AND ba.created_at >= v_since
       -- Branded-link bookings, plus any tagged channel booked elsewhere.
       AND (ba.entry = 'link' OR public.link_channel(ba.src) NOT IN ('direct', 'other'))
     GROUP BY 1
  )
  SELECT COALESCE(v.ch, b.ch), COALESCE(v.n, 0), COALESCE(b.n, 0), COALESCE(b.done, 0)
    FROM v FULL JOIN b ON b.ch = v.ch
   ORDER BY 2 DESC, 3 DESC, 1;
END;
$$;
REVOKE ALL ON FUNCTION public.get_link_stats(int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_link_stats(int) TO authenticated, service_role;
