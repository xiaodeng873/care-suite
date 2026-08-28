#!/usr/bin/env node
// 檢查 new_medication_prescriptions 中所有 medication_source 的值
// 用法：SUPABASE_SERVICE_ROLE_KEY='your_key' node scripts/check_medication_sources.mjs

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

function containsEnglish(text) {
  if (!text || typeof text !== 'string') return false;
  return /[a-zA-Z]/.test(text);
}

async function run() {
  console.log('🚀 開始檢查處方藥物來源...\n');

  const { data, error } = await supabase
    .from('new_medication_prescriptions')
    .select('medication_source')
    .not('medication_source', 'is', null);

  if (error) {
    console.error('❌ 查詢失敗:', error.message);
    process.exit(1);
  }

  const counts = new Map();
  (data || []).forEach(row => {
    const source = row.medication_source;
    counts.set(source, (counts.get(source) || 0) + 1);
  });

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
  console.log(`🔍 共 ${sorted.length} 個不同的 medication_source 值：\n`);

  const withEnglish = [];
  const pureChinese = [];

  sorted.forEach(([source, cnt]) => {
    if (containsEnglish(source)) {
      withEnglish.push({ source, count: cnt });
    } else {
      pureChinese.push({ source, count: cnt });
    }
  });

  console.log('✅ 已為中文的來源：');
  pureChinese.forEach(({ source, count }) => {
    console.log(` - ${source} (${count} 筆)`);
  });

  console.log(`\n⚠️ 含英文 / 簡稱的來源（共 ${withEnglish.length} 個）：`);
  if (withEnglish.length === 0) {
    console.log(' 無');
  } else {
    withEnglish.forEach(({ source, count }) => {
      console.log(` - ${source} (${count} 筆)`);
    });
  }
}

run().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
