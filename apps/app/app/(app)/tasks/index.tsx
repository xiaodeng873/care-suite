import { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResidents } from '@/features/residents/useResidents';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';
import {
  useTasks, useCreateTask, useUpdateTask, useDeleteTask,
  TASK_TYPES, FREQUENCY_UNITS, type PatientTask,
} from '@/features/tasks/useTasks';
import { isOverdue } from '@/lib/utils/isOverdue';
import { filterTasks } from '@/features/tasks/filterTasks';
import { formatTaskFrequency } from '@/features/tasks/formatTaskFrequency';

const TASK_COLORS: Record<string, string> = {
  '生命表徵': '#3b82f6', '血糖控制': '#f59e0b', '體重控制': '#8b5cf6',
  '年度體檢': '#22c55e', '傷口換症': '#ef4444', '導尿管更換': '#06b6d4',
};

// 完全對應 web TaskManagement 的分組選單
const TASK_GROUPS: { label: string; types: string[] }[] = [
  { label: '監測任務', types: ['生命表徵', '血糖控制', '體重控制'] },
  { label: '護理任務', types: ['導尿管更換', '鼻胃飼管更換', '傷口換症', '氧氣喉管清洗/更換'] },
  { label: '文件任務', types: ['約束物品同意書', '年度體檢', '藥物自存同意書', '晴晴計劃'] },
];

type FormState = {
  patient_id: number | null;
  health_record_type: string;
  frequency_unit: string;
  frequency_value: string;
  next_due_at: string;
  notes: string;
  is_recurring: boolean;
  start_date: string;
  end_date: string;
};

const EMPTY: FormState = {
  patient_id: null,
  health_record_type: '生命表徵',
  frequency_unit: 'daily',
  frequency_value: '1',
  next_due_at: new Date().toISOString().split('T')[0],
  notes: '',
  is_recurring: true,
  start_date: new Date().toISOString().split('T')[0],
  end_date: '',
};

export default function TasksScreen() {
  const { data: residents = [] } = useResidents();
  const { data: tasks = [], isLoading, refetch } = useTasks();
  const createTask = useCreateTask();
  const updateTask = useUpdateTask();
  const deleteTask = useDeleteTask();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PatientTask | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  const filtered = useMemo(
    () => filterTasks(tasks, residents, search),
    [tasks, residents, search]
  );

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(task: PatientTask) {
    setEditing(task);
    setForm({
      patient_id: task.patient_id,
      health_record_type: task.health_record_type,
      frequency_unit: task.frequency_unit,
      frequency_value: String(task.frequency_value),
      next_due_at: task.next_due_at?.split('T')[0] ?? '',
      notes: task.notes ?? '',
      is_recurring: task.is_recurring ?? true,
      start_date: task.start_date ?? '',
      end_date: task.end_date ?? '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.patient_id) { Alert.alert('提示', '請選擇院友'); return; }
    const payload = {
      patient_id: form.patient_id,
      health_record_type: form.health_record_type as any,
      frequency_unit: form.frequency_unit as any,
      frequency_value: Number(form.frequency_value) || 1,
      next_due_at: form.next_due_at,
      notes: form.notes || undefined,
      is_recurring: form.is_recurring,
      start_date: form.start_date || undefined,
      end_date: form.end_date || undefined,
    };
    if (editing) { await updateTask.mutateAsync({ ...editing, ...payload }); }
    else { await createTask.mutateAsync(payload); }
    setShowModal(false);
  }

  function handleDelete(id: string) {
    Alert.alert('確認刪除', '確定刪除此任務？', [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => deleteTask.mutate(id) },
    ]);
  }

  const isSaving = createTask.isPending || updateTask.isPending;

  return (
    <View className="flex-1 bg-gray-50">
      <View className="px-4 pt-4 pb-2">
        <View className="flex-row items-center bg-white rounded-xl px-3 py-2 shadow-sm">
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput className="flex-1 ml-2 text-base text-gray-800" placeholder="搜尋院友或任務類型..." value={search} onChangeText={setSearch} />
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
            const overdue = isOverdue(item.next_due_at);
            const typeColor = TASK_COLORS[item.health_record_type] ?? '#9ca3af';
            return (
              <TouchableOpacity
                className="bg-white rounded-xl mb-3 px-4 py-3 shadow-sm"
                style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, borderLeftWidth: 3, borderLeftColor: overdue ? '#ef4444' : '#e5e7eb' }}
                onPress={() => openEdit(item)} activeOpacity={0.7}
              >
                <View className="flex-row items-start justify-between">
                  <View className="flex-1">
                    <View className="flex-row items-center gap-2 mb-1">
                      <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: typeColor + '20' }}>
                        <Text className="text-xs font-medium" style={{ color: typeColor }}>{item.health_record_type}</Text>
                      </View>
                      {overdue && <View className="bg-red-100 px-2 py-0.5 rounded-full"><Text className="text-xs text-red-700">逾期</Text></View>}
                    </View>
                    {patient && <Text className="text-sm text-gray-800">{patient.床號} {patient.中文姓名}</Text>}
                    <Text className="text-xs text-gray-500 mt-0.5">下次執行：{item.next_due_at?.split('T')[0]}</Text>
                    <Text className="text-xs text-gray-400">頻率：{formatTaskFrequency(item.frequency_value, item.frequency_unit)}</Text>
                    {item.notes && <Text className="text-xs text-gray-400 mt-1">{item.notes}</Text>}
                  </View>
                  <TouchableOpacity onPress={() => handleDelete(item.id)} className="p-1">
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
          ListEmptyComponent={<Text className="text-center text-gray-400 mt-16">暫無任務記錄</Text>}
        />
      )}

      <TouchableOpacity className="absolute bottom-8 right-6 w-14 h-14 bg-blue-500 rounded-full items-center justify-center shadow-lg" style={{ elevation: 6 }} onPress={openCreate}>
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowModal(false)}><Text className="text-base text-gray-500">取消</Text></TouchableOpacity>
            <Text className="text-base font-semibold">{editing ? '編輯任務' : '新增任務'}</Text>
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

            <Text className="text-sm font-medium text-gray-700 mb-1">任務類型</Text>
            <View className="mb-4">
              {TASK_GROUPS.map(group => (
                <View key={group.label} className="mb-3">
                  <Text className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wider">{group.label}</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {group.types.map(t => (
                      <TouchableOpacity key={t} onPress={() => setForm(f => ({ ...f, health_record_type: t }))}
                        className="px-3 py-2 rounded-xl border"
                        style={{ backgroundColor: form.health_record_type === t ? '#3b82f6' : 'white', borderColor: form.health_record_type === t ? '#3b82f6' : '#e5e7eb' }}>
                        <Text style={{ color: form.health_record_type === t ? 'white' : '#374151', fontSize: 12 }}>{t}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ))}
            </View>

            <Text className="text-sm font-medium text-gray-700 mb-1">頻率</Text>
            <View className="flex-row gap-2 mb-1">
              <TextInput
                className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 w-20"
                value={form.frequency_value} onChangeText={v => setForm(f => ({ ...f, frequency_value: v }))}
                keyboardType="numeric" placeholder="1"
              />
              <ScrollView horizontal showsHorizontalScrollIndicator={false} className="flex-1">
                {FREQUENCY_UNITS.map(u => (
                  <TouchableOpacity key={u.key} onPress={() => setForm(f => ({ ...f, frequency_unit: u.key }))}
                    className="mr-2 px-3 py-3 rounded-xl border"
                    style={{ backgroundColor: form.frequency_unit === u.key ? '#3b82f6' : 'white', borderColor: form.frequency_unit === u.key ? '#3b82f6' : '#e5e7eb' }}>
                    <Text style={{ color: form.frequency_unit === u.key ? 'white' : '#374151', fontSize: 13 }}>{u.label}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
            <Text className="text-xs text-gray-400 mb-4">{formatTaskFrequency(form.frequency_value || '1', form.frequency_unit as any)}</Text>

            <Text className="text-sm font-medium text-gray-700 mb-1">下次執行日期</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4" value={form.next_due_at} onChangeText={v => setForm(f => ({ ...f, next_due_at: v }))} placeholder="YYYY-MM-DD" />

            <Text className="text-sm font-medium text-gray-700 mb-1">開始日期</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4" value={form.start_date} onChangeText={v => setForm(f => ({ ...f, start_date: v }))} placeholder="YYYY-MM-DD（可選）" />

            <Text className="text-sm font-medium text-gray-700 mb-1">結束日期</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4" value={form.end_date} onChangeText={v => setForm(f => ({ ...f, end_date: v }))} placeholder="YYYY-MM-DD（可選）" />

            <View className="flex-row items-center justify-between bg-white rounded-xl px-4 py-3 mb-4 border border-gray-200">
              <Text className="text-base text-gray-700">循環任務</Text>
              <Switch value={form.is_recurring} onValueChange={v => setForm(f => ({ ...f, is_recurring: v }))} trackColor={{ false: '#e5e7eb', true: '#3b82f6' }} />
            </View>

            <Text className="text-sm font-medium text-gray-700 mb-1">備註</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-8" value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder="備註（可選）" multiline numberOfLines={3} textAlignVertical="top" style={{ minHeight: 80 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
