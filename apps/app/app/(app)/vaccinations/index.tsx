import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';
import { ResidentGroupedList } from '@/components/ResidentGroupedList';
import {
  useVaccinationRecords, useCreateVaccinationRecord, useUpdateVaccinationRecord, useDeleteVaccinationRecord,
  type VaccinationRecord,
} from '@/features/vaccinations/useVaccinations';

const COMMON_VACCINES = [
  '流感疫苗',
  '肺炎球菌疫苗',
  '新冠疫苗（煇1劑）',
  '新冠疫苗（煇2劑）',
  '新冠疫苗（加強劑）',
  '破傷風疫苗',
];

type FormState = {
  patient_id: number | null;
  vaccination_date: string;
  vaccine_item: string;
  vaccination_unit: string;
  remarks: string;
  created_by: string;
};

const EMPTY: FormState = {
  patient_id: null,
  vaccination_date: new Date().toISOString().slice(0, 10),
  vaccine_item: '',
  vaccination_unit: '',
  remarks: '',
  created_by: '',
};

export default function VaccinationsScreen() {
  const { data: records = [], isLoading, refetch } = useVaccinationRecords();
  const createRecord = useCreateVaccinationRecord();
  const updateRecord = useUpdateVaccinationRecord();
  const deleteRecord = useDeleteVaccinationRecord();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<VaccinationRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [customVaccine, setCustomVaccine] = useState('');

  function openCreate() { setEditing(null); setForm(EMPTY); setCustomVaccine(''); setShowModal(true); }
  function openEdit(r: VaccinationRecord) {
    setEditing(r);
    setForm({
      patient_id: r.patient_id,
      vaccination_date: r.vaccination_date,
      vaccine_item: r.vaccine_item,
      vaccination_unit: r.vaccination_unit,
      remarks: r.remarks ?? '',
      created_by: r.created_by ?? '',
    });
    setCustomVaccine(COMMON_VACCINES.includes(r.vaccine_item) ? '' : r.vaccine_item);
    setShowModal(true);
  }

  async function handleSave() {
    const vaccineItem = customVaccine.trim() || form.vaccine_item;
    if (!form.patient_id || !vaccineItem) {
      Alert.alert('提示', '請選擇院友並選擇或輸入疫苗名稱');
      return;
    }
    const payload = {
      patient_id: form.patient_id,
      vaccination_date: form.vaccination_date,
      vaccine_item: vaccineItem,
      vaccination_unit: form.vaccination_unit.trim(),
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
        getDate={(r) => r.vaccination_date}
        getRecordSearchText={(r) => `${r.vaccine_item} ${r.vaccination_unit} ${r.remarks ?? ''}`}
        emptyText="暫無疫苗記錄"
        renderCard={(item) => (
          <TouchableOpacity
            className="bg-white rounded-xl mb-2 px-4 py-3 shadow-sm"
            style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
            onPress={() => openEdit(item)} activeOpacity={0.7}
          >
            <View className="flex-row items-start justify-between">
              <View className="flex-1">
                <View className="flex-row items-center gap-2 mb-1">
                  <Ionicons name="medkit-outline" size={16} color="#3b82f6" />
                  <Text className="text-base font-semibold text-gray-900">{item.vaccine_item}</Text>
                </View>
                {item.vaccination_unit ? <Text className="text-sm text-gray-500">接种單位：{item.vaccination_unit}</Text> : null}
                <Text className="text-xs text-gray-400 mt-1">接种日期：{item.vaccination_date}</Text>
                {item.remarks ? <Text className="text-sm text-gray-600 mt-1" numberOfLines={2}>{item.remarks}</Text> : null}
              </View>
              <TouchableOpacity onPress={() => Alert.alert('確認刪除', '確定要刪除此痫苗記錄？', [
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
            <Text className="text-base font-semibold text-gray-900">{editing ? '編輯疫苗記錄' : '新增疫苗記錄'}</Text>
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

            <Text className="text-sm font-medium text-gray-700 mb-1">接种日期 *</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.vaccination_date}
              onChangeText={v => setForm(f => ({ ...f, vaccination_date: v }))}
              placeholder="YYYY-MM-DD"
            />

            <Text className="text-sm font-medium text-gray-700 mb-1">疫苗項目 *</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-2">
              {COMMON_VACCINES.map(v => (
                <TouchableOpacity
                  key={v}
                  onPress={() => { setForm(f => ({ ...f, vaccine_item: v })); setCustomVaccine(''); }}
                  className="mr-2 px-3 py-2 rounded-xl border"
                  style={{
                    backgroundColor: form.vaccine_item === v && !customVaccine ? '#3b82f6' : 'white',
                    borderColor: form.vaccine_item === v && !customVaccine ? '#3b82f6' : '#e5e7eb',
                  }}
                >
                  <Text style={{ color: form.vaccine_item === v && !customVaccine ? 'white' : '#374151', fontSize: 13 }}>{v}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={customVaccine}
              onChangeText={v => { setCustomVaccine(v); if (v) setForm(f => ({ ...f, vaccine_item: '' })); }}
              placeholder="或輸入自定義疫苗名稱"
            />

            <Text className="text-sm font-medium text-gray-700 mb-1">接种單位</Text>
            <TextInput
              className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4"
              value={form.vaccination_unit}
              onChangeText={v => setForm(f => ({ ...f, vaccination_unit: v }))}
              placeholder="請輸入接种單位"
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
