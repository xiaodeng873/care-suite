import fs from 'fs';
const f = 'apps/web/src/utils/medicationSettings.ts';
let s = fs.readFileSync(f, 'utf8');
let n = 0;

let oldStr = "import { DEFAULT_FACILITY_SETTINGS } from './facilitySettings';";
let newStr = "import { DEFAULT_FACILITY_SETTINGS, getCurrentFacilityId } from './facilitySettings';";
if (!s.includes(oldStr)) throw new Error('import not found');
s = s.replace(oldStr, newStr); n++;

s = s.replaceAll("localStorage.getItem(STORAGE_KEY)", "localStorage.getItem(storageKey())"); n++;
s = s.replaceAll("localStorage.setItem(STORAGE_KEY,", "localStorage.setItem(storageKey(),"); n++;
s = s.replace("localStorage.removeItem(STORAGE_KEY)", "localStorage.removeItem(storageKey())"); n++;

oldStr = [
"    const { data, error } = await supabase",
"      .from('facility_settings')",
"      .select('medication_settings')",
"      .eq('id', 1)",
"      .maybeSingle();",
].join('\r\n');
newStr = [
"    const facilityId = getCurrentFacilityId();",
"    let q = supabase",
"      .from('facility_settings')",
"      .select('medication_settings');",
"    q = facilityId != null ? q.eq('facility_id', facilityId) : q.eq('id', 1);",
"    const { data, error } = await q.maybeSingle();",
].join('\r\n');
if (!s.includes(oldStr)) throw new Error('read not found');
s = s.replace(oldStr, newStr); n++;

oldStr = [
"  const { data: updated, error: updateError } = await supabase",
"    .from('facility_settings')",
"    .update({ medication_settings: settings, updated_at: now })",
"    .eq('id', 1)",
"    .select();",
].join('\r\n');
newStr = [
"  const facilityId = getCurrentFacilityId();",
"  let upd = supabase",
"    .from('facility_settings')",
"    .update({ medication_settings: settings, updated_at: now });",
"  upd = facilityId != null ? upd.eq('facility_id', facilityId) : upd.eq('id', 1);",
"  const { data: updated, error: updateError } = await upd.select();",
].join('\r\n');
if (!s.includes(oldStr)) throw new Error('update not found');
s = s.replace(oldStr, newStr); n++;

oldStr = [
"  // 2. 沒有 id=1 的列，才插入新列（帶上所有 NOT NULL 預設值）",
"  const { data: inserted, error: insertError } = await supabase",
"    .from('facility_settings')",
"    .insert({",
"      id: 1,",
].join('\r\n');
newStr = [
"  // 2. 沒有該院舍的列，才插入新列（帶上所有 NOT NULL 預設值；不寫死 id）",
"  const { data: inserted, error: insertError } = await supabase",
"    .from('facility_settings')",
"    .insert({",
"      ...(facilityId != null ? { facility_id: facilityId } : { id: 1 }),",
].join('\r\n');
if (!s.includes(oldStr)) throw new Error('insert not found');
s = s.replace(oldStr, newStr); n++;

fs.writeFileSync(f, s);
console.log('patched', n, 'spots');
