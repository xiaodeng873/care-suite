import fs from 'fs';

// App.tsx：developer 未揀院舍且 dbToken 未簽發時，顯示等待中而非閘門
{
  const p = 'apps/web/src/App.tsx';
  let s = fs.readFileSync(p, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  let n = 0;
  const rep = (o, nw) => { if (!s.includes(o)) { console.error('APP NOT FOUND:', JSON.stringify(o.slice(0,60))); process.exit(1); } s = s.replace(o, nw); n++; };
  rep(
    'const { user, userProfile, loading: authLoading, authReady, signOut, customLogout, isAuthenticated, devFacilityChosen } = useAuth();',
    'const { user, userProfile, loading: authLoading, authReady, signOut, customLogout, isAuthenticated, devFacilityChosen, dbTokenReady } = useAuth();'
  );
  rep(
    ['  // 開發者院舍間門：未選定院舍前不得進入系統（不預設行為）','  const isDeveloperUser = !!user && !userProfile;','  if (isDeveloperUser && !devFacilityChosen) {','    return <DeveloperFacilityGate />;','  }'].join(nl),
    ['  // 開發者院舍間門：未選定院舍前不得進入系統（不預設行為）','  // dbToken 未簽發完成前顯示等待中：閘門嘅 RPC 必須帶住 dbToken，否則會以 anon 身份被拒','  const isDeveloperUser = !!user && !userProfile;','  if (isDeveloperUser && !devFacilityChosen) {','    if (!dbTokenReady) {','      return (','        <div className="min-h-screen bg-gray-50 flex items-center justify-center">','          <div className="text-center">','            <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600 mx-auto mb-4"></div>','            <p className="text-gray-600">準備院舍列表中...</p>','          </div>','        </div>','      );','    }','    return <DeveloperFacilityGate />;','  }'].join(nl)
  );
  fs.writeFileSync(p, s);
  console.log('App.tsx patched', n);
}

// DeveloperFacilityGate：效果等待 dbTokenReady
{
  const p = 'apps/web/src/components/DeveloperFacilityGate.tsx';
  let s = fs.readFileSync(p, 'utf8');
  const nl = s.includes('\r\n') ? '\r\n' : '\n';
  let n = 0;
  const rep = (o, nw) => { if (!s.includes(o)) { console.error('GATE NOT FOUND:', JSON.stringify(o.slice(0,60))); process.exit(1); } s = s.replace(o, nw); n++; };
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
}
