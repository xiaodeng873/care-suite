function compareStrokeCount(charA, charB) {
  const comparison = charA.localeCompare(charB, 'zh-Hant', { 
    numeric: false,
    sensitivity: 'base'
  });
  return comparison;
}

// 測試具有相同筆劃的字符
const testChars = [
  ['健', '護'],  // 健11筆, 護9筆
  ['一', '二'],  // 一1筆, 二2筆
  ['長', '健'],  // 長8筆, 健11筆
  ['健', '健'],  // 相同
];

console.log('筆劃排序測試 (zh-Hant):');
testChars.forEach(([a, b]) => {
  const cmp = compareStrokeCount(a, b);
  const result = cmp < 0 ? '<' : cmp > 0 ? '>' : '=';
  console.log(`"${a}" ${result} "${b}" (cmp: ${cmp})`);
});

// 使用 CJK Radicals Supplement 進行測試
const chineseChars = ['一', '二', '三', '四', '五', '六', '七', '八', '九', '十',
                      '健', '護', '長', '照', '區'];

console.log('\n按 localeCompare 排序:');
const sorted = [...chineseChars].sort((a, b) => compareStrokeCount(a, b));
sorted.forEach((char, idx) => {
  console.log(`${idx + 1}. "${char}"`);
});
