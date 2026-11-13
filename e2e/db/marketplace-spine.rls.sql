-- RLS / privilege checks for supabase/migrations/20250101001900_marketplace_spine.sql
--
-- Run AFTER the migration, inside a transaction that is rolled back:
--   DB=$(docker ps --format '{{.Names}}' | grep supabase_db)
--   docker exec -i $DB psql -U postgres -v ON_ERROR_STOP=1 -c BEGIN \
--     -f - -c ROLLBACK < <(cat supabase/migrations/20250101001900_marketplace_spine.sql e2e/db/marketplace-spine.rls.sql)
-- Each block raises on failure; "RLS OK" is printed at the end.

-- ─── Fixture: a fresh shop via the same path signup uses (no organization_id given) ───
INSERT INTO public.shops (id, name) VALUES ('00000000-0000-4000-8000-0000000000a1', 'Spine Test Barbers');
INSERT INTO public.shops (id, name) VALUES ('00000000-0000-4000-8000-0000000000a2', 'Spine Test Barbers');
INSERT INTO public.shops (id, name, tax_number) VALUES ('00000000-0000-4000-8000-0000000000a3', 'حلاق الاختبار', 'TAX-SECRET');
INSERT INTO auth.users (id, email, aud, role) VALUES
  ('00000000-0000-4000-8000-0000000000b1', 'spine-admin@example.test', 'authenticated', 'authenticated'),
  ('00000000-0000-4000-8000-0000000000b2', 'spine-customer@example.test', 'authenticated', 'authenticated')
ON CONFLICT (id) DO NOTHING;
INSERT INTO public.profiles (id, shop_id, role, full_name) VALUES
  ('00000000-0000-4000-8000-0000000000b1', '00000000-0000-4000-8000-0000000000a1', 'shop_admin', 'Spine Admin'),
  ('00000000-0000-4000-8000-0000000000b2', NULL, 'customer', 'Spine Customer')
ON CONFLICT (id) DO UPDATE SET shop_id = EXCLUDED.shop_id, role = EXCLUDED.role;

DO $$
DECLARE r record;
BEGIN
  SELECT organization_id, slug, slug_ar, is_published INTO r FROM public.shops WHERE id = '00000000-0000-4000-8000-0000000000a1';
  ASSERT r.organization_id IS NOT NULL, 'new shop must get an organization';
  ASSERT r.slug = 'spine-test-barbers', 'slug from name, got ' || r.slug;
  ASSERT r.is_published = false, 'new shops start unpublished';
  SELECT slug INTO r FROM public.shops WHERE id = '00000000-0000-4000-8000-0000000000a2';
  ASSERT r.slug = 'spine-test-barbers-2', 'duplicate names get a suffix, got ' || r.slug;
  SELECT slug, slug_ar INTO r FROM public.shops WHERE id = '00000000-0000-4000-8000-0000000000a3';
  ASSERT r.slug ~ '^[a-z0-9-]+$' AND r.slug_ar = 'حلاق-الاختبار', 'arabic name slugs';
  ASSERT NOT EXISTS (SELECT 1 FROM public.shops WHERE organization_id IS NULL), 'organization_id backfilled';
  ASSERT (SELECT count(*) FROM public.areas a JOIN public.cities c ON c.id = a.city_id WHERE c.slug_en = 'amman') >= 40, '~40 Amman areas';
  ASSERT public.mask_phone('+962791112222') = '+962 7•••••222', 'mask_phone';
END $$;

-- ─── anon ───
SET LOCAL ROLE anon;
SELECT set_config('request.jwt.claims', '{"role":"anon"}', true);
DO $$
BEGIN
  PERFORM id, slug, slug_ar, name_ar, is_published, marketplace_visible, area_id, lat, lng FROM public.shops LIMIT 1;
  PERFORM 1 FROM public.cities LIMIT 1;
  PERFORM 1 FROM public.areas LIMIT 1;
  PERFORM 1 FROM public.service_categories LIMIT 1;
  BEGIN
    PERFORM tax_number FROM public.shops LIMIT 1;
    RAISE EXCEPTION 'anon must not read shops.tax_number';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    PERFORM 1 FROM public.organizations LIMIT 1;
    RAISE EXCEPTION 'anon must not read organizations';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    -- Either no privilege or RLS hides every row.
    IF EXISTS (SELECT 1 FROM public.appointments) THEN
      RAISE EXCEPTION 'anon must not read appointments';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    -- Either no privilege or RLS hides every row.
    IF EXISTS (SELECT phone FROM public.clients) THEN
      RAISE EXCEPTION 'anon must not read clients';
    END IF;
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    INSERT INTO public.cities (slug_en, slug_ar, name_en, name_ar, governorate) VALUES ('x', 'x', 'x', 'x', 'x');
    RAISE EXCEPTION 'anon must not write cities';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- ─── shop admin ───
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b1","role":"authenticated"}', true);
DO $$
DECLARE n int;
BEGIN
  SELECT count(*) INTO n FROM public.organizations;
  ASSERT n = 1, 'admin sees exactly their organization, saw ' || n;
  UPDATE public.organizations SET name = 'Renamed' WHERE true;
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 1, 'admin can rename only their organization';

  UPDATE public.shops SET is_published = true, slug = 'spine-renamed' WHERE id = '00000000-0000-4000-8000-0000000000a1';
  ASSERT (SELECT published_at IS NOT NULL FROM public.shops WHERE id = '00000000-0000-4000-8000-0000000000a1'), 'published_at stamped';
  UPDATE public.shops SET is_published = true WHERE id = '00000000-0000-4000-8000-0000000000a2';
  GET DIAGNOSTICS n = ROW_COUNT;
  ASSERT n = 0, 'admin cannot update another shop';

  BEGIN
    UPDATE public.shops SET is_verified = true WHERE id = '00000000-0000-4000-8000-0000000000a1';
    RAISE EXCEPTION 'admin must not self-verify';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  BEGIN
    UPDATE public.shops SET organization_id = '00000000-0000-4000-8000-0000000000a2' WHERE id = '00000000-0000-4000-8000-0000000000a1';
    RAISE EXCEPTION 'admin must not move organizations';
  EXCEPTION WHEN insufficient_privilege OR foreign_key_violation THEN NULL;
  END;
  BEGIN
    UPDATE public.profiles SET platform_role = 'admin' WHERE id = '00000000-0000-4000-8000-0000000000b1';
    RAISE EXCEPTION 'users must not grant themselves a platform role';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
  ASSERT (SELECT t.tax_number IS NULL FROM public.get_my_shop_tax() t), 'own shop tax readable via RPC';
  ASSERT public.is_platform_admin() = false, 'not a platform admin';
  BEGIN
    INSERT INTO public.service_categories (slug, name_en, name_ar) VALUES ('nope', 'n', 'n');
    RAISE EXCEPTION 'shop admins must not edit the global taxonomy';
  EXCEPTION WHEN insufficient_privilege THEN NULL;
  END;
END $$;
RESET ROLE;

-- ─── customer ───
SET LOCAL ROLE authenticated;
SELECT set_config('request.jwt.claims', '{"sub":"00000000-0000-4000-8000-0000000000b2","role":"authenticated"}', true);
DO $$
BEGIN
  ASSERT (SELECT count(*) FROM public.organizations) = 0, 'customers see no organizations';
  ASSERT NOT EXISTS (SELECT 1 FROM public.get_my_shop_tax()), 'customers get no tax data';
END $$;
RESET ROLE;

-- ─── status CHECK ───
DO $$
BEGIN
  BEGIN
    INSERT INTO public.appointments (shop_id, client_name, start_time, end_time, status, price)
    VALUES ('00000000-0000-4000-8000-0000000000a1', 'x', now(), now() + interval '30 min', 'bogus', 0);
    RAISE EXCEPTION 'unknown status must be rejected';
  EXCEPTION WHEN check_violation THEN NULL;
  END;
  INSERT INTO public.appointments (shop_id, client_name, start_time, end_time, status, price)
  VALUES ('00000000-0000-4000-8000-0000000000a1', 'x', now(), now() + interval '30 min', 'in_chair', 0),
         ('00000000-0000-4000-8000-0000000000a1', 'x', now(), now() + interval '30 min', 'arrived', 0),
         ('00000000-0000-4000-8000-0000000000a1', 'x', now(), now() + interval '30 min', 'awaiting_deposit', 0);
END $$;

SELECT 'RLS OK' AS result;
