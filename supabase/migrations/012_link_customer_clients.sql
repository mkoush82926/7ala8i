ALTER TABLE public.clients ADD COLUMN IF NOT EXISTS auth_user_id UUID REFERENCES auth.users(id);

CREATE OR REPLACE FUNCTION public.link_customer_client()
RETURNS uuid
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public, auth
AS $$
DECLARE
  v_user_email text;
  v_user_phone text;
  v_client_id uuid;
BEGIN
  IF auth.uid() IS NULL THEN
    RAISE EXCEPTION 'Not authenticated';
  END IF;

  SELECT email, raw_user_meta_data->>'phone' INTO v_user_email, v_user_phone
  FROM auth.users WHERE id = auth.uid();

  -- Already linked? Return the existing link, don't rematch.
  SELECT id INTO v_client_id FROM public.clients WHERE auth_user_id = auth.uid() LIMIT 1;
  IF v_client_id IS NOT NULL THEN
    RETURN v_client_id;
  END IF;

  -- First-time link: match by normalized phone digits or exact email, most recent unlinked match.
  SELECT id INTO v_client_id FROM public.clients
  WHERE auth_user_id IS NULL
    AND (
      (v_user_email IS NOT NULL AND email = v_user_email)
      OR (v_user_phone IS NOT NULL AND regexp_replace(phone, '\D', '', 'g') = regexp_replace(v_user_phone, '\D', '', 'g'))
    )
  ORDER BY created_at DESC
  LIMIT 1;

  IF v_client_id IS NOT NULL THEN
    UPDATE public.clients SET auth_user_id = auth.uid() WHERE id = v_client_id;
  END IF;

  RETURN v_client_id;
END;
$$;

GRANT EXECUTE ON FUNCTION public.link_customer_client() TO authenticated;
