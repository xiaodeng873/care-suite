#!/usr/bin/env node
// 餐膳組合改名：meal_guidance.meal_combination 「糊飯+糊餸」→「全糊」
// 用法：SUPABASE_SERVICE_ROLE_KEY='your_key' node scripts/rename_meal_combination.mjs

import { createClient } from '@supabase/supabase-js';

const SUPABASE_URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!KEY) {
  console.error('❌ 請提供 SUPABASE_SERVICE_ROLE_KEY 環境變數');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, KEY, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const { data: preview, error: previewError } = await supabase
  .from('meal_guidance')
  .select('id')
  .eq('meal_combination', '糊飯+糊餸');

if (previewError) {
  console.error('❌ 查詢失敗:', previewError.message);
  process.exit(1);
}

if (!preview || preview.length === 0) {
  console.log('⏭️  無「糊飯+糊餸」舊記錄，毋須遷移');
  process.exit(0);
}

const ids = preview.map(r => r.id);
const { error: updateError } = await supabase
  .from('meal_guidance')
  .update({ meal_combination: '全糊' })
  .in('id', ids);

if (updateError) {
  console.error('❌ 更新失敗:', updateError.message);
  process.exit(1);
}

console.log(`✅ 已將 ${ids.length} 筆「糊飯+糊餸」改為「全糊」`);
