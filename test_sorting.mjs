// 複製排序函數的邏輯以進行測試

function getFirstCharacter(text) {
  if (!text) return '';
  const trimmed = text.trim();
  return trimmed.length > 0 ? trimmed.charAt(0) : '';
}

function isChineseCharacter(char) {
  const code = char.charCodeAt(0);
  return code >= 0x4e00 && code <= 0x9fff;
}

function isDigit(char) {
  return /[0-9]/.test(char);
}

function isEnglishLetter(char) {
  return /[a-zA-Z]/.test(char);
}

function getCharacterPriority(char) {
  if (isChineseCharacter(char)) return 0;
  if (isEnglishLetter(char)) return 1;
  if (isDigit(char)) return 2;
  return 3;
}

function compareStrokeCount(charA, charB) {
  const comparison = charA.localeCompare(charB, 'zh-Hant', { 
    numeric: false,
    sensitivity: 'base'
  });
  return comparison;
}

function compareStationNames(a, b) {
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

  const priorityA = getCharacterPriority(firstCharA);
  const priorityB = getCharacterPriority(firstCharB);

  if (priorityA !== priorityB) {
    return priorityA - priorityB;
  }

  if (priorityA === 0) {
    const strokeComparison = compareStrokeCount(firstCharA, firstCharB);
    if (strokeComparison !== 0) {
      return strokeComparison;
    }
  } else {
    const charComparison = firstCharA.localeCompare(firstCharB, 'zh-Hant', { numeric: true });
    if (charComparison !== 0) {
      return charComparison;
    }
  }

  return nameA.localeCompare(nameB, 'zh-Hant', { numeric: true, sensitivity: 'base' });
}

// 測試用例
const testStations = [
  '長照區',
  '一般病房',
  '2樓護理區',
  '健康中心',
  '二號房',
  'A棟',
  '護理區',
  '健康區',
  '3號區'
];

console.log('原始順序:', testStations);
console.log('\n排序後:');
const sorted = [...testStations].sort(compareStationNames);
sorted.forEach((station, idx) => {
  const firstChar = getFirstCharacter(station);
  const priority = getCharacterPriority(firstChar);
  const priorityName = ['中文', '英文', '數字', '其他'][priority];
  console.log(`${idx + 1}. ${station} (首字: '${firstChar}', 分類: ${priorityName})`);
});
