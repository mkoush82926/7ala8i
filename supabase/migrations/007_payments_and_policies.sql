-- ============================================
-- Payments, deposits, and cancellation policies
-- Run this in the Supabase SQL Editor
-- ============================================

-- SHOPS: payment & cancellation configuration
ALTER TABLE public.shops
  ADD COLUMN IF NOT EXISTS currency TEXT DEFAULT 'USD',
  ADD COLUMN IF NOT EXISTS require_deposit BOOLEAN DEFAULT false,
  ADD COLUMN IF NOT EXISTS deposit_type TEXT DEFAULT 'percentage' CHECK (deposit_type IN ('percentage', 'fixed')),
  ADD COLUMN IF NOT EXISTS deposit_value NUMERIC(10,2) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cancellation_policy_hours INT DEFAULT 24,
  ADD COLUMN IF NOT EXISTS cancellation_fee_percent NUMERIC(5,2) DEFAULT 0;

-- APPOINTMENTS: payment state
ALTER TABLE public.appointments
  ADD COLUMN IF NOT EXISTS payment_status TEXT DEFAULT 'unpaid'
    CHECK (payment_status IN ('unpaid', 'deposit_paid', 'paid', 'refunded', 'no_show_charged')),
  ADD COLUMN IF NOT EXISTS payment_method TEXT
    CHECK (payment_method IN ('cash', 'card', 'online', 'mixed')),
  ADD COLUMN IF NOT EXISTS amount_total NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS amount_deposit NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS amount_paid NUMERIC(10,2),
  ADD COLUMN IF NOT EXISTS currency TEXT,
  ADD COLUMN IF NOT EXISTS cancelled_at TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS cancellation_reason TEXT,
  ADD COLUMN IF NOT EXISTS no_show BOOLEAN DEFAULT false;

-- PAYMENTS: individual payment records (Stripe, cash, etc.)
CREATE TABLE IF NOT EXISTS public.payments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
  client_id UUID REFERENCES public.clients(id) ON DELETE SET NULL,
  amount NUMERIC(10,2) NOT NULL,
  currency TEXT NOT NULL DEFAULT 'USD',
  method TEXT NOT NULL CHECK (method IN ('cash', 'card', 'online', 'mixed')),
  provider TEXT,
  provider_payment_intent_id TEXT,
  status TEXT NOT NULL DEFAULT 'completed',
  metadata JSONB DEFAULT '{}'::jsonb,
  created_at TIMESTAMPTZ DEFAULT now()
);

ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

CREATE INDEX IF NOT EXISTS idx_payments_shop_created
  ON public.payments (shop_id, created_at DESC);

CREATE INDEX IF NOT EXISTS idx_payments_appointment
  ON public.payments (appointment_id);

-- RLS for payments
DO $$
BEGIN
  CREATE POLICY "Shop members can manage payments"
    ON public.payments
    FOR ALL
    TO authenticated
    USING (shop_id = public.get_current_shop_id());
EXCEPTION
  WHEN duplicate_object THEN NULL;
END $$;

