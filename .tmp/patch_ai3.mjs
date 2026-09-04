import fs from 'fs';
const f = 'apps/web/src/hooks/useAiAssistant.ts';
let s = fs.readFileSync(f, 'utf8');
const patch = (anchor, oldH, newH) => {
  const i = s.indexOf(anchor);
  if (i < 0) throw new Error('anchor not found: ' + anchor);
  const j = s.indexOf(oldH, i);
  if (j < 0 || j > i + anchor.length + 400) throw new Error('header not found after ' + anchor);
  s = s.slice(0, j) + newH + s.slice(j + oldH.length);
};
patch('`${AI_FUNCTION_URL}/chat`',
  "            'Authorization': `Bearer ${authToken}`,",
  "            'Authorization': `Bearer ${authToken}`,\n            // 用戶 dbToken：後端以其身份執行 SQL，RLS tenant 隔離才生效\n            'X-Db-Token': localStorage.getItem('care_suite_db_token') || '',");
patch('`${AI_FUNCTION_URL}/confirm-mutation`',
  "          'Authorization': `Bearer ${authToken}`,",
  "          'Authorization': `Bearer ${authToken}`,\n          // 用戶 dbToken：後端以其身份執行 SQL，RLS tenant 隔離才生效\n          'X-Db-Token': localStorage.getItem('care_suite_db_token') || '',");
fs.writeFileSync(f, s);
console.log('ok');
