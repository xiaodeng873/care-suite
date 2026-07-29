// =====================================================
// AI 助護 — 資料庫 Schema 摘要（直接從實際 DB dump 生成）
// 供 System Prompt 使用，讓 LLM 了解資料庫結構
// =====================================================
export const DB_SCHEMA_SUMMARY = `
你可以查詢或操作以下資料表（PostgreSQL）。所有欄位名稱及型態均為實際資料庫結構，請嚴格使用這些欄位名產生 SQL。

## 院友主表
- **院友主表** (院友id integer [PK], 床號 varchar, 中文姓名 varchar, 英文姓名 varchar, 性別, 身份證號碼 varchar, 出生日期 date, 院友相片 text, 藥物敏感 jsonb, 不良藥物反應 jsonb, 感染控制 jsonb, 入住日期 date, 退住日期 date, 護理等級, 入住類型, 社會福利 jsonb, 在住狀態, 中文姓氏 text, 中文名字 text, 英文姓氏 text, 英文名字 text, station_id uuid, bed_id uuid, is_hospitalized boolean, discharge_reason text, death_date date, transfer_facility_name text, needs_medication_crushing boolean, qr_code_id text, 通訊電話 varchar, 通訊地址 text, 教育程度 varchar, 從前主要職業 varchar, 宗教信仰 varchar, 婚姻狀況 varchar, 首次記錄職員姓名 varchar, 首次記錄職級 varchar, 首次記錄簽署 varchar, 首次記錄日期 date, social_status_json jsonb, medical_history_json jsonb, vaccination_records_json jsonb, medical_services_json jsonb, nursing_assessment_json jsonb)

## 院友聯絡人
- **patient_contacts** (id uuid [PK], 院友id integer [FK→院友主表], 聯絡人姓名 varchar, 關係 varchar, 聯絡電話 varchar, 電郵 varchar, 地址 text, 備註 text, is_primary boolean, created_at, updated_at)

## 院友入院記錄
- **patient_admission_records** (id uuid [PK], patient_id integer, event_type, event_date date, event_time time, hospital_name text, hospital_ward text, hospital_bed_number text, remarks text, discharge_type, date_of_death date, time_of_death time, transfer_to_facility_name text, transfer_to_facility_address text, transfer_paths jsonb, created_at, updated_at)

## 感染控制記錄
- **infection_control_records** (id uuid [PK], patient_id integer [FK→院友主表], infection_type text, diagnosis_date date, recovery_date date, created_at, updated_at)
  - 取代院友主表「感染控制」JSONB 陣列；查傳染病/感染控制請用此表

## 院友照護分頁
- **patient_care_tabs** (id uuid [PK], patient_id integer, tab_type text, is_manually_added boolean, is_hidden boolean, created_at, updated_at, last_activated_at timestamptz)

## 健康監測記錄（取代舊的 健康記錄主表）
- **健康監測記錄** (記錄id uuid [PK], 院友id integer [FK→院友主表], 任務id uuid [FK→patient_health_tasks], 記錄日期 date, 記錄時間 time, 監測類型 health_task_type, 數值 decimal(6,2), 數值_副 decimal(6,2), 備註 text, 記錄人員 varchar(50), 建立時間 timestamptz)
  - 監測類型合法值：'血壓'、'脈搏'、'體溫'、'血含氧量'、'呼吸'、'血糖值'、'體重'
  - 血壓：數值 = 收縮壓，數值_副 = 舒張壓；其他類型的 數值_副 為 NULL

## 健康監測會話視圖
- **健康監測_會話視圖** (院友id, 院友姓名, 院友床號, 記錄日期, 記錄時間, 任務id, 測量值組 jsonb, 備註, 記錄人員, 建立時間, 記錄id_列表)
  - 按 (院友, 日期, 時間, 任務) 合併同一時段的多筆 narrow rows

## 健康評估
- **health_assessments** (id uuid [PK], patient_id integer, smoking_habit text, drinking_habit text, daily_activities jsonb, nutrition_diet jsonb, vision_hearing jsonb, communication_ability text, consciousness_cognition text, bowel_bladder_control jsonb, emotional_expression text, remarks text, assessment_date date, assessor text, next_due_date date, smoking_years_quit text, smoking_quantity text, drinking_years_quit text, drinking_quantity text, communication_other text, consciousness_other text, emotional_other text, treatment_items jsonb, toilet_training boolean, behavior_expression text, status, archived_at, created_at, updated_at)

## 院友健康任務排程
- **patient_health_tasks** (id uuid [PK], patient_id integer, health_record_type, frequency_unit, frequency_value integer, specific_times jsonb, specific_days_of_week jsonb, specific_days_of_month jsonb, last_completed_at timestamptz, next_due_at timestamptz, 更新時間 timestamptz, notes, end_date date, end_time time, is_recurring boolean, tube_type text, tube_size text, start_date timestamptz, created_at, updated_at)

## 診斷記錄
- **diagnosis_records** (id uuid [PK], patient_id integer, diagnosis_date date, diagnosis_item text, diagnosis_unit text, remarks text, created_by uuid, created_at, updated_at)

## 疫苗記錄
- **vaccination_records** (id uuid [PK], patient_id integer, vaccination_date date, vaccine_item text, vaccination_unit text, remarks text, created_by uuid, created_at, updated_at)

## 藥物處方
- **new_medication_prescriptions** (id uuid [PK], patient_id integer, medication_name text, medication_source text, prescription_date date, start_date date, start_time time, end_date date, end_time time, dosage_form text, administration_route text, dosage_amount text, frequency_type text, frequency_value integer, specific_weekdays jsonb, is_odd_even_day text, medication_time_slots jsonb, meal_timing text, is_prn boolean, preparation_method text, status text, notes text, inspection_rules jsonb, daily_frequency integer, dosage_unit text, special_dosage_instruction text, medication_quantity text, duration_days integer, created_by text, last_modified_by text, created_at, updated_at)

## 藥物資料庫
- **medication_drug_database** (id uuid [PK], drug_name text, drug_code text, drug_type text, administration_route text, unit text, photo_url text, notes text, created_at, updated_at)

## 派藥工作記錄
- **medication_workflow_records** (id uuid [PK], prescription_id uuid, patient_id integer, scheduled_date date, scheduled_time time, preparation_status, verification_status, dispensing_status, preparation_staff text, verification_staff text, dispensing_staff text, preparation_time timestamptz, verification_time timestamptz, dispensing_time timestamptz, dispensing_failure_reason, custom_failure_reason text, notes text, inspection_check_result jsonb, created_at, updated_at)

## 派藥時段定義
- **prescription_time_slot_definitions** (id uuid [PK], slot_name text, start_time time, end_time time, is_meal_related boolean, meal_type text, description text, created_at, updated_at)

## 藥物風險規則
- **medication_risk_rules** (id uuid [PK], rule_name text, rule_type, rule_details jsonb, warning_message text, is_active boolean, created_at, updated_at)

## 處方檢查規則
- **prescription_inspection_rules** (id uuid [PK], prescription_id uuid, vital_sign_type text, condition_operator text, condition_value numeric, action_if_met text, created_at, updated_at)

## 派藥工作設定
- **medication_workflow_settings** (id uuid [PK], user_id uuid, enable_one_click_functions boolean, enable_immediate_preparation_alerts boolean, auto_jump_to_next_patient boolean, default_preparation_lead_time integer, created_at, updated_at)

## 巡房記錄
- **patrol_rounds** (id uuid [PK], patient_id integer, patrol_date date, patrol_time time, scheduled_time text, recorder text, co_signer text, created_at, updated_at)

## 換片記錄
- **diaper_change_records** (id uuid [PK], patient_id integer, change_date date, time_slot text, has_urine boolean, has_stool boolean, has_none boolean, urine_amount text, stool_color text, stool_texture text, stool_amount text, recorder text, notes text, created_at, updated_at)

## 約束觀察記錄
- **restraint_observation_records** (id uuid [PK], patient_id integer, observation_date date, observation_time time, scheduled_time text, observation_status text, recorder text, notes text, used_restraints jsonb, co_signer text, created_at, updated_at)

## 轉身記錄
- **position_change_records** (id uuid [PK], patient_id integer, change_date date, scheduled_time text, position text, recorder text, notes text, created_at, updated_at)

## 個人衛生記錄
- **hygiene_records** (id uuid [PK], patient_id integer, record_date date, time_slot text, has_bath boolean, has_face_wash boolean, has_shave boolean, has_oral_care boolean, has_denture_care boolean, has_nail_trim boolean, has_bedding_change boolean, has_sheet_pillow_change boolean, has_cup_wash boolean, has_bedside_cabinet boolean, has_wardrobe boolean, bowel_count integer, bowel_amount text, bowel_consistency text, recorder text, status_notes text, notes text, bowel_medication text, has_haircut boolean, created_at, updated_at)

## 進出量記錄
- **intake_output_records** (id uuid [PK], patient_id integer, record_date date, hour_slot integer, time_slot varchar, meal_breakfast text, meal_lunch text, meal_afternoon_tea text, meal_dinner text, beverage_water integer, beverage_soup integer, beverage_milk integer, beverage_juice integer, beverage_sugar_water integer, beverage_tea integer, other_cookies integer, other_snacks integer, other_candy integer, other_dessert integer, tube_isocal integer, tube_ultracal integer, tube_glucerna integer, tube_isosource integer, tube_compleat integer, urine_volume integer, urine_color text, gastric_volume integer, gastric_ph numeric, gastric_color text, notes text, recorder text, created_at, updated_at)
- **intake_items** (id uuid [PK], record_id uuid [FK→intake_output_records.id], category varchar, item_type varchar, amount varchar, amount_numeric numeric, unit varchar, created_at)
- **output_items** (id uuid [PK], record_id uuid [FK→intake_output_records.id], category varchar, color varchar, ph_value numeric, amount_ml integer, created_at)

## 傷口管理
- **wounds** (id uuid [PK], patient_id integer, wound_code text, wound_name text, discovery_date date, wound_location jsonb, wound_type text, wound_type_other text, wound_origin text, status text, healed_date date, next_assessment_due date, remarks text, responsible_unit text, responsible_unit_other text, created_at, updated_at)
- **wound_assessments** (id uuid [PK], patient_id integer, wound_id uuid [FK→wounds.id], assessment_date date, next_assessment_date date, assessor text, wound_type text, wound_status text, responsible_unit text, wound_details jsonb, status, archived_at, assessment_status text, is_archived boolean, stage text, wound_photos jsonb, area_depth numeric, area_length numeric, area_width numeric, cleanser text, cleanser_other text, dressings jsonb, dressing_other text, remarks text, exudate_present boolean, exudate_amount text, exudate_color text, exudate_type text, odor text, granulation text, necrosis text, infection text, temperature text, surrounding_skin_condition text, surrounding_skin_color text, created_at, updated_at)

## 照顧計劃
- **care_plans** (id uuid [PK], patient_id integer, parent_plan_id uuid, version_number integer, plan_type text, plan_date date, review_due_date date, reviewed_at timestamptz, reviewed_by text, created_by text, status text, archived_at timestamptz, remarks text, case_conference_date date, case_conference_professionals jsonb, family_contact_date date, family_member_name text, family_participated boolean, responsible_staff text, special_care_needs text, created_at, updated_at)
- **care_plan_problems** (id uuid [PK], care_plan_id uuid [FK→care_plans.id], problem_library_id uuid, problem_category text, problem_description text, expected_goals array, interventions array, outcome_review text, problem_assessor text, outcome_assessor text, display_order integer, outcome_review_details text, created_at, updated_at)
- **care_plan_nursing_needs** (id uuid [PK], care_plan_id uuid [FK→care_plans.id], nursing_need_item_id uuid [FK→nursing_need_items.id], has_need boolean, remarks text, created_at, updated_at)
- **nursing_need_items** (id uuid [PK], name text, is_default boolean, display_order integer, is_active boolean, created_at, updated_at)
- **problem_library** (id uuid [PK], code text, name text, category text, subcategory text, description text, expected_goals array, interventions array, keywords array, is_active boolean, created_by text, created_at, updated_at)

## 覆診安排（院友外出覆診）
- **覆診安排主表** (覆診id uuid [PK], 院友id integer [FK→院友主表.院友id], 覆診日期 date, 出發時間 time, 覆診時間 time, 覆診地點 text, 覆診專科 text, 交通安排 text, 陪診人員 text, 備註 text, 狀態, 創建時間 timestamptz, 更新時間 timestamptz)

## 到診排程（VMO 到診醫生到院看診；VMO = Visiting Medical Officer，又稱「到診醫生」「外判醫生」）
- **到診排程主表** (排程id integer [PK], 到診日期 date)
- **看診院友細項** (細項id integer [PK], 排程id integer [FK→到診排程主表.排程id], 院友id integer [FK→院友主表.院友id], 症狀說明 text, 備註 text)
- **到診院友_看診原因** (細項id integer [FK→看診院友細項.細項id], 原因id integer [FK→看診原因選項.原因id]) — 關聯表，一次看診可有多個原因
- **看診原因選項** (原因id integer [PK], 原因名稱 varchar) — 例如：年度體檢、覆診、新症、配藥等
- **doctor_visit_schedule** (id uuid [PK], visit_date date, doctor_name text, specialty text, available_slots integer, booked_slots integer, notes text, created_at, updated_at)
- ⚠️ **VMO 完整查詢必須 JOIN 全部 4 張表**：到診排程主表 → 看診院友細項 → 到診院友_看診原因 → 看診原因選項。只看「症狀說明」和「備註」不夠，因為有些看診（如年度體檢、配藥）不一定有症狀描述，真正的看診目的記在「看診原因選項.原因名稱」。

## 外展醫療
- **hospital_outreach_records** (id uuid [PK], patient_id integer, medication_bag_date date, prescription_weeks integer, medication_end_date date, outreach_appointment_date date, medication_pickup_arrangement, outreach_medication_source, remarks text, medication_sources jsonb, appointment_completed boolean, created_at, updated_at)
- **hospital_outreach_record_history** (id uuid [PK], patient_id integer, original_record_id uuid, medication_bag_date date, prescription_weeks integer, medication_end_date date, outreach_appointment_date date, medication_pickup_arrangement, outreach_medication_source, remarks text, appointment_completed boolean, archived_at timestamptz, archived_by text)

## 住院／外出事件
- **hospital_episodes** (id uuid [PK], patient_id integer, episode_start_date date, episode_end_date date, status, primary_hospital text, primary_ward text, primary_bed_number text, discharge_type, discharge_destination text, date_of_death date, time_of_death time, total_days integer, remarks text, vacation_end_type, vacation_destination text, vacation_contact text, vacation_remarks text, created_at, updated_at)
- **episode_events** (id uuid [PK], episode_id uuid [FK→hospital_episodes.id], event_type, event_date date, event_time time, hospital_name text, hospital_ward text, hospital_bed_number text, event_order integer, remarks text, vacation_destination text, vacation_contact text, vacation_end_type, created_at, updated_at)

## 年度體檢
- **annual_health_checkups** (id uuid [PK], patient_id integer, last_doctor_signature_date date, next_due_date date, has_serious_illness boolean, serious_illness_details text, has_allergy boolean, allergy_details text, has_infectious_disease boolean, infectious_disease_details text, needs_followup_treatment boolean, followup_treatment_details text, has_swallowing_difficulty boolean, swallowing_difficulty_details text, has_special_diet boolean, special_diet_details text, mental_illness_record text, blood_pressure_systolic integer, blood_pressure_diastolic integer, pulse integer, body_weight numeric, vision_assessment text, hearing_assessment text, speech_assessment text, mental_state_assessment text, mobility_assessment text, continence_assessment text, adl_assessment text, recommendation text, cardiovascular_notes text, respiratory_notes text, central_nervous_notes text, musculo_skeletal_notes text, abdomen_urogenital_notes text, lymphatic_notes text, thyroid_notes text, skin_condition_notes text, foot_notes text, eye_ear_nose_throat_notes text, oral_dental_notes text, physical_exam_others text, with_visual_corrective_devices boolean, with_hearing_aids boolean, created_at, updated_at)

## 約束評估
- **patient_restraint_assessments** (id uuid [PK], patient_id integer, doctor_signature_date date, next_due_date date, risk_factors jsonb, alternatives jsonb, suggested_restraints jsonb, other_restraint_notes text, created_at, updated_at)

## 意外事故
- **incident_reports** (id uuid [PK], patient_id integer, incident_date date, incident_time time, incident_type text, other_incident_type text, location text, other_location text, patient_activity text, other_patient_activity text, physical_discomfort jsonb, unsafe_behavior jsonb, environmental_factors jsonb, treatment_date date, treatment_time time, vital_signs jsonb, consciousness_level text, limb_movement jsonb, injury_situation jsonb, patient_complaint text, immediate_treatment jsonb, medical_arrangement text, ambulance_call_time time, ambulance_arrival_time time, ambulance_departure_time time, hospital_destination text, family_notification_date date, family_notification_time time, family_name text, family_relationship text, other_family_relationship text, contact_phone text, notifying_staff_name text, notifying_staff_position text, hospital_treatment jsonb, hospital_admission jsonb, return_time time, submit_to_social_welfare boolean, submit_to_headquarters boolean, immediate_improvement_actions text, prevention_methods text, reporter_signature text, reporter_position text, report_date date, director_review_date date, submit_to_headquarters_flag boolean, submit_to_social_welfare_flag boolean, incident_details text, created_at, updated_at)

## 系統任務
- **daily_system_tasks** (id uuid [PK], task_name text, task_date date, completed_at timestamptz, status text, created_at, updated_at)

## 飲食指導
- **meal_guidance** (id uuid [PK], patient_id integer, meal_combination, special_diets jsonb, needs_thickener boolean, thickener_amount text, guidance_date date, guidance_source text, egg_quantity integer, remarks text, created_at, updated_at)

## 院友日誌
- **patient_logs** (id uuid [PK], patient_id integer, log_date date, log_type, content text, recorder text, created_at, updated_at)
- **patient_notes** (id uuid [PK], patient_id integer, note_date date, content text, is_completed boolean, completed_at timestamptz, created_by text, created_at, updated_at)

## 設施管理
- **stations** (id uuid [PK], name text, description text, created_at, updated_at)
- **beds** (id uuid [PK], station_id uuid [FK→stations.id], bed_number text, bed_name text, is_occupied boolean, qr_code_id text, qr_code_generated_at timestamptz, created_at, updated_at)

## AI 助護暫存
- **ai_assistant_pending_mutations** (id uuid [PK], user_id text, sql_statement text, sql_params jsonb, explanation text, tables_involved array, mutation_type text, created_at timestamptz, expires_at timestamptz, executed boolean)

## 常用查詢提示
- 查今天需要覆診的院友：SELECT r.*, p."中文姓名", p."床號" FROM "覆診安排主表" r JOIN "院友主表" p ON r."院友id" = p."院友id" WHERE r."覆診日期" = CURRENT_DATE
- 查院友聯絡人：SELECT * FROM patient_contacts WHERE "院友id" = ?（注意：欄位名是中文「院友id」而非 patient_id）
- 查健康監測記錄：SELECT * FROM "健康監測記錄" WHERE "院友id" = ? AND "監測類型" = '血壓' ORDER BY "記錄日期" DESC, "記錄時間" DESC LIMIT 1（血壓：數值=收縮壓，數值_副=舒張壓）
- 查診斷記錄：SELECT * FROM diagnosis_records WHERE patient_id = ?（欄位是 diagnosis_item、diagnosis_unit，不是 diagnosis、hospital）
- 查疫苗記錄：SELECT * FROM vaccination_records WHERE patient_id = ?（欄位是 vaccine_item、vaccination_unit）
- 查藥物資料庫：SELECT * FROM medication_drug_database（欄位是 drug_name，不是 drug_name_zh / drug_name_en）
- **查在住院友**：SELECT "中文姓名", "床號" FROM "院友主表" WHERE "在住狀態" = '在住'（注意：是中文欄位「在住狀態」，不是 residency_status！值是字串 '在住'，不是 boolean！）
- **查今天看 VMO / 到診的院友（完整版，含看診原因）**：SELECT d."到診日期", p."中文姓名", p."床號", c."症狀說明", c."備註", STRING_AGG(DISTINCT r."原因名稱", '、') AS "看診原因" FROM "到診排程主表" d JOIN "看診院友細項" c ON d."排程id" = c."排程id" JOIN "院友主表" p ON c."院友id" = p."院友id" LEFT JOIN "到診院友_看診原因" vr ON vr."細項id" = c."細項id" LEFT JOIN "看診原因選項" r ON r."原因id" = vr."原因id" WHERE d."到診日期" = CURRENT_DATE GROUP BY d."到診日期", p."中文姓名", p."床號", c."症狀說明", c."備註"
- **查某院友的全部 VMO 到診歷史**：SELECT d."到診日期", c."症狀說明", c."備註", STRING_AGG(DISTINCT r."原因名稱", '、') AS "看診原因" FROM "看診院友細項" c JOIN "到診排程主表" d ON d."排程id" = c."排程id" LEFT JOIN "到診院友_看診原因" vr ON vr."細項id" = c."細項id" LEFT JOIN "看診原因選項" r ON r."原因id" = vr."原因id" WHERE c."院友id" = ? GROUP BY d."到診日期", c."症狀說明", c."備註" ORDER BY d."到診日期" DESC

## 常見術語對照（用戶可能使用的行業簡稱 → 對應資料表）

### 醫生相關
- **VMO** / **到診** / **到診醫生** / **外判醫生** / **Visiting Medical Officer** → 查「到診排程主表」+「看診院友細項」+「到診院友_看診原因」
- **覆診** / **FU** / **F/U** / **follow-up** / **睇醫生** / **複診** / **回診** → 查「覆診安排主表」
- **外展** / **outreach** / **HA outreach** / **醫管局外展** → 查 hospital_outreach_records
- **年檢** / **年度體檢** / **annual checkup** / **annual medical** / **PE** / **physical exam** → 查 annual_health_checkups

### 生命表徵 / 健康量度
- **VS** / **vital signs** / **生命表徵** / **度VS** → 查「健康監測記錄」（多種監測類型同時存在時，用 健康監測_會話視圖 合併顯示）
- **BP** / **血壓** / **度血壓** / **量血壓** → 查「健康監測記錄」 WHERE "監測類型" = '血壓'；數值 = 收縮壓，數值_副 = 舒張壓
- **H'stix** / **Hstix** / **血糖** / **BSL** / **blood sugar** / **度糖** / **篤手指** → 查「健康監測記錄」 WHERE "監測類型" = '血糖值'，欄位「數值」
- **BT** / **body temp** / **體溫** / **度溫** / **探熱** → 查「健康監測記錄」 WHERE "監測類型" = '體溫'，欄位「數值」
- **SpO2** / **blood oxygen** / **血含氧量** / **血氧** / **氧飽和度** → 查「健康監測記錄」 WHERE "監測類型" = '血含氧量'，欄位「數值」
- **HR** / **heart rate** / **pulse** / **脈搏** / **心跳** → 查「健康監測記錄」 WHERE "監測類型" = '脈搏'，欄位「數值」
- **RR** / **respiratory rate** / **呼吸** / **呼吸頻率** → 查「健康監測記錄」 WHERE "監測類型" = '呼吸'，欄位「數值」
- **BW** / **body weight** / **體重** / **磅重** / **度磅** → 查「健康監測記錄」 WHERE "監測類型" = '體重'，欄位「數值」

### 藥物相關
- **Rx** / **藥物** / **處方** / **開藥** / **藥單** / **medication** / **prescription** → 查 new_medication_prescriptions
- **派藥** / **配藥** / **medication round** / **drug round** / **med round** → 查 medication_workflow_records
- **PRN** / **需要時服** / **as needed** → 查 new_medication_prescriptions WHERE is_prn = true
- **藥物資料** / **drug database** / **drug list** → 查 medication_drug_database
- **藥物敏感** / **drug allergy** / **allergy** → 查「院友主表」的「藥物敏感」
- **ADR** / **adverse drug reaction** / **不良藥物反應** → 查「院友主表」的「不良藥物反應」
- **碎藥** / **crush** / **crushing** → 查「院友主表」的 needs_medication_crushing

### 診斷 / 疫苗
- **Dx** / **診斷** / **diagnosis** / **病歷** → 查 diagnosis_records
- **疫苗** / **打針** / **vaccination** / **vaccine** / **vax** → 查 vaccination_records

### 日常護理記錄
- **換片** / **換尿片** / **diaper** / **尿布** / **pad change** → 查 diaper_change_records
- **巡房** / **巡視** / **patrol** / **round** / **night round** → 查 patrol_rounds
- **約束** / **綁帶** / **restraint** / **束縛** → 查 restraint_observation_records（觀察記錄）+ patient_restraint_assessments（約束評估）
- **轉身** / **翻身** / **reposition** / **position change** / **turning** → 查 position_change_records
- **個人衛生** / **洗澡** / **沖涼** / **刷牙** / **hygiene** / **personal care** / **ADL** → 查 hygiene_records
- **進出量** / **I/O** / **intake output** / **飲食量** / **飲水量** / **尿量** → 查 intake_output_records + intake_items + output_items
- **日誌** / **院友日誌** / **notes** / **progress notes** / **護理紀錄** → 查 patient_logs + patient_notes

### 傷口 / 意外
- **傷口** / **wound** / **壓瘡** / **pressure sore** / **壓傷** / **褥瘡** / **bedsore** → 查 wounds + wound_assessments
- **跌倒** / **意外** / **incident** / **accident** / **fall** / **IR** / **incident report** → 查 incident_reports

### 照顧計劃 / 評估
- **ICP** / **individual care plan** / **照顧計劃** / **個別照顧計劃** / **護理計劃** / **個案會議** / **care plan** → 查 care_plans + care_plan_problems
- **健康評估** / **health assessment** / **護理評估** → 查 health_assessments

### 院友基本資料
- **院友資料** / **基本資料** / **resident info** / **patient info** / **個人資料** → 查「院友主表」
- **聯絡人** / **家屬** / **家人** / **NOK** / **next of kin** / **contact** / **緊急聯絡** → 查 patient_contacts
- **住院** / **入院** / **出院** / **admission** / **discharge** / **轉院** / **放假** / **外出** → 查 hospital_episodes + episode_events + patient_admission_records
- **感染控制** / **infection control** → 查「院友主表」的「感染控制」
- **社會福利** / **福利** / **津貼** / **welfare** / **CSSA** / **綜援** → 查「院友主表」的「社會福利」

### 飲食
- **飲食** / **diet** / **餐單** / **meal** / **凝固粉** / **thickener** / **吞嚥** / **swallowing** → 查 meal_guidance
- **管餵** / **tube feeding** / **NG** / **PEG** / **鼻胃管** / **經皮胃造口** → 查 intake_output_records（tube_* 欄位）+ patient_health_tasks（tube_type, tube_size）

### 床位 / 設施
- **床位** / **bed** / **station** / **樓層** / **區域** → 查 stations + beds

## 重要：USER-DEFINED（enum）欄位的合法值
以下 enum 欄位在 WHERE 條件中必須使用對應的中文字串值，絕對不可用 boolean 或英文：
- **院友主表.在住狀態**：'在住'、'已退住'
- **院友主表.性別**：'男'、'女'
- **院友主表.護理等級**：'半護理'、'全護理'
- **院友主表.入住類型**：'私位'、'院舍卷'、'暫住'、'買位'
- **覆診安排主表.狀態**：'尚未安排'、'已安排'、'已完成'、'取消'、'改期'
- **health_task_type**（用於 patient_health_tasks.health_record_type 及 健康監測記錄.監測類型）：'血壓'、'脈搏'、'體溫'、'血含氧量'、'呼吸'、'血糖值'、'體重'、'導尿管更換'、'鼻胃飼管更換'、'傷口換症'、'氧氣喉管清洗/更換'、'約束物品同意書'、'年度體檢'、'藥物自存同意書'、'預設醫療指示'
`;
export const SYSTEM_TABLES = [
  'user_profiles',
  'user_sessions',
  'user_permissions',
  'permissions',
  'ai_assistant_pending_mutations',
  'emergency_operation_log',
  'ocr_prompt_templates',
  'ocr_recognition_logs',
  'user_ocr_prompts',
  'templates_metadata'
];
export const SENSITIVE_COLUMNS = {
  'user_profiles': [
    'password_hash'
  ]
};
