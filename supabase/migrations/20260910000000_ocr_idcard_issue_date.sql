-- 預設 OCR prompt 模板追加身份證簽發日期提取指引（不影响原有處方標籤規則）
UPDATE ocr_prompt_templates
SET prompt_content = prompt_content || E'\n\n如果圖片是香港身份證（HKID），請改為提取以下欄位（以JSON返回，無的欄位省略）：\n{\n  "中文姓名": "陳大文",\n  "英文姓名": "CHAN, Tai Man",\n  "身份證號碼": "A123456(7)",\n  "出生日期": "1950-01-01",\n  "身份證簽發日期": "2015-05-12",\n  "性別": "男"\n}\n注意：身份證上簽發日期印作 DD-MM-YYYY（例如 12-05-2015），必須轉換為 YYYY-MM-DD（2015-05-12）。',
    updated_at = now()
WHERE is_default = true;
