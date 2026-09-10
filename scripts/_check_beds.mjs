import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);
const A = 'ab0baf30-65bf-4c5d-b0f4-94cc8ff43d03';
const B = '1b1b78ae-6e87-405d-8f7f-86ee8423c0c3';

const { data: beds } = await supabase.from('beds').select('id,station_id,bed_number,is_occupied,room_id,bed_no').in('station_id', [A, B]);
const byNum = new Map(beds.map(b => [b.bed_number, b]));
console.log('total AB beds:', beds.length);

const wanted = ['A103-1','B103-1','A108-2','B108-2','A132-4','B132-4','A135-1','B135-1','A136-2','B136-2','A150-1','B150-1','A160-1','B160-1','B167','B167-1','A167-1'];
for (const w of wanted) {
  const b = byNum.get(w);
  console.log(w.padEnd(8), b ? `${b.id} occupied=${b.is_occupied}` : 'NOT FOUND');
}

// occupancy check: which beds marked occupied but patient not pointing to them
const { data: pats } = await supabase.from('院友主表').select('院友id,床號,中文姓名,bed_id').in('station_id', [A, B]);
const patBedIds = new Set(pats.map(p => p.bed_id).filter(Boolean));
const occupiedBeds = beds.filter(b => b.is_occupied);
console.log('\noccupied beds count:', occupiedBeds.length, 'patients with bed_id:', patBedIds.size);
occupiedBeds.filter(b => !patBedIds.has(b.id)).forEach(b => console.log('occupied but unlinked:', b.bed_number));
pats.filter(p => p.bed_id && !beds.find(b => b.id === p.bed_id)).forEach(p => console.log('patient bed_id dangling:', p.床號, p.中文姓名));
pats.filter(p => !p.bed_id).forEach(p => console.log('patient no bed_id:', p.床號, p.中文姓名));

// facility_id of existing patients
const { data: fac } = await supabase.from('院友主表').select('facility_id').in('station_id', [A, B]).limit(3);
console.log('facility_id sample:', JSON.stringify(fac));
