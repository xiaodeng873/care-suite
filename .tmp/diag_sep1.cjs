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
  const users = await q(`SELECT p.id, p.name_zh, p.department, p.nursing_position, p.hire_date, p.resignation_date, p.is_active, e.daily_contract_hours, e.weekly_work_days FROM user_profiles p LEFT JOIN user_employment_details e ON e.user_id=p.id WHERE p.nursing_position IS NOT NULL ORDER BY p.nursing_position, p.name_zh`);
  const leaves = await q(`SELECT l.user_id, l.leave_type, u.name_zh FROM user_leave_records l JOIN user_profiles u ON u.id=l.user_id WHERE l.leave_date='${date}' AND l.record_type='leave'`);
  const assignments = await q(`SELECT a.user_id, a.position, a.shift_name, a.start_time, a.end_time, u.name_zh FROM user_shift_assignments a JOIN user_profiles u ON u.id=a.user_id WHERE a.work_date='${date}' ORDER BY a.start_time`);
  console.log('USERS', JSON.stringify(users, null, 2));
  console.log('LEAVES', JSON.stringify(leaves, null, 2));
  console.log('ASSIGNMENTS', JSON.stringify(assignments, null, 2));
})();
