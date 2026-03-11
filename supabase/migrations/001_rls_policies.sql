-- ═══════════════════════════════════════════════════════
-- LUMINA — RLS Policies & Helper Functions
-- Run this in Supabase SQL Editor
-- ═══════════════════════════════════════════════════════

-- ─── Helper: get current user's shop_id ───
CREATE OR REPLACE FUNCTION public.get_current_shop_id()
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
AS $$
  SELECT shop_id FROM public.profiles WHERE id = auth.uid();
$$;

-- ─── Enable RLS on all tables ───
ALTER TABLE public.shops ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.services ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.appointments ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.clients ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.leads ENABLE ROW LEVEL SECURITY;

-- ═══════════════════════════════════════════════════════
-- SHOPS
-- ═══════════════════════════════════════════════════════

-- Authenticated users can only see their own shop
CREATE POLICY "shops_select_own" ON public.shops
  FOR SELECT USING (id = public.get_current_shop_id());

-- Shop admins can update their own shop
CREATE POLICY "shops_update_own" ON public.shops
  FOR UPDATE USING (id = public.get_current_shop_id());

-- Anon can read shops (needed for public booking page)
CREATE POLICY "shops_select_anon" ON public.shops
  FOR SELECT TO anon USING (true);

-- ═══════════════════════════════════════════════════════
-- PROFILES
-- ═══════════════════════════════════════════════════════

-- Users can read profiles in their shop
CREATE POLICY "profiles_select_same_shop" ON public.profiles
  FOR SELECT USING (shop_id = public.get_current_shop_id());

-- Users can update their own profile
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = auth.uid());

-- Shop admins can insert profiles (invite barbers)
CREATE POLICY "profiles_insert_admin" ON public.profiles
  FOR INSERT WITH CHECK (
    shop_id = public.get_current_shop_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'shop_admin'
    )
  );

-- Anon can read profiles (barber list for public booking)
CREATE POLICY "profiles_select_anon" ON public.profiles
  FOR SELECT TO anon USING (true);

-- ═══════════════════════════════════════════════════════
-- SERVICES
-- ═══════════════════════════════════════════════════════

-- Authenticated users can see services in their shop
CREATE POLICY "services_select_own_shop" ON public.services
  FOR SELECT USING (shop_id = public.get_current_shop_id());

-- Shop admins can manage services
CREATE POLICY "services_insert_admin" ON public.services
  FOR INSERT WITH CHECK (
    shop_id = public.get_current_shop_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'shop_admin'
    )
  );

CREATE POLICY "services_update_admin" ON public.services
  FOR UPDATE USING (
    shop_id = public.get_current_shop_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'shop_admin'
    )
  );

CREATE POLICY "services_delete_admin" ON public.services
  FOR DELETE USING (
    shop_id = public.get_current_shop_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'shop_admin'
    )
  );

-- Anon can read services (needed for public booking page)
CREATE POLICY "services_select_anon" ON public.services
  FOR SELECT TO anon USING (true);

-- ═══════════════════════════════════════════════════════
-- APPOINTMENTS
-- ═══════════════════════════════════════════════════════

-- Shop admins see all shop appointments; barbers see only their own
CREATE POLICY "appointments_select" ON public.appointments
  FOR SELECT USING (
    shop_id = public.get_current_shop_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'shop_admin'
      )
      OR barber_id = auth.uid()
    )
  );

-- Shop admins can insert appointments
CREATE POLICY "appointments_insert_admin" ON public.appointments
  FOR INSERT WITH CHECK (shop_id = public.get_current_shop_id());

-- Anon can insert appointments (public booking)
CREATE POLICY "appointments_insert_anon" ON public.appointments
  FOR INSERT TO anon WITH CHECK (true);

-- Shop admins and assigned barbers can update appointments
CREATE POLICY "appointments_update" ON public.appointments
  FOR UPDATE USING (
    shop_id = public.get_current_shop_id()
    AND (
      EXISTS (
        SELECT 1 FROM public.profiles
        WHERE id = auth.uid() AND role = 'shop_admin'
      )
      OR barber_id = auth.uid()
    )
  );

-- ═══════════════════════════════════════════════════════
-- CLIENTS
-- ═══════════════════════════════════════════════════════

-- Only same-shop users can access clients
CREATE POLICY "clients_select_own_shop" ON public.clients
  FOR SELECT USING (shop_id = public.get_current_shop_id());

CREATE POLICY "clients_insert_own_shop" ON public.clients
  FOR INSERT WITH CHECK (shop_id = public.get_current_shop_id());

-- Anon can insert clients (created during booking)
CREATE POLICY "clients_insert_anon" ON public.clients
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "clients_update_own_shop" ON public.clients
  FOR UPDATE USING (shop_id = public.get_current_shop_id());

-- ═══════════════════════════════════════════════════════
-- LEADS
-- ═══════════════════════════════════════════════════════

-- Only shop admins can manage leads
CREATE POLICY "leads_select_own_shop" ON public.leads
  FOR SELECT USING (
    shop_id = public.get_current_shop_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'shop_admin'
    )
  );

CREATE POLICY "leads_insert_admin" ON public.leads
  FOR INSERT WITH CHECK (
    shop_id = public.get_current_shop_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'shop_admin'
    )
  );

CREATE POLICY "leads_update_admin" ON public.leads
  FOR UPDATE USING (
    shop_id = public.get_current_shop_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'shop_admin'
    )
  );

CREATE POLICY "leads_delete_admin" ON public.leads
  FOR DELETE USING (
    shop_id = public.get_current_shop_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'shop_admin'
    )
  );
