-- Gate 1b integration fixes.
--
-- 1. availability_allowed_ignore(): also honour the transaction-local
--    setting halaqy.manage_appointment that reschedule_by_token() (WS-1C)
--    sets before calling is_slot_bookable()/pick_any_barber(). A signed-out
--    client rescheduling through their manage link can then move into a time
--    that overlaps the booking's own current slot.
--
--    The setting is only ever set inside SECURITY DEFINER functions with
--    set_config(..., true); PostgREST clients cannot set custom GUCs, and the
--    appointment must still belong to the shop being queried.
--
-- Idempotent (CREATE OR REPLACE); no data changes.

CREATE OR REPLACE FUNCTION public.availability_allowed_ignore(p_shop_id uuid, p_appointment_id uuid)
RETURNS uuid
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public, pg_temp
AS $$
  SELECT CASE
    WHEN p_appointment_id IS NULL THEN NULL
    WHEN public.availability_is_staff(p_shop_id) THEN p_appointment_id
    WHEN EXISTS (SELECT 1 FROM public.appointments a
                 WHERE a.id = p_appointment_id AND a.shop_id = p_shop_id
                   AND a.client_id IN (SELECT public.my_client_ids())) THEN p_appointment_id
    WHEN NULLIF(current_setting('halaqy.manage_appointment', true), '') = p_appointment_id::text
         AND EXISTS (SELECT 1 FROM public.appointments a
                     WHERE a.id = p_appointment_id AND a.shop_id = p_shop_id) THEN p_appointment_id
    ELSE NULL
  END;
$$;

REVOKE ALL ON FUNCTION public.availability_allowed_ignore(uuid, uuid) FROM PUBLIC, anon, authenticated;
GRANT EXECUTE ON FUNCTION public.availability_allowed_ignore(uuid, uuid) TO service_role;
