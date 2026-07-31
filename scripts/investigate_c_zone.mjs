import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.resolve(__dirname, '../.env') });

const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('缺少環境變數');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

async function main() {
  console.log('=== C 區處方可見性調查 ===\n');

  // 1. stations
  const { data: stations, error: stationsErr } = await supabase.from('stations').select('*').order('name');
  if (stationsErr) throw stationsErr;
  console.log(`stations 總數：${stations.length}`);
  for (const s of stations) console.log(`  ${s.id} | code=${s.code} | name=${s.name}`);
  const cStation = stations.find(s => s.code === 'C' || s.name?.includes('C'));
  const cStationId = cStation?.id;
  console.log(`\nC 站 id：${cStationId || 'NOT FOUND'}`);

  // 2. rooms / beds for C zone 202-237
  if (cStationId) {
    const { data: roomsBeds, error: rbErr } = await supabase
      .from('rooms')
      .select('id, room_number, beds(id, bed_number, bed_no)')
      .eq('station_id', cStationId)
      .gte('room_number', '202')
      .lte('room_number', '237')
      .order('room_number');
    if (rbErr) throw rbErr;
    console.log(`\nC 區 202-237 房間數：${roomsBeds.length}`);
    let bedCount = 0;
    for (const r of roomsBeds) {
      bedCount += r.beds?.length || 0;
    }
    console.log(`對應床位總數：${bedCount}`);
  }

  // 3. 院友主表 202-237 的 station_id / bed_id / 在住狀態
  const { data: cPatients, error: cpErr } = await supabase
    .from('院友主表')
    .select('院友id, 中文姓名, 床號, station_id, bed_id, 在住狀態')
    .ilike('床號', 'C2%')
    .order('床號');
  if (cpErr) throw cpErr;

  const c202_237 = (cPatients || []).filter(p => {
    const m = p.床號?.match(/^C(\d{3})-\d+$/);
    if (!m) return false;
    const room = parseInt(m[1], 10);
    return room >= 202 && room <= 237;
  });
  const c238_287 = (cPatients || []).filter(p => {
    const m = p.床號?.match(/^C(\d{3})-\d+$/);
    if (!m) return false;
    const room = parseInt(m[1], 10);
    return room >= 238 && room <= 287;
  });

  console.log(`\n院友主表 C2xx 床位數：${cPatients.length}`);
  console.log(`  202-237 房：${c202_237.length} 位`);
  console.log(`  238-287 房：${c238_287.length} 位`);

  const nullStation202_237 = c202_237.filter(p => !p.station_id);
  const nullBed202_237 = c202_237.filter(p => !p.bed_id);
  const notInCStation202_237 = c202_237.filter(p => p.station_id && p.station_id !== cStationId);
  const notResident202_237 = c202_237.filter(p => p.在住狀態 !== '在住');

  console.log(`\n202-237 房院友異常統計：`);
  console.log(`  station_id 為 null：${nullStation202_237.length}`);
  console.log(`  bed_id 為 null：${nullBed202_237.length}`);
  console.log(`  station_id 不屬於 C 站：${notInCStation202_237.length}`);
  console.log(`  在住狀態不是「在住」：${notResident202_237.length}`);

  if (nullStation202_237.length) {
    console.log(`\n  station_id 為 null 的院友：`);
    for (const p of nullStation202_237.slice(0, 20)) {
      console.log(`    ${p.床號} ${p.中文姓名} 院友id=${p.院友id} bed_id=${p.bed_id} 在住狀態=${p.在住狀態}`);
    }
  }
  if (notInCStation202_237.length) {
    console.log(`\n  station_id 不屬 C 站的院友（前 20）：`);
    for (const p of notInCStation202_237.slice(0, 20)) {
      console.log(`    ${p.床號} ${p.中文姓名} station_id=${p.station_id} 在住狀態=${p.在住狀態}`);
    }
  }
  if (notResident202_237.length) {
    console.log(`\n  非在住院友（前 20）：`);
    for (const p of notResident202_237.slice(0, 20)) {
      console.log(`    ${p.床號} ${p.中文姓名} 在住狀態=${p.在住狀態} station_id=${p.station_id}`);
    }
  }

  // 4. 處方數：按院友床號範圍
  const cPatientIds202_237 = c202_237.map(p => p.院友id);
  const cPatientIds238_287 = c238_287.map(p => p.院友id);

  const { count: rxCount202_237, error: rxErr1 } = await supabase
    .from('new_medication_prescriptions')
    .select('*', { head: true, count: 'exact' })
    .in('patient_id', cPatientIds202_237);
  const { count: rxCount238_287, error: rxErr2 } = await supabase
    .from('new_medication_prescriptions')
    .select('*', { head: true, count: 'exact' })
    .in('patient_id', cPatientIds238_287);
  if (rxErr1) throw rxErr1;
  if (rxErr2) throw rxErr2;

  console.log(`\nnew_medication_prescriptions 處方數：`);
  console.log(`  對應 202-237 房院友：${rxCount202_237} 筆`);
  console.log(`  對應 238-287 房院友：${rxCount238_287} 筆`);

  // 5. 哪些 202-237 房院友完全沒處方
  const idsWithRx = new Set();
  if (rxCount202_237 > 0) {
    const { data: rxRows } = await supabase
      .from('new_medication_prescriptions')
      .select('patient_id')
      .in('patient_id', cPatientIds202_237);
    for (const r of rxRows || []) idsWithRx.add(r.patient_id);
  }
  const noRx = c202_237.filter(p => !idsWithRx.has(p.院友id));
  console.log(`\n202-237 房中沒有任何處方的院友：${noRx.length} 位`);
  for (const p of noRx.slice(0, 20)) {
    console.log(`  ${p.床號} ${p.中文姓名} 院友id=${p.院友id}`);
  }

  // 6. user_profiles preferred_station_ids
  const { data: profiles, error: profErr } = await supabase
    .from('user_profiles')
    .select('id, full_name, preferred_station_ids');
  if (profErr) throw profErr;
  console.log(`\nuser_profiles 數量：${profiles.length}`);
  for (const u of profiles) {
    const pref = u.preferred_station_ids || [];
    const includesC = cStationId ? pref.includes(cStationId) : 'N/A';
    console.log(`  ${u.id} ${u.full_name || ''} | preferred_station_ids 數=${pref.length} | 包含C站=${includesC}`);
  }

  // 7. 檢查是否有處方掛到非 202-237 房的同名院友（錯配偵測）
  console.log('\n=== 同名錯配快速偵測 ===');
  const { data: allCPatients, error: acpErr } = await supabase
    .from('院友主表')
    .select('院友id, 中文姓名, 床號, station_id')
    .ilike('床號', 'C%');
  if (acpErr) throw acpErr;

  const namesIn202_237 = new Map();
  for (const p of c202_237) {
    const list = namesIn202_237.get(p.中文姓名) || [];
    list.push(p);
    namesIn202_237.set(p.中文姓名, list);
  }

  let mismatchCount = 0;
  for (const [name, pts] of namesIn202_237) {
    if (pts.length > 1) continue; // 只處理 202-237 唯一姓名
    const pt = pts[0];
    const others = allCPatients.filter(p => p.中文姓名 === name && p.院友id !== pt.院友id);
    if (!others.length) continue;
    const { count, error: mcErr } = await supabase
      .from('new_medication_prescriptions')
      .select('*', { head: true, count: 'exact' })
      .eq('patient_id', pt.院友id);
    if (mcErr) throw mcErr;
    if (count === 0) {
      mismatchCount++;
      console.log(`  可能錯配：${name} 在 ${pt.床號} 有 0 筆處方，但同名院友 ${others.map(o => o.床號).join(',')} 可能有處方`);
    }
  }
  console.log(`\n可能錯配（202-237 房姓名唯一但處方為 0）：${mismatchCount} 位`);
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
