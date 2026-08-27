import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('請設定 VITE_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 中秋節翌日
const PH_HOLIDAY_ID = '739af94f-c18b-4a63-a085-ebb5adccc7b7';
const SH_HOLIDAY_ID = 'ae44648b-3d78-46c8-8609-2df3fc29fb97';

// 員工 ID 對照（已處理字形差異）
const USERS = {
  '陳睿智': '66f321d3-002d-466c-8683-e5f3920f8e06',
  '霍穎豪': 'c7dafdbd-7933-4bc6-b1d6-71fd8b460a6a',
  '黃麗安': '0528a801-501f-436f-ba65-7eaa588a2326',
  '梁健兒': 'fbe14a4a-df3e-4e71-acc1-722ab59d05af',
  '郭惠蓮': '0dd66c20-4105-4891-8fb6-2ccc626a77c3',
  '何淑慧': '7cbe450f-be1e-4890-ad07-34a992136cb0',
  '關錦霞': '0dbe677c-f790-4519-bd9d-ded2744dfa22',
  '王兆基': '155704c5-d79a-4ce9-8e03-0b6aefc221c3',
  '李淑怡': '2b126d32-30a9-4af5-9674-87a4ea5c3b9c',
  '劉富卿': '09263a81-d30b-4162-b96d-449e9ad0b6f3',
  '蕭菊': '331dd9e4-973b-4116-b335-2927623cc9c7',
  '李栢湖': '31785aab-c8c7-4f59-83d9-8b4fee8a022d',
  '劉艷芬': '1d8598ba-7b36-4142-b166-fbc9e4f8c903',
  '梁嘉榮': '21561e60-7e88-4f34-88a1-f41a9c23be9b',
  '鄧業煒': '9995bc5e-c444-466c-96b0-2ee656318bcb',
  '譚漢斌': '618182dd-ea01-4b7e-924b-33b5c95e2bf1',
  '蔡幸鑫': '5c486085-2063-4e8b-ad0b-14ece643946d',
  '何梓健': '029d6a4c-1553-4d1a-b097-19b302224a33',
  '羅詠僖': 'e78a3c13-18d0-4b46-8f9a-246b14a5e183',
  '王梓瑜': 'd641cc48-b4f7-47b7-878a-5612c7ecd973',
  '莫家熾': 'bf3677e4-3fd6-49ee-8a4f-cb0171ef0185',
};

// 從圖中整理的資料（A/B/C/D 四站）
// 格式：{ 姓名: { 假別: [日期,...] } }
const DATA = {
  '陳睿智': { PH: [1], PRD: [6, 7], DO: [16, 21, 22, 26] },
  '霍穎豪': { PH: [2], PRD: [10, 11], DO: [12, 13, 23, 24], AL: [14, 15] },
  '黃麗安': { PRD: [5, 12, 19], DO: [6, 13, 20, 27], SH: [26] },
  '梁健兒': { DO: [4, 17, 18, 25], SH: [3] },
  '郭惠蓮': { DO: [5, 8], AL: [9, 10, 11, 12, 13, 14, 15] },
  '何淑慧': { PH: [3], PRD: [6, 10], DO: [13, 17, 20, 24], SLN: [27] },
  '關錦霞': { PH: [2], PRD: [5, 12], DO: [18, 19, 23, 27] },
  '王兆基': { PH: [4], SL: [8, 9, 10, 11, 12, 13], PRD: [14, 15], DO: [21, 24, 27, 28] },
  '李淑怡': { DO: [11, 15, 20, 30], SH: [4] },
  '劉富卿': { DO: [7, 16, 20, 24], SH: [1] },
  '蕭菊': { DO: [14, 19, 20, 26], SH: [7] },
  '李栢湖': { PH: [1], PRD: [6, 7], DO: [16, 21, 26, 30] },
  '劉艷芬': { PH: [5], PRD: [8, 13], DO: [19, 22, 27, 28] },
  '梁嘉榮': { PH: [3], PRD: [9, 16], DO: [17, 24, 25, 30] },
  '鄧業煒': { PH: [4], PRD: [7, 11], DO: [17, 18, 23, 29] },
  '譚漢斌': { DO: [8, 14, 22, 26], SH: [3] },
  '蔡幸鑫': { DO: [10, 17, 24, 28], SH: [2] },
  '何梓健': { PH: [1], PRD: [2, 8], DO: [15, 20, 21, 26] },
  '羅詠僖': { PH: [5], PRD: [6, 14], DO: [18, 19, 27] },
  '王梓瑜': { PH: [3], PRD: [4, 11], DO: [12, 19, 24, 28] },
  '莫家熾': { DO: [10, 16, 23, 30], SH: [9] },
};

function buildRecords() {
  const records = [];
  for (const [name, types] of Object.entries(DATA)) {
    const userId = USERS[name];
    if (!userId) {
      console.warn(`⚠️ 找不到員工 ID: ${name}`);
      continue;
    }
    for (const [leaveType, days] of Object.entries(types)) {
      for (const day of days) {
        const date = `2026-09-${String(day).padStart(2, '0')}`;
        const record = {
          user_id: userId,
          leave_date: date,
          leave_type: leaveType,
          record_type: 'leave',
          urgency: 'mandatory',
          is_auto: false,
          remark: null,
        };
        if (leaveType === 'PH') {
          record.reference_public_holiday_id = PH_HOLIDAY_ID;
        } else if (leaveType === 'SH') {
          record.reference_public_holiday_id = SH_HOLIDAY_ID;
        }
        records.push(record);
      }
    }
  }
  return records;
}

async function main() {
  const records = buildRecords();
  console.log(`準備匯入 ${records.length} 筆預排記錄`);

  // 預覽統計
  const byType = {};
  for (const r of records) {
    byType[r.leave_type] = (byType[r.leave_type] || 0) + 1;
  }
  console.log('按假別統計:', byType);

  // 1. 刪除 2026-09 所有預排
  console.log('\n正在刪除 2026-09 所有預排記錄...');
  const { error: deleteError, count: deleteCount } = await supabase
    .from('user_leave_records')
    .delete()
    .gte('leave_date', '2026-09-01')
    .lte('leave_date', '2026-09-30');

  if (deleteError) {
    console.error('❌ 刪除失敗:', deleteError);
    process.exit(1);
  }
  console.log(`✅ 已刪除 ${deleteCount ?? '全部'} 筆 2026-09 預排記錄`);

  // 2. 插入新記錄
  console.log('\n正在插入新預排記錄...');
  const { error: insertError } = await supabase
    .from('user_leave_records')
    .insert(records);

  if (insertError) {
    console.error('❌ 插入失敗:', insertError);
    process.exit(1);
  }
  console.log(`✅ 成功插入 ${records.length} 筆預排記錄`);
}

main().catch(console.error);
