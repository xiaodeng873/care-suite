const pkg = require('./vacc-gen.cjs');
const fs = require('fs');

const patient = { 床號: 'A101', original_bed_number: 'A101', 中文姓名: '陳大文', 性別: '男', 出生日期: '1950-01-01' };
const records = [];
// 流感 40 筆（會超過一頁）+ 其他區塊
for (let i = 0; i < 40; i++) {
  const y = 2015 + (i % 10);
  records.push({ id: 'f'+i, patient_id: 1, vaccination_date: `${y}-10-0${(i%9)+1}`, vaccine_item: '流感疫苗', vaccination_unit: '', created_at: '', updated_at: '' });
}
records.push({ id: 'p1', patient_id: 1, vaccination_date: '2024-03-15', vaccine_item: '肺炎鏈球菌疫苗', vaccination_unit: '', created_at: '', updated_at: '' });
for (let i = 0; i < 15; i++) {
  records.push({ id: 'c'+i, patient_id: 1, vaccination_date: `202${i%5}-0${(i%9)+1}-15`, vaccine_item: '復必泰', vaccination_unit: '', created_at: '', updated_at: '' });
}

const html = pkg.generateVaccinationRecordHtml(patient, records, '善頤(福群)護老院');
fs.writeFileSync('.tmp/vacc-test.html', html);
console.log('written', html.length);
