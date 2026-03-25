-- 005_barber_services.sql

CREATE TABLE IF NOT EXISTS public.barber_services (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  service_id uuid NOT NULL REFERENCES public.services(id) ON DELETE CASCADE,
  is_active boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT NOW(),
  UNIQUE (barber_id, service_id)
);

ALTER TABLE public.barber_services ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed for public booking page)
CREATE POLICY "barber_services_select" ON public.barber_services
  FOR SELECT USING (true);

-- Only shop admins can manage barber services for barbers in their shop
CREATE POLICY "barber_services_insert_admin" ON public.barber_services
  FOR INSERT WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'shop_admin' 
      AND shop_id = (SELECT shop_id FROM public.profiles WHERE id = barber_services.barber_id)
    )
  );

CREATE POLICY "barber_services_delete_admin" ON public.barber_services
  FOR DELETE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'shop_admin'
      AND shop_id = (SELECT shop_id FROM public.profiles WHERE id = barber_services.barber_id)
    )
  );

CREATE POLICY "barber_services_update_admin" ON public.barber_services
  FOR UPDATE USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'shop_admin'
      AND shop_id = (SELECT shop_id FROM public.profiles WHERE id = barber_services.barber_id)
    )
  );

-- Seed existing barbers with all existing services in their shop
INSERT INTO public.barber_services (barber_id, service_id)
SELECT p.id, s.id
FROM public.profiles p
JOIN public.services s ON p.shop_id = s.shop_id
WHERE p.role IN ('shop_admin', 'professional') 
AND NOT EXISTS (
  SELECT 1 FROM public.barber_services bs WHERE bs.barber_id = p.id AND bs.service_id = s.id
);
