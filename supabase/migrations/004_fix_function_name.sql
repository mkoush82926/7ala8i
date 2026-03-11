-- ============================================
-- Fix function name mismatch
-- Migration 001 created get_user_shop_id()
-- but 002/003 reference get_current_shop_id()
-- This creates get_current_shop_id() if it doesn't exist
-- Run this in the Supabase SQL Editor
-- ============================================

CREATE OR REPLACE FUNCTION public.get_current_shop_id()
RETURNS UUID
LANGUAGE sql SECURITY DEFINER
AS $$
  SELECT shop_id FROM public.profiles WHERE id = auth.uid() LIMIT 1;
$$;
