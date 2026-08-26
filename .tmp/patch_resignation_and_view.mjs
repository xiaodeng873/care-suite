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

// ---------- 1. EmploymentDetailsSection.tsx ----------
patch('apps/web/src/components/EmploymentDetailsSection.tsx', [
  [
    `  const [publicHolidayStartDate, setPublicHolidayStartDate] = useState(user.hire_date || '');\n`,
    `  const [publicHolidayStartDate, setPublicHolidayStartDate] = useState(user.hire_date || '');\n  const [resignationDate, setResignationDate] = useState('');\n`,
    'state: resignationDate',
  ],
  [
    `        { data: phRows, error: e7 },\n      ] = await Promise.all([`,
    `        { data: phRows, error: e7 },\n        { data: profileRow, error: e9 },\n      ] = await Promise.all([`,
    'loadData destructure',
  ],
  [
    `          .order('record_date', { ascending: true })\n          .order('created_at', { ascending: true }),\n      ]);`,
    `          .order('record_date', { ascending: true })\n          .order('created_at', { ascending: true }),\n        supabase.from('user_profiles').select('resignation_date').eq('id', user.id).maybeSingle(),\n      ]);`,
    'loadData query',
  ],
  [
    `      if (e7) {\n        console.error('載入公眾假期明細失敗:', e7);\n        errors.push(\`公眾假期：\${e7.message}\`);\n      }\n`,
    `      if (e7) {\n        console.error('載入公眾假期明細失敗:', e7);\n        errors.push(\`公眾假期：\${e7.message}\`);\n      }\n      if (e9) {\n        console.error('載入離職日期失敗:', e9);\n        errors.push(\`離職日期：\${e9.message}\`);\n      }\n      setResignationDate(profileRow?.resignation_date ?? '');\n`,
    'loadData error handling',
  ],
  [
    `        { onConflict: 'user_id' },\n      );\n      if (error) throw error;\n    } catch (err) {`,
    `        { onConflict: 'user_id' },\n      );\n      if (error) throw error;\n\n      // 離職日期：寫回 user_profiles；設定離職日期時帳戶自動停用\n      const { error: resignError } = await supabase\n        .from('user_profiles')\n        .update({\n          resignation_date: resignationDate || null,\n          ...(resignationDate ? { is_active: false } : {}),\n          updated_at: new Date().toISOString(),\n        })\n        .eq('id', user.id);\n      if (resignError) throw resignError;\n    } catch (err) {`,
    'handleSave update user_profiles',
  ],
  [
    `              {/* 1. 工作時間 */}`,
    `              {/* 0. 僱傭狀態 */}\n              <div>\n                <h4 className="text-sm font-semibold text-gray-900 mb-2">僱傭狀態</h4>\n                <div className="grid grid-cols-2 gap-3">\n                  <div>\n                    <label className="block text-xs text-gray-600 mb-1">入職日期</label>\n                    <input\n                      type="date"\n                      value={user.hire_date ?? ''}\n                      disabled\n                      readOnly\n                      className={\`\${inputClass} bg-gray-100\`}\n                    />\n                  </div>\n                  <div>\n                    <label className="block text-xs text-gray-600 mb-1">離職日期</label>\n                    <input\n                      type="date"\n                      value={resignationDate}\n                      onChange={(e) => setResignationDate(e.target.value)}\n                      className={inputClass}\n                    />\n                  </div>\n                </div>\n                <p className="text-xs text-gray-500 mt-1">設定離職日期後帳戶自動停用；當日起排班表及預排表均不可再插入。</p>\n              </div>\n\n              {/* 1. 工作時間 */}`,
    'UI section',
  ],
]);

// ---------- 2. autoRoster.ts ----------
patch('apps/web/src/utils/autoRoster.ts', [
  [
    `    date,\n    position,\n    users,\n`,
    `    date,\n    position,\n    users: allUsers,\n`,
    'destructure rename',
  ],
  [
    `  } = input;\n  const ignorePref = principles?.ignoreStationPreference === true;`,
    `  } = input;\n  // 離職日期當日起不再參與自動排班\n  const users = allUsers.filter((u) => !u.resignation_date || u.resignation_date > date);\n  const ignorePref = principles?.ignoreStationPreference === true;`,
    'filter resigned users',
  ],
]);

// ---------- 3. RosterScheduleGrid.tsx ----------
patch('apps/web/src/components/RosterScheduleGrid.tsx', [
  [
    `    } else {\n      return;\n    }\n\n    // 行政表主管單日限制`,
    `    } else {\n      return;\n    }\n\n    // 離職日期當日起不可插入排班\n    if (sourceUser?.resignation_date && sourceUser.resignation_date <= date) {\n      alert(\`\${sourceUser.name} 的離職日期為 \${sourceUser.resignation_date}，該日起不可插入排班\`);\n      return;\n    }\n\n    // 行政表主管單日限制`,
    'processDrop guard',
  ],
  [
    `    const { payload, conflict } = pendingRosterInsert;\n    setPendingRosterInsert(null);`,
    `    const { payload, conflict } = pendingRosterInsert;\n    // 離職日期當日起不可插入排班\n    const resignUser = users.find((u) => u.id === payload.user_id);\n    if (\n      resignUser?.resignation_date &&\n      typeof payload.work_date === 'string' &&\n      resignUser.resignation_date <= payload.work_date\n    ) {\n      setPendingRosterInsert(null);\n      alert(\`\${resignUser.name} 的離職日期為 \${resignUser.resignation_date}，該日起不可插入排班\`);\n      return;\n    }\n    setPendingRosterInsert(null);`,
    'confirmInsertAssignment guard',
  ],
]);

// ---------- 4. RosterManagement.tsx ----------
patch('apps/web/src/pages/RosterManagement.tsx', [
  [
    `    if (exists) {\n      alert('目標日期已有預排記錄');\n      return;\n    }\n    try {`,
    `    if (exists) {\n      alert('目標日期已有預排記錄');\n      return;\n    }\n    // 離職日期當日起不可再輸入預排事件\n    const moveUser = users.find((u) => u.id === record.user_id);\n    if (moveUser?.resignation_date && moveUser.resignation_date <= targetDate) {\n      alert(\`\${moveUser.name} 的離職日期為 \${moveUser.resignation_date}，該日起不可再輸入預排事件\`);\n      return;\n    }\n    try {`,
    'handleMoveLeave guard',
  ],
  [
    `    if (!leaveModal) return;\n    const userId = leaveModal.user.id;\n`,
    `    if (!leaveModal) return;\n    const userId = leaveModal.user.id;\n\n    // 離職日期當日起不可再輸入預排事件\n    if (leaveModal.user.resignation_date && leaveModal.user.resignation_date <= payload.leaveDate) {\n      alert(\`\${leaveModal.user.name} 的離職日期為 \${leaveModal.user.resignation_date}，該日起不可再輸入預排事件\`);\n      return;\n    }\n`,
    'executeSaveLeave guard',
  ],
]);

// ---------- 5. RosterScheduleView.tsx ----------
patch('apps/web/src/components/RosterScheduleView.tsx', [
  [
    `import { AlertCircle, ArrowUp, ArrowDown, CheckCircle2 } from 'lucide-react';`,
    `import { AlertCircle, CheckCircle2 } from 'lucide-react';`,
    'import cleanup',
  ],
  [
    `  const handleMoveStation = (index: number, direction: -1 | 1) => {\n    const next = [...stationPriority];\n    const target = index + direction;\n    if (target < 0 || target >= next.length) return;\n    [next[index], next[target]] = [next[target], next[index]];\n    onStationPriorityChange(next);\n  };\n\n`,
    ``,
    'remove handleMoveStation',
  ],
  [
    `          <div className="flex items-center gap-2">\n            <label className="text-sm font-medium text-gray-700">居住區優先順序</label>\n            <div className="flex items-center gap-1">\n              {stationPriority.map((id, index) => (\n                <div key={id ?? 'unassigned'} className="flex items-center gap-0.5 bg-gray-100 rounded-lg px-2 py-1">\n                  <span className="text-xs text-gray-700">{stationName(id)}</span>\n                  <div className="flex flex-col ml-1">\n                    <button\n                      type="button"\n                      onClick={() => handleMoveStation(index, -1)}\n                      disabled={index === 0}\n                      className="text-gray-400 hover:text-gray-700 disabled:opacity-30"\n                      title="上移"\n                    >\n                      <ArrowUp className="h-3 w-3" />\n                    </button>\n                    <button\n                      type="button"\n                      onClick={() => handleMoveStation(index, 1)}\n                      disabled={index === stationPriority.length - 1}\n                      className="text-gray-400 hover:text-gray-700 disabled:opacity-30"\n                      title="下移"\n                    >\n                      <ArrowDown className="h-3 w-3" />\n                    </button>\n                  </div>\n                </div>\n              ))}\n            </div>\n          </div>\n\n          {onCheckConflicts && (\n            <button\n              type="button"\n              onClick={onCheckConflicts}\n              className="text-sm px-3 py-1.5 bg-amber-50 text-amber-700 border border-amber-200 rounded-lg hover:bg-amber-100"\n            >\n              檢查衝突\n            </button>\n          )}\n`,
    ``,
    'remove priority + conflict buttons',
  ],
  [
    `<table className="min-w-full text-xs table-fixed">`,
    `<table className="text-xs table-fixed" style={{ width: (16 + daysInMonth * 4.5) + 'rem' }}>`,
    'table width fix',
    true,
  ],
]);

if (failures > 0) {
  console.error(`\n${failures} anchor(s) missed — NOT writing? (already written; check MISS lines)`);
  process.exit(1);
}
console.log('\nAll patches applied.');
