import fs from 'fs';
import { createClient } from '@supabase/supabase-js';

// 從專案根目錄 .env 載入環境變量
const envPath = new URL('../.env', import.meta.url);
const envContent = fs.readFileSync(envPath, 'utf-8');
for (const line of envContent.split(/\r?\n/)) {
  const match = line.match(/^\s*([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*?)\s*$/);
  if (!match) continue;
  const [, key, value] = match;
  if (process.env[key] === undefined) process.env[key] = value;
}

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('Missing VITE_SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const positions = ['註冊護士', '登記護士', '保健員'];

async function main() {
  const { data: profiles, error: e1 } = await supabase
    .from('user_profiles')
    .select('id')
    .in('nursing_position', positions);

  if (e1) {
    console.error('查詢 user_profiles 失敗:', e1);
    process.exit(1);
  }

  const ids = (profiles ?? []).map((p) => p.id);
  if (ids.length === 0) {
    console.log('沒有護士/保健員需要更新');
    return;
  }

  const { data, error: e2 } = await supabase
    .from('user_employment_details')
    .update({ default_work_start_time: null, updated_at: new Date().toISOString() })
    .in('user_id', ids)
    .select('user_id, default_work_start_time');

  if (e2) {
    console.error('更新 user_employment_details 失敗:', e2);
    process.exit(1);
  }

  console.log(`已取消 ${data?.length ?? 0} 位護士/保健員的預定上班時間`);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
