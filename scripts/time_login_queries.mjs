import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://mzeptzwuqvpjspxgnzkp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMjM4NjEsImV4cCI6MjA2NzU5OTg2MX0.Uo4fgr2XdUxWY5LZ5Q7A0j6XoCyuUsHhb4WO-eabJWk'
);

// 登入時 Loading Screen 等待的主要資料表（對應各 Context 的初始載入）
const tables = [
  '院友主表',
  'stations',
  'beds',
  '健康監測記錄',
  '覆診安排主表',
  'patient_health_tasks',
  'new_medication_prescriptions',
  'medication_workflow_records',
  'meal_guidance',
  'health_assessments',
  'patient_restraint_assessments',
  'annual_health_checkups',
  'patient_activity_records',
  'vaccination_records',
  'care_plans',
  'wounds',
  'patient_tube_care_records',
  'patient_notes',
  'patient_logs',
  'hospital_episodes',
];

const results = [];
for (const table of tables) {
  const t0 = performance.now();
  const { data, error, count } = await supabase.from(table).select('*', { count: 'exact' });
  const ms = Math.round(performance.now() - t0);
  const rows = data?.length ?? 0;
  const bytes = JSON.stringify(data ?? []).length;
  results.push({ table, ms, rows, kb: Math.round(bytes / 1024), error: error?.message ?? null });
  console.log(`${String(ms).padStart(6)} ms  ${String(rows).padStart(6)} rows  ${String(Math.round(bytes / 1024)).padStart(7)} KB  ${table}${error ? '  ERROR: ' + error.message : ''}`);
}

const slow = results.filter(r => !r.error).sort((a, b) => b.ms - a.ms).slice(0, 5);
console.log('\n最慢的 5 個查詢:');
slow.forEach(r => console.log(`  ${r.ms} ms — ${r.table} (${r.rows} rows, ${r.kb} KB)`));
const total = results.reduce((s, r) => s + r.ms, 0);
console.log(`\n全部加總（序列執行）: ${total} ms`);
