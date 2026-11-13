-- ═══════════════════════════════════════════════════════════════════════════
-- Private columns for signed-in users + verified-only client linking.
--
-- 1. Column privacy for `authenticated`.
--    The storefront row policies (shops_select_public, profiles_select_public_staff)
--    are open to every signed-in user, and signup is open. 0016 limited `anon`
--    to the public columns, but `authenticated` kept the table-wide SELECT grant.
--    Any self-registered customer could therefore read profiles.phone and
--    shops.daily_goal / shops.settings for every shop. Postgres column
--    privileges cannot depend on the row, so `authenticated` now gets the same
--    public column set. Own-shop staff (and the user for their own row) read the
--    private columns only through the SECURITY DEFINER functions below.
--
-- 2. link_customer_client trusted email_confirmed_at alone. With mailer
--    autoconfirm on (the local default, and a one-click dashboard setting),
--    GoTrue sets email_confirmed_at at signup, so anyone could sign up with a
--    victim's email and take over their client rows. A link now needs proof
--    that the address was actually verified (see public.verified_identity).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1a. shops: public columns only for authenticated ───
REVOKE SELECT ON public.shops FROM authenticated;
GRANT SELECT (id, name, description, address, phone, email, instagram, google_maps_url, whatsapp,
              currency, timezone, cancellation_policy_hours, cancellation_fee_percent,
              require_deposit, deposit_type, deposit_value, created_at, updated_at)
  ON public.shops TO authenticated;

-- ─── 1b. profiles: public columns only for authenticated ───
REVOKE SELECT ON public.profiles FROM authenticated;
GRANT SELECT (id, shop_id, role, full_name, avatar_url, created_at, updated_at)
  ON public.profiles TO authenticated;

-- ─── 1c. Own-shop private shop fields (staff only) ───
DROP FUNCTION IF EXISTS public.get_my_shop_private();
CREATE FUNCTION public.get_my_shop_private()
RETURNS TABLE (shop_id uuid, daily_goal numeric, settings jsonb)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id, s.daily_goal, s.settings
  FROM public.shops s
  WHERE s.id = public.get_current_shop_id() AND public.is_shop_staff();
$$;

-- Daily goal of a shop, only when the caller is staff of that shop (else NULL).
DROP FUNCTION IF EXISTS public.shop_daily_goal(uuid);
CREATE FUNCTION public.shop_daily_goal(p_shop_id uuid)
RETURNS numeric
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.daily_goal FROM public.shops s
  WHERE s.id = p_shop_id AND s.id = public.get_current_shop_id() AND public.is_shop_staff();
$$;

-- ─── 1d. Phone numbers: own row always; the whole shop for its staff ───
DROP FUNCTION IF EXISTS public.get_profile_phones();
CREATE FUNCTION public.get_profile_phones()
RETURNS TABLE (id uuid, phone text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.id, p.phone FROM public.profiles p
  WHERE p.id = auth.uid()
     OR (p.shop_id IS NOT NULL AND p.shop_id = public.get_current_shop_id() AND public.is_shop_staff());
$$;

-- ─── 1e. dashboard_metrics reads daily_goal through the staff-only helper ───
-- (Still SECURITY INVOKER: RLS decides which appointments/sales are summed.)
DROP FUNCTION IF EXISTS public.dashboard_metrics(uuid);
CREATE FUNCTION public.dashboard_metrics(p_shop_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
  WITH s AS (
    SELECT sh.id, COALESCE(sh.timezone, 'Asia/Amman') AS tz, COALESCE(public.shop_daily_goal(sh.id), 120) AS goal,
           COALESCE(sh.currency, 'JOD') AS currency,
           (now() AT TIME ZONE COALESCE(sh.timezone, 'Asia/Amman')) AS local_now
    FROM public.shops sh WHERE sh.id = p_shop_id
  ), b AS (
    SELECT s.*,
      (date_trunc('day',   local_now) AT TIME ZONE tz)                         AS day0,
      (date_trunc('day',   local_now) + interval '1 day') AT TIME ZONE tz      AS day1,
      (date_trunc('day',   local_now) - interval '1 day') AT TIME ZONE tz      AS yday0,
      (date_trunc('week',  local_now) AT TIME ZONE tz)                         AS week0,
      (date_trunc('week',  local_now) - interval '1 week') AT TIME ZONE tz     AS pweek0,
      (date_trunc('month', local_now) AT TIME ZONE tz)                         AS month0,
      (date_trunc('month', local_now) - interval '1 month') AT TIME ZONE tz    AS pmonth0
    FROM s
  )
  SELECT jsonb_build_object(
    'today_bookings',     (SELECT count(*) FROM public.appointments a WHERE a.shop_id = b.id AND a.status <> 'cancelled' AND a.start_time >= b.day0  AND a.start_time < b.day1),
    'yesterday_bookings', (SELECT count(*) FROM public.appointments a WHERE a.shop_id = b.id AND a.status <> 'cancelled' AND a.start_time >= b.yday0 AND a.start_time < b.day0),
    'today_sales',        COALESCE((SELECT sum(d.amount) FROM public.daily_sales d WHERE d.shop_id = b.id AND d.created_at >= b.day0  AND d.created_at < b.day1), 0),
    'yesterday_sales',    COALESCE((SELECT sum(d.amount) FROM public.daily_sales d WHERE d.shop_id = b.id AND d.created_at >= b.yday0 AND d.created_at < b.day0), 0),
    'week_sales',         COALESCE((SELECT sum(d.amount) FROM public.daily_sales d WHERE d.shop_id = b.id AND d.created_at >= b.week0), 0),
    'prev_week_sales',    COALESCE((SELECT sum(d.amount) FROM public.daily_sales d WHERE d.shop_id = b.id AND d.created_at >= b.pweek0 AND d.created_at < b.week0), 0),
    'month_sales',        COALESCE((SELECT sum(d.amount) FROM public.daily_sales d WHERE d.shop_id = b.id AND d.created_at >= b.month0), 0),
    'prev_month_sales',   COALESCE((SELECT sum(d.amount) FROM public.daily_sales d WHERE d.shop_id = b.id AND d.created_at >= b.pmonth0 AND d.created_at < b.month0), 0),
    'daily_goal',         b.goal,
    'currency',           b.currency,
    'timezone',           b.tz
  )
  FROM b;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. Verified identity for client linking
-- ═══════════════════════════════════════════════════════════════════════════
-- Returns the caller's email / phone digits ONLY when there is evidence of a
-- real verification step, independent of the project's autoconfirm settings:
--   email: confirmed after a confirmation mail was sent (signup/magic-link
--          confirmation), accepted invite, or a non-email identity (OAuth)
--          whose provider reports the address as verified.
--   phone: confirmed after an OTP was sent (signup or phone change).
-- An autoconfirmed signup has email_confirmed_at but no confirmation_sent_at,
-- so it never qualifies.
DROP FUNCTION IF EXISTS public.verified_identity(uuid);
CREATE FUNCTION public.verified_identity(p_uid uuid)
RETURNS TABLE (email text, phone_digits text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT
    CASE WHEN u.email_confirmed_at IS NOT NULL AND COALESCE(u.email, '') <> '' AND (
           (u.confirmation_sent_at IS NOT NULL AND u.email_confirmed_at >= u.confirmation_sent_at)
        OR (u.invited_at IS NOT NULL AND u.email_confirmed_at >= u.invited_at)
        OR EXISTS (
             SELECT 1 FROM auth.identities i
             WHERE i.user_id = u.id AND i.provider NOT IN ('email', 'phone')
               AND lower(COALESCE(i.identity_data->>'email', '')) = lower(u.email)
               AND COALESCE(i.identity_data->>'email_verified', 'false') = 'true')
         ) THEN lower(u.email) END,
    CASE WHEN u.phone_confirmed_at IS NOT NULL AND COALESCE(u.phone, '') <> '' AND (
           (u.confirmation_sent_at IS NOT NULL AND u.phone_confirmed_at >= u.confirmation_sent_at)
        OR (u.phone_change_sent_at IS NOT NULL AND u.phone_confirmed_at >= u.phone_change_sent_at)
         ) THEN regexp_replace(u.phone, '\D', '', 'g') END
  FROM auth.users u
  WHERE u.id = p_uid;
$$;

DROP FUNCTION IF EXISTS public.link_customer_client();
CREATE FUNCTION public.link_customer_client()
RETURNS uuid
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_uid    uuid := auth.uid();
  v_email  text;
  v_phone  text;
  v_id     uuid;
BEGIN
  IF v_uid IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;

  SELECT v.email, v.phone_digits INTO v_email, v_phone
  FROM public.verified_identity(v_uid) v;

  IF COALESCE(v_email, '') <> '' OR COALESCE(v_phone, '') <> '' THEN
    UPDATE public.clients c SET auth_user_id = v_uid
    WHERE c.auth_user_id IS NULL AND c.deleted_at IS NULL
      AND ((COALESCE(v_email, '') <> '' AND lower(c.email) = v_email)
        OR (length(COALESCE(v_phone, '')) >= 7 AND c.phone_digits = v_phone));
  END IF;

  SELECT c.id INTO v_id FROM public.clients c
  WHERE c.auth_user_id = v_uid ORDER BY c.created_at DESC LIMIT 1;
  RETURN v_id;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. Function privileges (revoke the Supabase defaults, then allow-list)
-- ═══════════════════════════════════════════════════════════════════════════
REVOKE ALL ON FUNCTION public.get_my_shop_private()     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.shop_daily_goal(uuid)     FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.get_profile_phones()      FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.dashboard_metrics(uuid)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.verified_identity(uuid)   FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.link_customer_client()    FROM PUBLIC, anon, authenticated;

GRANT EXECUTE ON FUNCTION public.get_my_shop_private()   TO authenticated;
GRANT EXECUTE ON FUNCTION public.shop_daily_goal(uuid)   TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_profile_phones()    TO authenticated;
GRANT EXECUTE ON FUNCTION public.dashboard_metrics(uuid) TO authenticated;
GRANT EXECUTE ON FUNCTION public.link_customer_client()  TO authenticated;
-- verified_identity stays internal (called only from SECURITY DEFINER code).
