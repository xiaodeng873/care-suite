import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';
import { ResidentGroupedList } from '@/components/ResidentGroupedList';
import {
  useHealthAssessments, useCreateHealthAssessment, useUpdateHealthAssessment, useDeleteHealthAssessment,
  type HealthAssessment,
} from '@/features/assessments/useAssessments';

const ABILITY_OPTS = ['良好', '一般', '欠佳', '不適用'];
const HABIT_OPTS = ['無', '輕度', '中度', '嚴重'];

type FormState = {
  patient_id: number | null;
  assessment_date: string;
  assessor: string;
  next_due_date: string;
  smoking_habit: string;
  drinking_habit: string;
  communication_ability: string;
  consciousness_cognition: string;
  emotional_expression: string;
  remarks: string;
};

const EMPTY: FormState = {
  patient_id: null,
  assessment_date: new Date().toISOString().split('T')[0],
  assessor: '',
  next_due_date: '',
  smoking_habit: '無',
  drinking_habit: '無',
  communication_ability: '良好',
  consciousness_cognition: '良好',
  emotional_expression: '良好',
  remarks: '',
};

function ChipRow({ label, options, value, onSelect }: { label: string; options: string[]; value: string; onSelect: (v: string) => void }) {
  return (
    <>
      <Text className="text-sm font-medium text-gray-700 mb-1">{label}</Text>
      <View className="flex-row flex-wrap gap-2 mb-4">
        {options.map(o => (
          <TouchableOpacity key={o} onPress={() => onSelect(o)}
            className="px-3 py-2 rounded-xl border"
            style={{ backgroundColor: value === o ? '#3b82f6' : 'white', borderColor: value === o ? '#3b82f6' : '#e5e7eb' }}>
            <Text style={{ color: value === o ? 'white' : '#374151', fontSize: 13 }}>{o}</Text>
          </TouchableOpacity>
        ))}
      </View>
    </>
  );
}

export default function AssessmentsScreen() {
  const { data: assessments = [], isLoading, refetch } = useHealthAssessments();
  const createAssessment = useCreateHealthAssessment();
  const updateAssessment = useUpdateHealthAssessment();
  const deleteAssessment = useDeleteHealthAssessment();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<HealthAssessment | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY);

  function openCreate() { setEditing(null); setForm(EMPTY); setShowModal(true); }
  function openEdit(a: HealthAssessment) {
    setEditing(a);
    setForm({
      patient_id: a.patient_id,
      assessment_date: a.assessment_date ?? '',
      assessor: a.assessor ?? '',
      next_due_date: a.next_due_date ?? '',
      smoking_habit: a.smoking_habit ?? '無',
      drinking_habit: a.drinking_habit ?? '無',
      communication_ability: a.communication_ability ?? '良好',
      consciousness_cognition: a.consciousness_cognition ?? '良好',
      emotional_expression: a.emotional_expression ?? '良好',
      remarks: a.remarks ?? '',
    });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.patient_id) { Alert.alert('提示', '請選擇院友'); return; }
    const payload = {
      patient_id: form.patient_id,
      assessment_date: form.assessment_date || new Date().toISOString().slice(0, 10),
      assessor: form.assessor || undefined,
      next_due_date: form.next_due_date || undefined,
      smoking_habit: form.smoking_habit,
      drinking_habit: form.drinking_habit,
      communication_ability: form.communication_ability,
      consciousness_cognition: form.consciousness_cognition,
      emotional_expression: form.emotional_expression,
      remarks: form.remarks || undefined,
      status: 'active' as const,
    };
    if (editing) { await updateAssessment.mutateAsync({ ...editing, ...payload }); }
    else { await createAssessment.mutateAsync(payload); }
    setShowModal(false);
  }

  function handleDelete(id: string) {
    Alert.alert('確認刪除', '確定刪除此評估記錄？', [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => deleteAssessment.mutate(id) },
    ]);
  }

  const isSaving = createAssessment.isPending || updateAssessment.isPending;

  return (
    <View className="flex-1 bg-gray-50">
      <ResidentGroupedList
        records={assessments}
        isLoading={isLoading}
        onRefresh={refetch}
        getPatientId={(a) => a.patient_id}
        getDate={(a) => a.assessment_date}
        getRecordSearchText={(a) => a.assessor ?? ''}
        emptyText="暫無健康評估記錄"
        renderCard={(item) => {
          const overdue = item.next_due_date && new Date(item.next_due_date) < new Date();
          return (
            <TouchableOpacity
              className="bg-white rounded-xl mb-2 px-4 py-3 shadow-sm"
              style={{ shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
              onPress={() => openEdit(item)} activeOpacity={0.7}
            >
              <View className="flex-row items-start justify-between">
                <View className="flex-1">
                  <View className="flex-row flex-wrap gap-2">
                    {item.assessment_date && <Text className="text-xs text-gray-500">評估：{item.assessment_date}</Text>}
                    {item.assessor && <Text className="text-xs text-gray-500">評估員：{item.assessor}</Text>}
                  </View>
                  {item.next_due_date && (
                    <View className={`mt-1 px-2 py-0.5 self-start rounded-full ${overdue ? 'bg-red-100' : 'bg-blue-50'}`}>
                      <Text className={`text-xs font-medium ${overdue ? 'text-red-700' : 'text-blue-700'}`}>
                        {overdue ? '逾期 ' : '下次：'}{item.next_due_date}
                      </Text>
                    </View>
                  )}
                  <View className="flex-row gap-2 mt-1 flex-wrap">
                    {item.communication_ability && (
                      <Text className="text-xs text-gray-400">溝通：{item.communication_ability}</Text>
                    )}
                    {item.consciousness_cognition && (
                      <Text className="text-xs text-gray-400">認知：{item.consciousness_cognition}</Text>
                    )}
                  </View>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id)} className="p-1">
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity className="absolute bottom-8 right-6 w-14 h-14 bg-blue-500 rounded-full items-center justify-center shadow-lg" style={{ elevation: 6 }} onPress={openCreate}>
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowModal(false)}><Text className="text-base text-gray-500">取消</Text></TouchableOpacity>
            <Text className="text-base font-semibold">{editing ? '編輯健康評估' : '新增健康評估'}</Text>
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

            <Text className="text-sm font-medium text-gray-700 mb-1">評估日期</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4" value={form.assessment_date} onChangeText={v => setForm(f => ({ ...f, assessment_date: v }))} placeholder="YYYY-MM-DD" />

            <Text className="text-sm font-medium text-gray-700 mb-1">評估員</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4" value={form.assessor} onChangeText={v => setForm(f => ({ ...f, assessor: v }))} placeholder="評估員姓名（可選）" />

            <Text className="text-sm font-medium text-gray-700 mb-1">下次評估日期</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-4" value={form.next_due_date} onChangeText={v => setForm(f => ({ ...f, next_due_date: v }))} placeholder="YYYY-MM-DD（可選）" />

            <ChipRow label="吸煙習慣" options={HABIT_OPTS} value={form.smoking_habit} onSelect={v => setForm(f => ({ ...f, smoking_habit: v }))} />
            <ChipRow label="飲酒習慣" options={HABIT_OPTS} value={form.drinking_habit} onSelect={v => setForm(f => ({ ...f, drinking_habit: v }))} />
            <ChipRow label="溝通能力" options={ABILITY_OPTS} value={form.communication_ability} onSelect={v => setForm(f => ({ ...f, communication_ability: v }))} />
            <ChipRow label="意識/認知" options={ABILITY_OPTS} value={form.consciousness_cognition} onSelect={v => setForm(f => ({ ...f, consciousness_cognition: v }))} />
            <ChipRow label="情緒表達" options={ABILITY_OPTS} value={form.emotional_expression} onSelect={v => setForm(f => ({ ...f, emotional_expression: v }))} />

            <Text className="text-sm font-medium text-gray-700 mb-1">備註</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base text-gray-800 mb-8" value={form.remarks} onChangeText={v => setForm(f => ({ ...f, remarks: v }))} placeholder="備註（可選）" multiline numberOfLines={3} textAlignVertical="top" style={{ minHeight: 80 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
