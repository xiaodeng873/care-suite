/*
  # 新增返回院舍出院類型

  1. Schema Changes
    - 在 `discharge_type` enum 中新增 `return_to_facility` 選項
    - 更新相關表格以支援新的出院類型

  2. Security
    - 維持現有的 RLS 政策
    - 不影響現有資料的完整性

  3. Notes
    - 新增的 enum 值將支援「返回院舍」選項
    - 現有資料不會受到影響
*/

-- 新增 return_to_facility 到 discharge_type enum
ALTER TYPE discharge_type ADD VALUE IF NOT EXISTS 'return_to_facility';