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
  const { data, error } = await supabase
    .from('patient_restraint_assessments')
    .select('id, patient_id, doctor_signature_date, usage_record')
    .limit(10);

  if (error) {
    console.error('❌ 查詢失敗:', error);
    process.exit(1);
  }

  for (const row of data || []) {
    console.log(JSON.stringify({
      id: row.id,
      patient_id: row.patient_id,
      doctor_signature_date: row.doctor_signature_date,
      usage_record_doctor: row.usage_record?.doctor,
      usage_record: row.usage_record
    }, null, 2));
    console.log('---');
  }
}

run().catch(err => {
  console.error('執行失敗:', err);
  process.exit(1);
});
