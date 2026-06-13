/**
 * ResidentGroupedList — 對應 web HealthAssessments 等頁的「單一記錄清單，依院友分組」模型。
 *
 * - 一個畫面顯示全部記錄，依院友分組（預設收合 → 院友為樹的第一層）
 * - 點院友列展開該院友的記錄卡片
 * - 頂部：搜尋（快速定位院友）+ 排序（時間 / 人物，升 / 降）+ 在住狀態篩選
 * - 與「新增/編輯記錄」模態框內的 PatientAutocomplete 並存
 *
 * 各 SOP 畫面提供 records + 卡片渲染 + 日期/院友id 取值函式即可重用。
 */
import { useMemo, useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity, FlatList, ActivityIndicator, RefreshControl,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResidents } from '@/features/residents/useResidents';
import type { Resident } from '@/features/residents/types';

export type RecordSortField = 'time' | 'person';
export type SortDirection = 'asc' | 'desc';
type ResidencyTab = '在住' | '待入住' | '已退住' | '全部';

const RESIDENCY_TABS: ResidencyTab[] = ['在住', '待入住', '已退住', '全部'];

interface ResidentGroupedListProps<T> {
  records: T[];
  /** 取記錄所屬院友id */
  getPatientId: (r: T) => number;
  /** 取記錄日期（ISO，用於「時間」排序）；無日期回傳 undefined */
  getDate: (r: T) => string | undefined;
  /** 記錄卡片渲染 */
  renderCard: (r: T) => React.ReactNode;
  /** 額外可搜尋文字（如評估員、內容…），用於頂部搜尋 */
  getRecordSearchText?: (r: T) => string;
  isLoading?: boolean;
  onRefresh?: () => void;
  emptyText?: string;
  defaultResidency?: ResidencyTab;
  /** 是否顯示排序控制（時間/人物）。預設 true。 */
  showSort?: boolean;
}

interface PatientGroup<T> {
  patient: Resident;
  records: T[];
  latest: number;
}

export function ResidentGroupedList<T>({
  records,
  getPatientId,
  getDate,
  renderCard,
  getRecordSearchText,
  isLoading,
  onRefresh,
  emptyText = '暫無記錄',
  defaultResidency = '在住',
  showSort = true,
}: ResidentGroupedListProps<T>) {
  const { data: residents = [] } = useResidents();
  const [search, setSearch] = useState('');
  const [sortField, setSortField] = useState<RecordSortField>('time');
  const [sortDir, setSortDir] = useState<SortDirection>('desc');
  const [residency, setResidency] = useState<ResidencyTab>(defaultResidency);
  const [expanded, setExpanded] = useState<Set<number>>(new Set());
  const [allExpanded, setAllExpanded] = useState(false);

  const residentMap = useMemo(
    () => new Map(residents.map(r => [r.院友id, r])),
    [residents]
  );

  const dateValue = (r: T) => {
    const d = getDate(r);
    const t = d ? new Date(d).getTime() : 0;
    return Number.isNaN(t) ? 0 : t;
  };

  const groups = useMemo<PatientGroup<T>[]>(() => {
    const q = search.trim().toLowerCase();

    // 篩選
    const filtered = records.filter(r => {
      const p = residentMap.get(getPatientId(r));
      if (residency !== '全部' && p?.在住狀態 !== residency) return false;
      if (!q) return true;
      const extra = getRecordSearchText?.(r) ?? '';
      return (
        (p?.中文姓名 ?? '').toLowerCase().includes(q) ||
        (p?.英文姓名 ?? '').toLowerCase().includes(q) ||
        (p?.床號 ?? '').toLowerCase().includes(q) ||
        (p?.身份證號碼 ?? '').toLowerCase().includes(q) ||
        extra.toLowerCase().includes(q)
      );
    });

    // 分組
    const map = new Map<number, PatientGroup<T>>();
    for (const r of filtered) {
      const pid = getPatientId(r);
      const p = residentMap.get(pid);
      if (!p) continue;
      if (!map.has(pid)) map.set(pid, { patient: p, records: [], latest: 0 });
      const g = map.get(pid)!;
      g.records.push(r);
      g.latest = Math.max(g.latest, dateValue(r));
    }

    // 組內記錄依日期降序
    for (const g of map.values()) {
      g.records.sort((a, b) => dateValue(b) - dateValue(a));
    }

    // 組排序
    const arr = Array.from(map.values());
    arr.sort((a, b) => {
      let cmp = 0;
      if (sortField === 'time') {
        cmp = a.latest - b.latest;
      } else {
        cmp = (a.patient.床號 ?? a.patient.中文姓名 ?? '').localeCompare(
          b.patient.床號 ?? b.patient.中文姓名 ?? '', 'zh-Hant', { numeric: true }
        );
      }
      return sortDir === 'asc' ? cmp : -cmp;
    });
    return arr;
  }, [records, residentMap, search, residency, sortField, sortDir, getPatientId, getRecordSearchText]);

  function toggle(pid: number) {
    setExpanded(prev => {
      const next = new Set(prev);
      if (next.has(pid)) next.delete(pid); else next.add(pid);
      return next;
    });
  }

  function toggleAll() {
    if (allExpanded) {
      setExpanded(new Set());
      setAllExpanded(false);
    } else {
      setExpanded(new Set(groups.map(g => g.patient.院友id)));
      setAllExpanded(true);
    }
  }

  const totalRecords = groups.reduce((n, g) => n + g.records.length, 0);

  function SortBtn({ field, label }: { field: RecordSortField; label: string }) {
    const active = sortField === field;
    return (
      <TouchableOpacity
        className={`flex-row items-center px-3 py-1 rounded-full ${active ? 'bg-blue-500' : 'bg-gray-100'}`}
        onPress={() => {
          if (active) setSortDir(d => (d === 'asc' ? 'desc' : 'asc'));
          else setSortField(field);
        }}
      >
        <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-600'}`}>{label}</Text>
        {active && (
          <Ionicons name={sortDir === 'asc' ? 'arrow-up' : 'arrow-down'} size={12} color="white" style={{ marginLeft: 3 }} />
        )}
      </TouchableOpacity>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      {/* 搜尋（快速定位院友） */}
      <View className="px-4 pt-3 pb-1">
        <View className="flex-row items-center bg-white rounded-xl px-3 py-2 shadow-sm">
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput
            className="flex-1 ml-2 text-base text-gray-800"
            placeholder="搜尋院友姓名 / 床號 / 內容…"
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
            returnKeyType="search"
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {/* 排序 + 展開控制 */}
      <View className="flex-row items-center px-4 pb-1 gap-2">
        {showSort && (
          <>
            <Text className="text-xs text-gray-400">排序</Text>
            <SortBtn field="time" label="時間" />
            <SortBtn field="person" label="人物" />
          </>
        )}
        <View className="flex-1" />
        <TouchableOpacity onPress={toggleAll} className="flex-row items-center px-2 py-1">
          <Ionicons name={allExpanded ? 'contract-outline' : 'expand-outline'} size={14} color="#3b82f6" />
          <Text className="text-xs text-blue-600 ml-1">{allExpanded ? '收合全部' : '展開全部'}</Text>
        </TouchableOpacity>
      </View>

      {/* 在住狀態篩選 */}
      <View className="flex-row gap-2 px-4 pb-2">
        {RESIDENCY_TABS.map(tab => {
          const active = residency === tab;
          return (
            <TouchableOpacity
              key={tab}
              className={`px-3 py-1 rounded-full ${active ? 'bg-gray-700' : 'bg-gray-100'}`}
              onPress={() => setResidency(tab)}
            >
              <Text className={`text-xs font-semibold ${active ? 'text-white' : 'text-gray-600'}`}>{tab}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {isLoading ? (
        <ActivityIndicator className="mt-8" size="large" color="#3b82f6" />
      ) : (
        <FlatList
          data={groups}
          keyExtractor={(g) => String(g.patient.院友id)}
          refreshControl={onRefresh ? <RefreshControl refreshing={false} onRefresh={onRefresh} /> : undefined}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          ListHeaderComponent={
            <Text className="text-xs text-gray-400 mb-2">{groups.length} 位院友 · {totalRecords} 筆記錄</Text>
          }
          renderItem={({ item: g }) => {
            const isOpen = expanded.has(g.patient.院友id);
            return (
              <View className="mb-2">
                {/* 院友列（樹的第一層） */}
                <TouchableOpacity
                  className="flex-row items-center justify-between bg-white px-4 py-3 rounded-xl shadow-sm"
                  style={{ shadowColor: '#000', shadowOpacity: 0.05, shadowRadius: 3, elevation: 1 }}
                  activeOpacity={0.7}
                  onPress={() => toggle(g.patient.院友id)}
                >
                  <View className="flex-row items-center gap-3 flex-1">
                    <View className={`w-9 h-9 rounded-full items-center justify-center ${g.patient.性別 === '男' ? 'bg-blue-100' : 'bg-pink-100'}`}>
                      <Ionicons name="person" size={16} color={g.patient.性別 === '男' ? '#2563eb' : '#db2777'} />
                    </View>
                    <View className="flex-1">
                      <View className="flex-row items-center gap-2">
                        {g.patient.床號 ? (
                          <View className="bg-blue-100 px-2 py-0.5 rounded-full">
                            <Text className="text-xs text-blue-800">{g.patient.床號}</Text>
                          </View>
                        ) : null}
                        <Text className="text-base font-semibold text-gray-800">{g.patient.中文姓名}</Text>
                      </View>
                    </View>
                  </View>
                  <View className="flex-row items-center gap-2">
                    <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                      <Text className="text-xs text-gray-600">{g.records.length}</Text>
                    </View>
                    <Ionicons name={isOpen ? 'chevron-up' : 'chevron-down'} size={18} color="#9ca3af" />
                  </View>
                </TouchableOpacity>

                {/* 展開的記錄卡片 */}
                {isOpen && (
                  <View className="mt-1 pl-2">
                    {g.records.map((r, i) => (
                      <View key={i}>{renderCard(r)}</View>
                    ))}
                  </View>
                )}
              </View>
            );
          }}
          ListEmptyComponent={<Text className="text-center text-gray-400 mt-16">{emptyText}</Text>}
        />
      )}
    </View>
  );
}
