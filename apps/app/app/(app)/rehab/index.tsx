import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';
import { ResidentGroupedList } from '@/components/ResidentGroupedList';
import {
  useRehabRecords, useCreateRehabRecord, useUpdateRehabRecord, useDeleteRehabRecord,
  REHAB_SERVICE_TYPES, type RehabRecord,
} from '@/features/rehab/useRehab';

const SERVICE_TYPE_COLORS: Record<string, string> = {
  '物理治療': '#3b82f6',
  '職業治療': '#8b5cf6',
  '言語治療': '#f59e0b',
  '日常活動訓練': '#22c55e',
  '平衡與步行訓練': '#06b6d4',
  '其他': '#9ca3af',
};

type FormState = {
  patient_id: number | null;
  service_date: string;
  service_type: string;
  therapist_name: string;
  session_duration: string;
  goals: string;
  progress_notes: string;
  next_session_date: string;
  created_by: string;
};

const EMPTY: FormState = {
  patient_id: null,
  service_date: new Date().toISOString().split('T')[0],
  service_type: '物理治療',
  therapist_name: '',
  session_duration: '',
  goals: '',
  progress_notes: '',
  next_session_date: '',
  created_by: '',
};

export default function RehabScreen() {
  const { data: records = [], isLoading, refetch } = useRehabRecords();
  const createRecord = useCreateRehabRecord();
  const updateRecord = useUpdateRehabRecord();
  const deleteRecord = useDeleteRehabRecord();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<RehabRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(rec: RehabRecord) {
    setEditing(rec);
    setForm({
      patient_id: rec.patient_id,
      service_date: rec.service_date,
      service_type: rec.service_type,
      therapist_name: rec.therapist_name ?? '',
      session_duration: rec.session_duration ? String(rec.session_duration) : '',
      goals: rec.goals ?? '',
      progress_notes: rec.progress_notes ?? '',
      next_session_date: rec.next_session_date ?? '',
      created_by: rec.created_by ?? '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.patient_id) {
      Alert.alert('提示', '請選擇院友');
      return;
    }
    const payload = {
      patient_id: form.patient_id,
      service_date: form.service_date,
      service_type: form.service_type as RehabRecord['service_type'],
      therapist_name: form.therapist_name || undefined,
      session_duration: form.session_duration ? parseInt(form.session_duration, 10) : undefined,
      goals: form.goals || undefined,
      progress_notes: form.progress_notes || undefined,
      next_session_date: form.next_session_date || undefined,
      created_by: form.created_by || undefined,
    };
    try {
      if (editing) { await updateRecord.mutateAsync({ ...editing, ...payload }); }
      else { await createRecord.mutateAsync(payload); }
      setShowModal(false);
    } catch (e: any) {
      Alert.alert('錯誤', e.message ?? '儲存失敗');
    }
  }

  function handleDelete(id: string) {
    Alert.alert('確認刪除', '確定刪除此復康記錄？', [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => deleteRecord.mutate(id) },
    ]);
  }

  const isSaving = createRecord.isPending || updateRecord.isPending;

  return (
    <View className="flex-1 bg-gray-50">
      <ResidentGroupedList
        records={records}
        isLoading={isLoading}
        onRefresh={refetch}
        getPatientId={(r) => r.patient_id}
        getDate={(r) => r.service_date}
        getRecordSearchText={(r) => `${r.service_type} ${r.therapist_name ?? ''}`}
        emptyText="暫無復康記錄"
        renderCard={(item) => {
          const typeColor = SERVICE_TYPE_COLORS[item.service_type] ?? '#9ca3af';
          return (
            <TouchableOpacity
              className="bg-white rounded-xl mb-2 px-4 py-3 shadow-sm"
              style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2, borderLeftWidth: 3, borderLeftColor: typeColor }}
              onPress={() => openEdit(item)}
              activeOpacity={0.7}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="flex-row items-center gap-2 mb-1">
                    <View className="px-2 py-0.5 rounded-full" style={{ backgroundColor: typeColor + '20' }}>
                      <Text className="text-xs font-medium" style={{ color: typeColor }}>{item.service_type}</Text>
                    </View>
                    {item.session_duration && (
                      <Text className="text-xs text-gray-400">{item.session_duration} 分鐘</Text>
                    )}
                  </View>
                  <View className="flex-row mt-1 gap-3 flex-wrap">
                    <Text className="text-xs text-gray-400">{item.service_date}</Text>
                    {item.therapist_name && (
                      <Text className="text-xs text-gray-400">治療師：{item.therapist_name}</Text>
                    )}
                  </View>
                  {item.progress_notes && (
                    <Text className="text-xs text-gray-500 mt-1" numberOfLines={2}>{item.progress_notes}</Text>
                  )}
                  {item.next_session_date && (
                    <Text className="text-xs text-purple-500 mt-1">下次：{item.next_session_date}</Text>
                  )}
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id)} className="p-1">
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        className="absolute bottom-8 right-6 w-14 h-14 bg-purple-500 rounded-full items-center justify-center shadow-lg"
        style={{ elevation: 6 }}
        onPress={openCreate}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* ─── 新增 / 編輯 Modal ─────────────────────────────────── */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text className="text-base text-gray-500">取消</Text>
            </TouchableOpacity>
            <Text className="text-base font-semibold">{editing ? '編輯復康記錄' : '新增復康記錄'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              {isSaving
                ? <ActivityIndicator size="small" color="#8b5cf6" />
                : <Text className="text-base font-semibold text-purple-500">儲存</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
            {/* 院友 */}
            <Text className="text-sm font-medium text-gray-700 mb-1">院友 *</Text>
            <View className="mb-4">
              <PatientAutocomplete
                value={form.patient_id}
                onChange={(id) => setForm(f => ({ ...f, patient_id: id }))}
                showResidencyFilter
                defaultResidencyStatus="在住"
              />
            </View>

            {/* 服務日期 */}
            <Text className="text-sm font-medium text-gray-700 mb-1">服務日期 *</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.service_date}
              onChangeText={v => setForm(f => ({ ...f, service_date: v }))}
              placeholder="YYYY-MM-DD"
            />

            {/* 服務類型 */}
            <Text className="text-sm font-medium text-gray-700 mb-1">服務類型 *</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {REHAB_SERVICE_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setForm(f => ({ ...f, service_type: t }))}
                  className="px-3 py-2 rounded-xl border"
                  style={{ backgroundColor: form.service_type === t ? '#8b5cf6' : 'white', borderColor: form.service_type === t ? '#8b5cf6' : '#e5e7eb' }}
                >
                  <Text style={{ color: form.service_type === t ? 'white' : '#374151', fontSize: 13 }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 治療師 */}
            <Text className="text-sm font-medium text-gray-700 mb-1">治療師姓名</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.therapist_name}
              onChangeText={v => setForm(f => ({ ...f, therapist_name: v }))}
              placeholder="治療師姓名（可選）"
            />

            {/* 時長 */}
            <Text className="text-sm font-medium text-gray-700 mb-1">每節時長（分鐘）</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.session_duration}
              onChangeText={v => setForm(f => ({ ...f, session_duration: v }))}
              placeholder="例：30"
              keyboardType="numeric"
            />

            {/* 治療目標 */}
            <Text className="text-sm font-medium text-gray-700 mb-1">治療目標</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.goals}
              onChangeText={v => setForm(f => ({ ...f, goals: v }))}
              placeholder="描述本次/本階段治療目標（可選）"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 80 }}
            />

            {/* 進度備註 */}
            <Text className="text-sm font-medium text-gray-700 mb-1">進度備註</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.progress_notes}
              onChangeText={v => setForm(f => ({ ...f, progress_notes: v }))}
              placeholder="本節進度、觀察或說明（可選）"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              style={{ minHeight: 100 }}
            />

            {/* 下次預約 */}
            <Text className="text-sm font-medium text-gray-700 mb-1">下次預約日期</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.next_session_date}
              onChangeText={v => setForm(f => ({ ...f, next_session_date: v }))}
              placeholder="YYYY-MM-DD（可選）"
            />

            {/* 填報人 */}
            <Text className="text-sm font-medium text-gray-700 mb-1">填報人</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-8"
              value={form.created_by}
              onChangeText={v => setForm(f => ({ ...f, created_by: v }))}
              placeholder="填報人姓名（可選）"
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
