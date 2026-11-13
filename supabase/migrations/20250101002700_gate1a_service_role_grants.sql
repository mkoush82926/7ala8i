-- ═══════════════════════════════════════════════════════════════════════════
-- Gate 1a integration fix: service_role could not UPDATE public.shops.
--
-- shops_marketplace_defaults() (SECURITY INVOKER trigger, 20250101001900)
-- evaluates `current_user IN (...) OR public.is_platform_admin()`, and the
-- second operand needs EXECUTE. The marketplace spine revoked PUBLIC from
-- is_platform_admin() and only re-granted anon/authenticated, so every
-- service-role write to shops (admin scripts, the e2e seeder, OTP hook
-- tooling) failed with "permission denied for function is_platform_admin".
--
-- These helpers only read the caller's own platform role (auth.uid()), which
-- is NULL for the service role, so granting them widens nothing.
-- Idempotent: GRANT is a no-op when the privilege already exists.
-- ═══════════════════════════════════════════════════════════════════════════

GRANT EXECUTE ON FUNCTION public.is_platform_admin()     TO service_role;
GRANT EXECUTE ON FUNCTION public.is_platform_staff()     TO service_role;
GRANT EXECUTE ON FUNCTION public.current_platform_role() TO service_role;
