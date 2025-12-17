/*
  # Fix preparation method trigger to use English field name
  
  ## Changes
  - Update `set_preparation_method_by_dosage_form()` function to use `NEW.dosage_form` instead of `NEW.劑型`
  - This fixes the error "record 'new' has no field '劑型'" when updating prescriptions
  
  ## Notes
  - The function was using the old Chinese field name which no longer exists in the table
  - The table uses English field names like `dosage_form` not Chinese names like `劑型`
*/

-- Drop and recreate the function with correct English field name
CREATE OR REPLACE FUNCTION public.set_preparation_method_by_dosage_form()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $$
BEGIN
  IF NEW.dosage_form IN ('內服液', '外用液', '眼藥水', '鼻噴劑', '滴劑') THEN
    NEW.preparation_method = 'original';
  ELSIF NEW.dosage_form IN ('錠劑', '膠囊', '軟膠囊', '糖衣錠', '發泡錠') THEN
    NEW.preparation_method = 'blister';
  END IF;
  RETURN NEW;
END;
$$;
