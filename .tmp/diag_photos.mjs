// 診斷：重現 getPatientPhotos() 的查詢，分別用 service_role 同 anon key
const URL = 'https://mzeptzwuqvpjspxgnzkp.supabase.co';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMjM4NjEsImV4cCI6MjA2NzU5OTg2MX0.Uo4fgr2XdUxWY5LZ5Q7A0j6XoCyuUsHhb4WO-eabJWk';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';

async function run(label, key, query) {
  const t0 = Date.now();
  try {
    const res = await fetch(`${URL}/rest/v1/${encodeURIComponent('院友主表')}?${query}`, {
      headers: { apikey: key, Authorization: `Bearer ${key}` },
    });
    const text = await res.text();
    let sizeInfo = '';
    if (res.ok) {
      const rows = JSON.parse(text);
      const withPhoto = rows.filter(r => r['院友相片']).length;
      const sampleLen = rows.find(r => r['院友相片'])?.['院友相片']?.length ?? 0;
      sizeInfo = `rows=${rows.length} withPhoto=${withPhoto} samplePhotoLen=${sampleLen} totalBytes=${text.length}`;
    }
    console.log(`[${label}] ${Date.now() - t0}ms status=${res.status} ${sizeInfo} ${res.ok ? '' : text.slice(0, 300)}`);
  } catch (e) {
    console.log(`[${label}] ${Date.now() - t0}ms FETCH ERROR: ${e.message} ${e.cause ?? ''}`);
  }
}

// 1) service_role：確認資料本身存在（只數量，唔拉 base64）
await run('service count', SERVICE, `select=${encodeURIComponent('院友id')}&limit=1000`);
await run('service photo check (5 rows)', SERVICE, `select=${encodeURIComponent('院友id,院友相片')}&${encodeURIComponent('院友相片')}=not.is.null&limit=5`);
// 2) service_role 全表相片（getPatientPhotos 實際負載）
await run('service full photos', SERVICE, `select=${encodeURIComponent('院友id,院友相片')}`);
// 3) anon key（未登入，模擬 RLS 阻擋情況）
await run('anon full photos', ANON, `select=${encodeURIComponent('院友id,院友相片')}`);
