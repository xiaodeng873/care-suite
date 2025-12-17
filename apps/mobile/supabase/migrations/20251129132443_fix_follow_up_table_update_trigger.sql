/*
  # 修復覆診安排主表的更新觸發器

  1. 問題說明
    - 覆診安排主表使用中文欄位名「更新時間」
    - 通用的 update_updated_at_column() 函數使用英文欄位名 updated_at
    - 這導致更新時出現 "record new has no field updated_at" 錯誤

  2. 解決方案
    - 刪除現有觸發器
    - 創建專用的更新函數使用正確的中文欄位名
    - 重新創建觸發器使用新函數
*/

-- 刪除現有的觸發器
DROP TRIGGER IF EXISTS update_覆診安排主表_updated_at ON 覆診安排主表;

-- 創建專用的更新函數給覆診安排主表
CREATE OR REPLACE FUNCTION update_覆診安排主表_updated_at()
RETURNS TRIGGER AS $$
BEGIN
    NEW.更新時間 = now();
    RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- 重新創建觸發器使用新函數
CREATE TRIGGER update_覆診安排主表_updated_at
    BEFORE UPDATE ON 覆診安排主表
    FOR EACH ROW
    EXECUTE FUNCTION update_覆診安排主表_updated_at();
