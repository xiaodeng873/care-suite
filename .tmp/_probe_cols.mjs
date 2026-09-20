const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = new URL(process.env.VITE_SUPABASE_URL).hostname.split('.')[0];
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: "SELECT column_name, data_type, udt_name FROM information_schema.columns WHERE table_name = '院友主表' AND column_name IN ('藥物敏感','不良藥物反應')" }),
});
console.log(res.status, JSON.stringify(await res.json(), null, 2));
