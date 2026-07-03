#!/usr/bin/env python3
# -*- coding: utf-8 -*-
"""
院友個人基本資料清洗腳本
將 CSV 數據清洗並轉換為 SQL INSERT 語句
"""

import csv
import re

# 清洗規則函數
def clean_admission_type(value):
    """入住類型映射"""
    mapping = {
        '買位月費': '買位',
        '私位月費': '私位',
        '院舍券 - 0級別': '院舍卷',
        '關愛基金': '院舍卷',  # 假設關愛基金也映射到院舍卷
        '暫托': '暫住'  # 暫托映射到暫住
    }
    return mapping.get((value or '').strip(), None)

def clean_nursing_level(value):
    """護理等級映射"""
    mapping = {
        '高度照顧': '全護理',
        '中度照顧': '半護理',
        '普通照顧': '自理'
    }
    return mapping.get((value or '').strip(), None)

def clean_id_card(value):
    """身份證號碼：去掉空格"""
    if not value or (value.strip() == ''):
        return None
    return value.strip().replace(' (', '(')

def clean_bed_number(value):
    """床號：添加字母前綴 A"""
    if not value or (value.strip() == ''):
        return None
    return 'A' + value.strip()

def clean_english_name(value):
    """英文姓名格式化：SURNAME, Given Name(s)"""
    if not value or (value.strip() == ''):
        return None
    
    parts = value.strip().split()
    if len(parts) == 0:
        return None
    
    surname = parts[0].upper()
    given_names = ' '.join([p[0].upper() + p[1:].lower() if len(p) > 0 else '' for p in parts[1:]])
    
    if given_names:
        return f"{surname}, {given_names}"
    else:
        return surname

def clean_date(value):
    """日期格式：保留 YYYY-MM-DD"""
    if not value or (value.strip() == ''):
        return None
    value = value.strip()
    # 檢查是否為 YYYY-MM-DD 格式
    if re.match(r'^\d{4}-\d{2}-\d{2}$', value):
        return value
    return None

def null_or_value(value):
    """空字符串轉 None"""
    return value.strip() if (value and value.strip()) else None

def escape_sql_string(value):
    """SQL 字符串轉義"""
    if value is None:
        return 'NULL'
    # 替換單引號為兩個單引號（SQL 轉義）
    escaped = value.replace("'", "''")
    return f"'{escaped}'"

# 讀取 CSV
cleaned_data = []
with open('院友個人基本資料.csv', 'r', encoding='utf-8-sig') as f:
    lines = f.readlines()

# 跳過前 4 行，從第 5 行開始讀
reader = csv.DictReader(lines[4:])

for row_idx, row in enumerate(reader, start=6):
    bed_number = clean_bed_number(row.get('床位號'))
    chinese_name = null_or_value(row.get('中文姓名'))
    
    # 只有當有效數據時才加入
    if bed_number and chinese_name:
        cleaned_row = {
            'row_num': row_idx,
            '床號': bed_number,
            '中文姓名': chinese_name,
            '英文姓名': clean_english_name(row.get('英文姓名')),
            '性別': null_or_value(row.get('性別')),
            '身份證號碼': clean_id_card(row.get('證件編號')),
            '出生日期': clean_date(row.get('出生日期')),
            '入住日期': clean_date(row.get('入住日期')),
            '護理等級': clean_nursing_level(row.get('護理等級')),
            '入住類型': clean_admission_type(row.get('入住類型')),
        }
        cleaned_data.append(cleaned_row)

print(f"✅ 已清洗 {len(cleaned_data)} 筆記錄")
print("\n=== 前 10 筆清洗後的數據 ===\n")

for idx, row in enumerate(cleaned_data[:10], 1):
    print(f"記錄 {idx}:")
    print(f"  床號: {row['床號']}")
    print(f"  中文姓名: {row['中文姓名']}")
    print(f"  英文姓名: {row['英文姓名']}")
    print(f"  性別: {row['性別']}")
    print(f"  身份證: {row['身份證號碼']}")
    print(f"  出生日期: {row['出生日期']}")
    print(f"  入住日期: {row['入住日期']}")
    print(f"  護理等級: {row['護理等級']}")
    print(f"  入住類型: {row['入住類型']}")
    print()

# 生成 SQL INSERT 語句
sql_statements = []

for row in cleaned_data:
    # 組建 INSERT 語句
    values = [
        escape_sql_string(row['床號']),
        escape_sql_string(row['中文姓名']),
        escape_sql_string(row['英文姓名']),
        escape_sql_string(row['性別']),
        escape_sql_string(row['身份證號碼']),
        escape_sql_string(row['出生日期']),
        escape_sql_string(row['入住日期']),
        escape_sql_string(row['護理等級']),
        escape_sql_string(row['入住類型']),
    ]
    
    sql = f"""INSERT INTO "院友主表" ("床號", "中文姓名", "英文姓名", "性別", "身份證號碼", "出生日期", "入住日期", "護理等級", "入住類型", "在住狀態") 
VALUES ({values[0]}, {values[1]}, {values[2]}, {values[3]}, {values[4]}, {values[5]}, {values[6]}, {values[7]}, {values[8]}, '在住');"""
    
    sql_statements.append(sql)

# 保存 SQL 到檔案
with open('import_patient_data.sql', 'w', encoding='utf-8') as f:
    f.write("-- 院友個人基本資料匯入 SQL 語句\n")
    f.write("-- 生成時間: 2026-07-03\n")
    f.write("-- 總共記錄數: {}\n\n".format(len(cleaned_data)))
    f.write("BEGIN TRANSACTION;\n\n")
    
    for sql in sql_statements:
        f.write(sql + "\n")
    
    f.write("\nCOMMIT;\n")

print(f"\n✅ 已生成 {len(sql_statements)} 條 SQL INSERT 語句")
print("📁 SQL 檔案已保存到 import_patient_data.sql")

# 輸出前 3 條 SQL 語句作為示例
print("\n=== SQL 示例（前 3 條）===\n")
for sql in sql_statements[:3]:
    print(sql)
    print()
