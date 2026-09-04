import fs from 'fs';
const p = 'apps/web/src/App.tsx';
let s = fs.readFileSync(p, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
let n = 0;
const rep = (o, nw) => { if (!s.includes(o)) { console.error('NOT FOUND:', JSON.stringify(o.slice(0,70))); process.exit(1); } s = s.replace(o, nw); n++; };

// 1. fallback effect 加 hard timer：10 秒後直接移除，唔經 canHide
rep(
  ['      // 備用超時：如果 8 秒後 Dashboard 仍未報告 ready，強制進入','      const fallbackTimer = setTimeout(() => {','        console.log(\'[Loading] Fallback timeout triggered\');','        setFallbackTimeout(true);','      }, 8000);','      ','      return () => clearTimeout(fallbackTimer);'].join(nl),
  ['      // 備用超時：如果 8 秒後 Dashboard 仍未報告 ready，強制進入','      const fallbackTimer = setTimeout(() => {','        console.log(\'[Loading] Fallback timeout triggered\');','        setFallbackTimeout(true);','      }, 8000);','      ','      // 強制退出（最後防線）：10 秒後無論任何狀態直接移除 loading 畫面，','      // 唔再依賴 canHide effect 或其他 state（切換院舍重掛後 state 重置可能令 canHide 條件永遠唔齊），','      // 保證用戶一定可以進入系統','      const hardTimer = setTimeout(() => {','        console.log(\'[Loading] Hard timeout - force hide loading screen\');','        setShowInitialLoadingScreen(false);','      }, 10000);','      ','      return () => { clearTimeout(fallbackTimer); clearTimeout(hardTimer); };'].join(nl)
);

// 2. canHide：fallbackTimeout 唔再要求 minTimeElapsed（「強制進入」唔應被最短顯示時間綁住）
rep(
  ['    const canHide = showInitialLoadingScreen && ','                    minTimeElapsed && ','                    (fallbackTimeout || (allDataLoaded && hasEssentialData && isDashboardReady));'].join(nl),
  ['    const canHide = showInitialLoadingScreen && ','                    (fallbackTimeout ||','                     (minTimeElapsed && allDataLoaded && hasEssentialData && isDashboardReady));'].join(nl)
);

fs.writeFileSync(p, s);
console.log('patched', n, 'spots');
