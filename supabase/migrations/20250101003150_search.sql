-- ════════════════════════════════════════════════════════════════════════════
-- WS-1B · Consumer home and search
--
--   search_shops(...)          ranked, filtered marketplace search (anon)
--   search_barbers(...)        the same for public barbers (anon)
--   public_stats(city_id)      aggregate counters for the home page (anon)
--   public_recent_reviews(...) recent 4–5★ reviews with a masked reviewer (anon)
--   get_book_again(limit)      the signed-in customer's past shops (authenticated)
--
-- Everything reads through SECURITY DEFINER functions that only ever return
-- published + marketplace-visible shops (get_book_again: published shops the
-- caller has visited) and aggregates. No table grants change; anon still
-- cannot read appointments, clients or phone numbers.
--
-- Availability comes from P0V next_available_slot(); it is not redefined.
-- Idempotent: CREATE OR REPLACE / IF NOT EXISTS throughout.
-- ════════════════════════════════════════════════════════════════════════════

-- "Booked today" counter: appointments created since local midnight.
CREATE INDEX IF NOT EXISTS idx_appointments_shop_created
  ON public.appointments (shop_id, created_at);

-- ─── Helpers (internal) ─────────────────────────────────────────────────────

-- Great-circle distance in km.
CREATE OR REPLACE FUNCTION public.search_distance_km(
  p_lat1 double precision, p_lng1 double precision,
  p_lat2 double precision, p_lng2 double precision
) RETURNS double precision
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_lat1 IS NULL OR p_lng1 IS NULL OR p_lat2 IS NULL OR p_lng2 IS NULL THEN NULL
    ELSE 6371.0088 * 2 * asin(least(1, sqrt(
           power(sin(radians(p_lat2 - p_lat1) / 2), 2)
         + cos(radians(p_lat1)) * cos(radians(p_lat2)) * power(sin(radians(p_lng2 - p_lng1) / 2), 2))))
  END;
$$;

-- Search text: normalize_ar (diacritics, alef/ya/ta-marbuta, digits, lower)
-- plus ASCII and Arabic punctuation folded to spaces.
CREATE OR REPLACE FUNCTION public.search_normalize(p text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT btrim(regexp_replace(
           regexp_replace(coalesce(public.normalize_ar(p), ''), '[!-/:-@\[-`{-~،؛؟«»]', ' ', 'g'),
           '\s+', ' ', 'g'));
$$;

-- Up to 5 distinct terms of a query (1..40 chars each).
CREATE OR REPLACE FUNCTION public.search_terms(p_q text)
RETURNS text[]
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT coalesce(array_agg(t ORDER BY first_ord), '{}'::text[])
  FROM (
    SELECT t, min(ord) AS first_ord
    FROM unnest(string_to_array(public.search_normalize(left(coalesce(p_q, ''), 120)), ' ')) WITH ORDINALITY u(t, ord)
    WHERE t <> '' AND length(t) <= 40
    GROUP BY t
    ORDER BY min(ord)
    LIMIT 5
  ) x;
$$;

-- Rate limit for anon search endpoints, per request IP. service_role (server
-- jobs, sitemap builders) is exempt.
CREATE OR REPLACE FUNCTION public.search_rate_ok(p_scope text DEFAULT 'search')
RETURNS boolean
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF coalesce(auth.role(), '') = 'service_role' THEN
    RETURN true;
  END IF;
  RETURN public.check_request_rate_limit(p_scope, 60, 60);
END;
$$;

-- When the shop is open right now (any online-bookable staff member is inside
-- a working range), returns when that range ends; NULL when closed.
CREATE OR REPLACE FUNCTION public.search_open_until(p_shop_id uuid, p_tz text DEFAULT 'Asia/Amman')
RETURNS timestamptz
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT max(upper(r))
  FROM public.profiles p
  CROSS JOIN LATERAL unnest(public.availability_work_ranges(
      p_shop_id, p.id, coalesce(nullif(p_tz, ''), 'Asia/Amman'),
      (now() AT TIME ZONE coalesce(nullif(p_tz, ''), 'Asia/Amman'))::date,
      (now() AT TIME ZONE coalesce(nullif(p_tz, ''), 'Asia/Amman'))::date)) AS r
  WHERE p.shop_id = p_shop_id
    AND p.role::text IN ('barber', 'shop_admin')
    AND p.online_bookable IS NOT FALSE
    AND r @> now();
$$;

-- Shared candidate set: published + marketplace-visible shops that have at
-- least one active service and published hours, after the location and
-- facet filters. Text matching, ranking and availability happen in callers.
--
-- p_filters keys (all optional): kids, home_service, parking, cliq, card
-- (booleans) and audience ('men' | 'women').
CREATE OR REPLACE FUNCTION public.search_shop_base(
  p_area_id   uuid,
  p_city_id   uuid,
  p_lat       double precision,
  p_lng       double precision,
  p_radius_km double precision,
  p_filters   jsonb
) RETURNS TABLE (
  shop_id      uuid,
  distance_km  double precision,
  has_kids     boolean,
  has_home     boolean,
  has_parking  boolean,
  has_cliq     boolean,
  has_card     boolean,
  works_today  boolean
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH f AS (
    SELECT
      CASE WHEN jsonb_typeof(p_filters) = 'object' THEN p_filters ELSE '{}'::jsonb END AS j,
      (p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180) AS has_point,
      CASE WHEN p_radius_km IS NULL THEN NULL ELSE least(greatest(p_radius_km, 0.5), 200) END AS radius
  ),
  base AS (
    SELECT s.id, s.timezone,
           CASE WHEN f.has_point THEN public.search_distance_km(p_lat, p_lng, s.lat, s.lng) END AS dist
    FROM public.shops s, f
    WHERE s.is_published AND s.marketplace_visible
      AND (p_area_id IS NULL OR s.area_id = p_area_id)
      AND (p_city_id IS NULL OR s.city_id = p_city_id)
      AND EXISTS (SELECT 1 FROM public.services sv WHERE sv.shop_id = s.id AND sv.is_active IS TRUE)
      AND EXISTS (SELECT 1 FROM public.working_hours wh
                  JOIN public.profiles p ON p.id = wh.barber_id
                  WHERE p.shop_id = s.id AND p.role::text IN ('barber', 'shop_admin')
                    AND wh.is_working IS TRUE)
  ),
  flags AS (
    SELECT b.id, b.dist,
      EXISTS (SELECT 1 FROM public.shop_amenities sa JOIN public.amenities a ON a.id = sa.amenity_id
              WHERE sa.shop_id = b.id AND a.slug = 'kids-friendly')
      OR EXISTS (SELECT 1 FROM public.services sv LEFT JOIN public.service_categories c ON c.id = sv.category_id
                 WHERE sv.shop_id = b.id AND sv.is_active IS TRUE AND (sv.audience = 'kids' OR c.slug = 'kids')) AS kids,
      EXISTS (SELECT 1 FROM public.services sv WHERE sv.shop_id = b.id AND sv.is_active IS TRUE AND sv.location_type = 'home')
      OR EXISTS (SELECT 1 FROM public.shop_amenities sa JOIN public.amenities a ON a.id = sa.amenity_id
                 WHERE sa.shop_id = b.id AND a.slug = 'home-service') AS home,
      EXISTS (SELECT 1 FROM public.shop_amenities sa JOIN public.amenities a ON a.id = sa.amenity_id
              WHERE sa.shop_id = b.id AND a.slug = 'parking') AS parking,
      EXISTS (SELECT 1 FROM public.payment_methods pm WHERE pm.shop_id = b.id AND pm.is_active AND pm.kind = 'cliq')
      OR EXISTS (SELECT 1 FROM public.shop_amenities sa JOIN public.amenities a ON a.id = sa.amenity_id
                 WHERE sa.shop_id = b.id AND a.slug = 'cliq') AS cliq,
      EXISTS (SELECT 1 FROM public.payment_methods pm WHERE pm.shop_id = b.id AND pm.is_active AND pm.kind = 'card')
      OR EXISTS (SELECT 1 FROM public.shop_amenities sa JOIN public.amenities a ON a.id = sa.amenity_id
                 WHERE sa.shop_id = b.id AND a.slug = 'card-payment') AS card,
      EXISTS (SELECT 1 FROM public.services sv WHERE sv.shop_id = b.id AND sv.is_active IS TRUE
              AND sv.audience IN ('men', 'everyone')) AS men,
      EXISTS (SELECT 1 FROM public.services sv WHERE sv.shop_id = b.id AND sv.is_active IS TRUE
              AND sv.audience = 'women') AS women,
      -- Cheap "works today" signal for ranking (exact availability is computed per page).
      (NOT EXISTS (SELECT 1 FROM public.closed_periods cp
                   WHERE cp.shop_id = b.id
                     AND (now() AT TIME ZONE coalesce(nullif(b.timezone, ''), 'Asia/Amman'))::date
                         BETWEEN cp.start_date AND cp.end_date)
       AND NOT EXISTS (SELECT 1 FROM public.special_hours sp
                       WHERE sp.shop_id = b.id AND sp.is_closed
                         AND sp.date = (now() AT TIME ZONE coalesce(nullif(b.timezone, ''), 'Asia/Amman'))::date)
       AND EXISTS (SELECT 1 FROM public.profiles p
                   LEFT JOIN public.working_hours wh
                     ON wh.barber_id = p.id
                    AND wh.day_of_week = extract(dow FROM now() AT TIME ZONE coalesce(nullif(b.timezone, ''), 'Asia/Amman'))::int
                   WHERE p.shop_id = b.id AND p.role::text IN ('barber', 'shop_admin')
                     AND p.online_bookable IS NOT FALSE
                     AND (wh.is_working IS TRUE
                          OR NOT EXISTS (SELECT 1 FROM public.working_hours w2 WHERE w2.barber_id = p.id)))) AS today
    FROM base b
  )
  SELECT fl.id, fl.dist, fl.kids, fl.home, fl.parking, fl.cliq, fl.card, fl.today
  FROM flags fl, f
  WHERE (f.radius IS NULL OR NOT f.has_point OR (fl.dist IS NOT NULL AND fl.dist <= f.radius))
    AND (coalesce((f.j->>'kids')::boolean, false) = false OR fl.kids)
    AND (coalesce((f.j->>'home_service')::boolean, false) = false OR fl.home)
    AND (coalesce((f.j->>'parking')::boolean, false) = false OR fl.parking)
    AND (coalesce((f.j->>'cliq')::boolean, false) = false OR fl.cliq)
    AND (coalesce((f.j->>'card')::boolean, false) = false OR fl.card)
    AND (coalesce(f.j->>'audience', '') NOT IN ('men', 'women')
         OR (f.j->>'audience' = 'men' AND fl.men)
         OR (f.j->>'audience' = 'women' AND fl.women));
$$;

-- Active services of candidate shops that match each search term: by name,
-- by category (service_categories names + AR/EN synonyms, so دقن → beard),
-- or by a synonym of a matching category appearing in the service name.
CREATE OR REPLACE FUNCTION public.search_service_hits(p_shop_ids uuid[], p_terms text[])
RETURNS TABLE (service_id uuid, shop_id uuid, term text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH terms AS (
    SELECT t FROM unnest(p_terms) t WHERE t <> ''
  ),
  cat_all AS MATERIALIZED (
    SELECT c.id, public.search_normalize(x) AS syn
    FROM public.service_categories c
    CROSS JOIN LATERAL unnest(
      ARRAY[replace(c.slug, '-', ' '), c.name_en, c.name_ar]
      || coalesce(c.synonyms_ar, '{}'::text[]) || coalesce(c.synonyms_en, '{}'::text[])) x
    WHERE c.is_active IS NOT FALSE AND coalesce(btrim(x), '') <> ''
  ),
  cat_hit AS (
    SELECT DISTINCT tm.t, ca.id
    FROM terms tm
    JOIN cat_all ca
      ON ca.syn <> ''
     AND (ca.syn = tm.t
          OR (length(tm.t) >= 3 AND ca.syn LIKE tm.t || '%')
          OR (length(ca.syn) >= 3 AND (' ' || tm.t || ' ') LIKE '% ' || ca.syn || ' %'))
  ),
  cat_syn AS MATERIALIZED (
    SELECT DISTINCT ch.t, ca.syn
    FROM cat_hit ch JOIN cat_all ca ON ca.id = ch.id
    WHERE length(ca.syn) >= 3
  ),
  svc AS MATERIALIZED (
    SELECT sv.id, sv.shop_id, sv.category_id,
           public.search_normalize(sv.name) AS nn,
           public.search_normalize(sv.name_ar) AS nna
    FROM public.services sv
    WHERE sv.shop_id = ANY (p_shop_ids) AND sv.is_active IS TRUE
  )
  SELECT DISTINCT sv.id, sv.shop_id, tm.t
  FROM svc sv
  CROSS JOIN terms tm
  WHERE sv.nn LIKE '%' || tm.t || '%'
     OR sv.nna LIKE '%' || tm.t || '%'
     OR EXISTS (SELECT 1 FROM cat_hit ch WHERE ch.t = tm.t AND ch.id = sv.category_id)
     OR EXISTS (SELECT 1 FROM cat_syn cs WHERE cs.t = tm.t
                AND (sv.nn LIKE '%' || cs.syn || '%' OR sv.nna LIKE '%' || cs.syn || '%'));
$$;

-- ─── search_shops ───────────────────────────────────────────────────────────
-- p_sort: recommended (default) | nearest | top_rated | lowest_price
-- p_filters: search_shop_base keys plus open_now, available_today (booleans),
--            price_min, price_max (JD, numbers).
-- p_date / p_time_from / p_time_to ('HH:MM', shop-local) keep only shops with
-- a bookable start inside that window (via next_available_slot).
-- total_count is exact when no availability filter is active, otherwise NULL
-- (callers then infer "more" from a full page).
DROP FUNCTION IF EXISTS public.search_shops(text, uuid, double precision, double precision, double precision,
  date, text, text, text, jsonb, integer, integer, uuid);

CREATE OR REPLACE FUNCTION public.search_shops(
  p_q          text DEFAULT NULL,
  p_area_id    uuid DEFAULT NULL,
  p_lat        double precision DEFAULT NULL,
  p_lng        double precision DEFAULT NULL,
  p_radius_km  double precision DEFAULT NULL,
  p_date       date DEFAULT NULL,
  p_time_from  text DEFAULT NULL,
  p_time_to    text DEFAULT NULL,
  p_sort       text DEFAULT 'recommended',
  p_filters    jsonb DEFAULT '{}'::jsonb,
  p_limit      integer DEFAULT 20,
  p_offset     integer DEFAULT 0,
  p_city_id    uuid DEFAULT NULL
) RETURNS TABLE (
  id                   uuid,
  slug                 text,
  slug_ar              text,
  name                 text,
  name_ar              text,
  cover_url            text,
  logo_url             text,
  is_verified          boolean,
  area_name_en         text,
  area_name_ar         text,
  city_name_en         text,
  city_name_ar         text,
  lat                  double precision,
  lng                  double precision,
  distance_km          double precision,
  rating_avg           numeric,
  rating_count         integer,
  min_price            numeric,
  currency             text,
  services_count       integer,
  matched_services     jsonb,
  next_slot_start      timestamptz,
  next_slot_local_date date,
  next_slot_local_time text,
  open_now             boolean,
  open_until           timestamptz,
  badges               text[],
  score                double precision,
  total_count          integer
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_terms     text[] := public.search_terms(p_q);
  v_q         text := public.search_normalize(left(coalesce(p_q, ''), 120));
  v_f         jsonb := CASE WHEN jsonb_typeof(p_filters) = 'object' THEN p_filters ELSE '{}'::jsonb END;
  v_sort      text := CASE WHEN p_sort IN ('recommended', 'nearest', 'top_rated', 'lowest_price') THEN p_sort ELSE 'recommended' END;
  v_limit     int := least(greatest(coalesce(p_limit, 20), 1), 48);
  v_offset    int := least(greatest(coalesce(p_offset, 0), 0), 2000);
  v_point     boolean := p_lat BETWEEN -90 AND 90 AND p_lng BETWEEN -180 AND 180;
  v_pmin      numeric;
  v_pmax      numeric;
  v_open_f    boolean := coalesce((v_f->>'open_now')::boolean, false);
  v_avail_f   boolean;
  v_from      time;
  v_to        time;
  v_date      date := p_date;
  v_dynamic   boolean;
  v_passed    int := 0;
  v_emitted   int := 0;
  v_checked   int := 0;
  v_after     timestamptz;
  v_before    timestamptz;
  v_tz        text;
  r           record;
  s           record;
BEGIN
  IF NOT public.search_rate_ok('search') THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    v_pmin := nullif(v_f->>'price_min', '')::numeric;
    v_pmax := nullif(v_f->>'price_max', '')::numeric;
    IF p_time_from ~ '^\d{2}:\d{2}$' THEN v_from := p_time_from::time; END IF;
    IF p_time_to ~ '^\d{2}:\d{2}$' THEN v_to := CASE WHEN p_time_to = '24:00' THEN '23:59:59'::time ELSE p_time_to::time END; END IF;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END;
  IF v_from IS NOT NULL AND v_to IS NOT NULL AND v_to <= v_from THEN
    v_to := NULL;
  END IF;
  IF v_date IS NOT NULL AND (v_date < (now() AT TIME ZONE 'Asia/Amman')::date - 1
                             OR v_date > (now() AT TIME ZONE 'Asia/Amman')::date + 365) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;

  v_avail_f := coalesce((v_f->>'available_today')::boolean, false) OR v_date IS NOT NULL
               OR v_from IS NOT NULL OR v_to IS NOT NULL;
  IF v_avail_f AND v_date IS NULL THEN
    v_date := (now() AT TIME ZONE 'Asia/Amman')::date;
  END IF;
  v_dynamic := v_open_f OR v_avail_f;

  FOR r IN
    WITH base AS (
      SELECT * FROM public.search_shop_base(p_area_id, p_city_id, p_lat, p_lng, p_radius_km, v_f)
    ),
    hits AS (
      SELECT * FROM public.search_service_hits((SELECT array_agg(b.shop_id) FROM base b), v_terms)
      WHERE cardinality(v_terms) > 0
    ),
    shop AS (
      SELECT b.*, s.slug, s.slug_ar, s.name, s.name_ar, s.cover_url, s.logo_url, s.is_verified,
             s.lat, s.lng, coalesce(s.currency, 'JOD') AS currency, s.published_at,
             coalesce(nullif(s.timezone, ''), 'Asia/Amman') AS tz,
             coalesce(btrim(s.description), '') <> '' OR coalesce(btrim(s.description_ar), '') <> '' AS has_desc,
             EXISTS (SELECT 1 FROM public.shop_photos ph WHERE ph.shop_id = s.id) AS has_photos,
             a.name_en AS area_en, a.name_ar AS area_ar, c.name_en AS city_en, c.name_ar AS city_ar,
             public.search_normalize(concat_ws(' ', s.name, s.name_ar, replace(s.slug, '-', ' '))) AS n_name,
             public.search_normalize(concat_ws(' ', a.name_en, a.name_ar, c.name_en, c.name_ar,
                                               s.landmark_en, s.landmark_ar, s.address)) AS n_place,
             (SELECT public.search_normalize(string_agg(p.full_name || ' ' || coalesce(p.handle, ''), ' '))
                FROM public.profiles p
               WHERE p.shop_id = s.id AND p.role::text IN ('barber', 'shop_admin') AND p.is_public) AS n_staff
      FROM base b
      JOIN public.shops s ON s.id = b.shop_id
      LEFT JOIN public.areas a ON a.id = s.area_id
      LEFT JOIN public.cities c ON c.id = s.city_id
    ),
    text_match AS (
      SELECT sh.shop_id,
             count(*) FILTER (WHERE sh.n_name LIKE '%' || t || '%')::float8 / greatest(cardinality(v_terms), 1) AS name_s,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM hits h WHERE h.shop_id = sh.shop_id AND h.term = t))::float8
               / greatest(cardinality(v_terms), 1) AS svc_s,
             count(*) FILTER (WHERE coalesce(sh.n_staff, '') LIKE '%' || t || '%')::float8 / greatest(cardinality(v_terms), 1) AS staff_s,
             count(*) FILTER (WHERE coalesce(sh.n_place, '') LIKE '%' || t || '%')::float8 / greatest(cardinality(v_terms), 1) AS place_s,
             bool_and(sh.n_name LIKE '%' || t || '%'
                      OR EXISTS (SELECT 1 FROM hits h WHERE h.shop_id = sh.shop_id AND h.term = t)
                      OR coalesce(sh.n_staff, '') LIKE '%' || t || '%'
                      OR coalesce(sh.n_place, '') LIKE '%' || t || '%') AS all_hit,
             max(similarity(sh.n_name, v_q)) AS fuzzy
      FROM shop sh CROSS JOIN unnest(v_terms) t
      GROUP BY sh.shop_id
    ),
    svc AS (
      SELECT sv.shop_id, sv.id, sv.name, sv.name_ar, sv.duration, sv.price_type, sv.online_bookable,
             sv.location_type, sv.sort_order,
             CASE WHEN sv.price_type = 'free' THEN 0 ELSE sv.price END AS eff_price,
             EXISTS (SELECT 1 FROM hits h WHERE h.service_id = sv.id) AS hit
      FROM public.services sv
      WHERE sv.shop_id IN (SELECT b.shop_id FROM base b) AND sv.is_active IS TRUE
    ),
    svc_agg AS (
      SELECT sv.shop_id,
             count(*)::int AS n,
             bool_or(sv.hit) AS any_hit,
             min(sv.eff_price) FILTER (WHERE sv.hit) AS min_hit,
             min(sv.eff_price) AS min_all
      FROM svc sv GROUP BY sv.shop_id
    ),
    rating AS (
      SELECT rv.shop_id, avg(rv.rating)::numeric AS avg, count(*)::int AS cnt
      FROM public.reviews rv
      WHERE rv.shop_id IN (SELECT b.shop_id FROM base b)
      GROUP BY rv.shop_id
    ),
    ranked AS (
      SELECT sh.*, sa.n AS svc_n,
             CASE WHEN sa.any_hit THEN sa.min_hit ELSE sa.min_all END AS min_price,
             sa.any_hit,
             rt.avg AS r_avg, coalesce(rt.cnt, 0) AS r_cnt,
             -- Bayesian rating (prior 4.0 over 5 reviews), 0..5
             (coalesce(rt.avg, 0) * coalesce(rt.cnt, 0) + 4.0 * 5) / (coalesce(rt.cnt, 0) + 5) AS bayes,
             tm.name_s, tm.svc_s, tm.staff_s, tm.place_s, tm.all_hit, tm.fuzzy
      FROM shop sh
      JOIN svc_agg sa ON sa.shop_id = sh.shop_id
      LEFT JOIN rating rt ON rt.shop_id = sh.shop_id
      LEFT JOIN text_match tm ON tm.shop_id = sh.shop_id
      WHERE (cardinality(v_terms) = 0 OR tm.all_hit OR coalesce(tm.fuzzy, 0) >= 0.35)
    ),
    scored AS (
      SELECT rk.*,
             ( CASE WHEN cardinality(v_terms) = 0 THEN 0
                    ELSE 3 * coalesce(rk.name_s, 0) + 2 * coalesce(rk.svc_s, 0)
                       + 1.5 * coalesce(rk.staff_s, 0) + coalesce(rk.place_s, 0)
                       + 2 * greatest(coalesce(rk.fuzzy, 0) - 0.3, 0) END
             + CASE WHEN rk.distance_km IS NULL THEN 0 ELSE 2 * exp(-rk.distance_km / 5.0) END
             + 1.5 * (rk.bayes::float8 / 5) * least(1, ln(1 + rk.r_cnt) / ln(51))
             + CASE WHEN rk.works_today THEN 1 ELSE 0 END
             + 0.15 * ((rk.cover_url IS NOT NULL)::int + rk.has_photos::int + rk.has_desc::int
                       + (rk.lat IS NOT NULL)::int + (coalesce(btrim(rk.name_ar), '') <> '')::int)
             + CASE WHEN rk.is_verified THEN 0.5 ELSE 0 END
             )::float8 AS sc
      FROM ranked rk
      WHERE (v_pmin IS NULL OR rk.min_price >= v_pmin)
        AND (v_pmax IS NULL OR rk.min_price <= v_pmax)
    )
    SELECT sc.*,
           count(*) OVER ()::int AS total,
           (SELECT coalesce(jsonb_agg(jsonb_build_object(
                      'id', x.id, 'name', x.name, 'name_ar', x.name_ar, 'price', x.eff_price,
                      'price_type', x.price_type, 'duration', x.duration) ORDER BY x.ord), '[]'::jsonb)
              FROM (SELECT sv.*, row_number() OVER (ORDER BY sv.hit DESC, sv.eff_price, sv.sort_order) AS ord
                      FROM svc sv
                     WHERE sv.shop_id = sc.shop_id AND (NOT sc.any_hit OR sv.hit)
                     ORDER BY sv.hit DESC, sv.eff_price, sv.sort_order
                     LIMIT 3) x) AS top3,
           (SELECT sv.id FROM svc sv
             WHERE sv.shop_id = sc.shop_id AND sv.online_bookable AND sv.location_type = 'in_shop'
             ORDER BY sv.hit DESC, sv.eff_price, sv.sort_order LIMIT 1) AS slot_service
      FROM scored sc
     ORDER BY
       CASE WHEN v_sort = 'nearest' THEN coalesce(sc.distance_km, 1e9) END ASC,
       CASE WHEN v_sort = 'top_rated' THEN sc.bayes END DESC,
       CASE WHEN v_sort = 'top_rated' THEN sc.r_cnt END DESC,
       CASE WHEN v_sort = 'lowest_price' THEN sc.min_price END ASC,
       sc.sc DESC,
       sc.name ASC,
       sc.shop_id ASC
  LOOP
    -- Static filters only: skip straight to the page.
    IF NOT v_dynamic AND v_passed < v_offset THEN
      v_passed := v_passed + 1;
      CONTINUE;
    END IF;

    v_tz := r.tz;
    open_until := NULL;
    next_slot_start := NULL;
    next_slot_local_date := NULL;
    next_slot_local_time := NULL;

    IF v_dynamic THEN
      v_checked := v_checked + 1;
      EXIT WHEN v_checked > 150;
    END IF;

    open_until := public.search_open_until(r.shop_id, v_tz);
    IF v_open_f AND open_until IS NULL THEN
      CONTINUE;
    END IF;

    IF r.slot_service IS NOT NULL THEN
      IF v_avail_f THEN
        v_after := greatest(now(), (v_date + coalesce(v_from, '00:00'::time)) AT TIME ZONE v_tz);
        v_before := CASE WHEN v_to IS NULL THEN ((v_date + 1)::timestamp AT TIME ZONE v_tz)
                         ELSE (v_date + v_to) AT TIME ZONE v_tz END;
      ELSE
        v_after := NULL;
        v_before := NULL;
      END IF;
      BEGIN
        SELECT n.start_time, n.local_date, n.local_time INTO s
          FROM public.next_available_slot(r.shop_id, jsonb_build_array(r.slot_service), NULL, v_after) n
         LIMIT 1;
        next_slot_start := s.start_time;
        next_slot_local_date := s.local_date;
        next_slot_local_time := s.local_time;
      EXCEPTION WHEN others THEN
        next_slot_start := NULL;
      END;
    END IF;

    IF v_avail_f AND (next_slot_start IS NULL OR next_slot_start >= v_before) THEN
      CONTINUE;
    END IF;

    IF v_dynamic AND v_passed < v_offset THEN
      v_passed := v_passed + 1;
      CONTINUE;
    END IF;

    id := r.shop_id;
    slug := r.slug;
    slug_ar := r.slug_ar;
    name := r.name;
    name_ar := r.name_ar;
    cover_url := r.cover_url;
    logo_url := r.logo_url;
    is_verified := r.is_verified;
    area_name_en := r.area_en;
    area_name_ar := r.area_ar;
    city_name_en := r.city_en;
    city_name_ar := r.city_ar;
    lat := r.lat;
    lng := r.lng;
    distance_km := round(r.distance_km::numeric, 2)::float8;
    rating_avg := round(r.r_avg, 2);
    rating_count := r.r_cnt;
    min_price := r.min_price;
    currency := r.currency;
    services_count := r.svc_n;
    matched_services := r.top3;
    open_now := open_until IS NOT NULL;
    badges := array_remove(ARRAY[
      CASE WHEN r.is_verified THEN 'verified' END,
      CASE WHEN r.r_cnt >= 10 AND r.bayes >= 4.6 THEN 'top_rated' END,
      CASE WHEN r.published_at > now() - interval '30 days' THEN 'new' END,
      CASE WHEN r.has_home THEN 'home_service' END,
      CASE WHEN r.has_kids THEN 'kids' END
    ], NULL);
    score := round(r.sc::numeric, 4)::float8;
    total_count := CASE WHEN v_dynamic THEN NULL ELSE r.total END;
    RETURN NEXT;

    v_emitted := v_emitted + 1;
    EXIT WHEN v_emitted >= v_limit;
  END LOOP;
END;
$$;

-- ─── search_barbers ─────────────────────────────────────────────────────────
-- Public barbers (profiles.is_public, role barber/shop_admin, online bookable)
-- of searchable shops. Same location/facet filters as search_shops; text
-- matches the barber's name, handle, title, shop name, area and the services
-- they offer. available_today / date / time window use next_available_slot
-- with the barber preselected.
DROP FUNCTION IF EXISTS public.search_barbers(text, uuid, double precision, double precision, double precision,
  date, text, text, text, jsonb, integer, integer, uuid);

CREATE OR REPLACE FUNCTION public.search_barbers(
  p_q          text DEFAULT NULL,
  p_area_id    uuid DEFAULT NULL,
  p_lat        double precision DEFAULT NULL,
  p_lng        double precision DEFAULT NULL,
  p_radius_km  double precision DEFAULT NULL,
  p_date       date DEFAULT NULL,
  p_time_from  text DEFAULT NULL,
  p_time_to    text DEFAULT NULL,
  p_sort       text DEFAULT 'recommended',
  p_filters    jsonb DEFAULT '{}'::jsonb,
  p_limit      integer DEFAULT 20,
  p_offset     integer DEFAULT 0,
  p_city_id    uuid DEFAULT NULL
) RETURNS TABLE (
  id                   uuid,
  handle               text,
  full_name            text,
  avatar_url           text,
  title_en             text,
  title_ar             text,
  years_experience     smallint,
  languages            text[],
  shop_id              uuid,
  shop_slug            text,
  shop_slug_ar         text,
  shop_name            text,
  shop_name_ar         text,
  shop_is_verified     boolean,
  area_name_en         text,
  area_name_ar         text,
  city_name_en         text,
  city_name_ar         text,
  lat                  double precision,
  lng                  double precision,
  distance_km          double precision,
  rating_avg           numeric,
  rating_count         integer,
  min_price            numeric,
  currency             text,
  matched_services     jsonb,
  next_slot_start      timestamptz,
  next_slot_local_date date,
  next_slot_local_time text,
  score                double precision,
  total_count          integer
)
LANGUAGE plpgsql VOLATILE SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
#variable_conflict use_column
DECLARE
  v_terms     text[] := public.search_terms(p_q);
  v_q         text := public.search_normalize(left(coalesce(p_q, ''), 120));
  v_f         jsonb := CASE WHEN jsonb_typeof(p_filters) = 'object' THEN p_filters ELSE '{}'::jsonb END;
  v_sort      text := CASE WHEN p_sort IN ('recommended', 'nearest', 'top_rated', 'lowest_price') THEN p_sort ELSE 'recommended' END;
  v_limit     int := least(greatest(coalesce(p_limit, 20), 1), 48);
  v_offset    int := least(greatest(coalesce(p_offset, 0), 0), 2000);
  v_pmin      numeric;
  v_pmax      numeric;
  v_avail_f   boolean;
  v_from      time;
  v_to        time;
  v_date      date := p_date;
  v_passed    int := 0;
  v_emitted   int := 0;
  v_checked   int := 0;
  v_after     timestamptz;
  v_before    timestamptz;
  r           record;
  s           record;
BEGIN
  IF NOT public.search_rate_ok('search') THEN
    RAISE EXCEPTION 'RATE_LIMITED' USING ERRCODE = 'P0001';
  END IF;

  BEGIN
    v_pmin := nullif(v_f->>'price_min', '')::numeric;
    v_pmax := nullif(v_f->>'price_max', '')::numeric;
    IF p_time_from ~ '^\d{2}:\d{2}$' THEN v_from := p_time_from::time; END IF;
    IF p_time_to ~ '^\d{2}:\d{2}$' THEN v_to := CASE WHEN p_time_to = '24:00' THEN '23:59:59'::time ELSE p_time_to::time END; END IF;
  EXCEPTION WHEN others THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END;
  IF v_from IS NOT NULL AND v_to IS NOT NULL AND v_to <= v_from THEN
    v_to := NULL;
  END IF;
  IF v_date IS NOT NULL AND (v_date < (now() AT TIME ZONE 'Asia/Amman')::date - 1
                             OR v_date > (now() AT TIME ZONE 'Asia/Amman')::date + 365) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  v_avail_f := coalesce((v_f->>'available_today')::boolean, false) OR v_date IS NOT NULL
               OR v_from IS NOT NULL OR v_to IS NOT NULL;
  IF v_avail_f AND v_date IS NULL THEN
    v_date := (now() AT TIME ZONE 'Asia/Amman')::date;
  END IF;

  FOR r IN
    WITH base AS (
      SELECT * FROM public.search_shop_base(p_area_id, p_city_id, p_lat, p_lng, p_radius_km, v_f)
    ),
    hits AS (
      SELECT * FROM public.search_service_hits((SELECT array_agg(b.shop_id) FROM base b), v_terms)
      WHERE cardinality(v_terms) > 0
    ),
    staff AS (
      SELECT p.id AS pid, p.handle, p.full_name, p.avatar_url, p.title_en, p.title_ar, p.years_experience,
             p.languages, b.shop_id, b.distance_km, b.works_today,
             s.slug, s.slug_ar, s.name AS s_name, s.name_ar AS s_name_ar, s.is_verified, s.lat, s.lng,
             coalesce(s.currency, 'JOD') AS currency, coalesce(nullif(s.timezone, ''), 'Asia/Amman') AS tz,
             a.name_en AS area_en, a.name_ar AS area_ar, c.name_en AS city_en, c.name_ar AS city_ar,
             public.search_normalize(concat_ws(' ', p.full_name, p.handle, p.title_en, p.title_ar)) AS n_self,
             public.search_normalize(concat_ws(' ', s.name, s.name_ar, a.name_en, a.name_ar, c.name_en, c.name_ar)) AS n_shop
      FROM base b
      JOIN public.shops s ON s.id = b.shop_id
      JOIN public.profiles p ON p.shop_id = s.id
      LEFT JOIN public.areas a ON a.id = s.area_id
      LEFT JOIN public.cities c ON c.id = s.city_id
      WHERE p.role::text IN ('barber', 'shop_admin') AND p.is_public AND p.online_bookable IS NOT FALSE
        AND p.handle IS NOT NULL
    ),
    offers AS (
      -- Services a barber offers: their barber_services rows, or every active
      -- service of the shop when they have none (same rule as availability).
      SELECT st.pid, sv.id AS service_id, sv.name, sv.name_ar, sv.duration, sv.price_type, sv.sort_order,
             sv.online_bookable, sv.location_type,
             CASE WHEN sv.price_type = 'free' THEN 0 ELSE coalesce(bs.price_override, sv.price) END AS eff_price,
             EXISTS (SELECT 1 FROM hits h WHERE h.service_id = sv.id) AS hit
      FROM staff st
      JOIN public.services sv ON sv.shop_id = st.shop_id AND sv.is_active IS TRUE
      LEFT JOIN public.barber_services bs ON bs.barber_id = st.pid AND bs.service_id = sv.id
      WHERE bs.id IS NOT NULL AND bs.is_active IS NOT FALSE
         OR NOT EXISTS (SELECT 1 FROM public.barber_services b2 WHERE b2.barber_id = st.pid)
    ),
    text_match AS (
      SELECT st.pid,
             count(*) FILTER (WHERE st.n_self LIKE '%' || t || '%')::float8 / greatest(cardinality(v_terms), 1) AS self_s,
             count(*) FILTER (WHERE EXISTS (SELECT 1 FROM offers o JOIN hits h ON h.service_id = o.service_id
                                             WHERE o.pid = st.pid AND h.term = t))::float8 / greatest(cardinality(v_terms), 1) AS svc_s,
             bool_and(st.n_self LIKE '%' || t || '%'
                      OR st.n_shop LIKE '%' || t || '%'
                      OR EXISTS (SELECT 1 FROM offers o JOIN hits h ON h.service_id = o.service_id
                                  WHERE o.pid = st.pid AND h.term = t)) AS all_hit,
             max(similarity(st.n_self, v_q)) AS fuzzy
      FROM staff st CROSS JOIN unnest(v_terms) t
      GROUP BY st.pid
    ),
    agg AS (
      SELECT o.pid, bool_or(o.hit) AS any_hit,
             min(o.eff_price) FILTER (WHERE o.hit) AS min_hit, min(o.eff_price) AS min_all
      FROM offers o GROUP BY o.pid
    ),
    ranked AS (
      SELECT st.*, ag.any_hit,
             CASE WHEN ag.any_hit THEN ag.min_hit ELSE ag.min_all END AS min_price,
             rv.rating_avg AS r_avg, coalesce(rv.rating_count, 0) AS r_cnt,
             (coalesce(rv.rating_avg, 0) * coalesce(rv.rating_count, 0) + 4.0 * 5) / (coalesce(rv.rating_count, 0) + 5) AS bayes,
             tm.self_s, tm.svc_s, tm.fuzzy
      FROM staff st
      JOIN agg ag ON ag.pid = st.pid
      LEFT JOIN public.barber_rating_view rv ON rv.barber_id = st.pid AND rv.shop_id = st.shop_id
      LEFT JOIN text_match tm ON tm.pid = st.pid
      WHERE (cardinality(v_terms) = 0 OR tm.all_hit OR coalesce(tm.fuzzy, 0) >= 0.35)
    ),
    scored AS (
      SELECT rk.*,
             ( CASE WHEN cardinality(v_terms) = 0 THEN 0
                    ELSE 3 * coalesce(rk.self_s, 0) + 2 * coalesce(rk.svc_s, 0)
                       + 2 * greatest(coalesce(rk.fuzzy, 0) - 0.3, 0) END
             + CASE WHEN rk.distance_km IS NULL THEN 0 ELSE 2 * exp(-rk.distance_km / 5.0) END
             + 1.5 * (rk.bayes::float8 / 5) * least(1, ln(1 + rk.r_cnt) / ln(51))
             + 0.15 * ((rk.avatar_url IS NOT NULL)::int + (rk.title_en IS NOT NULL OR rk.title_ar IS NOT NULL)::int)
             + CASE WHEN rk.works_today THEN 1 ELSE 0 END
             + CASE WHEN rk.is_verified THEN 0.5 ELSE 0 END )::float8 AS sc
      FROM ranked rk
      WHERE (v_pmin IS NULL OR rk.min_price >= v_pmin)
        AND (v_pmax IS NULL OR rk.min_price <= v_pmax)
    )
    SELECT sc.*,
           count(*) OVER ()::int AS total,
           (SELECT coalesce(jsonb_agg(jsonb_build_object(
                      'id', x.service_id, 'name', x.name, 'name_ar', x.name_ar, 'price', x.eff_price,
                      'price_type', x.price_type, 'duration', x.duration) ORDER BY x.ord), '[]'::jsonb)
              FROM (SELECT o.*, row_number() OVER (ORDER BY o.hit DESC, o.eff_price, o.sort_order) AS ord
                      FROM offers o
                     WHERE o.pid = sc.pid AND (NOT sc.any_hit OR o.hit)
                     ORDER BY o.hit DESC, o.eff_price, o.sort_order
                     LIMIT 3) x) AS top3,
           (SELECT o.service_id FROM offers o
             WHERE o.pid = sc.pid AND o.online_bookable AND o.location_type = 'in_shop'
             ORDER BY o.hit DESC, o.eff_price, o.sort_order LIMIT 1) AS slot_service
      FROM scored sc
     ORDER BY
       CASE WHEN v_sort = 'nearest' THEN coalesce(sc.distance_km, 1e9) END ASC,
       CASE WHEN v_sort = 'top_rated' THEN sc.bayes END DESC,
       CASE WHEN v_sort = 'top_rated' THEN sc.r_cnt END DESC,
       CASE WHEN v_sort = 'lowest_price' THEN sc.min_price END ASC,
       sc.sc DESC,
       sc.full_name ASC,
       sc.pid ASC
  LOOP
    IF NOT v_avail_f AND v_passed < v_offset THEN
      v_passed := v_passed + 1;
      CONTINUE;
    END IF;
    IF v_avail_f THEN
      v_checked := v_checked + 1;
      EXIT WHEN v_checked > 150;
    END IF;

    next_slot_start := NULL;
    next_slot_local_date := NULL;
    next_slot_local_time := NULL;
    IF r.slot_service IS NOT NULL THEN
      IF v_avail_f THEN
        v_after := greatest(now(), (v_date + coalesce(v_from, '00:00'::time)) AT TIME ZONE r.tz);
        v_before := CASE WHEN v_to IS NULL THEN ((v_date + 1)::timestamp AT TIME ZONE r.tz)
                         ELSE (v_date + v_to) AT TIME ZONE r.tz END;
      ELSE
        v_after := NULL;
        v_before := NULL;
      END IF;
      BEGIN
        SELECT n.start_time, n.local_date, n.local_time INTO s
          FROM public.next_available_slot(r.shop_id, jsonb_build_array(r.slot_service), r.pid, v_after) n
         LIMIT 1;
        next_slot_start := s.start_time;
        next_slot_local_date := s.local_date;
        next_slot_local_time := s.local_time;
      EXCEPTION WHEN others THEN
        next_slot_start := NULL;
      END;
    END IF;

    IF v_avail_f AND (next_slot_start IS NULL OR next_slot_start >= v_before) THEN
      CONTINUE;
    END IF;
    IF v_avail_f AND v_passed < v_offset THEN
      v_passed := v_passed + 1;
      CONTINUE;
    END IF;

    id := r.pid;
    handle := r.handle;
    full_name := r.full_name;
    avatar_url := r.avatar_url;
    title_en := r.title_en;
    title_ar := r.title_ar;
    years_experience := r.years_experience;
    languages := r.languages;
    shop_id := r.shop_id;
    shop_slug := r.slug;
    shop_slug_ar := r.slug_ar;
    shop_name := r.s_name;
    shop_name_ar := r.s_name_ar;
    shop_is_verified := r.is_verified;
    area_name_en := r.area_en;
    area_name_ar := r.area_ar;
    city_name_en := r.city_en;
    city_name_ar := r.city_ar;
    lat := r.lat;
    lng := r.lng;
    distance_km := round(r.distance_km::numeric, 2)::float8;
    rating_avg := round(r.r_avg, 2);
    rating_count := r.r_cnt;
    min_price := r.min_price;
    currency := r.currency;
    matched_services := r.top3;
    score := round(r.sc::numeric, 4)::float8;
    total_count := CASE WHEN v_avail_f THEN NULL ELSE r.total END;
    RETURN NEXT;

    v_emitted := v_emitted + 1;
    EXIT WHEN v_emitted >= v_limit;
  END LOOP;
END;
$$;

-- ─── public_stats ───────────────────────────────────────────────────────────
-- Aggregates only (no rows, no names) for the home page band and the
-- "booked today" counter. NULL city = all of Jordan.
CREATE OR REPLACE FUNCTION public.public_stats(p_city_id uuid DEFAULT NULL)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH shops_v AS (
    SELECT s.id FROM public.shops s
    WHERE s.is_published AND s.marketplace_visible
      AND (p_city_id IS NULL OR s.city_id = p_city_id)
  ),
  day_start AS (
    SELECT ((now() AT TIME ZONE 'Asia/Amman')::date::timestamp AT TIME ZONE 'Asia/Amman') AS t
  )
  SELECT jsonb_build_object(
    'city_id', p_city_id,
    'shops', (SELECT count(*) FROM shops_v),
    'barbers', (SELECT count(*) FROM public.profiles p
                 WHERE p.shop_id IN (SELECT id FROM shops_v)
                   AND p.role::text IN ('barber', 'shop_admin') AND p.is_public),
    'areas', (SELECT count(DISTINCT s.area_id) FROM public.shops s WHERE s.id IN (SELECT id FROM shops_v)),
    'reviews', (SELECT count(*) FROM public.reviews r WHERE r.shop_id IN (SELECT id FROM shops_v)),
    'rating_avg', (SELECT round(avg(r.rating)::numeric, 2) FROM public.reviews r WHERE r.shop_id IN (SELECT id FROM shops_v)),
    'bookings_today', (SELECT count(*) FROM public.appointments a, day_start d
                        WHERE a.shop_id IN (SELECT id FROM shops_v)
                          AND a.created_at >= d.t
                          AND a.status <> 'cancelled'),
    'bookings_total', (SELECT count(*) FROM public.appointments a
                        WHERE a.shop_id IN (SELECT id FROM shops_v) AND a.status <> 'cancelled'),
    'generated_at', now()
  );
$$;

-- ─── public_recent_reviews ──────────────────────────────────────────────────
-- 4–5★ reviews with a comment from searchable shops. The reviewer is reduced
-- to a first name and an initial ("Ahmad K."); no client ids leave the DB.
CREATE OR REPLACE FUNCTION public.public_recent_reviews(p_city_id uuid DEFAULT NULL, p_limit integer DEFAULT 12)
RETURNS TABLE (
  id            uuid,
  rating        integer,
  comment       text,
  created_at    timestamptz,
  reviewer      text,
  shop_id       uuid,
  shop_slug     text,
  shop_slug_ar  text,
  shop_name     text,
  shop_name_ar  text,
  area_name_en  text,
  area_name_ar  text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.id, r.rating, left(btrim(r.comment), 280), r.created_at,
         CASE
           WHEN coalesce(btrim(r.reviewer_name), '') = '' THEN NULL
           WHEN array_length(regexp_split_to_array(btrim(r.reviewer_name), '\s+'), 1) = 1
             THEN left(btrim(r.reviewer_name), 24)
           ELSE left(split_part(btrim(r.reviewer_name), ' ', 1), 24) || ' '
                || left((regexp_split_to_array(btrim(r.reviewer_name), '\s+'))[
                     array_length(regexp_split_to_array(btrim(r.reviewer_name), '\s+'), 1)], 1) || '.'
         END,
         s.id, s.slug, s.slug_ar, s.name, s.name_ar, a.name_en, a.name_ar
  FROM public.reviews r
  JOIN public.shops s ON s.id = r.shop_id
  LEFT JOIN public.areas a ON a.id = s.area_id
  WHERE s.is_published AND s.marketplace_visible
    AND (p_city_id IS NULL OR s.city_id = p_city_id)
    AND r.rating >= 4
    AND length(btrim(coalesce(r.comment, ''))) >= 12
  ORDER BY r.created_at DESC
  LIMIT least(greatest(coalesce(p_limit, 12), 1), 24);
$$;

-- ─── get_book_again ─────────────────────────────────────────────────────────
-- The signed-in customer's recently completed visits, one row per published
-- shop, with the services and barber to preselect (only ones still bookable).
CREATE OR REPLACE FUNCTION public.get_book_again(p_limit integer DEFAULT 8)
RETURNS TABLE (
  shop_id       uuid,
  shop_slug     text,
  shop_slug_ar  text,
  shop_name     text,
  shop_name_ar  text,
  cover_url     text,
  last_visit    timestamptz,
  service_name  text,
  service_ids   uuid[],
  barber_id     uuid,
  barber_name   text
)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH mine AS (
    SELECT DISTINCT ON (a.shop_id) a.*
    FROM public.appointments a
    JOIN public.clients c ON c.id = a.client_id
    WHERE auth.uid() IS NOT NULL AND c.auth_user_id = auth.uid()
      AND a.status = 'completed'
    ORDER BY a.shop_id, a.start_time DESC
  )
  SELECT s.id, s.slug, s.slug_ar, s.name, s.name_ar, s.cover_url, m.start_time, m.service_name,
         coalesce((SELECT array_agg(sv.id ORDER BY u.ord)
                     FROM unnest(m.service_ids) WITH ORDINALITY u(sid, ord)
                     JOIN public.services sv ON sv.id = u.sid
                    WHERE sv.shop_id = s.id AND sv.is_active IS TRUE AND sv.online_bookable), '{}'::uuid[]),
         CASE WHEN p.id IS NOT NULL THEN p.id END,
         p.full_name
  FROM mine m
  JOIN public.shops s ON s.id = m.shop_id AND s.is_published
  LEFT JOIN public.profiles p
    ON p.id = m.barber_id AND p.shop_id = s.id
   AND p.role::text IN ('barber', 'shop_admin') AND p.online_bookable IS NOT FALSE AND p.is_public
  ORDER BY m.start_time DESC
  LIMIT least(greatest(coalesce(p_limit, 8), 1), 20);
$$;

-- ─── Grants ─────────────────────────────────────────────────────────────────
REVOKE ALL ON FUNCTION public.search_distance_km(double precision, double precision, double precision, double precision) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_normalize(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_terms(text) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_rate_ok(text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_open_until(uuid, text) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_shop_base(uuid, uuid, double precision, double precision, double precision, jsonb) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_service_hits(uuid[], text[]) FROM PUBLIC, anon, authenticated;
REVOKE ALL ON FUNCTION public.search_shops(text, uuid, double precision, double precision, double precision, date, text, text, text, jsonb, integer, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.search_barbers(text, uuid, double precision, double precision, double precision, date, text, text, text, jsonb, integer, integer, uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_stats(uuid) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.public_recent_reviews(uuid, integer) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.get_book_again(integer) FROM PUBLIC, anon;

-- Pure helpers are harmless to expose (used by tests / future area pages).
GRANT EXECUTE ON FUNCTION public.search_distance_km(double precision, double precision, double precision, double precision) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_normalize(text) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_terms(text) TO anon, authenticated, service_role;
-- Internal building blocks: service_role only.
GRANT EXECUTE ON FUNCTION public.search_rate_ok(text) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_open_until(uuid, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_shop_base(uuid, uuid, double precision, double precision, double precision, jsonb) TO service_role;
GRANT EXECUTE ON FUNCTION public.search_service_hits(uuid[], text[]) TO service_role;
-- Public endpoints.
GRANT EXECUTE ON FUNCTION public.search_shops(text, uuid, double precision, double precision, double precision, date, text, text, text, jsonb, integer, integer, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.search_barbers(text, uuid, double precision, double precision, double precision, date, text, text, text, jsonb, integer, integer, uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_stats(uuid) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.public_recent_reviews(uuid, integer) TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.get_book_again(integer) TO authenticated, service_role;
