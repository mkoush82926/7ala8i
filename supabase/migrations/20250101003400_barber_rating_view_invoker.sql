-- ═══════════════════════════════════════════════════════════════════════
-- barber_rating_view: stop running as the view owner (Supabase advisor
-- lint 0010 "security_definer_view").
--
-- The view must aggregate reviews joined to appointments, and anon/customers
-- cannot read appointments under RLS. Instead of an owner-rights view (which
-- bypassed RLS for every row and also exposed ratings of unpublished shops
-- and private barbers), the aggregation now lives in an explicit
-- SECURITY DEFINER function that applies the same visibility rules as
-- get_barber_reviews(): public barbers of public shops with non-hidden
-- reviews, or anything for staff of that shop. The view keeps its name and
-- columns (the app reads it) and runs with the caller's rights.
--
-- Idempotent; safe to run more than once.
-- ═══════════════════════════════════════════════════════════════════════

CREATE OR REPLACE FUNCTION public.barber_ratings()
RETURNS TABLE (barber_id uuid, shop_id uuid, rating_avg numeric, rating_count int)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT a.barber_id,
         a.shop_id,
         round(avg(r.rating)::numeric, 2) AS rating_avg,
         count(*)::int                    AS rating_count
    FROM public.reviews r
    JOIN public.appointments a ON a.id = r.appointment_id
    JOIN public.profiles p     ON p.id = a.barber_id
   WHERE a.barber_id IS NOT NULL
     AND r.rating BETWEEN 1 AND 5
     AND r.hidden_at IS NULL
     AND ((p.is_public AND public.shop_is_public(a.shop_id))
          OR public.is_staff_of_shop(a.shop_id))
   GROUP BY a.barber_id, a.shop_id;
$$;
REVOKE ALL ON FUNCTION public.barber_ratings() FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.barber_ratings() TO anon, authenticated, service_role;

CREATE OR REPLACE VIEW public.barber_rating_view
WITH (security_invoker = true) AS
  SELECT barber_id, shop_id, rating_avg, rating_count
    FROM public.barber_ratings();
ALTER VIEW public.barber_rating_view SET (security_invoker = true);
REVOKE ALL ON public.barber_rating_view FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.barber_rating_view TO anon, authenticated, service_role;
