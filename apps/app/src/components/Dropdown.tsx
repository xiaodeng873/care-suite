/**
 * Dropdown — React Native 對應 web 的 <select> 單選下拉選單。
 * 用於所有原本在 web 是 <select> 的欄位（餐膳組合、劑型、途徑等）。
 * 點擊開啟選項列表，單選後關閉。NOT a chip row.
 */
import { useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView } from 'react-native';
import { Ionicons } from '@expo/vector-icons';

interface DropdownProps {
  value: string;
  options: readonly string[] | readonly { value: string; label: string }[];
  onChange: (value: string) => void;
  placeholder?: string;
}

export function Dropdown({ value, options, onChange, placeholder = '請選擇' }: DropdownProps) {
  const [open, setOpen] = useState(false);

  const items = options.map(o => (typeof o === 'string' ? { value: o, label: o } : o));
  const selectedLabel = items.find(i => i.value === value)?.label ?? '';

  return (
    <>
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
          paddingHorizontal: 12, paddingVertical: 12,
        }}
      >
        <Text style={{ fontSize: 15, color: value ? '#1f2937' : '#9ca3af' }}>
          {selectedLabel || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#9ca3af" />
      </Pressable>

      <Modal visible={open} transparent animationType="fade" onRequestClose={() => setOpen(false)}>
        <Pressable
          style={{ flex: 1, backgroundColor: 'rgba(0,0,0,0.35)', justifyContent: 'center', padding: 24 }}
          onPress={() => setOpen(false)}
        >
          <Pressable style={{ backgroundColor: 'white', borderRadius: 14, maxHeight: '70%', overflow: 'hidden' }} onPress={() => {}}>
            <ScrollView>
              {items.map(opt => {
                const active = opt.value === value;
                return (
                  <Pressable
                    key={opt.value}
                    onPress={() => { onChange(opt.value); setOpen(false); }}
                    style={{
                      flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
                      paddingHorizontal: 18, paddingVertical: 14,
                      borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
                      backgroundColor: active ? '#eff6ff' : 'white',
                    }}
                  >
                    <Text style={{ fontSize: 15, color: active ? '#1d4ed8' : '#374151', fontWeight: active ? '600' : '400' }}>{opt.label}</Text>
                    {active && <Ionicons name="checkmark" size={18} color="#1d4ed8" />}
                  </Pressable>
                );
              })}
            </ScrollView>
          </Pressable>
        </Pressable>
      </Modal>
    </>
  );
}
