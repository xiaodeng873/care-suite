import { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import {
  useDrugs, useCreateDrug, useUpdateDrug, useDeleteDrug,
  type DrugData,
} from '@/features/drugs/useDrugs';

const DRUG_TYPES = ['口服藥', '外用藥', '注射藥', '吸入劑', '滴眼藥', '貼藥', '栓劑', '其他'];
const ROUTES = ['口服', '靜脈注射', '肌肉注射', '皮下注射', '外用', '吸入', '舌下', '肛門', '眼部'];

type FormState = {
  drug_name: string;
  drug_code: string;
  drug_type: string;
  administration_route: string;
  unit: string;
  notes: string;
};

const EMPTY: FormState = {
  drug_name: '',
  drug_code: '',
  drug_type: '',
  administration_route: '',
  unit: '',
  notes: '',
};

export default function DrugsScreen() {
  const { data: drugs = [], isLoading, refetch } = useDrugs();
  const createDrug = useCreateDrug();
  const updateDrug = useUpdateDrug();
  const deleteDrug = useDeleteDrug();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DrugData | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return drugs;
    return drugs.filter(d =>
      d.drug_name.toLowerCase().includes(q) ||
      (d.drug_code ?? '').toLowerCase().includes(q) ||
      (d.drug_type ?? '').toLowerCase().includes(q)
    );
  }, [drugs, search]);

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(drug: DrugData) {
    setEditing(drug);
    setForm({
      drug_name: drug.drug_name,
      drug_code: drug.drug_code ?? '',
      drug_type: drug.drug_type ?? '',
      administration_route: drug.administration_route ?? '',
      unit: drug.unit ?? '',
      notes: drug.notes ?? '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.drug_name.trim()) {
      Alert.alert('提示', '請填寫藥物名稱');
      return;
    }
    const payload = {
      drug_name: form.drug_name.trim(),
      drug_code: form.drug_code || undefined,
      drug_type: form.drug_type || undefined,
      administration_route: form.administration_route || undefined,
      unit: form.unit || undefined,
      notes: form.notes || undefined,
    };
    if (editing) { await updateDrug.mutateAsync({ ...editing, ...payload }); }
    else { await createDrug.mutateAsync(payload); }
    setShowModal(false);
  }

  function handleDelete(id: string) {
    Alert.alert('確認刪除', '確定刪除此藥物記錄？', [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => deleteDrug.mutate(id) },
    ]);
  }

  const isSaving = createDrug.isPending || updateDrug.isPending;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center bg-white rounded-xl px-3 py-2 shadow-sm">
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput className="flex-1 ml-2 text-base text-gray-800" placeholder="搜尋藥物名稱或編號..." value={search} onChangeText={setSearch} />
        </View>
      </View>

      {isLoading ? <ActivityIndicator className="mt-8" size="large" color="#3b82f6" /> : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          renderItem={({ item }) => (
            <TouchableOpacity
              className="bg-white rounded-xl mb-3 px-4 py-3 shadow-sm"
              style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
              onPress={() => openEdit(item)} activeOpacity={0.7}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <Text className="text-base font-semibold text-gray-900">{item.drug_name}</Text>
                  <View className="flex-row flex-wrap gap-2 mt-1">
                    {item.drug_code && <Text className="text-xs text-gray-500">編號：{item.drug_code}</Text>}
                    {item.drug_type && <View className="bg-blue-50 px-2 py-0.5 rounded-full"><Text className="text-xs text-blue-700">{item.drug_type}</Text></View>}
                    {item.administration_route && <Text className="text-xs text-gray-500">{item.administration_route}</Text>}
                    {item.unit && <Text className="text-xs text-gray-500">單位：{item.unit}</Text>}
                  </View>
                  {item.notes && <Text className="text-xs text-gray-400 mt-1">{item.notes}</Text>}
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id)} className="p-1">
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          )}
          ListEmptyComponent={<Text className="text-center text-gray-400 mt-16">暫無藥物記錄</Text>}
        />
      )}

      <TouchableOpacity className="absolute bottom-8 right-6 w-14 h-14 bg-blue-500 rounded-full items-center justify-center shadow-lg" style={{ elevation: 6 }} onPress={openCreate}>
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowModal(false)}><Text className="text-base text-gray-500">取消</Text></TouchableOpacity>
            <Text className="text-base font-semibold">{editing ? '編輯藥物' : '新增藥物'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              {isSaving ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text className="text-base font-semibold text-blue-500">儲存</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
            <Text className="text-sm font-medium text-gray-700 mb-1">藥物名稱 *</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4" value={form.drug_name} onChangeText={v => setForm(f => ({ ...f, drug_name: v }))} placeholder="請輸入藥物名稱" />

            <Text className="text-sm font-medium text-gray-700 mb-1">藥物編號</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4" value={form.drug_code} onChangeText={v => setForm(f => ({ ...f, drug_code: v }))} placeholder="藥物編號（可選）" />

            <Text className="text-sm font-medium text-gray-700 mb-1">藥物類型</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              {DRUG_TYPES.map(t => (
                <TouchableOpacity key={t} onPress={() => setForm(f => ({ ...f, drug_type: f.drug_type === t ? '' : t }))}
                  className="mr-2 px-3 py-2 rounded-xl border"
                  style={{ backgroundColor: form.drug_type === t ? '#3b82f6' : 'white', borderColor: form.drug_type === t ? '#3b82f6' : '#e5e7eb' }}>
                  <Text style={{ color: form.drug_type === t ? 'white' : '#374151', fontSize: 13 }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text className="text-sm font-medium text-gray-700 mb-1">給藥途徑</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              {ROUTES.map(r => (
                <TouchableOpacity key={r} onPress={() => setForm(f => ({ ...f, administration_route: f.administration_route === r ? '' : r }))}
                  className="mr-2 px-3 py-2 rounded-xl border"
                  style={{ backgroundColor: form.administration_route === r ? '#3b82f6' : 'white', borderColor: form.administration_route === r ? '#3b82f6' : '#e5e7eb' }}>
                  <Text style={{ color: form.administration_route === r ? 'white' : '#374151', fontSize: 13 }}>{r}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text className="text-sm font-medium text-gray-700 mb-1">單位</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4" value={form.unit} onChangeText={v => setForm(f => ({ ...f, unit: v }))} placeholder="如：mg、ml、片、粒" />

            <Text className="text-sm font-medium text-gray-700 mb-1">備註</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-8" value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder="備註（可選）" multiline numberOfLines={3} textAlignVertical="top" style={{ minHeight: 80 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
