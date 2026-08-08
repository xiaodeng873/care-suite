// =====================================================
// 2026 年銀行假（PH）匯入腳本
// 用法：node --env-file=.env scripts/seed_2026_ph_holidays.mjs
// =====================================================

import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('請設定 VITE_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

const PH_HOLIDAYS_2026 = [
  { holiday_date: '2026-01-01', name: '元旦' },
  { holiday_date: '2026-02-17', name: '農曆年初一' },
  { holiday_date: '2026-02-18', name: '農曆年初二' },
  { holiday_date: '2026-02-19', name: '農曆年初三' },
  { holiday_date: '2026-04-03', name: '耶穌受難節' },
  { holiday_date: '2026-04-04', name: '耶穌受難節翌日' },
  { holiday_date: '2026-04-06', name: '清明節翌日' },
  { holiday_date: '2026-04-07', name: '復活節星期一翌日' },
  { holiday_date: '2026-05-01', name: '勞動節' },
  { holiday_date: '2026-05-25', name: '佛誕翌日' },
  { holiday_date: '2026-06-19', name: '端午節' },
  { holiday_date: '2026-07-01', name: '香港特別行政區成立紀念日' },
  { holiday_date: '2026-09-26', name: '中秋節翌日' },
  { holiday_date: '2026-10-01', name: '國慶日' },
  { holiday_date: '2026-10-19', name: '重陽節翌日' },
  { holiday_date: '2026-12-25', name: '聖誕節' },
  { holiday_date: '2026-12-26', name: '聖誕節後第一個周日' },
];

async function main() {
  const rows = PH_HOLIDAYS_2026.map((h) => ({ ...h, type: 'PH', created_by: null }));

  const { data, error } = await supabase
    .from('public_holidays')
    .upsert(rows, { onConflict: 'holiday_date,type', ignoreDuplicates: true })
    .select('holiday_date, name');

  if (error) throw error;

  console.log(`已匯入/忽略 ${rows.length} 筆 2026 年 PH 銀行假設定`);
  console.log('實際新增：', data?.length || 0);
  for (const h of data || []) {
    console.log(`  ${h.holiday_date} ${h.name}`);
  }
}

main().catch((err) => {
  console.error('匯入失敗:', err);
  process.exit(1);
});
