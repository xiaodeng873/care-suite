const pkg = require('./vacc-gen.cjs');
const fs = require('fs');
const patient = { 床號: 'A101', original_bed_number: 'A101', 中文姓名: '陳大文', 性別: '男', 出生日期: '1950-01-01' };
const records = [
  { id: '1', patient_id: 1, vaccination_date: '2024-10-05', vaccine_item: '流感疫苗', vaccination_unit: '', created_at: '', updated_at: '' },
  { id: '3', patient_id: 1, vaccination_date: '2024-03-15', vaccine_item: '肺炎鏈球菌疫苗', vaccination_unit: '', created_at: '', updated_at: '' },
];
fs.writeFileSync('.tmp/vacc-test.html', pkg.generateVaccinationRecordHtml(patient, records, '善頤(福群)護老院'));
console.log('ok');
