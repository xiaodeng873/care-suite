import React from 'react';
import { View, type ViewProps } from 'react-native';
import { useLayout } from '@/hooks/useLayout';

interface ContentContainerProps extends ViewProps {
  children: React.ReactNode;
}

/**
 * 寬螢幕（≥900px）時將子內容居中並約束在 maxContentWidth（960px）以內。
 * 手機 / 平板直向保持全寬，不影響現有佈局。
 */
export function ContentContainer({ children, style, ...rest }: ContentContainerProps) {
  const { maxContentWidth } = useLayout();

  return (
    <View
      style={[
        { flex: 1 },
        maxContentWidth ? { maxWidth: maxContentWidth, width: '100%', alignSelf: 'center' } : undefined,
        style,
      ]}
      {...rest}
    >
      {children}
    </View>
  );
}
