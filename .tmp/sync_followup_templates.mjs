// 一次性：將開發者嘅覆診 WhatsApp 模板抄齊到所有 user_profiles
// 用戶之後可以自行改（設定介面照舊讀寫自己嗰份）
import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const templates = JSON.parse(readFileSync(new URL('./followup_dev_templates.json', import.meta.url), 'utf8'));

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const { data: profiles, error } = await supabase
  .from('user_profiles')
  .select('id, name_zh, role, followup_message_templates');
if (error) { console.error('select failed:', error.message); process.exit(1); }

console.log('total user_profiles:', profiles.length);
const dry = process.argv.includes('--dry');
let updated = 0, skipped = 0;
for (const p of profiles) {
  const same = JSON.stringify(p.followup_message_templates ?? null) === JSON.stringify(templates);
  if (same) { skipped++; continue; }
  console.log(`${dry ? '[dry] ' : ''}sync ${p.name_zh ?? p.id} (${p.role ?? 'no-role'})`);
  if (!dry) {
    const { error: upErr } = await supabase
      .from('user_profiles')
      .update({ followup_message_templates: templates })
      .eq('id', p.id);
    if (upErr) { console.error('  update failed:', upErr.message); process.exit(1); }
  }
  updated++;
}
console.log(`${dry ? 'dry run — ' : ''}updated: ${updated}, already-same: ${skipped}`);
