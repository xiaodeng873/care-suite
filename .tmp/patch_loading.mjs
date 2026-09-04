import fs from 'fs';
const p = 'apps/web/src/App.tsx';
let s = fs.readFileSync(p, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
const oldStr = [
'    const canHide = showInitialLoadingScreen && ',
'                    allDataLoaded && ',
'                    hasEssentialData && ',
'                    minTimeElapsed && ',
'                    (isDashboardReady || fallbackTimeout);',
].join(nl);
const newStr = [
'    // 快速通道：全部資料就緒 + Dashboard 報告 ready',
'    // 保證通道：8 秒 fallback 一到就放行（不再依賴 allDataLoaded / hasEssentialData），',
'    // 避免任何一個 context 超時或報錯時永遠卡在 loading 頁',
'    const canHide = showInitialLoadingScreen && ',
'                    minTimeElapsed && ',
'                    (fallbackTimeout || (allDataLoaded && hasEssentialData && isDashboardReady));',
].join(nl);
if (!s.includes(oldStr)) { console.error('NOT FOUND'); process.exit(1); }
s = s.replace(oldStr, newStr);
fs.writeFileSync(p, s);
console.log('patched');
