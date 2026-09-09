import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMjM4NjEsImV4cCI6MjA2NzU5OTg2MX0.Uo4fgr2XdUxWY5LZ5Q7A0j6XoCyuUsHhb4WO-eabJWk', { auth: { autoRefreshToken: false, persistSession: false } });
const { data, error } = await supabase.from('院友主表').select('床號,中文姓名,中文姓氏,中文名字,在住狀態').eq('在住狀態','在住');
if (error) { console.log('ERROR:', error.code, error.message); process.exit(0); }
console.log('rows:', data?.length ?? 0);
let empty = 0;
for (const p of (data ?? []).slice(0, 30)) {
  if (!p.中文姓氏 && !p.中文名字) empty++;
  console.log(`${p.床號 ?? '?'} [${p.中文姓名 ?? 'null'}] 姓=[${p.中文姓氏 ?? 'null'}] 名=[${p.中文名字 ?? 'null'}]`);
}
const totalEmpty = (data ?? []).filter(p => !p.中文姓氏 && !p.中文名字).length;
console.log(`empty split-name rows: ${totalEmpty}/${data?.length ?? 0}`);
