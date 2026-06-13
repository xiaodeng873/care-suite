import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';
import { ResidentGroupedList } from '@/components/ResidentGroupedList';
import {
  usePatientLogs, useCreatePatientLog, useUpdatePatientLog, useDeletePatientLog,
  LOG_TYPES, type PatientLog, type LogType,
} from '@/features/patient-logs/usePatientLogs';

const LOG_TYPE_COLOR: Record<LogType, { bg: string; text: string }> = {
  '日常護理': { bg: '#dbeafe', text: '#1d4ed8' },
  '文件簽署': { bg: '#ede9fe', text: '#7c3aed' },
  '入院/出院': { bg: '#dcfce7', text: '#16a34a' },
  '入住/退住': { bg: '#fef3c7', text: '#d97706' },
  '醫生到診': { bg: '#e0f2fe', text: '#0369a1' },
  '意外事故': { bg: '#fee2e2', text: '#dc2626' },
  '覆診返藥': { bg: '#d1fae5', text: '#059669' },
  '其他': { bg: '#f3f4f6', text: '#6b7280' },
};

type FormState = {
  patient_id: number | null;
  log_date: string;
  log_type: LogType;
  content: string;
  recorder: string;
};

const EMPTY: FormState = {
  patient_id: null,
  log_date: new Date().toISOString().slice(0, 10),
  log_type: '日常護理',
  content: '',
  recorder: '',
};

export default function PatientLogsScreen() {
  const { data: logs = [], isLoading, refetch } = usePatientLogs();
  const createLog = useCreatePatientLog();
  const updateLog = useUpdatePatientLog();
  const deleteLog = useDeletePatientLog();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<PatientLog | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(l: PatientLog) {
    setEditing(l);
    setForm({ patient_id: l.patient_id, log_date: l.log_date, log_type: l.log_type, content: l.content, recorder: l.recorder });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.patient_id || !form.content.trim()) {
      Alert.alert('提示', '請選擇院友並填寫日誌內容');
      return;
    }
    const payload = {
      patient_id: form.patient_id,
      log_date: form.log_date,
      log_type: form.log_type,
      content: form.content.trim(),
      recorder: form.recorder.trim(),
    };
    if (editing) { await updateLog.mutateAsync({ ...editing, ...payload }); }
    else { await createLog.mutateAsync(payload); }
    setShowModal(false);
  }

  const isSaving = createLog.isPending || updateLog.isPending;

  return (
    <View className="flex-1 bg-gray-50">
      <ResidentGroupedList
        records={logs}
        isLoading={isLoading}
        onRefresh={refetch}
        getPatientId={(l) => l.patient_id}
        getDate={(l) => l.log_date}
        getRecordSearchText={(l) => `${l.log_type} ${l.content} ${l.recorder}`}
        emptyText="暫無日誌記錄"
        renderCard={(item) => (
          <TouchableOpacity
            className="bg-white rounded-xl mb-2 px-4 py-3 shadow-sm"
            style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
            onPress={() => openEdit(item)} activeOpacity={0.7}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <View style={{ backgroundColor: LOG_TYPE_COLOR[item.log_type]?.bg ?? '#f3f4f6', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                    <Text style={{ fontSize: 12, color: LOG_TYPE_COLOR[item.log_type]?.text ?? '#6b7280' }}>{item.log_type}</Text>
                  </View>
                  <Text className="text-xs text-gray-400">{item.log_date}</Text>
                </View>
                <Text className="text-sm text-gray-800" numberOfLines={3}>{item.content}</Text>
                {item.recorder ? <Text className="text-xs text-gray-400 mt-1">記錄人：{item.recorder}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => Alert.alert('確認刪除', '確定要刪除此日誌？', [
                { text: '取消', style: 'cancel' },
                { text: '刪除', style: 'destructive', onPress: () => deleteLog.mutate(item.id) },
              ])} className="p-1">
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        className="absolute bottom-8 right-6 w-14 h-14 bg-blue-500 rounded-full items-center justify-center shadow-lg"
        style={{ elevation: 6 }} onPress={openCreate}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text className="text-base text-gray-500">取消</Text>
            </TouchableOpacity>
            <Text className="text-base font-semibold text-gray-900">{editing ? '編輯日誌' : '新增日誌'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              {isSaving
                ? <ActivityIndicator size="small" color="#3b82f6" />
                : <Text className="text-base font-semibold text-blue-500">儲存</Text>}
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

            <Text className="text-sm font-medium text-gray-700 mb-1">日期 *</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.log_date}
              onChangeText={v => setForm(f => ({ ...f, log_date: v }))}
              placeholder="YYYY-MM-DD"
            />

            <Text className="text-sm font-medium text-gray-700 mb-1">日誌類型</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              {LOG_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setForm(f => ({ ...f, log_type: t }))}
                  className="mr-2 px-3 py-2 rounded-xl border"
                  style={{
                    backgroundColor: form.log_type === t ? '#3b82f6' : 'white',
                    borderColor: form.log_type === t ? '#3b82f6' : '#e5e7eb',
                  }}
                >
                  <Text style={{ color: form.log_type === t ? 'white' : '#374151', fontSize: 13 }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>

            <Text className="text-sm font-medium text-gray-700 mb-1">內容 *</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.content}
              onChangeText={v => setForm(f => ({ ...f, content: v }))}
              placeholder="請輸入日誌內容"
              multiline numberOfLines={5}
              textAlignVertical="top"
              style={{ minHeight: 120 }}
            />

            <Text className="text-sm font-medium text-gray-700 mb-1">記錄人</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-8"
              value={form.recorder}
              onChangeText={v => setForm(f => ({ ...f, recorder: v }))}
              placeholder="請輸入記錄人名稱"
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
