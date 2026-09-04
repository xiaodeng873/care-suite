import fs from 'fs';
const p = 'apps/web/src/context/AuthContext.tsx';
let s = fs.readFileSync(p, 'utf8');
const nl = s.includes('\r\n') ? '\r\n' : '\n';
let n = 0;
const rep = (oldStr, newStr) => {
  if (!s.includes(oldStr)) { console.error('NOT FOUND:', oldStr.slice(0, 60)); process.exit(1); }
  s = s.replace(oldStr, newStr); n++;
};

// 1. 清理 validateCustomToken 重複行
rep(
  ['        saveDbToken(result.dbToken);','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','      setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));'].join(nl),
  ['        saveDbToken(result.dbToken);','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));'].join(nl)
);

// 2. refreshSession：補 setDbFacilityId（值不變時 React 會擋住多餘 re-render）
rep(
  ['        if (result.success) {','          saveDbToken(result.dbToken);','          // 內容有變才更新 state，避免無謂的全域 re-render'].join(nl),
  ['        if (result.success) {','          saveDbToken(result.dbToken);','          setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','          // 內容有變才更新 state，避免無謂的全域 re-render'].join(nl)
);

// 3. selectFacility：關鍵修復——切院舍後同步 dbFacilityId，觸發 FacilityScoped 重掛
rep(
  ['        saveDbToken(result.dbToken);','        // 清掉舊院舍的快取資料與設定，避免切換後仍顯示上一間院舍的數據/名稱'].join(nl),
  ['        saveDbToken(result.dbToken);','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','        // 清掉舊院舍的快取資料與設定，避免切換後仍顯示上一間院舍的數據/名稱'].join(nl)
);

// 4. signIn（developer 登入）
rep(
  ['        saveDbToken(result.dbToken);','      } catch (dbTokenError) {'].join(nl),
  ['        saveDbToken(result.dbToken);','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','      } catch (dbTokenError) {'].join(nl)
);

// 5. customLogin
rep(
  ['        saveDbToken(result.dbToken);','        ','        // 保存到本地存儲'].join(nl),
  ['        saveDbToken(result.dbToken);','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','        ','        // 保存到本地存儲'].join(nl)
);

// 6. qrLogin（同樣模式，第二次出現）
rep(
  ['        saveDbToken(result.dbToken);','        ','        // 保存到本地存儲'].join(nl),
  ['        saveDbToken(result.dbToken);','        setDbFacilityId(parseFacilityIdFromToken(result.dbToken));','        ','        // 保存到本地存儲'].join(nl)
);

// 7. signOut + customLogout：補 setDbFacilityId(null)
rep(
  ['  const signOut = async () => {','    clearDbToken();','    setDevFacilityChosen(false);'].join(nl),
  ['  const signOut = async () => {','    clearDbToken();','    setDbFacilityId(null);','    setDevFacilityChosen(false);'].join(nl)
);
rep(
  ['      clearDbToken();','    }','  };','','  // 修改密碼'].join(nl),
  ['      clearDbToken();','      setDbFacilityId(null);','    }','  };','','  // 修改密碼'].join(nl)
);

fs.writeFileSync(p, s);
console.log('patched', n, 'spots');
