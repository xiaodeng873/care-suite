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

// ---------- 1. auth-custom edge function：離職日當日起拒絕登入並即時停用 ----------
const gate = `
  // 離職日當日起帳戶自動停用（香港時區）
  const hkToday = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);
  if (user.resignation_date && user.resignation_date <= hkToday) {
    await supabase
      .from("user_profiles")
      .update({ is_active: false, updated_at: new Date().toISOString() })
      .eq("id", user.id);
    console.log("Account auto-disabled on resignation date:", user.username);
    return {
      success: false,
      error: "帳號已停用",
    };
  }
`;

patch('supabase/functions/auth-custom/index.ts', [
  [
    `  if (userError || !user) {\n    console.log("User not found or error:", userError);\n    return {\n      success: false,\n      error: "帳號或密碼錯誤",\n    };\n  }\n\n  console.log("User found, comparing password...");`,
    `  if (userError || !user) {\n    console.log("User not found or error:", userError);\n    return {\n      success: false,\n      error: "帳號或密碼錯誤",\n    };\n  }\n${gate}\n  console.log("User found, comparing password...");`,
    'password login resignation gate',
  ],
  [
    `  if (userError || !user) {\n    console.log("User not found or error:", userError);\n    return {\n      success: false,\n      error: "二維碼無效或帳號已停用",\n    };\n  }\n\n  console.log("User found via QR code, creating session...");`,
    `  if (userError || !user) {\n    console.log("User not found or error:", userError);\n    return {\n      success: false,\n      error: "二維碼無效或帳號已停用",\n    };\n  }\n${gate}\n  console.log("User found via QR code, creating session...");`,
    'QR login resignation gate',
  ],
]);

// ---------- 2. Settings 用戶管理：載入時同步離職停用 ----------
patch('apps/web/src/pages/Settings.tsx', [
  [
    `  const fetchUsers = useCallback(async () => {\n    try {\n      setLoading(true);\n      const { data, error } = await supabase`,
    `  const fetchUsers = useCallback(async () => {\n    try {\n      setLoading(true);\n      // 離職日當日起帳戶自動停用（載入時同步，香港時區）\n      const hkToday = new Date(Date.now() + 8 * 3600 * 1000).toISOString().slice(0, 10);\n      await supabase\n        .from('user_profiles')\n        .update({ is_active: false, updated_at: new Date().toISOString() })\n        .eq('is_active', true)\n        .not('resignation_date', 'is', null)\n        .lte('resignation_date', hkToday);\n      const { data, error } = await supabase`,
    'fetchUsers lazy resignation sync',
  ],
]);

if (failures > 0) {
  console.error(`\n${failures} anchor(s) missed`);
  process.exit(1);
}
console.log('\nAll patches applied.');
