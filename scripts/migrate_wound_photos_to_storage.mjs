// 傷口相片由 base64 搬遷到 Supabase Storage（patient-photos bucket，wound/ 前綴）
// 掃 wound_assessments 兩處：
//   1. wound_photos jsonb（新結構，photo object array：{ id, base64, filename, uploadDate, description? }）
//   2. wound_details jsonb 巢狀嘅 detail.wound_photos（舊結構多傷口評估）
// base64 係 "data:image/...;base64,..." 開頭先處理；http(s) 開頭 skip（idempotent，可重複跑）
// 每行所有相 upload 成功先一次過 update 該行；任何一張失敗唔 update，記低繼續
//
// 執行方法（repo root）：
//   node scripts/migrate_wound_photos_to_storage.mjs
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
const PATH_PREFIX = 'wound/';
const PAGE_SIZE = 100;

const MIME_EXT = { 'image/jpeg': 'jpg', 'image/png': 'png', 'image/webp': 'webp' };

function decodeDataUrl(value) {
  const m = /^data:(image\/[a-zA-Z+]+);base64,(.+)$/s.exec(value);
  if (!m) return null;
  return { contentType: m[1], buffer: Buffer.from(m[2], 'base64') };
}

// photo entry 可以係 object（{ base64, ... }）或純字串（舊資料兼容，同 photoCell 一致）
function photoSrc(photo) {
  return typeof photo === 'object' && photo !== null ? (photo.base64 ?? '') : (photo ?? '');
}

function withSrc(photo, src) {
  return typeof photo === 'object' && photo !== null ? { ...photo, base64: src } : src;
}

// 掃一個 photos array，回傳 { photos: 新array, migrated: n, skipped: n, failed: n }
// 失敗時回傳嘅 photos 係原始 array（呼叫方唔好 update DB）
async function migratePhotoArray(photos, rowId, label) {
  if (!Array.isArray(photos) || photos.length === 0) {
    return { photos, migrated: 0, skipped: 0, failed: 0 };
  }
  const result = [];
  let migrated = 0;
  let skipped = 0;
  let failed = 0;

  for (const photo of photos) {
    const src = photoSrc(photo);
    if (!src || typeof src !== 'string' || /^https?:\/\//.test(src)) {
      skipped++;
      result.push(photo);
      continue;
    }
    if (!src.startsWith('data:')) {
      skipped++;
      result.push(photo);
      continue;
    }

    const decoded = decodeDataUrl(src);
    if (!decoded) {
      console.error(`  ❌ 評估 ${rowId} ${label}: data URL 格式唔啱，skip 呢張（呢行唔會 update）`);
      failed++;
      result.push(photo);
      continue;
    }

    const ext = MIME_EXT[decoded.contentType] ?? 'jpg';
    const path = `${PATH_PREFIX}${randomUUID()}.${ext}`;

    const { error: uploadError } = await supabase.storage
      .from(BUCKET)
      .upload(path, decoded.buffer, { contentType: decoded.contentType, upsert: false });
    if (uploadError) {
      console.error(`  ❌ 評估 ${rowId} ${label}: 上傳失敗 — ${uploadError.message}（呢行唔會 update）`);
      failed++;
      result.push(photo);
      continue;
    }

    const { data: urlData } = supabase.storage.from(BUCKET).getPublicUrl(path);
    if (!urlData?.publicUrl) {
      console.error(`  ❌ 評估 ${rowId} ${label}: 拎唔到 public URL（呢行唔會 update）`);
      failed++;
      result.push(photo);
      continue;
    }

    migrated++;
    console.log(`  ✅ 評估 ${rowId} ${label} → ${path} (${Math.round(decoded.buffer.length / 1024)}KB)`);
    result.push(withSrc(photo, urlData.publicUrl));
  }

  return { photos: result, migrated, skipped, failed };
}

let totalRows = 0;
let rowsUpdated = 0;
let rowsSkipped = 0;
let rowsFailed = 0;
let photosMigrated = 0;
let photosSkipped = 0;
let photosFailed = 0;

// 預先掃描：統計有幾多行幾多張相要搬
async function scan() {
  let offset = 0;
  let rowsWithBase64 = 0;
  let photosToMigrate = 0;
  for (;;) {
    const { data: rows, error } = await supabase
      .from('wound_assessments')
      .select('id, wound_photos, wound_details')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error('❌ 掃描 wound_assessments 失敗:', error.message);
      process.exit(1);
    }
    if (!rows || rows.length === 0) break;
    for (const row of rows) {
      let count = 0;
      const countBase64 = (photos) => {
        if (!Array.isArray(photos)) return;
        for (const p of photos) {
          const src = photoSrc(p);
          if (typeof src === 'string' && src.startsWith('data:')) count++;
        }
      };
      countBase64(row.wound_photos);
      if (Array.isArray(row.wound_details)) {
        for (const detail of row.wound_details) countBase64(detail?.wound_photos);
      }
      if (count > 0) {
        rowsWithBase64++;
        photosToMigrate += count;
      }
    }
    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
  console.log(`掃描結果：${rowsWithBase64} 行評估記錄有 base64 相片，共 ${photosToMigrate} 張相要搬\n`);
  return photosToMigrate;
}

async function migrate() {
  let offset = 0;
  for (;;) {
    const { data: rows, error } = await supabase
      .from('wound_assessments')
      .select('id, wound_photos, wound_details')
      .order('id', { ascending: true })
      .range(offset, offset + PAGE_SIZE - 1);
    if (error) {
      console.error('❌ 讀取 wound_assessments 失敗:', error.message);
      process.exit(1);
    }
    if (!rows || rows.length === 0) break;

    totalRows += rows.length;
    for (const row of rows) {
      const topResult = await migratePhotoArray(row.wound_photos, row.id, 'wound_photos');

      let detailsResult = { details: row.wound_details, migrated: 0, skipped: 0, failed: 0 };
      if (Array.isArray(row.wound_details) && row.wound_details.length > 0) {
        const newDetails = [];
        for (let i = 0; i < row.wound_details.length; i++) {
          const detail = row.wound_details[i];
          if (!detail || !Array.isArray(detail.wound_photos) || detail.wound_photos.length === 0) {
            newDetails.push(detail);
            continue;
          }
          const r = await migratePhotoArray(detail.wound_photos, row.id, `wound_details[${i}].wound_photos`);
          detailsResult.migrated += r.migrated;
          detailsResult.skipped += r.skipped;
          detailsResult.failed += r.failed;
          newDetails.push({ ...detail, wound_photos: r.photos });
        }
        detailsResult.details = newDetails;
      }

      const migrated = topResult.migrated + detailsResult.migrated;
      const failed = topResult.failed + detailsResult.failed;
      photosMigrated += migrated;
      photosSkipped += topResult.skipped + detailsResult.skipped;
      photosFailed += failed;

      if (migrated === 0) {
        if (failed > 0) rowsFailed++;
        else rowsSkipped++;
        continue;
      }

      // 任何一張失敗就唔 update 呢行（避免半搬狀態：URL 同 base64 混合係 OK 嘅，但失敗張相會留低）
      if (failed > 0) {
        console.error(`  ⚠️ 評估 ${row.id}: ${failed} 張相失敗，呢行唔 update（已上傳 ${migrated} 張，重跑會繼續）`);
        rowsFailed++;
        continue;
      }

      const updates = {};
      if (topResult.migrated > 0) updates.wound_photos = topResult.photos;
      if (detailsResult.migrated > 0) updates.wound_details = detailsResult.details;

      const { error: updateError } = await supabase
        .from('wound_assessments')
        .update(updates)
        .eq('id', row.id);
      if (updateError) {
        console.error(`  ❌ 評估 ${row.id}: DB update 失敗 — ${updateError.message}（objects 已上傳，重跑會再處理）`);
        rowsFailed++;
        continue;
      }

      rowsUpdated++;
      console.log(`✅ 評估 ${row.id}: 更新 ${migrated} 張相做 Storage URL`);
    }

    if (rows.length < PAGE_SIZE) break;
    offset += PAGE_SIZE;
  }
}

const pendingCount = await scan();
if (pendingCount === 0) {
  console.log('冇 base64 相片要搬，完成。');
  process.exit(0);
}
await migrate();

console.log('\n========== 搬遷完成 ==========');
console.log(`掃描行數: ${totalRows}`);
console.log(`成功更新行數: ${rowsUpdated}`);
console.log(`Skip 行數（冇相/全部已係 URL）: ${rowsSkipped}`);
console.log(`失敗行數: ${rowsFailed}`);
console.log(`成功搬遷相片: ${photosMigrated} 張`);
console.log(`Skip 相片（空值/已係 URL）: ${photosSkipped} 張`);
console.log(`失敗相片: ${photosFailed} 張`);
if (rowsFailed > 0 || photosFailed > 0) process.exit(1);
