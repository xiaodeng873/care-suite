#!/usr/bin/env node
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
  const { data, error, count } = await supabase
    .from('patient_restraint_assessments')
    .select('id, usage_record, doctor_signature_date, created_at', { count: 'exact' })
    .order('created_at', { ascending: false });

  if (error) {
    console.error('❌ 查詢失敗:', error);
    process.exit(1);
  }

  console.log('總記錄數:', count ?? data.length);

  const withUsage = data.filter(r => r.usage_record);
  const withoutUsage = data.filter(r => !r.usage_record);
  console.log('有 usage_record:', withUsage.length);
  console.log('無 usage_record:', withoutUsage.length);

  const doctors = {};
  for (const r of withUsage) {
    const doc = r.usage_record?.doctor || '(空)';
    doctors[doc] = (doctors[doc] || 0) + 1;
  }
  console.log('醫生分布:', doctors);

  // 列出沒有 usage_record 的 id
  if (withoutUsage.length > 0) {
    console.log('無 usage_record 的記錄 id:', withoutUsage.map(r => r.id).join(', '));
  }
}

run().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
