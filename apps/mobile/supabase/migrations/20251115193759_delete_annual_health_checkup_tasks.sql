/*
  # 刪除所有年度體檢任務記錄
  
  1. 變更說明
    - 從 patient_health_tasks 表中刪除所有 health_record_type = '年度體檢' 的任務記錄
    - 這是系統重構的一部分：將年度體檢從任務管理系統中分離，獨立使用 annual_health_checkups 表管理
  
  2. 影響範圍
    - 刪除所有類型為「年度體檢」的健康任務
    - 不影響其他任務類型（生命表徵、血糖控制、體重控制等）
    - 年度體檢資料保留在 annual_health_checkups 表中
  
  3. 安全措施
    - 此操作不可逆，但年度體檢資料已在 annual_health_checkups 表中獨立管理
    - 刪除前建議確認 annual_health_checkups 表有完整資料
*/

-- 刪除所有年度體檢任務記錄
DELETE FROM patient_health_tasks 
WHERE health_record_type = '年度體檢';

-- 驗證刪除結果（應該返回 0）
-- SELECT COUNT(*) FROM patient_health_tasks WHERE health_record_type = '年度體檢';