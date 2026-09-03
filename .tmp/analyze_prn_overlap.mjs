import fs from 'fs';

function stripBOM(t) { return t.replace(/^\uFEFF/, ''); }

function norm(s) { return (s||'').toString().replace(/\s+/g,' ').trim(); }

// quick copy of parser
function parseCsv(text) {
  const rows = [];
  let fields = [];
  let current = '';
  let inQuotes = false;
  const chars = [...text];
  for (let i = 0; i < chars.length; i++) {
    const char = chars[i];
    const next = chars[i + 1];
    if (char === '"') {
      if (inQuotes && next === '"') { current += '"'; i++; } else { inQuotes = !inQuotes; }
      continue;
    }
    if (char === ',' && !inQuotes) { fields.push(current); current = ''; continue; }
    if ((char === '\r' || char === '\n') && !inQuotes) {
      if (char === '\r' && next === '\n') i++;
      if (fields.length > 0 || current.trim() !== '') { fields.push(current); rows.push(fields); }
      fields = []; current = ''; continue;
    }
    current += char;
  }
  if (fields.length > 0 || current.trim() !== '') { fields.push(current); rows.push(fields); }
  return rows;
}

const hms = parseCsv(stripBOM(fs.readFileSync('apps/web/public/hms.csv','utf8')));
const prn = parseCsv(stripBOM(fs.readFileSync('apps/web/public/hms_prn.csv','utf8')));

function key(bed,name,drug) {
  return `${norm(bed)}|${norm(name)}|${norm(drug)}`;
}

const hmsPrnKeys = new Set();
for (let i=1;i<hms.length;i++) {
  const row=hms[i];
  const notes = norm(row[6]);
  if (/\bPRN\b/i.test(notes) || norm(row[8]).toUpperCase()==='PRN') {
    hmsPrnKeys.add(key(row[0],row[1],row[2]));
  }
}
let dup=0, unique=0;
const uniqueRows = [];
for (let i=1;i<prn.length;i++) {
  const row=prn[i];
  const k = key(row[0],row[3],row[4]);
  if (hmsPrnKeys.has(k)) { dup++; } else { unique++; uniqueRows.push(row); }
}
console.log('hms.csv PRN rows:', hmsPrnKeys.size);
console.log('hms_prn.csv rows:', prn.length-1);
console.log('overlap:', dup);
console.log('unique in hms_prn:', unique);
for (const r of uniqueRows) console.log('unique row:', r.slice(0,10).join(' | '));
