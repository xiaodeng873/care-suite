import fs from 'fs';
const f = 'supabase/functions/ai-assistant/index.ts';
let s = fs.readFileSync(f, 'utf8');
const oldStr = '  // Execute the mutation\r\n  try {\r\n    const { data, error } = await supabase.rpc("exec_sql_mutation", {';
const newStr = '  // Execute the mutation — 用戶本人的 dbToken 執行，RLS tenant 隔離生效\r\n' +
'  try {\r\n' +
'    const userDb = getUserDbClient(userCtx?.dbToken);\r\n' +
'    if (!userDb) {\r\n' +
'      return jsonResponse({\r\n' +
'        success: false,\r\n' +
'        error: "缺少資料庫權杖，請重新登入後再試"\r\n' +
'      }, 401);\r\n' +
'    }\r\n' +
'    const { data, error } = await userDb.rpc("exec_sql_mutation", {';
if (!s.includes(oldStr)) throw new Error('not found');
s = s.replace(oldStr, newStr);
fs.writeFileSync(f, s);
console.log('ok');
