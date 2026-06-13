import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';
import { ResidentGroupedList } from '@/components/ResidentGroupedList';
import {
  useAnnualCheckups, useCreateAnnualCheckup, useUpdateAnnualCheckup, useDeleteAnnualCheckup,
  calcNextDueDate,
  VISION_OPTIONS, HEARING_OPTIONS, SPEECH_OPTIONS, MENTAL_STATE_GROUP_A, MENTAL_STATE_GROUP_B,
  MOBILITY_OPTIONS, CONTINENCE_OPTIONS, ADL_OPTIONS, RECOMMENDATION_OPTIONS,
  MEDICAL_HISTORY_FIELDS, PHYSICAL_EXAM_FIELDS,
  type AnnualCheckup,
} from '@/features/annual-checkup/useAnnualCheckup';

// ─── 小元件 ──────────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 }}>{children}</Text>;
}

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12, marginTop: 14 }}>{children}</Text>;
}

function Input({ value, onChangeText, placeholder, keyboardType, multiline }: any) {
  return (
    <TextInput
      style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1f2937', marginBottom: 14, minHeight: multiline ? 60 : undefined }}
      value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9ca3af"
      keyboardType={keyboardType} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'}
    />
  );
}

/** 單選 chips（可取消） */
function RadioChips({ options, value, onChange }: { options: readonly string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <TouchableOpacity key={opt} onPress={() => onChange(active ? '' : opt)}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, backgroundColor: active ? '#3b82f6' : 'white', borderColor: active ? '#3b82f6' : '#e5e7eb' }}>
            <Text style={{ color: active ? 'white' : '#374151', fontSize: 13 }}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

type FormState = Omit<AnnualCheckup, 'id' | 'created_at' | 'updated_at' | 'patient_id'> & { patient_id: number | null; mental_state: string; dementia_stage: string };

function emptyForm(): FormState {
  return {
    patient_id: null,
    last_doctor_signature_date: '',
    next_due_date: '',
    has_serious_illness: false, serious_illness_details: '',
    has_allergy: false, allergy_details: '',
    has_infectious_disease: false, infectious_disease_details: '',
    needs_followup_treatment: false, followup_treatment_details: '',
    has_swallowing_difficulty: false, swallowing_difficulty_details: '',
    has_special_diet: false, special_diet_details: '',
    mental_illness_record: '',
    blood_pressure_systolic: undefined, blood_pressure_diastolic: undefined, pulse: undefined, body_weight: undefined,
    cardiovascular_notes: '', respiratory_notes: '', central_nervous_notes: '', musculo_skeletal_notes: '',
    abdomen_urogenital_notes: '', lymphatic_notes: '', thyroid_notes: '', skin_condition_notes: '',
    foot_notes: '', eye_ear_nose_throat_notes: '', oral_dental_notes: '', physical_exam_others: '',
    vision_assessment: '', with_visual_corrective_devices: null,
    hearing_assessment: '', with_hearing_aids: null,
    speech_assessment: '', mental_state_assessment: '',
    mobility_assessment: '', continence_assessment: '', adl_assessment: '',
    recommendation: '',
    mental_state: '', dementia_stage: '',
  };
}

function parseMentalState(combined?: string): { mental_state: string; dementia_stage: string } {
  if (!combined) return { mental_state: '', dementia_stage: '' };
  const parts = combined.split(' | ');
  const ms = parts.find(p => (MENTAL_STATE_GROUP_A as readonly string[]).includes(p)) ?? '';
  const ds = parts.find(p => (MENTAL_STATE_GROUP_B as readonly string[]).includes(p)) ?? '';
  return { mental_state: ms, dementia_stage: ds };
}

export default function AnnualCheckupScreen() {
  const { data: checkups = [], isLoading, refetch } = useAnnualCheckups();
  const createMut = useCreateAnnualCheckup();
  const updateMut = useUpdateAnnualCheckup();
  const deleteMut = useDeleteAnnualCheckup();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<AnnualCheckup | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function openCreate() { setEditing(null); setForm(emptyForm()); setShowModal(true); }
  function openEdit(c: AnnualCheckup) {
    setEditing(c);
    const ms = parseMentalState(c.mental_state_assessment);
    setForm({ ...emptyForm(), ...c, patient_id: c.patient_id, mental_state: ms.mental_state, dementia_stage: ms.dementia_stage });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.patient_id) { Alert.alert('提示', '請選擇院友'); return; }
    const mentalCombined = [form.mental_state, form.dementia_stage].filter(Boolean).join(' | ');
    const { mental_state, dementia_stage, ...rest } = form;
    const payload: any = { ...rest, patient_id: form.patient_id, mental_state_assessment: mentalCombined || undefined };
    ['last_doctor_signature_date', 'next_due_date'].forEach(k => { if (payload[k] === '') payload[k] = null; });
    try {
      if (editing) { await updateMut.mutateAsync({ ...editing, ...payload }); }
      else { await createMut.mutateAsync(payload); }
      setShowModal(false);
    } catch (e: any) { Alert.alert('儲存失敗', e?.message ?? '請重試'); }
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <ResidentGroupedList
        records={checkups}
        isLoading={isLoading}
        onRefresh={refetch}
        getPatientId={(c) => c.patient_id}
        getDate={(c) => c.last_doctor_signature_date || c.next_due_date}
        getRecordSearchText={(c) => c.recommendation ?? ''}
        emptyText="暫無年度體檢記錄"
        renderCard={(item) => {
          const overdue = item.next_due_date && new Date(item.next_due_date) < new Date();
          const signed = !!item.last_doctor_signature_date;
          return (
            <TouchableOpacity
              style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
              onPress={() => openEdit(item)} activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  {item.last_doctor_signature_date && <Text style={{ fontSize: 12, color: '#6b7280' }}>上次醫生簽署：{item.last_doctor_signature_date}</Text>}
                  <View style={{ marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, alignSelf: 'flex-start', backgroundColor: !signed ? '#f3f4f6' : overdue ? '#fee2e2' : '#dcfce7' }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: !signed ? '#6b7280' : overdue ? '#b91c1c' : '#15803d' }}>
                      {!signed ? '未簽署' : overdue ? `已逾期 ${item.next_due_date}` : `下次到期：${item.next_due_date}`}
                    </Text>
                  </View>
                  {item.recommendation && <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 4 }}>建議：{item.recommendation}</Text>}
                </View>
                <TouchableOpacity onPress={() => Alert.alert('確認刪除', '確定刪除此年度體檢記錄？', [{ text: '取消', style: 'cancel' }, { text: '刪除', style: 'destructive', onPress: () => deleteMut.mutate(item.id) }])} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity style={{ position: 'absolute', bottom: 32, right: 24, width: 56, height: 56, backgroundColor: '#3b82f6', borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 }} onPress={openCreate}>
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* ── 完整年度體檢模態框（完全對應 web AnnualHealthCheckupModal） ── */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            <TouchableOpacity onPress={() => setShowModal(false)}><Text style={{ fontSize: 16, color: '#6b7280' }}>取消</Text></TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>{editing ? '編輯年度體檢' : '新增年度體檢'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              {isSaving ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text style={{ fontSize: 16, fontWeight: '600', color: '#3b82f6' }}>儲存</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            {/* 院友 + 日期 */}
            <FieldLabel>院友 *</FieldLabel>
            <View style={{ marginBottom: 14 }}>
              <PatientAutocomplete
                value={form.patient_id}
                onChange={(id) => set('patient_id', id)}
                showResidencyFilter
                defaultResidencyStatus="在住"
              />
            </View>
            <FieldLabel>上次醫生簽署日期</FieldLabel>
            <Input value={form.last_doctor_signature_date} onChangeText={(v: string) => {
              setForm(f => ({ ...f, last_doctor_signature_date: v, next_due_date: v && /^\d{4}-\d{2}-\d{2}$/.test(v) ? calcNextDueDate(v) : f.next_due_date }));
            }} placeholder="YYYY-MM-DD" />
            <FieldLabel>下次到期日</FieldLabel>
            <Input value={form.next_due_date} onChangeText={(v: string) => set('next_due_date', v)} placeholder="YYYY-MM-DD（簽署日期後自動計算）" />

            {/* Part I: 病歷資訊 */}
            <SectionTitle>第一部分：病歷資訊</SectionTitle>
            {MEDICAL_HISTORY_FIELDS.map(({ boolKey, detailKey, label }) => (
              <View key={boolKey as string} style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, borderWidth: 1, borderColor: '#e5e7eb' }}>
                  <Text style={{ fontSize: 14, color: '#374151' }}>{label}</Text>
                  <Switch value={!!form[boolKey as keyof FormState]} onValueChange={(v) => set(boolKey as keyof FormState, v as any)} trackColor={{ false: '#e5e7eb', true: '#3b82f6' }} />
                </View>
                {form[boolKey as keyof FormState] && (
                  <TextInput style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1f2937', marginTop: 8 }}
                    value={(form[detailKey as keyof FormState] as string) ?? ''} onChangeText={(v) => set(detailKey as keyof FormState, v as any)} placeholder={`${label}詳情`} placeholderTextColor="#9ca3af" />
                )}
              </View>
            ))}
            <FieldLabel>精神病記錄</FieldLabel>
            <Input value={form.mental_illness_record} onChangeText={(v: string) => set('mental_illness_record', v)} placeholder="精神病記錄（可選）" multiline />

            {/* Part II: 身體檢查 */}
            <SectionTitle>第二部分：身體檢查</SectionTitle>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {[
                { k: 'blood_pressure_systolic', label: '血壓（收縮壓）', ph: 'mmHg' },
                { k: 'blood_pressure_diastolic', label: '血壓（舒張壓）', ph: 'mmHg' },
                { k: 'pulse', label: '脈搏', ph: '/min' },
                { k: 'body_weight', label: '體重', ph: 'kg' },
              ].map(vs => (
                <View key={vs.k} style={{ width: '47%' }}>
                  <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{vs.label}</Text>
                  <TextInput style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#1f2937' }}
                    value={(form as any)[vs.k] != null ? String((form as any)[vs.k]) : ''} onChangeText={(v) => set(vs.k as any, (v ? Number(v) : undefined) as any)}
                    placeholder={vs.ph} placeholderTextColor="#9ca3af" keyboardType="decimal-pad" />
                </View>
              ))}
            </View>

            {/* Part III: 各系統檢查 */}
            <SectionTitle>第三部分：各系統檢查</SectionTitle>
            {PHYSICAL_EXAM_FIELDS.map(({ key, label }) => (
              <View key={key as string}>
                <FieldLabel>{label}</FieldLabel>
                <Input value={(form[key as keyof FormState] as string) ?? ''} onChangeText={(v: string) => set(key as keyof FormState, v as any)} placeholder={`輸入${label}備註`} />
              </View>
            ))}

            {/* Part IV: 身體機能評估 */}
            <SectionTitle>第四部分：身體機能評估</SectionTitle>
            <FieldLabel>視力</FieldLabel>
            <RadioChips options={VISION_OPTIONS} value={form.vision_assessment ?? ''} onChange={(v) => set('vision_assessment', v)} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, borderWidth: 1, borderColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 14, color: '#374151' }}>配戴視力矯正器</Text>
              <Switch value={form.with_visual_corrective_devices === true} onValueChange={(v) => set('with_visual_corrective_devices', v ? true : null)} trackColor={{ false: '#e5e7eb', true: '#3b82f6' }} />
            </View>

            <FieldLabel>聽力</FieldLabel>
            <RadioChips options={HEARING_OPTIONS} value={form.hearing_assessment ?? ''} onChange={(v) => set('hearing_assessment', v)} />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, borderWidth: 1, borderColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 14, color: '#374151' }}>配戴助聽器</Text>
              <Switch value={form.with_hearing_aids === true} onValueChange={(v) => set('with_hearing_aids', v ? true : null)} trackColor={{ false: '#e5e7eb', true: '#3b82f6' }} />
            </View>

            <FieldLabel>語言能力</FieldLabel>
            <RadioChips options={SPEECH_OPTIONS} value={form.speech_assessment ?? ''} onChange={(v) => set('speech_assessment', v)} />

            <FieldLabel>精神狀態（單選）</FieldLabel>
            <RadioChips options={MENTAL_STATE_GROUP_A} value={form.mental_state} onChange={(v) => set('mental_state', v)} />
            <FieldLabel>認知障礙症階段（可選）</FieldLabel>
            <RadioChips options={MENTAL_STATE_GROUP_B} value={form.dementia_stage} onChange={(v) => set('dementia_stage', v)} />

            <FieldLabel>活動能力</FieldLabel>
            <RadioChips options={MOBILITY_OPTIONS} value={form.mobility_assessment ?? ''} onChange={(v) => set('mobility_assessment', v)} />

            <FieldLabel>禁制能力</FieldLabel>
            <RadioChips options={CONTINENCE_OPTIONS} value={form.continence_assessment ?? ''} onChange={(v) => set('continence_assessment', v)} />

            <FieldLabel>自我照顧能力</FieldLabel>
            <View style={{ gap: 8, marginBottom: 14 }}>
              {ADL_OPTIONS.map(opt => {
                const active = form.adl_assessment === opt.value;
                return (
                  <TouchableOpacity key={opt.value} onPress={() => set('adl_assessment', active ? '' : opt.value)}
                    style={{ padding: 12, borderRadius: 10, borderWidth: 1, backgroundColor: active ? '#eff6ff' : 'white', borderColor: active ? '#3b82f6' : '#e5e7eb' }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: active ? '#1d4ed8' : '#374151' }}>{opt.value}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{opt.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Part V: 建議 */}
            <SectionTitle>第五部分：建議</SectionTitle>
            <Text style={{ fontSize: 13, color: '#6b7280', marginBottom: 8 }}>申請人適合入住以下類別的安老院：</Text>
            <View style={{ gap: 8, marginBottom: 20 }}>
              {RECOMMENDATION_OPTIONS.map(opt => {
                const active = form.recommendation === opt.value;
                return (
                  <TouchableOpacity key={opt.value} onPress={() => set('recommendation', active ? '' : opt.value)}
                    style={{ padding: 12, borderRadius: 10, borderWidth: 1, backgroundColor: active ? '#eff6ff' : 'white', borderColor: active ? '#3b82f6' : '#e5e7eb' }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: active ? '#1d4ed8' : '#374151' }}>{opt.value}</Text>
                    <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{opt.description}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
