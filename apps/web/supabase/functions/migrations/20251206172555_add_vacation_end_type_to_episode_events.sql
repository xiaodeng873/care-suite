/*
  # 新增 vacation_end_type 欄位到 episode_events 表

  1. 表擴展
    - 在 `episode_events` 表中新增 `vacation_end_type` 欄位
    - 允許每個渡假結束事件記錄自己的結束類型

  2. 變更說明
    - 新增 `vacation_end_type` 欄位 (vacation_end_type 枚舉類型，可為空)
    - 只有 event_type 為 'vacation_end' 的事件會使用此欄位
    
  3. 安全性
    - 使用 IF NOT EXISTS 檢查確保冪等性
    - 自動受現有 RLS 政策保護
*/

-- 新增 vacation_end_type 欄位到 episode_events 表
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'episode_events' AND column_name = 'vacation_end_type'
  ) THEN
    ALTER TABLE episode_events ADD COLUMN vacation_end_type vacation_end_type;
  END IF;
END $$;

-- 新增註解說明
COMMENT ON COLUMN episode_events.vacation_end_type IS '渡假結束類型：return_to_facility(返回護老院), home(回家), transfer_out(轉至其他機構), deceased(離世)。僅用於 event_type = vacation_end 的事件。';
