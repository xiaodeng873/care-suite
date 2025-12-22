// 出入量記錄選項配置
import { IntakeCategory, OutputCategory, IntakeUnit } from '../lib/database';

// ============================================
// 攝入類別配置
// ============================================
export const INTAKE_CATEGORIES: {
  [key in IntakeCategory]: {
    label: string;
    labelEn: string;
    types: string[];
    amounts?: string[];
    unit: IntakeUnit;
    units?: string[];
    icon: string;
  };
} = {
  meal: {
    label: '餐膳',
    labelEn: 'Meals',
    types: ['早餐', '午餐', '下午茶', '晚餐'],
    amounts: ['1', '3/4', '1/2', '1/4'],
    unit: 'portion',
    icon: '🍚'
  },
  beverage: {
    label: '飲料',
    labelEn: 'Beverages',
    types: ['水', '湯', '奶', '果汁', '糖水', '茶'],
    unit: 'ml',
    icon: '💧'
  },
  other: {
    label: '其他',
    labelEn: 'Others',
    types: ['餅乾', '點心', '零食', '甜品'],
    units: ['塊', '粒'],
    unit: 'piece',
    icon: '🍪'
  },
  tube_feeding: {
    label: '鼻胃飼',
    labelEn: 'Tube Feeding',
    types: ['Isocal', 'Ultracal', 'Glucerna', 'Isosource', 'Compleat'],
    unit: 'ml',
    icon: '💊'
  }
};

// ============================================
// 排出類別配置
// ============================================
export const OUTPUT_CATEGORIES: {
  [key in OutputCategory]: {
    label: string;
    labelEn: string;
    colors: string[];
    hasPH: boolean;
    icon: string;
  };
} = {
  urine: {
    label: '尿液',
    labelEn: 'Urine',
    colors: ['透明', '白', '黃', '啡', '紅', '綠', '紫'],
    hasPH: false,
    icon: '💧'
  },
  gastric: {
    label: '胃液',
    labelEn: 'Gastric',
    colors: ['透明', '白', '黃', '啡', '紅', '綠', '紫'],
    hasPH: true,
    icon: '🧪'
  }
};

// ============================================
// 單位標籤
// ============================================
export const UNIT_LABELS: { [key in IntakeUnit]: string } = {
  portion: '份',
  ml: 'ml',
  piece: '個'
};

// ============================================
// 輔助函數
// ============================================

// 將份量字符串轉換為數值 (如 '1/2' -> 0.5)
export const portionToNumber = (portion: string): number => {
  if (portion === '1') return 1;
  if (portion === '3/4') return 0.75;
  if (portion === '1/2') return 0.5;
  if (portion === '1/4') return 0.25;
  return parseFloat(portion) || 0;
};

// 將數值轉換為份量字符串
export const numberToPortion = (num: number): string => {
  if (num === 1) return '1';
  if (num === 0.75) return '3/4';
  if (num === 0.5) return '1/2';
  if (num === 0.25) return '1/4';
  return num.toString();
};

// 格式化顯示數量
export const formatAmount = (amount: string, unit: IntakeUnit): string => {
  if (unit === 'portion') {
    return `${amount}份`;
  } else if (unit === 'ml') {
    return `${amount}ml`;
  } else {
    return `${amount}${amount.includes('塊') || amount.includes('粒') ? '' : '個'}`;
  }
};

// 計算攝入總量統計
export const calculateIntakeStats = (items: any[]) => {
  const stats = {
    meals: 0,
    beverages: 0,
    tubeFeeding: 0,
    others: [] as any[]
  };

  items.forEach(item => {
    if (item.category === 'meal') {
      stats.meals += item.amount_numeric;
    } else if (item.category === 'beverage') {
      stats.beverages += item.amount_numeric;
    } else if (item.category === 'tube_feeding') {
      stats.tubeFeeding += item.amount_numeric;
    } else if (item.category === 'other') {
      stats.others.push(item);
    }
  });

  return stats;
};

// 計算排出總量
export const calculateOutputTotal = (items: any[]): number => {
  return items.reduce((sum, item) => sum + (item.amount_ml || 0), 0);
};

// 格式化攝入統計文字
export const formatIntakeSummary = (items: any[]): string => {
  const stats = calculateIntakeStats(items);
  const parts: string[] = [];

  if (stats.meals > 0) {
    parts.push(`${stats.meals}份餐`);
  }
  if (stats.beverages > 0) {
    parts.push(`${stats.beverages}ml飲料`);
  }
  if (stats.tubeFeeding > 0) {
    parts.push(`${stats.tubeFeeding}ml鼻胃飼`);
  }
  if (stats.others.length > 0) {
    const othersText = stats.others.map(o => `${o.amount}${o.item_type}`).join(', ');
    parts.push(othersText);
  }

  return parts.length > 0 ? parts.join(' + ') : '無';
};

// 格式化排出統計文字
export const formatOutputSummary = (items: any[]): string => {
  const total = calculateOutputTotal(items);
  return total > 0 ? `${total}ml` : '無';
};
