// 匯入 C 站肺炎鏈球菌疫苗記錄（來自紙本表格兩頁照片）
// 疫苗：15/13價肺炎鏈球菌疫苗 (PCV15/13)、23價肺炎鏈球菌疫苗 (23vPPV)
const KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';
const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}`, 'Content-Type': 'application/json' };

const PCV = '15/13價肺炎鏈球菌疫苗';
const PPV = '23價肺炎鏈球菌疫苗';

// [姓名, patient_id, PCV日期, 23vPPV日期] — null 表示表格中該格無日期
const DATA = [
  ['許渠蘭', 19, '2024-12-03', '2009-12-05'],
  ['周美雲', 18, '2024-12-03', '2025-12-05'],
  ['梁細妹', 20, '2018-04-25', '2019-08-30'],
  ['鄧凝意', 11, '2018-04-20', '2009-11-19'],
  ['伍妙玲', 158, '2024-12-03', '2011-11-09'],
  ['朱茜燕', 726, '2022-10-20', '2023-11-02'],
  ['陳佩卿', 9, '2024-12-03', '2025-12-05'],
  ['徐鳳兒', 2, '2019-12-23', '2011-01-03'],
  ['梁梅桂', 23, '2024-12-03', '2025-12-05'],
  ['雷燕優', 160, '2019-01-17', '2009-11-18'],
  ['李瑞紅', 44, '2024-12-03', '2013-01-25'],
  ['郭順賢', 4, '2018-07-17', '2009-11-16'],
  ['吳麗妹', 39, '2024-01-23', '2025-12-05'],
  ['蕭陽燦', 725, null, null],
  ['麥錦蓮', 722, null, null],
  ['馮亞根', 40, '2025-12-05', null],
  ['詹金花', 41, '2018-05-07', '2009-10-24'],
  ['馬偉亮', 42, '2025-12-05', null],
  ['黃碧霞', 30, '2024-12-03', '2025-12-05'],
  ['呂鋒', 723, null, null],
  ['黃祖堆', 163, '2025-12-04', '2009-11-04'],
  ['鄧慧珠', 45, '2024-01-23', '2025-12-05'],
  ['周秀貞', 14, '2024-01-23', '2009-12-18'],
  ['冼好', 47, '2024-12-03', '2025-12-05'],
  ['鄭華', 151, null, null],
  ['戴鳳蓮', 167, null, null],
  ['黃桂琴', 148, null, '2010-02-22'],
  ['毛小翠', 36, '2024-12-03', '2025-12-17'],
  ['梁寶燕', 49, '2018-07-10', '2009-11-09'],
  ['何志廉', 168, null, null],      // DB 作「何志亷」，床號 C221-1 與表格 221-1 相符
  ['尹照東', 156, null, null],
  ['蔡日忠', 69, null, null],       // DB 作「蔡仁忠」，床號 C221-3 與表格 221-3 相符
  ['周潤英', 129, null, null],      // DB 作「周攘櫻」，床號 C221-4 與表格 221-4 相符
  ['陳周文', 17, '2025-12-05', '2024-10-28'],
  ['何甜崧', 139, '2018-12-04', '2020-10-30'],
  ['林允一', 50, '2024-01-23', '2025-12-05'],
  ['劉永堪', 122, null, null],
  ['黃國揆', 72, '2018-04-09', '2024-01-08'],
  ['何玉卿', 92, '2019-06-11', '2009-10-30'],
  ['林宗世', 6, null, null],
  ['吳榮廣', 51, '2021-12-07', '2024-12-03'],
  ['黃漢良', 52, '2017-11-06', '2024-01-23'],
  ['張振琰', 53, '2024-01-23', '2025-12-05'],
  ['鍾焰貞', 55, '2024-01-23', null], // DB 作「鍾熖貞」，床號 C229-1 與表格 229-1 相符
  ['朱秋喜', 56, '2024-01-23', '2013-11-12'],
  ['林存諒', 57, '2024-12-03', '2025-12-05'],
  ['李偉鋒', 142, null, '2009-10-20'],
  ['布志成', 161, '2019-03-16', null],
  ['杜維氣', 38, '2018-05-20', '2024-12-03'],
  ['梁信宜', 31, '2025-12-05', null],
  ['陳娥笑', 27, '2018-05-24', '2025-12-05'],
  ['沈勇', 33, null, null],
  ['周紹安', 60, '2018-03-23', '2025-01-15'],
  ['黃榮偉', 26, null, '2019-12-14'],
  ['左文江', 32, '2017-11-29', '2013-11-22'],
  ['盧渠煥', 7, '2019-12-18', '2009-12-28'],
  ['陳振常', 61, '2024-12-03', '2025-12-05'],
  ['冼桂森', 62, '2024-12-03', '2025-12-05'],
  ['黃碧嫦', 63, '2024-12-03', '2010-01-19'],
  ['麥如琴', 64, '2024-01-23', '2025-12-05'],
  ['許秀琼', 21, '2017-11-29', '2009-11-24'], // 表格床號 236-3，DB 現床號 C222-1，以姓名為準
  ['盧葉慧卿', 37, '2024-12-03', '2009-10-19'],
  ['黃逸綺', 102, '2025-12-05', null],
  ['丘麗明', 66, '2017-11-29', '2009-11-19'],
  ['莫南', 67, '2017-11-29', '2009-12-05'],
  ['沈葵', 3, '2020-05-02', '2009-11-13'],
];

const patientIds = [...new Set(DATA.map(d => d[1]))];
const existing = await fetch(
  `${BASE}/vaccination_records?facility_id=eq.1&patient_id=in.(${patientIds.join(',')})&select=patient_id,vaccination_date,vaccine_item&limit=5000`,
  { headers: H }
).then(r => r.json());

const rows = [];
const skipped = [];
for (const [name, pid, pcv, ppv] of DATA) {
  for (const [item, date] of [[PCV, pcv], [PPV, ppv]]) {
    if (!date) continue;
    const dup = existing.some(e =>
      e.patient_id === pid && e.vaccination_date === date &&
      e.vaccine_item.includes('肺炎鏈球菌'));
    if (dup) { skipped.push(`${name} ${item} ${date}（已存在）`); continue; }
    rows.push({
      patient_id: pid,
      vaccination_date: date,
      vaccine_item: item,
      vaccination_unit: '',
      remarks: '',
      facility_id: 1,
    });
  }
}

console.log(`準備匯入 ${rows.length} 筆，已有跳過 ${skipped.length} 筆`);
if (skipped.length) skipped.forEach(s => console.log('  跳過:', s));
if (!rows.length) { console.log('無需匯入'); process.exit(0); }

// PostgREST 批次 insert：回傳 Representation
const res = await fetch(`${BASE}/vaccination_records`, {
  method: 'POST',
  headers: { ...H, Prefer: 'return=representation' },
  body: JSON.stringify(rows),
});
const body = await res.json();
if (!res.ok) {
  console.error('匯入失敗:', res.status, JSON.stringify(body).slice(0, 500));
  process.exit(1);
}
console.log(`成功匯入 ${body.length} 筆`);
