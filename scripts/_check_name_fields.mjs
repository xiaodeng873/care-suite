// 診斷：院友主表嘅 中文姓氏/中文名字 欄位係咪真有值
// 用法：喺有 SUPABASE_SERVICE_ROLE_KEY 嘅 terminal 度跑
//   node scripts/_check_name_fields.mjs
import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: rows, error } = await supabase
  .from('院友主表')
  .select('院友id,床號,中文姓名,中文姓氏,中文名字')
  .eq('在住狀態', '在住');
if (error) { console.error('查詢失敗:', error.message); process.exit(1); }

let empty = 0;
for (const p of rows || []) {
  const s = p.中文姓氏 ?? '(null)';
  const g = p.中文名字 ?? '(null)';
  if (!p.中文姓氏 && !p.中文名字) empty++;
  console.log(`${p.床號 ?? '?'}  中文姓名=[${p.中文姓名 ?? '(null)'}]  中文姓氏=[${s}]  中文名字=[${g}]`);
}
console.log(`---\n在住共 ${rows?.length ?? 0} 人，其中 中文姓氏同中文名字都係空 嘅有 ${empty} 人`);
