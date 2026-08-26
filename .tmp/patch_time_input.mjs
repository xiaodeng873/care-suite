// 修復「特定上班時間」儲存後變空白：
// 根因是瀏覽器 time input 為 12 小時制分段控制項，未選 AM/PM 時 value 為空字串。
// 改為 text 輸入 + 儲存時正規化（接受 0700 / 7:00 / 07:00）。
import fs from 'fs';

const path = 'apps/web/src/components/EmploymentDetailsSection.tsx';
let src = fs.readFileSync(path, 'utf8');

const mustReplace = (oldS, newS, name) => {
  if (!src.includes(oldS)) { console.error(name + ' 找不到'); process.exit(1); }
  if (src.indexOf(oldS) !== src.lastIndexOf(oldS)) { console.error(name + ' 不唯一'); process.exit(1); }
  src = src.replace(oldS, newS);
};

// 1) 新增正規化 helper（插在 parseHalf 之後）
mustReplace(
  "  if (Math.round(n * 2) !== n * 2) return 'invalid';\r\n" +
  "  return n;\r\n" +
  "};\r\n",
  "  if (Math.round(n * 2) !== n * 2) return 'invalid';\r\n" +
  "  return n;\r\n" +
  "};\r\n" +
  "\r\n" +
  "/** 特定上班時間輸入正規化：接受 HH:MM / H:MM / HHMM / HMM，統一回傳 HH:MM；空白回 null；格式錯誤回 'invalid' */\r\n" +
  "const normalizeWorkStartTimeInput = (raw: string): string | null | 'invalid' => {\r\n" +
  "  if (raw.trim() === '') return null;\r\n" +
  "  const digits = raw.replace(/\\D/g, '');\r\n" +
  "  if (!/^\\d{3,4}$/.test(digits)) return 'invalid';\r\n" +
  "  const hh = parseInt(digits.slice(0, -2), 10);\r\n" +
  "  const mm = parseInt(digits.slice(-2), 10);\r\n" +
  "  if (hh > 23 || mm > 59) return 'invalid';\r\n" +
  "  return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;\r\n" +
  "};\r\n",
  'helper',
);

// 2) handleSave 驗證段：加入時間正規化檢查
mustReplace(
  "\r\n" +
  "    const startChanged = (annualLeaveStartDate || null) !== initialStartDate;\r\n",
  "\r\n" +
  "    // 特定上班時間：統一為 HH:MM，格式錯誤即拒絕儲存\r\n" +
  "    const normalizedWorkStartTime = normalizeWorkStartTimeInput(defaultWorkStartTime);\r\n" +
  "    if (normalizedWorkStartTime === 'invalid') {\r\n" +
  "      setMessage({ type: 'error', text: '特定上班時間格式應為 HH:MM（例如 07:00）' });\r\n" +
  "      return;\r\n" +
  "    }\r\n" +
  "\r\n" +
  "    const startChanged = (annualLeaveStartDate || null) !== initialStartDate;\r\n",
  'validation',
);

// 3) upsert payload 改用正規化結果
mustReplace(
  "          default_work_start_time: normalizeTime(defaultWorkStartTime) || defaultWorkStartTime || null,\r\n",
  "          default_work_start_time: normalizedWorkStartTime,\r\n",
  'payload',
);

// 4) 輸入框由 type=time 改為 text（避免瀏覽器 12 小時制分段控制項造成空值）
mustReplace(
  "                    <input\r\n" +
  "                      type=\"time\"\r\n" +
  "                      value={defaultWorkStartTime}\r\n" +
  "                      onChange={e => setDefaultWorkStartTime(e.target.value)}\r\n" +
  "                      className={inputClass}\r\n" +
  "                    />\r\n",
  "                    <input\r\n" +
  "                      type=\"text\"\r\n" +
  "                      inputMode=\"numeric\"\r\n" +
  "                      placeholder=\"HH:MM\"\r\n" +
  "                      value={defaultWorkStartTime}\r\n" +
  "                      onChange={e => setDefaultWorkStartTime(e.target.value)}\r\n" +
  "                      className={inputClass}\r\n" +
  "                    />\r\n",
  'input',
);

fs.writeFileSync(path, src);
console.log('patch 完成');
