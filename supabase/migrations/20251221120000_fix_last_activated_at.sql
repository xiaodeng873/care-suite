-- Fix last_activated_at dates for existing tabs
-- This resets last_activated_at to created_at for tabs that were incorrectly updated

UPDATE patient_care_tabs
SET last_activated_at = created_at
WHERE last_activated_at > created_at;

-- Also update the trigger to be more cautious
-- Only update last_activated_at if it's NULL or if this is truly a re-activation
CREATE OR REPLACE FUNCTION update_last_activated_at()
RETURNS TRIGGER AS $$
BEGIN
  -- Only update if:
  -- 1. Changed from hidden to visible
  -- 2. AND last_activated_at is NULL (never been activated)
  IF NEW.is_hidden = false AND OLD.is_hidden = true AND NEW.last_activated_at IS NULL THEN
    NEW.last_activated_at := NOW();
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;