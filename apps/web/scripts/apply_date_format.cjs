const fs = require('fs');
const path = require('path');

const root = path.dirname(__dirname); // apps/web
const src = path.join(root, 'src');

const EXCEL_FILES = new Set([
  'bedLayoutExcelGenerator.ts',
  'combinedScheduleExcelGenerator.ts',
  'healthRecordExcelGenerator.ts',
  'medicationRecordExcelGenerator.ts',
  'personalMedicationListExcelGenerator.ts',
  'prescriptionExcelGenerator.ts',
  'printFormExcelGenerator.ts',
  'restraintConsentExcelGenerator.ts',
  'restraintObservationChartExcelGenerator.ts',
  'waitingListExcelGenerator.ts',
]);

const SKIP_FILES = new Set([
  'MonitoringTaskWorksheetModal.tsx', // keeps Chinese date display
  'Reports.tsx',                       // has Chinese date display; handle line 1234 manually
  'HealthAssessment.tsx',              // time-only display
  'HealthRecordModal.tsx',             // internal timezone calc
  'workflowStatusHelper.ts',           // internal timezone calc
  'TemplateManagement.tsx.backup',     // backup file
  'dateFormat.ts',                     // the tool itself
]);

function relativeImport(filePath) {
  const rel = path.relative(src, filePath).replace(/\\/g, '/');
  const depth = rel.split('/').length - 1;
  if (rel.startsWith('utils/')) return "from './dateFormat'";
  const prefix = '../'.repeat(depth);
  return `from '${prefix}utils/dateFormat'`;
}

function addImports(content, filePath, needsDate, needsDateTime) {
  if (!needsDate && !needsDateTime) return content;

  const names = [];
  if (needsDate) names.push('formatDisplayDate');
  if (needsDateTime) names.push('formatDisplayDateTime');

  const existingRe = /import\s*\{[^}]*\bformatDisplayDate\b[^}]*\}\s*from\s*['"][^'"]+dateFormat['"];?/;
  const existingMatch = content.match(existingRe);

  if (existingMatch) {
    const line = existingMatch[0];
    let newLine = line;
    for (const name of names) {
      if (!newLine.includes(name)) {
        newLine = newLine.replace(/\}\s*from/, `, ${name} } from`);
      }
    }
    if (newLine !== line) {
      content = content.replace(line, newLine);
    }
    return content;
  }

  const importBlock = content.match(/^(import\s+.*?;\s*(?:\r?\n))+/m);
  const newImport = `import { ${names.join(', ')} } ${relativeImport(filePath)};\n`;
  if (importBlock) {
    const end = importBlock.index + importBlock[0].length;
    content = content.slice(0, end) + newImport + content.slice(end);
  } else {
    content = newImport + content;
  }
  return content;
}

function transformFile(filePath) {
  const name = path.basename(filePath);
  if (SKIP_FILES.has(name) || EXCEL_FILES.has(name)) return false;

  let content = fs.readFileSync(filePath, { encoding: 'utf8' });
  const original = content;

  let needsDate = false;
  let needsDateTime = false;

  function markDate() { needsDate = true; return 'formatDisplayDate'; }
  function markDateTime() { needsDateTime = true; return 'formatDisplayDateTime'; }

  // new Date(EXPR).toLocaleDateString(locale[, opts])
  content = content.replace(
    /new Date\(([^()]+)\)\.toLocaleDateString\(['"](zh-TW|zh-HK)['"](?:,[^)]*)?\)/g,
    (m, expr) => `${markDate()}(${expr})`
  );

  // new Date().toLocaleDateString(...)
  content = content.replace(
    /new Date\(\)\.toLocaleDateString\(['"](zh-TW|zh-HK)['"](?:,[^)]*)?\)/g,
    () => `${markDate()}(new Date())`
  );

  // identifier.toLocaleDateString(...)
  content = content.replace(
    /(\w+)\.toLocaleDateString\(['"](zh-TW|zh-HK)['"](?:,[^)]*)?\)/g,
    (m, id) => `${markDate()}(${id})`
  );

  // new Date(EXPR).toLocaleString(locale[, opts])
  content = content.replace(
    /new Date\(([^()]+)\)\.toLocaleString\(['"](zh-TW|zh-HK)['"](?:,[^)]*)?\)/g,
    (m, expr) => `${markDateTime()}(${expr})`
  );

  // new Date().toLocaleString(...)
  content = content.replace(
    /new Date\(\)\.toLocaleString\(['"](zh-TW|zh-HK)['"](?:,[^)]*)?\)/g,
    () => `${markDateTime()}(${'new Date()'})`
  );

  // identifier.toLocaleString(...)
  content = content.replace(
    /(\w+)\.toLocaleString\(['"](zh-TW|zh-HK)['"](?:,[^)]*)?\)/g,
    (m, id) => `${markDateTime()}(${id})`
  );

  if (content !== original) {
    content = addImports(content, filePath, needsDate, needsDateTime);
    fs.writeFileSync(filePath, content, { encoding: 'utf8' });
    return true;
  }
  return false;
}

function walk(dir, changed) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      walk(full, changed);
    } else if (entry.isFile() && (full.endsWith('.ts') || full.endsWith('.tsx'))) {
      if (transformFile(full)) {
        changed.push(path.relative(root, full).replace(/\\/g, '/'));
      }
    }
  }
}

const changed = [];
walk(src, changed);
console.log(`Changed ${changed.length} files:`);
for (const c of changed) console.log('  ', c);
