/*
  # 移除不合理的傷口評估唯一約束

  ## 問題說明
  之前的遷移創建了 `unique_active_wound_assessment` 約束，限制每個病人只能有一個活動的傷口評估。
  這個約束不合理，因為：
  1. 一個病人可能同時有多個不同部位的傷口
  2. 每個傷口都需要獨立的評估記錄
  3. 這會阻止正常的業務操作

  ## 解決方案
  移除 `unique_active_wound_assessment` 約束，允許每個病人有多個活動的傷口評估記錄。

  ## 影響
  - 允許同一病人有多個活動的傷口評估（正確的業務邏輯）
  - 不影響現有數據
  - 提升系統可用性
*/

-- ============================================
-- 移除不合理的唯一約束
-- ============================================

-- 移除傷口評估的唯一約束（允許一個病人有多個活動的傷口評估）
DROP INDEX IF EXISTS unique_active_wound_assessment;

-- 如果需要，可以添加一個組合索引來提升查詢效能
-- 但不強制唯一性
CREATE INDEX IF NOT EXISTS idx_wound_assessments_patient_status
ON wound_assessments(patient_id, status);