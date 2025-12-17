/*
  # 全面修復所有表的 RLS 策略

  ## 問題
  多個核心表缺少完整的 CRUD RLS 策略，導致用戶無法正常操作

  ## 修復的表
  ### 完全沒有策略的表（添加完整 CRUD）
  - medication_risk_rules
  - medication_workflow_records
  - medication_workflow_settings
  - new_medication_prescriptions
  - prescription_inspection_rules
  - prescription_time_slot_definitions
  - 健康記錄主表
  - 院友主表

  ### 缺少部分策略的表（補充缺失策略）
  - beds (添加 INSERT, UPDATE, DELETE)
  - daily_system_tasks (添加 DELETE)
  - ocr_prompt_templates (添加 INSERT, UPDATE, DELETE)
  - ocr_recognition_logs (添加 UPDATE, DELETE)
  - stations (添加 INSERT, UPDATE, DELETE)
  - 看診原因選項 (添加 INSERT, UPDATE, DELETE)

  ## 安全考量
  - 所有策略限制為已認證用戶（authenticated）
  - 允許已認證用戶進行所有 CRUD 操作
  - 符合醫護管理系統的使用情境
*/

-- ============================================
-- 院友主表 (最核心的表)
-- ============================================
CREATE POLICY "允許已認證用戶讀取院友資料"
  ON "院友主表" FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶新增院友資料"
  ON "院友主表" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶修改院友資料"
  ON "院友主表" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除院友資料"
  ON "院友主表" FOR DELETE TO authenticated USING (true);

-- ============================================
-- 健康記錄主表
-- ============================================
CREATE POLICY "允許已認證用戶讀取健康記錄"
  ON "健康記錄主表" FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶新增健康記錄"
  ON "健康記錄主表" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶修改健康記錄"
  ON "健康記錄主表" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除健康記錄"
  ON "健康記錄主表" FOR DELETE TO authenticated USING (true);

-- ============================================
-- 處方相關表
-- ============================================
CREATE POLICY "允許已認證用戶讀取處方資料"
  ON "new_medication_prescriptions" FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶新增處方資料"
  ON "new_medication_prescriptions" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶修改處方資料"
  ON "new_medication_prescriptions" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除處方資料"
  ON "new_medication_prescriptions" FOR DELETE TO authenticated USING (true);

-- ============================================
-- 處方檢測規則表
-- ============================================
CREATE POLICY "允許已認證用戶讀取處方檢測規則"
  ON "prescription_inspection_rules" FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶新增處方檢測規則"
  ON "prescription_inspection_rules" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶修改處方檢測規則"
  ON "prescription_inspection_rules" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除處方檢測規則"
  ON "prescription_inspection_rules" FOR DELETE TO authenticated USING (true);

-- ============================================
-- 處方時間槽定義表
-- ============================================
CREATE POLICY "允許已認證用戶讀取處方時間槽定義"
  ON "prescription_time_slot_definitions" FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶新增處方時間槽定義"
  ON "prescription_time_slot_definitions" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶修改處方時間槽定義"
  ON "prescription_time_slot_definitions" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除處方時間槽定義"
  ON "prescription_time_slot_definitions" FOR DELETE TO authenticated USING (true);

-- ============================================
-- 用藥工作流記錄表
-- ============================================
CREATE POLICY "允許已認證用戶讀取用藥工作流記錄"
  ON "medication_workflow_records" FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶新增用藥工作流記錄"
  ON "medication_workflow_records" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶修改用藥工作流記錄"
  ON "medication_workflow_records" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除用藥工作流記錄"
  ON "medication_workflow_records" FOR DELETE TO authenticated USING (true);

-- ============================================
-- 用藥工作流設定表
-- ============================================
CREATE POLICY "允許已認證用戶讀取用藥工作流設定"
  ON "medication_workflow_settings" FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶新增用藥工作流設定"
  ON "medication_workflow_settings" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶修改用藥工作流設定"
  ON "medication_workflow_settings" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除用藥工作流設定"
  ON "medication_workflow_settings" FOR DELETE TO authenticated USING (true);

-- ============================================
-- 用藥風險規則表
-- ============================================
CREATE POLICY "允許已認證用戶讀取用藥風險規則"
  ON "medication_risk_rules" FOR SELECT TO authenticated USING (true);

CREATE POLICY "允許已認證用戶新增用藥風險規則"
  ON "medication_risk_rules" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶修改用藥風險規則"
  ON "medication_risk_rules" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除用藥風險規則"
  ON "medication_risk_rules" FOR DELETE TO authenticated USING (true);

-- ============================================
-- 補充缺少的策略
-- ============================================

-- beds 表
DROP POLICY IF EXISTS "允許已認證用戶新增床位" ON "beds";
DROP POLICY IF EXISTS "允許已認證用戶修改床位" ON "beds";
DROP POLICY IF EXISTS "允許已認證用戶刪除床位" ON "beds";

CREATE POLICY "允許已認證用戶新增床位"
  ON "beds" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶修改床位"
  ON "beds" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除床位"
  ON "beds" FOR DELETE TO authenticated USING (true);

-- stations 表
DROP POLICY IF EXISTS "允許已認證用戶新增站點" ON "stations";
DROP POLICY IF EXISTS "允許已認證用戶修改站點" ON "stations";
DROP POLICY IF EXISTS "允許已認證用戶刪除站點" ON "stations";

CREATE POLICY "允許已認證用戶新增站點"
  ON "stations" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶修改站點"
  ON "stations" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除站點"
  ON "stations" FOR DELETE TO authenticated USING (true);

-- daily_system_tasks 表
DROP POLICY IF EXISTS "允許已認證用戶刪除系統任務" ON "daily_system_tasks";

CREATE POLICY "允許已認證用戶刪除系統任務"
  ON "daily_system_tasks" FOR DELETE TO authenticated USING (true);

-- ocr_prompt_templates 表
DROP POLICY IF EXISTS "允許已認證用戶新增OCR提示模板" ON "ocr_prompt_templates";
DROP POLICY IF EXISTS "允許已認證用戶修改OCR提示模板" ON "ocr_prompt_templates";
DROP POLICY IF EXISTS "允許已認證用戶刪除OCR提示模板" ON "ocr_prompt_templates";

CREATE POLICY "允許已認證用戶新增OCR提示模板"
  ON "ocr_prompt_templates" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶修改OCR提示模板"
  ON "ocr_prompt_templates" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除OCR提示模板"
  ON "ocr_prompt_templates" FOR DELETE TO authenticated USING (true);

-- ocr_recognition_logs 表
DROP POLICY IF EXISTS "允許已認證用戶修改OCR識別日誌" ON "ocr_recognition_logs";
DROP POLICY IF EXISTS "允許已認證用戶刪除OCR識別日誌" ON "ocr_recognition_logs";

CREATE POLICY "允許已認證用戶修改OCR識別日誌"
  ON "ocr_recognition_logs" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除OCR識別日誌"
  ON "ocr_recognition_logs" FOR DELETE TO authenticated USING (true);

-- 看診原因選項 表
DROP POLICY IF EXISTS "允許已認證用戶新增看診原因選項" ON "看診原因選項";
DROP POLICY IF EXISTS "允許已認證用戶修改看診原因選項" ON "看診原因選項";
DROP POLICY IF EXISTS "允許已認證用戶刪除看診原因選項" ON "看診原因選項";

CREATE POLICY "允許已認證用戶新增看診原因選項"
  ON "看診原因選項" FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "允許已認證用戶修改看診原因選項"
  ON "看診原因選項" FOR UPDATE TO authenticated USING (true) WITH CHECK (true);

CREATE POLICY "允許已認證用戶刪除看診原因選項"
  ON "看診原因選項" FOR DELETE TO authenticated USING (true);
