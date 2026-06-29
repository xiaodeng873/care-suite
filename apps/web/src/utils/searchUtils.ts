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
