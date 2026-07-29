import { createClient } from '@supabase/supabase-js';
import fs from 'fs';
import path from 'path';

const envPath = path.resolve(process.cwd(), '.env');
const env = {};
if (fs.existsSync(envPath)) {
  const content = fs.readFileSync(envPath, 'utf-8');
  for (const line of content.split(/\r?\n/)) {
    const match = line.match(/^([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/);
    if (match) {
      env[match[1]] = match[2].replace(/^["']|["']$/g, '');
    }
  }
}

const supabaseUrl = env.VITE_SUPABASE_URL;
const serviceRoleKey = env.SUPABASE_SERVICE_ROLE_KEY;
if (!supabaseUrl || !serviceRoleKey) {
  console.error('缺少 VITE_SUPABASE_URL 或 SUPABASE_SERVICE_ROLE_KEY');
  process.exit(1);
}

const supabase = createClient(supabaseUrl, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false }
});

const DRY_RUN = process.argv.includes('--dry-run');

function determineClosing(patient) {
  const reason = patient.discharge_reason;
  if (reason === '留醫') return { skip: true };

  const closingDate = reason === '死亡' ? (patient.death_date || patient.退住日期) : patient.退住日期;
  let dischargeType = null;
  let dischargeDestination = null;
  let dateOfDeath = null;

  switch (reason) {
    case '死亡':
      dischargeType = 'deceased';
      dateOfDeath = patient.death_date || patient.退住日期;
      break;
    case '回家':
      dischargeType = 'home';
      break;
    case '轉往其他機構':
      dischargeType = 'transfer_out';
      dischargeDestination = patient.transfer_facility_name || '';
      break;
    default:
      return { skip: true };
  }

  return { skip: false, closingDate, dischargeType, dischargeDestination, dateOfDeath };
}

async function main() {
  const { data: patients, error: pErr } = await supabase
    .from('院友主表')
    .select('院友id, 中文姓名, 在住狀態, 退住日期, death_date, discharge_reason, transfer_facility_name')
    .eq('在住狀態', '已退住');

  if (pErr) {
    console.error('讀取院友失敗:', pErr);
    process.exit(1);
  }
  console.log(`找到 ${patients.length} 位已退住院友\n`);

  let affected = 0;
  const toClose = [];

  for (const p of patients) {
    const closing = determineClosing(p);
    if (closing.skip) {
      console.log(`[SKIP] 院友 ${p.院友id} ${p.中文姓名}：退住原因 = ${p.discharge_reason}`);
      continue;
    }

    const { data: episodes, error: eErr } = await supabase
      .from('hospital_episodes')
      .select('*, episode_events(*)')
      .eq('patient_id', p.院友id)
      .or('episode_end_date.is.null,status.in.(active,transferred)');

    if (eErr) {
      console.error(`[ERROR] 讀取 episode 失敗 院友 ${p.院友id}:`, eErr);
      continue;
    }

    for (const ep of episodes || []) {
      const events = ep.episode_events || [];
      const hasVacationStart = events.some(e => e.event_type === 'vacation_start');
      const hasVacationEnd = events.some(e => e.event_type === 'vacation_end');
      const hasAdmOrTrans = events.some(e => e.event_type === 'admission' || e.event_type === 'transfer');
      const hasDischarge = events.some(e => e.event_type === 'discharge');

      const needsVacationEnd = hasVacationStart && !hasVacationEnd;
      const needsDischarge = hasAdmOrTrans && !hasDischarge;

      if (!needsVacationEnd && !needsDischarge) continue;

      affected++;
      toClose.push({ patient: p, episode: ep, closing, needsVacationEnd, needsDischarge });
      console.log(
        `[AFFECTED] 院友 ${p.院友id} ${p.中文姓名} | 退住原因=${p.discharge_reason} | 閉合日期=${closing.closingDate} | episode=${ep.id} | start=${ep.episode_start_date} | events=[${events.map(e => e.event_type).join(',')}]`
      );
    }
  }

  console.log(`\n共 ${affected} 個未閉合 episode 需要處理`);

  if (DRY_RUN) {
    console.log('\n--dry-run 模式：未寫入任何資料');
    return;
  }

  if (affected === 0) {
    console.log('沒有需要閉合的事件');
    return;
  }

  console.log('\n開始寫入閉合事件...');
  for (const item of toClose) {
    const { patient, episode, closing, needsVacationEnd, needsDischarge } = item;
    const events = episode.episode_events || [];
    const baseOrder = events.length * 10;
    const newEvents = [];

    const sortedEvents = [...events].sort((a, b) => {
      const ta = new Date(`${a.event_date} ${a.event_time || '00:00'}`).getTime();
      const tb = new Date(`${b.event_date} ${b.event_time || '00:00'}`).getTime();
      return tb - ta;
    });
    const lastHospitalEvent = sortedEvents.find(e => e.event_type === 'admission' || e.event_type === 'transfer');

    if (needsVacationEnd) {
      newEvents.push({
        episode_id: episode.id,
        event_type: 'vacation_end',
        event_date: closing.closingDate,
        event_time: null,
        hospital_name: episode.primary_hospital || '',
        hospital_ward: episode.primary_ward || '',
        hospital_bed_number: episode.primary_bed_number || '',
        remarks: '自動閉合：院友退住',
        event_order: baseOrder + 10,
        vacation_end_type: closing.dischargeType,
        vacation_destination: closing.dischargeDestination
      });
    }

    if (needsDischarge) {
      newEvents.push({
        episode_id: episode.id,
        event_type: 'discharge',
        event_date: closing.closingDate,
        event_time: null,
        hospital_name: lastHospitalEvent?.hospital_name || episode.primary_hospital || '',
        hospital_ward: lastHospitalEvent?.hospital_ward || episode.primary_ward || '',
        hospital_bed_number: lastHospitalEvent?.hospital_bed_number || episode.primary_bed_number || '',
        remarks: '自動閉合：院友退住',
        event_order: baseOrder + 20
      });
    }

    for (const ev of newEvents) {
      const { error: insertErr } = await supabase.from('episode_events').insert(ev);
      if (insertErr) {
        console.error(`[ERROR] 插入 episode_events 失敗 episode=${episode.id}:`, insertErr);
      } else {
        console.log(`[INSERTED] episode=${episode.id} event_type=${ev.event_type} event_date=${ev.event_date}`);
      }
    }

    const update = {
      episode_end_date: closing.closingDate,
      status: 'completed',
      discharge_type: needsDischarge ? closing.dischargeType : episode.discharge_type,
      discharge_destination: (needsDischarge && closing.dischargeType === 'transfer_out') ? closing.dischargeDestination : episode.discharge_destination,
      vacation_end_type: needsVacationEnd ? closing.dischargeType : episode.vacation_end_type,
      date_of_death: closing.dateOfDeath
    };

    const { error: updateErr } = await supabase
      .from('hospital_episodes')
      .update(update)
      .eq('id', episode.id);

    if (updateErr) {
      console.error(`[ERROR] 更新 hospital_episodes 失敗 episode=${episode.id}:`, updateErr);
    } else {
      console.log(`[UPDATED] episode=${episode.id} status=completed episode_end_date=${closing.closingDate}`);
    }
  }

  console.log('\n處理完成');
}

main().catch(err => {
  console.error(err);
  process.exit(1);
});
