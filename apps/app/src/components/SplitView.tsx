import { View, Text } from 'react-native';
import type { ReactNode } from 'react';
import { useLayout } from '@/hooks/useLayout';

interface SplitViewProps {
  /** 左欄：列表畫面 */
  list: ReactNode;
  /** 右欄：詳情畫面；手機上由 Stack 全螢幕處理，此 prop 僅平板/Web 使用 */
  detail?: ReactNode;
  /** 是否已選擇項目（決定右欄是否顯示佔位符） */
  hasSelection?: boolean;
}

/** 平板/Web 空白右欄佔位符 */
function EmptyDetail() {
  return (
    <View className="flex-1 items-center justify-center bg-gray-50">
      <View className="items-center gap-3">
        <View className="w-16 h-16 rounded-full bg-gray-200 items-center justify-center">
          <View className="w-8 h-1.5 bg-gray-400 rounded mb-1" />
          <View className="w-6 h-1.5 bg-gray-300 rounded mb-1" />
          <View className="w-8 h-1.5 bg-gray-300 rounded" />
        </View>
        <Text className="text-sm text-gray-400">請從左側選擇項目</Text>
      </View>
    </View>
  );
}

/**
 * Master-Detail 分欄組件。
 *
 * - 平板/Web（showSplitView = true）：左欄 40% 列表，右欄 60% 詳情，並排顯示。
 * - 手機（showSplitView = false）：只渲染列表欄，詳情由 Expo Router Stack 全螢幕覆蓋。
 *
 * 在各功能的 `_layout.tsx` 中使用，現有 index.tsx / [id].tsx 無需改動。
 */
export function SplitView({ list, detail, hasSelection = false }: SplitViewProps) {
  const { showSplitView } = useLayout();

  if (!showSplitView) {
    // 手機：只顯示列表，Stack 負責詳情的全螢幕導航
    return <View className="flex-1">{list}</View>;
  }

  // 平板/Web：左右並排
  return (
    <View className="flex-1 flex-row">
      {/* 左欄：列表，固定 40% 寬，右側有分隔線 */}
      <View className="w-[40%] border-r border-gray-200 bg-white">
        {list}
      </View>
      {/* 右欄：詳情，佔剩餘 60% */}
      <View className="flex-1 bg-gray-50">
        {detail ?? (hasSelection ? null : <EmptyDetail />)}
      </View>
    </View>
  );
}
