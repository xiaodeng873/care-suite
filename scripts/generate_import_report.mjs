import fs from 'fs';

const log = JSON.parse(fs.readFileSync('./scripts/import_regime_csv.log.json', 'utf8'));
const newDrugs = [...new Map(log.createdDrugDetails.map(d => [d.name, d])).values()]
  .sort((a, b) => a.name.localeCompare(b.name, 'zh-Hant'));
const missing = log.errors.filter(e => e.reason === '找不到院友');
const missingByName = missing.reduce((acc, e) => {
  (acc[e.name] = acc[e.name] || []).push(e.row);
  return acc;
}, {});

const lines = [];
lines.push('# CSV 匯入 DRY-RUN 詳細報告');
lines.push('');
lines.push('## 統計');
lines.push(`- CSV 總列數：${log.csvRows}`);
lines.push(`- 預計成功匯入處方：${log.prescriptions}`);
lines.push(`- 跳過列數：${log.errors.length}`);
lines.push(`- 找不到院友的列數：${missing.length}`);
lines.push(`- 預計新增藥物種類：${newDrugs.length}`);
lines.push('');
lines.push(`## 找不到院友（共 ${missing.length} 列 / ${Object.keys(missingByName).length} 位）`);
for (const [name, rows] of Object.entries(missingByName)) {
  lines.push(`- **${name}**：出現在 ${rows.length} 列（範例列號：${rows.slice(0, 5).join(', ')}${rows.length > 5 ? ' ...' : ''}）`);
}
lines.push('');
lines.push(`## 預計新增藥物清單（共 ${newDrugs.length} 種）`);
for (const d of newDrugs) {
  lines.push(`- ${d.name}`);
}
lines.push('');
lines.push('## 未識別的醫院/來源簡稱（將按規則分類或加入「機構_其他」）');
for (const s of log.unknownSources) {
  lines.push(`- ${s}`);
}
lines.push('');
lines.push('## 藥物設定變更摘要');
for (const [k, v] of Object.entries(log.settingsSummary)) {
  lines.push(`- ${k}：${v} 項`);
}

fs.writeFileSync('./scripts/import_regime_csv_report.md', lines.join('\n'));
console.log('report written to scripts/import_regime_csv_report.md');
