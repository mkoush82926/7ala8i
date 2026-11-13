-- ============================================
-- Consolidate duplicate shop-id helper functions
--
-- History: migration 001_initial_schema.sql created
-- get_user_shop_id(), while the separately-numbered
-- 001_rls_policies.sql created get_current_shop_id()
-- with an identical body. 004_fix_function_name.sql
-- later ensured get_current_shop_id() exists even if
-- 001_rls_policies.sql was skipped, but both functions
-- still exist independently today, used inconsistently
-- across policies (001/002/003/007 use get_current_shop_id,
-- 001_initial_schema uses get_user_shop_id).
--
-- Existing migration files are left unchanged (renumbering
-- already-applied migrations would break Supabase's applied-
-- migration tracking). Instead, get_user_shop_id() is made a
-- thin wrapper delegating to get_current_shop_id(), so there is
-- a single canonical implementation going forward. Any policy
-- still referencing get_user_shop_id() keeps working unchanged.
-- ============================================

CREATE OR REPLACE FUNCTION public.get_user_shop_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER STABLE
AS $$
  SELECT public.get_current_shop_id();
$$;
