-- ═══════════════════════════════════════════════════════════════════════════
-- WS-1F · Hours UI, closures and checkout v1
--
--   1. Shop checkout settings (tax rate, cash rounding, receipt prefix/footer)
--   2. payment_methods  (per shop, configurable; seeded for every shop)
--   3. products         (retail lines such as wax or beard oil; no stock mgmt)
--   4. receipt_sequences + sales / sale_items / sale_payments / sale_tips
--   5. Legacy daily_sales rows backfilled into sales; daily_sales becomes a
--      security_invoker VIEW with the exact same columns, so dashboard,
--      analytics and dashboard_metrics() keep returning the same numbers.
--   6. Payment-method CHECK constraints dropped in favour of the
--      sale_payments.method_id FK (appointments keep a format-only check).
--   7. RPCs: checkout_sale, add_sale_payments, void_sale, get_sale_receipt and
--      a rewritten complete_appointment_sale (same signature + return keys).
--
-- Tax model (roadmap §3, decided): displayed prices INCLUDE tax; tax is
-- computed per line and rounded to the fils; the sale total is the sum of the
-- lines. Tax lines only when shops.is_tax_registered.
--
-- Receipt numbers: one row per shop in receipt_sequences, incremented with
-- INSERT … ON CONFLICT DO UPDATE inside the checkout transaction. The row lock
-- serialises concurrent checkouts and a rolled-back checkout rolls the counter
-- back, so numbers are gapless per shop.
--
-- appointment_services (WS-1D, migration 002300) is referenced only through
-- to_regclass()/dynamic SQL, so this file applies with or without it.
--
-- Idempotent: safe to re-run; safe on production data (no NOT NULL/CHECK that
-- existing rows violate; legacy rows are copied, never deleted).
-- ═══════════════════════════════════════════════════════════════════════════

-- ─── 1. Shop checkout settings ─────────────────────────────────────────────
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS tax_rate numeric(5,2) NOT NULL DEFAULT 16;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS cash_rounding numeric(4,3) NOT NULL DEFAULT 0;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS receipt_prefix text;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS receipt_footer_en text;
ALTER TABLE public.shops ADD COLUMN IF NOT EXISTS receipt_footer_ar text;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_tax_rate_range' AND conrelid = 'public.shops'::regclass) THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_tax_rate_range CHECK (tax_rate >= 0 AND tax_rate <= 100);
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_cash_rounding_values' AND conrelid = 'public.shops'::regclass) THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_cash_rounding_values CHECK (cash_rounding IN (0, 0.05, 0.1, 0.25, 0.5));
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_receipt_prefix_format' AND conrelid = 'public.shops'::regclass) THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_receipt_prefix_format
      CHECK (receipt_prefix IS NULL OR receipt_prefix ~ '^[A-Z0-9]{1,8}$') NOT VALID;
  END IF;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'shops_receipt_footer_len' AND conrelid = 'public.shops'::regclass) THEN
    ALTER TABLE public.shops ADD CONSTRAINT shops_receipt_footer_len
      CHECK (coalesce(length(receipt_footer_en), 0) <= 300 AND coalesce(length(receipt_footer_ar), 0) <= 300) NOT VALID;
  END IF;
END $$;

-- shops uses column-level SELECT grants (P0). These are back-office settings:
-- staff (authenticated) may read them, anon may not.
REVOKE SELECT (tax_rate, cash_rounding, receipt_prefix, receipt_footer_en, receipt_footer_ar) ON public.shops FROM anon;
GRANT  SELECT (tax_rate, cash_rounding, receipt_prefix, receipt_footer_en, receipt_footer_ar) ON public.shops TO authenticated;

-- ─── 2. payment_methods ────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.payment_methods (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  code        text NOT NULL,
  name_en     text NOT NULL,
  name_ar     text NOT NULL,
  kind        text NOT NULL DEFAULT 'other',
  cliq_alias  text,
  qr_url      text,
  is_active   boolean NOT NULL DEFAULT true,
  is_system   boolean NOT NULL DEFAULT false,
  sort        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT payment_methods_shop_code_key UNIQUE (shop_id, code),
  CONSTRAINT payment_methods_code_format CHECK (code ~ '^[a-z0-9_]{2,32}$' AND code <> 'mixed'),
  CONSTRAINT payment_methods_kind_check CHECK (kind IN ('cash', 'card', 'cliq', 'wallet', 'bank_transfer', 'online', 'other')),
  CONSTRAINT payment_methods_names_len CHECK (length(btrim(name_en)) BETWEEN 1 AND 60 AND length(btrim(name_ar)) BETWEEN 1 AND 60),
  CONSTRAINT payment_methods_alias_len CHECK (cliq_alias IS NULL OR length(cliq_alias) BETWEEN 1 AND 64),
  CONSTRAINT payment_methods_qr_url CHECK (qr_url IS NULL OR (qr_url ~ '^https://' AND length(qr_url) <= 1000)),
  CONSTRAINT payment_methods_sort_range CHECK (sort BETWEEN 0 AND 1000)
);
CREATE INDEX IF NOT EXISTS idx_payment_methods_shop ON public.payment_methods (shop_id, sort);

ALTER TABLE public.payment_methods ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS set_updated_at ON public.payment_methods;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS payment_methods_select_staff ON public.payment_methods;
DROP POLICY IF EXISTS payment_methods_insert_admin ON public.payment_methods;
DROP POLICY IF EXISTS payment_methods_update_admin ON public.payment_methods;
DROP POLICY IF EXISTS payment_methods_delete_admin ON public.payment_methods;
CREATE POLICY payment_methods_select_staff ON public.payment_methods FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
CREATE POLICY payment_methods_insert_admin ON public.payment_methods FOR INSERT TO authenticated
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()) AND NOT is_system);
CREATE POLICY payment_methods_update_admin ON public.payment_methods FOR UPDATE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));
-- System methods (cash, card, …) can be switched off but never deleted.
CREATE POLICY payment_methods_delete_admin ON public.payment_methods FOR DELETE TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()) AND NOT is_system);

REVOKE ALL ON public.payment_methods FROM anon;
REVOKE ALL ON public.payment_methods FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.payment_methods TO authenticated;
GRANT ALL ON public.payment_methods TO service_role;

-- Code, kind and is_system are immutable for system rows (they anchor legacy
-- sales and the cash-rounding rule); everything else is editable.
CREATE OR REPLACE FUNCTION public.guard_payment_method_update()
RETURNS trigger
LANGUAGE plpgsql
SET search_path = public, pg_temp
AS $$
BEGIN
  IF NEW.shop_id IS DISTINCT FROM OLD.shop_id
     OR NEW.is_system IS DISTINCT FROM OLD.is_system
     OR (OLD.is_system AND (NEW.code IS DISTINCT FROM OLD.code OR NEW.kind IS DISTINCT FROM OLD.kind)) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  RETURN NEW;
END;
$$;
DROP TRIGGER IF EXISTS guard_payment_method_update ON public.payment_methods;
CREATE TRIGGER guard_payment_method_update BEFORE UPDATE ON public.payment_methods
  FOR EACH ROW EXECUTE FUNCTION public.guard_payment_method_update();

-- Default methods for a shop (idempotent). Cash and Card POS start active;
-- CliQ and wallets start off until the owner adds an alias.
CREATE OR REPLACE FUNCTION public.seed_default_payment_methods(p_shop_id uuid)
RETURNS void
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  INSERT INTO public.payment_methods (shop_id, code, name_en, name_ar, kind, is_active, is_system, sort)
  VALUES
    (p_shop_id, 'cash',         'Cash',         'نقدًا',          'cash',   true,  true, 10),
    (p_shop_id, 'card',         'Card (POS)',   'بطاقة',          'card',   true,  true, 20),
    (p_shop_id, 'cliq',         'CliQ',         'كليك',           'cliq',   false, true, 30),
    (p_shop_id, 'zain_cash',    'Zain Cash',    'زين كاش',        'wallet', false, true, 40),
    (p_shop_id, 'orange_money', 'Orange Money', 'أورنج موني',     'wallet', false, true, 50),
    (p_shop_id, 'online',       'Online',       'دفع إلكتروني',   'online', false, true, 60)
  ON CONFLICT (shop_id, code) DO NOTHING;
$$;
REVOKE ALL ON FUNCTION public.seed_default_payment_methods(uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.seed_default_payment_methods(uuid) TO service_role;

CREATE OR REPLACE FUNCTION public.shops_seed_payment_methods()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
BEGIN
  PERFORM public.seed_default_payment_methods(NEW.id);
  RETURN NEW;
END;
$$;
REVOKE ALL ON FUNCTION public.shops_seed_payment_methods() FROM PUBLIC, anon, authenticated;
DROP TRIGGER IF EXISTS shops_seed_payment_methods ON public.shops;
CREATE TRIGGER shops_seed_payment_methods AFTER INSERT ON public.shops
  FOR EACH ROW EXECUTE FUNCTION public.shops_seed_payment_methods();

DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT id FROM public.shops LOOP
    PERFORM public.seed_default_payment_methods(r.id);
  END LOOP;
END $$;

-- ─── 3. products ───────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.products (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  name_en     text NOT NULL,
  name_ar     text,
  price       numeric(10,3) NOT NULL DEFAULT 0,
  sku         text,
  track_stock boolean NOT NULL DEFAULT false,
  is_active   boolean NOT NULL DEFAULT true,
  sort        integer NOT NULL DEFAULT 0,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT products_price_range CHECK (price >= 0 AND price <= 100000),
  CONSTRAINT products_names_len CHECK (length(btrim(name_en)) BETWEEN 1 AND 80 AND (name_ar IS NULL OR length(name_ar) <= 80)),
  CONSTRAINT products_sku_len CHECK (sku IS NULL OR length(sku) BETWEEN 1 AND 64),
  CONSTRAINT products_sort_range CHECK (sort BETWEEN 0 AND 10000)
);
CREATE INDEX IF NOT EXISTS idx_products_shop ON public.products (shop_id, sort);
CREATE UNIQUE INDEX IF NOT EXISTS products_shop_sku_uq ON public.products (shop_id, lower(sku)) WHERE sku IS NOT NULL;

ALTER TABLE public.products ENABLE ROW LEVEL SECURITY;
DROP TRIGGER IF EXISTS set_updated_at ON public.products;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.products
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

DROP POLICY IF EXISTS products_select_staff ON public.products;
DROP POLICY IF EXISTS products_write_admin  ON public.products;
CREATE POLICY products_select_staff ON public.products FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
CREATE POLICY products_write_admin ON public.products FOR ALL TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()))
  WITH CHECK (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_admin()));

REVOKE ALL ON public.products FROM anon;
REVOKE ALL ON public.products FROM authenticated;
GRANT SELECT, INSERT, UPDATE, DELETE ON public.products TO authenticated;
GRANT ALL ON public.products TO service_role;

-- ─── 4. Sales ──────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.receipt_sequences (
  shop_id    uuid PRIMARY KEY REFERENCES public.shops(id) ON DELETE CASCADE,
  last_no    bigint NOT NULL DEFAULT 0 CHECK (last_no >= 0),
  updated_at timestamptz NOT NULL DEFAULT now()
);
ALTER TABLE public.receipt_sequences ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS receipt_sequences_select_staff ON public.receipt_sequences;
CREATE POLICY receipt_sequences_select_staff ON public.receipt_sequences FOR SELECT TO authenticated
  USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()));
REVOKE ALL ON public.receipt_sequences FROM anon;
REVOKE ALL ON public.receipt_sequences FROM authenticated;
GRANT SELECT ON public.receipt_sequences TO authenticated;
GRANT ALL ON public.receipt_sequences TO service_role;

CREATE TABLE IF NOT EXISTS public.sales (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id             uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  client_id           uuid REFERENCES public.clients(id) ON DELETE SET NULL,
  appointment_id      uuid REFERENCES public.appointments(id) ON DELETE SET NULL,
  status              text NOT NULL DEFAULT 'draft',
  currency            text NOT NULL DEFAULT 'JOD',
  subtotal            numeric(12,3) NOT NULL DEFAULT 0,
  discount_total      numeric(12,3) NOT NULL DEFAULT 0,
  discount_reason     text,
  tax_total           numeric(12,3) NOT NULL DEFAULT 0,
  tip_total           numeric(12,3) NOT NULL DEFAULT 0,
  rounding_adjustment numeric(12,3) NOT NULL DEFAULT 0,
  total               numeric(12,3) NOT NULL DEFAULT 0,
  paid_total          numeric(12,3) NOT NULL DEFAULT 0,
  -- Snapshot of the legacy daily_sales display columns.
  payment_method      text,
  client_name         text NOT NULL DEFAULT '',
  barber_name         text NOT NULL DEFAULT '',
  sale_time           text NOT NULL DEFAULT '',
  receipt_no          bigint,
  receipt_number      text,
  tax_registered      boolean NOT NULL DEFAULT false,
  tax_number          text,
  note                text,
  is_legacy           boolean NOT NULL DEFAULT false,
  created_by          uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  completed_at        timestamptz,
  voided_at           timestamptz,
  voided_by           uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  void_reason         text,
  created_at          timestamptz NOT NULL DEFAULT now(),
  updated_at          timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sales_status_check CHECK (status IN ('draft', 'part_paid', 'paid', 'voided', 'refunded')),
  CONSTRAINT sales_amounts_non_negative CHECK (subtotal >= 0 AND discount_total >= 0 AND tax_total >= 0 AND tip_total >= 0 AND total >= 0 AND paid_total >= 0),
  CONSTRAINT sales_paid_le_total CHECK (paid_total <= total),
  CONSTRAINT sales_note_len CHECK ((note IS NULL OR length(note) <= 500) AND (discount_reason IS NULL OR length(discount_reason) <= 200) AND (void_reason IS NULL OR length(void_reason) <= 300))
);
CREATE UNIQUE INDEX IF NOT EXISTS sales_shop_receipt_uq ON public.sales (shop_id, receipt_no) WHERE receipt_no IS NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS sales_appointment_active_uq ON public.sales (appointment_id)
  WHERE appointment_id IS NOT NULL AND status IN ('part_paid', 'paid') AND NOT is_legacy;
CREATE INDEX IF NOT EXISTS idx_sales_shop_created ON public.sales (shop_id, created_at);
CREATE INDEX IF NOT EXISTS idx_sales_appointment ON public.sales (appointment_id);
CREATE INDEX IF NOT EXISTS idx_sales_client ON public.sales (client_id);

CREATE TABLE IF NOT EXISTS public.sale_items (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id         uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  shop_id         uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  kind            text NOT NULL,
  service_id      uuid REFERENCES public.services(id) ON DELETE SET NULL,
  variant_id      uuid,
  product_id      uuid REFERENCES public.products(id) ON DELETE SET NULL,
  barber_id       uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  name            text NOT NULL,
  name_ar         text,
  quantity        integer NOT NULL DEFAULT 1,
  unit_price      numeric(12,3) NOT NULL,
  discount_amount numeric(12,3) NOT NULL DEFAULT 0,
  discount_reason text,
  cart_discount   numeric(12,3) NOT NULL DEFAULT 0,
  line_total      numeric(12,3) NOT NULL,
  tax_rate        numeric(5,2) NOT NULL DEFAULT 0,
  tax_amount      numeric(12,3) NOT NULL DEFAULT 0,
  sort            integer NOT NULL DEFAULT 0,
  created_at      timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sale_items_kind_check CHECK (kind IN ('service', 'product', 'custom')),
  CONSTRAINT sale_items_qty_range CHECK (quantity BETWEEN 1 AND 99),
  CONSTRAINT sale_items_amounts CHECK (unit_price >= 0 AND discount_amount >= 0 AND cart_discount >= 0 AND line_total >= 0 AND tax_amount >= 0 AND tax_rate BETWEEN 0 AND 100),
  CONSTRAINT sale_items_name_len CHECK (length(name) BETWEEN 1 AND 120 AND (name_ar IS NULL OR length(name_ar) <= 120) AND (discount_reason IS NULL OR length(discount_reason) <= 200))
);
CREATE INDEX IF NOT EXISTS idx_sale_items_sale ON public.sale_items (sale_id, sort);
CREATE INDEX IF NOT EXISTS idx_sale_items_shop ON public.sale_items (shop_id);

CREATE TABLE IF NOT EXISTS public.sale_payments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id     uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  shop_id     uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  method_id   uuid REFERENCES public.payment_methods(id) ON DELETE RESTRICT,
  method_code text NOT NULL,
  amount      numeric(12,3) NOT NULL,
  reference   text,
  created_by  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sale_payments_amount_positive CHECK (amount > 0),
  CONSTRAINT sale_payments_reference_len CHECK (reference IS NULL OR length(reference) <= 100)
);
CREATE INDEX IF NOT EXISTS idx_sale_payments_sale ON public.sale_payments (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_payments_shop ON public.sale_payments (shop_id, created_at);

CREATE TABLE IF NOT EXISTS public.sale_tips (
  id         uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  sale_id    uuid NOT NULL REFERENCES public.sales(id) ON DELETE CASCADE,
  shop_id    uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  barber_id  uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  amount     numeric(12,3) NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now(),
  CONSTRAINT sale_tips_amount_positive CHECK (amount > 0)
);
CREATE INDEX IF NOT EXISTS idx_sale_tips_sale ON public.sale_tips (sale_id);
CREATE INDEX IF NOT EXISTS idx_sale_tips_barber ON public.sale_tips (barber_id, created_at);

DROP TRIGGER IF EXISTS set_updated_at ON public.sales;
CREATE TRIGGER set_updated_at BEFORE UPDATE ON public.sales
  FOR EACH ROW EXECUTE FUNCTION public.handle_updated_at();

-- RLS: staff of the shop read; every write goes through the SECURITY DEFINER
-- RPCs below (no INSERT/UPDATE/DELETE policies, no write grants).
DO $$
DECLARE t text;
BEGIN
  FOREACH t IN ARRAY ARRAY['sales', 'sale_items', 'sale_payments', 'sale_tips'] LOOP
    EXECUTE format('ALTER TABLE public.%I ENABLE ROW LEVEL SECURITY', t);
    EXECUTE format('DROP POLICY IF EXISTS %I ON public.%I', t || '_select_staff', t);
    EXECUTE format(
      'CREATE POLICY %I ON public.%I FOR SELECT TO authenticated USING (shop_id = (SELECT public.get_current_shop_id()) AND (SELECT public.is_shop_staff()))',
      t || '_select_staff', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM anon', t);
    EXECUTE format('REVOKE ALL ON public.%I FROM authenticated', t);
    EXECUTE format('GRANT SELECT ON public.%I TO authenticated', t);
    EXECUTE format('GRANT ALL ON public.%I TO service_role', t);
  END LOOP;
END $$;

-- ─── 5. Legacy daily_sales → sales, then daily_sales becomes a view ────────
DO $$
DECLARE
  v_kind char;
BEGIN
  SELECT c.relkind INTO v_kind FROM pg_class c
  WHERE c.relnamespace = 'public'::regnamespace AND c.relname = 'daily_sales';

  IF v_kind = 'r' THEN
    -- Copy every legacy row (same id) as a paid, untaxed, legacy sale.
    INSERT INTO public.sales (id, shop_id, client_id, appointment_id, status, currency, subtotal, discount_total,
                              tax_total, tip_total, total, paid_total, payment_method, client_name, barber_name,
                              sale_time, is_legacy, completed_at, created_at, updated_at)
    SELECT d.id, d.shop_id, a.client_id, d.appointment_id, 'paid', COALESCE(sh.currency, 'JOD'),
           d.amount, 0, 0, 0, d.amount, d.amount, d.payment_method, COALESCE(d.client_name, ''),
           COALESCE(d.barber_name, ''), COALESCE(d.sale_time, ''), true,
           COALESCE(d.created_at, now()), COALESCE(d.created_at, now()), COALESCE(d.created_at, now())
    FROM public.daily_sales d
    JOIN public.shops sh ON sh.id = d.shop_id
    LEFT JOIN public.appointments a ON a.id = d.appointment_id
    WHERE d.amount >= 0
    ON CONFLICT (id) DO NOTHING;

    INSERT INTO public.sale_items (sale_id, shop_id, kind, name, quantity, unit_price, line_total, tax_rate, tax_amount, created_at)
    SELECT d.id, d.shop_id, CASE WHEN d.appointment_id IS NULL THEN 'custom' ELSE 'service' END,
           COALESCE(NULLIF(left(d.service_name, 120), ''), '-'), 1, d.amount, d.amount, 0, 0, COALESCE(d.created_at, now())
    FROM public.daily_sales d
    WHERE d.amount >= 0
      AND EXISTS (SELECT 1 FROM public.sales s WHERE s.id = d.id AND s.is_legacy)
      AND NOT EXISTS (SELECT 1 FROM public.sale_items i WHERE i.sale_id = d.id);

    INSERT INTO public.sale_payments (sale_id, shop_id, method_id, method_code, amount, created_at)
    SELECT d.id, d.shop_id, pm.id, d.payment_method, d.amount, COALESCE(d.created_at, now())
    FROM public.daily_sales d
    LEFT JOIN public.payment_methods pm ON pm.shop_id = d.shop_id AND pm.code = d.payment_method
    WHERE d.amount > 0
      AND EXISTS (SELECT 1 FROM public.sales s WHERE s.id = d.id AND s.is_legacy)
      AND NOT EXISTS (SELECT 1 FROM public.sale_payments p WHERE p.sale_id = d.id);

    -- Keep the original table as a frozen archive (no data loss).
    ALTER TABLE public.daily_sales RENAME TO daily_sales_legacy;
    REVOKE ALL ON public.daily_sales_legacy FROM anon;
    REVOKE INSERT, UPDATE, DELETE, TRUNCATE ON public.daily_sales_legacy FROM authenticated;
    COMMENT ON TABLE public.daily_sales_legacy IS
      'Pre-1F sales log, frozen. Every row was copied into public.sales (same id, is_legacy=true). Read public.daily_sales (a view) instead.';
  END IF;
END $$;

-- Same columns, names and meaning as the old table: one row per sale that
-- took money, amount = money for the work (tips excluded), created_at = sale
-- time. security_invoker makes the sales RLS apply to the caller.
CREATE OR REPLACE VIEW public.daily_sales WITH (security_invoker = true) AS
SELECT
  s.id,
  s.shop_id,
  s.appointment_id,
  s.client_name,
  COALESCE((SELECT string_agg(i.name, ' + ' ORDER BY i.sort, i.created_at)
            FROM public.sale_items i WHERE i.sale_id = s.id), '') AS service_name,
  s.barber_name,
  (CASE WHEN s.status = 'paid' THEN s.total - s.tip_total
        ELSE GREATEST(s.paid_total - s.tip_total, 0) END)::numeric(12,3) AS amount,
  COALESCE(s.payment_method, '') AS payment_method,
  s.sale_time,
  s.created_at
FROM public.sales s
WHERE s.status IN ('paid', 'part_paid');

COMMENT ON VIEW public.daily_sales IS
  'Back-compat view over public.sales (WS-1F). Read-only; write through checkout_sale / complete_appointment_sale.';
REVOKE ALL ON public.daily_sales FROM anon;
REVOKE ALL ON public.daily_sales FROM authenticated;
GRANT SELECT ON public.daily_sales TO authenticated;
GRANT SELECT ON public.daily_sales TO service_role;

-- ─── 6. Payment-method CHECK constraints → FK ──────────────────────────────
-- sale_payments.method_id → payment_methods is the source of truth now.
-- appointments.payment_method keeps a summary code (a method code or 'mixed').
DO $$
DECLARE r record;
BEGIN
  FOR r IN SELECT conname FROM pg_constraint
           WHERE conrelid = 'public.appointments'::regclass AND contype = 'c'
             AND pg_get_constraintdef(oid) ILIKE '%payment_method%' AND conname <> 'appointments_payment_method_format' LOOP
    EXECUTE format('ALTER TABLE public.appointments DROP CONSTRAINT %I', r.conname);
  END LOOP;
  IF NOT EXISTS (SELECT 1 FROM pg_constraint WHERE conname = 'appointments_payment_method_format' AND conrelid = 'public.appointments'::regclass) THEN
    ALTER TABLE public.appointments ADD CONSTRAINT appointments_payment_method_format
      CHECK (payment_method IS NULL OR payment_method ~ '^[a-z0-9_]{2,32}$') NOT VALID;
  END IF;
END $$;

-- ─── 7. Checkout engine ────────────────────────────────────────────────────

-- Staff context: the caller's profile, or an exception.
CREATE OR REPLACE FUNCTION public.pos_require_staff(p_shop_id uuid)
RETURNS public.profiles
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_me public.profiles%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_me FROM public.profiles WHERE id = auth.uid();
  IF v_me.id IS NULL OR v_me.shop_id IS NULL OR v_me.role::text NOT IN ('shop_admin', 'barber')
     OR (p_shop_id IS NOT NULL AND v_me.shop_id IS DISTINCT FROM p_shop_id) THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'P0001';
  END IF;
  RETURN v_me;
END;
$$;
REVOKE ALL ON FUNCTION public.pos_require_staff(uuid) FROM PUBLIC, anon, authenticated;

-- Full receipt payload for one sale (no auth check: internal only).
CREATE OR REPLACE FUNCTION public.sale_receipt_json(p_sale_id uuid)
RETURNS jsonb
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT jsonb_build_object(
    'sale_id', s.id,
    'shop_id', s.shop_id,
    'appointment_id', s.appointment_id,
    'client_id', s.client_id,
    'client_name', s.client_name,
    'status', s.status,
    'currency', s.currency,
    'receipt_no', s.receipt_no,
    'receipt_number', s.receipt_number,
    'subtotal', s.subtotal,
    'discount_total', s.discount_total,
    'discount_reason', s.discount_reason,
    'tax_total', s.tax_total,
    'tip_total', s.tip_total,
    'rounding_adjustment', s.rounding_adjustment,
    'total', s.total,
    'paid_total', s.paid_total,
    'balance', s.total - s.paid_total,
    'payment_method', s.payment_method,
    'tax_registered', s.tax_registered,
    'tax_number', s.tax_number,
    'is_legacy', s.is_legacy,
    'completed_at', s.completed_at,
    'created_at', s.created_at,
    'shop', jsonb_build_object('name', sh.name, 'name_ar', sh.name_ar, 'phone', sh.phone,
                               'footer_en', sh.receipt_footer_en, 'footer_ar', sh.receipt_footer_ar,
                               'timezone', COALESCE(sh.timezone, 'Asia/Amman')),
    'items', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                 'id', i.id, 'kind', i.kind, 'name', i.name, 'name_ar', i.name_ar, 'quantity', i.quantity,
                 'unit_price', i.unit_price, 'discount_amount', i.discount_amount, 'cart_discount', i.cart_discount,
                 'line_total', i.line_total, 'tax_rate', i.tax_rate, 'tax_amount', i.tax_amount,
                 'barber_id', i.barber_id, 'service_id', i.service_id, 'product_id', i.product_id)
               ORDER BY i.sort, i.created_at) FROM public.sale_items i WHERE i.sale_id = s.id), '[]'::jsonb),
    'payments', COALESCE((SELECT jsonb_agg(jsonb_build_object(
                 'method_code', p.method_code, 'name_en', pm.name_en, 'name_ar', pm.name_ar,
                 'amount', p.amount, 'reference', p.reference, 'created_at', p.created_at)
               ORDER BY p.created_at, p.id) FROM public.sale_payments p
               LEFT JOIN public.payment_methods pm ON pm.id = p.method_id WHERE p.sale_id = s.id), '[]'::jsonb),
    'tips', COALESCE((SELECT jsonb_agg(jsonb_build_object('barber_id', tp.barber_id, 'barber_name', pr.full_name, 'amount', tp.amount)
               ORDER BY tp.created_at, tp.id) FROM public.sale_tips tp
               LEFT JOIN public.profiles pr ON pr.id = tp.barber_id WHERE tp.sale_id = s.id), '[]'::jsonb)
  )
  FROM public.sales s
  JOIN public.shops sh ON sh.id = s.shop_id
  WHERE s.id = p_sale_id;
$$;
REVOKE ALL ON FUNCTION public.sale_receipt_json(uuid) FROM PUBLIC, anon, authenticated;

-- Discount amount for a base and a {type, value} spec, rounded to the fils.
CREATE OR REPLACE FUNCTION public.pos_discount_amount(p_base numeric, p_spec jsonb)
RETURNS numeric
LANGUAGE plpgsql
IMMUTABLE
SET search_path = public, pg_temp
AS $$
DECLARE
  v_type  text;
  v_value numeric;
BEGIN
  IF p_spec IS NULL OR jsonb_typeof(p_spec) <> 'object' THEN
    RETURN 0;
  END IF;
  v_type := COALESCE(p_spec->>'type', 'amount');
  v_value := COALESCE(NULLIF(p_spec->>'value', '')::numeric, 0);
  IF v_value < 0 OR v_type NOT IN ('amount', 'percent') OR (v_type = 'percent' AND v_value > 100) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  IF v_type = 'percent' THEN
    RETURN LEAST(round(p_base * v_value / 100, 3), p_base);
  END IF;
  RETURN LEAST(round(v_value, 3), p_base);
END;
$$;
REVOKE ALL ON FUNCTION public.pos_discount_amount(numeric, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.pos_discount_amount(numeric, jsonb) TO authenticated, service_role;

-- Core checkout (internal). p_payload:
-- {
--   "sale_id": uuid?            client-generated idempotency key
--   "appointment_id": uuid?, "client_id": uuid?, "client_name": text?,
--   "items": [{ "kind": "service"|"product"|"custom", "service_id"?, "variant_id"?, "product_id"?,
--               "barber_id"?, "name", "name_ar"?, "quantity", "unit_price",
--               "discount": {"type":"amount"|"percent","value"}?, "discount_reason"? }],   1..50
--   "cart_discount": {"type","value","reason"?}?,
--   "tips": [{ "barber_id", "amount" }],
--   "payments": [{ "method_code", "amount", "reference"? }],
--   "allow_partial": bool, "apply_cash_rounding": bool, "note": text?
-- }
CREATE OR REPLACE FUNCTION public.pos_checkout(p_payload jsonb, p_internal boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me          public.profiles%ROWTYPE;
  v_shop        public.shops%ROWTYPE;
  v_appt        public.appointments%ROWTYPE;
  v_sale_id     uuid;
  v_existing    public.sales%ROWTYPE;
  v_items       jsonb := COALESCE(p_payload->'items', '[]'::jsonb);
  v_payments    jsonb := COALESCE(p_payload->'payments', '[]'::jsonb);
  v_tips        jsonb := COALESCE(p_payload->'tips', '[]'::jsonb);
  v_item        jsonb;
  v_idx         int;
  v_n           int;
  v_rate        numeric;
  v_qty         int;
  v_unit        numeric;
  v_kind        text;
  v_name        text;
  v_gross       numeric[] := '{}';
  v_ldisc       numeric[] := '{}';
  v_net         numeric[] := '{}';
  v_share       numeric[] := '{}';
  v_sum_net     numeric := 0;
  v_subtotal    numeric := 0;
  v_cart_disc   numeric := 0;
  v_alloc       numeric := 0;
  v_big         int := 1;
  v_line_total  numeric;
  v_tax         numeric;
  v_tax_total   numeric := 0;
  v_net_total   numeric := 0;
  v_ldisc_total numeric := 0;
  v_tip_total   numeric := 0;
  v_pay_total   numeric := 0;
  v_all_cash    boolean := true;
  v_adj         numeric := 0;
  v_total       numeric;
  v_status      text;
  v_receipt_no  bigint;
  v_method      public.payment_methods%ROWTYPE;
  v_codes       text[] := '{}';
  v_tz          text;
  v_client_id   uuid;
  v_client_name text;
  v_barber_name text;
  v_service_id  uuid;
  v_product_id  uuid;
  v_barber_id   uuid;
  v_amount      numeric;
BEGIN
  IF p_payload IS NULL OR jsonb_typeof(p_payload) <> 'object'
     OR jsonb_typeof(v_items) <> 'array' OR jsonb_typeof(v_payments) <> 'array' OR jsonb_typeof(v_tips) <> 'array' THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  v_n := jsonb_array_length(v_items);
  IF v_n < 1 OR v_n > 50 OR jsonb_array_length(v_payments) > 10 OR jsonb_array_length(v_tips) > 10 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;

  v_me := public.pos_require_staff(NULL);
  SELECT * INTO v_shop FROM public.shops WHERE id = v_me.shop_id;
  v_tz := COALESCE(v_shop.timezone, 'Asia/Amman');

  -- Idempotency: the client sends the sale id it generated.
  v_sale_id := NULLIF(p_payload->>'sale_id', '')::uuid;
  IF v_sale_id IS NOT NULL THEN
    SELECT * INTO v_existing FROM public.sales WHERE id = v_sale_id;
    IF v_existing.id IS NOT NULL THEN
      IF v_existing.shop_id IS DISTINCT FROM v_shop.id THEN
        RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'P0001';
      END IF;
      RETURN public.sale_receipt_json(v_existing.id);
    END IF;
  ELSE
    v_sale_id := gen_random_uuid();
  END IF;

  -- Appointment: lock it, check ownership, refuse a second live sale.
  IF NULLIF(p_payload->>'appointment_id', '') IS NOT NULL THEN
    SELECT * INTO v_appt FROM public.appointments WHERE id = (p_payload->>'appointment_id')::uuid FOR UPDATE;
    IF v_appt.id IS NULL OR v_appt.shop_id IS DISTINCT FROM v_shop.id THEN
      RAISE EXCEPTION 'APPT_NOT_FOUND' USING ERRCODE = 'P0001';
    END IF;
    IF v_me.role::text <> 'shop_admin' AND v_appt.barber_id IS DISTINCT FROM v_me.id THEN
      RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'P0001';
    END IF;
    IF v_appt.status NOT IN ('pending', 'confirmed', 'arrived', 'in_chair', 'completed') THEN
      RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE = 'P0001';
    END IF;
    IF EXISTS (SELECT 1 FROM public.sales s WHERE s.appointment_id = v_appt.id AND s.status IN ('part_paid', 'paid')) THEN
      RAISE EXCEPTION 'ALREADY_PAID' USING ERRCODE = 'P0001';
    END IF;
  END IF;

  -- Client
  v_client_id := COALESCE(NULLIF(p_payload->>'client_id', '')::uuid, v_appt.client_id);
  IF v_client_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.clients c WHERE c.id = v_client_id AND c.shop_id = v_shop.id) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  v_client_name := left(COALESCE(NULLIF(btrim(p_payload->>'client_name'), ''), v_appt.client_name,
                       (SELECT c.name FROM public.clients c WHERE c.id = v_client_id), ''), 120);

  v_rate := CASE WHEN COALESCE(v_shop.is_tax_registered, false) THEN COALESCE(v_shop.tax_rate, 0) ELSE 0 END;

  -- Pass 1: gross and line discounts.
  FOR v_idx IN 1..v_n LOOP
    v_item := v_items->(v_idx - 1);
    v_qty := COALESCE(NULLIF(v_item->>'quantity', '')::int, 1);
    v_unit := NULLIF(v_item->>'unit_price', '')::numeric;
    IF v_qty < 1 OR v_qty > 99 OR v_unit IS NULL OR v_unit < 0 OR v_unit > 100000 THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;
    v_gross := v_gross || round(round(v_unit, 3) * v_qty, 3);
    v_ldisc := v_ldisc || public.pos_discount_amount(v_gross[v_idx], v_item->'discount');
    v_net := v_net || (v_gross[v_idx] - v_ldisc[v_idx]);
    v_subtotal := v_subtotal + v_gross[v_idx];
    v_ldisc_total := v_ldisc_total + v_ldisc[v_idx];
    v_sum_net := v_sum_net + v_net[v_idx];
    IF v_net[v_idx] > v_net[v_big] THEN v_big := v_idx; END IF;
  END LOOP;

  -- Cart discount, allocated pro rata (floored to the fils), remainder to the
  -- largest line, so tax stays per line and lines sum to the total exactly.
  v_cart_disc := public.pos_discount_amount(v_sum_net, p_payload->'cart_discount');
  FOR v_idx IN 1..v_n LOOP
    IF v_sum_net > 0 THEN
      v_share := v_share || LEAST(floor(v_cart_disc * v_net[v_idx] / v_sum_net * 1000) / 1000, v_net[v_idx]);
    ELSE
      v_share := v_share || 0::numeric;
    END IF;
    v_alloc := v_alloc + v_share[v_idx];
  END LOOP;
  IF v_cart_disc - v_alloc > 0 THEN
    v_share[v_big] := LEAST(v_share[v_big] + (v_cart_disc - v_alloc), v_net[v_big]);
  END IF;

  -- Tips
  FOR v_idx IN 0..jsonb_array_length(v_tips) - 1 LOOP
    v_amount := round(NULLIF(v_tips->v_idx->>'amount', '')::numeric, 3);
    IF v_amount IS NULL OR v_amount < 0 OR v_amount > 10000 THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;
    v_barber_id := NULLIF(v_tips->v_idx->>'barber_id', '')::uuid;
    IF v_barber_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_barber_id AND p.shop_id = v_shop.id) THEN
      RAISE EXCEPTION 'BARBER_INVALID' USING ERRCODE = 'P0001';
    END IF;
    v_tip_total := v_tip_total + v_amount;
  END LOOP;

  -- Payments: resolve methods, check they are active (internal legacy path may
  -- use inactive system methods, e.g. 'online', or the summary code 'mixed').
  FOR v_idx IN 0..jsonb_array_length(v_payments) - 1 LOOP
    v_amount := round(NULLIF(v_payments->v_idx->>'amount', '')::numeric, 3);
    IF v_amount IS NULL OR v_amount <= 0 OR v_amount > 100000 THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;
    SELECT * INTO v_method FROM public.payment_methods
      WHERE shop_id = v_shop.id AND code = v_payments->v_idx->>'method_code';
    IF v_method.id IS NULL AND NOT (p_internal AND v_payments->v_idx->>'method_code' = 'mixed') THEN
      RAISE EXCEPTION 'PAYMENT_METHOD_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF v_method.id IS NOT NULL AND NOT v_method.is_active AND NOT p_internal THEN
      RAISE EXCEPTION 'PAYMENT_METHOD_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF v_method.id IS NULL OR v_method.kind <> 'cash' THEN v_all_cash := false; END IF;
    v_pay_total := v_pay_total + v_amount;
    IF NOT (v_payments->v_idx->>'method_code' = ANY (v_codes)) THEN
      v_codes := v_codes || (v_payments->v_idx->>'method_code');
    END IF;
  END LOOP;

  FOR v_idx IN 1..v_n LOOP
    v_line_total := v_net[v_idx] - v_share[v_idx];
    v_net_total := v_net_total + v_line_total;
    v_tax_total := v_tax_total + round(v_line_total * v_rate / (100 + v_rate), 3);
  END LOOP;

  -- Cash rounding: only when asked, the shop has it on, and every tender is cash.
  IF COALESCE((p_payload->>'apply_cash_rounding')::boolean, false) AND v_shop.cash_rounding > 0
     AND v_all_cash AND jsonb_array_length(v_payments) > 0 THEN
    v_adj := round((v_net_total + v_tip_total) / v_shop.cash_rounding) * v_shop.cash_rounding - (v_net_total + v_tip_total);
  END IF;
  v_total := v_net_total + v_tip_total + v_adj;

  IF v_pay_total > v_total THEN
    RAISE EXCEPTION 'PAYMENT_EXCEEDS_TOTAL' USING ERRCODE = 'P0001';
  END IF;
  IF v_pay_total < v_total THEN
    IF NOT COALESCE((p_payload->>'allow_partial')::boolean, false) OR v_pay_total <= 0 THEN
      RAISE EXCEPTION 'PAYMENT_MISMATCH' USING ERRCODE = 'P0001';
    END IF;
    v_status := 'part_paid';
  ELSE
    v_status := 'paid';
  END IF;

  -- Gapless per-shop receipt number (row lock; rolls back with the sale).
  INSERT INTO public.receipt_sequences AS rs (shop_id, last_no) VALUES (v_shop.id, 1)
  ON CONFLICT (shop_id) DO UPDATE SET last_no = rs.last_no + 1, updated_at = now()
  RETURNING last_no INTO v_receipt_no;

  SELECT full_name INTO v_barber_name FROM public.profiles
  WHERE id = COALESCE(v_appt.barber_id, NULLIF(v_items->0->>'barber_id', '')::uuid, v_me.id);

  INSERT INTO public.sales (id, shop_id, client_id, appointment_id, status, currency, subtotal, discount_total,
                            discount_reason, tax_total, tip_total, rounding_adjustment, total, paid_total,
                            payment_method, client_name, barber_name, sale_time, receipt_no, receipt_number,
                            tax_registered, tax_number, note, created_by, completed_at)
  VALUES (v_sale_id, v_shop.id, v_client_id, v_appt.id, v_status, COALESCE(v_shop.currency, 'JOD'), v_subtotal,
          v_ldisc_total + v_cart_disc, left(NULLIF(btrim(p_payload->'cart_discount'->>'reason'), ''), 200),
          v_tax_total, v_tip_total, v_adj, v_total, v_pay_total,
          CASE WHEN array_length(v_codes, 1) = 1 THEN v_codes[1] WHEN array_length(v_codes, 1) > 1 THEN 'mixed' END,
          v_client_name, COALESCE(v_barber_name, ''), to_char(now() AT TIME ZONE v_tz, 'HH24:MI'),
          v_receipt_no,
          CASE WHEN v_shop.receipt_prefix IS NOT NULL THEN v_shop.receipt_prefix || '-' ELSE '' END || lpad(v_receipt_no::text, 6, '0'),
          v_rate > 0, CASE WHEN v_rate > 0 THEN v_shop.tax_number END,
          left(NULLIF(btrim(p_payload->>'note'), ''), 500), v_me.id,
          CASE WHEN v_status = 'paid' THEN now() END);

  FOR v_idx IN 1..v_n LOOP
    v_item := v_items->(v_idx - 1);
    v_kind := COALESCE(v_item->>'kind', 'custom');
    IF v_kind NOT IN ('service', 'product', 'custom') THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;
    v_service_id := NULLIF(v_item->>'service_id', '')::uuid;
    v_product_id := NULLIF(v_item->>'product_id', '')::uuid;
    v_barber_id := COALESCE(NULLIF(v_item->>'barber_id', '')::uuid, CASE WHEN v_kind = 'service' THEN v_appt.barber_id END);
    IF v_service_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.services sv WHERE sv.id = v_service_id AND sv.shop_id = v_shop.id) THEN
      RAISE EXCEPTION 'SERVICE_INVALID' USING ERRCODE = 'P0001';
    END IF;
    IF v_product_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.products pr WHERE pr.id = v_product_id AND pr.shop_id = v_shop.id) THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;
    IF v_barber_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM public.profiles p WHERE p.id = v_barber_id AND p.shop_id = v_shop.id) THEN
      RAISE EXCEPTION 'BARBER_INVALID' USING ERRCODE = 'P0001';
    END IF;
    v_name := left(btrim(COALESCE(v_item->>'name', '')), 120);
    IF v_name = '' THEN
      v_name := COALESCE((SELECT sv.name FROM public.services sv WHERE sv.id = v_service_id),
                         (SELECT pr.name_en FROM public.products pr WHERE pr.id = v_product_id), '-');
    END IF;
    v_line_total := v_net[v_idx] - v_share[v_idx];
    v_tax := round(v_line_total * v_rate / (100 + v_rate), 3);
    INSERT INTO public.sale_items (sale_id, shop_id, kind, service_id, variant_id, product_id, barber_id, name, name_ar,
                                   quantity, unit_price, discount_amount, discount_reason, cart_discount, line_total,
                                   tax_rate, tax_amount, sort)
    VALUES (v_sale_id, v_shop.id, v_kind, v_service_id, NULLIF(v_item->>'variant_id', '')::uuid, v_product_id, v_barber_id,
            v_name, left(NULLIF(btrim(v_item->>'name_ar'), ''), 120),
            COALESCE(NULLIF(v_item->>'quantity', '')::int, 1), round((v_item->>'unit_price')::numeric, 3),
            v_ldisc[v_idx], left(NULLIF(btrim(v_item->>'discount_reason'), ''), 200), v_share[v_idx], v_line_total,
            v_rate, v_tax, v_idx);
  END LOOP;

  FOR v_idx IN 0..jsonb_array_length(v_payments) - 1 LOOP
    INSERT INTO public.sale_payments (sale_id, shop_id, method_id, method_code, amount, reference, created_by)
    SELECT v_sale_id, v_shop.id, pm.id, v_payments->v_idx->>'method_code', round((v_payments->v_idx->>'amount')::numeric, 3),
           left(NULLIF(btrim(v_payments->v_idx->>'reference'), ''), 100), v_me.id
    FROM (SELECT 1) one
    LEFT JOIN public.payment_methods pm ON pm.shop_id = v_shop.id AND pm.code = v_payments->v_idx->>'method_code';
  END LOOP;

  FOR v_idx IN 0..jsonb_array_length(v_tips) - 1 LOOP
    v_amount := round((v_tips->v_idx->>'amount')::numeric, 3);
    IF v_amount > 0 THEN
      INSERT INTO public.sale_tips (sale_id, shop_id, barber_id, amount)
      VALUES (v_sale_id, v_shop.id, NULLIF(v_tips->v_idx->>'barber_id', '')::uuid, v_amount);
    END IF;
  END LOOP;

  IF v_appt.id IS NOT NULL THEN
    UPDATE public.appointments
    SET status = 'completed',
        payment_status = CASE WHEN v_status = 'paid' THEN 'paid' ELSE COALESCE(payment_status, 'unpaid') END,
        payment_method = CASE WHEN array_length(v_codes, 1) = 1 THEN v_codes[1] WHEN array_length(v_codes, 1) > 1 THEN 'mixed' END,
        amount_paid = LEAST(v_pay_total, 99999999.99)
    WHERE id = v_appt.id;
  END IF;

  IF v_client_id IS NOT NULL AND v_status = 'paid' THEN
    UPDATE public.clients SET total_spend = COALESCE(total_spend, 0) + v_net_total WHERE id = v_client_id;
  END IF;

  RETURN public.sale_receipt_json(v_sale_id);
END;
$$;
REVOKE ALL ON FUNCTION public.pos_checkout(jsonb, boolean) FROM PUBLIC, anon, authenticated;

-- Public entry point for the POS cart.
CREATE OR REPLACE FUNCTION public.checkout_sale(p_payload jsonb)
RETURNS jsonb
LANGUAGE sql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT public.pos_checkout(p_payload, false);
$$;
REVOKE ALL ON FUNCTION public.checkout_sale(jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.checkout_sale(jsonb) TO authenticated, service_role;

-- Settle the balance of a part-paid sale. Payments must not exceed the balance.
CREATE OR REPLACE FUNCTION public.add_sale_payments(p_sale_id uuid, p_payments jsonb)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me     public.profiles%ROWTYPE;
  v_sale   public.sales%ROWTYPE;
  v_method public.payment_methods%ROWTYPE;
  v_amount numeric;
  v_sum    numeric := 0;
  v_idx    int;
  v_codes  text[];
BEGIN
  IF p_payments IS NULL OR jsonb_typeof(p_payments) <> 'array' OR jsonb_array_length(p_payments) NOT BETWEEN 1 AND 10 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  v_me := public.pos_require_staff(NULL);
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF v_sale.id IS NULL OR v_sale.shop_id IS DISTINCT FROM v_me.shop_id THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_sale.status <> 'part_paid' THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = 'P0001';
  END IF;

  FOR v_idx IN 0..jsonb_array_length(p_payments) - 1 LOOP
    v_amount := round(NULLIF(p_payments->v_idx->>'amount', '')::numeric, 3);
    SELECT * INTO v_method FROM public.payment_methods
      WHERE shop_id = v_sale.shop_id AND code = p_payments->v_idx->>'method_code' AND is_active;
    IF v_amount IS NULL OR v_amount <= 0 OR v_method.id IS NULL THEN
      RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
    END IF;
    INSERT INTO public.sale_payments (sale_id, shop_id, method_id, method_code, amount, reference, created_by)
    VALUES (v_sale.id, v_sale.shop_id, v_method.id, v_method.code, v_amount,
            left(NULLIF(btrim(p_payments->v_idx->>'reference'), ''), 100), v_me.id);
    v_sum := v_sum + v_amount;
  END LOOP;

  IF v_sale.paid_total + v_sum > v_sale.total THEN
    RAISE EXCEPTION 'PAYMENT_EXCEEDS_TOTAL' USING ERRCODE = 'P0001';
  END IF;

  SELECT array_agg(DISTINCT method_code) INTO v_codes FROM public.sale_payments WHERE sale_id = v_sale.id;
  UPDATE public.sales
  SET paid_total = paid_total + v_sum,
      status = CASE WHEN paid_total + v_sum = total THEN 'paid' ELSE 'part_paid' END,
      completed_at = CASE WHEN paid_total + v_sum = total THEN now() ELSE completed_at END,
      payment_method = CASE WHEN array_length(v_codes, 1) = 1 THEN v_codes[1] ELSE 'mixed' END
  WHERE id = v_sale.id;

  IF v_sale.paid_total + v_sum = v_sale.total THEN
    IF v_sale.appointment_id IS NOT NULL THEN
      UPDATE public.appointments SET payment_status = 'paid',
             payment_method = CASE WHEN array_length(v_codes, 1) = 1 THEN v_codes[1] ELSE 'mixed' END,
             amount_paid = LEAST(v_sale.total, 99999999.99)
      WHERE id = v_sale.appointment_id;
    END IF;
    IF v_sale.client_id IS NOT NULL THEN
      UPDATE public.clients SET total_spend = COALESCE(total_spend, 0) + (v_sale.total - v_sale.tip_total - v_sale.rounding_adjustment)
      WHERE id = v_sale.client_id;
    END IF;
  END IF;

  RETURN public.sale_receipt_json(v_sale.id);
END;
$$;
REVOKE ALL ON FUNCTION public.add_sale_payments(uuid, jsonb) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.add_sale_payments(uuid, jsonb) TO authenticated, service_role;

-- Void (or mark refunded) a sale. Shop admins only. The receipt number stays
-- used, so the sequence has no gaps.
CREATE OR REPLACE FUNCTION public.void_sale(p_sale_id uuid, p_reason text, p_refund boolean DEFAULT false)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me   public.profiles%ROWTYPE;
  v_sale public.sales%ROWTYPE;
BEGIN
  v_me := public.pos_require_staff(NULL);
  IF v_me.role::text <> 'shop_admin' THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'P0001';
  END IF;
  IF p_reason IS NULL OR length(btrim(p_reason)) NOT BETWEEN 1 AND 300 THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;
  SELECT * INTO v_sale FROM public.sales WHERE id = p_sale_id FOR UPDATE;
  IF v_sale.id IS NULL OR v_sale.shop_id IS DISTINCT FROM v_me.shop_id THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_sale.status NOT IN ('paid', 'part_paid', 'draft') THEN
    RAISE EXCEPTION 'INVALID_STATUS' USING ERRCODE = 'P0001';
  END IF;

  UPDATE public.sales
  SET status = CASE WHEN p_refund THEN 'refunded' ELSE 'voided' END,
      voided_at = now(), voided_by = v_me.id, void_reason = btrim(p_reason)
  WHERE id = v_sale.id;

  IF v_sale.status = 'paid' AND v_sale.client_id IS NOT NULL THEN
    UPDATE public.clients
    SET total_spend = GREATEST(COALESCE(total_spend, 0) - (v_sale.total - v_sale.tip_total - v_sale.rounding_adjustment), 0)
    WHERE id = v_sale.client_id;
  END IF;
  IF v_sale.appointment_id IS NOT NULL THEN
    UPDATE public.appointments
    SET payment_status = CASE WHEN p_refund THEN 'refunded' ELSE 'unpaid' END, amount_paid = 0
    WHERE id = v_sale.appointment_id;
  END IF;

  RETURN public.sale_receipt_json(v_sale.id);
END;
$$;
REVOKE ALL ON FUNCTION public.void_sale(uuid, text, boolean) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.void_sale(uuid, text, boolean) TO authenticated, service_role;

-- Receipt for re-print / re-share (staff of the shop).
CREATE OR REPLACE FUNCTION public.get_sale_receipt(p_sale_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE v_me public.profiles%ROWTYPE;
BEGIN
  v_me := public.pos_require_staff(NULL);
  IF NOT EXISTS (SELECT 1 FROM public.sales WHERE id = p_sale_id AND shop_id = v_me.shop_id) THEN
    RAISE EXCEPTION 'NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  RETURN public.sale_receipt_json(p_sale_id);
END;
$$;
REVOKE ALL ON FUNCTION public.get_sale_receipt(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.get_sale_receipt(uuid) TO authenticated, service_role;

-- Cart lines for an appointment: appointment_services (WS-1D) when that table
-- exists and has rows, else appointments.service_ids, else one line at the
-- appointment price. Prices are the booked prices (tax-inclusive).
CREATE OR REPLACE FUNCTION public.appointment_cart_lines(p_appointment_id uuid)
RETURNS jsonb
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me    public.profiles%ROWTYPE;
  v_appt  public.appointments%ROWTYPE;
  v_lines jsonb;
  v_sum   numeric;
BEGIN
  v_me := public.pos_require_staff(NULL);
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id;
  IF v_appt.id IS NULL OR v_appt.shop_id IS DISTINCT FROM v_me.shop_id THEN
    RAISE EXCEPTION 'APPT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;

  IF to_regclass('public.appointment_services') IS NOT NULL THEN
    EXECUTE $q$
      SELECT jsonb_agg(jsonb_build_object(
               'kind', 'service', 'service_id', x.service_id, 'variant_id', x.variant_id,
               'barber_id', COALESCE(x.barber_id, $2), 'name', COALESCE(sv.name, $3, '-'), 'name_ar', sv.name_ar,
               'quantity', 1, 'unit_price', COALESCE(x.price, sv.price, 0))
             ORDER BY x.sort, x.id)
      FROM public.appointment_services x
      LEFT JOIN public.services sv ON sv.id = x.service_id
      WHERE x.appointment_id = $1
    $q$ INTO v_lines USING v_appt.id, v_appt.barber_id, v_appt.service_name;
  END IF;

  IF v_lines IS NULL AND COALESCE(array_length(v_appt.service_ids, 1), 0) > 0 THEN
    SELECT jsonb_agg(jsonb_build_object(
             'kind', 'service', 'service_id', sv.id, 'barber_id', v_appt.barber_id,
             'name', sv.name, 'name_ar', sv.name_ar, 'quantity', 1, 'unit_price', sv.price)
           ORDER BY u.ord),
           sum(sv.price)
    INTO v_lines, v_sum
    FROM unnest(v_appt.service_ids) WITH ORDINALITY u(id, ord)
    JOIN public.services sv ON sv.id = u.id AND sv.shop_id = v_appt.shop_id;
    -- Booked price differs from today's catalog price: trust the booking.
    IF v_lines IS NOT NULL AND v_sum IS DISTINCT FROM v_appt.price THEN
      v_lines := NULL;
    END IF;
  END IF;

  IF v_lines IS NULL THEN
    v_lines := jsonb_build_array(jsonb_build_object(
      'kind', 'service',
      'service_id', CASE WHEN array_length(v_appt.service_ids, 1) = 1 THEN v_appt.service_ids[1] END,
      'barber_id', v_appt.barber_id,
      'name', COALESCE(NULLIF(v_appt.service_name, ''), '-'),
      'quantity', 1,
      'unit_price', COALESCE(v_appt.price, 0)));
  END IF;
  RETURN v_lines;
END;
$$;
REVOKE ALL ON FUNCTION public.appointment_cart_lines(uuid) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.appointment_cart_lines(uuid) TO authenticated, service_role;

-- Legacy one-tap "mark paid", rewritten on top of the sales model. Same
-- signature and return keys (appointment_id, sale_id, status, amount) plus
-- receipt_number. Idempotent: a second call returns the existing sale.
DROP FUNCTION IF EXISTS public.complete_appointment_sale(uuid, text, numeric);
CREATE FUNCTION public.complete_appointment_sale(p_appointment_id uuid, p_payment_method text, p_amount numeric DEFAULT NULL)
RETURNS jsonb
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
DECLARE
  v_me      public.profiles%ROWTYPE;
  v_appt    public.appointments%ROWTYPE;
  v_sale    public.sales%ROWTYPE;
  v_lines   jsonb;
  v_sum     numeric;
  v_receipt jsonb;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'NOT_AUTHENTICATED' USING ERRCODE = 'P0001';
  END IF;
  IF p_payment_method IS NULL OR p_payment_method !~ '^[a-z0-9_]{2,32}$'
     OR (p_amount IS NOT NULL AND (p_amount < 0 OR p_amount > 100000)) THEN
    RAISE EXCEPTION 'INVALID_INPUT' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_me FROM public.profiles WHERE id = auth.uid();
  SELECT * INTO v_appt FROM public.appointments WHERE id = p_appointment_id FOR UPDATE;
  IF v_appt.id IS NULL OR v_me.shop_id IS DISTINCT FROM v_appt.shop_id
     OR v_me.role::text NOT IN ('shop_admin', 'barber') THEN
    RAISE EXCEPTION 'APPT_NOT_FOUND' USING ERRCODE = 'P0001';
  END IF;
  IF v_me.role::text <> 'shop_admin' AND v_appt.barber_id IS DISTINCT FROM v_me.id THEN
    RAISE EXCEPTION 'NOT_AUTHORIZED' USING ERRCODE = 'P0001';
  END IF;
  IF v_appt.status NOT IN ('pending', 'confirmed', 'arrived', 'in_chair', 'completed') THEN
    RAISE EXCEPTION 'INVALID_TRANSITION' USING ERRCODE = 'P0001';
  END IF;

  SELECT * INTO v_sale FROM public.sales
  WHERE appointment_id = v_appt.id AND status IN ('part_paid', 'paid')
  ORDER BY created_at LIMIT 1;
  IF v_sale.id IS NOT NULL THEN
    UPDATE public.appointments SET status = 'completed' WHERE id = v_appt.id AND status <> 'completed';
    RETURN jsonb_build_object('appointment_id', v_appt.id, 'sale_id', v_sale.id, 'status', 'completed',
                              'amount', v_sale.total - v_sale.tip_total, 'receipt_number', v_sale.receipt_number);
  END IF;

  v_lines := public.appointment_cart_lines(v_appt.id);
  SELECT sum((l->>'unit_price')::numeric * COALESCE((l->>'quantity')::int, 1)) INTO v_sum FROM jsonb_array_elements(v_lines) l;
  IF p_amount IS NOT NULL AND round(p_amount, 3) IS DISTINCT FROM round(COALESCE(v_sum, 0), 3) THEN
    v_lines := jsonb_build_array(jsonb_build_object(
      'kind', 'service', 'barber_id', v_appt.barber_id,
      'service_id', CASE WHEN array_length(v_appt.service_ids, 1) = 1 THEN v_appt.service_ids[1] END,
      'name', COALESCE(NULLIF(v_appt.service_name, ''), '-'), 'quantity', 1, 'unit_price', p_amount));
    v_sum := p_amount;
  END IF;

  v_receipt := public.pos_checkout(jsonb_build_object(
    'appointment_id', v_appt.id,
    'items', v_lines,
    'payments', CASE WHEN COALESCE(v_sum, 0) > 0
                     THEN jsonb_build_array(jsonb_build_object('method_code', p_payment_method, 'amount', round(v_sum, 3)))
                     ELSE '[]'::jsonb END
  ), true);

  RETURN jsonb_build_object('appointment_id', v_appt.id, 'sale_id', v_receipt->>'sale_id', 'status', 'completed',
                            'amount', (v_receipt->>'total')::numeric - (v_receipt->>'tip_total')::numeric,
                            'receipt_number', v_receipt->>'receipt_number');
END;
$$;
REVOKE ALL ON FUNCTION public.complete_appointment_sale(uuid, text, numeric) FROM PUBLIC, anon;
GRANT EXECUTE ON FUNCTION public.complete_appointment_sale(uuid, text, numeric) TO authenticated, service_role;
