import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
// 用 anon key 模擬前端 insert/delete，驗證 RLS 已放行
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', env.VITE_SUPABASE_ANON_KEY);

const { data, error } = await supabase
  .from('diaper_usage_records')
  .insert([{ patient_id: 538, year: 1900, month: 1, generated_data: {} }])
  .select()
  .single();
if (error) { console.error('❌ anon insert 失敗:', error.message); process.exit(1); }
console.log('✅ anon insert 成功, id =', data.id);

const { error: e2 } = await supabase.from('diaper_usage_records').delete().eq('id', data.id);
console.log(e2 ? `❌ anon delete 失敗: ${e2.message}` : '✅ anon delete 成功（測試列已清除）');
