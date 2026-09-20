const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = new URL(process.env.VITE_SUPABASE_URL).hostname.split('.')[0];
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: `UPDATE "院友主表" SET "藥物敏感" = '["Timolol","Betagan","Betoptic S","ALPHAGAN P"]'::jsonb WHERE "院友id" = 11 RETURNING "藥物敏感"` }),
});
console.log(JSON.stringify(await res.json()));
