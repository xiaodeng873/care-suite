import { createClient } from '@supabase/supabase-js';
import { readFileSync } from 'fs';
const key = readFileSync('.env.example', 'utf8').match(/^SUPABASE_SERVICE_ROLE_KEY=(.+)$/m)[1].trim();
const supabase = createClient('https://mzeptzwuqvpjspxgnzkp.supabase.co', key, { auth: { autoRefreshToken: false, persistSession: false } });
const { count } = await supabase.from('home_activities').select('*', { count: 'exact', head: true });
console.log('home_activities 總列數:', count);
