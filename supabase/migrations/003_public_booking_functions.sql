-- ═══════════════════════════════════════════════════════
-- HALAQY — Public Booking Functions (SECURITY DEFINER)
-- Bypasses RLS strictly for public booking operations
-- ═══════════════════════════════════════════════════════

-- 1. Create Public Booking
-- Safely creates or updates a client record and inserts an appointment
CREATE OR REPLACE FUNCTION public.create_public_booking(
  p_shop_id uuid,
  p_client_name text,
  p_client_phone text,
  p_service_ids uuid[],
  p_barber_id uuid,
  p_start_time timestamp with time zone,
  p_end_time timestamp with time zone,
  p_total_price numeric,
  p_source text
)
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_client_id uuid;
  v_appointment_id uuid;
BEGIN
  -- 1. Try to find existing client or insert new one
  SELECT id INTO v_client_id
  FROM clients
  WHERE shop_id = p_shop_id AND phone = p_client_phone;

  IF v_client_id IS NULL THEN
    INSERT INTO clients (shop_id, name, phone, source)
    VALUES (p_shop_id, p_client_name, p_client_phone, p_source)
    RETURNING id INTO v_client_id;
  ELSE
    -- Optional: Update client name if it changed
    UPDATE clients 
    SET name = p_client_name, updated_at = NOW() 
    WHERE id = v_client_id;
  END IF;

  -- 2. Create the appointment
  INSERT INTO appointments (
    shop_id,
    client_id,
    barber_id,
    service_ids,
    client_name,
    start_time,
    end_time,
    status,
    price,
    payment_status,
    payment_method,
    amount_total,
    amount_deposit,
    amount_paid,
    source
  )
  VALUES (
    p_shop_id,
    v_client_id,
    p_barber_id,
    COALESCE(p_service_ids, ARRAY[]::uuid[]),
    p_client_name,
    p_start_time,
    p_end_time,
    'pending',
    COALESCE(p_total_price, 0),
    'unpaid',
    'cash',
    p_total_price,
    0,
    0,
    COALESCE(p_source, 'online')
  )
  RETURNING id INTO v_appointment_id;

  RETURN v_appointment_id;
END;
$$;

-- 2. Cancel Public Booking
-- Allows cancelling an appointment ONLY if it is pending or confirmed
CREATE OR REPLACE FUNCTION public.cancel_public_booking(
  p_appointment_id uuid
)
RETURNS boolean
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_status text;
BEGIN
  -- Check current status
  SELECT status INTO v_status
  FROM appointments
  WHERE id = p_appointment_id;

  IF v_status IS NULL THEN
    RAISE EXCEPTION 'Appointment not found';
  END IF;

  IF v_status NOT IN ('pending', 'confirmed') THEN
    RAISE EXCEPTION 'Cannot cancel an appointment with status %', v_status;
  END IF;

  -- Update status
  UPDATE appointments
  SET 
    status = 'cancelled', 
    updated_at = NOW()
  WHERE id = p_appointment_id;

  RETURN true;
END;
$$;
