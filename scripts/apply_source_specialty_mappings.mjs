import { createClient } from '@supabase/supabase-js';

const DRY_RUN = process.argv.includes('--dry-run');
const SUPABASE_URL = process.env.VITE_SUPABASE_URL || process.env.SUPABASE_URL;
const SERVICE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY || process.env.VITE_SUPABASE_SERVICE_ROLE_KEY;

if (!SUPABASE_URL || !SERVICE_KEY) {
  console.error('缺少環境變數');
  process.exit(1);
}

const supabase = createClient(SUPABASE_URL, SERVICE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

// 用戶提供的對照
const SOURCE_MAP = {
  'Tung Wah Group of Hospitals Wong Tai Sin Hospital': '東華三院黃大仙醫院',
  'LST': '樂善堂',
  'KWH - 廣華醫院': '廣華醫院',
  'LPC': '李寶椿普通科門診診所',
  'YMTSC': '油麻地專科診所',
  'WTSH - 東華三院黄大仙醫院': '東華三院黃大仙醫院',
  'BH': '香港佛教醫院',
  'KCH - 葵涌醫院': '葵涌醫院',
  '樂善堂': '樂善堂',
  'CMC - 明愛醫院': '明愛醫院',
  '紅磡診所': '紅磡診所',
  'KH - 九龍醫院': '九龍醫院',
  '李寶春': '李寶椿普通科門診診所',
  '長沙灣賽馬會家庭醫學診所': '長沙灣賽馬會家庭醫學診所',
  'QEH - 伊利沙伯醫院': '伊利沙伯醫院',
  '中九龍家庭醫學診所（異體）': '中九龍家庭醫學診所',
  '維晟中醫診所': '維晟中醫診所',
  'YCH - 仁濟醫院': '仁濟醫院',
  'TWEH - 東華東醫院': '東華東院',
  '南昌家庭醫學診所': '南昌家庭醫學診所',
  '東九龍專科診所(PSY)': '東九龍精神科中心',
  '中九龍家庭醫學診所': '中九龍家庭醫學診所',
  '油麻地賽馬會家庭醫學診所': '油麻地賽馬會家庭醫學診所',
  '下葵涌家庭醫學診所': '下葵涌家庭醫學診所',
};

const SPECIALTY_MAP = {
  '社區老人科外展服務': '社區老人評估小組',
  'MED': '內科',
  'EYE': '眼科',
  'FM': '家庭醫學科',
  'DERM': '皮膚科',
  'ONC': '臨床腫瘤科',
  'O&T': '矯形及創傷外科',
  'ORT': '矯形及創傷外科',
  '骨科': '矯形及創傷外科',
  '矯形及創傷及外科': '矯形及創傷外科',
  '腸胃科': '腸胃肝臟科',
  'GOPC': '普通科門診',
  'OPD': '門診部',
};

// 新增到 medication_settings
const NEW_INSTITUTIONS = {
  機構_醫管局醫院: ['東華三院黃大仙醫院', '香港佛教醫院'],
  機構_醫管局門診: ['李寶椿普通科門診診所', '紅磡診所', '長沙灣賽馬會家庭醫學診所', '南昌家庭醫學診所', '油麻地賽馬會家庭醫學診所', '下葵涌家庭醫學診所', '油麻地專科診所'],
  機構_醫管局精神科: ['東九龍精神科中心'],
  機構_衛生署: ['油麻地皮膚科診所'],
  機構_其他: ['樂善堂', '維晟中醫診所'],
};

const NEW_SPECIALTIES = ['社區老人評估小組', '社區老人精神科', '西九龍精神科中心', '矯形及創傷外科', '普通科門診', '門診部'];

async function loadSettings() {
  const { data, error } = await supabase.from('facility_settings').select('medication_settings').eq('id', 1).maybeSingle();
  if (error) throw error;
  return data?.medication_settings || {};
}

async function saveSettings(settings) {
  if (DRY_RUN) return;
  const { error } = await supabase.from('facility_settings').update({ medication_settings: settings, updated_at: new Date().toISOString() }).eq('id', 1);
  if (error) throw error;
}

async function fetchAll(table, select) {
  const PAGE = 1000;
  let all = [];
  let from = 0;
  while (true) {
    const { data, error } = await supabase.from(table).select(select).range(from, from + PAGE - 1);
    if (error) throw error;
    if (!data || data.length === 0) break;
    all.push(...data);
    if (data.length < PAGE) break;
    from += PAGE;
  }
  return all;
}

async function main() {
  console.log(`模式：${DRY_RUN ? 'DRY-RUN' : '正式執行'}`);

  const settings = await loadSettings();

  // 加入新機構
  for (const [group, names] of Object.entries(NEW_INSTITUTIONS)) {
    if (!settings[group]) settings[group] = [];
    for (const name of names) {
      if (!settings[group].includes(name)) settings[group].push(name);
    }
  }

  // 加入新專科
  if (!settings.專科) settings.專科 = [];
  for (const name of NEW_SPECIALTIES) {
    if (!settings.專科.includes(name)) settings.專科.push(name);
  }

  await saveSettings(settings);
  console.log('已更新 medication_settings');

  // 更新處方
  const prescriptions = await fetchAll('new_medication_prescriptions', 'id,medication_source,medication_source_specialty');
  let updated = 0;
  const unchanged = [];

  for (const rx of prescriptions) {
    const newSource = SOURCE_MAP[rx.medication_source] !== undefined ? SOURCE_MAP[rx.medication_source] : rx.medication_source;
    const newSpecialty = SPECIALTY_MAP[rx.medication_source_specialty] !== undefined ? SPECIALTY_MAP[rx.medication_source_specialty] : rx.medication_source_specialty;

    if (newSource !== rx.medication_source || newSpecialty !== rx.medication_source_specialty) {
      if (DRY_RUN) {
        console.log(`DRY-RUN: rx ${rx.id}: source "${rx.medication_source}" -> "${newSource}", specialty "${rx.medication_source_specialty}" -> "${newSpecialty}"`);
      } else {
        const { error } = await supabase.from('new_medication_prescriptions')
          .update({ medication_source: newSource, medication_source_specialty: newSpecialty })
          .eq('id', rx.id);
        if (error) console.error(`更新 rx ${rx.id} 失敗：${error.message}`);
        else updated += 1;
      }
    }
  }

  console.log(`\n已更新處方：${updated} 筆`);

  // 整理仍未對照的
  const stillUnknown = { sources: {}, specialties: {} };
  const after = DRY_RUN ? prescriptions.map(r => ({ ...r, medication_source: SOURCE_MAP[r.medication_source] || r.medication_source, medication_source_specialty: SPECIALTY_MAP[r.medication_source_specialty] || r.medication_source_specialty })) : await fetchAll('new_medication_prescriptions', 'id,medication_source,medication_source_specialty');

  for (const r of after) {
    const src = r.medication_source || '';
    const spec = r.medication_source_specialty || '';
    // 只列出仍未轉成中文醫院 / 已知專科的
    const isEnglishSource = src && /[A-Za-z]/.test(src) && !SOURCE_MAP[src];
    const isUnknownSpecialty = spec && !settings.專科.includes(spec);
    if (isEnglishSource) {
      if (!stillUnknown.sources[src]) stillUnknown.sources[src] = 0;
      stillUnknown.sources[src] += 1;
    }
    if (isUnknownSpecialty) {
      if (!stillUnknown.specialties[spec]) stillUnknown.specialties[spec] = 0;
      stillUnknown.specialties[spec] += 1;
    }
  }

  console.log('\n=== 仍未對照的來源 ===');
  for (const [src, count] of Object.entries(stillUnknown.sources).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${src}（${count} 筆）`);
  }
  console.log('\n=== 仍未對照的專科 ===');
  for (const [spec, count] of Object.entries(stillUnknown.specialties).sort((a, b) => b[1] - a[1])) {
    console.log(`  ${spec}（${count} 筆）`);
  }
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
