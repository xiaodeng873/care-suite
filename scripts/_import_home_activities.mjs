// 匯入 upload/活動記錄.pdf 手寫資料到 home_activities（facility 1 = 安老院舍）
import { createClient } from '@supabase/supabase-js';

const url = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const sb = createClient(url, process.env.SUPABASE_SERVICE_ROLE_KEY);

// 〔?〕= 手寫不肯定字，保留標記；activity_name 空以 '' 代替（NOT NULL）
const rows = [
  // page7: 2025 items 1-11
  { activity_date:'2025-01-11', start_time:'14:30', end_time:'15:30', organizer:'本院', activity_name:'認知〔?〕茶會', location:'全院', volunteer_count:0, participant_count:223 },
  { activity_date:'2025-01-02', start_time:'14:30', end_time:'15:30', organizer:'聯合醫院外展專業服務', activity_name:'繽紛冬日哈哈哈〔?〕', location:'1/F 大廳', volunteer_count:2, participant_count:51 },
  { activity_date:'2025-01-24', start_time:'14:00', end_time:'15:30', organizer:'八福臨門', activity_name:'一團和氣福音活動', location:'2/F 大廳', volunteer_count:4, participant_count:34 },
  { activity_date:'2025-01-25', start_time:'14:15', end_time:'15:45', organizer:'基督教督〔?〕福會', activity_name:'賀年活動', location:'1/F 大廳', volunteer_count:9, participant_count:54 },
  { activity_date:'2025-02-04', start_time:'14:00', end_time:'15:30', organizer:'本院', activity_name:'蛇年大吉之人生日〔?〕', location:'1F/2F 大廳', volunteer_count:0, participant_count:199 },
  { activity_date:'2025-02-22', start_time:'14:30', end_time:'15:30', organizer:'基督教督〔?〕福會', activity_name:'喜相見', location:'2/F 大廳', volunteer_count:9, participant_count:64 },
  { activity_date:'2025-02-27', start_time:'14:30', end_time:'15:15', organizer:'香港青少年服務處', activity_name:'耆青樂動', location:'2/F 大廳', volunteer_count:2, participant_count:15 },
  { activity_date:'2025-03-07', start_time:'13:30', end_time:'15:15', organizer:'聯區老友運動會 / 聯合醫院外展專業服務', activity_name:'', location:'2/F 大廳', volunteer_count:18, participant_count:42 },
  { activity_date:'2025-03-29', start_time:'14:10', end_time:'15:45', organizer:'基督教督〔?〕福會', activity_name:'賀〔?〕復活節福音活動', location:'1/F 大廳', volunteer_count:7, participant_count:60 },
  { activity_date:'2025-03-15', start_time:'13:00', end_time:'16:00', organizer:'港鐵', activity_name:'義工剪髮', location:'2/F 大廳', volunteer_count:5, participant_count:63 },
  { activity_date:'2025-04-22', start_time:'14:30', end_time:'15:30', organizer:'聯合醫院外展專業服務', activity_name:'復活節的喜悅', location:'2/F 大廳', volunteer_count:6, participant_count:8 },
  // page6: 2025 items 12-22
  { activity_date:'2025-04-24', start_time:'14:15', end_time:'15:00', organizer:'浸信會愛羣社會服務處', activity_name:'義工探訪活動', location:'1/F 大廳', volunteer_count:8, participant_count:60 },
  { activity_date:'2025-04-30', start_time:'14:30', end_time:'15:45', organizer:'本院', activity_name:'嘉齡〔?〕健康嘉年華', location:'1/F 大廳', volunteer_count:0, participant_count:91 },
  { activity_date:'2025-05-08', start_time:'14:15', end_time:'15:45', organizer:'本院', activity_name:'感恩母親節', location:'1/F 大廳', volunteer_count:0, participant_count:120 },
  { activity_date:'2025-05-28', start_time:'14:30', end_time:'15:30', organizer:'聖公會外展專業服務', activity_name:'慶祝端午節', location:'1/F 大廳', volunteer_count:0, participant_count:66 },
  { activity_date:'2025-06-18', start_time:'14:30', end_time:'15:30', organizer:'聖公會外展專業服務', activity_name:'人人齊歡笑', location:'1/F 大廳', volunteer_count:0, participant_count:16 },
  { activity_date:'2025-06-22', start_time:'14:15', end_time:'15:15', organizer:'香港藝術中心', activity_name:'《雲〔?〕翔海角》藝術導賞', location:'1/F 大廳及院外花園', volunteer_count:0, participant_count:20 },
  { activity_date:'2025-06-15', start_time:'14:30', end_time:'15:30', organizer:'本院', activity_name:'感恩父親節', location:'1/F 大廳', volunteer_count:0, participant_count:98 },
  { activity_date:'2025-06-23', start_time:'14:30', end_time:'15:30', organizer:'聖公會外展專業服務', activity_name:'手部競技運動比賽', location:'1/F 大廳', volunteer_count:0, participant_count:10 },
  { activity_date:'2025-06-24', start_time:'14:45', end_time:'15:15', organizer:'本院', activity_name:'下午茶敘', location:'金閣〔?〕餐廳', volunteer_count:0, participant_count:8 },
  { activity_date:'2025-06-28', start_time:'14:30', end_time:'15:30', organizer:'基督教耆〔?〕福會', activity_name:'父親節', location:'2樓大廳', volunteer_count:9, participant_count:31 },
  { activity_date:'2025-07-30', start_time:'14:15', end_time:'15:15', organizer:'聖公會外展專業服務', activity_name:'硬地滾球運動', location:'1/F 電視廳', volunteer_count:6, participant_count:15 },
  // page5: 2025 items 23-33
  { activity_date:'2025-03-26', start_time:'14:30', end_time:'15:15', organizer:'基督教善福會', activity_name:'傳福音', location:'1/F 大廳', volunteer_count:6, participant_count:43 },
  { activity_date:'2025-07-29', start_time:'13:30', end_time:'15:30', organizer:'本院', activity_name:'照〔?〕在一起全家福', location:'1/F 大廳', volunteer_count:2, participant_count:34 },
  { activity_date:'2025-07-30', start_time:'14:00', end_time:'15:30', organizer:'本院', activity_name:'夏日成雙嘉年華', location:'1/F 大廳', volunteer_count:0, participant_count:86 },
  { activity_date:'2025-08-16', start_time:'14:30', end_time:'15:30', organizer:'基督教善福會', activity_name:'咪笑我哋老', location:'2/F 大廳', volunteer_count:5, participant_count:22 },
  { activity_date:'2025-08-11', start_time:'14:00', end_time:'16:00', organizer:'聖公會外展專業服務', activity_name:'人人唱〔?〕歡笑', location:'2/F 大廳', volunteer_count:5, participant_count:8 },
  { activity_date:'2025-08-21', start_time:'14:00', end_time:'15:00', organizer:'聖公會外展專業服務', activity_name:'硬地滾球運動', location:'2/F 大廳', volunteer_count:6, participant_count:20 },
  { activity_date:'2025-09-14', start_time:'14:00', end_time:'15:45', organizer:'智慧光慈〔?〕善基金', activity_name:'智慧歡樂', location:'1/F 大廳', volunteer_count:10, participant_count:72 },
  { activity_date:'2025-09-27', start_time:'14:30', end_time:'15:45', organizer:'基督教善福會', activity_name:'中秋頌〔?〕主情', location:'1/F 大廳', volunteer_count:7, participant_count:43 },
  { activity_date:'2025-09-30', start_time:'14:30', end_time:'15:30', organizer:'聖公會外展專業服務', activity_name:'康樂中樂團', location:'1/F 大廳', volunteer_count:8, participant_count:69 },
  { activity_date:'2025-10-06', start_time:'14:00', end_time:'16:00', organizer:'本院', activity_name:'歡渡中秋節', location:'全院', volunteer_count:0, participant_count:218 },
  { activity_date:'2025-10-20', start_time:'14:00', end_time:'15:00', organizer:'聖公會〔?〕小組', activity_name:'馬賽克杯墊', location:'2/F 大廳', volunteer_count:6, participant_count:13 },
  // page4: 2025 items 34-43
  { activity_date:'2025-10-25', start_time:'14:30', end_time:'15:30', organizer:'基督教耆福會', activity_name:'中秋頌主情〔?〕', location:'2樓大廳', volunteer_count:6, participant_count:34 },
  { activity_date:'2025-11-15', start_time:'14:10', end_time:'15:10', organizer:'耆福會(義工團)', activity_name:'', location:'1樓大廳', volunteer_count:0, participant_count:0 },
  { activity_date:'2025-11-20', start_time:'14:15', end_time:'15:30', organizer:'新〔?〕記園〔?〕協會', activity_name:'老友記多元文化交流日', location:'1/F', volunteer_count:14, participant_count:62 },
  { activity_date:'2025-11-21', start_time:'14:30', end_time:'15:30', organizer:'聖公會〔?〕外展服務', activity_name:'迷你冰壺遊戲〔?〕', location:'2/F', volunteer_count:1, participant_count:8 },
  { activity_date:'2025-11-30', start_time:'14:15', end_time:'15:30', organizer:'天〔?〕琴〔?〕戲〔?〕堂', activity_name:'義工探訪', location:'1/F', volunteer_count:20, participant_count:60 },
  { activity_date:'2025-11-05', start_time:'10:00', end_time:'15:00', organizer:'聖公會〔?〕老院舍外展', activity_name:'西九故宮遊樂團', location:'稻香、西九故宮及海濱公園', volunteer_count:2, participant_count:7 },
  { activity_date:'2025-12-16', start_time:'14:30', end_time:'15:30', organizer:'八福臨門報佳音', activity_name:'聖誕節活動', location:'1/F', volunteer_count:10, participant_count:44 },
  { activity_date:'2025-12-27', start_time:'14:30', end_time:'15:30', organizer:'耆福會-聖誕派對', activity_name:'', location:'2/F', volunteer_count:9, participant_count:39 },
  { activity_date:'2025-12-24', start_time:'14:30', end_time:'15:30', organizer:'善頤(福群)護老院-平安夜', activity_name:'善頤(福群)護老院-平安夜', location:'1/F 2/F', volunteer_count:0, participant_count:166 },
  { activity_date:'2025-12-29', start_time:'14:30', end_time:'15:30', organizer:'義〔?〕福〔?〕院外展服務', activity_name:'認知刺激治療小組', location:'1/F', volunteer_count:2, participant_count:18 },
  // page3: 2026 items 1-11
  { activity_date:'2026-01-05', start_time:'14:00', end_time:'15:30', organizer:'聖公會外展專業服務', activity_name:'新年手工填色活動', location:'1樓大廳', volunteer_count:1, participant_count:13 },
  { activity_date:'2026-01-24', start_time:'14:30', end_time:'15:30', organizer:'基督教耆福會', activity_name:'新春活動', location:'2/F大廳', volunteer_count:4, participant_count:35 },
  { activity_date:'2026-02-03', start_time:'14:30', end_time:'15:30', organizer:'聖公會-手工活動', activity_name:'手工活動', location:'2/F大廳', volunteer_count:1, participant_count:8 },
  { activity_date:'2026-02-28', start_time:'14:30', end_time:'15:30', organizer:'基督教耆福會-賀新年', activity_name:'賀新年', location:'2樓大廳', volunteer_count:3, participant_count:30 },
  { activity_date:'2026-03-04', start_time:'14:00', end_time:'15:30', organizer:'聖公會外展專業服務', activity_name:'新春桌上手工活動', location:'1樓大廳', volunteer_count:2, participant_count:12 },
  { activity_date:'2026-03-15', start_time:'14:00', end_time:'15:30', organizer:'智慧光慈善基金', activity_name:'智慧再歡聚', location:'1樓大廳', volunteer_count:10, participant_count:80 },
  { activity_date:'2026-03-28', start_time:'14:30', end_time:'15:30', organizer:'基督教耆福會', activity_name:'主賜你多福氣', location:'1樓大廳', volunteer_count:9, participant_count:52 },
  { activity_date:'2026-04-01', start_time:'14:30', end_time:'15:30', organizer:'聖公會音樂治療', activity_name:'音樂治療', location:'2樓大廳', volunteer_count:2, participant_count:8 },
  { activity_date:'2026-04-04', start_time:'14:30', end_time:'15:30', organizer:'本院', activity_name:'復活節填顏色', location:'2樓大廳', volunteer_count:0, participant_count:12 },
  { activity_date:'2026-04-03', start_time:'09:15', end_time:'10:00', organizer:'本院', activity_name:'復活節活動', location:'1樓大廳', volunteer_count:0, participant_count:13 },
  { activity_date:'2026-04-03', start_time:'14:30', end_time:'15:30', organizer:'恩〔?〕石硤尾明愛合唱團', activity_name:'宗教活動', location:'1樓大廳', volunteer_count:11, participant_count:37 },
  // page2: 2026 items 12-22
  { activity_date:'2026-04-14', start_time:'14:45', end_time:'15:45', organizer:'匯知中學', activity_name:'義工探訪', location:'1/F', volunteer_count:30, participant_count:80 },
  { activity_date:'2026-04-25', start_time:'14:30', end_time:'15:30', organizer:'基督教耆福會〔?〕', activity_name:'復活節', location:'2/F大廳', volunteer_count:9, participant_count:39 },
  { activity_date:'2026-04-28', start_time:'13:45', end_time:'14:45', organizer:'信義會〔?〕', activity_name:'義工剪髮', location:'1/F+2/F大堂', volunteer_count:0, participant_count:80 },
  { activity_date:'2026-05-04', start_time:'14:30', end_time:'15:30', organizer:'聖公會外展專業服務', activity_name:'音樂表演', location:'1/F', volunteer_count:6, participant_count:58 },
  { activity_date:'2026-05-08', start_time:'14:45', end_time:'15:45', organizer:'新家園協會', activity_name:'慶祝母親節', location:'1/F', volunteer_count:20, participant_count:31 },
  { activity_date:'2026-05-23', start_time:'14:30', end_time:'15:30', organizer:'母親節〔?〕', activity_name:'歌頌母親節', location:'1/F', volunteer_count:9, participant_count:51 },
  { activity_date:'2026-06-01', start_time:'14:30', end_time:'15:30', organizer:'聖公會外展專業服務', activity_name:'小組活動', location:'2/F', volunteer_count:2, participant_count:12 },
  { activity_date:'2026-06-14', start_time:'14:30', end_time:'15:30', organizer:'尖沙咀平安福音堂', activity_name:'探訪活動', location:'1/F', volunteer_count:27, participant_count:41 },
  { activity_date:'2026-06-17', start_time:'14:30', end_time:'15:00', organizer:'本院', activity_name:'午間茶聚', location:'金潤餐廳〔?〕', volunteer_count:0, participant_count:11 },
  { activity_date:'2026-06-18', start_time:'14:30', end_time:'15:30', organizer:'本院', activity_name:'端午糭留香', location:'1/F', volunteer_count:0, participant_count:11 },
  { activity_date:'2026-06-21', start_time:'14:30', end_time:'15:30', organizer:'基督教耆福會〔?〕', activity_name:'父親節', location:'3/F', volunteer_count:8, participant_count:33 },
  // page1: 2026 items 23-31
  { activity_date:'2026-07-06', start_time:'14:30', end_time:'15:30', organizer:'香港中國婦女會', activity_name:'友〔?〕智識長者數碼外展計劃', location:'1/F 大廳', volunteer_count:3, participant_count:21 },
  { activity_date:'2026-07-20', start_time:'14:30', end_time:'15:30', organizer:'香港中國婦女會', activity_name:'友〔?〕智識長者數碼外展計劃', location:'1/F 大廳', volunteer_count:3, participant_count:19 },
  { activity_date:'2026-07-10', start_time:'14:30', end_time:'15:30', organizer:'聖公會活動 音樂表演 - 古天樂義工團〔?〕', activity_name:'音樂表演', location:'2/F 大廳', volunteer_count:10, participant_count:72 },
  { activity_date:'2026-07-20', start_time:'14:15', end_time:'15:30', organizer:'聖公會 - PT 肌少症講座', activity_name:'PT 肌少症講座', location:'2/F 大廳', volunteer_count:3, participant_count:14 },
  { activity_date:'2026-07-25', start_time:'14:30', end_time:'15:30', organizer:'基督教耆福會', activity_name:'義工探訪-唱歌', location:'1/F 大廳', volunteer_count:8, participant_count:38 },
  { activity_date:'2026-07-27', start_time:'14:30', end_time:'15:30', organizer:'香港中國婦女會', activity_name:'友〔?〕智識長者數碼外展計劃', location:'1/F 大廳', volunteer_count:3, participant_count:20 },
  { activity_date:'2026-07-31', start_time:'14:30', end_time:'15:30', organizer:'香港中國婦女會', activity_name:'友〔?〕智識長者數碼外展計劃', location:'1/F 大廳', volunteer_count:2, participant_count:21 },
  { activity_date:'2026-08-07', start_time:'14:15', end_time:'15:15', organizer:'聖公會外展專業服務', activity_name:'硬〔?〕地滾球運動', location:'2/F 大廳', volunteer_count:2, participant_count:20 },
  { activity_date:'2026-08-22', start_time:'14:30', end_time:'15:30', organizer:'基督教耆福會', activity_name:'唱歌', location:'2/F 大廳', volunteer_count:4, participant_count:24 },
];

const payload = rows.map(r => ({ ...r, facility_id: 1 }));
const { data, error } = await sb.from('home_activities').insert(payload).select('id');
if (error) { console.error(JSON.stringify(error)); process.exit(1); }
console.log('inserted:', data.length);
