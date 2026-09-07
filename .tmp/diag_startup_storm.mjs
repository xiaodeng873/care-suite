// [DEBUG-loop] 模擬 App 登入啟動時對 健康監測記錄 的查詢風暴，量度 57014 失敗率
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';
const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1';
const TABLE = '/%E5%81%A5%E5%BA%B7%E7%9B%A3%E6%B8%AC%E8%A8%98%E9%8C%84';
const ORDER = '&order=%E8%A8%98%E9%8C%84%E6%97%A5%E6%9C%9F.desc,%E8%A8%98%E9%8C%84%E6%99%82%E9%96%93.desc,%E8%A8%98%E9%8C%84id.desc';

async function fetchPage(from, to, withCount, dateGte) {
  const url = `${BASE}${TABLE}?select=*${dateGte ? `&%E8%A8%98%E9%8C%84%E6%97%A5%E6%9C%9F=gte.${dateGte}` : ''}${ORDER}`;
  const t0 = Date.now();
  const r = await fetch(url, {
    headers: {
      apikey: ANON,
      Authorization: `Bearer ${ANON}`,
      'Range-Unit': 'items',
      Range: `${from}-${to}`,
      Prefer: withCount ? 'count=exact' : 'return=representation',
    },
  });
  const ms = Date.now() - t0;
  if (!r.ok) {
    const text = await r.text();
    const code = text.match(/"code":"(\d+)"/)?.[1] || r.status;
    return { error: code, ms, data: null, count: null };
  }
  const data = await r.json();
  const cr = r.headers.get('content-range');
  const count = cr && cr.includes('/') ? parseInt(cr.split('/')[1], 10) : null;
  return { error: null, ms, data, count };
}

async function loadAll(label, dateGte, concurrency = 6) {
  const t0 = Date.now();
  const first = await fetchPage(0, 999, true, dateGte);
  if (first.error) return { label, error: first.error, ms: Date.now() - t0, rows: 0 };
  const total = first.count ?? first.data.length;
  const totalPages = Math.max(1, Math.ceil(total / 1000));
  let rows = first.data.length;
  for (let p = 1; p < totalPages; p += concurrency) {
    const batch = await Promise.all(
      Array.from({ length: Math.min(concurrency, totalPages - p) }, (_, j) => {
        const pageNo = p + j;
        return fetchPage(pageNo * 1000, (pageNo + 1) * 1000 - 1, false, dateGte);
      })
    );
    for (const r of batch) {
      if (r.error) return { label, error: r.error, ms: Date.now() - t0, rows };
      rows += r.data.length;
    }
  }
  return { label, error: null, ms: Date.now() - t0, rows, total };
}

const cutoff = new Date(Date.now() - 180 * 86400000).toISOString().split('T')[0];

console.log('=== 基準：單獨執行 ===');
console.log(await loadAll('180日', cutoff));
console.log(await loadAll('全表', null));

console.log('\n=== 5 輪啟動風暴（180日 + 全表 + 全表 同時）===');
for (let round = 1; round <= 5; round++) {
  const results = await Promise.all([
    loadAll(`R${round}-180日`, cutoff),
    loadAll(`R${round}-全表A`, null),
    loadAll(`R${round}-全表B`, null),
  ]);
  for (const r of results) console.log(JSON.stringify(r));
  await new Promise(res => setTimeout(res, 3000));
}
