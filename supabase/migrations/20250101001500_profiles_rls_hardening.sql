-- 015_profiles_rls_hardening.sql
--
-- Two real, pre-existing RLS gaps found while reviewing the Tier 2
-- invite-pipeline work:
--
-- 1. `profiles_update_own` (001_rls_policies.sql) is `FOR UPDATE
--    USING (id = auth.uid())` with NO `WITH CHECK`. Since a WITH-CHECK-less
--    UPDATE policy places no constraint on the *new* row values, any
--    authenticated user — including a brand-new `customer` signup — can
--    currently run `supabase.from('profiles').update({ shop_id: <any shop
--    id>, role: 'shop_admin' }).eq('id', myId)` directly from the browser
--    console and grant themselves admin access to any shop, since shop ids
--    are already public (they're in every /shop/{id} URL). This is fixed
--    below by adding a WITH CHECK that forbids changing shop_id/role via
--    this policy at all — those fields now only change via the
--    accept_invite() SECURITY DEFINER function (014 migration), an admin
--    acting on another member's row (the new policy below), or the
--    handle_new_user() signup trigger (which inserts, not updates, so it's
--    unaffected).
--
-- 2. There has never been an UPDATE policy letting a shop_admin modify a
--    DIFFERENT member's profile. This means the Tier 1 "Remove from team"
--    feature (team/page.tsx setting another member's `profiles.shop_id` to
--    null) has been silently no-op'ing under RLS since it shipped — the
--    exact "confident false success" pattern this whole project has been
--    fixing elsewhere. Fixed by adding a real admin-scoped policy, tightly
--    bounded so an admin can only remove a member (set shop_id to NULL) or
--    move them within their OWN shop — never move them into a different
--    shop or grant themselves something unrelated.

-- No parameter on purpose: this must only ever be able to reveal the
-- CALLING user's own shop_id/role, never anyone else's. A version that took
-- a target id as a parameter would itself be a SECURITY DEFINER
-- information-disclosure hole (any authenticated caller could pass any
-- other user's id and read their shop_id/role, bypassing
-- profiles_select_same_shop) — see supabase-postgres-best-practices'
-- guidance to always check the calling user's own identity inside a
-- SECURITY DEFINER function body rather than trusting a caller-supplied id.
CREATE OR REPLACE FUNCTION public.current_profile_shop_and_role()
RETURNS TABLE (shop_id uuid, role text)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT p.shop_id, p.role FROM public.profiles p WHERE p.id = (select auth.uid());
$$;

DROP POLICY IF EXISTS "profiles_update_own" ON public.profiles;
CREATE POLICY "profiles_update_own" ON public.profiles
  FOR UPDATE USING (id = (select auth.uid()))
  WITH CHECK (
    id = (select auth.uid())
    AND shop_id IS NOT DISTINCT FROM (SELECT c.shop_id FROM public.current_profile_shop_and_role() c)
    AND role IS NOT DISTINCT FROM (SELECT c.role FROM public.current_profile_shop_and_role() c)
  );

CREATE POLICY "profiles_update_admin_same_shop" ON public.profiles
  FOR UPDATE USING (
    shop_id = public.get_current_shop_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles p
      WHERE p.id = (select auth.uid()) AND p.role = 'shop_admin'
    )
  )
  WITH CHECK (
    shop_id IS NULL OR shop_id = public.get_current_shop_id()
  );
