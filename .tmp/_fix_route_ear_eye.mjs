// C站 / D站：administration_route「雙耳」→「雙眼」
// 用法: node .tmp/_fix_route_ear_eye.mjs [--dry]
import { createClient } from '@supabase/supabase-js';

const DRY = process.argv.includes('--dry');
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

// 1) 搵 C站 / D站（名稱以 C / D 開頭）
const { data: stations, error: stErr } = await supabase.from('stations').select('id, name');
if (stErr) { console.error('stations 查詢失敗:', stErr); process.exit(1); }
const targets = (stations || []).filter(s => /[CD]\s*站/.test(String(s.name)));
console.log('匹配到嘅站:', targets.map(s => `${s.name}(${s.id})`));
if (targets.length === 0) { console.log('無匹配站，結束'); process.exit(0); }
const stationIds = targets.map(s => s.id);

// 2) 搵站內院友
const { data: patients, error: pErr } = await supabase.from('院友主表').select('院友id, 中文姓名').in('station_id', stationIds);
if (pErr) { console.error('院友查詢失敗:', pErr); process.exit(1); }
const patientIds = (patients || []).map(p => p.院友id);
console.log(`站內院友 ${patientIds.length} 位`);

// 3) 搵 雙耳 處方
const { data: rx, error: rxErr } = await supabase
  .from('new_medication_prescriptions')
  .select('id, patient_id, medication_name, administration_route')
  .in('patient_id', patientIds)
  .eq('administration_route', '雙耳');
if (rxErr) { console.error('處方查詢失敗:', rxErr); process.exit(1); }
console.log(`雙耳處方 ${(rx || []).length} 筆`);
(rx || []).slice(0, 50).forEach(r => {
  const p = (patients || []).find(x => x.院友id === r.patient_id);
  console.log(`  ${p?.中文姓名 ?? r.patient_id} | ${r.medication_name}`);
});

if (DRY || (rx || []).length === 0) { console.log(DRY ? '(--dry 模式，未修改)' : '無需修改'); process.exit(0); }

// 4) 更新
const ids = rx.map(r => r.id);
const { error: upErr } = await supabase.from('new_medication_prescriptions').update({ administration_route: '雙眼' }).in('id', ids);
if (upErr) { console.error('更新失敗:', upErr); process.exit(1); }

// 5) 驗證
const { data: check } = await supabase.from('new_medication_prescriptions').select('id').in('id', ids).eq('administration_route', '雙耳');
console.log(`已更新 ${ids.length} 筆；殘留雙耳: ${(check || []).length}`);
