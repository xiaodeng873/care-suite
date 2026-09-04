import fs from 'fs';
const p = 'apps/web/src/components/DeveloperFacilityGate.tsx';
let s = fs.readFileSync(p, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
let n = 0;
const rep = (o, nw) => { if (!s.includes(o)) { console.error('NOT FOUND:', JSON.stringify(o.slice(0,60))); process.exit(1); } s = s.replace(o, nw); n++; };
rep(
  'const { fetchFacilities, selectFacility, createFacility, suspendFacility, resumeFacility, deleteFacility } = useAuth();',
  'const { fetchFacilities, selectFacility, createFacility, suspendFacility, resumeFacility, deleteFacility, dbTokenReady } = useAuth();'
);
rep(
  ['  useEffect(() => {','    reload();','    // eslint-disable-next-line react-hooks/exhaustive-deps','  }, []);'].join(nl),
  ['  useEffect(() => {','    // dbToken 未簽發完成前唔好發 RPC：無 token 會以 anon 身份被拒（42501）','    if (!dbTokenReady) return;','    reload();','    // eslint-disable-next-line react-hooks/exhaustive-deps','  }, [dbTokenReady]);'].join(nl)
);
fs.writeFileSync(p, s);
console.log('Gate patched', n);
