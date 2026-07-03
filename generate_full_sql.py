#!/usr/bin/env python3
# -*- coding: utf-8 -*-

import csv
import re
from datetime import datetime

# 讀取 CSV 檔案
csv_file = '/workspaces/care-suite/院友個人基本資料.csv'
output_file = '/workspaces/care-suite/import_patient_data.sql'
contacts_output_file = '/workspaces/care-suite/import_patient_contacts.sql'

# 映射表
admission_type_map = {
    '買位月費': '買位',
    '私位月費': '私位',
    '院舍券-0級別': '院舍卷',
    '關愛基金': '院舍卷',
    '暫托': '暫住'
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
    # 移除所有空格
    cleaned = id_card.replace(' ', '')
    return cleaned if cleaned else None

def format_english_name(english_name):
    """格式化英文名字為 SURNAME, Given Name(s)"""
    if not english_name or english_name.strip() == '':
        return None
    # 移除多餘空格並保持原格式
    return english_name.strip()

def format_date(date_str):
    """格式化日期為 YYYY-MM-DD 或 None"""
    if not date_str or date_str.strip() == '':
        return None
    try:
        # 嘗試多種日期格式
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
sql_statements = []

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
                # row[1] = 服務編號 (不需要)
                chinese_name = row[2].strip() if len(row) > 2 else ''
                english_name = format_english_name(row[3].strip() if len(row) > 3 else '')
                # row[4] = 證件類型 (跳過)
                id_card = clean_id_card(row[5].strip() if len(row) > 5 else '')
                admission_date = format_date(row[6].strip() if len(row) > 6 else '')
                # row[7] = 入住天數 (跳過)
                admission_type_raw = row[8].strip() if len(row) > 8 else ''
                admission_type = admission_type_map.get(admission_type_raw, admission_type_raw)
                care_level_raw = row[9].strip() if len(row) > 9 else ''
                care_level = care_level_map.get(care_level_raw, care_level_raw)
                gender = row[10].strip() if len(row) > 10 else ''
                # row[11] = 年齡 (跳過，由出生日期計算)
                # row[12] = 出生類型 (跳過)
                dob = format_date(row[13].strip() if len(row) > 13 else '')
                # row[14-16] = 出生年份/月份/日 (已在出生日期中)
                phone = row[17].strip() if len(row) > 17 else ''
                # row[18] = 其它號碼 (跳過)
                address = row[19].strip() if len(row) > 19 else ''
                # CSV 中沒有緊急聯繫人信息
                next_kin_name = ''
                next_kin_phone = ''
                next_kin_relation = ''
                
                # 構建 INSERT 語句
                insert_sql = f"""INSERT INTO "院友主表" 
(床號, 院友中文名, 院友英文名, 性別, 出生日期, 身份證號碼, 入住日期, 入住類型, 護理等級, 電話, 地址, 緊急聯繫人姓名, 緊急聯繫人電話, 緊急聯繫人關係)
VALUES 
({escape_sql_string(bed_with_prefix)}, {escape_sql_string(chinese_name)}, {escape_sql_string(english_name)}, {escape_sql_string(gender)}, {escape_sql_string(dob)}, {escape_sql_string(id_card)}, {escape_sql_string(admission_date)}, {escape_sql_string(admission_type)}, {escape_sql_string(care_level)}, {escape_sql_string(phone)}, {escape_sql_string(address)}, {escape_sql_string(next_kin_name)}, {escape_sql_string(next_kin_phone)}, {escape_sql_string(next_kin_relation)});"""
                
                sql_statements.append(insert_sql)
            
            except Exception as e:
                print(f"Error processing row {row_idx}: {e}")
                rows_skipped += 1
                continue

except Exception as e:
    print(f"Error reading CSV: {e}")
    exit(1)

# 寫入 SQL 檔案
try:
    with open(output_file, 'w', encoding='utf-8') as f:
        f.write("-- Auto-generated SQL INSERT statements\n")
        f.write(f"-- Generated: {datetime.now().strftime('%Y-%m-%d %H:%M:%S')}\n")
        f.write(f"-- Total rows processed: {rows_processed}\n")
        f.write(f"-- Total rows skipped (bed 202-237): {rows_skipped}\n\n")
        f.write('\n'.join(sql_statements))
        f.write('\n')
    
    print(f"✅ SQL file generated: {output_file}")
    print(f"   - Rows processed: {rows_processed}")
    print(f"   - Rows skipped (bed 202-237): {rows_skipped}")
    print(f"   - Total SQL statements: {len(sql_statements)}")

except Exception as e:
    print(f"Error writing SQL file: {e}")
    exit(1)
