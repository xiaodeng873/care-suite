import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import pkg from './ha-gen.cjs';
const { generateHealthAssessmentHtml } = pkg;

const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', process.env.SUPABASE_SERVICE_ROLE_KEY, { auth: { autoRefreshToken: false, persistSession: false } });

const { data: assessments } = await supabase
  .from('health_assessments')
  .select('*')
  .order('created_at', { ascending: false })
  .limit(5);
console.log('assessments found:', assessments?.length);

let tallest = null;
for (const a of assessments || []) {
  const { data: p } = await supabase.from('院友主表').select('*').eq('院友id', a.patient_id).single();
  if (!p) continue;
  const filled = JSON.stringify(a).length;
  console.log(`id=${a.id} patient=${p.中文姓名} jsonLen=${filled} date=${a.assessment_date}`);
  if (!tallest || filled > tallest.filled) tallest = { a, p, filled };
}

const html = generateHealthAssessmentHtml(tallest.a, tallest.p, '善頤(福群)護老院');
fs.writeFileSync('.tmp/ha-real.html', html);
console.log('written .tmp/ha-real.html for', tallest.p.中文姓名);
