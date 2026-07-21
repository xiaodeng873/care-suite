export interface InfectionTypeColors {
  bgColor: string;
  textColor: string;
}

// 感染性質配色盤，用於報表卡片與感染控制頁 tag
// 顏色按實際存在的性質動態分配，不預先為任何疾病固定配色
const INFECTION_COLOR_PALETTE: InfectionTypeColors[] = [
  { bgColor: 'bg-red-100', textColor: 'text-red-800' },
  { bgColor: 'bg-orange-100', textColor: 'text-orange-800' },
  { bgColor: 'bg-amber-100', textColor: 'text-amber-800' },
  { bgColor: 'bg-yellow-100', textColor: 'text-yellow-800' },
  { bgColor: 'bg-lime-100', textColor: 'text-lime-800' },
  { bgColor: 'bg-green-100', textColor: 'text-green-800' },
  { bgColor: 'bg-emerald-100', textColor: 'text-emerald-800' },
  { bgColor: 'bg-teal-100', textColor: 'text-teal-800' },
  { bgColor: 'bg-cyan-100', textColor: 'text-cyan-800' },
  { bgColor: 'bg-sky-100', textColor: 'text-sky-800' },
  { bgColor: 'bg-blue-100', textColor: 'text-blue-800' },
  { bgColor: 'bg-indigo-100', textColor: 'text-indigo-800' },
  { bgColor: 'bg-violet-100', textColor: 'text-violet-800' },
  { bgColor: 'bg-purple-100', textColor: 'text-purple-800' },
  { bgColor: 'bg-fuchsia-100', textColor: 'text-fuchsia-800' },
  { bgColor: 'bg-pink-100', textColor: 'text-pink-800' },
  { bgColor: 'bg-rose-100', textColor: 'text-rose-800' },
];

const simpleHash = (str: string): number => {
  let hash = 0;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 31 + str.charCodeAt(i)) >>> 0;
  }
  return hash;
};

/**
 * 根據感染性質名稱動態取得顏色。
 * 不預先固定任何疾病的配色，同一性質名稱會透過雜湊取得穩定顏色。
 */
export const getInfectionTypeColors = (type: string): InfectionTypeColors => {
  const normalizedType = (type || '未分類').trim();
  const hash = simpleHash(normalizedType);
  return INFECTION_COLOR_PALETTE[hash % INFECTION_COLOR_PALETTE.length];
};
