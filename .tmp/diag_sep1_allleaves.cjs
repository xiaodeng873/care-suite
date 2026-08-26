const fs = require('fs');
const env = fs.readFileSync('.env', 'utf8');
const token = (env.match(/SUPABASE_ACCESS_TOKEN=(.+)/) || [])[1]?.trim();
const q = (sql) =>
  fetch('https://api.supabase.com/v1/projects/mzeptzwuqvpjspxgnzkp/database/query', {
    method: 'POST',
    headers: { Authorization: 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify({ query: sql }),
  }).then((r) => r.json());

(async () => {
  const date = '2026-09-01';
  const leaves = await q(`SELECT l.user_id, l.leave_type, l.record_type, l.urgency, u.name_zh, u.nursing_position FROM user_leave_records l JOIN user_profiles u ON u.id=l.user_id WHERE l.leave_date='${date}' ORDER BY u.nursing_position, u.name_zh`);
  console.log(JSON.stringify(leaves, null, 2));
})();
