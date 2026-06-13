import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';
import { ResidentGroupedList } from '@/components/ResidentGroupedList';
import {
  useDiagnosisRecords, useCreateDiagnosisRecord, useUpdateDiagnosisRecord, useDeleteDiagnosisRecord,
  type DiagnosisRecord,
} from '@/features/diagnosis/useDiagnosis';

type FormState = {
  patient_id: number | null;
  diagnosis_date: string;
  diagnosis_item: string;
  diagnosis_unit: string;
  remarks: string;
  created_by: string;
};

const EMPTY: FormState = {
  patient_id: null,
  diagnosis_date: new Date().toISOString().slice(0, 10),
  diagnosis_item: '',
  diagnosis_unit: '',
  remarks: '',
  created_by: '',
};

export default function DiagnosisScreen() {
  const { data: records = [], isLoading, refetch } = useDiagnosisRecords();
  const createRecord = useCreateDiagnosisRecord();
  const updateRecord = useUpdateDiagnosisRecord();
  const deleteRecord = useDeleteDiagnosisRecord();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<DiagnosisRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(r: DiagnosisRecord) {
    setEditing(r);
    setForm({
      patient_id: r.patient_id,
      diagnosis_date: r.diagnosis_date,
      diagnosis_item: r.diagnosis_item,
      diagnosis_unit: r.diagnosis_unit,
      remarks: r.remarks ?? '',
      created_by: r.created_by ?? '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.patient_id || !form.diagnosis_item.trim()) {
      Alert.alert('提示', '請選擇院友並填寫診斷項目');
      return;
    }
    const payload = {
      patient_id: form.patient_id,
      diagnosis_date: form.diagnosis_date,
      diagnosis_item: form.diagnosis_item.trim(),
      diagnosis_unit: form.diagnosis_unit.trim(),
      remarks: form.remarks || undefined,
      created_by: form.created_by || undefined,
    };
    if (editing) { await updateRecord.mutateAsync({ ...editing, ...payload }); }
    else { await createRecord.mutateAsync(payload); }
    setShowModal(false);
  }

  const isSaving = createRecord.isPending || updateRecord.isPending;

  return (
    <View className="flex-1 bg-gray-50">
      <ResidentGroupedList
        records={records}
        isLoading={isLoading}
        onRefresh={refetch}
        getPatientId={(r) => r.patient_id}
        getDate={(r) => r.diagnosis_date}
        getRecordSearchText={(r) => `${r.diagnosis_item} ${r.diagnosis_unit} ${r.remarks ?? ''}`}
        emptyText="暫無診斷記錄"
        renderCard={(item) => (
          <TouchableOpacity
            className="bg-white rounded-xl mb-2 px-4 py-3 shadow-sm"
            style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
            onPress={() => openEdit(item)} activeOpacity={0.7}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <Text className="text-base font-semibold text-gray-900">{item.diagnosis_item}</Text>
                {item.diagnosis_unit ? <Text className="text-sm text-gray-500 mt-0.5">醫病單位：{item.diagnosis_unit}</Text> : null}
                <Text className="text-xs text-gray-400 mt-1">診斷日期：{item.diagnosis_date}</Text>
                {item.remarks ? <Text className="text-sm text-gray-600 mt-1" numberOfLines={2}>{item.remarks}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => Alert.alert('確認刪除', '確定要刪除此診斷記錄？', [
                { text: '取消', style: 'cancel' },
                { text: '刪除', style: 'destructive', onPress: () => deleteRecord.mutate(item.id) },
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
            <Text className="text-base font-semibold text-gray-900">{editing ? '編輯診斷' : '新增診斷'}</Text>
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

            <Text className="text-sm font-medium text-gray-700 mb-1">診斷日期 *</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.diagnosis_date}
              onChangeText={v => setForm(f => ({ ...f, diagnosis_date: v }))}
              placeholder="YYYY-MM-DD"
            />

            <Text className="text-sm font-medium text-gray-700 mb-1">診斷項目 *</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.diagnosis_item}
              onChangeText={v => setForm(f => ({ ...f, diagnosis_item: v }))}
              placeholder="請輸入診斷項目"
            />

            <Text className="text-sm font-medium text-gray-700 mb-1">醫病單位</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.diagnosis_unit}
              onChangeText={v => setForm(f => ({ ...f, diagnosis_unit: v }))}
              placeholder="請輸入醫病單位"
            />

            <Text className="text-sm font-medium text-gray-700 mb-1">備註</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.remarks}
              onChangeText={v => setForm(f => ({ ...f, remarks: v }))}
              placeholder="備註（可選）"
              multiline numberOfLines={3}
              textAlignVertical="top"
              style={{ minHeight: 80 }}
            />

            <Text className="text-sm font-medium text-gray-700 mb-1">記錄人</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-8"
              value={form.created_by}
              onChangeText={v => setForm(f => ({ ...f, created_by: v }))}
              placeholder="請輸入記錄人名稱"
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
