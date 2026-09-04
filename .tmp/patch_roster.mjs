import fs from 'fs';
const f = 'apps/web/src/utils/autoRosterPrinciples.ts';
let s = fs.readFileSync(f, 'utf8');
let n = 0;
const eol = s.includes('\r\n') ? '\r\n' : '\n';

let oldStr = [
"export async function loadAutoRosterPrinciples(): Promise<AutoRosterPrinciplesConfig> {",
"  const { data, error } = await supabase",
"    .from('facility_settings')",
"    .select('auto_roster_principles')",
"    .eq('id', 1)",
"    .maybeSingle();",
].join(eol);
let newStr = [
"export async function loadAutoRosterPrinciples(): Promise<AutoRosterPrinciplesConfig> {",
"  const facilityId = getCurrentFacilityId();",
"  let q = supabase",
"    .from('facility_settings')",
"    .select('auto_roster_principles');",
"  q = facilityId != null ? q.eq('facility_id', facilityId) : q.eq('id', 1);",
"  const { data, error } = await q.maybeSingle();",
].join(eol);
if (!s.includes(oldStr)) throw new Error('load not found');
s = s.replace(oldStr, newStr); n++;

oldStr = [
"export async function saveAutoRosterPrinciples(config: AutoRosterPrinciplesConfig): Promise<void> {",
"  const { error } = await supabase",
"    .from('facility_settings')",
"    .update({",
"      auto_roster_principles: config,",
"      updated_at: new Date().toISOString(),",
"    })",
"    .eq('id', 1);",
].join(eol);
newStr = [
"export async function saveAutoRosterPrinciples(config: AutoRosterPrinciplesConfig): Promise<void> {",
"  const facilityId = getCurrentFacilityId();",
"  let q = supabase",
"    .from('facility_settings')",
"    .update({",
"      auto_roster_principles: config,",
"      updated_at: new Date().toISOString(),",
"    });",
"  q = facilityId != null ? q.eq('facility_id', facilityId) : q.eq('id', 1);",
"  const { error } = await q;",
].join(eol);
if (!s.includes(oldStr)) throw new Error('save not found');
s = s.replace(oldStr, newStr); n++;

oldStr = "import { supabase } from '../lib/supabase';";
newStr = "import { supabase } from '../lib/supabase';" + eol + "import { getCurrentFacilityId } from './facilitySettings';";
if (!s.includes(oldStr)) throw new Error('import not found');
s = s.replace(oldStr, newStr); n++;

fs.writeFileSync(f, s);
console.log('patched', n, 'spots');
