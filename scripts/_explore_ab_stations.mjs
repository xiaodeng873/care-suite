import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

const A = 'ab0baf30-65bf-4c5d-b0f4-94cc8ff43d03';
const B = '1b1b78ae-6e87-405d-8f7f-86ee8423c0c3';

const { data: pats } = await supabase
  .from('院友主表')
  .select('院友id,床號,中文姓名,身份證號碼,在住狀態,station_id,bed_id,is_hospitalized,入住日期')
  .in('station_id', [A, B])
  .order('床號');
console.log('=== AB站 patients (all) ===', pats?.length);
pats?.forEach(p => console.log(String(p.床號 ?? '').padEnd(8), p.中文姓名, '|', p.身份證號碼, '|', p.在住狀態, '| hosp:', p.is_hospitalized, '|', p.station_id === A ? 'A' : 'B'));

// beds table structure
const { data: bedSample } = await supabase.from('beds').select('*').limit(2);
console.log('=== beds keys ===');
if (bedSample?.[0]) console.log(Object.keys(bedSample[0]).join(', '));
console.log(JSON.stringify(bedSample, null, 1)?.slice(0, 800));

// medications status values
const { data: medCols } = await supabase.from('new_medication_prescriptions').select('*').limit(1);
console.log('=== new_medication_prescriptions keys ===');
if (medCols?.[0]) console.log(Object.keys(medCols[0]).join(', '));

const { data: statuses } = await supabase
  .from('new_medication_prescriptions')
  .select('status')
  .in('station_id', [A, B]);
const counts = {};
statuses?.forEach(r => { counts[r.status] = (counts[r.status] || 0) + 1; });
console.log('=== AB站 prescription status counts ===', counts);
