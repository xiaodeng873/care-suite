// 看診原因顏色映射
export const getReasonBadgeClass = (reason: string): string => {
  const reasonMap: { [key: string]: string } = {
    '申訴不適': 'reason-complaint',
    '約束物品同意書': 'reason-consent', 
    '年度體檢': 'reason-checkup',
    '其他': 'reason-other',
    '緊急處理': 'reason-emergency',
    '藥物調整': 'reason-medication',
    '覆診': 'reason-follow-up',
    '定期檢查': 'reason-checkup',
    '身體不適': 'reason-complaint',
    '意外受傷': 'reason-emergency',
    '心理輔導': 'reason-other',
    '復健治療': 'reason-follow-up'
  };

  return `reason-badge ${reasonMap[reason] || 'reason-default'}`;
};

// 獲取原因圖標
export const getReasonIcon = (reason: string): string => {
  const iconMap: { [key: string]: string } = {
    '申訴不適': '🤒',
    '約束物品同意書': '📋',
    '年度體檢': '🩺',
    '其他': '📝',
    '緊急處理': '🚨',
    '藥物調整': '💊',
    '覆診': '🔄',
    '定期檢查': '✅',
    '身體不適': '😷',
    '意外受傷': '🩹',
    '心理輔導': '💭',
    '復健治療': '🏃‍♂️'
  };

  return iconMap[reason] || '📄';
};