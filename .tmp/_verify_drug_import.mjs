const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = new URL(process.env.VITE_SUPABASE_URL).hostname.split('.')[0];
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: "SELECT \"中文姓名\",\"藥物敏感\",\"不良藥物反應\" FROM \"院友主表\" WHERE \"院友id\" IN (11,168,658,660,92,709,647,695)" }),
});
for (const r of await res.json()) console.log(r.中文姓名, '| 敏感:', JSON.stringify(r.藥物敏感), '| 不良:', JSON.stringify(r.不良藥物反應));
