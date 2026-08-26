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
  const users = await q(`SELECT p.id, p.name_zh, p.nursing_position, p.hire_date, p.resignation_date, p.is_active, e.daily_contract_hours, e.weekly_work_days, e.public_holiday_type FROM user_profiles p LEFT JOIN user_employment_details e ON e.user_id=p.id WHERE p.nursing_position IS NOT NULL ORDER BY p.nursing_position, p.name_zh`);
  const leaves = await q(`SELECT l.user_id, l.leave_type, u.name_zh, u.nursing_position FROM user_leave_records l JOIN user_profiles u ON u.id=l.user_id WHERE l.leave_date='${date}' AND l.record_type='leave'`);
  const assignments = await q(`SELECT a.user_id, a.position, a.shift_name, a.start_time, a.end_time, u.name_zh, u.nursing_position FROM user_shift_assignments a JOIN user_profiles u ON u.id=a.user_id WHERE a.work_date='${date}' ORDER BY a.start_time`);

  const rn = users.filter((u) => u.nursing_position === '註冊護士');
  const en = users.filter((u) => u.nursing_position === '登記護士');
  const leavesById = new Map();
  for (const l of leaves) leavesById.set(l.user_id, l);
  const assignById = new Map();
  for (const a of assignments) assignById.set(a.user_id, a);

  console.log('=== 註冊護士 (' + rn.length + ') ===');
  for (const u of rn) {
    const leave = leavesById.get(u.id);
    const asgn = assignById.get(u.id);
    console.log(u.name_zh, 'active=', u.is_active, 'hire=', u.hire_date, 'resign=', u.resignation_date, 'daily=', u.daily_contract_hours, 'leave=', leave?.leave_type || '-', 'assigned=', asgn ? asgn.shift_name + ' ' + asgn.start_time + '-' + asgn.end_time : '-');
  }
  console.log('=== 登記護士 (' + en.length + ') ===');
  for (const u of en) {
    const leave = leavesById.get(u.id);
    const asgn = assignById.get(u.id);
    console.log(u.name_zh, 'active=', u.is_active, 'hire=', u.hire_date, 'resign=', u.resignation_date, 'daily=', u.daily_contract_hours, 'leave=', leave?.leave_type || '-', 'assigned=', asgn ? asgn.shift_name + ' ' + asgn.start_time + '-' + asgn.end_time : '-');
  }
  console.log('=== 總結 ===');
  console.log('註冊護士總數:', rn.length, '當日放假:', rn.filter((u) => leavesById.has(u.id)).length, '當日已排班:', rn.filter((u) => assignById.has(u.id)).length);
  console.log('登記護士總數:', en.length, '當日放假:', en.filter((u) => leavesById.has(u.id)).length, '當日已排班:', en.filter((u) => assignById.has(u.id)).length);
  console.log('本日班次數:', assignments.length);
})();
