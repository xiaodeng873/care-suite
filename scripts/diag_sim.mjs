import { createClient } from '@supabase/supabase-js';
const SB = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const KEY = process.env.VITE_SUPABASE_ANON_KEY;
const sb = createClient(SB, KEY);
const fmt = (d) => `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const CUTOFF = '2025-12-01';
const pid = 33;

const { data: tasks } = await sb.from('patient_health_tasks')
  .select('id, health_record_type, specific_times, specific_days_of_week, specific_days_of_month, frequency_unit, frequency_value, start_date, created_at, last_completed_at, next_due_at, notes')
  .eq('patient_id', pid);
const { data: recs } = await sb.from('健康監測記錄')
  .select('任務id, 監測類型, 記錄日期, 記錄時間').eq('院友id', pid);

// build lookups like the app
const norm = (t) => t ? t.substring(0,5) : '';
const recordLookup = new Set(); // exact (TaskManagement style)
const recordTimes = new Map();  // tolerance (Dashboard style)
const toMin = (t) => { const [h,m]=norm(t).split(':').map(Number); return (h||0)*60+(m||0); };
for (const r of recs) {
  const nt = norm(r.記錄時間);
  if (r.任務id) { recordLookup.add(`${r.任務id}_${r.記錄日期}`); recordLookup.add(`${r.任務id}_${r.記錄日期}_${nt}`); }
  recordLookup.add(`${pid}_${r.監測類型}_${r.記錄日期}`);
  recordLookup.add(`${pid}_${r.監測類型}_${r.記錄日期}_${nt}`);
  const keys = [`${pid}_${r.監測類型}_${r.記錄日期}`];
  if (r.任務id) keys.push(`${r.任務id}_${r.記錄日期}`);
  for (const k of keys) { if (!recordTimes.has(k)) recordTimes.set(k, []); recordTimes.get(k).push(toMin(r.記錄時間)); }
}
const TOL = 30;
const hasTol = (keys, time) => { const tgt = toMin(time); return keys.some(k => (recordTimes.get(k)||[]).some(mn => Math.abs(mn-tgt)<=TOL)); };

function scheduled(task, date) {
  const target = new Date(date); target.setHours(0,0,0,0);
  if (task.frequency_unit === 'daily') {
    const fv = task.frequency_value||1;
    if (fv===1) { if (task.created_at){const c=new Date(task.created_at);c.setHours(0,0,0,0);if(target<c)return false;} return true; }
    let anchor=null;
    if (task.last_completed_at){const lc=new Date(task.last_completed_at);lc.setHours(0,0,0,0);if(target>lc)anchor=lc;}
    if(!anchor&&task.created_at){anchor=new Date(task.created_at);anchor.setHours(0,0,0,0);}
    if(anchor){const dd=Math.floor((target-anchor)/(864e5));return dd>=0&&dd%fv===0;}
    return false;
  }
  if (task.frequency_unit === 'weekly') {
    if (task.specific_days_of_week?.length>0){
      if(task.created_at){const c=new Date(task.created_at);c.setHours(0,0,0,0);if(target<c)return false;}
      const day=date.getDay(); const dbDay=day===0?7:day;
      return task.specific_days_of_week.includes(dbDay);
    }
    return false;
  }
  if (task.frequency_unit === 'monthly') {
    if(task.specific_days_of_month?.length>0){
      if(task.created_at){const c=new Date(task.created_at);c.setHours(0,0,0,0);if(target<c)return false;}
      return task.specific_days_of_month.includes(date.getDate());
    }
  }
  return false;
}

const today = new Date(); today.setHours(0,0,0,0);
const isMon = (t) => ['血壓','脈搏','體溫','呼吸','血含氧量','血糖','體重'].includes(t);

for (const task of tasks) {
  if (!isMon(task.health_record_type)) continue;
  const tstart = task.start_date ? new Date(task.start_date) : null; if(tstart)tstart.setHours(0,0,0,0);
  const ntimes = (task.specific_times||[]).map(norm);
  let dashFirst=null, tmFirst=null;
  const dashInc=[], tmInc=[];
  for (let i=0;i<=28;i++){
    const cd=new Date(today); cd.setDate(cd.getDate()-i); cd.setHours(0,0,0,0);
    const ds=fmt(cd);
    if (ds<=CUTOFF) continue;
    if (tstart && cd<tstart) continue;
    if (!scheduled(task, cd)) continue;
    // Dashboard tolerance
    let dashDone;
    if (ntimes.length>0) dashDone = ntimes.every(tm => hasTol([`${task.id}_${ds}`,`${pid}_${task.health_record_type}_${ds}`], tm));
    else dashDone = recordLookup.has(`${task.id}_${ds}`)||recordLookup.has(`${pid}_${task.health_record_type}_${ds}`);
    if (!dashDone){ dashInc.push(ds); if(!dashFirst)dashFirst=ds; }
    // TaskManagement exact
    let tmDone;
    if (ntimes.length>0) tmDone = ntimes.every(tm => recordLookup.has(`${task.id}_${ds}_${tm}`)||recordLookup.has(`${pid}_${task.health_record_type}_${ds}_${tm}`));
    else tmDone = recordLookup.has(`${task.id}_${ds}`)||recordLookup.has(`${pid}_${task.health_record_type}_${ds}`);
    if (!tmDone){ tmInc.push(ds); if(!tmFirst)tmFirst=ds; }
  }
  const todayStr=fmt(today);
  console.log(`\n[${task.health_record_type}] ${task.frequency_unit} times=${JSON.stringify(task.specific_times)} dow=${JSON.stringify(task.specific_days_of_week)} start=${task.start_date?.slice(0,10)} created=${task.created_at?.slice(0,10)}`);
  console.log(`  Dashboard firstIncomplete=${dashFirst||'null'} (${dashFirst?(dashFirst<todayStr?'逾期':dashFirst===todayStr?'今日未完成':'未來'):'-'})  inc=${JSON.stringify(dashInc)}`);
  console.log(`  TaskMgmt  firstIncomplete=${tmFirst||'null'} (${tmFirst?(tmFirst<todayStr?'逾期':tmFirst===todayStr?'今日未完成':'未來'):'-'})  inc=${JSON.stringify(tmInc)}`);
  if ((dashFirst||'')!==(tmFirst||'')) console.log('  ⚠️ 兩頁結論不同！');
}
console.log('\nToday:', fmt(today));
