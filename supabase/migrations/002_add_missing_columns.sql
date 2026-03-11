-- ============================================
-- Add missing columns to existing tables
-- Run this in the Supabase SQL Editor
-- ============================================

-- SHOPS: add contact/social fields + daily_goal
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS email TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS phone TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS instagram TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS google_maps_url TEXT;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS daily_goal NUMERIC(10,2) DEFAULT 120;

-- SERVICES: add icon, is_active, sort_order for UI
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS icon TEXT DEFAULT 'scissors';
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS is_active BOOLEAN DEFAULT true;
ALTER TABLE public.services ADD COLUMN IF NOT EXISTS sort_order INT DEFAULT 0;

-- CLIENTS: add source for acquisition tracking
ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS source TEXT;

-- APPOINTMENTS: add source for tracking where booking came from
ALTER TABLE public.appointments ADD COLUMN IF NOT EXISTS source TEXT;

-- ============================================
-- DAILY SALES table (for revenue tracking)
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
  sale_time TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.daily_sales ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_daily_sales_shop_date
  ON public.daily_sales(shop_id, created_at);

-- RLS for daily_sales
CREATE POLICY "Shop members can manage sales" ON public.daily_sales
  FOR ALL TO authenticated
  USING (shop_id = public.get_current_shop_id());

-- ============================================
-- Allow public (anon) to read appointments for availability checks
-- ============================================
DO $$ BEGIN
  CREATE POLICY "Public can read appointments for availability"
    ON public.appointments FOR SELECT TO anon USING (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow public to insert clients (from booking flow)
DO $$ BEGIN
  CREATE POLICY "Public can insert clients"
    ON public.clients FOR INSERT TO anon WITH CHECK (true);
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow admins to update their shop
DO $$ BEGIN
  CREATE POLICY "Admins can update their shop"
    ON public.shops FOR UPDATE TO authenticated
    USING (id = public.get_current_shop_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;

-- Allow admins to manage services
DO $$ BEGIN
  CREATE POLICY "Admins can manage services"
    ON public.services FOR ALL TO authenticated
    USING (shop_id = public.get_current_shop_id());
EXCEPTION WHEN duplicate_object THEN NULL;
END $$;
