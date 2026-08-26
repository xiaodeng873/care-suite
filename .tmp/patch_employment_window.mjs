import fs from 'fs';

let failures = 0;

function patch(path, edits) {
  let text = fs.readFileSync(path, 'utf8');
  for (const [oldS, newS, name, all] of edits) {
    const variants = [[oldS, newS], [oldS.replace(/\n/g, '\r\n'), newS.replace(/\n/g, '\r\n')]];
    let done = false;
    for (const [o, n] of variants) {
      if (text.includes(o)) {
        text = all ? text.split(o).join(n) : text.replace(o, n);
        done = true;
        break;
      }
    }
    if (done) console.log(`OK  ${path} :: ${name}`);
    else { console.error(`MISS ${path} :: ${name}`); failures++; }
  }
  fs.writeFileSync(path, text);
}

// ---------- 1. RosterScheduleView.tsx ----------
patch('apps/web/src/components/RosterScheduleView.tsx', [
  [
    `<table className="text-xs table-fixed" style={{ width: (16 + daysInMonth * 4.5) + 'rem' }}>`,
    `<table className="min-w-full text-xs table-fixed">`,
    'revert table width',
    true,
  ],
  [
    `import { getRosterUserBalance, getRosterGroupOptions, buildDailyCompliance, buildPreScheduleDailyCompliance, formatShiftTimeAbbreviation, getShiftEndTime, getAssignmentPositionForTable, toGridPosition } from '../utils/roster';`,
    `import { getRosterUserBalance, getRosterGroupOptions, buildDailyCompliance, buildPreScheduleDailyCompliance, formatShiftTimeAbbreviation, getShiftEndTime, getAssignmentPositionForTable, toGridPosition, isUserEmployedOnDate } from '../utils/roster';`,
    'import isUserEmployedOnDate',
  ],
  [
    `                    const isDropTarget = draggedRecord && !record && draggedRecord.user_id === user.id && draggedRecord.leave_date !== dateStr;`,
    `                    const employedOnDate = isUserEmployedOnDate(user, dateStr);\n                    const isDropTarget = employedOnDate && draggedRecord && !record && draggedRecord.user_id === user.id && draggedRecord.leave_date !== dateStr;`,
    'cell employedOnDate + drop target',
  ],
  [
    `                        ) : (\n                          <button\n                            type="button"\n                            onClick={() => canEdit && onCellClick(user, dateStr)}`,
    `                        ) : employedOnDate ? (\n                          <button\n                            type="button"\n                            onClick={() => canEdit && onCellClick(user, dateStr)}`,
    'cell hide input button outside employment',
  ],
  [
    `                          />\n                        )}`,
    `                          />\n                        ) : null}`,
    'cell ternary else null',
  ],
]);

// ---------- 2. roster.ts ----------
patch('apps/web/src/utils/roster.ts', [
  [
    `export function buildPreScheduleDailyCompliance(`,
    `/** 該日是否在僱傭期內（入職日當日起、離職日前一日為止） */\nexport function isUserEmployedOnDate(user: UserProfile, date: string): boolean {\n  if (user.hire_date && date < user.hire_date) return false;\n  if (user.resignation_date && date >= user.resignation_date) return false;\n  return true;\n}\n\nexport function buildPreScheduleDailyCompliance(`,
    'add isUserEmployedOnDate helper',
  ],
  [
    `  const dayRecords = getDayRecordsMap(leaveRecords);\n  const availableHours: Record<string, number> = {};`,
    `  const dayRecords = getDayRecordsMap(leaveRecords);\n  // 入職日前、離職日當日起的員工不計入侯召\n  const employedUsers = users.filter((u) => isUserEmployedOnDate(u, date));\n  const availableHours: Record<string, number> = {};`,
    'filter employed users',
  ],
  [
    `    for (const u of users) {`,
    `    for (const u of employedUsers) {`,
    'available hours loop uses employedUsers',
  ],
  [
    `  const specificSlot = buildPreScheduleSpecificSlotCompliance(\n    date,\n    requiredHourly,\n    specific,\n    users,\n    employmentDetails,\n    leaveRecords,\n  );`,
    `  const specificSlot = buildPreScheduleSpecificSlotCompliance(\n    date,\n    requiredHourly,\n    specific,\n    employedUsers,\n    employmentDetails,\n    leaveRecords,\n  );`,
    'specific slot uses employedUsers',
  ],
]);

// ---------- 3. EmploymentDetailsSection.tsx ----------
patch('apps/web/src/components/EmploymentDetailsSection.tsx', [
  [
    `                    <input\n                      type="date"\n                      value={resignationDate}\n                      onChange={(e) => setResignationDate(e.target.value)}\n                      className={inputClass}\n                    />`,
    `                    <DateInput\n                      value={resignationDate}\n                      onChange={setResignationDate}\n                      className={inputClass}\n                    />`,
    'resignation date DD/MM/YYYY input',
  ],
]);

// ---------- 4. RosterManagement.tsx ----------
patch('apps/web/src/pages/RosterManagement.tsx', [
  [
    `    // 離職日期當日起不可再輸入預排事件\n    const moveUser = users.find((u) => u.id === record.user_id);\n    if (moveUser?.resignation_date && moveUser.resignation_date <= targetDate) {\n      alert(\`\${moveUser.name_zh} 的離職日期為 \${moveUser.resignation_date}，該日起不可再輸入預排事件\`);\n      return;\n    }\n`,
    `    // 離職日期當日起、入職日期前均不可再輸入預排事件\n    const moveUser = users.find((u) => u.id === record.user_id);\n    if (moveUser?.resignation_date && moveUser.resignation_date <= targetDate) {\n      alert(\`\${moveUser.name_zh} 的離職日期為 \${moveUser.resignation_date}，該日起不可再輸入預排事件\`);\n      return;\n    }\n    if (moveUser?.hire_date && targetDate < moveUser.hire_date) {\n      alert(\`\${moveUser.name_zh} 的入職日期為 \${moveUser.hire_date}，該日前不可輸入預排事件\`);\n      return;\n    }\n`,
    'handleMoveLeave hire guard',
  ],
  [
    `    // 離職日期當日起不可再輸入預排事件\n    if (leaveModal.user.resignation_date && leaveModal.user.resignation_date <= payload.leaveDate) {\n      alert(\`\${leaveModal.user.name_zh} 的離職日期為 \${leaveModal.user.resignation_date}，該日起不可再輸入預排事件\`);\n      return;\n    }\n`,
    `    // 離職日期當日起、入職日期前均不可再輸入預排事件\n    if (leaveModal.user.resignation_date && leaveModal.user.resignation_date <= payload.leaveDate) {\n      alert(\`\${leaveModal.user.name_zh} 的離職日期為 \${leaveModal.user.resignation_date}，該日起不可再輸入預排事件\`);\n      return;\n    }\n    if (leaveModal.user.hire_date && payload.leaveDate < leaveModal.user.hire_date) {\n      alert(\`\${leaveModal.user.name_zh} 的入職日期為 \${leaveModal.user.hire_date}，該日前不可輸入預排事件\`);\n      return;\n    }\n`,
    'executeSaveLeave hire guard',
  ],
]);

if (failures > 0) {
  console.error(`\n${failures} anchor(s) missed`);
  process.exit(1);
}
console.log('\nAll patches applied.');
