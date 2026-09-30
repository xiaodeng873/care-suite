// 由 Chrome leveldb 抽出開發者覆診模板 JSON（保持原文）
const fs = require('fs');
const d = 'C:/Users/Admin/AppData/Local/Google/Chrome/User Data/Profile 1/Local Storage/leveldb/';
const data = fs.readFileSync(d + '027471.ldb');
const off = data.indexOf(Buffer.from('followup_message_templates_local'));

function snappy(buf) {
  let p = 0;
  const readVarint = () => { let r = 0, s = 0; for (;;) { const b = buf[p++]; r |= (b & 0x7f) << s; if (!(b & 0x80)) return r; s += 7; if (s > 35) return -1; } };
  const len = readVarint();
  if (len < 0 || len > 1000000) return null;
  const out = Buffer.alloc(len);
  let op = 0;
  try {
    while (op < len) {
      const tag = buf[p++];
      const t = tag & 3;
      if (t === 0) {
        let l = tag >> 2;
        if (l >= 60) { const n = l - 59; l = 0; for (let i = 0; i < n; i++) l |= buf[p++] << (8 * i); }
        l += 1;
        if (op + l > len) return null;
        buf.copy(out, op, p, p + l); p += l; op += l;
      } else {
        let l, o;
        if (t === 1) { l = 4 + ((tag >> 2) & 7); o = ((tag >> 5) << 8) | buf[p++]; }
        else if (t === 2) { l = 1 + (tag >> 2); o = buf[p] | (buf[p+1] << 8); p += 2; }
        else { l = 1 + (tag >> 2); o = buf[p] | (buf[p+1] << 8) | (buf[p+2] << 16) | (buf[p+3] << 24); p += 4; }
        if (o > op || op + l > len) return null;
        for (let i = 0; i < l; i++) { out[op] = out[op - o]; op++; }
      }
    }
    return op === len ? out : null;
  } catch (e) { return null; }
}

const needle8 = '{"companion"';
const needle16 = '{"companion"';
let obj = null;

for (let s = Math.max(0, off - 6000); s < off + 40 && !obj; s++) {
  const out = snappy(data.slice(s, s + 40000));
  if (!out) continue;
  for (const [enc, needle] of [['utf8', needle8], ['utf16le', needle16]]) {
    const txt = out.toString(enc);
    const i = txt.indexOf(needle);
    if (i === -1) continue;
    let depth = 0, end = -1;
    for (let j = i; j < txt.length; j++) {
      if (txt[j] === '{') depth++;
      else if (txt[j] === '}') { depth--; if (depth === 0) { end = j + 1; break; } }
    }
    if (end === -1) continue;
    try {
      const cand = JSON.parse(txt.slice(i, end));
      if (cand.companion?.template && cand.taxi?.template && cand.family?.template) {
        obj = cand;
        console.log('found @ offset', s, enc);
        break;
      }
    } catch (e) { /* 繼續試 */ }
  }
}
if (!obj) { console.error('JSON not found'); process.exit(1); }
fs.writeFileSync('.tmp/followup_dev_templates.json', JSON.stringify(obj), 'utf8');
console.log('saved keys:', Object.keys(obj).join(','));
