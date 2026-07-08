/*
  # 處方日誌（Prescription Activity Log）

  1. 新表
    - `prescription_activity_log` — 記錄每位院友所有處方變動（審計時間線）
      - `patient_id` (integer) — 院友，外鍵關聯 院友主表，ON DELETE CASCADE
      - `prescription_id` (uuid) — 對應處方；不設外鍵，容許處方被刪除後仍保留日誌
      - `medication_name` (text) — 冗餘藥名，供刪除後顯示
      - `action_type` (text) — create / update / delete / status_change / replace / batch_date_update / restore
      - `from_status` / `to_status` (text) — 狀態遷移用
      - `field_changes` (jsonb) — 逐欄 old→new 差異清單
      - `snapshot_before` / `snapshot_after` (jsonb) — 動作前後完整處方快照（供還原）
      - 去正規化 actor 欄位 — 記錄動作當下的用戶身份，日後修改用戶資料不影響歷史
      - `restored_from_log_id` (uuid) — 若此筆為還原動作，指向被還原的日誌
      - `group_id` (uuid) — 綁定同一高階操作的多筆記錄（取代 / 批次改日期）

  2. 安全性
    - 啟用 RLS
    - 只允許已認證用戶 SELECT 與 INSERT（禁止 UPDATE / DELETE 以保審計完整性）

  3. 索引
    - patient_id、prescription_id、created_at DESC、group_id
*/

CREATE TABLE IF NOT EXISTS prescription_activity_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  patient_id integer REFERENCES "院友主表"("院友id") ON DELETE CASCADE,
  prescription_id uuid,
  medication_name text,
  action_type text NOT NULL,
  from_status text,
  to_status text,
  field_changes jsonb DEFAULT '[]'::jsonb,
  snapshot_before jsonb,
  snapshot_after jsonb,
  actor_user_id uuid,
  actor_username text,
  actor_name text,
  actor_role text,
  actor_department text,
  restored_from_log_id uuid,
  group_id uuid,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_prescription_activity_log_patient_id ON prescription_activity_log(patient_id);
CREATE INDEX IF NOT EXISTS idx_prescription_activity_log_prescription_id ON prescription_activity_log(prescription_id);
CREATE INDEX IF NOT EXISTS idx_prescription_activity_log_created_at ON prescription_activity_log(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_prescription_activity_log_group_id ON prescription_activity_log(group_id);

ALTER TABLE prescription_activity_log ENABLE ROW LEVEL SECURITY;

-- 只允許查詢與新增（審計日誌不可竄改：不提供 UPDATE / DELETE 政策）
CREATE POLICY "Authenticated users can view prescription activity log"
  ON prescription_activity_log
  FOR SELECT
  TO authenticated
  USING (true);

CREATE POLICY "Authenticated users can insert prescription activity log"
  ON prescription_activity_log
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

COMMENT ON TABLE prescription_activity_log IS '處方日誌：記錄每位院友所有處方變動的審計時間線，支援還原操作';
