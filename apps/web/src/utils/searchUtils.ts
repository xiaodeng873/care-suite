/**
 * 模糊搜索工具函數
 * 支持中英文姓名逐字匹配（非連續字符匹配）
 */

/**
 * 逐字符模糊匹配
 * 檢查搜索詞中的每個字符是否按順序出現在目標字符串中
 * 例如：搜索 "王明" 可以匹配 "王小明"
 *       搜索 "jd" 可以匹配 "John Doe"
 * 
 * @param target 目標字符串
 * @param search 搜索詞
 * @returns 是否匹配
 */
export function fuzzyMatch(target: string | null | undefined, search: string): boolean {
  if (!target || !search) return false;
  
  const targetLower = target.toLowerCase();
  const searchLower = search.toLowerCase();
  
  // 如果搜索詞是連續子字符串，直接返回 true（優先精確匹配）
  if (targetLower.includes(searchLower)) {
    return true;
  }
  
  // 逐字符模糊匹配：檢查搜索詞中的每個字符是否按順序出現在目標字符串中
  let targetIndex = 0;
  for (let i = 0; i < searchLower.length; i++) {
    const searchChar = searchLower[i];
    let found = false;
    
    while (targetIndex < targetLower.length) {
      if (targetLower[targetIndex] === searchChar) {
        found = true;
        targetIndex++;
        break;
      }
      targetIndex++;
    }
    
    if (!found) {
      return false;
    }
  }
  
  return true;
}

/**
 * 多字段模糊搜索
 * 在多個字段中進行逐字符模糊匹配
 * 
 * @param fields 要搜索的字段值數組
 * @param search 搜索詞
 * @returns 是否有任何字段匹配
 */
export function fuzzyMatchAny(fields: (string | null | undefined)[], search: string): boolean {
  if (!search) return true;
  return fields.some(field => fuzzyMatch(field, search));
}

/**
 * 標準搜索匹配（包含精確子字符串匹配）
 * 用於不需要模糊匹配的場景
 * 
 * @param target 目標字符串
 * @param search 搜索詞
 * @returns 是否匹配
 */
export function includesMatch(target: string | null | undefined, search: string): boolean {
  if (!target || !search) return false;
  return target.toLowerCase().includes(search.toLowerCase());
}

/**
 * 姓名搜索匹配
 * 同時搜索完整姓名（姓氏+名字的拼接）和各個部分
 * 解決跨字段搜索問題，例如搜索 "周秀" 可以匹配 姓氏="周" + 名字="秀貞"
 * 
 * @param surname 姓氏
 * @param givenName 名字
 * @param fullName 完整姓名字段（可選，如資料庫中已存儲）
 * @param search 搜索詞
 * @returns 是否匹配
 */
export function matchChineseName(
  surname: string | null | undefined,
  givenName: string | null | undefined,
  fullName: string | null | undefined,
  search: string
): boolean {
  if (!search) return true;
  
  // 先搜索現有的完整姓名字段
  if (fuzzyMatch(fullName, search)) return true;
  
  // 搜索姓氏
  if (fuzzyMatch(surname, search)) return true;
  
  // 搜索名字
  if (fuzzyMatch(givenName, search)) return true;
  
  // 搜索手動拼接的完整姓名（解決跨姓氏+名字的搜索）
  const combinedName = `${surname || ''}${givenName || ''}`;
  if (combinedName && fuzzyMatch(combinedName, search)) return true;
  
  return false;
}

/**
 * 英文姓名搜索匹配
 * 同時搜索完整姓名（姓氏+空格+名字的拼接）和各個部分
 * 
 * @param surname 姓氏
 * @param givenName 名字
 * @param fullName 完整姓名字段（可選）
 * @param search 搜索詞
 * @returns 是否匹配
 */
export function matchEnglishName(
  surname: string | null | undefined,
  givenName: string | null | undefined,
  fullName: string | null | undefined,
  search: string
): boolean {
  if (!search) return true;
  
  // 先搜索現有的完整姓名字段
  if (fuzzyMatch(fullName, search)) return true;
  
  // 搜索姓氏
  if (fuzzyMatch(surname, search)) return true;
  
  // 搜索名字
  if (fuzzyMatch(givenName, search)) return true;
  
  // 搜索拼接的英文姓名（姓 名 和 名 姓 兩種順序）
  const combinedName1 = [surname, givenName].filter(Boolean).join(' ');
  const combinedName2 = [givenName, surname].filter(Boolean).join(' ');
  
  if (combinedName1 && fuzzyMatch(combinedName1, search)) return true;
  if (combinedName2 && fuzzyMatch(combinedName2, search)) return true;
  
  return false;
}

/**
 * 床號自然排序比較（數字部分按數值比較，例如 2 < 21 < 22 < 100，A1 < A2 < A10）
 */
export function compareBedNumbers(a: string | null | undefined, b: string | null | undefined): number {
  const aa = (a || '').trim();
  const bb = (b || '').trim();
  if (!aa && !bb) return 0;
  if (!aa) return 1;
  if (!bb) return -1;
  return aa.localeCompare(bb, 'zh-Hant', { numeric: true, sensitivity: 'base' });
}

/**
 * 床號搜尋配對排名（越小越優先；-1 代表不配對）
 * 規則：搜尋詞作為連續子字串出現的位置，前綴(首字)配對最優先，否則看出現的位置（次字、再次字…）。
 * 例如搜尋 "2"：21、22 皆首字配對(0)，再以床號自然排序 21 在 22 前。
 *               若床號為 A2，配對位置為 1（次字），排在 0 之後。
 */
export function bedMatchRank(bed: string | null | undefined, search: string): number {
  if (!bed) return -1;
  if (!search) return 0;
  return bed.toLowerCase().indexOf(search.toLowerCase());
}

/**
 * 是否配對床號（連續子字串）
 */
export function matchBedNumber(bed: string | null | undefined, search: string): boolean {
  return bedMatchRank(bed, search) >= 0;
}

/**
 * 院友搜尋排序比較：優先床號配對位置，再床號自然排序。
 * 用於 sorting 表格與 autocomplete，需先以 search 過濾後套用。
 */
export function comparePatientsForSearch(
  a: { 床號?: string | null },
  b: { 床號?: string | null },
  search: string
): number {
  if (search) {
    const ra = bedMatchRank(a.床號, search);
    const rb = bedMatchRank(b.床號, search);
    // 兩者皆無床號命中：不介入排序，交由表頭欄決定
    if (ra < 0 && rb < 0) return 0;
    const sa = ra < 0 ? Number.MAX_SAFE_INTEGER : ra;
    const sb = rb < 0 ? Number.MAX_SAFE_INTEGER : rb;
    if (sa !== sb) return sa - sb;
  }
  return compareBedNumbers(a.床號, b.床號);
}

/**
 * 提取字符串的首個非空格字符
 */
function getFirstCharacter(text: string | null | undefined): string {
  if (!text) return '';
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed.charAt(0) : '';
}

/**
 * 判斷字符是否為中文字符
 */
function isChineseCharacter(char: string): boolean {
  const code = char.charCodeAt(0);
  // 漢字的 Unicode 範圍（CJK Unified Ideographs）
  return code >= 0x4e00 && code <= 0x9fff;
}

/**
 * 判斷字符是否為數字
 */
function isDigit(char: string): boolean {
  return /[0-9]/.test(char);
}

/**
 * 判斷字符是否為英文字母
 */
function isEnglishLetter(char: string): boolean {
  return /[a-zA-Z]/.test(char);
}

/**
 * 根據首字分類排序
 * 優先級：中文字 > 英文字母 > 數字
 * 返回排序優先級 (0=中文, 1=英文, 2=數字, 3=其他)
 */
function getCharacterPriority(char: string): number {
  if (isChineseCharacter(char)) return 0;
  if (isEnglishLetter(char)) return 1;
  if (isDigit(char)) return 2;
  return 3;
}

/**
 * 比較兩個中文字符的筆劃數（使用 localeCompare 的筆劃排序）
 * 返回 < 0 表示 a 的筆劃少於 b，= 0 表示相同，> 0 表示 a 的筆劃多於 b
 */
function compareStrokeCount(charA: string, charB: string): number {
  // 使用 zh-Hant 語言環境的筆劃排序
  // 設定 caseFirst: 'false' 和 sensitivity: 'variant' 使其按筆劃順序排列
  const comparison = charA.localeCompare(charB, 'zh-Hant', { 
    numeric: false,
    sensitivity: 'base'
  });
  return comparison;
}

/**
 * 居住區名稱排序（首字筆劃 + 首字母 + 數字大小）
 * 規則：
 * 1. 首先按首字的分類排序（中文字 > 英文字母 > 數字 > 其他）
 * 2. 對於中文首字，按筆劃數升序排列
 * 3. 對於相同筆劃的中文字，按字碼順序排列
 * 4. 對於英文或數字，按自然排序
 * 5. 對於相同首字，比較後續字符
 * 
 * 例如：一般病房 < 二號房 < 2樓護理區 < 3號區 < A棟 < 健康區 < 護理區 < 長照區
 */
export function compareStationNames(a: string | null | undefined, b: string | null | undefined): number {
  const nameA = (a || '').trim();
  const nameB = (b || '').trim();

  if (!nameA && !nameB) return 0;
  if (!nameA) return 1;
  if (!nameB) return -1;

  const firstCharA = getFirstCharacter(nameA);
  const firstCharB = getFirstCharacter(nameB);

  if (!firstCharA && !firstCharB) return nameA.localeCompare(nameB, 'zh-Hant', { numeric: true });
  if (!firstCharA) return 1;
  if (!firstCharB) return -1;

  // 1. 比較首字的分類優先級
  const priorityA = getCharacterPriority(firstCharA);
  const priorityB = getCharacterPriority(firstCharB);

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  // 2. 同分類內的比較
  if (priorityA === 0) {
    // 中文字：先比筆劃數，再比字碼
    const strokeComparison = compareStrokeCount(firstCharA, firstCharB);
    if (strokeComparison !== 0) {
      return strokeComparison;
    }
  } else {
    // 英文字母或數字：直接字碼比較
    const charComparison = firstCharA.localeCompare(firstCharB, 'zh-Hant', { numeric: true });
    if (charComparison !== 0) {
      return charComparison;
    }
  }

  // 3. 首字相同，比較整個字符串（使用自然排序）
  return nameA.localeCompare(nameB, 'zh-Hant', { numeric: true, sensitivity: 'base' });
}

/**
 * 藥物搜尋相關性評分（越高越相關；-1 代表完全不配對）
 * 排名優先級（高→低）：
 *   完全相等 > 前綴 > 詞首前綴(以空格/符號分隔的任一詞以搜索詞開頭) > 連續子字串(越前越高) > 逐字模糊(subsequence)
 * 這確保輸入 "para" 時，"Paracetamol..." 這類前綴命中會排在最前，
 * 而 subsequence 命中（如 p…a…r…a 散落在其他藥名）沉到最底，不再淹沒真正結果。
 */
export function drugMatchScore(target: string | null | undefined, search: string): number {
  if (!target) return -1;
  if (!search) return 0;
  const t = target.toLowerCase();
  const s = search.toLowerCase();

  if (t === s) return 1000;
  if (t.startsWith(s)) return 900;

  // 詞首前綴：任一以空格或常見符號分隔的詞以搜索詞開頭
  const words = t.split(/[\s\-/(),.+]+/).filter(Boolean);
  if (words.some(w => w.startsWith(s))) return 800;

  const idx = t.indexOf(s);
  if (idx >= 0) return 700 - Math.min(idx, 200); // 連續子字串，越靠前越高

  if (fuzzyMatch(target, search)) return 100; // 逐字模糊（最低優先）

  return -1;
}

/**
 * 藥物多欄位相關性評分（取各欄位最高分；drug_name 為主）
 */
export function drugSearchScore(
  drug: { drug_name?: string | null; drug_code?: string | null; drug_type?: string | null; administration_route?: string | null; unit?: string | null; notes?: string | null },
  search: string
): number {
  if (!search) return 0;
  return Math.max(
    drugMatchScore(drug.drug_name, search),
    drugMatchScore(drug.drug_code, search),
    drugMatchScore(drug.drug_type, search),
    drugMatchScore(drug.administration_route, search),
    drugMatchScore(drug.unit, search),
    drugMatchScore(drug.notes, search)
  );
}
