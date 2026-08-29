#!/usr/bin/env node
// 把 patient_restraint_assessments 表中所有已存在 usage_record 的記錄，
// 其 usage_record->doctor 設為 "Dr. Leung"。
// 用法: SUPABASE_SERVICE_ROLE_KEY='...' node apply_restraint_doctor.mjs

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
  console.log('🚀 開始把全部約束物品評估的處方醫生設為 Dr. Leung...');

  const { data: rows, error: fetchError } = await supabase
    .from('patient_restraint_assessments')
    .select('id, usage_record, doctor_signature_date, next_due_date, suggested_restraints')
    .order('created_at', { ascending: false });

  if (fetchError) {
    console.error('\n❌ 查詢失敗:', fetchError.message);
    process.exit(1);
  }

  if (!rows || rows.length === 0) {
    console.log('ℹ️ 沒有需要更新的記錄');
    return;
  }

  console.log(`🔍 找到 ${rows.length} 筆記錄`);

  let updated = 0;
  let failed = 0;

  for (const row of rows) {
    const newUsageRecord = row.usage_record
      ? { ...row.usage_record, doctor: 'Dr. Leung' }
      : {
          start_date: row.doctor_signature_date || '',
          end_date: row.next_due_date || '',
          doctor: 'Dr. Leung',
          reasons: {},
          types: {},
          observations: { '血液循環': true, '呼吸狀況': true, '精神狀況': true, '皮膚狀況': true, '姿勢舒適': true }
        };

    const { error: updateError } = await supabase
      .from('patient_restraint_assessments')
      .update({ usage_record: newUsageRecord })
      .eq('id', row.id);

    if (updateError) {
      console.error(`  ❌ id ${row.id} 更新失敗:`, updateError.message);
      failed++;
    } else {
      updated++;
    }
  }

  console.log(`\n✅ 更新完成：${updated} 筆成功，${failed} 筆失敗`);
  if (failed > 0) process.exit(1);
}

run().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
