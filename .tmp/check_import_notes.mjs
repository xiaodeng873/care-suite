const KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;
const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1';
const H = { apikey: KEY, Authorization: `Bearer ${KEY}` };

async function get(path) {
  const r = await fetch(`${BASE}${path}`, { headers: H });
  const text = await r.text();
  try { return JSON.parse(text); } catch { return text; }
}

// 1. 監測記錄：備註含「匯入」、記錄人員分佈
const col1 = encodeURIComponent('備註');
const col2 = encodeURIComponent('記錄人員');
const recs = await get(`/patient_health_records?select=${col1},${col2}&limit=50000`);
const arr = Array.isArray(recs) ? recs : [];
const withImport = arr.filter(r => String(r['備註'] ?? '').includes('匯入'));
console.log('監測記錄 備註含「匯入」:', withImport.length);
console.log('樣本:', withImport.slice(0, 3).map(r => r['備註']));
const staffCount = {};
arr.forEach(r => { const v = String(r['記錄人員'] ?? ''); staffCount[v] = (staffCount[v] || 0) + 1; });
console.log('記錄人員分佈:', JSON.stringify(staffCount));

// 2. 處方：notes 含匯入 / created_by / last_modified_by
const rx = await get(`/new_medication_prescriptions?select=notes,created_by,last_modified_by&limit=50000`);
const rxArr = Array.isArray(rx) ? rx : [];
console.log('處方 notes 含「匯入」:', rxArr.filter(r => String(r.notes ?? '').includes('匯入')).length);
console.log('樣本:', rxArr.filter(r => String(r.notes ?? '').includes('匯入')).slice(0, 3).map(r => r.notes));
const cb = {}, lb = {};
rxArr.forEach(r => { cb[String(r.created_by ?? '')] = (cb[String(r.created_by ?? '')] || 0) + 1; lb[String(r.last_modified_by ?? '')] = (lb[String(r.last_modified_by ?? '')] || 0) + 1; });
console.log('處方 created_by:', JSON.stringify(cb));
console.log('處方 last_modified_by:', JSON.stringify(lb));

// 3. 工作流程記錄：staff 欄位分佈
const wf = await get(`/medication_workflow_records?select=preparation_staff,verification_staff,dispensing_staff&limit=50000`);
const wfArr = Array.isArray(wf) ? wf : [];
const ps = {}, vs = {}, ds = {};
wfArr.forEach(r => {
  ps[String(r.preparation_staff ?? '')] = (ps[String(r.preparation_staff ?? '')] || 0) + 1;
  vs[String(r.verification_staff ?? '')] = (vs[String(r.verification_staff ?? '')] || 0) + 1;
  ds[String(r.dispensing_staff ?? '')] = (ds[String(r.dispensing_staff ?? '')] || 0) + 1;
});
console.log('工作流程 preparation_staff:', JSON.stringify(ps));
console.log('工作流程 verification_staff:', JSON.stringify(vs));
console.log('工作流程 dispensing_staff:', JSON.stringify(ds));
