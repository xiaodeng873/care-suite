import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const ADD_SPECIAL = ['洗頭', '漱口', '塞肛', '沖洗', '浸浴', '滴眼', '滴耳'];
const ADD_SLOT = ['上午', '臨睡前', '午夜'];

const { data: rows, error } = await supabase.from('facility_settings').select('id, facility_id, medication_settings');
if (error) { console.log('ERROR', error.message); process.exit(1); }

for (const row of rows || []) {
  const ms = row.medication_settings || {};
  const special = Array.isArray(ms['特殊用法']) ? ms['特殊用法'] : [];
  const slots = Array.isArray(ms['服用時段']) ? ms['服用時段'] : [];
  const newSpecial = [...special, ...ADD_SPECIAL.filter(v => !special.includes(v))];
  const newSlots = [...slots, ...ADD_SLOT.filter(v => !slots.includes(v))];
  if (newSpecial.length === special.length && newSlots.length === slots.length) {
    console.log(`row ${row.id} (fac ${row.facility_id}): 無需更新`);
    continue;
  }
  const { error: upErr } = await supabase
    .from('facility_settings')
    .update({ medication_settings: { ...ms, '特殊用法': newSpecial, '服用時段': newSlots }, updated_at: new Date().toISOString() })
    .eq('id', row.id);
  console.log(`row ${row.id} (fac ${row.facility_id}): 特殊用法 ${special.length}→${newSpecial.length}，服用時段 ${slots.length}→${newSlots.length} ${upErr ? '失敗: ' + upErr.message : 'OK'}`);
}
