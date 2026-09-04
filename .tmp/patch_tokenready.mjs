import fs from 'fs';
const p = 'apps/web/src/context/AuthContext.tsx';
let s = fs.readFileSync(p, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
let n = 0;
const rep = (oldStr, newStr) => {
  if (!s.includes(oldStr)) { console.error('NOT FOUND:', JSON.stringify(oldStr.slice(0, 70))); process.exit(1); }
  s = s.replace(oldStr, newStr); n++;
};

// 1. context interface 加 dbTokenReady
rep(
  ['  dbFacilityId: number | null;'].join(nl),
  ['  dbFacilityId: number | null;','  // dbToken 已簽發並寫入 localStorage（閘門等 RPC 必須等呢個 flag 先好發請求）','  dbTokenReady: boolean;'].join(nl)
);

// 2. provider state
rep(
  ['  const [dbFacilityId, setDbFacilityId] = useState<number | null>(() =>','    parseFacilityIdFromToken(localStorage.getItem(DB_TOKEN_KEY))','  );'].join(nl),
  ['  const [dbFacilityId, setDbFacilityId] = useState<number | null>(() =>','    parseFacilityIdFromToken(localStorage.getItem(DB_TOKEN_KEY))','  );','  const [dbTokenReady, setDbTokenReady] = useState<boolean>(() => !!localStorage.getItem(DB_TOKEN_KEY));'].join(nl)
);

// 3. 六個 saveDbToken 點補 setDbTokenReady(true)——用逐點上下文唯一匹配
rep(['        saveDbToken(result.dbToken);','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','        return true;'].join(nl),
    ['        saveDbToken(result.dbToken);','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','        setDbTokenReady(true);','        return true;'].join(nl));
rep(['          saveDbToken(result.dbToken);','          setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','          // 內容有變才更新 state'].join(nl),
    ['          saveDbToken(result.dbToken);','          setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','          setDbTokenReady(true);','          // 內容有變才更新 state'].join(nl));
rep(['        saveDbToken(result.dbToken);','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','        // 清掉舊院舍的快取資料與設定'].join(nl),
    ['        saveDbToken(result.dbToken);','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','        setDbTokenReady(true);','        // 清掉舊院舍的快取資料與設定'].join(nl));
rep(['        saveDbToken(result.dbToken);','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','      } catch (dbTokenError) {'].join(nl),
    ['        saveDbToken(result.dbToken);','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','        setDbTokenReady(true);','      } catch (dbTokenError) {'].join(nl));
// customLogin + qrLogin（同樣模式出現兩次，逐次替換第一個出現）
rep(['        saveDbToken(result.dbToken);','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','        ','        // 保存到本地存儲'].join(nl),
    ['        saveDbToken(result.dbToken);','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','        setDbTokenReady(true);','        ','        // 保存到本地存儲'].join(nl));
rep(['        saveDbToken(result.dbToken);','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','        ','        // 保存到本地存儲'].join(nl),
    ['        saveDbToken(result.dbToken);','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','        setDbTokenReady(true);','        ','        // 保存到本地存儲'].join(nl));

// 4. 三個 clearDbToken 點補 setDbTokenReady(false)
rep(['            clearDbToken();','            setDbFacilityId(null);'].join(nl),
    ['            clearDbToken();','            setDbFacilityId(null);','            setDbTokenReady(false);'].join(nl));
rep(['  const signOut = async () => {','    clearDbToken();','    setDbFacilityId(null);'].join(nl),
    ['  const signOut = async () => {','    clearDbToken();','    setDbFacilityId(null);','    setDbTokenReady(false);'].join(nl));
rep(['      clearDbToken();','      setDbFacilityId(null);'].join(nl),
    ['      clearDbToken();','      setDbFacilityId(null);','      setDbTokenReady(false);'].join(nl));

// 5. provider value 暴露
rep(['      dbFacilityId,'].join(nl),
    ['      dbFacilityId,','      dbTokenReady,'].join(nl));

fs.writeFileSync(p, s);
console.log('patched', n, 'spots');
