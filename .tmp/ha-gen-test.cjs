const { generateHealthAssessmentHtml } = require('./ha-gen.cjs');
const fs = require('fs');

const assessment = {
  assessment_date: '2026-09-10',
  communication_ability: '清楚',
  communication_other: '',
  nutritional_data: { height: '', weight: '' },
};
const patient = { 床號: 'A101', 中文姓名: '陳大文', 性別: '男', 出生日期: '1950-01-01', 身份證號碼: 'A123456(7)', 入住日期: '2026-01-01', 護理等級: '中度' };

const html = generateHealthAssessmentHtml(assessment, patient, '善頤(福群)護老院');
fs.writeFileSync('.tmp/ha-test.html', html);
console.log('written', html.length);
