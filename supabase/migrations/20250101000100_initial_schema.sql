-- Halaqy MVP Schema
-- Run this in the Supabase SQL Editor to create all tables
--
-- (Replay guards added 2026-11: production was built in the SQL editor and
-- already has shops/profiles/services/clients/appointments/leads/daily_sales
-- plus most of these policies. Every statement here is now IF NOT EXISTS /
-- drop-then-create so `supabase db push --include-all` can replay this file on
-- top of production; on a fresh database the result is unchanged.)

-- ============================================
-- SHOPS
-- ============================================
CREATE TABLE IF NOT EXISTS public.shops (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL,
  email TEXT,
  phone TEXT,
  address TEXT,
  instagram TEXT,
  google_maps_url TEXT,
  daily_goal NUMERIC(10,2) DEFAULT 120,
  settings JSONB DEFAULT '{}',
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- PROFILES (linked to auth.users)
-- ============================================
CREATE TABLE IF NOT EXISTS public.profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  role TEXT NOT NULL DEFAULT 'shop_admin' CHECK (role IN ('shop_admin', 'barber')),
  name TEXT NOT NULL,
  avatar_url TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- SERVICES
-- ============================================
CREATE TABLE IF NOT EXISTS public.services (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  price NUMERIC(10,2) NOT NULL,
  duration INT NOT NULL,
  icon TEXT DEFAULT 'scissors',
  is_active BOOLEAN DEFAULT true,
  sort_order INT DEFAULT 0,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- BARBERS
-- ============================================
CREATE TABLE IF NOT EXISTS public.barbers (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  profile_id UUID REFERENCES public.profiles(id) ON DELETE SET NULL,
  name TEXT NOT NULL,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- CLIENTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.clients (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  source TEXT CHECK (source IN ('instagram', 'google', 'word_of_mouth', 'walk_in', 'other')),
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- APPOINTMENTS
-- ============================================
CREATE TABLE IF NOT EXISTS public.appointments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  barber_id UUID NOT NULL REFERENCES public.barbers(id) ON DELETE CASCADE,
  client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
  service_ids UUID[] NOT NULL DEFAULT '{}',
  date DATE NOT NULL,
  start_time TIME NOT NULL,
  end_time TIME NOT NULL,
  status TEXT NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'confirmed', 'completed', 'no_show', 'cancelled')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_appointments_shop_date ON public.appointments(shop_id, date);
CREATE INDEX IF NOT EXISTS idx_appointments_barber_date ON public.appointments(barber_id, date);

-- ============================================
-- LEADS
-- ============================================
CREATE TABLE IF NOT EXISTS public.leads (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  value NUMERIC(10,2) DEFAULT 0,
  stage TEXT NOT NULL DEFAULT 'new' CHECK (stage IN ('new', 'contacted', 'booked', 'completed', 'loyal')),
  notes TEXT,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- ============================================
-- DAILY SALES
-- ============================================
CREATE TABLE IF NOT EXISTS public.daily_sales (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  client_name TEXT NOT NULL,
  service_name TEXT NOT NULL,
  barber_name TEXT NOT NULL,
  amount NUMERIC(10,2) NOT NULL,
  payment_method TEXT NOT NULL CHECK (payment_method IN ('cash', 'card')),
  time TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_daily_sales_shop_date ON public.daily_sales(shop_id, created_at);

-- ============================================
-- ROW LEVEL SECURITY
-- ============================================

ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.barbers ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;

-- Helper: get current user's shop_id
CREATE OR REPLACE FUNCTION public.get_user_shop_id()
RETURNS UUID AS $$
  SELECT shop_id FROM public.profiles WHERE id = auth.uid()
$$ LANGUAGE sql SECURITY DEFINER STABLE;

-- SHOPS: users can read/update their own shop
DROP POLICY IF EXISTS "Users can view own shop" ON public.shops;
CREATE POLICY "Users can view own shop" ON public.shops
  FOR SELECT USING (id = public.get_user_shop_id());
DROP POLICY IF EXISTS "Users can update own shop" ON public.shops;
CREATE POLICY "Users can update own shop" ON public.shops
  FOR UPDATE USING (id = public.get_user_shop_id());

-- PROFILES: users can read profiles in their shop
DROP POLICY IF EXISTS "Users can view shop profiles" ON public.profiles;
CREATE POLICY "Users can view shop profiles" ON public.profiles
  FOR SELECT USING (shop_id = public.get_user_shop_id());
DROP POLICY IF EXISTS "Users can update own profile" ON public.profiles;
CREATE POLICY "Users can update own profile" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- SERVICES: read by shop members, public read for booking
DROP POLICY IF EXISTS "Shop members can manage services" ON public.services;
CREATE POLICY "Shop members can manage services" ON public.services
  FOR ALL USING (shop_id = public.get_user_shop_id());
DROP POLICY IF EXISTS "Public can read active services" ON public.services;
CREATE POLICY "Public can read active services" ON public.services
  FOR SELECT USING (is_active = true);

-- BARBERS: read by shop members, public read for booking
DROP POLICY IF EXISTS "Shop members can manage barbers" ON public.barbers;
CREATE POLICY "Shop members can manage barbers" ON public.barbers
  FOR ALL USING (shop_id = public.get_user_shop_id());
DROP POLICY IF EXISTS "Public can read active barbers" ON public.barbers;
CREATE POLICY "Public can read active barbers" ON public.barbers
  FOR SELECT USING (is_active = true);

-- CLIENTS: shop members only
DROP POLICY IF EXISTS "Shop members can manage clients" ON public.clients;
CREATE POLICY "Shop members can manage clients" ON public.clients
  FOR ALL USING (shop_id = public.get_user_shop_id());
-- Public can insert clients (from booking)
DROP POLICY IF EXISTS "Public can create clients" ON public.clients;
CREATE POLICY "Public can create clients" ON public.clients
  FOR INSERT WITH CHECK (true);

-- APPOINTMENTS: shop members + public insert
DROP POLICY IF EXISTS "Shop members can manage appointments" ON public.appointments;
CREATE POLICY "Shop members can manage appointments" ON public.appointments
  FOR ALL USING (shop_id = public.get_user_shop_id());
DROP POLICY IF EXISTS "Public can create appointments" ON public.appointments;
CREATE POLICY "Public can create appointments" ON public.appointments
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "Public can read appointments for availability" ON public.appointments;
CREATE POLICY "Public can read appointments for availability" ON public.appointments
  FOR SELECT USING (true);

-- LEADS: shop members only
DROP POLICY IF EXISTS "Shop members can manage leads" ON public.leads;
CREATE POLICY "Shop members can manage leads" ON public.leads
  FOR ALL USING (shop_id = public.get_user_shop_id());

-- DAILY SALES: shop members only
DROP POLICY IF EXISTS "Shop members can manage sales" ON public.daily_sales;
CREATE POLICY "Shop members can manage sales" ON public.daily_sales
  FOR ALL USING (shop_id = public.get_user_shop_id());

-- ============================================
-- AUTO-UPDATE updated_at on shops
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS on_shops_updated ON public.shops;
CREATE TRIGGER on_shops_updated
  BEFORE UPDATE ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- ============================================
-- AUTO-CREATE profile on signup
-- ============================================
CREATE OR REPLACE FUNCTION public.handle_new_user()
RETURNS TRIGGER AS $$
DECLARE
  new_shop_id UUID;
BEGIN
  INSERT INTO public.shops (name) VALUES (COALESCE(NEW.raw_user_meta_data->>'shop_name', 'My Shop'))
  RETURNING id INTO new_shop_id;

  INSERT INTO public.profiles (id, shop_id, role, name)
  VALUES (NEW.id, new_shop_id, 'shop_admin', COALESCE(NEW.raw_user_meta_data->>'name', 'Admin'));

  -- Seed default services
  INSERT INTO public.services (shop_id, name, price, duration, icon, sort_order) VALUES
    (new_shop_id, 'Premium Haircut', 12, 45, 'scissors', 1),
    (new_shop_id, 'Beard Trim & Shape', 8, 30, 'scissors', 2),
    (new_shop_id, 'Haircut + Beard', 15, 60, 'scissors', 3),
    (new_shop_id, 'Hot Towel Shave', 10, 30, 'sparkles', 4),
    (new_shop_id, 'Kids Haircut', 7, 30, 'scissors', 5),
    (new_shop_id, 'Full Grooming Package', 20.5, 75, 'sparkles', 6),
    (new_shop_id, 'Hair Coloring', 25, 90, 'palette', 7),
    (new_shop_id, 'Facial Treatment', 18, 45, 'heart', 8);

  -- Seed default barber
  INSERT INTO public.barbers (shop_id, name) VALUES (new_shop_id, COALESCE(NEW.raw_user_meta_data->>'name', 'Admin'));

  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS on_auth_user_created ON auth.users;
CREATE TRIGGER on_auth_user_created
  AFTER INSERT ON auth.users
  FOR EACH ROW EXECUTE FUNCTION public.handle_new_user();
