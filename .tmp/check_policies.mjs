import { readFileSync } from 'fs';

const env = Object.fromEntries(
  readFileSync('.env', 'utf8').split('\n')
    .filter(l => l.includes('=') && !l.trim().startsWith('#'))
    .map(l => { const i = l.indexOf('='); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; })
);

const query = `
SELECT tablename, policyname, roles, cmd
FROM pg_policies
WHERE tablename IN ('diaper_usage_records', 'diaper_change_records', 'patient_restraint_assessments')
ORDER BY tablename, cmd;
`;

const res = await fetch('https://api.supabase.com/v1/projects/mzeptzwuqvpjspxgnzkp/database/query', {
  method: 'POST',
  headers: {
    'Authorization': `Bearer ${env.SUPABASE_ACCESS_TOKEN}`,
    'Content-Type': 'application/json',
  },
  body: JSON.stringify({ query }),
});
console.log(res.ok ? await res.json() : await res.text());
