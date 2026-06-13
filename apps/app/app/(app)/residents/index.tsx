import { useState } from 'react';
import {
  View,
  Text,
  FlatList,
  TextInput,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  Alert,
} from 'react-native';
import { router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useResidents, useCreateResident } from '@/features/residents/useResidents';
import type { Resident } from '@/features/residents/types';
import { ContentContainer } from '@/components/ContentContainer';

const CARE_LEVELS = ['全護理', '半護理', '自理'] as const;
const GENDERS = ['男', '女'] as const;
const ADMISSION_TYPES = ['私位', '買位', '院舍卷', '暫住'] as const;
const SOCIAL_WELFARE_OPTIONS = ['綜合社會保障援助', '公共福利金計劃'] as const;

type CreateForm = { 床號: string; 中文姓名: string; 英文姓名: string; 性別: '男'|'女'; 身份證號碼: string; 出生日期: string; 護理等級: string; 入住日期: string; 入住類型: string; 社會福利: string[]; 藥物敏感: string; 不良藥物反應: string; };
const EMPTY: CreateForm = { 床號: '', 中文姓名: '', 英文姓名: '', 性別: '男', 身份證號碼: '', 出生日期: '', 護理等級: '全護理', 入住日期: new Date().toISOString().slice(0,10), 入住類型: '私位', 社會福利: [], 藥物敏感: '', 不良藥物反應: '' };

function ResidentCard({ item }: { item: Resident }) {
  const genderColor = item.性別 === '男' ? '#3b82f6' : '#ec4899';
  return (
    <TouchableOpacity
      className="bg-white rounded-xl mx-4 mb-3 px-4 py-3 flex-row items-center shadow-sm"
      style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
      onPress={() => router.push(`/(app)/residents/${item.院友id}`)}
      activeOpacity={0.7}
    >
      <View className="w-14 h-14 rounded-xl items-center justify-center mr-3" style={{ backgroundColor: genderColor + '15' }}>
        <Text className="text-xs font-medium" style={{ color: genderColor }}>床號</Text>
        <Text className="text-base font-bold" style={{ color: genderColor }}>{item.床號}</Text>
      </View>
      <View className="flex-1">
        <Text className="text-base font-semibold text-gray-900">{item.中文姓名}</Text>
        {item.英文姓名 && <Text className="text-sm text-gray-500">{item.英文姓名}</Text>}
        <View className="flex-row mt-1 gap-2">
          {item.護理等級 && (
            <View className="bg-blue-50 px-2 py-0.5 rounded-full">
              <Text className="text-xs text-blue-700">{item.護理等級}</Text>
            </View>
          )}
          {item.感染控制 && item.感染控制.length > 0 && (
            <View className="bg-red-50 px-2 py-0.5 rounded-full flex-row items-center gap-1">
              <Ionicons name="warning-outline" size={10} color="#ef4444" />
              <Text className="text-xs text-red-600">{item.感染控制.join(', ')}</Text>
            </View>
          )}
        </View>
      </View>
      <Ionicons name="chevron-forward" size={18} color="#9ca3af" />
    </TouchableOpacity>
  );
}

export default function ResidentsScreen() {
  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY);
  const { data, isLoading, isError, refetch, isRefetching } = useResidents();
  const createResident = useCreateResident();

  const filtered = (data ?? []).filter((r) => {
    if (!search) return true;
    const q = search.toLowerCase();
    return r.中文姓名.toLowerCase().includes(q) || r.床號.toLowerCase().includes(q) || (r.英文姓名 ?? '').toLowerCase().includes(q);
  });

  function setField<K extends keyof CreateForm>(key: K, value: CreateForm[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.中文姓名.trim()) { Alert.alert('提示', '請填寫中文姓名'); return; }
    if (!form.床號.trim()) { Alert.alert('提示', '請填寫床號'); return; }
    try {
      await createResident.mutateAsync({
        床號: form.床號.trim(),
        中文姓名: form.中文姓名.trim(),
        中文姓氏: '', 中文名字: '',
        英文姓名: form.英文姓名.trim() || undefined,
        英文姓氏: undefined, 英文名字: undefined,
        性別: form.性別,
        身份證號碼: form.身份證號碼.trim(),
        出生日期: form.出生日期 || undefined,
        護理等級: form.護理等級 as Resident['護理等級'],
        在住狀態: '在住',
        入住日期: form.入住日期 || undefined,
        入住類型: (form.入住類型 || undefined) as Resident['入住類型'],
        社會福利: form.社會福利.length > 0 ? form.社會福利 : undefined,
        藥物敏感: form.藥物敏感 ? [form.藥物敏感] : undefined,
        不良藥物反應: form.不良藥物反應 ? [form.不良藥物反應] : undefined,
      });
      setShowModal(false);
      setForm(EMPTY);
    } catch (e: any) {
      Alert.alert('儲存失敗', e?.message ?? '請重試');
    }
  }

  return (
    <View className="flex-1 bg-gray-50">
      <ContentContainer>
      <View className="bg-white px-4 py-3 border-b border-gray-100">
        <View className="bg-gray-100 rounded-xl flex-row items-center px-3 py-2">
          <Ionicons name="search-outline" size={16} color="#6b7280" />
          <TextInput
            className="flex-1 ml-2 text-sm text-gray-900"
            placeholder="搜尋姓名或床號…"
            placeholderTextColor="#9ca3af"
            value={search} onChangeText={setSearch}
            clearButtonMode="while-editing"
          />
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#2563eb" />
          <Text className="mt-3 text-gray-500 text-sm">載入院友名單…</Text>
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Ionicons name="cloud-offline-outline" size={48} color="#9ca3af" />
          <Text className="mt-3 text-gray-500 text-center">無法載入資料，請檢查網絡連接</Text>
          <TouchableOpacity onPress={() => refetch()} className="mt-4 bg-blue-600 px-6 py-2 rounded-xl">
            <Text className="text-white font-medium">重試</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={(item) => String(item.院友id)}
          renderItem={({ item }) => <ResidentCard item={item} />}
          contentContainerStyle={{ paddingTop: 12, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isRefetching} onRefresh={refetch} tintColor="#2563eb" />}
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Ionicons name="person-outline" size={48} color="#d1d5db" />
              <Text className="mt-3 text-gray-400">{search ? '找不到符合的院友' : '暫無在住院友'}</Text>
            </View>
          }
          ListHeaderComponent={
            data && data.length > 0 ? (
              <Text className="px-4 pb-2 text-xs text-gray-400">
                共 {data.length} 位在住院友{search ? `，篩選出 ${filtered.length} 位` : ''}
              </Text>
            ) : null
          }
        />
      )}
      </ContentContainer>

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-8 right-6 w-14 h-14 bg-blue-600 rounded-full items-center justify-center shadow-lg"
        style={{ elevation: 6 }}
        onPress={() => { setForm(EMPTY); setShowModal(true); }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text className="text-base text-gray-500">取消</Text>
            </TouchableOpacity>
            <Text className="text-base font-semibold">新增院友</Text>
            <TouchableOpacity onPress={handleSave} disabled={createResident.isPending}>
              {createResident.isPending
                ? <ActivityIndicator size="small" color="#2563eb" />
                : <Text className="text-base font-semibold text-blue-600">儲存</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
            <Text className="text-sm font-medium text-gray-700 mb-1">床號 *</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
              value={form.床號} onChangeText={(v) => setField('床號', v)} placeholder="如 A01" />

            <Text className="text-sm font-medium text-gray-700 mb-1">中文姓名 *</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
              value={form.中文姓名} onChangeText={(v) => setField('中文姓名', v)} placeholder="陳大明" />

            <Text className="text-sm font-medium text-gray-700 mb-1">英文姓名</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
              value={form.英文姓名} onChangeText={(v) => setField('英文姓名', v)} placeholder="Chan Tai Ming（可選）" />

            <Text className="text-sm font-medium text-gray-700 mb-1">性別</Text>
            <View className="flex-row gap-3 mb-4">
              {GENDERS.map((g) => (
                <TouchableOpacity key={g} onPress={() => setField('性別', g)}
                  className="flex-1 py-3 rounded-xl border items-center"
                  style={{ backgroundColor: form.性別 === g ? '#3b82f6' : 'white', borderColor: form.性別 === g ? '#3b82f6' : '#e5e7eb' }}>
                  <Text style={{ color: form.性別 === g ? 'white' : '#374151', fontSize: 14, fontWeight: '600' }}>{g}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-sm font-medium text-gray-700 mb-1">身份證號碼</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
              value={form.身份證號碼} onChangeText={(v) => setField('身份證號碼', v)}
              placeholder="A123456(7)" autoCapitalize="characters" />

            <Text className="text-sm font-medium text-gray-700 mb-1">出生日期</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
              value={form.出生日期} onChangeText={(v) => setField('出生日期', v)} placeholder="YYYY-MM-DD" />

            <Text className="text-sm font-medium text-gray-700 mb-1">護理等級</Text>
            <View className="flex-row gap-2 mb-4">
              {CARE_LEVELS.map((lv) => (
                <TouchableOpacity key={lv} onPress={() => setField('護理等級', lv)}
                  className="flex-1 py-2 rounded-xl border items-center"
                  style={{ backgroundColor: form.護理等級 === lv ? '#2563eb' : 'white', borderColor: form.護理等級 === lv ? '#2563eb' : '#e5e7eb' }}>
                  <Text style={{ color: form.護理等級 === lv ? 'white' : '#374151', fontSize: 13 }}>{lv}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-sm font-medium text-gray-700 mb-1">入住日期</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
              value={form.入住日期} onChangeText={(v) => setField('入住日期', v)} placeholder="YYYY-MM-DD" />

            <Text className="text-sm font-medium text-gray-700 mb-1">入住類型</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {ADMISSION_TYPES.map((t) => (
                <TouchableOpacity key={t} onPress={() => setField('入住類型', t)}
                  className="px-4 py-2 rounded-xl border"
                  style={{ backgroundColor: form.入住類型 === t ? '#2563eb' : 'white', borderColor: form.入住類型 === t ? '#2563eb' : '#e5e7eb' }}>
                  <Text style={{ color: form.入住類型 === t ? 'white' : '#374151', fontSize: 13 }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text className="text-sm font-medium text-gray-700 mb-1">社會福利</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {SOCIAL_WELFARE_OPTIONS.map((w) => {
                const active = form.社會福利.includes(w);
                return (
                  <TouchableOpacity key={w} onPress={() => setField('社會福利', active ? form.社會福利.filter((x) => x !== w) : [...form.社會福利, w])}
                    className="px-4 py-2 rounded-xl border flex-row items-center"
                    style={{ backgroundColor: active ? '#2563eb' : 'white', borderColor: active ? '#2563eb' : '#e5e7eb' }}>
                    {active && <Ionicons name="checkmark" size={13} color="white" style={{ marginRight: 4 }} />}
                    <Text style={{ color: active ? 'white' : '#374151', fontSize: 13 }}>{w}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <Text className="text-sm font-medium text-gray-700 mb-1">藥物敏感</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
              value={form.藥物敏感} onChangeText={(v) => setField('藥物敏感', v)} placeholder="藥物敏感（可選）" />

            <Text className="text-sm font-medium text-gray-700 mb-1">不良藥物反應</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-8"
              value={form.不良藥物反應} onChangeText={(v) => setField('不良藥物反應', v)} placeholder="不良藥物反應（可選）" />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
