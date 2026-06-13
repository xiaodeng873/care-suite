import { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResidents } from '@/features/residents/useResidents';
import {
  useMealGuidance, useCreateMealGuidance, useUpdateMealGuidance, useDeleteMealGuidance,
  MEAL_COMBINATIONS, SPECIAL_DIETS, type MealGuidance,
} from '@/features/meals/useMeals';
import { Dropdown } from '@/components/Dropdown';
import { Checkbox } from '@/components/Checkbox';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';

// 特殊餐膳顏色（完全對應 web getSpecialDietColor）
const SPECIAL_DIET_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  糖尿餐: { bg: '#dbeafe', border: '#bfdbfe', text: '#1e40af' },
  痛風餐: { bg: '#f3e8ff', border: '#e9d5ff', text: '#6b21a8' },
  低鹽餐: { bg: '#dcfce7', border: '#bbf7d0', text: '#166534' },
  雞蛋:   { bg: '#fef9c3', border: '#fef08a', text: '#854d0e' },
  素食:   { bg: '#ffedd5', border: '#fed7aa', text: '#9a3412' },
};

type FormState = {
  patient_id: number | null;
  meal_combination: string;
  special_diets: string[];
  needs_thickener: boolean;
  thickener_amount: string;
  egg_quantity: string;
  remarks: string;
  guidance_date: string;
  guidance_source: string;
};

const EMPTY: FormState = {
  patient_id: null,
  meal_combination: '正飯+正餸',
  special_diets: [],
  needs_thickener: false,
  thickener_amount: '',
  egg_quantity: '',
  remarks: '',
  guidance_date: new Date().toISOString().split('T')[0],
  guidance_source: '',
};

export default function MealsScreen() {
  const { data: residents = [] } = useResidents();
  const { data: meals = [], isLoading, refetch } = useMealGuidance();
  const createMeal = useCreateMealGuidance();
  const updateMeal = useUpdateMealGuidance();
  const deleteMeal = useDeleteMealGuidance();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MealGuidance | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return meals;
    return meals.filter(m => {
      const p = residents.find(r => r.院友id === m.patient_id);
      return m.meal_combination.includes(q) || p?.中文姓名.includes(q) || p?.床號?.includes(q);
    });
  }, [meals, residents, search]);

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(meal: MealGuidance) {
    setEditing(meal);
    setForm({
      patient_id: meal.patient_id,
      meal_combination: meal.meal_combination,
      special_diets: meal.special_diets ?? [],
      needs_thickener: meal.needs_thickener,
      thickener_amount: meal.thickener_amount ?? '',
      egg_quantity: meal.egg_quantity ? String(meal.egg_quantity) : '',
      remarks: meal.remarks ?? '',
      guidance_date: meal.guidance_date ?? new Date().toISOString().split('T')[0],
      guidance_source: meal.guidance_source ?? '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.patient_id) { Alert.alert('提示', '請選擇院友'); return; }
    if (form.needs_thickener && !form.thickener_amount.trim()) { Alert.alert('提示', '使用凝固粉時請輸入分量'); return; }
    if (form.special_diets.includes('雞蛋') && (!form.egg_quantity || Number(form.egg_quantity) < 1)) { Alert.alert('提示', '選擇雞蛋時請輸入有效的隻數'); return; }
    const payload = {
      patient_id: form.patient_id,
      meal_combination: form.meal_combination as any,
      special_diets: form.special_diets as any,
      needs_thickener: form.needs_thickener,
      thickener_amount: form.needs_thickener ? (form.thickener_amount || undefined) : undefined,
      egg_quantity: form.special_diets.includes('雞蛋') && form.egg_quantity ? Number(form.egg_quantity) : undefined,
      remarks: form.remarks || undefined,
      guidance_date: form.guidance_date || undefined,
      guidance_source: form.guidance_source || undefined,
    };
    if (editing) { await updateMeal.mutateAsync({ ...editing, ...payload }); }
    else { await createMeal.mutateAsync(payload); }
    setShowModal(false);
  }

  function toggleDiet(diet: string) {
    setForm(f => ({
      ...f,
      special_diets: f.special_diets.includes(diet)
        ? f.special_diets.filter(d => d !== diet)
        : [...f.special_diets, diet],
    }));
  }

  function handleDelete(id: string) {
    Alert.alert('確認刪除', '確定刪除此餐膳指引？', [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => deleteMeal.mutate(id) },
    ]);
  }

  const isSaving = createMeal.isPending || updateMeal.isPending;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center bg-white rounded-xl px-3 py-2 shadow-sm">
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput className="flex-1 ml-2 text-base text-gray-800" placeholder="搜尋院友..." value={search} onChangeText={setSearch} />
        </View>
      </View>

      {isLoading ? <ActivityIndicator className="mt-8" size="large" color="#3b82f6" /> : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          renderItem={({ item }) => {
            const patient = residents.find(r => r.院友id === item.patient_id);
            return (
              <TouchableOpacity
                className="bg-white rounded-xl mb-3 px-4 py-3 shadow-sm"
                style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
                onPress={() => openEdit(item)} activeOpacity={0.7}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    {patient && <Text className="text-sm font-semibold text-gray-900 mb-1">{patient.床號} {patient.中文姓名}</Text>}
                    <View className="flex-row items-center gap-2 flex-wrap">
                      <View className="bg-green-50 px-2 py-0.5 rounded-full">
                        <Text className="text-xs text-green-700 font-medium">{item.meal_combination}</Text>
                      </View>
                      {item.needs_thickener && (
                        <View className="bg-yellow-50 px-2 py-0.5 rounded-full">
                          <Text className="text-xs text-yellow-700">凝固粉{item.thickener_amount ? `(${item.thickener_amount})` : ''}</Text>
                        </View>
                      )}
                    </View>
                    {item.special_diets?.length > 0 && (
                      <View className="flex-row flex-wrap gap-1 mt-1">
                        {item.special_diets.map((d: string) => (
                          <View key={d} className="bg-blue-50 px-2 py-0.5 rounded-full">
                            <Text className="text-xs text-blue-700">{d}</Text>
                          </View>
                        ))}
                      </View>
                    )}
                    {item.remarks && <Text className="text-xs text-gray-400 mt-1">{item.remarks}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} className="p-1">
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text className="text-center text-gray-400 mt-16">暫無餐膳指引</Text>}
        />
      )}

      <TouchableOpacity className="absolute bottom-8 right-6 w-14 h-14 bg-blue-500 rounded-full items-center justify-center shadow-lg" style={{ elevation: 6 }} onPress={openCreate}>
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowModal(false)}><Text className="text-base text-gray-500">取消</Text></TouchableOpacity>
            <Text className="text-base font-semibold">{editing ? '編輯餐膳指引' : '新增餐膳指引'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              {isSaving ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text className="text-base font-semibold text-blue-500">儲存</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
            <Text className="text-sm font-medium text-gray-700 mb-1">院友 *</Text>
            <View className="mb-4">
              <PatientAutocomplete
                value={form.patient_id}
                onChange={(id) => setForm(f => ({ ...f, patient_id: id }))}
                showResidencyFilter
                defaultResidencyStatus="在住"
              />
            </View>

            <Text className="text-sm font-medium text-gray-700 mb-1">餐膳組合 *</Text>
            <Dropdown
              value={form.meal_combination}
              options={MEAL_COMBINATIONS}
              onChange={(v) => setForm(f => ({ ...f, meal_combination: v }))}
              placeholder="選擇餐膳組合"
            />
            <Text className="text-xs text-gray-500 mt-1 mb-4">選擇適合院友的餐膳組合</Text>

            <Text className="text-sm font-medium text-gray-700 mb-1">特殊餐膳 (可多選)</Text>
            <View className="flex-row flex-wrap gap-2 mb-2">
              {SPECIAL_DIETS.map(d => {
                const c = SPECIAL_DIET_COLORS[d];
                return (
                  <Checkbox
                    key={d}
                    label={d}
                    checked={form.special_diets.includes(d)}
                    onToggle={() => toggleDiet(d)}
                    activeBg={c?.bg}
                    activeBorder={c?.border}
                    activeText={c?.text}
                  />
                );
              })}
            </View>

            {form.special_diets.includes('雞蛋') && (
              <View style={{ marginTop: 8, marginBottom: 16, padding: 14, backgroundColor: '#fefce8', borderWidth: 1, borderColor: '#fef08a', borderRadius: 10 }}>
                <Text className="text-sm font-medium text-gray-700 mb-1">雞蛋數目 *</Text>
                <TextInput
                  style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1f2937', width: 128 }}
                  value={form.egg_quantity}
                  onChangeText={v => setForm(f => ({ ...f, egg_quantity: v.replace(/[^0-9]/g, '') }))}
                  placeholder="輸入數目"
                  placeholderTextColor="#9ca3af"
                  keyboardType="numeric"
                  maxLength={2}
                />
                <Text style={{ fontSize: 11, color: '#a16207', marginTop: 4 }}>請輸入所需的雞蛋數目</Text>
              </View>
            )}

            <Checkbox
              label="需要使用凝固粉"
              checked={form.needs_thickener}
              onToggle={() => setForm(f => ({ ...f, needs_thickener: !f.needs_thickener }))}
            />

            {form.needs_thickener && (
              <View style={{ marginLeft: 28, marginTop: 8, marginBottom: 16 }}>
                <Text className="text-sm font-medium text-gray-700 mb-1">凝固粉分量 *</Text>
                <TextInput
                  style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1f2937' }}
                  value={form.thickener_amount}
                  onChangeText={v => setForm(f => ({ ...f, thickener_amount: v }))}
                  placeholder="例如：1茶匙、2包、適量"
                  placeholderTextColor="#9ca3af"
                />
                <Text style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>請輸入具體的凝固粉使用分量</Text>
              </View>
            )}

            <View style={{ height: 16 }} />

            <Text className="text-sm font-medium text-gray-700 mb-1">指引日期</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4" value={form.guidance_date} onChangeText={v => setForm(f => ({ ...f, guidance_date: v }))} placeholder="YYYY-MM-DD" />

            <Text className="text-sm font-medium text-gray-700 mb-1">指引出處</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.guidance_source}
              onChangeText={v => setForm(f => ({ ...f, guidance_source: v }))}
              placeholder="請輸入指引出處..."
              multiline
              textAlignVertical="top"
              style={{ minHeight: 44 }}
            />

            <Text className="text-sm font-medium text-gray-700 mb-1">備註</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4" value={form.remarks} onChangeText={v => setForm(f => ({ ...f, remarks: v }))} placeholder="其他備註或特殊要求..." multiline numberOfLines={3} textAlignVertical="top" style={{ minHeight: 80 }} />

            {/* 預覽區域 — 完全對應 web 餐膳指引預覽 */}
            <View style={{ backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, padding: 14, marginBottom: 32 }}>
              <Text style={{ fontSize: 13, fontWeight: '600', color: '#111827', marginBottom: 10 }}>餐膳指引預覽</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                <Text style={{ fontSize: 13, color: '#6b7280' }}>餐膳組合:</Text>
                <Text style={{ fontSize: 13, fontWeight: '600', color: form.meal_combination.includes('正飯') ? '#16a34a' : form.meal_combination.includes('軟飯') ? '#ca8a04' : form.meal_combination.includes('糊飯') ? '#ea580c' : '#4b5563' }}>{form.meal_combination}</Text>
              </View>
              {form.special_diets.length > 0 && (
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginBottom: 6 }}>
                  <Text style={{ fontSize: 13, color: '#6b7280' }}>特殊餐膳:</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, flex: 1 }}>
                    {form.special_diets.map(d => {
                      const c = SPECIAL_DIET_COLORS[d];
                      return (
                        <View key={d} style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6, borderWidth: 1, backgroundColor: c?.bg, borderColor: c?.border }}>
                          <Text style={{ fontSize: 11, color: c?.text }}>{d}{d === '雞蛋' && form.egg_quantity ? ` ${form.egg_quantity}隻` : ''}</Text>
                        </View>
                      );
                    })}
                  </View>
                </View>
              )}
              {form.needs_thickener && (
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <Text style={{ fontSize: 13, color: '#6b7280' }}>凝固粉:</Text>
                  <Text style={{ fontSize: 13, fontWeight: '600', color: '#2563eb' }}>{form.thickener_amount || '待填寫分量'}</Text>
                </View>
              )}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
