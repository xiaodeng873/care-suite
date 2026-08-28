#!/usr/bin/env node
// 把 medication_source = '葵涌醫院' 且 medication_source_specialty = '老人科' 的處方
// 全部改為 medication_source_specialty = '社區老人精神科'
// 用法：SUPABASE_SERVICE_ROLE_KEY='your_key' node scripts/update_kwai_chung_specialty.mjs

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

async function run() {
  console.log('🚀 開始更新葵涌醫院老人科處方專科...\n');

  const { data: preview, error: previewError } = await supabase
    .from('new_medication_prescriptions')
    .select('id, medication_name, medication_source, medication_source_specialty')
    .eq('medication_source', '葵涌醫院')
    .eq('medication_source_specialty', '老人科');

  if (previewError) {
    console.error('❌ 查詢失敗:', previewError.message);
    process.exit(1);
  }

  const affectedCount = (preview || []).length;
  console.log(`🔍 符合條件的處方數量：${affectedCount}`);
  if (affectedCount > 0) {
    console.log('   預覽前 10 筆：');
    (preview || []).slice(0, 10).forEach(p => {
      console.log(`   - id=${p.id}, name=${p.medication_name}, specialty=${p.medication_source_specialty}`);
    });
  }

  if (affectedCount === 0) {
    console.log('\n✅ 沒有需要更新的處方。');
    return;
  }

  const ids = preview.map(p => p.id);
  const { error: updateError } = await supabase
    .from('new_medication_prescriptions')
    .update({ medication_source_specialty: '社區老人精神科' })
    .in('id', ids);

  if (updateError) {
    console.error('❌ 更新失敗:', updateError.message);
    process.exit(1);
  }

  console.log(`\n✅ 已更新 ${affectedCount} 筆處方，專科改為「社區老人精神科」。`);
}

run().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
