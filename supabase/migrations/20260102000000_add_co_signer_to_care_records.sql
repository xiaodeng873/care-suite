-- Add co_signer field to patrol_rounds table
ALTER TABLE patrol_rounds
ADD COLUMN IF NOT EXISTS co_signer TEXT;

-- Add co_signer field to restraint_observation_records table
ALTER TABLE restraint_observation_records
ADD COLUMN IF NOT EXISTS co_signer TEXT;

-- Add comments to document the new field
COMMENT ON COLUMN patrol_rounds.co_signer IS '加簽者 - 協助記錄或複核的人員';
COMMENT ON COLUMN restraint_observation_records.co_signer IS '加簽者 - 協助記錄或複核的人員';
