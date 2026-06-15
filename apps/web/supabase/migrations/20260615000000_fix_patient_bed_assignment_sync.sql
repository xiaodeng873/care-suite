/*
  # Fix patient bed assignment synchronization

  Legacy web bed assignment only updated patient.bed_id.  Many screens still read
  patient.床號 and patient.station_id, so existing records could appear under the
  old bed until a manual patient edit corrected those denormalized fields.

  This migration:
  1. Repairs existing active patients by copying bed_number/station_id from beds.
  2. Rewrites the bed occupancy trigger to use bed_id instead of 床號.
  3. Recomputes all bed occupancy flags from active patient bed_id values.
*/

UPDATE "院友主表" AS p
SET
  "床號" = b.bed_number,
  station_id = b.station_id
FROM beds AS b
WHERE p.bed_id = b.id
  AND p."在住狀態" = '在住'
  AND (
    p."床號" IS DISTINCT FROM b.bed_number
    OR p.station_id IS DISTINCT FROM b.station_id
  );

CREATE OR REPLACE FUNCTION public.sync_bed_occupied_status_v2()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path TO 'public', 'pg_temp'
AS $function$
DECLARE
  bed_ids_to_update uuid[];
BEGIN
  IF TG_OP = 'INSERT' THEN
    bed_ids_to_update := ARRAY[NEW.bed_id]::uuid[];
  ELSIF TG_OP = 'UPDATE' THEN
    bed_ids_to_update := ARRAY[OLD.bed_id, NEW.bed_id]::uuid[];
  ELSIF TG_OP = 'DELETE' THEN
    bed_ids_to_update := ARRAY[OLD.bed_id]::uuid[];
  END IF;

  SELECT array_agg(DISTINCT bed_id)
  INTO bed_ids_to_update
  FROM unnest(bed_ids_to_update) AS bed_id
  WHERE bed_id IS NOT NULL;

  IF bed_ids_to_update IS NOT NULL THEN
    UPDATE beds
    SET is_occupied = EXISTS (
      SELECT 1
      FROM "院友主表" AS p
      WHERE p.bed_id = beds.id
        AND p."在住狀態" = '在住'
    )
    WHERE beds.id = ANY(bed_ids_to_update);
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  RETURN NEW;
END;
$function$;

UPDATE beds
SET is_occupied = EXISTS (
  SELECT 1
  FROM "院友主表" AS p
  WHERE p.bed_id = beds.id
    AND p."在住狀態" = '在住'
);
