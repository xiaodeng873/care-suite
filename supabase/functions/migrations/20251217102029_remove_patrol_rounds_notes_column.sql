/*
  # 移除巡房記錄表的備註欄位

  1. 變更內容
    - 從 `patrol_rounds` 表中移除 `notes` 欄位
    - 此欄位為可選欄位，移除不會影響現有功能

  2. 影響範圍
    - 表格：patrol_rounds
    - 移除欄位：notes (text, nullable)

  3. 重要說明
    - 如果該欄位中已有數據，將會被刪除
    - 此操作不可逆，請確認備份完成後再執行
*/

-- 移除 notes 欄位
ALTER TABLE patrol_rounds 
DROP COLUMN IF EXISTS notes;
