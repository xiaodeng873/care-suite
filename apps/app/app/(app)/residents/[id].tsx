import { useState } from 'react';
import { View, Text, ScrollView, ActivityIndicator, TouchableOpacity, Modal, TextInput, Alert } from 'react-native';
import { useLocalSearchParams, router, Stack } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useResident, useUpdateResident } from '@/features/residents/useResidents';
import type { Resident } from '@/features/residents/types';

function InfoRow({ label, value }: { label: string; value?: string | null }) {
  if (!value) return null;
  return (
    <View className="flex-row py-3 border-b border-gray-100">
      <Text className="w-28 text-sm text-gray-500">{label}</Text>
      <Text className="flex-1 text-sm text-gray-900 font-medium">{value}</Text>
    </View>
  );
}

function TagList({ label, items, color }: { label: string; items?: string[]; color: string }) {
  if (!items || items.length === 0) return null;
  return (
    <View className="py-3 border-b border-gray-100">
      <Text className="text-sm text-gray-500 mb-2">{label}</Text>
      <View className="flex-row flex-wrap gap-2">
        {items.map((t) => (
          <View key={t} className="px-3 py-1 rounded-full" style={{ backgroundColor: color + '18' }}>
            <Text className="text-xs font-medium" style={{ color }}>{t}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

const CARE_LEVELS = ['全護理', '半護理', '自理'] as const;
const GENDERS = ['男', '女'] as const;

type EditForm = {
  床號: string;
  中文姓名: string;
  英文姓名: string;
  性別: '男' | '女';
  身份證號碼: string;
  出生日期: string;
  護理等級: string;
  在住狀態: string;
};

export default function ResidentDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { data: resident, isLoading, isError } = useResident(id ? Number(id) : undefined);
  const updateResident = useUpdateResident();
  const [showEdit, setShowEdit] = useState(false);
  const [form, setForm] = useState<EditForm | null>(null);

  const genderColor = resident?.性別 === '男' ? '#3b82f6' : '#ec4899';

  function openEdit() {
    if (!resident) return;
    setForm({
      床號: resident.床號 ?? '',
      中文姓名: resident.中文姓名 ?? '',
      英文姓名: resident.英文姓名 ?? '',
      性別: resident.性別 ?? '男',
      身份證號碼: resident.身份證號碼 ?? '',
      出生日期: resident.出生日期 ?? '',
      護理等級: resident.護理等級 ?? '',
      在住狀態: resident.在住狀態 ?? '在住',
    });
    setShowEdit(true);
  }

  async function handleSave() {
    if (!form || !resident) return;
    if (!form.中文姓名.trim()) { Alert.alert('提示', '請填寫中文姓名'); return; }
    try {
      await updateResident.mutateAsync({
        院友id: resident.院友id,
        床號: form.床號.trim(),
        中文姓名: form.中文姓名.trim(),
        英文姓名: form.英文姓名.trim() || undefined,
        性別: form.性別,
        身份證號碼: form.身份證號碼.trim(),
        出生日期: form.出生日期 || undefined,
        護理等級: form.護理等級 as Resident['護理等級'] || undefined,
        在住狀態: form.在住狀態 as Resident['在住狀態'],
      });
      setShowEdit(false);
    } catch (e: any) {
      Alert.alert('儲存失敗', e?.message ?? '請重試');
    }
  }

  function setField<K extends keyof EditForm>(key: K, value: EditForm[K]) {
    setForm((f) => f ? { ...f, [key]: value } : f);
  }

  return (
    <>
      <Stack.Screen options={{
        title: resident?.中文姓名 ?? '院友詳情',
        headerRight: () => resident ? (
          <TouchableOpacity onPress={openEdit} className="pr-1">
            <Ionicons name="create-outline" size={22} color="#3b82f6" />
          </TouchableOpacity>
        ) : null,
      }} />
      <ScrollView className="flex-1 bg-gray-50">
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-24">
            <ActivityIndicator size="large" color="#2563eb" />
          </View>
        ) : isError || !resident ? (
          <View className="flex-1 items-center justify-center py-24 px-8">
            <Ionicons name="person-outline" size={48} color="#9ca3af" />
            <Text className="mt-3 text-gray-500 text-center">找不到院友資料</Text>
            <TouchableOpacity onPress={() => router.back()} className="mt-4 bg-gray-200 px-6 py-2 rounded-xl">
              <Text className="text-gray-700">返回</Text>
            </TouchableOpacity>
          </View>
        ) : (
          <>
            <View className="bg-white mx-4 mt-4 rounded-2xl p-5 shadow-sm"
              style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
              <View className="flex-row items-center">
                <View className="w-16 h-16 rounded-2xl items-center justify-center mr-4"
                  style={{ backgroundColor: genderColor + '15' }}>
                  <Ionicons name={resident.性別 === '男' ? 'man-outline' : 'woman-outline'} size={32} color={genderColor} />
                </View>
                <View className="flex-1">
                  <Text className="text-xl font-bold text-gray-900">{resident.中文姓名}</Text>
                  {resident.英文姓名 && (
                    <Text className="text-sm text-gray-500 mt-0.5">{resident.英文姓名}</Text>
                  )}
                  <View className="flex-row mt-2 gap-2">
                    <View className="bg-gray-100 px-3 py-1 rounded-full">
                      <Text className="text-xs text-gray-600">床號 {resident.床號}</Text>
                    </View>
                    {resident.護理等級 && (
                      <View className="px-3 py-1 rounded-full" style={{ backgroundColor: genderColor + '15' }}>
                        <Text className="text-xs font-medium" style={{ color: genderColor }}>{resident.護理等級}</Text>
                      </View>
                    )}
                  </View>
                </View>
              </View>
            </View>

            <View className="bg-white mx-4 mt-3 rounded-2xl px-4 shadow-sm"
              style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
              <Text className="text-xs font-semibold text-gray-400 uppercase pt-4 pb-1 tracking-wider">基本資料</Text>
              <InfoRow label="性別" value={resident.性別} />
              <InfoRow label="身份證號碼" value={resident.身份證號碼} />
              <InfoRow label="出生日期" value={resident.出生日期} />
              <InfoRow label="入住日期" value={resident.入住日期} />
              <InfoRow label="在住狀態" value={resident.在住狀態} />
            </View>

            {((resident.藥物敏感?.length ?? 0) > 0 ||
              (resident.不良藥物反應?.length ?? 0) > 0 ||
              (resident.感染控制?.length ?? 0) > 0) && (
              <View className="bg-white mx-4 mt-3 rounded-2xl px-4 shadow-sm"
                style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2 }}>
                <Text className="text-xs font-semibold text-gray-400 uppercase pt-4 pb-1 tracking-wider">醫療警示</Text>
                <TagList label="藥物敏感" items={resident.藥物敏感} color="#f59e0b" />
                <TagList label="不良藥物反應" items={resident.不良藥物反應} color="#ef4444" />
                <TagList label="感染控制" items={resident.感染控制} color="#8b5cf6" />
              </View>
            )}

            <View className="h-8" />
          </>
        )}
      </ScrollView>

      {/* Edit Modal */}
      <Modal visible={showEdit} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowEdit(false)}>
              <Text className="text-base text-gray-500">取消</Text>
            </TouchableOpacity>
            <Text className="text-base font-semibold">編輯院友資料</Text>
            <TouchableOpacity onPress={handleSave} disabled={updateResident.isPending}>
              {updateResident.isPending
                ? <ActivityIndicator size="small" color="#2563eb" />
                : <Text className="text-base font-semibold text-blue-600">儲存</Text>}
            </TouchableOpacity>
          </View>

          {form && (
            <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
              <Text className="text-sm font-medium text-gray-700 mb-1">床號</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
                value={form.床號} onChangeText={(v) => setField('床號', v)} placeholder="如 A01" />

              <Text className="text-sm font-medium text-gray-700 mb-1">中文姓名 *</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
                value={form.中文姓名} onChangeText={(v) => setField('中文姓名', v)} placeholder="陳大明" />

              <Text className="text-sm font-medium text-gray-700 mb-1">英文姓名</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
                value={form.英文姓名} onChangeText={(v) => setField('英文姓名', v)} placeholder="Chan Tai Ming" />

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
                value={form.身份證號碼} onChangeText={(v) => setField('身份證號碼', v)} placeholder="A123456(7)"
                autoCapitalize="characters" />

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

              <Text className="text-sm font-medium text-gray-700 mb-1">在住狀態</Text>
              <View className="flex-row gap-2 mb-8">
                {(['在住', '待入住', '已退住'] as const).map((s) => (
                  <TouchableOpacity key={s} onPress={() => setField('在住狀態', s)}
                    className="flex-1 py-2 rounded-xl border items-center"
                    style={{ backgroundColor: form.在住狀態 === s ? '#2563eb' : 'white', borderColor: form.在住狀態 === s ? '#2563eb' : '#e5e7eb' }}>
                    <Text style={{ color: form.在住狀態 === s ? 'white' : '#374151', fontSize: 13 }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>
          )}
        </View>
      </Modal>
    </>
  );
}
