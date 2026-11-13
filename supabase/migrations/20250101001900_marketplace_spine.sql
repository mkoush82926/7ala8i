-- ═══════════════════════════════════════════════════════════════════════════
-- WS-P0 · Marketplace spine (docs/FRESHA_PARITY_ROADMAP.md §4, Phase 0)
--
--   1. Text helpers: normalize_ar(), slugify_latin(), slugify_ar(), mask_phone()
--   2. Platform roles: profiles.platform_role (+ guard) and is_platform_admin()
--   3. Geography: cities, areas (6 cities, ~48 Amman areas)
--   4. Organizations + shops.organization_id NOT NULL (one org per shop)
--   5. New shops columns, slugs, publish flags, guards and public grants
--   6. Global service taxonomy: service_categories + services.category_id
--   7. Appointment status CHECK (sole owner) + overlap guard for new statuses
--   8. Rate limiting helpers (reuses check_rate_limit from 0016)
--   9. Search indexes (pg_trgm, GiST)
--  10. Function privileges
--
-- Idempotent and safe on production data:
--   * every column is added nullable or with a default existing rows satisfy;
--   * NOT NULL / CHECKs are only added after the backfill that satisfies them;
--   * seeds use ON CONFLICT; backfills only touch rows that still need them;
--   * no existing row, policy or grant is weakened (anon still cannot read
--     appointments, clients or any phone column).
-- ═══════════════════════════════════════════════════════════════════════════

-- ═══════════════════════════════════════════════════════════════════════════
-- 1. TEXT HELPERS (pure, IMMUTABLE, SECURITY INVOKER)
-- ═══════════════════════════════════════════════════════════════════════════

-- Arabic search normalisation: strips tashkeel/tatweel, unifies alef/ta
-- marbuta/alef maqsura, maps Arabic-Indic digits to Latin, lowercases Latin,
-- collapses whitespace. Used for synonym matching and search.
CREATE OR REPLACE FUNCTION public.normalize_ar(p text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT CASE WHEN p IS NULL THEN NULL ELSE
    btrim(regexp_replace(
      lower(translate(
        regexp_replace(p, '[ًٌٍَُِّْٰـ]', '', 'g'),
        'أإآٱةى٠١٢٣٤٥٦٧٨٩۰۱۲۳۴۵۶۷۸۹',
        'اااايه01234567890123456789')),
      '\s+', ' ', 'g'))
  END;
$$;

-- URL-safe ASCII slug ("ابو اسلام" → "abw-aslam", "The Classic Razor" →
-- "the-classic-razor"). Returns NULL when nothing usable remains.
CREATE OR REPLACE FUNCTION public.slugify_latin(p text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(btrim(left(btrim(regexp_replace(
           lower(translate(
             replace(replace(replace(replace(replace(replace(
               regexp_replace(COALESCE(p, ''), '[ءًٌٍَُِّْٰـ'']', '', 'g'),
               'ش', 'sh'), 'خ', 'kh'), 'ث', 'th'), 'ذ', 'dh'), 'غ', 'gh'), 'ظ', 'dh'),
             'ابتجحدرزسصضطعفقكلمنهويىةأإآؤئ٠١٢٣٤٥٦٧٨٩',
             'abtjhdrzssdtafqklmnhwyaaaiawy0123456789')),
           '[^a-z0-9]+', '-', 'g'), '-'), 60), '-'), '');
$$;

-- Arabic slug that keeps Arabic letters ("جبل عمّان" → "جبل-عمان").
CREATE OR REPLACE FUNCTION public.slugify_ar(p text)
RETURNS text
LANGUAGE sql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
  SELECT NULLIF(btrim(left(btrim(regexp_replace(
           lower(translate(regexp_replace(COALESCE(p, ''), '[ًٌٍَُِّْٰـ]', '', 'g'),
                           '٠١٢٣٤٥٦٧٨٩', '0123456789')),
           '[^0-9a-zء-ي]+', '-', 'g'), '-'), 80), '-'), '');
$$;

-- Masked phone for anything shown to people who must not see the full number
-- ("+962791112222" → "+962 7•••••222"). TS twin: src/lib/mask.ts (keep in sync).
CREATE OR REPLACE FUNCTION public.mask_phone(p text)
RETURNS text
LANGUAGE plpgsql IMMUTABLE PARALLEL SAFE
SET search_path = public, pg_temp
AS $$
DECLARE
  d    text := regexp_replace(translate(COALESCE(p, ''), '٠١٢٣٤٥٦٧٨٩', '0123456789'), '[^0-9]', '', 'g');
  head text := '';
  rest text;
BEGIN
  IF p IS NULL OR btrim(p) = '' THEN
    RETURN NULL;
  END IF;
  IF length(d) < 6 THEN
    RETURN '•••';
  END IF;
  IF d LIKE '00962%' THEN
    d := substr(d, 3);
  END IF;
  IF d LIKE '962%' AND length(d) >= 10 THEN
    head := '+962 ';
    rest := substr(d, 4);
  ELSE
    rest := d;
  END IF;
  RETURN head || left(rest, 1) || repeat('•', greatest(length(rest) - 4, 1)) || right(rest, 3);
END;
$$;

-- Best-effort client IP of the current PostgREST request (for per-IP rate
-- limits inside anon RPCs). NULL outside a REST request.
CREATE OR REPLACE FUNCTION public.request_ip()
RETURNS text
LANGUAGE plpgsql STABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  h   json;
  ip  text;
BEGIN
  BEGIN
    h := NULLIF(current_setting('request.headers', true), '')::json;
  EXCEPTION WHEN others THEN
    RETURN NULL;
  END;
  IF h IS NULL THEN
    RETURN NULL;
  END IF;
  ip := COALESCE(h->>'cf-connecting-ip', h->>'x-real-ip', split_part(COALESCE(h->>'x-forwarded-for', ''), ',', 1));
  ip := btrim(ip);
  RETURN CASE WHEN ip IS NULL OR ip = '' OR length(ip) > 64 THEN NULL ELSE ip END;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 2. PLATFORM ROLES
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS platform_role text;
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_platform_role_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_platform_role_check
  CHECK (platform_role IS NULL OR platform_role IN ('support', 'admin'));

-- Per-user digit preference (§2.9): auto = Arabic-Indic in ar, Latin in en.
ALTER TABLE public.profiles ADD COLUMN IF NOT EXISTS digit_preference text NOT NULL DEFAULT 'auto';
ALTER TABLE public.profiles DROP CONSTRAINT IF EXISTS profiles_digit_preference_check;
ALTER TABLE public.profiles ADD CONSTRAINT profiles_digit_preference_check
  CHECK (digit_preference IN ('auto', 'arab', 'latn'));

-- Users may read their own digit preference (column grant; row is limited by RLS).
GRANT SELECT (digit_preference) ON public.profiles TO authenticated;

-- platform_role is never self-service: only the service role / postgres may set it.
CREATE OR REPLACE FUNCTION public.guard_platform_role()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF (TG_OP = 'INSERT' AND NEW.platform_role IS NOT NULL)
     OR (TG_OP = 'UPDATE' AND NEW.platform_role IS DISTINCT FROM OLD.platform_role) THEN
    IF current_user NOT IN ('postgres', 'supabase_admin', 'service_role') THEN
      RAISE EXCEPTION 'FORBIDDEN: platform_role can only be changed by the platform' USING ERRCODE = '42501';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_platform_role ON public.profiles;
CREATE TRIGGER guard_platform_role BEFORE INSERT OR UPDATE OF platform_role ON public.profiles
  FOR EACH ROW EXECUTE FUNCTION public.guard_platform_role();

CREATE OR REPLACE FUNCTION public.current_platform_role()
RETURNS text
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT p.platform_role FROM public.profiles p WHERE p.id = auth.uid();
$$;

CREATE OR REPLACE FUNCTION public.is_platform_admin()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.platform_role = 'admin');
$$;

CREATE OR REPLACE FUNCTION public.is_platform_staff()
RETURNS boolean
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = auth.uid() AND p.platform_role IN ('support', 'admin'));
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 3. GEOGRAPHY
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.cities (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug_en     text NOT NULL,
  slug_ar     text NOT NULL,
  name_en     text NOT NULL,
  name_ar     text NOT NULL,
  governorate text NOT NULL,
  lat         double precision,
  lng         double precision,
  sort        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT cities_slug_en_key UNIQUE (slug_en),
  CONSTRAINT cities_slug_ar_key UNIQUE (slug_ar),
  CONSTRAINT cities_slug_en_format CHECK (slug_en ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);

CREATE TABLE IF NOT EXISTS public.areas (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  city_id     uuid NOT NULL REFERENCES public.cities(id) ON DELETE CASCADE,
  slug_en     text NOT NULL,
  slug_ar     text NOT NULL,
  name_en     text NOT NULL,
  name_ar     text NOT NULL,
  lat         double precision,
  lng         double precision,
  sort        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT areas_city_slug_en_key UNIQUE (city_id, slug_en),
  CONSTRAINT areas_city_slug_ar_key UNIQUE (city_id, slug_ar),
  CONSTRAINT areas_slug_en_format CHECK (slug_en ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  CONSTRAINT areas_lat_range CHECK (lat IS NULL OR lat BETWEEN -90 AND 90),
  CONSTRAINT areas_lng_range CHECK (lng IS NULL OR lng BETWEEN -180 AND 180)
);
CREATE INDEX IF NOT EXISTS idx_areas_city ON public.areas (city_id, sort);

ALTER TABLE public.cities ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.areas  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS cities_select_public ON public.cities;
CREATE POLICY cities_select_public ON public.cities FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS cities_write_platform ON public.cities;
CREATE POLICY cities_write_platform ON public.cities FOR ALL TO authenticated
  USING ((SELECT public.is_platform_admin())) WITH CHECK ((SELECT public.is_platform_admin()));

DROP POLICY IF EXISTS areas_select_public ON public.areas;
CREATE POLICY areas_select_public ON public.areas FOR SELECT TO anon, authenticated USING (true);
DROP POLICY IF EXISTS areas_write_platform ON public.areas;
CREATE POLICY areas_write_platform ON public.areas FOR ALL TO authenticated
  USING ((SELECT public.is_platform_admin())) WITH CHECK ((SELECT public.is_platform_admin()));

REVOKE ALL ON public.cities, public.areas FROM anon, authenticated;
GRANT SELECT ON public.cities, public.areas TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.cities, public.areas TO authenticated;  -- policy-gated (platform admin)

INSERT INTO public.cities (slug_en, slug_ar, name_en, name_ar, governorate, lat, lng, sort) VALUES
  ('amman',  'عمان',    'Amman',  'عمّان',    'Amman',  31.9539, 35.9106, 10),
  ('irbid',  'اربد',    'Irbid',  'إربد',     'Irbid',  32.5556, 35.8500, 20),
  ('zarqa',  'الزرقاء', 'Zarqa',  'الزرقاء',  'Zarqa',  32.0728, 36.0880, 30),
  ('aqaba',  'العقبة',  'Aqaba',  'العقبة',   'Aqaba',  29.5321, 35.0063, 40),
  ('salt',   'السلط',   'Salt',   'السلط',    'Balqa',  32.0392, 35.7272, 50),
  ('madaba', 'مادبا',   'Madaba', 'مادبا',    'Madaba', 31.7160, 35.7939, 60)
ON CONFLICT (slug_en) DO UPDATE
  SET name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar,
      governorate = EXCLUDED.governorate, lat = EXCLUDED.lat, lng = EXCLUDED.lng, sort = EXCLUDED.sort;

INSERT INTO public.areas (city_id, slug_en, slug_ar, name_en, name_ar, lat, lng, sort)
SELECT c.id, v.slug_en, public.slugify_ar(v.name_ar), v.name_en, v.name_ar, v.lat, v.lng, v.sort
FROM public.cities c
CROSS JOIN (VALUES
  ('abdoun',            'Abdoun',               'عبدون',            31.9445, 35.8840,  10),
  ('sweifieh',          'Sweifieh',             'الصويفية',          31.9560, 35.8610,  20),
  ('shmeisani',         'Shmeisani',            'الشميساني',         31.9700, 35.9010,  30),
  ('jabal-amman',       'Jabal Amman',          'جبل عمّان',         31.9520, 35.9170,  40),
  ('weibdeh',           'Weibdeh',              'اللويبدة',          31.9610, 35.9240,  50),
  ('khalda',            'Khalda',               'خلدا',              31.9990, 35.8400,  60),
  ('tla-al-ali',        'Tla Al-Ali',           'تلاع العلي',        32.0010, 35.8640,  70),
  ('dabouq',            'Dabouq',               'دابوق',             31.9930, 35.8160,  80),
  ('deir-ghbar',        'Deir Ghbar',           'دير غبار',          31.9560, 35.8470,  90),
  ('um-uthaina',        'Um Uthaina',           'أم أذينة',          31.9700, 35.8700, 100),
  ('rabieh',            'Al-Rabieh',            'الرابية',           31.9800, 35.8780, 110),
  ('gardens',           'Al-Gardens',           'الجاردنز',          31.9870, 35.8730, 120),
  ('jubeiha',           'Al-Jubeiha',           'الجبيهة',           32.0230, 35.8690, 130),
  ('abu-nseir',         'Abu Nseir',            'أبو نصير',          32.0600, 35.8800, 140),
  ('shafa-badran',      'Shafa Badran',         'شفا بدران',         32.0580, 35.9100, 150),
  ('sweileh',           'Sweileh',              'صويلح',             32.0230, 35.8400, 160),
  ('marj-al-hamam',     'Marj Al-Hamam',        'مرج الحمام',        31.8920, 35.8000, 170),
  ('tabarbour',         'Tabarbour',            'طبربور',            32.0050, 35.9400, 180),
  ('marka',             'Marka',                'ماركا',             31.9850, 35.9850, 190),
  ('hashmi-al-shamali', 'Al-Hashmi Al-Shamali', 'الهاشمي الشمالي',   31.9750, 35.9600, 200),
  ('jabal-al-hussein',  'Jabal Al-Hussein',     'جبل الحسين',        31.9720, 35.9180, 210),
  ('downtown',          'Downtown (Al-Balad)',  'وسط البلد',         31.9510, 35.9350, 220),
  ('jabal-al-nuzha',    'Jabal Al-Nuzha',       'جبل النزهة',        31.9830, 35.9330, 230),
  ('abdali',            'Al-Abdali',            'العبدلي',           31.9640, 35.9100, 240),
  ('ras-al-ain',        'Ras Al-Ain',           'رأس العين',         31.9440, 35.9260, 250),
  ('jabal-al-taj',      'Jabal Al-Taj',         'جبل التاج',         31.9500, 35.9550, 260),
  ('ashrafieh',         'Al-Ashrafieh',         'الأشرفية',          31.9410, 35.9380, 270),
  ('wadi-al-seer',      'Wadi Al-Seer',         'وادي السير',        31.9540, 35.8160, 280),
  ('bayader',           'Al-Bayader',           'البيادر',           31.9450, 35.8350, 290),
  ('um-al-summaq',      'Um Al-Summaq',         'أم السماق',         31.9850, 35.8500, 300),
  ('rawabi',            'Al-Rawabi',            'الروابي',           31.9750, 35.8630, 310),
  ('yadudah',           'Al-Yadudah',           'اليادودة',          31.8680, 35.9170, 320),
  ('muqabalain',        'Al-Muqabalain',        'المقابلين',         31.9150, 35.9250, 330),
  ('qweismeh',          'Al-Qweismeh',          'القويسمة',          31.9090, 35.9500, 340),
  ('jawa',              'Jawa',                 'جاوا',              31.8650, 35.9500, 350),
  ('khirbet-sooq',      'Khirbet Sooq',         'خريبة السوق',       31.8850, 35.9500, 360),
  ('abu-alanda',        'Abu Alanda',           'أبو علندا',         31.9050, 35.9800, 370),
  ('sahab',             'Sahab',                'سحاب',              31.8700, 36.0050, 380),
  ('naour',             'Naour',                'ناعور',             31.8750, 35.8260, 390),
  ('bnayyat',           'Al-Bnayyat',           'البنيات',           31.9050, 35.8650, 400),
  ('jandaweel',         'Al-Jandaweel',         'الجندويل',          31.9640, 35.8320, 410),
  ('kursi',             'Al-Kursi',             'الكرسي',            31.9740, 35.8350, 420),
  ('hummar',            'Al-Hummar',            'الحمر',             32.0000, 35.8100, 430),
  ('tareq',             'Tareq',                'طارق',              32.0040, 35.9600, 440),
  ('dahiet-al-rasheed', 'Dahiet Al-Rasheed',    'ضاحية الرشيد',      32.0150, 35.8800, 450),
  ('dahiet-al-yasmeen', 'Dahiet Al-Yasmeen',    'ضاحية الياسمين',    31.9210, 35.9100, 460),
  ('mecca-street',      'Mecca Street',         'شارع مكة',          31.9780, 35.8550, 470),
  ('seventh-circle',    '7th Circle',           'الدوار السابع',     31.9580, 35.8580, 480)
) AS v(slug_en, name_en, name_ar, lat, lng, sort)
WHERE c.slug_en = 'amman'
ON CONFLICT (city_id, slug_en) DO UPDATE
  SET name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar, slug_ar = EXCLUDED.slug_ar,
      lat = EXCLUDED.lat, lng = EXCLUDED.lng, sort = EXCLUDED.sort;

-- ═══════════════════════════════════════════════════════════════════════════
-- 4. ORGANIZATIONS (one per shop now; multi-branch UI is P3)
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.organizations (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.organizations ENABLE ROW LEVEL SECURITY;

ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS organization_id uuid;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint
                 WHERE conname = 'shops_organization_id_fkey' AND conrelid = 'public.shops'::regclass) THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_organization_id_fkey
      FOREIGN KEY (organization_id) REFERENCES public.organizations(id) ON DELETE RESTRICT;
  END IF;
END $$;

-- Backfill: one organization per existing shop (ids reused for traceability).
INSERT INTO public.organizations (id, name, created_at)
SELECT s.id, s.name, COALESCE(s.created_at, now())
FROM public.shops s
WHERE s.organization_id IS NULL
ON CONFLICT (id) DO NOTHING;

UPDATE public.shops s SET organization_id = s.id
WHERE s.organization_id IS NULL
  AND EXISTS (SELECT 1 FROM public.organizations o WHERE o.id = s.id);

ALTER TABLE public.shops ALTER COLUMN organization_id SET NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shops_organization ON public.shops (organization_id);

DROP TRIGGER IF EXISTS on_organizations_updated ON public.organizations;
CREATE TRIGGER on_organizations_updated BEFORE UPDATE ON public.organizations
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- Organization of the caller's shop (RLS helper; resolves shop → organization).
CREATE OR REPLACE FUNCTION public.get_current_organization_id()
RETURNS uuid
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.organization_id FROM public.shops s WHERE s.id = public.get_current_shop_id();
$$;

DROP POLICY IF EXISTS organizations_select_member ON public.organizations;
CREATE POLICY organizations_select_member ON public.organizations FOR SELECT TO authenticated
  USING (id = (SELECT public.get_current_organization_id()) AND (SELECT public.is_shop_staff()));
DROP POLICY IF EXISTS organizations_update_admin ON public.organizations;
CREATE POLICY organizations_update_admin ON public.organizations FOR UPDATE TO authenticated
  USING (id = (SELECT public.get_current_organization_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (id = (SELECT public.get_current_organization_id()) AND (SELECT public.is_shop_admin()));
-- No INSERT/DELETE: organizations are created by the shops trigger below.

REVOKE ALL ON public.organizations FROM anon, authenticated;
GRANT SELECT (id, name, created_at, updated_at) ON public.organizations TO authenticated;
GRANT UPDATE (name) ON public.organizations TO authenticated;

-- ═══════════════════════════════════════════════════════════════════════════
-- 5. SHOPS: marketplace columns
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
BEGIN
  -- Remember whether this is the first run, so the one-off publish backfill
  -- never re-publishes a shop its owner later unpublished.
  PERFORM set_config('halaqy.spine_first_run',
    (NOT EXISTS (SELECT 1 FROM information_schema.columns
                 WHERE table_schema = 'public' AND table_name = 'shops' AND column_name = 'is_published'))::text,
    false);
END $$;

ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS city_id             uuid REFERENCES public.cities(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS area_id             uuid REFERENCES public.areas(id)  ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS lat                 double precision,
  ADD COLUMN IF NOT EXISTS lng                 double precision,
  ADD COLUMN IF NOT EXISTS landmark_en         text,
  ADD COLUMN IF NOT EXISTS landmark_ar         text,
  ADD COLUMN IF NOT EXISTS slug                text,
  ADD COLUMN IF NOT EXISTS slug_ar             text,
  ADD COLUMN IF NOT EXISTS name_ar             text,
  ADD COLUMN IF NOT EXISTS description_ar      text,
  ADD COLUMN IF NOT EXISTS is_published        boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS published_at        timestamptz,
  ADD COLUMN IF NOT EXISTS marketplace_visible boolean NOT NULL DEFAULT true,
  ADD COLUMN IF NOT EXISTS is_verified         boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS cover_url           text,
  ADD COLUMN IF NOT EXISTS logo_url            text,
  ADD COLUMN IF NOT EXISTS tax_number          text,
  ADD COLUMN IF NOT EXISTS is_tax_registered   boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS timezone            text NOT NULL DEFAULT 'Asia/Amman';

ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_lat_range;
ALTER TABLE public.shops ADD CONSTRAINT shops_lat_range CHECK (lat IS NULL OR lat BETWEEN -90 AND 90) NOT VALID;
ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_lng_range;
ALTER TABLE public.shops ADD CONSTRAINT shops_lng_range CHECK (lng IS NULL OR lng BETWEEN -180 AND 180) NOT VALID;

-- Unique slug for a shop: base + "-2", "-3", … (ignores the shop's own row).
CREATE OR REPLACE FUNCTION public.shop_unique_slug(p_base text, p_shop_id uuid, p_arabic boolean DEFAULT false)
RETURNS text
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_base text := p_base;
  v_try  text;
  n      int  := 1;
BEGIN
  IF v_base IS NULL OR v_base = '' THEN
    IF p_arabic THEN
      RETURN NULL;
    END IF;
    v_base := 'shop-' || left(replace(COALESCE(p_shop_id, gen_random_uuid())::text, '-', ''), 8);
  END IF;
  v_try := v_base;
  LOOP
    IF p_arabic THEN
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.slug_ar = v_try AND s.id IS DISTINCT FROM p_shop_id);
    ELSE
      EXIT WHEN NOT EXISTS (SELECT 1 FROM public.shops s WHERE s.slug = v_try AND s.id IS DISTINCT FROM p_shop_id);
    END IF;
    n := n + 1;
    v_try := rtrim(left(v_base, 55), '-') || '-' || n;
  END LOOP;
  RETURN v_try;
END;
$$;

-- Backfill slugs (deterministic order so the oldest shop keeps the plain slug).
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id, name, name_ar FROM public.shops WHERE slug IS NULL ORDER BY created_at NULLS LAST, id LOOP
    UPDATE public.shops SET slug = public.shop_unique_slug(public.slugify_latin(r.name), r.id) WHERE id = r.id;
  END LOOP;
  FOR r IN SELECT id, name, name_ar FROM public.shops
           WHERE slug_ar IS NULL AND COALESCE(name_ar, name) ~ '[ء-ي]'
           ORDER BY created_at NULLS LAST, id LOOP
    UPDATE public.shops SET slug_ar = public.shop_unique_slug(public.slugify_ar(COALESCE(r.name_ar, r.name)), r.id, true)
    WHERE id = r.id;
  END LOOP;
END $$;

ALTER TABLE public.shops ALTER COLUMN slug SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS shops_slug_key    ON public.shops (slug);
CREATE UNIQUE INDEX IF NOT EXISTS shops_slug_ar_key ON public.shops (slug_ar) WHERE slug_ar IS NOT NULL;
ALTER TABLE public.shops DROP CONSTRAINT IF EXISTS shops_slug_format;
ALTER TABLE public.shops ADD CONSTRAINT shops_slug_format
  CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' AND length(slug) <= 64);

-- Location backfill from the free-text address ("Amman, Abdoun").
UPDATE public.shops s
SET area_id = a.id, city_id = a.city_id,
    lat = COALESCE(s.lat, a.lat), lng = COALESCE(s.lng, a.lng)
FROM (
  SELECT DISTINCT ON (s2.id) s2.id AS shop_id, a2.*
  FROM public.shops s2
  JOIN public.areas a2
    ON lower(s2.address) ~ ('\m' || regexp_replace(lower(a2.name_en), '^al-|\s*\(.*\)|\s+street$', '', 'g') || '\M')
    OR public.normalize_ar(s2.address) LIKE '%' || public.normalize_ar(a2.name_ar) || '%'
  WHERE s2.area_id IS NULL AND COALESCE(s2.address, '') <> ''
  ORDER BY s2.id, length(a2.name_en) DESC
) a
WHERE s.id = a.shop_id AND s.area_id IS NULL;

UPDATE public.shops s SET city_id = c.id
FROM public.cities c
WHERE s.city_id IS NULL AND COALESCE(s.address, '') <> ''
  AND (lower(s.address) ~ ('\m' || c.slug_en || '\M')
       OR public.normalize_ar(s.address) LIKE '%' || public.normalize_ar(c.name_ar) || '%');

-- Publish backfill (first run only): shops with ≥1 active service and working hours.
UPDATE public.shops s
SET is_published = true, published_at = COALESCE(s.published_at, now())
WHERE current_setting('halaqy.spine_first_run', true) = 'true'
  AND s.is_published = false
  AND EXISTS (SELECT 1 FROM public.services sv WHERE sv.shop_id = s.id AND sv.is_active IS TRUE)
  AND EXISTS (SELECT 1 FROM public.working_hours wh JOIN public.profiles p ON p.id = wh.barber_id
              WHERE p.shop_id = s.id AND p.role::text IN ('barber', 'shop_admin')
                AND wh.is_working IS TRUE);

-- Insert/update guard: organization, slugs, published_at, platform-only columns.
-- SECURITY INVOKER on purpose: current_user must be the caller's role. Shops
-- are only inserted by handle_new_user (SECURITY DEFINER) or the service role,
-- which may create the organization row; `authenticated` has no shop INSERT.
CREATE OR REPLACE FUNCTION public.shops_marketplace_defaults()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
DECLARE
  v_privileged boolean := current_user IN ('postgres', 'supabase_admin', 'service_role')
                          OR public.is_platform_admin();
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW.id IS NULL THEN
      NEW.id := gen_random_uuid();
    END IF;
    IF NEW.organization_id IS NULL THEN
      INSERT INTO public.organizations (name) VALUES (COALESCE(NULLIF(NEW.name, ''), 'Shop'))
      RETURNING id INTO NEW.organization_id;
    END IF;
    IF NOT v_privileged THEN
      NEW.is_verified := false;
    END IF;
  ELSE
    IF NOT v_privileged THEN
      IF NEW.is_verified IS DISTINCT FROM OLD.is_verified THEN
        RAISE EXCEPTION 'FORBIDDEN: is_verified is set by the platform' USING ERRCODE = '42501';
      END IF;
      IF NEW.organization_id IS DISTINCT FROM OLD.organization_id THEN
        RAISE EXCEPTION 'FORBIDDEN: organization_id cannot be changed' USING ERRCODE = '42501';
      END IF;
    END IF;
  END IF;

  NEW.slug := NULLIF(btrim(lower(NEW.slug)), '');
  IF NEW.slug IS NULL THEN
    NEW.slug := public.shop_unique_slug(public.slugify_latin(NEW.name), NEW.id);
  END IF;
  NEW.slug_ar := NULLIF(btrim(NEW.slug_ar), '');
  IF NEW.slug_ar IS NULL AND COALESCE(NEW.name_ar, NEW.name) ~ '[ء-ي]' THEN
    NEW.slug_ar := public.shop_unique_slug(public.slugify_ar(COALESCE(NEW.name_ar, NEW.name)), NEW.id, true);
  END IF;

  IF NEW.is_published AND NEW.published_at IS NULL THEN
    NEW.published_at := now();
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS shops_marketplace_defaults ON public.shops;
CREATE TRIGGER shops_marketplace_defaults BEFORE INSERT OR UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.shops_marketplace_defaults();

-- Public storefront columns (anon + authenticated). tax_number stays private.
GRANT SELECT (organization_id, city_id, area_id, lat, lng, landmark_en, landmark_ar,
              slug, slug_ar, name_ar, description_ar, is_published, published_at,
              marketplace_visible, is_verified, cover_url, logo_url, is_tax_registered, timezone)
  ON public.shops TO anon, authenticated;

-- Own-shop billing/tax fields for staff (tax_number is not a public column).
DROP FUNCTION IF EXISTS public.get_my_shop_tax();
CREATE FUNCTION public.get_my_shop_tax()
RETURNS TABLE (shop_id uuid, tax_number text, is_tax_registered boolean)
LANGUAGE sql STABLE SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT s.id, s.tax_number, s.is_tax_registered
  FROM public.shops s
  WHERE s.id = public.get_current_shop_id() AND public.is_shop_staff();
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 6. GLOBAL SERVICE TAXONOMY
-- ═══════════════════════════════════════════════════════════════════════════
CREATE TABLE IF NOT EXISTS public.service_categories (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  slug         text NOT NULL,
  name_en      text NOT NULL,
  name_ar      text NOT NULL,
  synonyms_ar  text[] NOT NULL DEFAULT '{}',
  synonyms_en  text[] NOT NULL DEFAULT '{}',
  icon         text,
  sort         integer NOT NULL DEFAULT 0,
  is_active    boolean NOT NULL DEFAULT true,
  created_at   timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT service_categories_slug_key UNIQUE (slug),
  CONSTRAINT service_categories_slug_format CHECK (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$')
);
ALTER TABLE public.service_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS service_categories_select_public ON public.service_categories;
CREATE POLICY service_categories_select_public ON public.service_categories FOR SELECT TO anon, authenticated
  USING (is_active OR (SELECT public.is_platform_admin()));
DROP POLICY IF EXISTS service_categories_write_platform ON public.service_categories;
CREATE POLICY service_categories_write_platform ON public.service_categories FOR ALL TO authenticated
  USING ((SELECT public.is_platform_admin())) WITH CHECK ((SELECT public.is_platform_admin()));

REVOKE ALL ON public.service_categories FROM anon, authenticated;
GRANT SELECT ON public.service_categories TO anon, authenticated;
GRANT INSERT, UPDATE, DELETE ON public.service_categories TO authenticated;  -- policy-gated

INSERT INTO public.service_categories (slug, name_en, name_ar, synonyms_ar, synonyms_en, icon, sort) VALUES
  ('haircut', 'Haircut', 'قص شعر',
    ARRAY['حلاقة','حلاقه','حلاقة شعر','قصة','قصه','قص','شعر','كت'],
    ARRAY['haircut','hair cut','cut','trim','clipper','scissor','crew cut','buzz'], 'scissors', 10),
  ('fade', 'Fade', 'تدريج (فيد)',
    ARRAY['فيد','تدريج','سكين فيد','سكن فيد','تخفيف','تنزيل','درجات','تيبر'],
    ARRAY['fade','skin fade','taper','low fade','mid fade','high fade','burst fade'], 'gradient', 20),
  ('beard', 'Beard', 'لحية',
    ARRAY['لحية','لحيه','دقن','ذقن','تحديد','تحديد لحية','تحديد دقن','تشذيب','سكسوكة','سكسوكه','عوارض'],
    ARRAY['beard','goatee','line up','lineup','edge up','beard trim'], 'beard', 30),
  ('shave', 'Shave', 'حلاقة على الموس',
    ARRAY['موس','حلاقة ذقن','حلاقة دقن','حلاقة ناعمة','ناعم','منشفة','فوطة','فوطه سخنة','شفرة'],
    ARRAY['shave','razor','hot towel','straight razor','clean shave','wet shave'], 'razor', 40),
  ('kids', 'Kids', 'أطفال',
    ARRAY['أطفال','اطفال','ولاد','ولادي','صغار','طفل','ولد'],
    ARRAY['kids','kid','child','children','boys','junior'], 'child', 50),
  ('styling', 'Styling', 'تسريح وسشوار',
    ARRAY['سشوار','سيشوار','استشوار','تسريح','تصفيف','جل','واكس شعر','كيرلي','فرد','مكواة'],
    ARRAY['styling','style','blow dry','blowdry','hair wax','gel','curl','straighten'], 'comb', 60),
  ('colour', 'Colour', 'صبغة',
    ARRAY['صبغة','صبغه','صبغ','لون','تلوين','شيب','تغطية شيب','هايلايت','ميش','حنة','حناء'],
    ARRAY['color','colour','dye','highlights','grey blending','gray blending','tint'], 'palette', 70),
  ('treatments', 'Hair treatments', 'علاجات الشعر',
    ARRAY['بروتين','كيراتين','كرياتين','علاج','حمام زيت','تساقط','زراعة'],
    ARRAY['keratin','protein','treatment','hair spa','scalp','oil bath'], 'droplet', 75),
  ('facial', 'Facial & mask', 'عناية بالبشرة وماسك',
    ARRAY['ماسك','ماسك أسود','ماسك اسود','تنظيف بشرة','بشرة','فيشل','شمع','واكس وجه','خيط','بخار','سنفرة','تقشير'],
    ARRAY['facial','mask','black mask','skin care','skincare','threading','waxing','steam','scrub','peel'], 'sparkles', 80),
  ('packages', 'Packages', 'باقات',
    ARRAY['باقة','باقه','بكج','باكج','بكيج','عرض','عروض','عريس','تجهيز عريس','كومبو','+'],
    ARRAY['package','combo','bundle','deal','groom','+'], 'gift', 90),
  ('home-service', 'Home service', 'خدمة منزلية',
    ARRAY['خدمة منزلية','بالبيت','بالمنزل','منزلي','منزلية','حلاق متنقل','زيارة منزلية'],
    ARRAY['home service','home visit','mobile barber','at home','house call'], 'home', 100)
ON CONFLICT (slug) DO UPDATE
  SET name_en = EXCLUDED.name_en, name_ar = EXCLUDED.name_ar,
      synonyms_ar = EXCLUDED.synonyms_ar, synonyms_en = EXCLUDED.synonyms_en,
      icon = EXCLUDED.icon, sort = EXCLUDED.sort;

ALTER TABLE public.services ADD COLUMN IF NOT EXISTS category_id uuid
  REFERENCES public.service_categories(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_services_category ON public.services (category_id) WHERE category_id IS NOT NULL;

-- Best-effort category for a free-text service name (EN and/or AR). Specific
-- categories win over generic ones (packages > … > haircut).
CREATE OR REPLACE FUNCTION public.guess_service_category(p_name text, p_name_ar text DEFAULT NULL)
RETURNS uuid
LANGUAGE sql STABLE
SET search_path = public, pg_temp
AS $$
  WITH t AS (
    SELECT lower(COALESCE(p_name, '')) AS en,
           public.normalize_ar(COALESCE(p_name, '') || ' ' || COALESCE(p_name_ar, '')) AS ar
  )
  SELECT c.id
  FROM public.service_categories c, t
  WHERE c.is_active
    AND (EXISTS (SELECT 1 FROM unnest(c.synonyms_en || ARRAY[lower(c.name_en)]) s WHERE s <> '' AND t.en LIKE '%' || s || '%')
      OR EXISTS (SELECT 1 FROM unnest(c.synonyms_ar || ARRAY[c.name_ar]) s
                 WHERE s <> '' AND t.ar LIKE '%' || public.normalize_ar(s) || '%'))
  ORDER BY COALESCE(array_position(ARRAY['packages','home-service','kids','treatments','colour','fade',
                                         'facial','shave','beard','styling','haircut'], c.slug), 99)
  LIMIT 1;
$$;

UPDATE public.services sv SET category_id = public.guess_service_category(sv.name, sv.name_ar)
WHERE sv.category_id IS NULL;

-- ═══════════════════════════════════════════════════════════════════════════
-- 7. APPOINTMENT STATUS (sole owner of this CHECK)
-- ═══════════════════════════════════════════════════════════════════════════
ALTER TABLE public.appointments DROP CONSTRAINT IF EXISTS appointments_status_check;
ALTER TABLE public.appointments ADD CONSTRAINT appointments_status_check
  CHECK (status IN ('pending', 'confirmed', 'completed', 'no_show', 'cancelled',
                    'arrived', 'in_chair', 'awaiting_deposit')) NOT VALID;

-- The overlap guard must also cover the new time-occupying statuses
-- (awaiting_deposit holds the slot; arrived / in_chair occupy the chair).
-- No existing row carries a new status, so the rebuilt constraint covers
-- exactly the same rows as before. The historical cutoff from 0016 is kept.
DO $$
DECLARE
  v_def    text;
  v_cutoff text;
BEGIN
  SELECT pg_get_constraintdef(c.oid) INTO v_def
  FROM pg_constraint c
  WHERE c.conname = 'appointments_no_overlap' AND c.conrelid = 'public.appointments'::regclass;

  IF v_def IS NULL OR v_def LIKE '%in_chair%' THEN
    RETURN;
  END IF;

  v_cutoff := substring(v_def FROM 'end_time > ''([^'']+)''');
  ALTER TABLE public.appointments DROP CONSTRAINT appointments_no_overlap;

  IF v_cutoff IS NULL THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_no_overlap
      EXCLUDE USING gist (barber_id WITH =, tstzrange(start_time, end_time, '[)') WITH &&)
      WHERE (status IN ('pending', 'confirmed', 'awaiting_deposit', 'arrived', 'in_chair') AND barber_id IS NOT NULL);
  ELSE
    EXECUTE format(
      'ALTER TABLE public.appointments ADD CONSTRAINT appointments_no_overlap
         EXCLUDE USING gist (barber_id WITH =, tstzrange(start_time, end_time, %L) WITH &&)
         WHERE (status IN (%L, %L, %L, %L, %L) AND barber_id IS NOT NULL AND end_time > %L::timestamptz)',
      '[)', 'pending', 'confirmed', 'awaiting_deposit', 'arrived', 'in_chair', v_cutoff);
  END IF;
END $$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 8. RATE LIMITING
--    rate_limits / check_rate_limit(p_key, p_max, p_window_seconds) already
--    exist (0016) and are reused as-is. This adds a per-request convenience
--    for anon RPCs: keyed by scope + client IP (+ optional subject such as a
--    phone), hashed so IPs/phones never land in the table in clear text.
-- ═══════════════════════════════════════════════════════════════════════════
CREATE OR REPLACE FUNCTION public.check_request_rate_limit(p_scope text, p_max int, p_window_seconds int,
                                                          p_subject text DEFAULT NULL)
RETURNS boolean
LANGUAGE plpgsql SECURITY DEFINER
SET search_path = public, extensions, pg_temp
AS $$
DECLARE
  v_ip  text := COALESCE(public.request_ip(), 'unknown');
  v_ok  boolean;
BEGIN
  IF p_scope IS NULL OR p_scope !~ '^[a-z0-9_:.-]{1,40}$' THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  v_ok := public.check_rate_limit(
    'rpc:' || p_scope || ':ip:' || left(encode(digest(v_ip, 'sha256'), 'hex'), 40), p_max, p_window_seconds);
  IF v_ok AND COALESCE(p_subject, '') <> '' THEN
    v_ok := public.check_rate_limit(
      'rpc:' || p_scope || ':sub:' || left(encode(digest(lower(p_subject), 'sha256'), 'hex'), 40), p_max, p_window_seconds);
  END IF;
  RETURN v_ok;
END;
$$;

-- ═══════════════════════════════════════════════════════════════════════════
-- 9. SEARCH INDEXES
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE s text;
BEGIN
  SELECT n.nspname INTO s FROM pg_extension e JOIN pg_namespace n ON n.oid = e.extnamespace WHERE e.extname = 'pg_trgm';
  IF s IS NULL THEN
    CREATE EXTENSION IF NOT EXISTS pg_trgm WITH SCHEMA extensions;
    s := 'extensions';
  END IF;
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_shops_name_trgm     ON public.shops    USING gin (name %I.gin_trgm_ops)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_shops_name_ar_trgm  ON public.shops    USING gin (name_ar %I.gin_trgm_ops) WHERE name_ar IS NOT NULL', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_services_name_trgm  ON public.services USING gin (name %I.gin_trgm_ops)', s);
  EXECUTE format('CREATE INDEX IF NOT EXISTS idx_services_name_ar_trgm ON public.services USING gin (name_ar %I.gin_trgm_ops) WHERE name_ar IS NOT NULL', s);
END $$;

CREATE INDEX IF NOT EXISTS idx_shops_geo ON public.shops USING gist (point(lng, lat))
  WHERE lat IS NOT NULL AND lng IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_shops_marketplace ON public.shops (city_id, area_id)
  WHERE is_published AND marketplace_visible;

-- ═══════════════════════════════════════════════════════════════════════════
-- 10. FUNCTION PRIVILEGES (revoke Supabase defaults, then allow-list)
-- ═══════════════════════════════════════════════════════════════════════════
DO $$
DECLARE f text;
BEGIN
  FOREACH f IN ARRAY ARRAY[
    'public.normalize_ar(text)', 'public.slugify_latin(text)', 'public.slugify_ar(text)', 'public.mask_phone(text)',
    'public.request_ip()', 'public.guard_platform_role()', 'public.current_platform_role()',
    'public.is_platform_admin()', 'public.is_platform_staff()', 'public.get_current_organization_id()',
    'public.shop_unique_slug(text, uuid, boolean)', 'public.shops_marketplace_defaults()',
    'public.get_my_shop_tax()', 'public.guess_service_category(text, text)',
    'public.check_request_rate_limit(text, integer, integer, text)'
  ] LOOP
    EXECUTE format('REVOKE ALL ON FUNCTION %s FROM PUBLIC, anon, authenticated', f);
  END LOOP;
END $$;

-- Pure helpers: safe for everyone (used by search and display code).
GRANT EXECUTE ON FUNCTION public.normalize_ar(text)   TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.slugify_latin(text)  TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.slugify_ar(text)     TO anon, authenticated, service_role;
GRANT EXECUTE ON FUNCTION public.mask_phone(text)     TO anon, authenticated, service_role;
-- RLS helpers (called from policies as the invoking role).
GRANT EXECUTE ON FUNCTION public.is_platform_admin()            TO anon, authenticated;
GRANT EXECUTE ON FUNCTION public.is_platform_staff()            TO authenticated;
GRANT EXECUTE ON FUNCTION public.current_platform_role()        TO authenticated;
GRANT EXECUTE ON FUNCTION public.get_current_organization_id()  TO authenticated;
-- Signed-in RPCs.
GRANT EXECUTE ON FUNCTION public.get_my_shop_tax()                  TO authenticated;
GRANT EXECUTE ON FUNCTION public.guess_service_category(text, text) TO authenticated, service_role;
-- Server-only / internal (called from SECURITY DEFINER RPCs owned by postgres).
GRANT EXECUTE ON FUNCTION public.check_request_rate_limit(text, integer, integer, text) TO service_role;
GRANT EXECUTE ON FUNCTION public.request_ip()                       TO service_role;
-- Called by the (invoker) shops trigger when an admin clears a slug.
GRANT EXECUTE ON FUNCTION public.shop_unique_slug(text, uuid, boolean) TO authenticated, service_role;
-- guard_platform_role / shops_marketplace_defaults run as triggers and need no grants.
