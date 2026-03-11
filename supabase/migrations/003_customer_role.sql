-- ============================================
-- Add 'customer' role and allow customer signups
-- Run this in the Supabase SQL Editor
-- ============================================

-- Add 'customer' to user_role enum
ALTER TYPE user_role ADD VALUE IF NOT EXISTS 'customer';

-- Make shop_id nullable on profiles (customers don't belong to a shop)
ALTER TABLE public.profiles ALTER COLUMN shop_id DROP NOT NULL;

-- Allow customers to read their own profile
CREATE POLICY "Users can read own profile" ON public.profiles
  FOR SELECT TO authenticated
  USING (id = auth.uid());

-- Allow customers to read appointments they booked
DO $$ BEGIN
  CREATE POLICY "Customers can view their appointments"
    ON public.appointments FOR SELECT TO authenticated
    USING (
      client_id IN (
        SELECT c.id FROM public.clients c
        WHERE c.email = (SELECT email FROM auth.users WHERE id = auth.uid())
        OR c.phone = (SELECT phone FROM auth.users WHERE id = auth.uid())
      )
      OR shop_id = public.get_current_shop_id()
    );
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Replace the handle_new_user trigger to support roles
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS trigger AS $$
DECLARE
  signup_role TEXT;
  new_shop_id UUID;
BEGIN
  signup_role := COALESCE(new.raw_user_meta_data->>'role', 'shop_admin');

  IF signup_role = 'customer' THEN
    INSERT INTO public.profiles (id, shop_id, role, full_name)
    VALUES (new.id, NULL, 'customer', COALESCE(new.raw_user_meta_data->>'full_name', 'Customer'));
  ELSIF signup_role = 'barber' THEN
    -- Barbers sign up but need to be assigned to a shop later via invite
    INSERT INTO public.profiles (id, shop_id, role, full_name)
    VALUES (new.id, NULL, 'barber', COALESCE(new.raw_user_meta_data->>'full_name', 'Barber'));
  ELSE
    -- Default: shop_admin -- create shop + profile + seed services
    new_shop_id := gen_random_uuid();
    INSERT INTO public.shops (id, name) VALUES (new_shop_id, COALESCE(new.raw_user_meta_data->>'shop_name', 'My Barbershop'));
    INSERT INTO public.profiles (id, shop_id, role, full_name)
    VALUES (new.id, new_shop_id, 'shop_admin', COALESCE(new.raw_user_meta_data->>'full_name', 'Admin'));

    -- Seed default services
    INSERT INTO public.services (shop_id, name, name_ar, duration, price, icon, sort_order) VALUES
      (new_shop_id, 'Premium Haircut', 'قص شعر فاخر', 45, 12, 'scissors', 1),
      (new_shop_id, 'Beard Trim & Shape', 'تشذيب اللحية', 30, 8, 'scissors', 2),
      (new_shop_id, 'Haircut + Beard', 'قص شعر + لحية', 60, 15, 'scissors', 3),
      (new_shop_id, 'Hot Towel Shave', 'حلاقة بالمنشفة', 30, 10, 'scissors', 4),
      (new_shop_id, 'Kids Haircut', 'قص شعر أطفال', 30, 7, 'scissors', 5),
      (new_shop_id, 'Full Grooming', 'عناية كاملة', 75, 20.5, 'sparkles', 6);
  END IF;

  RETURN new;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
