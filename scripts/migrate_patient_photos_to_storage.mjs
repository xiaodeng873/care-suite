// 現有 base64 院友相搬遷到 Supabase Storage（patient-photos bucket）
// 掃 院友主表 三欄（院友相片 / 院友相片高清 / 身份證相片），data: 開頭嘅值 decode 上傳後改寫做 public URL
// idempotent：http 開頭（已搬）會 skip，可以重複跑
//
// 執行方法（repo root）：
//   node scripts/migrate_patient_photos_to_storage.mjs
// 需要 apps/web/.env 有 SUPABASE_SERVICE_ROLE_KEY（或環境變數 SUPABASE_SERVICE_ROLE_KEY）

import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'node:fs';
import { randomUUID } from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const __dirname = dirname(fileURLToPath(import.meta.url));

function loadEnvKey(key) {
  if (process.env[key]) return process.env[key];
  for (const p of [join(__dirname, '..', 'apps', 'web', '.env'), join(__dirname, '..', '.env')]) {
    try {
      const text = readFileSync(p, 'utf8');
      const m = text.match(new RegExp(`^${key}=(.+)$`, 'm'));
      if (m) return m[1].trim().replace(/^["']|["']$/g, '');
    } catch { /* 檔案唔存在就試下一個 */ }
  }
  return null;
}

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const SERVICE_ROLE_KEY = loadEnvKey('SUPABASE_SERVICE_ROLE_KEY');
if (!SERVICE_ROLE_KEY) {
  console.error('❌ 搵唔到 SUPABASE_SERVICE_ROLE_KEY（apps/web/.env 或環境變數）');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const BUCKET = 'patient-photos';
const PAGE_SIZE = 100;
const COLUMNS = [
  { column: '院友相片', kind: 'photo' },
  { column: '院友相片高清', kind: 'hd' },
  { column: '身份證相片', kind: 'idcard' },
];

const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function decodeDataUrl(value) {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/s.exec(value);
  if (!m) return null;
  return { contentType: m[1], buffer: Buffer.from(m[2], 'base64') };
}

let migrated = 0;
let skipped = 0;
let failed = 0;

async function migrateColumn(row, { column, kind }) {
  const value = row[column];
  if (!value || typeof value !== 'string') return;
  if (/^https?:\/\//.test(value)) {
    skipped++;
    return;
  }
  if (!value.startsWith('data:')) {
    skipped++;
    return;
  }

  const decoded = decodeDataUrl(value);
  if (!decoded) {
    console.error(`  ❌ 院友 ${row.院友id} ${column}: data URL 格式唔啱，skip`);
    failed++;
    return;
  }

  const ext = MIME_EXT[decoded.contentType] ?? 'jpg';
  const path = `${row.院友id}/${kind}-${randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(BUCKET)
    .upload(path, decoded.buffer, { contentType: decoded.contentType, upsert: false });
  if (uploadError) {
    console.error(`  ❌ 院友 ${row.院友id} ${column}: 上傳失敗 — ${uploadError.message}`);
    failed++;
    return;
  }

  const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
  if (!urlData?.publicUrl) {
    console.error(`  ❌ 院友 ${row.院友id} ${column}: 拎唔到 public URL`);
    failed++;
    return;
  }

  // upload 成功先 update DB
  const { error: updateError } = await supabase
    .from('院友主表')
    .update({ [column]: urlData.publicUrl })
    .eq('院友id', row.院友id);
  if (updateError) {
    console.error(`  ❌ 院友 ${row.院友id} ${column}: DB update 失敗 — ${updateError.message}（object ${path} 已上傳，重跑會再處理）`);
    failed++;
    return;
  }

  migrated++;
  console.log(`  ✅ 院友 ${row.院友id} ${column} → ${path} (${Math.round(decoded.buffer.length / 1024)}KB)`);
}

let offset = 0;
let totalRows = 0;
for (;;) {
  const { data: rows, error } = await supabase
    .from('院友主表')
    .select('院友id, 院友相片, 院友相片高清, 身份證相片')
    .order('院友id', { ascending: true })
    .range(offset, offset + PAGE_SIZE - 1);
  if (error) {
    console.error('❌ 讀取 院友主表 失敗:', error.message);
    process.exit(1);
  }
  if (!rows || rows.length === 0) break;

  totalRows += rows.length;
  for (const row of rows) {
    const pending = COLUMNS.filter(({ column }) => typeof row[column] === 'string' && row[column].startsWith('data:'));
    if (pending.length > 0) {
      console.log(`院友 ${row.院友id}: ${pending.length} 欄要搬`);
    }
    for (const col of COLUMNS) {
      await migrateColumn(row, col);
    }
  }

  if (rows.length < PAGE_SIZE) break;
  offset += PAGE_SIZE;
}

console.log('\n========== 搬遷完成 ==========');
console.log(`掃描行數: ${totalRows}`);
console.log(`成功搬遷: ${migrated} 欄`);
console.log(`Skip（空值/已係 URL）: ${skipped} 欄`);
console.log(`失敗: ${failed} 欄`);
if (failed > 0) process.exit(1);
