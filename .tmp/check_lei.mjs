import { createClient } from '@supabase/supabase-js';
const supabase = createClient(process.env.VITE_SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);

const { data: patients, error: e1 } = await supabase
  .from('院友主表').select('院友id, 中文姓名, 床號').ilike('中文姓名', '%雷燕優%');
if (e1) { console.error(e1); process.exit(1); }
console.log('patients:', patients);
const pid = patients[0].院友id;

const { data: rx, error: e2 } = await supabase
  .from('new_medication_prescriptions')
  .select('id, medication_name, administration_route, medication_time_slots, meal_timing, daily_frequency, is_prn, status, start_date, end_date, prescription_date, inspection_rules, created_at')
  .eq('patient_id', pid)
  .order('created_at', { ascending: false });
if (e2) { console.error(e2); process.exit(1); }
for (const p of rx) {
  console.log(JSON.stringify({
    name: p.medication_name, route: p.administration_route,
    slots: p.medication_time_slots, meal: p.meal_timing, freq: p.daily_frequency,
    prn: p.is_prn, status: p.status, start: p.start_date, end: p.end_date, presc: p.prescription_date,
    insp: p.inspection_rules
  }));
}
