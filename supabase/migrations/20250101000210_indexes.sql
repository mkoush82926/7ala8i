-- ═══════════════════════════════════════════════════════
-- HALAQY — Performance Indexes
-- Run this in Supabase SQL Editor after the RLS migration
-- ═══════════════════════════════════════════════════════

CREATE INDEX IF NOT EXISTS idx_appointments_shop_date ON appointments (shop_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_barber ON appointments (barber_id, start_time);
CREATE INDEX IF NOT EXISTS idx_appointments_client ON appointments (client_id);
CREATE INDEX IF NOT EXISTS idx_appointments_status ON appointments (shop_id, status);
CREATE INDEX IF NOT EXISTS idx_clients_shop ON clients (shop_id);
CREATE INDEX IF NOT EXISTS idx_clients_phone ON clients (shop_id, phone);
CREATE INDEX IF NOT EXISTS idx_leads_shop_stage ON leads (shop_id, stage);
CREATE INDEX IF NOT EXISTS idx_services_shop ON services (shop_id);
CREATE INDEX IF NOT EXISTS idx_profiles_shop ON profiles (shop_id);
