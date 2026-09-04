import fs from 'fs';
const src = fs.readFileSync('supabase/migrations/20260904110000_multi_tenant_rls.sql', 'utf8');
const m = src.match(/AND tablename = ANY \(ARRAY\[(.*?)\]\)/s);
let tables = [...m[1].matchAll(/'([^']+)'/g)].map(x => x[1]);
tables = tables.filter(t => t !== 'user_sessions' && t !== 'facilities' && t !== 'user_profiles');
const MWS = 'medication_workflow_settings';
const q = (t) => /^[\x00-\x7F]+$/.test(t) ? t : `"${t}"`;
let out = `/*
  # 多租戶改造（P2 修正 2）：院舍停用（中止登入）機制

  1. facilities 加 auth_epoch：中止登入時 +1，已簽發的 dbToken 即失效
  2. jwt_facility_active()：token 對應院舍必須啟用中且 epoch 相符
  3. 67 張 tenant 表 policy 加入「院舍啟用中」檢查：
     - 未鎖定院舍的 developer（維運）不變
     - 一般/已鎖定院舍的用戶：facility_id 相符 且 院舍啟用中 且 epoch 相符
  user_profiles / user_sessions / facilities 維持原 policy。
*/

ALTER TABLE facilities ADD COLUMN IF NOT EXISTS auth_epoch integer NOT NULL DEFAULT 0;
COMMENT ON COLUMN facilities.auth_epoch IS '登入權杖版號；中止院舍登入時 +1，舊 dbToken 全部失效';

CREATE OR REPLACE FUNCTION public.jwt_facility_active() RETURNS boolean
LANGUAGE sql STABLE AS $func$
  SELECT COALESCE((
    SELECT is_active AND auth_epoch = NULLIF(auth.jwt() ->> 'epoch', '')::int
    FROM facilities
    WHERE id = public.jwt_facility_id()
  ), true)
$func$;

`;
for (const t of tables) {
  const cond = t === MWS
    ? '(public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR facility_id IS NULL OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active())'
    : '(public.jwt_is_developer() AND public.jwt_facility_id() IS NULL) OR (facility_id = public.jwt_facility_id() AND public.jwt_facility_active())';
  out += `DROP POLICY IF EXISTS "tenant_isolation" ON ${q(t)};\n`;
  out += `CREATE POLICY "tenant_isolation" ON ${q(t)} FOR ALL TO authenticated\n`;
  out += `  USING (${cond})\n`;
  out += `  WITH CHECK (${cond});\n\n`;
}
fs.writeFileSync('supabase/migrations/20260904130000_facility_suspend.sql', out);
console.log('tables:', tables.length, '(expect 67)');
