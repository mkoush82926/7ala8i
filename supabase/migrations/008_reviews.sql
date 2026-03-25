-- Create reviews table
CREATE TABLE IF NOT EXISTS public.reviews (
    id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
    shop_id UUID NOT NULL REFERENCES public.shops(id) ON DELETE CASCADE,
    client_id UUID NOT NULL REFERENCES public.clients(id) ON DELETE CASCADE,
    appointment_id UUID REFERENCES public.appointments(id) ON DELETE SET NULL,
    rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
    comment TEXT,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT timezone('utc'::text, now()) NOT NULL
);

-- Protect reviews with RLS
ALTER TABLE public.reviews ENABLE ROW LEVEL SECURITY;

-- Allow anyone to read reviews
CREATE POLICY "Anyone can view reviews" 
ON public.reviews FOR SELECT 
USING (true);

-- Allow authenticated users to insert reviews
CREATE POLICY "Authenticated users can insert reviews" 
ON public.reviews FOR INSERT 
TO authenticated 
WITH CHECK (true);

-- Allow admins/owners to delete reviews (optional)
CREATE POLICY "Shop owners can delete reviews for their shop" 
ON public.reviews FOR DELETE 
TO authenticated 
USING (
    EXISTS (
        SELECT 1 FROM public.profiles 
        WHERE profiles.id = auth.uid() 
        AND profiles.shop_id = reviews.shop_id 
        AND profiles.role = 'shop_admin'
    )
);

-- Index for speedy queries
CREATE INDEX IF NOT EXISTS idx_reviews_shop_id ON public.reviews(shop_id);
CREATE INDEX IF NOT EXISTS idx_reviews_rating ON public.reviews(rating);
