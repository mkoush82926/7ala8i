
-- Fix manager profile and shop
UPDATE profiles SET role = 'shop_admin' WHERE id = '017ebd83-2992-414f-a28f-82473123930f';
UPDATE profiles SET role = 'barber' WHERE id = 'ba5e80ea-30e5-4872-8314-53873df9b295';
UPDATE profiles SET role = 'customer' WHERE id = '54aa833d-926b-49da-b1c9-883600a94a85';

DO $$
DECLARE
  manager_id UUID := '017ebd83-2992-414f-a28f-82473123930f';
  professional_id UUID := 'ba5e80ea-30e5-4872-8314-53873df9b295';
  customer_id UUID := '54aa833d-926b-49da-b1c9-883600a94a85';
  
  shop1_id UUID;
  shop2_id UUID;
  shop3_id UUID;
  
  b1 UUID; b2 UUID; b3 UUID; b4 UUID; b5 UUID;
  
  s1 UUID; s2 UUID; s3 UUID; s4 UUID; s5 UUID; s6 UUID; s7 UUID; s8 UUID; s9 UUID; s10 UUID;
  
  c1 UUID; c2 UUID; c3 UUID; c4 UUID; c5 UUID; c6 UUID; c7 UUID; c8 UUID; c9 UUID; c10 UUID;
  c11 UUID; c12 UUID; c13 UUID; c14 UUID; c15 UUID;
BEGIN
  -- We assume uuid-ossp extension is enabled or gen_random_uuid() is used.
  -- Get manager's shop
  SELECT shop_id INTO shop1_id FROM profiles WHERE id = manager_id;
  
  -- Update shop1 details
  UPDATE shops SET name = 'Lumina Grooming Lounge', address = 'Amman, Mecca St.', phone = '+962 79 123 4567' WHERE id = shop1_id;
  
  -- Create shop 2
  shop2_id := gen_random_uuid();
  INSERT INTO shops(id, name, address, phone) VALUES (shop2_id, 'The Classic Razor', 'Amman, Abdoun', '+962 78 987 6543');
  
  -- Create shop 3
  shop3_id := gen_random_uuid();
  INSERT INTO shops(id, name, address, phone) VALUES (shop3_id, 'Urban Clippers', 'Amman, Weibdeh', '+962 77 111 2222');
  
  -- Update the manager's shop_id to shop1_id (if not already)
  UPDATE profiles SET shop_id = shop1_id WHERE id = manager_id;
  
  -- Assign professional to shop 1
  UPDATE profiles SET shop_id = shop1_id WHERE id = professional_id;
  
  -- B1 is the existing professional
  b1 := professional_id;
  
  -- Create 4 more auth.users so we can have 4 more barbers
  b2 := gen_random_uuid();
  b3 := gen_random_uuid();
  b4 := gen_random_uuid();
  b5 := gen_random_uuid();
  
  INSERT INTO auth.users (id, instance_id, aud, role, email, encrypted_password, email_confirmed_at, raw_app_meta_data, raw_user_meta_data)
  VALUES (b2, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dummy_barber1@test.com', 'foo', now(), '{"provider":"email"}', '{"name":"Sami FadeMaster","role":"barber"}'),
         (b3, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dummy_barber2@test.com', 'foo', now(), '{"provider":"email"}', '{"name":"Omar Styling","role":"barber"}'),
         (b4, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dummy_barber3@test.com', 'foo', now(), '{"provider":"email"}', '{"name":"Khaled Scissors","role":"barber"}'),
         (b5, '00000000-0000-0000-0000-000000000000', 'authenticated', 'authenticated', 'dummy_barber4@test.com', 'foo', now(), '{"provider":"email"}', '{"name":"Rami The Classic","role":"barber"}');
         
  -- Now insert their profiles
  INSERT INTO profiles (id, shop_id, role, full_name, avatar_url) VALUES 
  (b2, shop1_id, 'barber', 'Sami FadeMaster', 'https://i.pravatar.cc/150?u=b2'),
  (b3, shop2_id, 'barber', 'Omar Styling', 'https://i.pravatar.cc/150?u=b3'),
  (b4, shop2_id, 'barber', 'Khaled Scissors', 'https://i.pravatar.cc/150?u=b4'),
  (b5, shop3_id, 'barber', 'Rami The Classic', 'https://i.pravatar.cc/150?u=b5')
  ON CONFLICT (id) DO NOTHING;

  -- Create 10 services (for shop 1)
  -- we check if they already exist maybe or just insert
  INSERT INTO services (shop_id, name, price, duration) VALUES (shop1_id, 'Skin Fade', 10, 30) RETURNING id INTO s1;
  INSERT INTO services (shop_id, name, price, duration) VALUES (shop1_id, 'Classic Haircut', 8, 30) RETURNING id INTO s2;
  INSERT INTO services (shop_id, name, price, duration) VALUES (shop1_id, 'Beard Trim & Lineup', 5, 15) RETURNING id INTO s3;
  INSERT INTO services (shop_id, name, price, duration) VALUES (shop1_id, 'Haircut & Beard', 12, 45) RETURNING id INTO s4;
  INSERT INTO services (shop_id, name, price, duration) VALUES (shop1_id, 'Hot Towel Shave', 7, 30) RETURNING id INTO s5;
  INSERT INTO services (shop_id, name, price, duration) VALUES (shop1_id, 'Kids Haircut', 6, 20) RETURNING id INTO s6;
  INSERT INTO services (shop_id, name, price, duration) VALUES (shop1_id, 'Hair Coloring', 25, 60) RETURNING id INTO s7;
  INSERT INTO services (shop_id, name, price, duration) VALUES (shop1_id, 'Keratin Treatment', 30, 90) RETURNING id INTO s8;
  INSERT INTO services (shop_id, name, price, duration) VALUES (shop1_id, 'Facial Mask', 8, 20) RETURNING id INTO s9;
  INSERT INTO services (shop_id, name, price, duration) VALUES (shop1_id, 'VIP Grooming Package', 40, 120) RETURNING id INTO s10;

  -- Shop 1 Clients
  INSERT INTO clients (shop_id, name, phone, email) VALUES (shop1_id, 'Mohammad Abu Koush', '0791234567', 'moh.abukoush@gmail.com') RETURNING id INTO c1;
  INSERT INTO clients (shop_id, name, phone) VALUES (shop1_id, 'Zaid Ali', '0781112222') RETURNING id INTO c2;
  INSERT INTO clients (shop_id, name, phone) VALUES (shop1_id, 'Tariq Hassan', '0773334444') RETURNING id INTO c3;
  INSERT INTO clients (shop_id, name, phone) VALUES (shop1_id, 'Mahmoud Saeed', '0795556666') RETURNING id INTO c4;
  INSERT INTO clients (shop_id, name, phone) VALUES (shop1_id, 'Yousef Rami', '0787778888') RETURNING id INTO c5;
  INSERT INTO clients (shop_id, name, phone) VALUES (shop1_id, 'Saleh Majed', '0779990000') RETURNING id INTO c6;
  INSERT INTO clients (shop_id, name, phone) VALUES (shop1_id, 'Basel Nabil', '0791231234') RETURNING id INTO c7;
  INSERT INTO clients (shop_id, name, phone) VALUES (shop1_id, 'Omar Farouq', '0784564567') RETURNING id INTO c8;
  INSERT INTO clients (shop_id, name, phone) VALUES (shop1_id, 'Fadi Karam', '0777897890') RETURNING id INTO c9;
  INSERT INTO clients (shop_id, name, phone) VALUES (shop1_id, 'Karam Fadi', '0799879876') RETURNING id INTO c10;
  
  -- Shop 2 Clients
  INSERT INTO clients (shop_id, name, phone) VALUES (shop2_id, 'Ali Zaid', '0786546543') RETURNING id INTO c11;
  INSERT INTO clients (shop_id, name, phone) VALUES (shop2_id, 'Hassan Tariq', '0773213210') RETURNING id INTO c12;
  
  -- Shop 3 Clients
  INSERT INTO clients (shop_id, name, phone) VALUES (shop3_id, 'Saeed Mahmoud', '0791113333') RETURNING id INTO c13;
  INSERT INTO clients (shop_id, name, phone) VALUES (shop3_id, 'Rami Yousef', '0782224444') RETURNING id INTO c14;
  INSERT INTO clients (shop_id, name, phone) VALUES (shop3_id, 'Majed Saleh', '0775557777') RETURNING id INTO c15;


  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c9, ARRAY[s2], 'Seeded Service', 'Customer 1',
    (date_trunc('day', NOW()) - INTERVAL '12 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '12 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b1, c2, ARRAY[s2], 'Seeded Service', 'Customer 2',
    (date_trunc('day', NOW()) - INTERVAL '5 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '5 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'no_show', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c1, ARRAY[s6], 'Seeded Service', 'Customer 3',
    (date_trunc('day', NOW()) - INTERVAL '22 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '22 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c6, ARRAY[s7], 'Seeded Service', 'Customer 4',
    (date_trunc('day', NOW()) - INTERVAL '12 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '12 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b1, c9, ARRAY[s5], 'Seeded Service', 'Customer 5',
    (date_trunc('day', NOW()) - INTERVAL '15 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '15 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c5, ARRAY[s3], 'Seeded Service', 'Customer 6',
    (date_trunc('day', NOW()) - INTERVAL '20 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '20 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b1, c1, ARRAY[s6], 'Seeded Service', 'Customer 7',
    (date_trunc('day', NOW()) - INTERVAL '22 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '22 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'cancelled', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c10, ARRAY[s10], 'Seeded Service', 'Customer 8',
    (date_trunc('day', NOW()) - INTERVAL '2 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '2 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'no_show', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c10, ARRAY[s5], 'Seeded Service', 'Customer 9',
    (date_trunc('day', NOW()) - INTERVAL '21 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '21 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'no_show', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c5, ARRAY[s2], 'Seeded Service', 'Customer 10',
    (date_trunc('day', NOW()) - INTERVAL '23 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '23 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b1, c6, ARRAY[s6], 'Seeded Service', 'Customer 11',
    (date_trunc('day', NOW()) - INTERVAL '10 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '10 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c2, ARRAY[s8], 'Seeded Service', 'Customer 12',
    (date_trunc('day', NOW()) - INTERVAL '18 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '18 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'no_show', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c6, ARRAY[s8], 'Seeded Service', 'Customer 13',
    (date_trunc('day', NOW()) - INTERVAL '18 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '18 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b1, c1, ARRAY[s6], 'Seeded Service', 'Customer 14',
    (date_trunc('day', NOW()) - INTERVAL '4 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '4 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b1, c4, ARRAY[s7], 'Seeded Service', 'Customer 15',
    (date_trunc('day', NOW()) - INTERVAL '7 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '7 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b1, c8, ARRAY[s6], 'Seeded Service', 'Customer 16',
    (date_trunc('day', NOW()) - INTERVAL '9 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '9 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c5, ARRAY[s3], 'Seeded Service', 'Customer 17',
    (date_trunc('day', NOW()) - INTERVAL '12 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '12 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'no_show', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b1, c9, ARRAY[s6], 'Seeded Service', 'Customer 18',
    (date_trunc('day', NOW()) - INTERVAL '27 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '27 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c6, ARRAY[s2], 'Seeded Service', 'Customer 19',
    (date_trunc('day', NOW()) - INTERVAL '16 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '16 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'no_show', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c7, ARRAY[s6], 'Seeded Service', 'Customer 20',
    (date_trunc('day', NOW()) - INTERVAL '14 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '14 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c4, ARRAY[s6], 'Seeded Service', 'Customer 21',
    (date_trunc('day', NOW()) - INTERVAL '27 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '27 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c9, ARRAY[s4], 'Seeded Service', 'Customer 22',
    (date_trunc('day', NOW()) - INTERVAL '4 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '4 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'no_show', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b1, c9, ARRAY[s9], 'Seeded Service', 'Customer 23',
    (date_trunc('day', NOW()) - INTERVAL '9 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '9 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'no_show', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c10, ARRAY[s6], 'Seeded Service', 'Customer 24',
    (date_trunc('day', NOW()) - INTERVAL '16 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '16 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'no_show', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c7, ARRAY[s9], 'Seeded Service', 'Customer 25',
    (date_trunc('day', NOW()) - INTERVAL '10 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '10 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'no_show', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c7, ARRAY[s6], 'Seeded Service', 'Customer 26',
    (date_trunc('day', NOW()) - INTERVAL '27 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '27 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b1, c1, ARRAY[s5], 'Seeded Service', 'Customer 27',
    (date_trunc('day', NOW()) - INTERVAL '13 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '13 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b1, c9, ARRAY[s8], 'Seeded Service', 'Customer 28',
    (date_trunc('day', NOW()) - INTERVAL '30 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '30 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'no_show', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b1, c7, ARRAY[s1], 'Seeded Service', 'Customer 29',
    (date_trunc('day', NOW()) - INTERVAL '26 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '26 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'no_show', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c10, ARRAY[s2], 'Seeded Service', 'Customer 30',
    (date_trunc('day', NOW()) - INTERVAL '4 days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '4 days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    'completed', 10, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c2, ARRAY[s2], 'Seeded Service', 'Customer Upcoming 1',
    (date_trunc('day', NOW()) + INTERVAL '3 days' + INTERVAL '14 hours')::timestamptz,
    (date_trunc('day', NOW()) + INTERVAL '3 days' + INTERVAL '14 hours 30 minutes')::timestamptz,
    'pending', 15, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b1, c3, ARRAY[s1], 'Seeded Service', 'Customer Upcoming 2',
    (date_trunc('day', NOW()) + INTERVAL '4 days' + INTERVAL '14 hours')::timestamptz,
    (date_trunc('day', NOW()) + INTERVAL '4 days' + INTERVAL '14 hours 30 minutes')::timestamptz,
    'pending', 15, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c4, ARRAY[s3], 'Seeded Service', 'Customer Upcoming 3',
    (date_trunc('day', NOW()) + INTERVAL '7 days' + INTERVAL '14 hours')::timestamptz,
    (date_trunc('day', NOW()) + INTERVAL '7 days' + INTERVAL '14 hours 30 minutes')::timestamptz,
    'pending', 15, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b1, c7, ARRAY[s6], 'Seeded Service', 'Customer Upcoming 4',
    (date_trunc('day', NOW()) + INTERVAL '3 days' + INTERVAL '14 hours')::timestamptz,
    (date_trunc('day', NOW()) + INTERVAL '3 days' + INTERVAL '14 hours 30 minutes')::timestamptz,
    'pending', 15, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c8, ARRAY[s9], 'Seeded Service', 'Customer Upcoming 5',
    (date_trunc('day', NOW()) + INTERVAL '5 days' + INTERVAL '14 hours')::timestamptz,
    (date_trunc('day', NOW()) + INTERVAL '5 days' + INTERVAL '14 hours 30 minutes')::timestamptz,
    'pending', 15, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b1, c6, ARRAY[s1], 'Seeded Service', 'Customer Upcoming 6',
    (date_trunc('day', NOW()) + INTERVAL '4 days' + INTERVAL '14 hours')::timestamptz,
    (date_trunc('day', NOW()) + INTERVAL '4 days' + INTERVAL '14 hours 30 minutes')::timestamptz,
    'pending', 15, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c3, ARRAY[s9], 'Seeded Service', 'Customer Upcoming 7',
    (date_trunc('day', NOW()) + INTERVAL '5 days' + INTERVAL '14 hours')::timestamptz,
    (date_trunc('day', NOW()) + INTERVAL '5 days' + INTERVAL '14 hours 30 minutes')::timestamptz,
    'pending', 15, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c9, ARRAY[s5], 'Seeded Service', 'Customer Upcoming 8',
    (date_trunc('day', NOW()) + INTERVAL '3 days' + INTERVAL '14 hours')::timestamptz,
    (date_trunc('day', NOW()) + INTERVAL '3 days' + INTERVAL '14 hours 30 minutes')::timestamptz,
    'pending', 15, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b1, c6, ARRAY[s2], 'Seeded Service', 'Customer Upcoming 9',
    (date_trunc('day', NOW()) + INTERVAL '1 days' + INTERVAL '14 hours')::timestamptz,
    (date_trunc('day', NOW()) + INTERVAL '1 days' + INTERVAL '14 hours 30 minutes')::timestamptz,
    'pending', 15, 'online'
  );
  
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, b2, c5, ARRAY[s3], 'Seeded Service', 'Customer Upcoming 10',
    (date_trunc('day', NOW()) + INTERVAL '3 days' + INTERVAL '14 hours')::timestamptz,
    (date_trunc('day', NOW()) + INTERVAL '3 days' + INTERVAL '14 hours 30 minutes')::timestamptz,
    'pending', 15, 'online'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c4, 4, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c7, 4, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c6, 5, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c1, 4, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c2, 5, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c5, 5, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c4, 4, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c4, 4, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c2, 4, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c9, 4, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c8, 5, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c6, 4, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c7, 5, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c3, 4, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c10, 5, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c9, 4, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c5, 5, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c4, 4, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c9, 4, 'Great haircut and excellent service! Highly recommend.'
  );
  
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, c4, 4, 'Great haircut and excellent service! Highly recommend.'
  );
  
END $$;
