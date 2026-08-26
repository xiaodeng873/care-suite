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
  const users = await q(`SELECT p.id, p.name_zh, p.nursing_position, p.hire_date, p.resignation_date, p.secondary_positions FROM user_profiles p WHERE p.nursing_position IS NOT NULL OR p.hire_date IS NOT NULL`);
  const leaves = await q(`SELECT l.user_id, l.leave_type, l.record_type FROM user_leave_records l WHERE l.leave_date='${date}'`);
  const assignments = await q(`SELECT a.user_id, a.position, a.shift_name, a.start_time, a.end_time FROM user_shift_assignments a WHERE a.work_date='${date}'`);
  const details = await q(`SELECT user_id, daily_contract_hours, weekly_work_days, public_holiday_type FROM user_employment_details`);
  const detailMap = Object.fromEntries((details || []).map((d) => [d.user_id, d]));

  // Use tsx to call TS function
  const cp = require('child_process');
  const data = { date, users, leaves, assignments, detailMap };
  fs.writeFileSync('.tmp/compliance_input.json', JSON.stringify(data));
  const out = cp.execSync('npx tsx .tmp/run_compliance.ts', { cwd: 'apps/web', encoding: 'utf8' });
  console.log(out);
})();
