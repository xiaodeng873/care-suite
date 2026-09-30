const fs = require('fs');
const zlib = require('zlib');
const d = 'C:/Users/Admin/AppData/Local/Google/Chrome/User Data/Profile 1/Local Storage/leveldb/';
const data = fs.readFileSync(d + '027471.ldb');
const off = data.indexOf(Buffer.from('followup_message_templates_local'));
console.log('key offset:', off, 'file size:', data.length);

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

let found = false;
outer:
for (let s = Math.max(0, off - 6000); s < off + 40; s++) {
  const out = snappy(data.slice(s, s + 40000));
  if (!out) continue;
  for (const enc of ['utf8', 'utf16le']) {
    const txt = out.toString(enc);
    if (txt.includes('companion') && (txt.includes('template') || txt.includes('覆診'))) {
      console.log('SNAPPY @', s, enc);
      console.log(JSON.stringify(txt.slice(0, 3000)));
      found = true;
      break outer;
    }
  }
}
if (!found) {
  for (let s = Math.max(0, off - 6000); s < off + 40; s++) {
    try {
      const out = zlib.zstdDecompressSync(data.slice(s, s + 40000));
      const txt = out.toString('utf8');
      if (txt.includes('companion')) { console.log('ZSTD @', s); console.log(JSON.stringify(txt.slice(0, 3000))); found = true; break; }
    } catch (e) {}
  }
}
if (!found) console.log('decode failed');
