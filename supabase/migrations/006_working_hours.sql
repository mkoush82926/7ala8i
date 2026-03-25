-- 006_working_hours.sql

CREATE TABLE IF NOT EXISTS public.working_hours (
  id uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  barber_id uuid NOT NULL REFERENCES public.profiles(id) ON DELETE CASCADE,
  day_of_week integer NOT NULL CHECK (day_of_week >= 0 AND day_of_week <= 6),
  start_time time without time zone DEFAULT '09:00:00',
  end_time time without time zone DEFAULT '18:00:00',
  is_working boolean DEFAULT true,
  created_at timestamp with time zone DEFAULT NOW(),
  UNIQUE (barber_id, day_of_week)
);

ALTER TABLE public.working_hours ENABLE ROW LEVEL SECURITY;

-- Anyone can read (needed for public booking page)
CREATE POLICY "working_hours_select" ON public.working_hours
  FOR SELECT USING (true);

-- Only shop admins or the barber themselves can manage their working hours
CREATE POLICY "working_hours_all_admin_or_self" ON public.working_hours
  FOR ALL USING (
    barber_id = auth.uid() OR
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid() AND role = 'shop_admin' 
      AND shop_id = (SELECT shop_id FROM public.profiles WHERE id = working_hours.barber_id)
    )
  );

-- Seed existing barbers with default working hours (Mon-Sun 9am - 6pm)
DO $$
DECLARE
  barber record;
  day int;
BEGIN
  FOR barber IN SELECT id FROM public.profiles WHERE role IN ('shop_admin', 'professional') LOOP
    FOR day IN 0..6 LOOP
      BEGIN
        INSERT INTO public.working_hours (barber_id, day_of_week, start_time, end_time, is_working)
        VALUES (barber.id, day, '09:00:00', '18:00:00', true);
      EXCEPTION WHEN unique_violation THEN
        -- Do nothing if already exists
      END;
    END LOOP;
  END LOOP;
END;
$$;
