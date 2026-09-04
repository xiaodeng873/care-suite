import fs from 'fs';
const f = 'supabase/functions/ai-assistant/index.ts';
let s = fs.readFileSync(f, 'utf8');
const oldStr = '"Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, apikey"';
const newStr = '"Access-Control-Allow-Headers": "Content-Type, Authorization, X-Client-Info, Apikey, apikey, X-Db-Token"';
if (!s.includes(oldStr)) throw new Error('not found');
s = s.replace(oldStr, newStr);
fs.writeFileSync(f, s);
console.log('ok');
