-- Create notifications table
CREATE TABLE IF NOT EXISTS public.notifications (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
    shop_id UUID REFERENCES public.shops(id) ON DELETE CASCADE,
    title TEXT NOT NULL,
    message TEXT NOT NULL,
    link TEXT,
    is_read BOOLEAN DEFAULT false,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- RLS
ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

CREATE POLICY "Users can view their own notifications" 
ON public.notifications FOR SELECT 
USING (user_id = auth.uid());

CREATE POLICY "Users can update their own notifications (mark read)" 
ON public.notifications FOR UPDATE 
USING (user_id = auth.uid());

-- Triggers for automatic notification generation

-- 1. Notify shop admin when a new appointment is created
CREATE OR REPLACE FUNCTION public.notify_shop_on_appointment()
RETURNS TRIGGER AS $$
DECLARE
    v_admin_user_id UUID;
    v_client_name TEXT;
    v_shop_name TEXT;
BEGIN
    -- Only trigger for newly created appointments
    -- Get the shop admin's user ID (assuming standard setup where the profile role is 'shop_admin')
    SELECT id INTO v_admin_user_id 
    FROM public.profiles 
    WHERE shop_id = NEW.shop_id AND role = 'shop_admin' 
    LIMIT 1;

    IF v_admin_user_id IS NOT NULL THEN
        -- Get client info
        SELECT name INTO v_client_name FROM public.clients WHERE id = NEW.client_id;
        
        INSERT INTO public.notifications (user_id, shop_id, title, message, link)
        VALUES (
            v_admin_user_id, 
            NEW.shop_id, 
            'New Booking Received', 
            v_client_name || ' booked an appointment for ' || NEW.date || ' at ' || NEW.start_time,
            '/calendar'
        );
    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_shop_on_appointment
    AFTER INSERT ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.notify_shop_on_appointment();


-- 2. Notify customer when appointment status changes (e.g. cancelled)
CREATE OR REPLACE FUNCTION public.notify_client_on_appointment_status()
RETURNS TRIGGER AS $$
DECLARE
    v_client_user_id UUID;
    v_client_email TEXT;
BEGIN
    -- Only trigger if status changed
    IF OLD.status IS DISTINCT FROM NEW.status THEN
        
        -- Try to find the user_id corresponding to this client. 
        -- Halaqy binds clients to auth.users dynamically via email or phone.
        -- We can just check auth.users where email matches the client's email
        SELECT email INTO v_client_email FROM public.clients WHERE id = NEW.client_id;
        
        IF v_client_email IS NOT NULL THEN
            SELECT id INTO v_client_user_id FROM auth.users WHERE email = v_client_email LIMIT 1;
            
            IF v_client_user_id IS NOT NULL THEN
                INSERT INTO public.notifications (user_id, shop_id, title, message, link)
                VALUES (
                    v_client_user_id, 
                    NEW.shop_id, 
                    'Appointment Update', 
                    'Your appointment status is now: ' || NEW.status,
                    '/customer'
                );
            END IF;
        END IF;

    END IF;

    RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE TRIGGER trigger_notify_client_on_appointment_status
    AFTER UPDATE ON public.appointments
    FOR EACH ROW EXECUTE FUNCTION public.notify_client_on_appointment_status();

-- Index for real-time reads
CREATE INDEX idx_notifications_user_id ON public.notifications(user_id, created_at DESC);
