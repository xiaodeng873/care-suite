// 修正已退住/在住衝突：在住永遠正確。
// 1) 六位被錯改做已退住、但其實喺 AB 在住名單嘅院友 → 還原做在住（連床位）
// 2) 四組舊「已退住」同「在住」撞 ID → 軟刪已退住嗰條
// 3) 林碧珍雙在住（D269-1 唔喺 AB 名單）→ 軟刪嗰條 + 放床
// 4) 兩組重複已退住（薜金女、曾玉）→ 軟刨舊嗰條
import { createClient } from '@supabase/supabase-js';

const APPLY = process.env.APPLY === '1';
const sb = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const normId = s => String(s || '').toUpperCase().replace(/[\s()（）]/g, '');

// 1) 要還原做在住嘅（AB 名單有佢）
const REVERT_IDS = ['G5796902', 'R1943781', 'E1251507', 'B3900210', 'E2664953', 'B7271080'];
// 2) 3) 4) 要軟刪嘅院友id
const DELETE_PID = [77, 153, 15, 10, 601, 155, 144];

const { data: byId } = await sb.from('院友主表').select('*').in('身份證號碼', ['G579690(2)','R194378(1)','E125150(7)','E266495(3)']);
const { data: byName } = await sb.from('院友主表').select('*').in('中文姓名', ['李銀芳', '李玉嬋']);
const byNorm = new Map([...(byId || []), ...(byName || [])].map(p => [normId(p.身份證號碼), p]));
const freeBedIfOrphan = async (bedId) => {
  if (!bedId) return;
  const { data: occ } = await sb.from('院友主表').select('院友id').eq('bed_id', bedId);
  if (!occ || occ.length === 0) await sb.from('beds').update({ is_occupied: false }).eq('id', bedId);
};
const occupyBed = async (bedId) => {
  if (bedId) await sb.from('beds').update({ is_occupied: true }).eq('id', bedId);
};

if (!APPLY) {
  console.log('[dry-run] APPLY=1 先會寫入。還原名單：');
  for (const id of REVERT_IDS) {
    const p = byNorm.get(id);
    console.log(' ', p ? `[${p.院友id}] ${p.中文姓名} ${p.身份證號碼} 退於 ${p.退住日期} last_bed=${p.last_bed_id}` : `搵唔到 ${id}`);
  }
  process.exit(0);
}

// 1) 還原在住
for (const id of REVERT_IDS) {
  const p = byNorm.get(id);
  if (!p) { console.error('搵唔到', id); continue; }
  let bedNo = p.床號;
  if (p.last_bed_id) {
    const { data: bed } = await sb.from('beds').select('bed_number').eq('id', p.last_bed_id).maybeSingle();
    if (bed) bedNo = bed.bed_number;
  }
  const { error } = await sb.from('院友主表').update({
    在住狀態: '在住',
    退住日期: null,
    discharge_reason: null,
    death_date: null,
    transfer_facility_name: null,
    station_id: p.last_station_id ?? null,
    bed_id: p.last_bed_id ?? null,
    床號: bedNo || '',
  }).eq('院友id', p.院友id);
  if (error) { console.error('還原失敗', p.中文姓名, error.message); continue; }
  await occupyBed(p.last_bed_id);
  console.log(`已還原在住：${p.中文姓名} ${p.身份證號碼} 床=${bedNo}`);
}

// 2)3)4) 軟刪
for (const pid of DELETE_PID) {
  const { data: p } = await sb.from('院友主表').select('中文姓名,身份證號碼,在住狀態,bed_id').eq('院友id', pid).maybeSingle();
  if (!p) { console.error('搵唔到院友id', pid); continue; }
  const { error } = await sb.rpc('recycle_soft_delete', {
    p_table: '院友主表', p_id: String(pid),
    p_reason: '已退住/在住衝突修正：在住先至正確，刪重複已退住（或唔喺AB名單嘅雙重記錄）',
  });
  if (error) { console.error('軟刪失敗', pid, p.中文姓名, error.message); continue; }
  await freeBedIfOrphan(p.bed_id);
  console.log(`已軟刪：[${pid}] ${p.中文姓名} ${p.身份證號碼}（${p.在住狀態}）`);
}
console.log('DONE');
