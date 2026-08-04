import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  'https://mzeptzwuqvpjspxgnzkp.supabase.co',
  'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMjM4NjEsImV4cCI6MjA2NzU5OTg2MX0.Uo4fgr2XdUxWY5LZ5Q7A0j6XoCyuUsHhb4WO-eabJWk'
);

const { data: allPatients } = await supabase
  .from('院友主表')
  .select('*')
  .limit(500);

const filtered = allPatients?.filter(p => 
  p.中文姓名?.includes('鍾焰貞') || 
  p.床號?.toString().includes('229') ||
  String(p.院友id).includes('229')
) || [];

if (filtered.length === 0) {
  console.log('❌ 未找到患者 (關鍵字: 鍾焰貞)');
  process.exit(1);
}

const patient = filtered[0];
console.log(`✅ 找到患者: ${patient.中文姓名} (院友id: ${patient.院友id}, 床號: ${patient.床號})`);

const { data: prescriptions } = await supabase
  .from('new_medication_prescriptions')
  .select('id, medication_name, status, created_at')
  .eq('patient_id', patient.院友id);

console.log(`\n📋 處方數: ${prescriptions?.length || 0}`);
if (prescriptions?.length > 0) {
  prescriptions.slice(0, 5).forEach((p, i) => {
    console.log(`  [${i+1}] ${p.medication_name} (status: ${p.status}, id: ${p.id.substring(0, 8)}...)`);
  });
}

const { data: workflows } = await supabase
  .from('medication_workflow_records')
  .select('id, prescription_id, dispensing_status, created_at')
  .eq('patient_id', patient.院友id);

console.log(`\n💊 派藥記錄數: ${workflows?.length || 0}`);
if (workflows?.length > 0) {
  workflows.slice(0, 5).forEach((w, i) => {
    console.log(`  [${i+1}] ${w.dispensing_status} (prescription_id: ${w.prescription_id?.substring(0, 8)}...)`);
  });

  const prescriptionIds = new Set(prescriptions?.map(p => p.id) || []);
  const orphaned = workflows.filter(w => !prescriptionIds.has(w.prescription_id));
  
  if (orphaned.length > 0) {
    console.log(`\n⚠️  找到 ${orphaned.length} 筆孤立派藥記錄（對應的處方已刪除）`);
  }
}
