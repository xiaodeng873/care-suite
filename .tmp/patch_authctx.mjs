import fs from 'fs';
const f = 'apps/web/src/context/AuthContext.tsx';
let s = fs.readFileSync(f, 'utf8');
const eol = s.includes('\r\n') ? '\r\n' : '\n';
let n = 0;

// 1. parse helper + state
let oldStr = [
"const clearDbToken = () => {",
"  localStorage.removeItem(DB_TOKEN_KEY);",
"};",
].join(eol);
let newStr = [
"const clearDbToken = () => {",
"  localStorage.removeItem(DB_TOKEN_KEY);",
"};",
"",
"// 從 dbToken 解出 facility_id（切換院舍後用來重置整個資料樹的 key）",
"const parseFacilityIdFromToken = (token?: string | null): number | null => {",
"  try {",
"    if (!token) return null;",
"    const payload = JSON.parse(atob(token.split('.')[1].replace(/-/g, '+').replace(/_/g, '/')));",
"    return typeof payload.facility_id === 'number' ? payload.facility_id : null;",
"  } catch {",
"    return null;",
"  }",
"};",
].join(eol);
if (!s.includes(oldStr)) throw new Error('helper anchor not found');
s = s.replace(oldStr, newStr); n++;

// 2. state in component（放在 devFacilityChosen 旁）
oldStr = "  const [devFacilityChosen, setDevFacilityChosen] = useState(false);";
newStr = [
"  const [devFacilityChosen, setDevFacilityChosen] = useState(false);",
"  // 當前 dbToken 對應的院舍 id；切換時 App 用佢做 key 重掛成棵資料樹，杜絕舊院舍資料殘留",
"  const [dbFacilityId, setDbFacilityId] = useState<number | null>(() =>",
"    parseFacilityIdFromToken(localStorage.getItem(DB_TOKEN_KEY))",
"  );",
].join(eol);
if (!s.includes(oldStr)) throw new Error('state anchor not found');
s = s.replace(oldStr, newStr); n++;

// 3. interface 加欄位（devFacilityChosen 旁）
oldStr = "  // 開發者是否已在本工作階段選定院舍（App 層閘門用）";
newStr = [
"  // 當前 dbToken 對應的院舍 id（App 層用佢重掛資料樹）",
"  dbFacilityId: number | null;",
"  // 開發者是否已在本工作階段選定院舍（App 層閘門用）",
].join(eol);
if (!s.includes(oldStr)) throw new Error('interface anchor not found');
s = s.replace(oldStr, newStr); n++;

// 4. 各 saveDbToken 點同步 setDbFacilityId
const sites = [
  ["        saveDbToken(result.dbToken);", "validateCustomToken"],
  ["      saveDbToken(result.dbToken);", "selectFacility"],
  ["        saveDbToken(result.dbToken);", "signIn"],
];
for (const [needle, name] of sites) {
  const idx = s.indexOf(needle);
  if (idx < 0) throw new Error('save site not found: ' + name);
  const indent = needle.match(/^ */)[0];
  const replacement = needle + eol + indent + "setDbFacilityId(parseFacilityIdFromToken(result.dbToken));";
  s = s.slice(0, idx) + replacement + s.slice(idx + needle.length);
  n++;
}

// 5. provider value 導出
oldStr = "      devFacilityChosen,";
newStr = "      devFacilityChosen," + eol + "      dbFacilityId,";
if (!s.includes(oldStr)) throw new Error('value anchor not found');
s = s.replace(oldStr, newStr); n++;

// 6. clearDbToken 點重置 state（登出）
const clearIdx = s.indexOf("clearDbToken();");
if (clearIdx >= 0) {
  s = s.slice(0, clearIdx) + "clearDbToken();" + eol + "            setDbFacilityId(null);" + s.slice(clearIdx + "clearDbToken();".length);
  n++;
}

fs.writeFileSync(f, s);
console.log('patched', n, 'spots');
