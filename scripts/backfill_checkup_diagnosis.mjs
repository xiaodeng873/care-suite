#!/usr/bin/env node
// 把 annual_health_checkups 的 serious_illness_details 按現有診斷記錄回填
// 沒有診斷記錄的院友會清空 serious_illness_details
// 用法（預覽）: node scripts/backfill_checkup_diagnosis.mjs
// 正式寫入: node scripts/backfill_checkup_diagnosis.mjs --confirm

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

const DRY_RUN = !process.argv.includes('--confirm');

async function run() {
  console.log('🔍 讀取診斷記錄...');
  const { data: diagnosisRecords, error: dError } = await supabase
    .from('diagnosis_records')
    .select('patient_id, diagnosis_item');
  if (dError) throw dError;

  const byPatient = {};
  for (const r of diagnosisRecords || []) {
    if (!byPatient[r.patient_id]) byPatient[r.patient_id] = [];
    byPatient[r.patient_id].push(r.diagnosis_item);
  }

  console.log(`  共 ${diagnosisRecords.length} 筆診斷記錄，涉及 ${Object.keys(byPatient).length} 位院友`);

  console.log('🔍 讀取年度體檢記錄...');
  const { data: checkups, error: cError } = await supabase
    .from('annual_health_checkups')
    .select('id, patient_id, serious_illness_details, has_serious_illness');
  if (cError) throw cError;

  const updates = [];

  for (const c of checkups || []) {
    const items = byPatient[c.patient_id] || [];
    const details = items.join(', ');
    const has = items.length > 0;

    if (c.serious_illness_details === details && c.has_serious_illness === has) {
      continue;
    }

    updates.push({
      id: c.id,
      serious_illness_details: details,
      has_serious_illness: has,
    });
  }

  console.log(`\n📊 預覽結果：`);
  console.log(`  年度體檢記錄總數：${checkups.length}`);
  console.log(`  需要更新筆數：${updates.length}`);

  if (updates.length > 0) {
    console.log('\n📝 前 10 筆預覽：');
    for (const u of updates.slice(0, 10)) {
      console.log(`  id=${u.id}, has=${u.has_serious_illness}, details="${u.serious_illness_details}"`);
    }
  }

  if (DRY_RUN) {
    console.log('\n🔍 這是預覽模式。如要正式寫入，請加上 --confirm');
    return;
  }

  if (updates.length === 0) {
    console.log('沒有需要更新的記錄。');
    return;
  }

  console.log('\n📝 開始更新...');
  let updated = 0;
  for (const u of updates) {
    const { error } = await supabase
      .from('annual_health_checkups')
      .update({
        serious_illness_details: u.serious_illness_details,
        has_serious_illness: u.has_serious_illness,
      })
      .eq('id', u.id);
    if (error) {
      console.error(`❌ 更新 id=${u.id} 失敗：`, error.message);
      throw error;
    }
    updated++;
    if (updated % 10 === 0) {
      console.log(`✅ 已更新 ${updated}/${updates.length} 筆`);
    }
  }

  console.log(`\n🎉 完成，共更新 ${updated} 筆年度體檢記錄。`);
}

run().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
