import { createClient } from '@supabase/supabase-js';
import dotenv from 'dotenv';
dotenv.config();

const DRY_RUN = process.argv.includes('--dry-run');
const CLEAN = process.argv.includes('--clean');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('缺少環境變數：請提供 VITE_SUPABASE_URL / SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

function toDateOnly(value) {
  const d = value instanceof Date ? value : new Date(value);
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

function isScheduled(p, ds) {
  const target = toDateOnly(ds);
  const start = p.start_date ? toDateOnly(p.start_date) : null;
  const end = p.end_date ? toDateOnly(p.end_date) : null;

  if (start && target < start) return false;
  if (end && target > end) return false;

  const ft = p.frequency_type || 'daily';
  const fv = Number(p.frequency_value) || 1;

  switch (ft) {
    case 'daily':
    case 'hourly':
      return true;
    case 'every_x_days': {
      const period = fv + 1;
      const daysDiff = Math.floor((target.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      return daysDiff >= 0 && daysDiff % period === 0;
    }
    case 'every_x_months': {
      const period = fv + 1;
      const monthsDiff = (target.getFullYear() - start.getFullYear()) * 12
        + (target.getMonth() - start.getMonth());
      return monthsDiff >= 0
        && monthsDiff % period === 0
        && target.getDate() === start.getDate();
    }
    case 'weekly_days': {
      const dow = target.getDay();
      const dbDow = dow === 0 ? 7 : dow;
      return (p.specific_weekdays || []).includes(dbDow);
    }
    case 'odd_even_days': {
      const n = target.getDate();
      if (p.is_odd_even_day === 'odd') return n % 2 === 1;
      if (p.is_odd_even_day === 'even') return n % 2 === 0;
      return false;
    }
    default:
      return true;
  }
}

async function fetchAll(table, select, options = {}) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    let query = supabase.from(table).select(select).range(from, from + PAGE - 1);
    if (options.order) query = query.order(options.order);
    const { data, error } = await query;
    if (error) throw new Error(`讀取 ${table} 失敗：${error.message}`);
    if (!data || data.length === 0) break;
    all = all.concat(data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  console.log(`模式：${DRY_RUN ? 'DRY-RUN（不刪除）' : '正式執行'}${CLEAN ? ' + 清理錯誤記錄' : ''}`);

  const prescriptions = await fetchAll('new_medication_prescriptions', 'id,patient_id,medication_name,start_date,end_date,frequency_type,frequency_value,specific_weekdays,is_odd_even_day,status');
  const rxMap = new Map(prescriptions.map(r => [r.id, r]));

  const records = await fetchAll('medication_workflow_records', 'id,prescription_id,scheduled_date,scheduled_time', { order: 'scheduled_date' });

  const bad = [];
  for (const rec of records) {
    const p = rxMap.get(rec.prescription_id);
    if (!p) {
      bad.push({ reason: '找不到對應處方', record: rec });
      continue;
    }
    if (p.status !== 'active') {
      bad.push({ reason: '處方非 active', record: rec, prescription: p });
      continue;
    }
    if (!isScheduled(p, rec.scheduled_date)) {
      bad.push({ reason: '不符合排程', record: rec, prescription: p });
    }
  }

  console.log(`\n工作流程記錄總數：${records.length}`);
  console.log(`問題記錄：${bad.length}`);

  const grouped = {};
  for (const b of bad) {
    grouped[b.reason] = (grouped[b.reason] || 0) + 1;
  }
  for (const [reason, count] of Object.entries(grouped)) {
    console.log(`  - ${reason}：${count} 筆`);
  }

  if (bad.length > 0) {
    console.log('\n前 20 筆問題記錄：');
    for (const b of bad.slice(0, 20)) {
      const p = b.prescription;
      console.log(`  id=${b.record.id} rx=${p ? p.medication_name : '?'} date=${b.record.scheduled_date} reason=${b.reason}`);
    }
  }

  if (!CLEAN) {
    console.log('\n加上 --clean 參數可刪除問題記錄。');
    return;
  }

  if (DRY_RUN) {
    console.log('\nDRY-RUN：不實際刪除。');
    return;
  }

  let deleted = 0;
  let failed = 0;
  const BATCH = 100;
  const ids = bad.map(b => b.record.id);
  for (let i = 0; i < ids.length; i += BATCH) {
    const batch = ids.slice(i, i + BATCH);
    const { error } = await supabase.from('medication_workflow_records').delete().in('id', batch);
    if (error) {
      console.error(`刪除批次 ${i + 1}-${i + batch.length} 失敗：${error.message}`);
      failed += batch.length;
    } else {
      deleted += batch.length;
    }
  }
  console.log(`\n實際刪除：${deleted} 筆，失敗：${failed} 筆`);
}

main().catch(err => {
  console.error('執行失敗：', err);
  process.exit(1);
});
