/**
 * PatientAutocomplete — React Native 對應 web PatientAutocomplete.tsx。
 * 取代各畫面的「左右滑動院友 chip」。
 *
 * 行為完全對應 web：
 * - 一個輸入框，已選時顯示「床號 - 中文姓名」，輸入時顯示搜尋字串
 * - 點擊開啟下拉清單，可按 床號 / 中文姓名 / 英文姓名 / 身份證號碼 搜尋
 * - 可選的在住狀態篩選（在住/待入住/已退住/全部）
 * - 每項顯示：頭像、床號標籤、姓名、在住狀態標籤、英文姓名、身份證號碼
 * - 無結果時顯示「找不到符合條件的院友」
 */
import { useMemo, useState } from 'react';
import { View, Text, Pressable, Modal, ScrollView, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResidents } from '@/features/residents/useResidents';
import type { Resident } from '@/features/residents/types';
import { Dropdown } from './Dropdown';

interface PatientAutocompleteProps {
  /** 已選 院友id（number）或 null */
  value: number | null;
  onChange: (patientId: number) => void;
  placeholder?: string;
  /** 顯示在住狀態篩選下拉 */
  showResidencyFilter?: boolean;
  defaultResidencyStatus?: '在住' | '待入住' | '已退住' | '全部';
}

const RESIDENCY_OPTIONS = [
  { value: '在住', label: '在住院友' },
  { value: '待入住', label: '待入住院友' },
  { value: '已退住', label: '已退住院友' },
  { value: '全部', label: '全部院友' },
] as const;

export function PatientAutocomplete({
  value,
  onChange,
  placeholder = '搜索院友...',
  showResidencyFilter = false,
  defaultResidencyStatus = '在住',
}: PatientAutocompleteProps) {
  const { data: residents = [] } = useResidents();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState('');
  const [residency, setResidency] = useState<string>(defaultResidencyStatus);

  const selected = residents.find(r => r.院友id === value);

  const filtered = useMemo(() => {
    return residents.filter(p => {
      if (showResidencyFilter && residency !== '全部' && p.在住狀態 !== residency) return false;
      const q = search.trim().toLowerCase();
      if (!q) return true;
      return (
        (p.床號 ?? '').toLowerCase().includes(q) ||
        (p.中文姓名 ?? '').toLowerCase().includes(q) ||
        (p.英文姓名 ?? '').toLowerCase().includes(q) ||
        (p.身份證號碼 ?? '').toLowerCase().includes(q)
      );
    });
  }, [residents, search, residency, showResidencyFilter]);

  function selectPatient(p: Resident) {
    onChange(p.院友id);
    setOpen(false);
    setSearch('');
  }

  const displayText = selected ? `${selected.床號} - ${selected.中文姓名}` : '';

  return (
    <>
      {/* 觸發輸入框 */}
      <Pressable
        onPress={() => setOpen(true)}
        style={{
          flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
          backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
          paddingHorizontal: 12, paddingVertical: 12,
        }}
      >
        <Text style={{ fontSize: 15, color: displayText ? '#1f2937' : '#9ca3af' }} numberOfLines={1}>
          {displayText || placeholder}
        </Text>
        <Ionicons name="chevron-down" size={18} color="#9ca3af" />
      </Pressable>

      {/* 下拉搜尋彈窗 */}
      <Modal visible={open} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setOpen(false)}>
        <View style={{ flex: 1, backgroundColor: 'white' }}>
          {/* 標題列 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>選擇院友</Text>
            <Pressable onPress={() => setOpen(false)} hitSlop={8}>
              <Ionicons name="close" size={24} color="#9ca3af" />
            </Pressable>
          </View>

          {/* 搜尋框 */}
          <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: '#f3f4f6', borderRadius: 10, paddingHorizontal: 12 }}>
              <Ionicons name="search-outline" size={18} color="#9ca3af" />
              <TextInput
                style={{ flex: 1, marginLeft: 8, paddingVertical: 12, fontSize: 15, color: '#1f2937' }}
                value={search}
                onChangeText={setSearch}
                placeholder={placeholder}
                placeholderTextColor="#9ca3af"
                autoFocus
              />
            </View>

            {/* 在住狀態篩選 */}
            {showResidencyFilter && (
              <View style={{ marginTop: 12 }}>
                <Dropdown
                  value={residency}
                  options={RESIDENCY_OPTIONS}
                  onChange={setResidency}
                  placeholder="在住狀態"
                />
              </View>
            )}
          </View>

          {/* 結果列表 */}
          <ScrollView style={{ flex: 1, marginTop: 12 }} keyboardShouldPersistTaps="handled">
            {filtered.length > 0 ? filtered.map(p => {
              const active = p.院友id === value;
              const statusColor =
                p.在住狀態 === '在住' ? { bg: '#dcfce7', text: '#166534' } :
                p.在住狀態 === '待入住' ? { bg: '#fef9c3', text: '#854d0e' } :
                { bg: '#f3f4f6', text: '#374151' };
              return (
                <Pressable
                  key={p.院友id}
                  onPress={() => selectPatient(p)}
                  style={{
                    flexDirection: 'row', alignItems: 'center', gap: 12,
                    paddingHorizontal: 16, paddingVertical: 12,
                    borderLeftWidth: active ? 4 : 0, borderLeftColor: '#3b82f6',
                    backgroundColor: active ? '#eff6ff' : 'white',
                    borderBottomWidth: 1, borderBottomColor: '#f3f4f6',
                  }}
                >
                  <View style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#dbeafe', alignItems: 'center', justifyContent: 'center' }}>
                    <Ionicons name="person" size={20} color="#2563eb" />
                  </View>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
                      <View style={{ backgroundColor: '#dbeafe', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 }}>
                        <Text style={{ fontSize: 11, color: '#1e40af' }}>{p.床號}</Text>
                      </View>
                      <Text style={{ fontSize: 15, fontWeight: '600', color: '#111827' }}>{p.中文姓名}</Text>
                      {showResidencyFilter && p.在住狀態 && (
                        <View style={{ backgroundColor: statusColor.bg, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999 }}>
                          <Text style={{ fontSize: 11, color: statusColor.text }}>{p.在住狀態}</Text>
                        </View>
                      )}
                    </View>
                    {p.英文姓名 ? <Text style={{ fontSize: 13, color: '#6b7280', marginTop: 2 }}>{p.英文姓名}</Text> : null}
                    {p.身份證號碼 ? <Text style={{ fontSize: 11, color: '#9ca3af' }}>{p.身份證號碼}</Text> : null}
                  </View>
                  {active && <Ionicons name="checkmark-circle" size={20} color="#2563eb" />}
                </Pressable>
              );
            }) : (
              <View style={{ alignItems: 'center', paddingVertical: 48 }}>
                <Ionicons name="search-outline" size={32} color="#d1d5db" />
                <Text style={{ fontSize: 14, color: '#6b7280', marginTop: 8 }}>找不到符合條件的院友</Text>
                {search ? <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>搜索條件: "{search}"</Text> : null}
              </View>
            )}
            <View style={{ height: 40 }} />
          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
