import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!url || !serviceKey) {
  console.error('請設定 VITE_SUPABASE_URL 與 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(url, serviceKey);

const sql = `UPDATE user_public_holiday_details u
SET reference_public_holiday_id = l.reference_public_holiday_id,
    expiry_date = (p.holiday_date + INTERVAL '30 days')::date
FROM user_leave_records l
JOIN public_holidays p ON p.id = l.reference_public_holiday_id
WHERE u.user_id = l.user_id
  AND u.record_date = l.leave_date
  AND u.detail_type = 'usage'
  AND u.reference_public_holiday_id IS NULL
  AND l.record_type = 'leave'
  AND l.leave_type IN ('PH', 'SH')
  AND l.reference_public_holiday_id IS NOT NULL`;

const { data, error } = await supabase.rpc('exec_sql_mutation', { query_text: sql });

if (error) {
  console.error('❌ backfill 失敗:', error);
  process.exit(1);
}

console.log('✅ usage 明細 reference backfill 完成，影響行數:', data?.affected_rows ?? '未知');
