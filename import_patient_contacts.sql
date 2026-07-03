-- Auto-generated SQL INSERT statements for patient_contacts
-- Generated: 2026-07-03 18:35:28
-- Total contact records: 5

INSERT INTO patient_contacts 
(院友id, 聯絡人姓名, 聯絡電話, 地址, is_primary)
VALUES 
((SELECT 院友id FROM 院友主表 WHERE 床號 = 'A107-1'), '馬永德', '92778288', '', true);
INSERT INTO patient_contacts 
(院友id, 聯絡人姓名, 聯絡電話, 地址, is_primary)
VALUES 
((SELECT 院友id FROM 院友主表 WHERE 床號 = 'A112-3'), '葉慕容', '91524088', '', true);
INSERT INTO patient_contacts 
(院友id, 聯絡人姓名, 聯絡電話, 地址, is_primary)
VALUES 
((SELECT 院友id FROM 院友主表 WHERE 床號 = 'A118-2'), '陳志良', '68024556', '彩虹邨紅萼樓1238室', true);
INSERT INTO patient_contacts 
(院友id, 聯絡人姓名, 聯絡電話, 地址, is_primary)
VALUES 
((SELECT 院友id FROM 院友主表 WHERE 床號 = 'A261-4'), '溫國昌', '92195510', '', true);
INSERT INTO patient_contacts 
(院友id, 聯絡人姓名, 聯絡電話, 地址, is_primary)
VALUES 
((SELECT 院友id FROM 院友主表 WHERE 床號 = 'A265-3'), '李美卿', '96636593', '', true);
