import fs from 'fs';
const p = 'apps/web/src/App.tsx';
let s = fs.readFileSync(p, 'utf8');
let n = 0;
const rep = (o, nw) => { if (!s.includes(o)) { console.error('NOT FOUND:', JSON.stringify(o.slice(0,60))); process.exit(1); } s = s.replace(o, nw); n++; };
rep(
  'const { user, userProfile, loading: authLoading, authReady, signOut, customLogout, isAuthenticated, devFacilityChosen } = useAuth();',
  'const { user, userProfile, loading: authLoading, authReady, signOut, customLogout, isAuthenticated, devFacilityChosen, dbTokenReady } = useAuth();'
);
rep(
  '  const isDeveloperUser = !!user && !userProfile;\n  if (isDeveloperUser && !devFacilityChosen) {\n    return <DeveloperFacilityGate />;\n  }',
  '  const isDeveloperUser = !!user && !userProfile;\n  if (isDeveloperUser && !devFacilityChosen) {\n    // dbToken 未簽發完成前顯示等待中：閘門 RPC 必須帶住 dbToken，否則會以 anon 身份被拒（42501）\n    if (!dbTokenReady) {\n      return (\n        <div className="min-h-screen bg-gray-50 flex items-center justify-center">\n          <div className="text-center">\n            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>\n            <p className="text-gray-600">準備院舍列表中...</p>\n          </div>\n        </div>\n      );\n    }\n    return <DeveloperFacilityGate />;\n  }'
);
fs.writeFileSync(p, s);
console.log('App.tsx patched', n);
