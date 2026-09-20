const token = process.env.SUPABASE_ACCESS_TOKEN;
const ref = new URL(process.env.VITE_SUPABASE_URL).hostname.split('.')[0];
const res = await fetch(`https://api.supabase.com/v1/projects/${ref}/database/query`, {
  method: 'POST',
  headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  body: JSON.stringify({ query: "SELECT \"院友id\",\"床號\",\"中文姓名\",\"在住狀態\" FROM \"院友主表\" WHERE \"中文姓名\" LIKE '%何志%' OR \"床號\" LIKE '%221-1%'" }),
});
console.log(JSON.stringify(await res.json(), null, 2));
