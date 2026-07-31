import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

async function main() {
  const { data: pts } = await supabase.from('院友主表').select('院友id,床號,中文姓名,在住狀態');
  const patients = pts || [];
  const pageSize = 1000;
  let start = 0;
  const rxs = [];
  while (true) {
    const { data } = await supabase.from('new_medication_prescriptions').select('patient_id,created_at').range(start, start + pageSize - 1);
    if (!data || data.length === 0) break;
    rxs.push(...data);
    if (data.length < pageSize) break;
    start += pageSize;
  }
  const cutoff = '2026-07-31T19:50:00.000Z';
  const byRange = {};
  const byStatus = {};
  for (const r of rxs) {
    if (r.created_at < cutoff) continue;
    const p = patients.find(x => x.院友id === r.patient_id);
    if (!p) continue;
    const status = p.在住狀態 || 'null';
    const m = p.床號.match(/(\d+)/);
    const f = m ? parseInt(m[1]) : 0;
    const range = f >= 202 && f <= 237 ? '202-237' : (f >= 238 && f <= 287 ? '238-287' : 'other');
    byRange[range] = (byRange[range] || 0) + 1;
    byStatus[status] = (byStatus[status] || 0) + 1;
    if (range === '202-237') {
      const key = status + ' (202-237)';
      byStatus[key] = (byStatus[key] || 0) + 1;
    }
  }
  console.log('by range', byRange);
  console.log('by status', byStatus);
}

main().catch(console.error);
