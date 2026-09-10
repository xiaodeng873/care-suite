// 刪除重複疫苗記錄：同一院友 + 疫苗名稱 + 接種日期，保留一條（優先有疫苗類別，其次最新建立），其餘軟刪除入回收筒
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

// 分批拉晒
let all = [];
let from = 0;
for (;;) {
  const { data, error } = await supabase
    .from('vaccination_records')
    .select('id, patient_id, vaccine_item, vaccination_date, vaccine_category, created_at')
    .order('id')
    .range(from, from + 999);
  if (error) { console.error(error.message); process.exit(1); }
  all = all.concat(data || []);
  if ((data || []).length < 1000) break;
  from += 1000;
}
console.log('總記錄:', all.length);

const groups = new Map();
for (const r of all) {
  const key = `${r.patient_id}|${(r.vaccine_item || '').trim()}|${r.vaccination_date}`;
  if (!groups.has(key)) groups.set(key, []);
  groups.get(key).push(r);
}

let dupGroups = 0, deleted = 0;
for (const [, rs] of groups) {
  if (rs.length < 2) continue;
  dupGroups++;
  // 保留：有類別優先，其次 created_at 最新
  const sorted = [...rs].sort((a, b) => {
    const ca = a.vaccine_category ? 1 : 0;
    const cb = b.vaccine_category ? 1 : 0;
    if (ca !== cb) return cb - ca;
    return String(b.created_at).localeCompare(String(a.created_at));
  });
  const keep = sorted[0];
  for (const r of sorted.slice(1)) {
    const { error } = await supabase.rpc('recycle_soft_delete', {
      p_table: 'vaccination_records', p_id: r.id,
      p_reason: '重複記錄：同一院友+疫苗名稱+接種日期，保留 ' + keep.id,
    });
    if (error) { console.error('刪除失敗', r.id, error.message); process.exit(1); }
    deleted++;
  }
  console.log(`重複組 ${rs.length} 條 -> 保留 ${keep.id}（${keep.vaccine_item} ${keep.vaccination_date}）刪 ${rs.length - 1}`);
}
console.log(`完成：${dupGroups} 組重複，共刪除 ${deleted} 條`);
