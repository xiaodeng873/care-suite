import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';
import { ResidentGroupedList } from '@/components/ResidentGroupedList';
import {
  useOutreach, useCreateOutreach, useUpdateOutreach, useDeleteOutreach,
  PICKUP_ARRANGEMENT_OPTIONS, MEDICATION_SOURCE_OPTIONS,
  type HospitalOutreachRecord, type MedicationPickupArrangement, type OutreachMedicationSource,
} from '@/features/outreach/useOutreach';

type FormState = {
  patient_id: number | null;
  medication_bag_date: string;
  prescription_weeks: string;
  medication_end_date: string;
  outreach_appointment_date: string;
  medication_pickup_arrangement: MedicationPickupArrangement;
  outreach_medication_source: OutreachMedicationSource | '';
  remarks: string;
};

const EMPTY: FormState = {
  patient_id: null,
  medication_bag_date: new Date().toISOString().split('T')[0],
  prescription_weeks: '',
  medication_end_date: '',
  outreach_appointment_date: '',
  medication_pickup_arrangement: '院舍代勞',
  outreach_medication_source: '',
  remarks: '',
};

export default function OutreachScreen() {
  const { data: records = [], isLoading, refetch } = useOutreach();
  const createRecord = useCreateOutreach();
  const updateRecord = useUpdateOutreach();
  const deleteRecord = useDeleteOutreach();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<HospitalOutreachRecord | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(rec: HospitalOutreachRecord) {
    setEditing(rec);
    setForm({
      patient_id: rec.patient_id,
      medication_bag_date: rec.medication_bag_date,
      prescription_weeks: String(rec.prescription_weeks),
      medication_end_date: rec.medication_end_date,
      outreach_appointment_date: rec.outreach_appointment_date ?? '',
      medication_pickup_arrangement: rec.medication_pickup_arrangement,
      outreach_medication_source: rec.outreach_medication_source ?? '',
      remarks: rec.remarks ?? '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.patient_id) { Alert.alert('提示', '請選擇院友'); return; }
    if (!form.medication_bag_date) { Alert.alert('提示', '請填寫藥袋日期'); return; }
    if (!form.prescription_weeks) { Alert.alert('提示', '請填寫處方週數'); return; }
    if (!form.medication_end_date) { Alert.alert('提示', '請填寫藥完日期'); return; }
    try {
      const payload = {
        patient_id: form.patient_id,
        medication_bag_date: form.medication_bag_date,
        prescription_weeks: Number(form.prescription_weeks),
        medication_end_date: form.medication_end_date,
        outreach_appointment_date: form.outreach_appointment_date || undefined,
        medication_pickup_arrangement: form.medication_pickup_arrangement,
        outreach_medication_source: (form.outreach_medication_source || undefined) as OutreachMedicationSource | undefined,
        remarks: form.remarks || undefined,
      };
      if (editing) { await updateRecord.mutateAsync({ ...editing, ...payload }); }
      else { await createRecord.mutateAsync(payload); }
      setShowModal(false);
    } catch (e: any) { Alert.alert('儲存失敗', e?.message ?? '請重試'); }
  }

  const isSaving = createRecord.isPending || updateRecord.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ResidentGroupedList
        records={records}
        isLoading={isLoading}
        onRefresh={refetch}
        getPatientId={(r) => r.patient_id}
        getDate={(r) => r.medication_bag_date}
        getRecordSearchText={(r) => `${r.outreach_medication_source ?? ''} ${r.remarks ?? ''}`}
        emptyText="暫無外展記錄"
        renderCard={(item) => (
          <TouchableOpacity
            style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
            onPress={() => openEdit(item)} activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>藥袋日期：{item.medication_bag_date}</Text>
                <Text style={{ fontSize: 12, color: '#6b7280' }}>藥完日期：{item.medication_end_date}</Text>
                {item.outreach_appointment_date && <Text style={{ fontSize: 12, color: '#2563eb' }}>覆診日期：{item.outreach_appointment_date}</Text>}
                <View style={{ flexDirection: 'row', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
                  <View style={{ backgroundColor: '#eff6ff', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                    <Text style={{ fontSize: 11, color: '#1d4ed8' }}>{item.medication_pickup_arrangement}</Text>
                  </View>
                  {item.outreach_medication_source && (
                    <View style={{ backgroundColor: '#f3f4f6', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                      <Text style={{ fontSize: 11, color: '#374151' }}>{item.outreach_medication_source}</Text>
                    </View>
                  )}
                </View>
                {item.remarks && <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{item.remarks}</Text>}
              </View>
              <TouchableOpacity onPress={() => Alert.alert('確認刪除', '確定刪除此外展記錄？', [{ text: '取消', style: 'cancel' }, { text: '刪除', style: 'destructive', onPress: () => deleteRecord.mutate(item.id) }])} style={{ padding: 4 }}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity style={{ position: 'absolute', bottom: 32, right: 24, width: 56, height: 56, backgroundColor: '#3b82f6', borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 }} onPress={openCreate}>
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            <TouchableOpacity onPress={() => setShowModal(false)}><Text style={{ fontSize: 16, color: '#6b7280' }}>取消</Text></TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>{editing ? '編輯外展記錄' : '新增外展記錄'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              {isSaving ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text style={{ fontSize: 16, fontWeight: '600', color: '#3b82f6' }}>儲存</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
            {/* 院友 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>院友 *</Text>
            <View style={{ marginBottom: 16 }}>
              <PatientAutocomplete
                value={form.patient_id}
                onChange={(id) => setForm(f => ({ ...f, patient_id: id }))}
                showResidencyFilter
                defaultResidencyStatus="在住"
              />
            </View>

            {/* 藥袋日期 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>藥袋日期 *</Text>
            <TextInput style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 16 }} value={form.medication_bag_date} onChangeText={v => setForm(f => ({ ...f, medication_bag_date: v }))} placeholder="YYYY-MM-DD" placeholderTextColor="#9ca3af" />

            {/* 處方週數 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>處方週數 *</Text>
            <TextInput style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 16 }} value={form.prescription_weeks} onChangeText={v => setForm(f => ({ ...f, prescription_weeks: v }))} placeholder="如：4" placeholderTextColor="#9ca3af" keyboardType="numeric" />

            {/* 藥完日期 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>藥完日期 *</Text>
            <TextInput style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 16 }} value={form.medication_end_date} onChangeText={v => setForm(f => ({ ...f, medication_end_date: v }))} placeholder="YYYY-MM-DD" placeholderTextColor="#9ca3af" />

            {/* 覆診日期 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>覆診日期</Text>
            <TextInput style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 16 }} value={form.outreach_appointment_date} onChangeText={v => setForm(f => ({ ...f, outreach_appointment_date: v }))} placeholder="YYYY-MM-DD（可選）" placeholderTextColor="#9ca3af" />

            {/* 取藥安排 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>取藥安排 *</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {PICKUP_ARRANGEMENT_OPTIONS.map(opt => (
                <TouchableOpacity key={opt} onPress={() => setForm(f => ({ ...f, medication_pickup_arrangement: opt }))}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, backgroundColor: form.medication_pickup_arrangement === opt ? '#3b82f6' : 'white', borderColor: form.medication_pickup_arrangement === opt ? '#3b82f6' : '#e5e7eb' }}>
                  <Text style={{ color: form.medication_pickup_arrangement === opt ? 'white' : '#374151', fontSize: 13 }}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 外展藥物來源 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>外展藥物來源</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {MEDICATION_SOURCE_OPTIONS.map(opt => (
                <TouchableOpacity key={opt} onPress={() => setForm(f => ({ ...f, outreach_medication_source: f.outreach_medication_source === opt ? '' : opt }))}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, backgroundColor: form.outreach_medication_source === opt ? '#3b82f6' : 'white', borderColor: form.outreach_medication_source === opt ? '#3b82f6' : '#e5e7eb' }}>
                  <Text style={{ color: form.outreach_medication_source === opt ? 'white' : '#374151', fontSize: 13 }}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 備註 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>備註</Text>
            <TextInput style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 40, minHeight: 80 }} value={form.remarks} onChangeText={v => setForm(f => ({ ...f, remarks: v }))} placeholder="備註（可選）" placeholderTextColor="#9ca3af" multiline numberOfLines={3} textAlignVertical="top" />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
