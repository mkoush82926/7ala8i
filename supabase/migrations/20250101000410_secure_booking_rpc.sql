-- 004_secure_booking_rpc.sql

DROP FUNCTION IF EXISTS public.cancel_public_booking(uuid);

CREATE OR REPLACE FUNCTION public.cancel_customer_booking(p_appointment_id uuid)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_status text;
  v_appt_client_id uuid;
  v_user_email text;
  v_user_phone text;
  v_is_owner boolean := false;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email, raw_user_meta_data->>'phone' INTO v_user_email, v_user_phone
  FROM auth.users WHERE id = auth.uid();

  SELECT status, client_id INTO v_status, v_appt_client_id
  FROM appointments WHERE id = p_appointment_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  -- Verify ownership
  SELECT EXISTS (
    SELECT 1 FROM clients c 
    WHERE c.id = v_appt_client_id 
    AND (c.email = v_user_email OR c.phone = v_user_phone OR c.phone = COALESCE(v_user_phone, 'NONE'))
  ) INTO v_is_owner;

  IF NOT v_is_owner THEN
    RAISE EXCEPTION 'Not authorized to cancel this appointment';
  END IF;

  IF v_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Cannot cancel an appointment with status %', v_status;
  END IF;

  UPDATE appointments
  SET status = 'cancelled', updated_at = NOW()
  WHERE id = p_appointment_id;

  RETURN true;
END;
$$;
