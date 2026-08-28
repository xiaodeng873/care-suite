#!/usr/bin/env node
// 批量更新處方資料：途徑、專科、來源、特殊用法、劑型
// 用法：SUPABASE_SERVICE_ROLE_KEY='your_key' node scripts/apply_medication_data_updates.mjs

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

async function updateField({ table, field, from, to, ilike }) {
  const query = supabase.from(table).select('id').eq(field, from);
  if (ilike) {
    // 重新建立 ilike 查詢
    const { data: preview, error: previewError } = await supabase
      .from(table)
      .select('id')
      .ilike(field, from);

    if (previewError) {
      console.error(`❌ 查詢 ${field}=${from} 失敗:`, previewError.message);
      return 0;
    }

    const ids = preview.map(p => p.id);
    if (ids.length === 0) {
      console.log(`⏭️  ${field} ilike ${from} → 無符合筆數`);
      return 0;
    }

    const { error: updateError } = await supabase
      .from(table)
      .update({ [field]: to })
      .in('id', ids);

    if (updateError) {
      console.error(`❌ 更新 ${field}=${from} 失敗:`, updateError.message);
      return 0;
    }

    console.log(`✅ ${field}=${from} → ${to}（${ids.length} 筆）`);
    return ids.length;
  }

  const { data: preview, error: previewError } = await query;
  if (previewError) {
    console.error(`❌ 查詢 ${field}=${from} 失敗:`, previewError.message);
    return 0;
  }

  const ids = preview.map(p => p.id);
  if (ids.length === 0) {
    console.log(`⏭️  ${field}=${from} → 無符合筆數`);
    return 0;
  }

  const { error: updateError } = await supabase
    .from(table)
    .update({ [field]: to })
    .in('id', ids);

  if (updateError) {
    console.error(`❌ 更新 ${field}=${from} 失敗:`, updateError.message);
    return 0;
  }

  console.log(`✅ ${field}=${from} → ${to}（${ids.length} 筆）`);
  return ids.length;
}

async function updateBatch(table, field, from, to, batchSize = 100) {
  let page = 0;
  let total = 0;
  while (true) {
    const { data, error } = await supabase
      .from(table)
      .select('id')
      .eq(field, from)
      .range(page * batchSize, (page + 1) * batchSize - 1);

    if (error) {
      console.error(`❌ 查詢 ${field}=${from} 第 ${page + 1} 批失敗:`, error.message);
      return total;
    }

    if (!data || data.length === 0) break;

    const ids = data.map(p => p.id);
    const { error: updateError } = await supabase
      .from(table)
      .update({ [field]: to })
      .in('id', ids);

    if (updateError) {
      console.error(`❌ 更新 ${field}=${from} 第 ${page + 1} 批失敗:`, updateError.message);
      return total;
    }

    total += ids.length;
    page++;
  }

  if (total > 0) {
    console.log(`✅ ${field}=${from} → ${to}（${total} 筆）`);
  } else {
    console.log(`⏭️  ${field}=${from} → 無符合筆數`);
  }
  return total;
}

async function updateDosageFormRename() {
  // 外用藥膏 → 藥膏
  const count1 = await updateBatch('new_medication_prescriptions', 'dosage_form', '外用藥膏', '藥膏');
  // 片劑 → 藥片（筆數多，分批避免 in(...) 過大）
  const count2 = await updateBatch('new_medication_prescriptions', 'dosage_form', '片劑', '藥片');
  return count1 + count2;
}

async function updateSpecialInstructionForCreams() {
  const names = [
    'METHYL SALICYLATE COMPOUND',
    'CLOTRIMAZOLE CREAM',
    'FLUOCINOLONE ACETONIDE CREAM'
  ];

  let total = 0;
  for (const name of names) {
    const { data: preview, error: previewError } = await supabase
      .from('new_medication_prescriptions')
      .select('id, medication_name')
      .ilike('medication_name', `%${name}%`);

    if (previewError) {
      console.error(`❌ 查詢 ${name} 失敗:`, previewError.message);
      continue;
    }

    const ids = preview.map(p => p.id);
    if (ids.length === 0) {
      console.log(`⏭️  ${name} → 無符合筆數`);
      continue;
    }

    const { error: updateError } = await supabase
      .from('new_medication_prescriptions')
      .update({ special_dosage_instruction: '搽患處' })
      .in('id', ids);

    if (updateError) {
      console.error(`❌ 更新 ${name} 失敗:`, updateError.message);
      continue;
    }

    console.log(`✅ ${name} → special_dosage_instruction=搽患處（${ids.length} 筆）`);
    total += ids.length;
  }

  return total;
}

async function updateMedicationSettings() {
  const { data, error } = await supabase
    .from('facility_settings')
    .select('id, medication_settings')
    .limit(1);

  if (error) {
    console.error('❌ 讀取 facility_settings 失敗:', error.message);
    return;
  }

  const row = data?.[0];
  if (!row) {
    console.log('⏭️  找不到 facility_settings 記錄');
    return;
  }

  const settings = row.medication_settings || {};

  // 更新服用途徑
  if (Array.isArray(settings['服用途徑'])) {
    settings['服用途徑'] = settings['服用途徑'].map(r => r === '肛門' ? '塞肛' : r);
  }

  // 更新劑型
  if (Array.isArray(settings['劑型'])) {
    settings['劑型'] = settings['劑型'].map(t => {
      if (t === '外用藥膏') return '藥膏';
      if (t === '片劑') return '藥片';
      return t;
    });
  }

  // 更新機構簡稱
  if (typeof settings['機構簡稱'] === 'object' && settings['機構簡稱'] !== null) {
    if (settings['機構簡稱']['香港佛教醫院'] !== 'HKBH') {
      settings['機構簡稱']['香港佛教醫院'] = 'HKBH';
    }
    if (!settings['機構簡稱']['香港佛教醫院'] && settings['機構簡稱']['香港佛教醫院'] === undefined) {
      settings['機構簡稱']['香港佛教醫院'] = 'HKBH';
    }
  }

  // 更新專科簡稱
  if (typeof settings['專科簡稱'] !== 'object' || settings['專科簡稱'] === null) {
    settings['專科簡稱'] = {};
  }
  settings['專科簡稱']['矯形及創傷外科'] = 'O&T';
  settings['專科簡稱']['皮膚科'] = 'DERM';
  settings['專科簡稱']['西九龍精神科中心'] = 'WKPC';

  const { error: updateError } = await supabase
    .from('facility_settings')
    .update({ medication_settings: settings })
    .eq('id', row.id);

  if (updateError) {
    console.error('❌ 更新 facility_settings 失敗:', updateError.message);
    return;
  }

  console.log('✅ facility_settings.medication_settings 已更新');
}

async function run() {
  console.log('🚀 開始批量更新處方資料...\n');

  let total = 0;

  total += await updateField({ table: 'new_medication_prescriptions', field: 'administration_route', from: '肛門', to: '塞肛' });
  total += await updateField({ table: 'new_medication_prescriptions', field: 'medication_source_specialty', from: 'O&T', to: '矯形及創傷外科' });
  total += await updateField({ table: 'new_medication_prescriptions', field: 'medication_source_specialty', from: 'DERM', to: '皮膚科' });
  total += await updateField({ table: 'new_medication_prescriptions', field: 'medication_source_specialty', from: 'WKL', to: '西九龍精神科中心' });
  total += await updateField({ table: 'new_medication_prescriptions', field: 'medication_source', from: 'BH', to: '香港佛教醫院' });
  total += await updateSpecialInstructionForCreams();
  total += await updateDosageFormRename();
  await updateMedicationSettings();

  console.log(`\n🎉 處方資料更新完成，共影響 ${total} 筆處方。`);
}

run().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
