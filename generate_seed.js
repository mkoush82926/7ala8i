const fs = require('fs');

const managerId = '017ebd83-2992-414f-a28f-82473123930f';
const proId = 'ba5e80ea-30e5-4872-8314-53873df9b295';
const customId = '54aa833d-926b-49da-b1c9-883600a94a85';

let sql = `
-- Fix manager profile and shop
UPDATE profiles SET role = 'shop_admin' WHERE id = '${managerId}';
UPDATE profiles SET role = 'barber' WHERE id = '${proId}';
UPDATE profiles SET role = 'customer' WHERE id = '${customId}';

DO $$
DECLARE
  manager_id UUID := '${managerId}';
  professional_id UUID := '${proId}';
  customer_id UUID := '${customId}';
  
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

`;

// Generate 30 past appointments
for (let i = 1; i <= 30; i++) {
  const dayOffset = Math.floor(Math.random() * 30) + 1; // 1 to 30 days ago
  const statuses = ['completed', 'completed', 'completed', 'cancelled', 'no_show'];
  const status = statuses[Math.floor(Math.random() * statuses.length)];
  const b = Math.random() > 0.5 ? 'b1' : 'b2';
  const c = `c${Math.floor(Math.random() * 10) + 1}`;
  const s = `s${Math.floor(Math.random() * 10) + 1}`;
  
  sql += `
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, ${b}, ${c}, ARRAY[${s}], 'Seeded Service', 'Customer ${i}',
    (date_trunc('day', NOW()) - INTERVAL '${dayOffset} days' + INTERVAL '10 hours')::timestamptz,
    (date_trunc('day', NOW()) - INTERVAL '${dayOffset} days' + INTERVAL '10 hours 30 minutes')::timestamptz,
    '${status}', 10, 'online'
  );
  `;
}

// Generate 10 upcoming appointments
for (let i = 1; i <= 10; i++) {
  const dayOffset = Math.floor(Math.random() * 7) + 1; // 1 to 7 days ahead
  const b = Math.random() > 0.5 ? 'b1' : 'b2';
  const c = `c${Math.floor(Math.random() * 10) + 1}`;
  const s = `s${Math.floor(Math.random() * 10) + 1}`;
  
  sql += `
  INSERT INTO appointments (shop_id, barber_id, client_id, service_ids, service_name, client_name, start_time, end_time, status, price, source)
  VALUES (
    shop1_id, ${b}, ${c}, ARRAY[${s}], 'Seeded Service', 'Customer Upcoming ${i}',
    (date_trunc('day', NOW()) + INTERVAL '${dayOffset} days' + INTERVAL '14 hours')::timestamptz,
    (date_trunc('day', NOW()) + INTERVAL '${dayOffset} days' + INTERVAL '14 hours 30 minutes')::timestamptz,
    'pending', 15, 'online'
  );
  `;
}

// Generate 20 reviews
for (let i = 1; i <= 20; i++) {
  const rating = Math.floor(Math.random() * 2) + 4; // 4 or 5
  const c = `c${Math.floor(Math.random() * 10) + 1}`;
  sql += `
  INSERT INTO reviews (shop_id, client_id, rating, comment)
  VALUES (
    shop1_id, ${c}, ${rating}, 'Great haircut and excellent service! Highly recommend.'
  );
  `;
}

sql += `
END $$;
`;

fs.writeFileSync('seed.sql', sql);
console.log('SQL generated!');
