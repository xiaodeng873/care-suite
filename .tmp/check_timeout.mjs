import { createClient } from '@supabase/supabase-js';
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Im16ZXB0end1cXZwanNweGduemtwIiwicm9sZSI6InNlcnZpY2Vfcm9sZSIsImlhdCI6MTc1MjAyMzg2MSwiZXhwIjoyMDY3NTk5ODYxfQ.0oSxZUVTom9d9nyD_tWUMlbmyeg0rTQSiSFu4FM7bSc', { auth: { autoRefreshToken: false, persistSession: false } });
const sql = `SELECT rolname, rolconfig FROM pg_roles WHERE rolname IN ('anon','authenticated','service_role','postgres') ORDER BY rolname`;
const { data, error } = await supabase.rpc('exec_sql', { sql_string: sql });
console.log(error ? `err: ${error.message}` : JSON.stringify(data, null, 2));
// 資料庫層級設定
const { data: dbCfg, error: e2 } = await supabase.rpc('exec_sql', { sql_string: `SELECT datname, datconfig FROM pg_database WHERE datname = 'postgres'` });
console.log(e2 ? `err: ${e2.message}` : JSON.stringify(dbCfg));
