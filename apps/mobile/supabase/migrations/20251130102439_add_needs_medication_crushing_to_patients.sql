/*
  # 添加院友碎藥需求欄位

  ## 更新說明
  為「院友主表」添加「需要碎藥」布林欄位，用於標記院友是否需要將藥物碾碎服用

  ## 變更內容
  1. 新增欄位
    - `needs_medication_crushing` (boolean): 是否需要碎藥
      - 預設值: false
      - 說明: 標記該院友的藥物是否需要碾碎後服用

  ## 業務邏輯
  - 此欄位用於藥物工作流程頁面顯示碎藥需求提示
  - 護理人員可以透過介面直接更新此欄位
  - 欄位變更會被記錄在 updated_at 時間戳

  ## 安全性
  - 使用現有的 RLS 政策，authenticated 用戶可讀寫
*/

-- 添加「需要碎藥」欄位到院友主表
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = '院友主表' AND column_name = 'needs_medication_crushing'
  ) THEN
    ALTER TABLE "院友主表" ADD COLUMN needs_medication_crushing boolean DEFAULT false;

    -- 添加註解說明欄位用途
    COMMENT ON COLUMN "院友主表".needs_medication_crushing IS '是否需要碎藥：標記院友的藥物是否需要碾碎後服用';
  END IF;
END $$;
