#!/usr/bin/env node
// 把含英文/簡稱的 medication_source 更新為對應中文
// 用法：SUPABASE_SERVICE_ROLE_KEY='your_key' node scripts/update_medication_source_translations.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!KEY) {
  console.error('❌ 請提供 SUPABASE_SERVICE_ROLE_KEY 環境變數');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const MAPPINGS = [
  { from: 'KWH - 廣華醫院', to: '廣華醫院' },
  { from: 'LST', to: '樂善堂' },
  { from: 'WTSH - 東華三院黄大仙醫院', to: '東華三院黃大仙醫院' },
  { from: 'LPC', to: 'LPC' }, // 不確定，保留不變
  { from: 'KCH - 葵涌醫院', to: '葵涌醫院' },
  { from: 'CMC - 明愛醫院', to: '明愛醫院' },
  { from: 'BH', to: '香港佛教醫院' },
  { from: 'KH - 九龍醫院', to: '九龍醫院' },
  { from: 'GP DR.HO', to: 'GP DR.HO' }, // 用戶要求維持英文
  { from: '東九龍專科診所(PSY)', to: '東九龍專科診所（精神科）' },
  { from: 'QEH - 伊利沙伯醫院', to: '伊利沙伯醫院' },
  { from: 'YMTSC', to: '油麻地專科診所' },
  { from: 'YCH - 仁濟醫院', to: '仁濟醫院' },
  { from: 'TWEH - 東華東醫院', to: '東華東醫院' },
];

async function run() {
  console.log('🚀 開始更新藥物來源中文名...\n');

  let totalUpdated = 0;

  for (const { from, to } of MAPPINGS) {
    if (from === to) {
      console.log(`⏭️  ${from} → 維持不變`);
      continue;
    }

    // 先查詢影響筆數
    const { data: preview, error: previewError } = await supabase
      .from('new_medication_prescriptions')
      .select('id')
      .eq('medication_source', from);

    if (previewError) {
      console.error(`❌ 查詢 ${from} 失敗:`, previewError.message);
      process.exit(1);
    }

    const count = (preview || []).length;
    if (count === 0) {
      console.log(`⏭️  ${from} → 無符合筆數`);
      continue;
    }

    const ids = preview.map(p => p.id);
    const { error: updateError } = await supabase
      .from('new_medication_prescriptions')
      .update({ medication_source: to })
      .in('id', ids);

    if (updateError) {
      console.error(`❌ 更新 ${from} → ${to} 失敗:`, updateError.message);
      process.exit(1);
    }

    console.log(`✅ ${from} → ${to}（${count} 筆）`);
    totalUpdated += count;
  }

  console.log(`\n🎉 共更新 ${totalUpdated} 筆處方。`);

  // 再次檢查剩餘英文來源
  const { data, error } = await supabase
    .from('new_medication_prescriptions')
    .select('medication_source')
    .not('medication_source', 'is', null);

  if (error) {
    console.error('❌ 最後檢查失敗:', error.message);
    process.exit(1);
  }

  const remainingEnglish = [...new Set((data || []).map(r => r.medication_source).filter(s => /[a-zA-Z]/.test(s)))];
  console.log(`\n🔍 更新後仍含英文的來源：${remainingEnglish.length > 0 ? '' : '無'}`);
  remainingEnglish.forEach(s => console.log(` - ${s}`));
}

run().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
