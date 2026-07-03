#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import csv
import re
from datetime import datetime

# 讀取 CSV 檔案
csv_file = '/workspaces/care-suite/院友個人基本資料.csv'
patients_output = '/workspaces/care-suite/import_patient_data.sql'
contacts_output = '/workspaces/care-suite/import_patient_contacts.sql'

# 映射表
admission_type_map = {
    '買位月費': '買位',
    '私位月費': '私位',
    '院舍券 - 0級別': '院舍卷',
    '院舍券 - 1級院舍月費': '院舍卷',
    '院舍券 - 7級別': '院舍卷',
    '暫托': '暫住'
    # '關愛基金' deliberately omitted - will map to NULL
}

care_level_map = {
    '高度照顧': '全護理',
    '中度照顧': '半護理',
    '普通照顧': '自理'
}

def extract_bed_prefix(bed_num):
    """提取床號的首三位數字"""
    match = re.match(r'(\d+)-(\d+)', bed_num)
    if match:
        return int(match.group(1))
    return None

def clean_id_card(id_card):
    """清理身份證號碼：移除空格，保留括號內容"""
    if not id_card:
        return None
    cleaned = id_card.replace(' ', '')
    return cleaned if cleaned else None

def format_english_name(english_name):
    """Format English name to SURNAME, Given Name(s) format and return (full_name, surname, given_names)"""
    if not english_name or english_name.strip() == '':
        return None, None, None
    
    # Split by spaces
    parts = english_name.strip().split()
    if not parts:
        return None, None, None
    
    # First word (surname) -> UPPERCASE
    surname = parts[0].upper()
    
    # Remaining words -> Title Case (first letter uppercase, rest lowercase)
    given_names = ' '.join([word[0].upper() + word[1:].lower() if word else word for word in parts[1:]])
    
    # Full name in format "SURNAME, Given Name(s)"
    if given_names:
        full_name = f"{surname}, {given_names}"
    else:
        full_name = surname
    
    return full_name, surname, given_names

def format_chinese_name(chinese_name):
    """Format Chinese name to separate surname and given_names. Return (surname, given_names)"""
    if not chinese_name or chinese_name.strip() == '':
        return None, None
    
    name = chinese_name.strip()
    if len(name) < 1:
        return None, None
    
    # First character is surname, rest is given name(s)
    surname = name[0]
    given_names = name[1:] if len(name) > 1 else None
    
    return surname, given_names

def format_date(date_str):
    """格式化日期為 YYYY-MM-DD 或 None"""
    if not date_str or date_str.strip() == '':
        return None
    try:
        for fmt in ['%Y-%m-%d', '%Y/%m/%d', '%d/%m/%Y', '%Y%m%d']:
            try:
                parsed = datetime.strptime(date_str.strip(), fmt)
                return parsed.strftime('%Y-%m-%d')
            except ValueError:
                continue
        return None
    except:
        return None

def escape_sql_string(s):
    """轉義 SQL 字符串"""
    if s is None:
        return 'NULL'
    if isinstance(s, (int, float)):
        return str(s)
    s_str = str(s).replace("'", "''")
    return f"'{s_str}'"

# 讀取並處理 CSV
rows_processed = 0
rows_skipped = 0
patient_inserts = []
contact_inserts = []

try:
    with open(csv_file, 'r', encoding='utf-8-sig') as f:
        reader = csv.reader(f)
        # 跳過前 5 行（標題和空行）
        for _ in range(5):
            next(reader)
        
        for row_idx, row in enumerate(reader, start=6):
            if not row or all(cell.strip() == '' for cell in row):
                continue
            
            # 提取床號並判斷是否需要跳過
            bed_num = row[0].strip() if len(row) > 0 else ''
            bed_prefix = extract_bed_prefix(bed_num)
            
            # 過濾條件：排除床號首三位在 202-237 範圍內
            if bed_prefix and 202 <= bed_prefix <= 237:
                rows_skipped += 1
                continue
            
            rows_processed += 1
            
            # 提取所有欄位（根據 CSV 實際結構）
            try:
                bed_with_prefix = f"A{bed_num}"
                # row[0] = 床位號
                # row[1] = 服務編號
                service_no = row[1].strip() if len(row) > 1 else ''
                # row[2] = 中文姓名
                chinese_name = row[2].strip() if len(row) > 2 else ''
                chinese_surname, chinese_given_names = format_chinese_name(chinese_name)
                # row[3] = 英文姓名
                english_name_input = row[3].strip() if len(row) > 3 else ''
                english_name, english_surname, english_given_names = format_english_name(english_name_input)
                # row[4] = 證件類型 (跳過)
                # row[5] = 證件編號
                id_card = clean_id_card(row[5].strip() if len(row) > 5 else '')
                # row[6] = 入住日期
                admission_date = format_date(row[6].strip() if len(row) > 6 else '')
                # row[7] = 入住天數 (跳過)
                # row[8] = 入住類型
                admission_type_raw = row[8].strip() if len(row) > 8 else ''
                admission_type = admission_type_map.get(admission_type_raw)  # Returns None if not found
                # row[9] = 護理等級
                care_level_raw = row[9].strip() if len(row) > 9 else ''
                care_level = care_level_map.get(care_level_raw)  # Returns None if not found
                # row[10] = 性別
                gender = row[10].strip() if len(row) > 10 else ''
                # row[11] = 年齡 (跳過)
                # row[12] = 出生類型 (跳過)
                # row[13] = 出生日期
                dob = format_date(row[13].strip() if len(row) > 13 else '')
                # row[14-16] = 出生年份/月份/日 (跳過)
                # row[17] = 手機號碼
                phone = row[17].strip() if len(row) > 17 else ''
                # row[18] = 其它號碼 (跳過)
                # row[19] = 聯絡地址
                address = row[19].strip() if len(row) > 19 else ''
                
                # 構建 院友主表 INSERT 語句
                patient_insert = f"""INSERT INTO 院友主表 
(床號, 中文姓名, 中文姓氏, 中文名字, 英文姓名, 英文姓氏, 英文名字, 性別, 出生日期, 身份證號碼, 入住日期, 入住類型, 護理等級)
VALUES 
({escape_sql_string(bed_with_prefix)}, {escape_sql_string(chinese_name)}, {escape_sql_string(chinese_surname)}, {escape_sql_string(chinese_given_names)}, {escape_sql_string(english_name)}, {escape_sql_string(english_surname)}, {escape_sql_string(english_given_names)}, {escape_sql_string(gender)}, {escape_sql_string(dob)}, {escape_sql_string(id_card)}, {escape_sql_string(admission_date)}, {escape_sql_string(admission_type)}, {escape_sql_string(care_level)});"""
                
                patient_inserts.append(patient_insert)
                
                # 如果有聯絡信息，為 patient_contacts 表構建 INSERT
                if phone or address:
                    contact_insert = f"""INSERT INTO patient_contacts 
(院友id, 聯絡人姓名, 聯絡電話, 地址, is_primary)
VALUES 
((SELECT 院友id FROM 院友主表 WHERE 床號 = {escape_sql_string(bed_with_prefix)}), {escape_sql_string(chinese_name)}, {escape_sql_string(phone)}, {escape_sql_string(address)}, true);"""
                    contact_inserts.append(contact_insert)
            
            except Exception as e:
                print(f"Error processing row {row_idx}: {e}")
                rows_skipped += 1
                continue

except Exception as e:
    print(f"Error reading CSV: {e}")
    exit(1)

# 寫入患者資料 SQL 檔案
try:
    with open(patients_output, 'w', encoding='utf-8') as f:
        f.write("-- Auto-generated SQL INSERT statements for 院友主表\n")
        f.write(f"-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"-- Total rows processed: {rows_processed}\n")
        f.write(f"-- Total rows skipped (bed 202-237): {rows_skipped}\n\n")
        f.write('\n'.join(patient_inserts))
        f.write('\n')
    
    print(f"✅ Patient data SQL file generated: {patients_output}")
    print(f"   - Rows processed: {rows_processed}")
    print(f"   - Total INSERT statements: {len(patient_inserts)}")

except Exception as e:
    print(f"Error writing patient SQL file: {e}")
    exit(1)

# 寫入聯絡人資料 SQL 檔案（如果有）
if contact_inserts:
    try:
        with open(contacts_output, 'w', encoding='utf-8') as f:
            f.write("-- Auto-generated SQL INSERT statements for patient_contacts\n")
            f.write(f"-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
            f.write(f"-- Total contact records: {len(contact_inserts)}\n\n")
            f.write('\n'.join(contact_inserts))
            f.write('\n')
        
        print(f"✅ Contact data SQL file generated: {contacts_output}")
        print(f"   - Total INSERT statements: {len(contact_inserts)}")

    except Exception as e:
        print(f"Error writing contact SQL file: {e}")
        exit(1)
