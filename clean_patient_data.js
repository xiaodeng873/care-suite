const fs = require('fs');
const csv = require('csv-parse/sync');

// 讀取 CSV 檔案
const csvContent = fs.readFileSync('./院友個人基本資料.csv', 'utf-8');
const lines = csvContent.split('\n');

// 跳過前 4 行（標題），從第 5 行開始
const dataLines = lines.slice(4).join('\n');
const records = csv.parse(dataLines, {
  columns: true,
  skip_empty_lines: true,
  quote_char: '"',
  escape_char: '"'
});

// 清洗規則函數
function cleanAdmissionType(value) {
  const mapping = {
    '買位月費': '買位',
    '私位月費': '私位',
    '院舍券 - 0級別': '院舍卷'
  };
  return mapping[value] || null;
}

function cleanNursingLevel(value) {
  const mapping = {
    '高度照顧': '全護理',
    '中度照顧': '半護理',
    '普通照顧': '自理'
  };
  return mapping[value] || null;
}

function cleanIdCard(value) {
  if (!value || value.trim() === '') return null;
  return value.trim().replace(' (', '(');
}

function cleanBedNumber(value) {
  if (!value || value.trim() === '') return null;
  return 'A' + value.trim();
}

function cleanEnglishName(value) {
  if (!value || value.trim() === '') return null;
  
  const parts = value.trim().split(/\s+/);
  if (parts.length === 0) return null;
  
  const surname = parts[0].toUpperCase();
  const givenNames = parts.slice(1)
    .map(word => word.charAt(0).toUpperCase() + word.slice(1).toLowerCase())
    .join(' ');
  
  return givenNames ? `${surname}, ${givenNames}` : surname;
}

function cleanDate(value) {
  if (!value || value.trim() === '') return null;
  // 假設格式是 YYYY-MM-DD
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value;
  }
  return null;
}

function nullOrValue(value) {
  return (value && value.trim() !== '') ? value.trim() : null;
}

// 清洗數據
const cleanedData = [];
records.forEach((row, idx) => {
  if (!row['床位號'] || !row['中文姓名']) {
    return; // 跳過缺少必要欄位的記錄
  }

  const cleaned = {
    rowNum: idx + 6, // CSV 行號（從第 6 行開始）
    bed_number: cleanBedNumber(row['床位號']),
    chinese_name: nullOrValue(row['中文姓名']),
    english_name: cleanEnglishName(row['英文姓名']),
    gender: nullOrValue(row['性別']),
    id_card: cleanIdCard(row['證件編號']),
    birth_date: cleanDate(row['出生日期']),
    admission_date: cleanDate(row['入住日期']),
    nursing_level: cleanNursingLevel(row['護理等級']),
    admission_type: cleanAdmissionType(row['入住類型']),
    original: row
  };

  if (cleaned.bed_number && cleaned.chinese_name) {
    cleanedData.push(cleaned);
  }
});

// 輸出清洗後的數據到 JSON 檔案
fs.writeFileSync('./cleaned_patient_data.json', JSON.stringify(cleanedData, null, 2), 'utf-8');

console.log(`✅ 已清洗 ${cleanedData.length} 筆記錄`);
console.log(`詳細數據已保存到 cleaned_patient_data.json`);

// 輸出前 10 筆用於檢查
console.log('\n=== 前 10 筆清洗後的數據 ===\n');
cleanedData.slice(0, 10).forEach((row, idx) => {
  console.log(`記錄 ${idx + 1} (CSV 行 ${row.rowNum}):`);
  console.log(`  床號: ${row.original['床位號']} → ${row.bed_number}`);
  console.log(`  中文姓名: ${row.chinese_name}`);
  console.log(`  英文姓名: ${row.original['英文姓名']} → ${row.english_name}`);
  console.log(`  性別: ${row.gender}`);
  console.log(`  身份證: ${row.original['證件編號']} → ${row.id_card}`);
  console.log(`  出生日期: ${row.birth_date}`);
  console.log(`  入住日期: ${row.admission_date}`);
  console.log(`  護理等級: ${row.original['護理等級']} → ${row.nursing_level}`);
  console.log(`  入住類型: ${row.original['入住類型']} → ${row.admission_type}`);
  console.log();
});
