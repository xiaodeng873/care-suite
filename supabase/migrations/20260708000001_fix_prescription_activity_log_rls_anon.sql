/*
  # Fix prescription_activity_log RLS for custom auth users

  Problem:
    - new_medication_prescriptions has RLS **disabled** (never ran ENABLE ROW LEVEL SECURITY),
      so custom auth users (anon role) can freely CRUD prescriptions.
    - prescription_activity_log was created with RLS ENABLED and only TO authenticated policies.
    - Custom auth users connect as the "anon" role (they do not hold a Supabase Auth JWT).
    - Result: INSERT into prescription_activity_log is silently rejected by RLS,
      so no log entry is written even though the prescription operation succeeds.

  Fix:
    - Add matching policies for the "anon" role so both auth flows can write logs.
    - Keep the existing "authenticated" policies intact.
*/

-- Add anon INSERT policy (custom auth users)
DROP POLICY IF EXISTS "Anon users can insert prescription activity log" ON prescription_activity_log;

CREATE POLICY "Anon users can insert prescription activity log" ON prescription_activity_log
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Add anon SELECT policy (so custom auth users can read their own audit trail)
DROP POLICY IF EXISTS "Anon users can view prescription activity log" ON prescription_activity_log;

CREATE POLICY "Anon users can view prescription activity log" ON prescription_activity_log
  FOR SELECT
  TO anon
  USING (true);
