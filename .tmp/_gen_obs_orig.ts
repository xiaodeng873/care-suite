// 生成觀察表 HTML 到 .tmp 供渲染檢查
import { generateRestraintObservationHtml } from '../.tmp/_obs_orig_exporter';
import { writeFileSync } from 'fs';

const patient = {
  院友id: 1, 中文姓氏: '胡', 中文名字: '甜妹', 中文姓名: '胡甜妹',
  床號: 'C219-4', 性別: '女', 出生日期: '1933-01-07',
};
const assessment = {
  suggested_restraints: {
    '約束衣': { checked: true, usageConditions: '坐在椅上及躺在床上', allDay: true },
    '約束手套/連指手套': { checked: true, usageConditions: '坐在椅上及躺在床上', allDay: true },
  },
};
const html = generateRestraintObservationHtml({
  patient, records: [], assessment,
  dateRange: { start: '2026-09-30', end: '2026-10-03' },
  facilityName: '善頤(福群)護老院',
  includeDayNumber: true,
});
writeFileSync('.tmp/_obs_preview.html', html);
console.log('written', html.length);
