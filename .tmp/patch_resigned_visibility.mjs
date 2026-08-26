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

// ---------- 1. RosterManagement.tsx：查詢包含已離職員工 + 卡片按週過濾 ----------
patch('apps/web/src/pages/RosterManagement.tsx', [
  [
    `        .select('*')\n        .eq('is_active', true)\n        .order('name_zh', { ascending: true });`,
    `        .select('*')\n        .or('is_active.eq.true,resignation_date.not.is.null')\n        .order('name_zh', { ascending: true });`,
    'query includes resigned users',
  ],
  [
    `  const filteredEmployeeCards = useMemo(() => {\n    let list = users;`,
    `  const filteredEmployeeCards = useMemo(() => {\n    // 已離職員工只在仍受僱的週顯示\n    const { start: cardWeekStart } = getWeekRange(weekAnchor);\n    const cardWeekStartStr = formatDate(cardWeekStart.getFullYear(), cardWeekStart.getMonth() + 1, cardWeekStart.getDate());\n    let list = users.filter((u) => u.resignation_date == null || u.resignation_date > cardWeekStartStr);`,
    'cards filter resigned by week',
  ],
  [
    `  }, [users, deferredSearch, filterPosition, sortBy, employmentMap]);`,
    `  }, [users, deferredSearch, filterPosition, sortBy, employmentMap, weekAnchor]);`,
    'cards memo deps',
  ],
]);

// ---------- 2. RosterScheduleView.tsx：預排表顯示離職員工在職月份 + hover 多出/不足 ----------
patch('apps/web/src/components/RosterScheduleView.tsx', [
  [
    `  const visibleUsers = useMemo(() => {\n    const base = !isAdmin\n      ? users.filter((u) => u.id === currentUserId)\n      : !positionFilter\n        ? users\n        : users.filter((u) => userMatchesPositionFilter(u, positionFilter));`,
    `  const visibleUsers = useMemo(() => {\n    // 已離職員工只在仍受僱的月份顯示（保留離職日前的預排記錄可見）\n    const monthStart = formatDate(year, month, 1);\n    const employedInMonth = (u: UserProfile) => u.resignation_date == null || u.resignation_date > monthStart;\n    const base = (!isAdmin\n      ? users.filter((u) => u.id === currentUserId)\n      : !positionFilter\n        ? users\n        : users.filter((u) => userMatchesPositionFilter(u, positionFilter))\n    ).filter(employedInMonth);`,
    'visibleUsers keep resigned in employed months',
  ],
  [
    `  }, [users, isAdmin, currentUserId, positionFilter]);`,
    `  }, [users, isAdmin, currentUserId, positionFilter, year, month]);`,
    'visibleUsers memo deps',
  ],
  [
    `  if (hasContractHours) {\n    const hoursIcon = row.hoursOk ? '✓' : '⚠';\n    const hoursSuffix = row.hoursOk ? '' : ' 工時不足';\n    parts.push(\`工時：\${hoursIcon} \${row.actualHours.toFixed(1)}/\${row.requiredHours.toFixed(1)} hr\${hoursSuffix}\`);\n  }`,
    `  if (hasContractHours) {\n    const hoursIcon = row.hoursOk ? '✓' : '⚠';\n    const hoursDiff = row.actualHours - row.requiredHours;\n    const hoursSuffix = row.hoursOk ? \` 多出 \${hoursDiff.toFixed(1)} hr\` : \` 不足 \${(-hoursDiff).toFixed(1)} hr\`;\n    parts.push(\`工時：\${hoursIcon} \${row.actualHours.toFixed(1)}/\${row.requiredHours.toFixed(1)} hr\${hoursSuffix}\`);\n  }`,
    'tooltip surplus/deficit',
  ],
  [
    `                              <CheckCircle2 className="h-3.5 w-3.5 text-green-500 inline" />`,
    `                              <span title={buildComplianceTooltip(row, hasContractHours)} className="inline-block">\n                                <CheckCircle2 className="h-3.5 w-3.5 text-green-500 inline" />\n                              </span>`,
    'tooltip on satisfied icon',
  ],
]);

if (failures > 0) {
  console.error(`\n${failures} anchor(s) missed`);
  process.exit(1);
}
console.log('\nAll patches applied.');
