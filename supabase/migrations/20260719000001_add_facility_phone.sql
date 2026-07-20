-- Add facility phone to facility_settings table
ALTER TABLE public.facility_settings
ADD COLUMN IF NOT EXISTS facility_phone text;
