-- ═══════════════════════════════════════════════════════════════════════
-- WS-1A · Shop profile media, barbers and publishing
--
--   1. Barber profile fields on public.profiles (staff live on profiles; the
--      legacy public.barbers table is unused, same decision as P0V):
--      title_en/ar, bio_en/ar, languages, handle (unique, auto-generated),
--      years_experience, is_public.
--   2. shop_photos      — ordered gallery, bilingual alt, blur placeholder.
--   3. portfolio_items  — per-barber work, optional service link, featured.
--   4. amenities lookup (seeded) + shop_amenities.
--   5. barber_rating_view (reviews → appointments.barber_id) and
--      get_barber_reviews() for the public barber page.
--   6. Publish checklist: shop_publish_missing(), get_shop_publish_checklist()
--      and a guard so a non-privileged caller cannot publish an incomplete
--      shop.
--   7. Storage bucket shop-media (public read, staff write by folder).
--
-- File version 20250101002010 because 20250101002000 is already taken by
-- gate0_booking_engine.sql (Supabase versions must be unique).
--
-- Idempotent (IF NOT EXISTS / CREATE OR REPLACE / DROP … IF EXISTS / ON
-- CONFLICT). Safe on production data: all new columns are nullable or have
-- defaults, CHECKs on profiles are added NOT VALID then validated only after
-- the backfill wrote conforming values.
-- ═══════════════════════════════════════════════════════════════════════

-- ─── 1. Barber profile fields ──────────────────────────────────────────
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS title_en         text,
  ADD COLUMN IF NOT EXISTS title_ar         text,
  ADD COLUMN IF NOT EXISTS bio_en           text,
  ADD COLUMN IF NOT EXISTS bio_ar           text,
  ADD COLUMN IF NOT EXISTS languages        text[] NOT NULL DEFAULT '{}'::text[],
  ADD COLUMN IF NOT EXISTS handle           text,
  ADD COLUMN IF NOT EXISTS years_experience smallint,
  ADD COLUMN IF NOT EXISTS is_public        boolean NOT NULL DEFAULT true;

ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_handle_format;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_handle_format
  CHECK (handle IS NULL OR (handle ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(handle) BETWEEN 2 AND 48)) NOT VALID;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_years_experience_range;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_years_experience_range
  CHECK (years_experience IS NULL OR years_experience BETWEEN 0 AND 70) NOT VALID;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_public_text_len;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_public_text_len
  CHECK (coalesce(length(title_en), 0) <= 80 AND coalesce(length(title_ar), 0) <= 80
     AND coalesce(length(bio_en), 0) <= 1200 AND coalesce(length(bio_ar), 0) <= 1200
     AND coalesce(array_length(languages, 1), 0) <= 12) NOT VALID;

CREATE UNIQUE INDEX IF NOT EXISTS profiles_handle_key ON public.profiles (handle) WHERE handle IS NOT NULL;

-- Unique handle: base, base-2, base-3 … (ignores the profile's own row).
CREATE OR REPLACE FUNCTION public.profile_unique_handle(p_base text, p_profile_id uuid)
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_base text := left(rtrim(coalesce(p_base, ''), '-'), 40);
  v_try  text;
  n      int := 1;
BEGIN
  IF v_base IS NULL OR length(v_base) < 2 THEN
    v_base := 'barber-' || left(replace(coalesce(p_profile_id, gen_random_uuid())::text, '-', ''), 6);
  END IF;
  v_try := v_base;
  LOOP
    EXIT WHEN NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.handle = v_try AND p.id IS DISTINCT FROM p_profile_id);
    n := n + 1;
    v_try := rtrim(left(v_base, 44), '-') || '-' || n;
  END LOOP;
  RETURN v_try;
END;
$$;
REVOKE ALL ON FUNCTION public.profile_unique_handle(text, uuid) FROM PUBLIC, anon, authenticated;

-- Normalise / generate the handle for staff rows. Invoker trigger: the
-- caller's RLS already decided whether they may write this row.
CREATE OR REPLACE FUNCTION public.profiles_handle_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  NEW.handle := NULLIF(btrim(lower(NEW.handle)), '');
  IF NEW.handle IS NOT NULL THEN
    NEW.handle := public.slugify_latin(NEW.handle);
    IF NEW.handle IS NULL OR length(NEW.handle) < 2 THEN
      RAISE EXCEPTION 'INVALID_HANDLE' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.profiles p WHERE p.handle = NEW.handle AND p.id <> NEW.id) THEN
      RAISE EXCEPTION 'HANDLE_TAKEN' USING ERRCODE = 'P0001';
    END IF;
  ELSIF NEW.shop_id IS NOT NULL AND NEW.role::text IN ('barber', 'shop_admin') THEN
    NEW.handle := public.profile_unique_handle(public.slugify_latin(NEW.full_name), NEW.id);
  END IF;
  IF NEW.languages IS NOT NULL THEN
    NEW.languages := ARRAY(SELECT DISTINCT lower(btrim(l)) FROM unnest(NEW.languages) l WHERE btrim(l) ~ '^[A-Za-z]{2,3}$');
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS profiles_handle_defaults ON public.profiles;
CREATE TRIGGER profiles_handle_defaults
  BEFORE INSERT OR UPDATE OF handle, full_name, role, shop_id, languages ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.profiles_handle_defaults();

-- Backfill handles for existing staff (oldest keeps the plain handle).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, full_name FROM public.profiles
           WHERE handle IS NULL AND shop_id IS NOT NULL AND role::text IN ('barber', 'shop_admin')
           ORDER BY created_at NULLS LAST, id LOOP
    UPDATE public.profiles
       SET handle = public.profile_unique_handle(public.slugify_latin(r.full_name), r.id)
     WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_handle_format;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_years_experience_range;
ALTER TABLE public.profiles VALIDATE CONSTRAINT profiles_public_text_len;

-- Public barber card columns (phone etc. stay private).
GRANT SELECT (title_en, title_ar, bio_en, bio_ar, languages, handle, years_experience, is_public)
  ON public.profiles TO anon, authenticated;
GRANT UPDATE (title_en, title_ar, bio_en, bio_ar, languages, handle, years_experience, is_public)
  ON public.profiles TO authenticated;
-- RLS already limits UPDATE to self or a shop admin of the same shop.


-- ─── helper: is the shop publicly visible? ─────────────────────────────
CREATE OR REPLACE FUNCTION public.shop_is_public(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.shops s WHERE s.id = p_shop_id AND s.is_published);
$$;
REVOKE ALL ON FUNCTION public.shop_is_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.shop_is_public(uuid) TO anon, authenticated, service_role;

-- Same shop + staff, or same shop + admin (no-arg helpers from 001600).
CREATE OR REPLACE FUNCTION public.is_staff_of_shop(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_shop_id IS NOT NULL AND p_shop_id = public.get_current_shop_id() AND public.is_shop_staff();
$$;
REVOKE ALL ON FUNCTION public.is_staff_of_shop(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_staff_of_shop(uuid) TO authenticated, service_role;

CREATE OR REPLACE FUNCTION public.is_admin_of_shop(p_shop_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_shop_id IS NOT NULL AND p_shop_id = public.get_current_shop_id() AND public.is_shop_admin();
$$;
REVOKE ALL ON FUNCTION public.is_admin_of_shop(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.is_admin_of_shop(uuid) TO authenticated, service_role;


-- ─── 2. shop_photos ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.shop_photos (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  path        text NOT NULL,
  sort_order  integer NOT NULL DEFAULT 0,
  alt_en      text,
  alt_ar      text,
  width       integer,
  height      integer,
  blur_data   text,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT shop_photos_path_in_shop CHECK (path LIKE shop_id::text || '/%' AND path !~ '\.\.' AND length(path) <= 300),
  CONSTRAINT shop_photos_alt_len CHECK (coalesce(length(alt_en), 0) <= 200 AND coalesce(length(alt_ar), 0) <= 200),
  CONSTRAINT shop_photos_blur_len CHECK (blur_data IS NULL OR (blur_data LIKE 'data:image/%' AND length(blur_data) <= 4000)),
  CONSTRAINT shop_photos_dims CHECK ((width IS NULL OR width BETWEEN 1 AND 20000) AND (height IS NULL OR height BETWEEN 1 AND 20000))
);
CREATE INDEX IF NOT EXISTS idx_shop_photos_shop_sort ON public.shop_photos (shop_id, sort_order, created_at);

ALTER TABLE public.shop_photos ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_photos_select_public ON public.shop_photos;
CREATE POLICY shop_photos_select_public ON public.shop_photos FOR SELECT TO anon, authenticated
  USING (public.shop_is_public(shop_id));
DROP POLICY IF EXISTS shop_photos_select_staff ON public.shop_photos;
CREATE POLICY shop_photos_select_staff ON public.shop_photos FOR SELECT TO authenticated
  USING (public.is_staff_of_shop(shop_id));
DROP POLICY IF EXISTS shop_photos_insert_admin ON public.shop_photos;
CREATE POLICY shop_photos_insert_admin ON public.shop_photos FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of_shop(shop_id));
DROP POLICY IF EXISTS shop_photos_update_admin ON public.shop_photos;
CREATE POLICY shop_photos_update_admin ON public.shop_photos FOR UPDATE TO authenticated
  USING (public.is_admin_of_shop(shop_id)) WITH CHECK (public.is_admin_of_shop(shop_id));
DROP POLICY IF EXISTS shop_photos_delete_admin ON public.shop_photos;
CREATE POLICY shop_photos_delete_admin ON public.shop_photos FOR DELETE TO authenticated
  USING (public.is_admin_of_shop(shop_id));

REVOKE ALL ON public.shop_photos FROM anon;
GRANT SELECT ON public.shop_photos TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.shop_photos TO authenticated;

DROP TRIGGER IF EXISTS set_updated_at ON public.shop_photos;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.shop_photos
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();


-- ─── 3. portfolio_items ────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.portfolio_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  barber_id   uuid REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id  uuid REFERENCES public.services(id) ON DELETE SET NULL,
  path        text NOT NULL,
  caption     text,
  caption_ar  text,
  sort_order  integer NOT NULL DEFAULT 0,
  is_featured boolean NOT NULL DEFAULT false,
  blur_data   text,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT portfolio_items_path_in_shop CHECK (path LIKE shop_id::text || '/%' AND path !~ '\.\.' AND length(path) <= 300),
  CONSTRAINT portfolio_items_caption_len CHECK (coalesce(length(caption), 0) <= 200 AND coalesce(length(caption_ar), 0) <= 200),
  CONSTRAINT portfolio_items_blur_len CHECK (blur_data IS NULL OR (blur_data LIKE 'data:image/%' AND length(blur_data) <= 4000))
);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_shop ON public.portfolio_items (shop_id, is_featured DESC, sort_order, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_portfolio_items_barber ON public.portfolio_items (barber_id, sort_order) WHERE barber_id IS NOT NULL;

-- The barber must belong to the item's shop.
CREATE OR REPLACE FUNCTION public.portfolio_items_guard()
RETURNS trigger
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.barber_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.profiles p WHERE p.id = NEW.barber_id AND p.shop_id = NEW.shop_id) THEN
    RAISE EXCEPTION 'BARBER_NOT_IN_SHOP' USING ERRCODE = 'P0001';
  END IF;
  IF NEW.service_id IS NOT NULL AND NOT EXISTS (
       SELECT 1 FROM public.services s WHERE s.id = NEW.service_id AND s.shop_id = NEW.shop_id) THEN
    RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.portfolio_items_guard() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS portfolio_items_guard ON public.portfolio_items;
CREATE TRIGGER portfolio_items_guard BEFORE INSERT OR UPDATE ON public.portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.portfolio_items_guard();
DROP TRIGGER IF EXISTS set_updated_at ON public.portfolio_items;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.portfolio_items
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

CREATE OR REPLACE FUNCTION public.barber_is_public(p_barber_id uuid)
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p_barber_id IS NULL OR EXISTS (
    SELECT 1 FROM public.profiles p WHERE p.id = p_barber_id AND p.is_public AND p.role::text IN ('barber', 'shop_admin'));
$$;
REVOKE ALL ON FUNCTION public.barber_is_public(uuid) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.barber_is_public(uuid) TO anon, authenticated, service_role;

ALTER TABLE public.portfolio_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS portfolio_items_select_public ON public.portfolio_items;
CREATE POLICY portfolio_items_select_public ON public.portfolio_items FOR SELECT TO anon, authenticated
  USING (public.shop_is_public(shop_id) AND public.barber_is_public(barber_id));
DROP POLICY IF EXISTS portfolio_items_select_staff ON public.portfolio_items;
CREATE POLICY portfolio_items_select_staff ON public.portfolio_items FOR SELECT TO authenticated
  USING (public.is_staff_of_shop(shop_id));
-- Admin writes any item of the shop; a barber writes items credited to self.
DROP POLICY IF EXISTS portfolio_items_insert_staff ON public.portfolio_items;
CREATE POLICY portfolio_items_insert_staff ON public.portfolio_items FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of_shop(shop_id)
              OR (public.is_staff_of_shop(shop_id) AND barber_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS portfolio_items_update_staff ON public.portfolio_items;
CREATE POLICY portfolio_items_update_staff ON public.portfolio_items FOR UPDATE TO authenticated
  USING (public.is_admin_of_shop(shop_id)
         OR (public.is_staff_of_shop(shop_id) AND barber_id = (SELECT auth.uid())))
  WITH CHECK (public.is_admin_of_shop(shop_id)
              OR (public.is_staff_of_shop(shop_id) AND barber_id = (SELECT auth.uid())));
DROP POLICY IF EXISTS portfolio_items_delete_staff ON public.portfolio_items;
CREATE POLICY portfolio_items_delete_staff ON public.portfolio_items FOR DELETE TO authenticated
  USING (public.is_admin_of_shop(shop_id)
         OR (public.is_staff_of_shop(shop_id) AND barber_id = (SELECT auth.uid())));

REVOKE ALL ON public.portfolio_items FROM anon;
GRANT SELECT ON public.portfolio_items TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.portfolio_items TO authenticated;


-- ─── 4. Amenities ──────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.amenities (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug       text NOT NULL UNIQUE CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name_en    text NOT NULL,
  name_ar    text NOT NULL,
  icon       text,
  sort       integer NOT NULL DEFAULT 0,
  is_active  boolean NOT NULL DEFAULT true,
  created_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.amenities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS amenities_select_all ON public.amenities;
CREATE POLICY amenities_select_all ON public.amenities FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS amenities_write_platform ON public.amenities;
CREATE POLICY amenities_write_platform ON public.amenities FOR ALL TO authenticated
  USING (public.is_platform_admin()) WITH CHECK (public.is_platform_admin());
REVOKE ALL ON public.amenities FROM anon;
GRANT SELECT ON public.amenities TO anon;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.amenities TO authenticated;

INSERT INTO public.amenities (slug, name_en, name_ar, icon, sort) VALUES
  ('wifi',             'Free Wi-Fi',            'واي فاي مجاني',          'wifi',            10),
  ('parking',          'Parking',               'موقف سيارات',            'car',             20),
  ('air-conditioning', 'Air conditioning',      'تكييف',                  'snowflake',       30),
  ('card-payment',     'Card payment',          'الدفع بالبطاقة',         'credit-card',     40),
  ('cliq',             'CliQ payment',          'الدفع عبر كليك',         'smartphone',      50),
  ('walk-ins',         'Walk-ins welcome',      'نستقبل بدون موعد',       'door-open',       60),
  ('kids-friendly',    'Kids friendly',         'مناسب للأطفال',          'baby',            70),
  ('wheelchair',       'Wheelchair accessible', 'مهيأ لذوي الإعاقة',      'accessibility',   80),
  ('coffee',           'Coffee & tea',          'قهوة وشاي',              'coffee',          90),
  ('gaming',           'Gaming console',        'بلايستيشن',              'gamepad-2',      100),
  ('quiet-hours',      'Quiet hours',           'ساعات هادئة',            'volume-x',       110),
  ('home-service',     'Home service',          'خدمة منزلية',            'house',          120)
ON CONFLICT (slug) DO NOTHING;

CREATE TABLE IF NOT EXISTS public.shop_amenities (
  shop_id    uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  amenity_id uuid NOT NULL REFERENCES public.amenities(id) ON DELETE CASCADE,
  created_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (shop_id, amenity_id)
);
CREATE INDEX IF NOT EXISTS idx_shop_amenities_amenity ON public.shop_amenities (amenity_id);
ALTER TABLE public.shop_amenities ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS shop_amenities_select_public ON public.shop_amenities;
CREATE POLICY shop_amenities_select_public ON public.shop_amenities FOR SELECT TO anon, authenticated
  USING (public.shop_is_public(shop_id));
DROP POLICY IF EXISTS shop_amenities_select_staff ON public.shop_amenities;
CREATE POLICY shop_amenities_select_staff ON public.shop_amenities FOR SELECT TO authenticated
  USING (public.is_staff_of_shop(shop_id));
DROP POLICY IF EXISTS shop_amenities_insert_admin ON public.shop_amenities;
CREATE POLICY shop_amenities_insert_admin ON public.shop_amenities FOR INSERT TO authenticated
  WITH CHECK (public.is_admin_of_shop(shop_id));
DROP POLICY IF EXISTS shop_amenities_delete_admin ON public.shop_amenities;
CREATE POLICY shop_amenities_delete_admin ON public.shop_amenities FOR DELETE TO authenticated
  USING (public.is_admin_of_shop(shop_id));
REVOKE ALL ON public.shop_amenities FROM anon;
GRANT SELECT ON public.shop_amenities TO anon;
GRANT SELECT, INSERT, DELETE ON public.shop_amenities TO authenticated;


-- ─── 5. Per-barber rating (derived; 2B stores it later) ────────────────
-- Owner-rights view on purpose: anon cannot read appointments, and the view
-- only exposes aggregates (no client, phone or appointment data).
DROP VIEW IF EXISTS public.barber_rating_view;
CREATE VIEW public.barber_rating_view AS
  SELECT a.barber_id,
         a.shop_id,
         round(avg(r.rating)::numeric, 2) AS rating_avg,
         count(*)::int                    AS rating_count
    FROM public.reviews r
    JOIN public.appointments a ON a.id = r.appointment_id
   WHERE a.barber_id IS NOT NULL
     AND r.rating BETWEEN 1 AND 5
   GROUP BY a.barber_id, a.shop_id;
REVOKE ALL ON public.barber_rating_view FROM PUBLIC, anon, authenticated;
GRANT SELECT ON public.barber_rating_view TO anon, authenticated, service_role;

-- Latest reviews for one public barber of a published shop (staff may
-- preview their own shop). Returns no client identifiers.
CREATE OR REPLACE FUNCTION public.get_barber_reviews(p_barber_id uuid, p_limit int DEFAULT 12)
RETURNS TABLE (id uuid, rating int, comment text, created_at timestamptz, reviewer_name text, service_name text, service_name_ar text)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT r.id, r.rating, r.comment, r.created_at, r.reviewer_name,
         sv.name, sv.name_ar
    FROM public.reviews r
    JOIN public.appointments a ON a.id = r.appointment_id
    JOIN public.profiles p     ON p.id = a.barber_id
    LEFT JOIN public.services sv ON sv.id = a.service_ids[1]
   WHERE a.barber_id = p_barber_id
     AND ((p.is_public AND public.shop_is_public(a.shop_id)) OR public.is_staff_of_shop(a.shop_id))
   ORDER BY r.created_at DESC
   LIMIT least(greatest(coalesce(p_limit, 12), 1), 50);
$$;
REVOKE ALL ON FUNCTION public.get_barber_reviews(uuid, int) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.get_barber_reviews(uuid, int) TO anon, authenticated, service_role;


-- ─── 6. Publish checklist ──────────────────────────────────────────────
-- Full checklist for the owner UI. Required items gate publishing;
-- recommended items only raise the score.
CREATE OR REPLACE FUNCTION public.shop_publish_checklist_internal(p_shop_id uuid)
RETURNS jsonb
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  WITH s AS (SELECT * FROM public.shops WHERE id = p_shop_id),
  staff AS (SELECT p.* FROM public.profiles p
             WHERE p.shop_id = p_shop_id AND p.role::text IN ('barber', 'shop_admin'))
  SELECT jsonb_build_object(
    'name',        (SELECT coalesce(btrim(name), '') <> '' FROM s),
    'services',    EXISTS (SELECT 1 FROM public.services sv WHERE sv.shop_id = p_shop_id AND sv.is_active IS TRUE),
    'hours',       EXISTS (SELECT 1 FROM public.working_hours wh JOIN staff ON staff.id = wh.barber_id
                            WHERE wh.is_working IS TRUE),
    'location',    (SELECT (lat IS NOT NULL AND lng IS NOT NULL) OR coalesce(btrim(address), '') <> '' FROM s),
    'contact',     (SELECT coalesce(btrim(phone), '') <> '' OR coalesce(btrim(whatsapp), '') <> '' FROM s),
    'photos',      EXISTS (SELECT 1 FROM public.shop_photos ph WHERE ph.shop_id = p_shop_id),
    'description', (SELECT coalesce(btrim(description), '') <> '' OR coalesce(btrim(description_ar), '') <> '' FROM s),
    'bilingual',   (SELECT coalesce(btrim(name_ar), '') <> '' FROM s),
    'pin',         (SELECT lat IS NOT NULL AND lng IS NOT NULL FROM s),
    'team',        EXISTS (SELECT 1 FROM staff WHERE staff.avatar_url IS NOT NULL AND staff.is_public),
    'amenities',   EXISTS (SELECT 1 FROM public.shop_amenities sa WHERE sa.shop_id = p_shop_id),
    'portfolio',   EXISTS (SELECT 1 FROM public.portfolio_items pi WHERE pi.shop_id = p_shop_id)
  );
$$;
REVOKE ALL ON FUNCTION public.shop_publish_checklist_internal(uuid) FROM PUBLIC, anon, authenticated;

-- Missing REQUIRED items (empty array = publishable).
CREATE OR REPLACE FUNCTION public.shop_publish_missing(p_shop_id uuid)
RETURNS text[]
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  c jsonb;
  k text;
  missing text[] := '{}';
BEGIN
  IF NOT (public.is_staff_of_shop(p_shop_id) OR public.is_platform_admin()
          OR coalesce(auth.role(), '') = 'service_role') THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  c := public.shop_publish_checklist_internal(p_shop_id);
  FOREACH k IN ARRAY ARRAY['name', 'services', 'hours', 'location'] LOOP
    IF NOT coalesce((c ->> k)::boolean, false) THEN
      missing := missing || k;
    END IF;
  END LOOP;
  RETURN missing;
END;
$$;
REVOKE ALL ON FUNCTION public.shop_publish_missing(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.shop_publish_missing(uuid) TO authenticated, service_role;

-- Owner UI: checklist booleans + publish flags for the caller's shop.
CREATE OR REPLACE FUNCTION public.get_shop_publish_checklist(p_shop_id uuid)
RETURNS jsonb
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v jsonb;
BEGIN
  IF NOT (public.is_staff_of_shop(p_shop_id) OR public.is_platform_admin()) THEN
    RAISE EXCEPTION 'FORBIDDEN' USING ERRCODE = '42501';
  END IF;
  SELECT jsonb_build_object(
           'items', public.shop_publish_checklist_internal(p_shop_id),
           'is_published', s.is_published,
           'marketplace_visible', s.marketplace_visible,
           'published_at', s.published_at,
           'slug', s.slug)
    INTO v
    FROM public.shops s WHERE s.id = p_shop_id;
  IF v IS NULL THEN
    RAISE EXCEPTION 'SHOP_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  RETURN v;
END;
$$;
REVOKE ALL ON FUNCTION public.get_shop_publish_checklist(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_shop_publish_checklist(uuid) TO authenticated, service_role;

-- Guard: a non-privileged caller cannot flip is_published false → true while
-- a required item is missing. INVOKER so current_user is the caller's role;
-- SECURITY DEFINER wizards (1G) and the service role are privileged.
CREATE OR REPLACE FUNCTION public.shops_publish_guard()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_missing text[];
BEGIN
  IF NEW.is_published AND NOT coalesce(OLD.is_published, false)
     AND current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
    v_missing := public.shop_publish_missing(NEW.id);
    IF coalesce(array_length(v_missing, 1), 0) > 0 THEN
      RAISE EXCEPTION 'SHOP_INCOMPLETE' USING ERRCODE = 'P0001',
        DETAIL = array_to_string(v_missing, ',');
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS shops_publish_guard ON public.shops;
CREATE TRIGGER shops_publish_guard BEFORE UPDATE OF is_published ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.shops_publish_guard();


-- ─── 7. Storage: shop-media ────────────────────────────────────────────
-- Layout (first folder is always the shop id):
--   {shop_id}/photos/{uuid}.webp
--   {shop_id}/portfolio/{uuid}.webp                      (admin)
--   {shop_id}/barbers/{profile_id}/{uuid}.webp           (that barber or admin)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES ('shop-media', 'shop-media', true, 5242880,
        ARRAY['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
ON CONFLICT (id) DO UPDATE
  SET public = true,
      file_size_limit = EXCLUDED.file_size_limit,
      allowed_mime_types = EXCLUDED.allowed_mime_types;

-- Can the caller write object `p_name` in shop-media?
CREATE OR REPLACE FUNCTION public.can_write_shop_media(p_name text)
RETURNS boolean
LANGUAGE plpgsql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  parts   text[] := string_to_array(coalesce(p_name, ''), '/');
  v_shop  uuid;
BEGIN
  IF array_length(parts, 1) IS NULL OR array_length(parts, 1) < 3 OR p_name ~ '\.\.' THEN
    RETURN false;
  END IF;
  BEGIN
    v_shop := parts[1]::uuid;
  EXCEPTION WHEN invalid_text_representation THEN
    RETURN false;
  END;
  IF public.is_admin_of_shop(v_shop) THEN
    RETURN parts[2] IN ('photos', 'portfolio', 'barbers', 'brand');
  END IF;
  RETURN public.is_staff_of_shop(v_shop)
     AND parts[2] = 'barbers'
     AND array_length(parts, 1) >= 4
     AND parts[3] = auth.uid()::text;
END;
$$;
REVOKE ALL ON FUNCTION public.can_write_shop_media(text) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.can_write_shop_media(text) TO authenticated;

-- Public reads go through the public object URL (no SELECT policy needed),
-- so anon cannot list the bucket. Staff may list/read their own shop folder
-- (the storage API needs SELECT for update/remove).
DROP POLICY IF EXISTS shop_media_select_staff ON storage.objects;
CREATE POLICY shop_media_select_staff ON storage.objects FOR SELECT TO authenticated
  USING (bucket_id = 'shop-media'
         AND public.is_staff_of_shop(CASE WHEN (storage.foldername(name))[1] ~ '^[0-9a-f-]{36}$'
                                          THEN ((storage.foldername(name))[1])::uuid END));
DROP POLICY IF EXISTS shop_media_insert_staff ON storage.objects;
CREATE POLICY shop_media_insert_staff ON storage.objects FOR INSERT TO authenticated
  WITH CHECK (bucket_id = 'shop-media' AND public.can_write_shop_media(name));
DROP POLICY IF EXISTS shop_media_update_staff ON storage.objects;
CREATE POLICY shop_media_update_staff ON storage.objects FOR UPDATE TO authenticated
  USING (bucket_id = 'shop-media' AND public.can_write_shop_media(name))
  WITH CHECK (bucket_id = 'shop-media' AND public.can_write_shop_media(name));
DROP POLICY IF EXISTS shop_media_delete_staff ON storage.objects;
CREATE POLICY shop_media_delete_staff ON storage.objects FOR DELETE TO authenticated
  USING (bucket_id = 'shop-media' AND public.can_write_shop_media(name));
