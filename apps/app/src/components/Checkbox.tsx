/**
 * Checkbox — React Native 對應 web 的 <input type="checkbox">。
 * 方形勾選框（NOT a Switch）。用於所有原本在 web 是 checkbox 的欄位。
 * 支援彩色變體（特殊餐膳等），顏色與 web 一致。
 */
import { Pressable, View, Text } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface CheckboxProps {
  checked: boolean;
  label: string;
  onToggle: () => void;
  /** 選中時的容器底色（如特殊餐膳彩色方格）*/
  activeBg?: string;
  /** 選中時的邊框色 */
  activeBorder?: string;
  /** 選中時的文字色 */
  activeText?: string;
}

export function Checkbox({ checked, label, onToggle, activeBg, activeBorder, activeText }: CheckboxProps) {
  return (
    <Pressable
      onPress={onToggle}
      style={{
        flexDirection: 'row', alignItems: 'center', gap: 8,
        paddingHorizontal: 12, paddingVertical: 12, borderRadius: 10, borderWidth: 1,
        backgroundColor: checked ? (activeBg ?? 'white') : 'white',
        borderColor: checked ? (activeBorder ?? '#3b82f6') : '#e5e7eb',
      }}
    >
      <View
        style={{
          width: 18, height: 18, borderRadius: 4, borderWidth: 1.5,
          borderColor: checked ? (activeBorder ?? '#3b82f6') : '#d1d5db',
          backgroundColor: checked ? (activeBorder ?? '#3b82f6') : 'white',
          alignItems: 'center', justifyContent: 'center',
        }}
      >
        {checked && <Ionicons name="checkmark" size={12} color="white" />}
      </View>
      <Text style={{ fontSize: 14, fontWeight: '500', color: checked ? (activeText ?? '#374151') : '#374151' }}>{label}</Text>
    </Pressable>
  );
}
