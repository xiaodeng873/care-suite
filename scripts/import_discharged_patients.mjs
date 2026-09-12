// 退院院友匯入（upload/退院院友個人基本資料.xlsx → 院友主表，在住狀態=退住）
// 對照鍵：身份證號碼（normId 正規化）。
//   Excel ↔ DB 在住 → 更新做退住（放床、記退住日期/原因）
//   Excel ↔ 回收筒 → 還原後更新做退住
//   Excel 淨低 → 新增退住院友（無床位/站）
// 預設 dry-run；APPLY=1 先會真係寫入。
// 欄位（第5列=header index 4）：
//   0 服務編號 1 中文姓名 2 英文姓名 3 證件類型 4 證件編號 5 入住日期 6 退院日期 7 入住天數
//   8 床位等級 9 護理等級 10 退院原因 11 性別 12 年齡 13 出生日期 14-16 出生年/月/日
//   17 手機號碼 18 其它號碼 19 聯絡地址 20 電子郵箱 21 聯絡注意事項 22 備註 23 創建人及時間 24 最後修改人及時間
import { createClient } from '@supabase/supabase-js';
import XLSX from 'xlsx';
import fs from 'node:fs';

const APPLY = process.env.APPLY === '1';
const sb = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const normId = s => String(s || '').toUpperCase().replace(/[\s()（）]/g, '');
const fmtId = s => String(s || '').toUpperCase().replace(/\s+/g, '');
const clean = s => String(s || '').trim();
const normDate = s => {
  const m = /^(\d{4})[-/](\d{1,2})[-/](\d{1,2})/.exec(clean(s));
  return m ? `${m[1]}-${m[2].padStart(2, '0')}-${m[3].padStart(2, '0')}` : null;
};

const NURSING_MAP = { '高度照顧': '全護理', '中度照顧': '半護理', '低度照顧': '自理', '普通照顧': '自理' };
const ADMIT_TYPE_MAP = { '買位': '買位', '私位': '私位', '院舍券': '院舍卷級別0', '院舍卷': '院舍卷級別0', '指定買位暫托': '暫住', '暫托': '暫住', '暫託': '暫住' };
const REASON_MAP = {
  '回家 (由家人照顧)': '回家', '回家': '回家',
  '離世': '死亡', '死亡': '死亡',
  '在醫院接受治療': '留醫', '留醫': '留醫',
  '轉政府資助宿位': '轉往其他機構', '轉非政府資助宿位': '轉往其他機構', '轉往其他機構': '轉往其他機構',
  '獲其他相關服務': '轉往其他機構',
};
const mapOr = (v, m) => m[clean(v)] || null;
// 退院原因常帶後綴備註（如「離世:22/10死亡」「回家 (由家人照顧):家人已請到傭工」），對照時剝走
const reasonKeyOf = raw => clean(raw).split(/[:：]/)[0].trim();

// 中文姓名拆姓氏/名字：4 字→2+2，其餘 1+rest；純英文（無中文字）→ 視作英文名
const hasCJK = s => /[\u4e00-\u9fff]/.test(s);
const splitChName = full => {
  if (!hasCJK(full)) return { 中文姓氏: '', 中文名字: '' };
  if (full.length === 4) return { 中文姓氏: full.slice(0, 2), 中文名字: full.slice(2) };
  return { 中文姓氏: full.charAt(0), 中文名字: full.slice(1) };
};
const splitEnName = full => {
  const s = clean(full).replace(/,/g, ' ').replace(/\s+/g, ' ').trim();
  if (!s) return { 英文姓氏: '', 英文名字: '' };
  const i = s.indexOf(' ');
  return i < 0 ? { 英文姓氏: s, 英文名字: '' } : { 英文姓氏: s.slice(0, i), 英文名字: s.slice(i + 1) };
};

// ---- 讀 Excel ----
const wb = XLSX.readFile('upload/退院院友個人基本資料.xlsx');
const rows = XLSX.utils.sheet_to_json(wb.Sheets[wb.SheetNames[0]], { header: 1, defval: '' });
const seen = new Set();
const excel = [];
const dups = [];
for (const r of rows.slice(5)) {
  const id = normId(r[4]);
  const name = clean(r[1]);
  if (!id && !name) continue;
  if (seen.has(id)) { dups.push({ id, name }); continue; }
  seen.add(id);
  const ch = hasCJK(name) ? name : '';
  const en = clean(r[2]) || (hasCJK(name) ? '' : name);
  const reasonRaw = clean(r[10]);
  const reasonKey = reasonKeyOf(r[10]);
  excel.push({
    sc: clean(r[0]),
    中文姓名: ch, enFull: en,
    idFmt: fmtId(r[4]),
    入住日期: normDate(r[5]),
    退住日期: normDate(r[6]),
    入住類型: mapOr(r[8], ADMIT_TYPE_MAP),
    nursingRaw: clean(r[9]),
    護理等級: mapOr(r[9], NURSING_MAP),
    reasonRaw,
    // discharge_reason 有 CHECK 限制，只准 死亡/回家/留醫/轉往其他機構，對唔到嘅留空
    discharge_reason: REASON_MAP[reasonKey] || null,
    reasonKey,
    性別: clean(r[11]) || null,
    出生日期: normDate(r[13]),
    通訊電話: clean(r[17]) || null,
    通訊地址: clean(r[19]) || null,
  });
}
console.log(`Excel 有效列：${excel.length}（重複跳過 ${dups.length}：${dups.map(d => d.name).join('、') || '無'}）`);
const unmappedNursing = [...new Set(excel.filter(e => e.nursingRaw && !e.護理等級).map(e => e.nursingRaw))];
const unmappedReason = [...new Set(excel.filter(e => e.reasonRaw && !REASON_MAP[e.reasonKey] && e.reasonKey !== '其他').map(e => e.reasonRaw))];
if (unmappedNursing.length) console.log('!! 護理等級對唔到（會留空）:', unmappedNursing);
if (unmappedReason.length) console.log('!! 退院原因對唔到（會照抄原文）:', unmappedReason);

// ---- 對照 DB ----
const { data: liveAll } = await sb.from('院友主表').select('院友id,床號,中文姓名,身份證號碼,在住狀態,退住日期,station_id,bed_id,death_date').neq('在住狀態', '已退住');
const liveById = new Map((liveAll || []).map(p => [normId(p.身份證號碼), p]));
// 已退住嘅都攞嚟對（可能已匯過）
const { data: dischargedAll } = await sb.from('院友主表').select('院友id,床號,中文姓名,身份證號碼,在住狀態,退住日期,station_id,bed_id,death_date').eq('在住狀態', '已退住');
const dischargedById = new Map((dischargedAll || []).map(p => [normId(p.身份證號碼), p]));
const { data: binRows } = await sb.from('deleted_records').select('id,original_id,data').eq('original_table', '院友主表');
const binById = new Map((binRows || []).map(b => [normId(b.data?.身份證號碼), b]));

const planUpdate = [];   // 在住/其他 → 改退住
const planAlready = [];  // 已經係退住 → 淨補資料
const planRestore = [];  // 回收筒 → 還原+更新
const planInsert = [];   // 全新
const planUnmatched = [];// 完全對唔上（ID 空）
for (const e of excel) {
  if (!e.idFmt) { planUnmatched.push(e); continue; }
  if (liveById.has(e.idFmt)) planUpdate.push({ e, p: liveById.get(e.idFmt) });
  else if (dischargedById.has(e.idFmt)) planAlready.push({ e, p: dischargedById.get(e.idFmt) });
  else if (binById.has(e.idFmt)) planRestore.push({ e, b: binById.get(e.idFmt) });
  else planInsert.push(e);
}
console.log(`\n分類：在住需改退住=${planUpdate.length} 已是退住=${planAlready.length} 回收筒還原=${planRestore.length} 全新插入=${planInsert.length} 無ID=${planUnmatched.length}`);
console.log('\n-- 在住需改退住 --'); planUpdate.forEach(({ e, p }) => console.log(`  ${p.床號 || '-'} ${e.中文姓名} ${e.idFmt}（DB狀態=${p.在住狀態}）退於 ${e.退住日期} ${e.reasonRaw}`));
console.log('\n-- 回收筒還原 --'); planRestore.forEach(({ e, b }) => console.log(`  ${e.中文姓名} ${e.idFmt} ← bin ${b.id}（原院友id=${b.original_id}）退於 ${e.退住日期} ${e.reasonRaw}`));
console.log('\n-- 無證件編號（唔會處理） --'); planUnmatched.forEach(e => console.log(`  ${e.sc} ${e.中文姓名 || e.enFull}`));
const sample = planInsert.slice(0, 15).map(e => `${e.中文姓名 || e.enFull} ${e.idFmt}`);
console.log(`\n-- 全新插入（${planInsert.length}，顯示頭15）--`); sample.forEach(s => console.log(' ', s));

const buildPatch = (e, keepHkid = false) => {
  const en = splitEnName(e.enFull);
  const enFullFmt = en.英文姓氏 + (en.英文名字 ? `, ${en.英文名字}` : '');
  return {
  ...splitChName(e.中文姓名),
  ...(enFullFmt ? { 英文姓名: enFullFmt } : {}),
  英文姓氏: en.英文姓氏 || null,
  英文名字: en.英文名字 || null,
  性別: e.性別,
  ...(keepHkid ? {} : { 身份證號碼: e.idFmt }),
  出生日期: e.出生日期,
  入住日期: e.入住日期,
  退住日期: e.退住日期,
  護理等級: e.護理等級,
  入住類型: e.入住類型,
  在住狀態: '已退住',
  is_hospitalized: false,
  discharge_reason: e.discharge_reason,
  ...(e.discharge_reason === '死亡' ? { death_date: e.退住日期 } : {}),
  ...(/^轉/.test(e.reasonKey || '') ? { transfer_facility_name: e.reasonKey } : {}),
  ...(e.通訊電話 ? { 通訊電話: e.通訊電話 } : {}),
  ...(e.通訊地址 ? { 通訊地址: e.通訊地址 } : {}),
  };
};

// 放床前檢查：冇其他在住院友用緊先至得，否則張床已經分咗俾人
const freeBedIfOrphan = async (bedId) => {
  if (!bedId) return;
  const { data: occupants } = await sb.from('院友主表').select('院友id').eq('bed_id', bedId);
  if (!occupants || occupants.length === 0) {
    await sb.from('beds').update({ is_occupied: false }).eq('id', bedId);
  }
};

if (!APPLY) {
  console.log('\n[dry-run] APPLY=1 先會寫入。');
  fs.writeFileSync('.tmp/discharge_import_plan.json', JSON.stringify({ planUpdate, planAlready, planRestore, planInsert, planUnmatched }, null, 1));
  process.exit(0);
}

// ---- 執行 ----
let ok = 0, fail = 0;
const failList = [];

// 1) 在住 → 已退住（放床，但張床冇人先用得）
for (const { e, p } of planUpdate) {
  const patch = buildPatch(e, true);
  const { error } = await sb.from('院友主表').update({
    ...patch,
    last_station_id: p.station_id, last_bed_id: p.bed_id,
    station_id: null, bed_id: null,
  }).eq('院友id', p.院友id);
  if (error) { fail++; failList.push({ e, error: error.message }); console.error('更新失敗', e.中文姓名, error.message); continue; }
  await freeBedIfOrphan(p.bed_id);
  ok++;
  console.log(`改退住：${e.中文姓名} ${e.idFmt}`);
}

// 2) 已退住 → 補齊資料（唔郁床位欄位、唔郁身份證格式）
for (const { e, p } of planAlready) {
  const { error } = await sb.from('院友主表').update(buildPatch(e, true)).eq('院友id', p.院友id);
  if (error) { fail++; failList.push({ e, error: error.message }); console.error('補資料失敗', e.中文姓名, error.message); continue; }
  ok++;
  console.log(`補齊退住資料：${e.中文姓名} ${e.idFmt}`);
}

// 3) 回收筒 → 還原後改已退住。
//    recycle_restore 會用舊院友id插返，撞 pk 就失敗；改用人手插（新id）+ 清回收筒記錄。
for (const { e, b } of planRestore) {
  let restoredId = null;
  const { error: rerr } = await sb.rpc('recycle_restore', { p_recycle_id: b.id });
  if (!rerr) {
    const { data: r } = await sb.from('院友主表').select('院友id,bed_id').eq('身份證號碼', b.data?.身份證號碼).maybeSingle();
    restoredId = r?.院友id ?? null;
  }
  if (!restoredId) {
    // 人手還原：除咗院友id（撞 pk），其餘原樣插返；
    // 舊床位而家有人瞓（unique 約束），床號置空、舊床記入 last_bed_id
    const { 院友id: _oldId, bed_id: oldBedId, station_id: oldStationId, 床號: _oldBedNo, ...rest } = b.data || {};
    const { data: ins, error: ierr } = await sb.from('院友主表').insert({
      ...rest,
      床號: '', bed_id: null, station_id: null,
      last_bed_id: oldBedId ?? null, last_station_id: oldStationId ?? null,
      首次記錄日期: new Date().toISOString().slice(0, 10),
    }).select('院友id').single();
    if (ierr) { fail++; failList.push({ e, error: 'manual restore: ' + ierr.message }); console.error('人手還原失敗', e.中文姓名, ierr.message); continue; }
    restoredId = ins.院友id;
    await sb.rpc('recycle_permanent_delete', { p_recycle_id: b.id });
    console.log(`（recycle_restore 撞pk，改人手還原）${e.中文姓名}`);
  }
  const { data: row } = await sb.from('院友主表').select('station_id,bed_id').eq('院友id', restoredId).single();
  const { error } = await sb.from('院友主表').update({
    ...buildPatch(e, true),
    last_station_id: row?.station_id ?? null, last_bed_id: row?.bed_id ?? null,
    station_id: null, bed_id: null,
  }).eq('院友id', restoredId);
  if (error) { fail++; failList.push({ e, error: error.message }); console.error('更新失敗', e.中文姓名, error.message); continue; }
  await freeBedIfOrphan(row?.bed_id);
  ok++;
  console.log(`回收筒還原+改退住：${e.中文姓名} ${e.idFmt}`);
}

// 4) 全新插入
for (const e of planInsert) {
  const { data, error } = await sb.from('院友主表')
    .insert({
      中文姓名: e.中文姓名 || '',
      床號: '',
      ...buildPatch(e),
      facility_id: 1,
      首次記錄日期: new Date().toISOString().slice(0, 10),
    })
    .select('院友id')
    .single();
  if (error) { fail++; failList.push({ e, error: error.message }); console.error('插入失敗', e.中文姓名 || e.enFull, error.message); continue; }
  ok++;
  console.log(`新增退住院友：${e.中文姓名 || e.enFull} ${e.idFmt}（院友id=${data.院友id}）`);
}

console.log(`\nDONE：成功=${ok} 失敗=${fail}`);
if (failList.length) fs.writeFileSync('.tmp/discharge_import_failures.json', JSON.stringify(failList, null, 1));
