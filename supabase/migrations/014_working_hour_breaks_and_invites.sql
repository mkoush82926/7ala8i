-- 014_working_hour_breaks_and_invites.sql
--
-- Two independent Tier 2 additions:
--
-- 1. An optional break/buffer window on working_hours (e.g. prayer time,
--    lunch) — nullable, no default, so a barber who never configures one
--    is completely unaffected.
--
-- 2. A real `invites` table. src/app/api/invite/accept/route.ts has queried
--    a table called `invites` (token, status, shop_id, role) since it was
--    written, but no migration ever created it — this is that missing
--    table, backing the real team-invite-link flow (api/invite/create +
--    the /join page).

-- ─── Working hours: optional break / prayer buffer ───
ALTER TABLE public.working_hours ADD COLUMN IF NOT EXISTS break_start time without time zone;
ALTER TABLE public.working_hours ADD COLUMN IF NOT EXISTS break_end time without time zone;

-- ─── Invites ───
CREATE TABLE IF NOT EXISTS public.invites (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  shop_id uuid NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
  token text UNIQUE NOT NULL,
  role text NOT NULL DEFAULT 'barber' CHECK (role IN ('barber', 'shop_admin')),
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'expired')),
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now(),
  expires_at timestamptz DEFAULT (now() + interval '7 days')
);

CREATE INDEX IF NOT EXISTS idx_invites_token ON public.invites(token);

ALTER TABLE public.invites ENABLE ROW LEVEL SECURITY;

-- Shop admins can create and manage invites for their own shop.
CREATE POLICY "invites_insert_admin" ON public.invites
  FOR INSERT WITH CHECK (
    shop_id = public.get_current_shop_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'shop_admin'
    )
  );

CREATE POLICY "invites_select_admin_own_shop" ON public.invites
  FOR SELECT USING (
    shop_id = public.get_current_shop_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'shop_admin'
    )
  );

CREATE POLICY "invites_update_admin_own_shop" ON public.invites
  FOR UPDATE USING (
    shop_id = public.get_current_shop_id()
    AND EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'shop_admin'
    )
  );

-- NOTE: there is deliberately NO general-purpose "select/update where
-- status = 'pending'" policy here. RLS `USING` clauses constrain which rows
-- a policy exposes, but they do not force the caller to filter by token —
-- anyone holding the public anon key (which is not a secret; it ships in
-- every client bundle) could call the Supabase REST API directly with
-- `?status=eq.pending` and enumerate every shop's pending invites, or flip
-- any of them to 'accepted', with no token at all. A token-scoped policy
-- isn't expressible in plain RLS (there's no way to require "the caller's
-- WHERE clause names a specific token"), so the public token-based lookup
-- and accept flow go through SECURITY DEFINER functions instead, exactly
-- like this codebase's existing cancel_customer_booking /
-- link_customer_client pattern — each function takes the token as an
-- explicit parameter and only ever touches the one row it names internally.

-- Safe public lookup: returns the single invite matching the exact token
-- (or nothing), never a broader set. No row-level access is granted beyond
-- what this function returns.
CREATE OR REPLACE FUNCTION public.get_invite_by_token(p_token text)
RETURNS TABLE (shop_id uuid, role text, status text, expires_at timestamptz)
LANGUAGE sql
SECURITY DEFINER
STABLE
SET search_path = public
AS $$
  SELECT i.shop_id, i.role, i.status, i.expires_at
  FROM public.invites i
  WHERE i.token = p_token;
$$;

GRANT EXECUTE ON FUNCTION public.get_invite_by_token(text) TO anon, authenticated;

-- Safe accept: requires the caller to be authenticated, validates the token
-- names a still-pending, unexpired invite, locks that one row (FOR UPDATE)
-- to avoid a race if the same link is opened twice at once, marks it
-- accepted, and assigns the invite's shop_id/role onto the caller's OWN
-- profile in the same transaction — all bypassing RLS deliberately, the
-- same way cancel_customer_booking bypasses the clients/appointments RLS
-- to perform a validated, narrowly-scoped write on behalf of the caller.
CREATE OR REPLACE FUNCTION public.accept_invite(p_token text)
RETURNS TABLE (shop_id uuid, role text)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_invite public.invites%ROWTYPE;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT * INTO v_invite FROM public.invites WHERE token = p_token FOR UPDATE;

  IF v_invite.id IS NULL THEN
    RAISE EXCEPTION 'Invalid or expired invite';
  END IF;

  IF v_invite.status <> 'pending' THEN
    RAISE EXCEPTION 'This invite has already been used';
  END IF;

  IF v_invite.expires_at IS NOT NULL AND v_invite.expires_at < now() THEN
    UPDATE public.invites SET status = 'expired', updated_at = now() WHERE id = v_invite.id;
    RAISE EXCEPTION 'This invite has expired';
  END IF;

  UPDATE public.invites SET status = 'accepted', updated_at = now() WHERE id = v_invite.id;
  UPDATE public.profiles SET shop_id = v_invite.shop_id, role = v_invite.role WHERE id = auth.uid();

  RETURN QUERY SELECT v_invite.shop_id, v_invite.role;
END;
$$;

GRANT EXECUTE ON FUNCTION public.accept_invite(text) TO authenticated;
