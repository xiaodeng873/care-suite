const BASE = 'https://mzeptzwuqvpjspxgnzkp.supabase.co/rest/v1/rpc/diag_role_timeout';
const ANON = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NTIwMjM0NjEsImV4cCI6MjA2NzU5OTg2MX0.Uo4fgr2XdUxWY5LZ5Q7A0j6XoCyuUsHhb4WO-eabJWk';
const SERVICE = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc';
for (const [name, key] of [['anon', ANON], ['service_role', SERVICE]]) {
  const r = await fetch(BASE, { method: 'POST', headers: { apikey: key, Authorization: `Bearer ${key}`, 'Content-Type': 'application/json' }, body: '{}' });
  console.log(name, r.status, await r.text());
}
