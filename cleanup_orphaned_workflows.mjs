import { createClient } from '@supabase/supabase-js';

const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
if (!KEY) {
  console.error('❌ 請先設定 SUPABASE_SERVICE_ROLE_KEY 環境變數');
  process.exit(1);
}

const supabase = createClient(
  'https://mzeptzwuqvpjspxgnzkp.supabase.co',
  KEY
);

// Step 1: 分頁取全部派藥記錄
let allWorkflows = [];
let pageNo = 0;
const PAGE_SIZE = 1000;

while (true) {
  const { data: pageData } = await supabase
    .from('medication_workflow_records')
    .select('id, prescription_id')
    .range(pageNo * PAGE_SIZE, (pageNo + 1) * PAGE_SIZE - 1);

  if (!pageData || pageData.length === 0) break;
  allWorkflows = allWorkflows.concat(pageData);
  pageNo++;
}

if (allWorkflows.length === 0) {
  console.log('✅ 沒有派藥記錄');
  process.exit(0);
}

console.log(`📊 共 ${allWorkflows.length} 筆派藥記錄`);

// Step 2: 查全部有效的 prescription_id
const { data: allPrescriptions } = await supabase
  .from('new_medication_prescriptions')
  .select('id');

const validPrescriptionIds = new Set(allPrescriptions?.map(p => p.id) || []);
console.log(`✅ 有效處方: ${validPrescriptionIds.size} 筆`);

// Step 3: 找孤立記錄
const orphaned = allWorkflows.filter(w => !validPrescriptionIds.has(w.prescription_id));
console.log(`\n⚠️  孤立派藥記錄: ${orphaned.length} 筆`);

if (orphaned.length === 0) {
  console.log('✅ 沒有孤立記錄');
  process.exit(0);
}

// Step 4: 分批刪除 (Supabase 限制)
const orphanedIds = orphaned.map(w => w.id);
const BATCH_SIZE = 100;
let deleted = 0;

for (let i = 0; i < orphanedIds.length; i += BATCH_SIZE) {
  const batch = orphanedIds.slice(i, i + BATCH_SIZE);
  const { error } = await supabase
    .from('medication_workflow_records')
    .delete()
    .in('id', batch);

  if (error) {
    console.error(`❌ 批次 ${i/BATCH_SIZE + 1} 刪除失敗:`, error.message);
    process.exit(1);
  }

  deleted += batch.length;
  console.log(`✅ 已刪除 ${deleted} / ${orphanedIds.length}`);
}

console.log(`\n🎉 成功清理 ${orphanedIds.length} 筆孤立派藥記錄`);
