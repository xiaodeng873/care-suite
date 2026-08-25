import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', env.SUPABASE_SERVICE_ROLE_KEY);

// 姓氏李 + 名字含 玉
const { data: p1, error: e1 } = await supabase
  .from('院友主表')
  .select('院友id, 床號, 中文姓氏, 中文名字, 中文姓名, 在住狀態')
  .eq('中文姓氏', '李');
console.log('姓李院友:', e1 || p1);

// 全文搜 玉蟬 / 玉嬋
const { data: p2 } = await supabase
  .from('院友主表')
  .select('院友id, 床號, 中文姓氏, 中文名字, 中文姓名, 在住狀態')
  .or('中文名字.ilike.%玉%,中文姓名.ilike.%玉%');
console.log('名含玉:', p2);
