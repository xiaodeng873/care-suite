/*
  # 添加「暫停」到派藥失敗原因枚舉

  1. 修改內容
    - 將「暫停」添加到 `dispensing_failure_reason_enum` 枚舉類型
    - 現有值：'回家', '入院', '拒服', '略去', '藥物不足', '其他'
    - 新增值：'暫停'
  
  2. 原因
    - 前端使用「暫停」作為失敗原因
    - 資料庫枚舉需要支持這個值以避免錯誤
    
  3. 影響
    - 不影響現有數據
    - 允許新記錄使用「暫停」作為失敗原因
*/

-- 添加「暫停」到 dispensing_failure_reason_enum
ALTER TYPE dispensing_failure_reason_enum ADD VALUE IF NOT EXISTS '暫停';
