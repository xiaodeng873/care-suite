import * as fs from 'fs';
import * as path from 'path';

const SRC_DIR = 'apps/web/src';
const EXCEL_FILE_PATTERNS = [/Excel/i, /excel/i];

function isExcelFile(filePath: string): boolean {
  return EXCEL_FILE_PATTERNS.some(p => p.test(filePath));
}

function hasImport(content: string, importName: string, modulePath: string): boolean {
  const regex = new RegExp(`import\\s+\\{[^}]*\\b${importName}\\b[^}]*\\}\\s+from\\s+['"]${modulePath.replace(/\//g, '\\/')}['"]`);
  return regex.test(content);
}

function addImport(content: string, importName: string, modulePath: string): string {
  if (hasImport(content, importName, modulePath)) return content;
  const importLine = `import { ${importName} } from '${modulePath}';\n`;

  // 找到最後一個 import 語句的結束位置（處理跨行 import）
  const importRegex = /^import\s+[^;]*?;/gms;
  let lastImportEnd = -1;
  let match;
  while ((match = importRegex.exec(content)) !== null) {
    lastImportEnd = match.index + match[0].length;
  }

  if (lastImportEnd === -1) {
    return importLine + content;
  }

  return content.slice(0, lastImportEnd) + '\n' + importLine + content.slice(lastImportEnd);
}

function processFile(filePath: string): { replaced: number; skipped: number } {
  let content = fs.readFileSync(filePath, 'utf-8');
  const originalContent = content;
  let replaced = 0;
  let skipped = 0;
  const isExcel = isExcelFile(filePath);

  const regex = /new Date\(([^)]+)\)\.toLocaleDateString\('zh-TW'\)/g;

  content = content.replace(regex, (match, innerExpr) => {
    if (isExcel) {
      skipped++;
      return match;
    }

    replaced++;
    return `formatDisplayDate(${innerExpr})`;
  });

  if (replaced > 0) {
    content = addImport(content, 'formatDisplayDate', '../utils/dateFormat');
  }

  if (content !== originalContent) {
    fs.writeFileSync(filePath, content, 'utf-8');
  }

  return { replaced, skipped };
}

function walk(dir: string, callback: (file: string) => void) {
  const entries = fs.readdirSync(dir, { withFileTypes: true });
  for (const entry of entries) {
    const fullPath = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (entry.name === 'node_modules') continue;
      walk(fullPath, callback);
    } else if (/\.(ts|tsx)$/.test(entry.name)) {
      callback(fullPath);
    }
  }
}

function findBrokenImports(dir: string): string[] {
  const broken: string[] = [];
  walk(dir, (filePath) => {
    const content = fs.readFileSync(filePath, 'utf-8');
    // 檢查是否有 import 被錯誤插入到跨行 import 中間
    if (/import\s+type\s*\{[^}]*\nimport\s+\{/.test(content)) {
      broken.push(filePath);
    }
  });
  return broken;
}

// 先修復已破壞的 import
const brokenFiles = findBrokenImports(SRC_DIR);
if (brokenFiles.length > 0) {
  console.log('=== 發現並修復 import 插入錯誤的檔案 ===');
  for (const filePath of brokenFiles) {
    let content = fs.readFileSync(filePath, 'utf-8');
    // 移除錯誤插入的 import 行，稍後會重新正確插入
    content = content.replace(/\nimport \{ formatDisplayDate \} from '[^']+';\n(?=\s*\w+\s*[,}])/g, '\n');
    fs.writeFileSync(filePath, content, 'utf-8');
    console.log(filePath);
  }
}

const results: { file: string; replaced: number; skipped: number }[] = [];
let totalReplaced = 0;
let totalSkipped = 0;

walk(SRC_DIR, (filePath) => {
  const { replaced, skipped } = processFile(filePath);
  if (replaced > 0 || skipped > 0) {
    results.push({ file: filePath, replaced, skipped });
    totalReplaced += replaced;
    totalSkipped += skipped;
  }
});

console.log('=== 日期格式批次替換結果 ===');
console.log(`總替換: ${totalReplaced}`);
console.log(`總跳過: ${totalSkipped}`);
console.log('');
console.log('修改檔案明細：');
for (const r of results) {
  console.log(`${r.file}: 替換=${r.replaced}, 跳過=${r.skipped}`);
}

console.log('');
console.log('=== 仍有 toLocaleDateString("zh-TW") 的檔案（含 Excel 與中文轉換）===');
walk(SRC_DIR, (filePath) => {
  const content = fs.readFileSync(filePath, 'utf-8');
  const matches = content.match(/toLocaleDateString\('zh-TW'\)/g);
  if (matches) {
    console.log(`${filePath}: ${matches.length} 處`);
  }
});

console.log('');
console.log('=== 檢查是否還有 import 插入錯誤 ===');
const remainingBroken = findBrokenImports(SRC_DIR);
if (remainingBroken.length === 0) {
  console.log('沒有發現 import 插入錯誤');
} else {
  for (const f of remainingBroken) {
    console.log(f);
  }
}
