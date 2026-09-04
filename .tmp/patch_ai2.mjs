import fs from 'fs';
const f = 'supabase/functions/ai-assistant/index.ts';
let s = fs.readFileSync(f, 'utf8');
const oldStr = 'userCtx = await validateToken(token);\r\n    if (!userCtx) {';
const newStr = 'userCtx = await validateToken(token);\r\n    // 帶上用戶的 dbToken：之後所有資料查詢/操作都用它執行，RLS tenant 隔離才生效\r\n    userCtx.dbToken = req.headers.get("X-Db-Token") || null;\r\n    if (!userCtx) {';
if (!s.includes(oldStr)) throw new Error('not found');
s = s.replace(oldStr, newStr);
fs.writeFileSync(f, s);
console.log('ok');
