-- ═══════════════════════════════════════════════════════════════════════════
-- LOCAL DEVELOPMENT SEED — loaded by `supabase db reset` (config.toml
-- [db.seed] sql_paths = ["./seed.sql"], relative to supabase/).
--
-- Self-contained: creates its own auth users, so it works on a brand-new
-- database. Never run against production. All accounts use the local-only
-- password below and @halaqy.test addresses.
--
--   owner@halaqy.test      shop_admin  — The Gentleman's Chair
--   sami@halaqy.test       barber      — The Gentleman's Chair
--   khaled@halaqy.test     barber      — The Gentleman's Chair
--   owner2@halaqy.test     shop_admin  — The Classic Razor
--   customer@halaqy.test   customer    — has a past (reviewed) and an upcoming booking
--   password for all: halaqy-local-123
--
-- The root-level /seed.sql is a legacy script written against one specific
-- hosted project (hard-coded user ids) and is NOT loaded by the CLI.
-- ═══════════════════════════════════════════════════════════════════════════

DO $$
DECLARE
  v_pw        text := extensions.crypt('halaqy-local-123', extensions.gen_salt('bf'));
  u_owner     uuid := 'a0000000-0000-4000-8000-000000000001';
  u_sami      uuid := 'a0000000-0000-4000-8000-000000000002';
  u_khaled    uuid := 'a0000000-0000-4000-8000-000000000003';
  u_owner2    uuid := 'a0000000-0000-4000-8000-000000000004';
  u_customer  uuid := 'a0000000-0000-4000-8000-000000000005';
  v_shop1     uuid;
  v_shop2     uuid;
  v_tz        text := 'Asia/Amman';
  v_today     date := (now() AT TIME ZONE 'Asia/Amman')::date;
  v_svc_cut   uuid;
  v_svc_beard uuid;
  v_client_me uuid;
  v_client_2  uuid;
  v_client_3  uuid;
  v_past      uuid;
  r           record;
BEGIN
  -- ── Auth users (handle_new_user creates profiles, shops, services, hours) ──
  FOR r IN
    SELECT * FROM (VALUES
      (u_owner,    'owner@halaqy.test',    '{"full_name":"Mohammad Owner","role":"shop_admin","shop_name":"The Gentleman''s Chair"}'::jsonb),
      (u_sami,     'sami@halaqy.test',     '{"full_name":"Sami Haddad","role":"customer"}'::jsonb),
      (u_khaled,   'khaled@halaqy.test',   '{"full_name":"Khaled Nasser","role":"customer"}'::jsonb),
      (u_owner2,   'owner2@halaqy.test',   '{"full_name":"Omar Owner","role":"shop_admin","shop_name":"The Classic Razor"}'::jsonb),
      (u_customer, 'customer@halaqy.test', '{"full_name":"Yousef Rami","role":"customer"}'::jsonb)
    ) AS t(id, email, meta)
  LOOP
    IF NOT EXISTS (SELECT 1 FROM auth.users WHERE id = r.id) THEN
      INSERT INTO auth.users (
        id, instance_id, aud, role, email, encrypted_password, email_confirmed_at,
        raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
        confirmation_token, recovery_token, email_change_token_new, email_change
      ) VALUES (
        r.id, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', r.email, v_pw, now(),
        '{"provider":"email","providers":["email"]}'::jsonb, r.meta, now(), now(),
        '', '', '', ''
      );
      INSERT INTO auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
      VALUES (gen_random_uuid(), r.id, r.id::text,
              jsonb_build_object('sub', r.id::text, 'email', r.email, 'email_verified', true),
              'email', now(), now(), now());
    END IF;
  END LOOP;

  SELECT shop_id INTO v_shop1 FROM public.profiles WHERE id = u_owner;
  SELECT shop_id INTO v_shop2 FROM public.profiles WHERE id = u_owner2;

  -- ── Shop details ──
  UPDATE public.shops SET
    address = 'Amman, Abdoun', phone = '+962 79 123 4567', whatsapp = '+962791234567',
    email = 'hello@gentlemanschair.test', instagram = 'gentlemanschair',
    google_maps_url = 'https://maps.google.com/?q=Abdoun+Amman',
    description = 'Classic cuts and hot-towel shaves in the heart of Abdoun.',
    currency = 'JOD', timezone = v_tz, cancellation_policy_hours = 12
  WHERE id = v_shop1;
  UPDATE public.shops SET
    address = 'Amman, Al Weibdeh', phone = '+962 78 987 6543', whatsapp = '+962789876543',
    instagram = 'classicrazor', currency = 'JOD', timezone = v_tz
  WHERE id = v_shop2;

  -- ── Barbers join shop 1 (normally via accept_invite) ──
  UPDATE public.profiles SET role = 'barber', shop_id = v_shop1,
         avatar_url = 'https://i.pravatar.cc/150?u=' || id
  WHERE id IN (u_sami, u_khaled);
  PERFORM public.seed_staff_defaults(u_sami, v_shop1);
  PERFORM public.seed_staff_defaults(u_khaled, v_shop1);

  -- Realistic week: Friday off, prayer/lunch break 13:00–14:00.
  UPDATE public.working_hours SET is_working = false
  WHERE barber_id IN (u_owner, u_sami, u_khaled) AND day_of_week = 5;
  UPDATE public.working_hours SET break_start = '13:00', break_end = '14:00'
  WHERE barber_id IN (u_sami, u_khaled) AND day_of_week <> 5;

  SELECT id INTO v_svc_cut   FROM public.services WHERE shop_id = v_shop1 ORDER BY sort_order LIMIT 1;
  SELECT id INTO v_svc_beard FROM public.services WHERE shop_id = v_shop1 ORDER BY sort_order OFFSET 1 LIMIT 1;

  -- ── Clients ──
  IF NOT EXISTS (SELECT 1 FROM public.clients WHERE shop_id = v_shop1) THEN
    INSERT INTO public.clients (shop_id, name, phone, email, source, auth_user_id)
    VALUES (v_shop1, 'Yousef Rami', '+962791112233', 'customer@halaqy.test', 'online', u_customer)
    RETURNING id INTO v_client_me;
    INSERT INTO public.clients (shop_id, name, phone, source)
    VALUES (v_shop1, 'Tariq Hamdan', '+962782223344', 'walk_in') RETURNING id INTO v_client_2;
    INSERT INTO public.clients (shop_id, name, phone, source)
    VALUES (v_shop1, 'Mahmoud Saleh', '+962773334455', 'instagram') RETURNING id INTO v_client_3;

    -- Past, completed + paid (reviewed below).
    INSERT INTO public.appointments (shop_id, client_id, barber_id, service_ids, client_name, service_name,
                                     start_time, end_time, status, price, currency, payment_status,
                                     payment_method, amount_total, amount_paid, source)
    VALUES (v_shop1, v_client_me, u_sami, ARRAY[v_svc_cut], 'Yousef Rami', 'Premium Haircut',
            ((v_today - 7) + time '11:00') AT TIME ZONE v_tz, ((v_today - 7) + time '11:45') AT TIME ZONE v_tz,
            'completed', 12, 'JOD', 'paid', 'cash', 12, 12, 'online')
    RETURNING id INTO v_past;
    INSERT INTO public.daily_sales (shop_id, appointment_id, client_name, service_name, barber_name, amount, payment_method, sale_time, created_at)
    VALUES (v_shop1, v_past, 'Yousef Rami', 'Premium Haircut', 'Sami Haddad', 12, 'cash', '11:45',
            ((v_today - 7) + time '11:45') AT TIME ZONE v_tz);
    INSERT INTO public.reviews (shop_id, client_id, appointment_id, rating, comment, reviewer_name)
    VALUES (v_shop1, v_client_me, v_past, 5, 'Sharp fade and a friendly team.', 'Yousef R.');

    -- Upcoming for the demo customer (outside the 12h cancellation window).
    INSERT INTO public.appointments (shop_id, client_id, barber_id, service_ids, client_name, service_name,
                                     start_time, end_time, status, price, currency, amount_total, source)
    VALUES (v_shop1, v_client_me, u_sami, ARRAY[v_svc_cut, v_svc_beard], 'Yousef Rami', 'Premium Haircut + Beard Trim & Shape',
            ((v_today + 3) + time '16:00') AT TIME ZONE v_tz, ((v_today + 3) + time '17:15') AT TIME ZONE v_tz,
            'confirmed', 20, 'JOD', 20, 'online');

    -- Today's calendar.
    INSERT INTO public.appointments (shop_id, client_id, barber_id, service_ids, client_name, service_name,
                                     start_time, end_time, status, price, currency, amount_total, source)
    VALUES
      (v_shop1, v_client_2, u_khaled, ARRAY[v_svc_cut], 'Tariq Hamdan', 'Premium Haircut',
       (v_today + time '10:00') AT TIME ZONE v_tz, (v_today + time '10:45') AT TIME ZONE v_tz,
       'confirmed', 12, 'JOD', 12, 'walk_in'),
      (v_shop1, v_client_3, u_sami, ARRAY[v_svc_beard], 'Mahmoud Saleh', 'Beard Trim & Shape',
       (v_today + time '15:00') AT TIME ZONE v_tz, (v_today + time '15:30') AT TIME ZONE v_tz,
       'pending', 8, 'JOD', 8, 'instagram');
  END IF;

  -- ── A lead or two for the CRM board ──
  IF NOT EXISTS (SELECT 1 FROM public.leads WHERE shop_id = v_shop1) THEN
    INSERT INTO public.leads (shop_id, name, contact, stage, value, position)
    VALUES (v_shop1, 'Basel Nour', '+962790001122', 'new', 15, 0),
           (v_shop1, 'Fadi Karam', '@fadi.k', 'contacted', 20, 0);
  END IF;
END $$;
