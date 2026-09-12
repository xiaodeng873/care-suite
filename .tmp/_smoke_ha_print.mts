import { generateHomeActivitiesPrintFormHtml } from '../apps/web/src/utils/homeActivitiesPrintFormHtml';
import { writeFileSync } from 'node:fs';
const mk = (d: string, st: string, et: string, org: string, name: string, loc: string, v: number, p: number) => ({
  id: Math.random().toString(36).slice(2), activity_date: d, start_time: st, end_time: et,
  organizer: org, activity_name: name, location: loc, volunteer_count: v, participant_count: p,
  facility_id: 1, created_at: '', updated_at: '',
});
const recs = [
  mk('2026-07-06','14:30:00','15:30:00','香港中國婦女會','友智識長者數碼外展計劃','1/F 大廳',3,21),
  mk('2026-07-20','14:30:00','15:30:00','香港中國婦女會','友智識長者數碼外展計劃','1/F 大廳',3,19),
  ...Array.from({length:13},(_,i)=>mk('2026-07-2'+Math.min(i+1,9),'14:00:00','15:00:00','本院','活動'+(i+1),'大廳',0,i+5)),
  mk('2026-08-07','14:15:00','15:15:00','聖公會外展專業服務','硬地滾球運動','2/F 大廳',2,20),
  mk('2026-08-22','14:30:00','15:30:00','基督教耆福會','唱歌','2/F 大廳',4,24),
  mk('2025-12-24','14:30:00','15:30:00','善頤(福群)護老院-平安夜','平安夜','1/F 2/F',0,166),
];
const html = generateHomeActivitiesPrintFormHtml(recs, '善頤(福群)護老院');
writeFileSync('.tmp/ha_print_smoke.html', html);
console.log('pages:', (html.match(/class="container"/g)||[]).length, '| item numbers:', [...html.matchAll(/<td style="font-size: 13px;">(\d+)<\/td>/g)].map(m=>m[1]).join(','));
console.log('附件3.2:', html.includes('附件 3.2'), '| month note:', html.includes('請於每月25號前'), '| doc code:', html.includes('A19C FK (11.2020)(附件 3.2)'), '| sign:', html.includes('舍監/院長簽署'));
const empty = generateHomeActivitiesPrintFormHtml([], '善頤(福群)護老院', '2026-09');
console.log('empty pages:', (empty.match(/class="container"/g)||[]).length, '| ym label:', empty.includes('2026 年 9 月'));

// 唔按月分頁：跨月連續列表
const flat = generateHomeActivitiesPrintFormHtml(recs.filter(r=>r.activity_date>='2026-07-01'), '善頤(福群)護老院', undefined, false);
console.log('flat pages:', (flat.match(/class="container"/g)||[]).length, '| range label:', flat.includes('6.7.2026 至 22.8.2026'), '| month label leak:', flat.includes('2026 年 7 月'));
console.log('flat rows:', (flat.match(/<tr style="height: 28px;">/g)||[]).length);
