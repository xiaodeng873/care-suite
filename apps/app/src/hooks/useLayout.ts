import { useWindowDimensions, Platform } from 'react-native';

export interface Layout {
  /** 寬度 < 600 */
  isPhone: boolean;
  /** 寬度 ≥ 600 */
  isTablet: boolean;
  isLandscape: boolean;
  isWeb: boolean;
  /** Dashboard / 清單的建議欄數 */
  columns: number;
  /** 寬螢幕時的內容最大寬度（居中用）；手機/平板直向為 undefined（全寬）*/
  maxContentWidth: number | undefined;
}

/** 純計算函數，方便測試 */
export function computeLayout(
  width: number,
  height: number,
  platform: string
): Layout {
  const isWeb = platform === 'web';
  const isTablet = width >= 600;
  const isPhone = !isTablet;
  const isLandscape = width > height;

  let columns: number;
  if (width >= 900) columns = 4;
  else if (width >= 600) columns = 3;
  else columns = 2;

  const maxContentWidth: number | undefined = width >= 900 ? 960 : undefined;

  return { isPhone, isTablet, isLandscape, isWeb, columns, maxContentWidth };
}

/** React hook — 直接讀取裝置資訊 */
export function useLayout(): Layout {
  const { width, height } = useWindowDimensions();
  return computeLayout(width, height, Platform.OS);
}
