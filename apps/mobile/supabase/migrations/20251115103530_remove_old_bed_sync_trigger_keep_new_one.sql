/*
  # 清理舊的床位同步觸發器，只保留新版本

  問題:
  - 存在兩個觸發器：舊的 trigger_sync_bed_occupied_status 和新的 sync_bed_status_on_patient_change
  - 舊觸發器使用有問題的 sync_bed_occupied_status() 函數
  
  解決方案:
  - 刪除舊觸發器
  - 刪除舊函數
  - 保留新的 sync_bed_occupied_status_v2() 和對應的觸發器
*/

-- 刪除舊觸發器
DROP TRIGGER IF EXISTS trigger_sync_bed_occupied_status ON "院友主表";

-- 現在可以安全刪除舊函數
DROP FUNCTION IF EXISTS sync_bed_occupied_status() CASCADE;

-- 確認新觸發器和函數存在
-- sync_bed_status_on_patient_change 觸發器已經存在
-- sync_bed_occupied_status_v2() 函數已經存在
