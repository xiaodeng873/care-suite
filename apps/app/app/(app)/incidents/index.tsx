import { useState } from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  Modal, ScrollView, TextInput, Alert,
  KeyboardAvoidingView, Platform, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import {
  useIncidents, useCreateIncident, useUpdateIncident, useDeleteIncident,
} from '@/features/incidents/useIncidents';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';
import { ResidentGroupedList } from '@/components/ResidentGroupedList';
import type { IncidentReport } from '@/features/incidents/types';
import {
  TYPE_COLOR,
  COMMON_INCIDENT_TYPES, LOCATION_OPTIONS, ACTIVITY_OPTIONS, DISCOMFORT_OPTIONS,
  UNSAFE_BEHAVIOR_OPTIONS, ENVIRONMENTAL_OPTIONS, CONSCIOUSNESS_OPTIONS, INJURY_OPTIONS,
  TREATMENT_OPTIONS, MEDICAL_ARRANGEMENT_OPTIONS, RELATIONSHIP_OPTIONS,
  HOSPITAL_TREATMENT_OPTIONS, ABNORMAL_LIMB_OPTIONS,
} from '@/features/incidents/types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function getHKDate() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const DAYS_OPTIONS = [
  { label: '近1月', days: 30 },
  { label: '近3月', days: 90 },
  { label: '近半年', days: 180 },
];

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${iso} (${weekDays[d.getDay()]})`;
}

function TypeBadge({ type }: { type: string }) {
  const { bg, text } = TYPE_COLOR[type] ?? TYPE_COLOR['其他'];
  return (
    <View className={`px-2 py-0.5 rounded-full ${bg}`}>
      <Text className={`text-xs font-semibold ${text}`}>{type}</Text>
    </View>
  );
}

// ─── 模態框小元件 ──────────────────────────────────────────────────────────────

function SectionHeader({ icon, title, color }: { icon: keyof typeof Ionicons.glyphMap; title: string; color: string }) {
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 12, marginTop: 12 }}>
      <Ionicons name={icon} size={18} color={color} style={{ marginRight: 8 }} />
      <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827' }}>{title}</Text>
    </View>
  );
}

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 }}>{children}</Text>;
}

function Input({ value, onChangeText, placeholder, keyboardType, multiline }: any) {
  return (
    <TextInput
      style={{
        backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10,
        paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1f2937', marginBottom: 14,
        minHeight: multiline ? 70 : undefined,
      }}
      value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9ca3af"
      keyboardType={keyboardType} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'}
    />
  );
}

/** 單選 chips */
function RadioChips({ options, value, onChange }: { options: readonly string[]; value: string; onChange: (v: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
      {options.map(opt => {
        const active = value === opt;
        return (
          <TouchableOpacity key={opt} onPress={() => onChange(opt)}
            style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, backgroundColor: active ? '#3b82f6' : 'white', borderColor: active ? '#3b82f6' : '#e5e7eb' }}>
            <Text style={{ color: active ? 'white' : '#374151', fontSize: 13 }}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

/** 複選 chips（含「不適用」互斥） */
function CheckChips({ options, selected, onToggle }: { options: readonly string[]; selected: Record<string, any>; onToggle: (opt: string) => void }) {
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
      {options.map(opt => {
        const active = !!selected[opt];
        return (
          <TouchableOpacity key={opt} onPress={() => onToggle(opt)}
            style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, backgroundColor: active ? '#3b82f6' : 'white', borderColor: active ? '#3b82f6' : '#e5e7eb' }}>
            {active && <Ionicons name="checkmark" size={13} color="white" style={{ marginRight: 4 }} />}
            <Text style={{ color: active ? 'white' : '#374151', fontSize: 13 }}>{opt}</Text>
          </TouchableOpacity>
        );
      })}
    </View>
  );
}

// ─── 表單初始值 ─────────────────────────────────────────────────────────────

type FormState = Omit<IncidentReport, 'id' | 'created_at' | 'updated_at' | 'patient_id'> & { patient_id: number | null };

function emptyForm(): FormState {
  return {
    patient_id: null,
    incident_date: getHKDate(),
    incident_time: '',
    incident_type: '跌倒',
    other_incident_type: '',
    location: '',
    other_location: '',
    patient_activity: '',
    other_patient_activity: '',
    physical_discomfort: {},
    unsafe_behavior: {},
    environmental_factors: {},
    incident_details: '',
    treatment_date: '',
    treatment_time: '',
    vital_signs: {},
    consciousness_level: '',
    limb_movement: { status: '', details: '', abnormal_limbs: [] },
    injury_situation: {},
    patient_complaint: '',
    immediate_treatment: {},
    medical_arrangement: '',
    ambulance_call_time: '',
    ambulance_arrival_time: '',
    ambulance_departure_time: '',
    hospital_destination: '',
    family_notification_date: '',
    family_notification_time: '',
    family_name: '',
    family_relationship: '',
    other_family_relationship: '',
    contact_phone: '',
    notifying_staff_name: '',
    notifying_staff_position: '',
    hospital_treatment: {},
    hospital_admission: {},
    return_time: '',
    submit_to_social_welfare: undefined,
    submit_to_headquarters: undefined,
    immediate_improvement_actions: '',
    prevention_methods: '',
    reporter_signature: '',
    reporter_position: '',
    report_date: getHKDate(),
    director_review_date: '',
    submit_to_headquarters_flag: false,
    submit_to_social_welfare_flag: false,
  };
}

// ─── 主畫面 ─────────────────────────────────────────────────────────────────

export default function IncidentsScreen() {
  const qc = useQueryClient();
  const [days, setDays] = useState(30);
  const { data: incidents = [], isLoading, refetch } = useIncidents(days);
  const createMut = useCreateIncident();
  const updateMut = useUpdateIncident();
  const deleteMut = useDeleteIncident();

  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<IncidentReport | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());

  function openCreate() { setEditing(null); setForm(emptyForm()); setShowModal(true); }
  function openEdit(rec: IncidentReport) {
    setEditing(rec);
    setForm({
      ...emptyForm(),
      ...rec,
      patient_id: rec.patient_id,
      physical_discomfort: rec.physical_discomfort ?? {},
      unsafe_behavior: rec.unsafe_behavior ?? {},
      environmental_factors: rec.environmental_factors ?? {},
      vital_signs: rec.vital_signs ?? {},
      limb_movement: rec.limb_movement ?? { status: '', details: '', abnormal_limbs: [] },
      injury_situation: rec.injury_situation ?? {},
      immediate_treatment: rec.immediate_treatment ?? {},
      hospital_treatment: rec.hospital_treatment ?? {},
      hospital_admission: rec.hospital_admission ?? {},
    });
    setShowModal(true);
  }

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function setVital(key: string, value: string) {
    setForm(f => ({ ...f, vital_signs: { ...f.vital_signs, [key]: value } }));
  }

  // 複選切換，含「不適用」互斥邏輯
  function toggleCheck(category: keyof FormState, opt: string) {
    setForm(f => {
      const current = { ...(f[category] as Record<string, any>) };
      if (opt === '不適用' && !current['不適用']) {
        Object.keys(current).forEach(k => { if (k !== '不適用') current[k] = false; });
        current['不適用'] = true;
      } else if (opt !== '不適用' && !current[opt]) {
        current['不適用'] = false;
        current[opt] = true;
      } else {
        current[opt] = !current[opt];
      }
      return { ...f, [category]: current };
    });
  }

  // 醫院診治複選，含「不需要留醫」與「醫院留醫」互斥
  function toggleHospitalTreatment(opt: string) {
    setForm(f => {
      const ht = { ...(f.hospital_treatment ?? {}) };
      if (opt === '不需要留醫' && !ht['不需要留醫']) { ht['醫院留醫'] = false; ht['觀察病房'] = false; }
      if (opt === '醫院留醫' && !ht['醫院留醫']) { ht['不需要留醫'] = false; }
      if (opt === '醫院留醫' && ht['醫院留醫']) { ht['觀察病房'] = false; }
      ht[opt] = !ht[opt];
      return { ...f, hospital_treatment: ht };
    });
  }

  function toggleLimb(limb: string) {
    setForm(f => {
      const limbs = f.limb_movement?.abnormal_limbs ?? [];
      const next = limbs.includes(limb) ? limbs.filter(l => l !== limb) : [...limbs, limb];
      return { ...f, limb_movement: { ...f.limb_movement, abnormal_limbs: next } };
    });
  }

  async function handleSave() {
    if (!form.patient_id) { Alert.alert('提示', '請選擇院友'); return; }
    if (!form.incident_date) { Alert.alert('提示', '請輸入意外發生日期'); return; }
    if (!form.reporter_signature) { Alert.alert('提示', '請輸入填報人姓名'); return; }
    if (!form.reporter_position) { Alert.alert('提示', '請輸入填報人職位'); return; }
    try {
      const payload: any = { ...form, patient_id: form.patient_id };
      ['incident_time','treatment_date','treatment_time','ambulance_call_time','ambulance_arrival_time','ambulance_departure_time','family_notification_date','family_notification_time','return_time','director_review_date'].forEach(k => {
        if (payload[k] === '') payload[k] = null;
      });
      if (editing) { await updateMut.mutateAsync({ ...editing, ...payload }); }
      else { await createMut.mutateAsync(payload); }
      setShowModal(false);
    } catch (e: any) { Alert.alert('儲存失敗', e?.message ?? '請重試'); }
  }

  function handleDelete(rec: IncidentReport) {
    Alert.alert('確認刪除', '確定刪除此意外事件報告？', [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => deleteMut.mutate(rec.id) },
    ]);
  }

  const isSaving = createMut.isPending || updateMut.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* 日期範圍 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={{ flexDirection: 'row', gap: 8 }}>
          {DAYS_OPTIONS.map(opt => (
            <TouchableOpacity key={opt.days} onPress={() => setDays(opt.days)}
              style={{ paddingHorizontal: 14, paddingVertical: 6, borderRadius: 9999, backgroundColor: days === opt.days ? '#3b82f6' : 'white', borderWidth: 1, borderColor: days === opt.days ? '#3b82f6' : '#e5e7eb' }}>
              <Text style={{ color: days === opt.days ? 'white' : '#6b7280', fontSize: 13, fontWeight: '600' }}>{opt.label}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ResidentGroupedList
        records={incidents}
        isLoading={isLoading}
        onRefresh={refetch}
        getPatientId={(r) => r.patient_id}
        getDate={(r) => r.incident_date}
        getRecordSearchText={(r) => `${r.location ?? ''} ${r.incident_type ?? ''} ${r.reporter_signature ?? ''}`}
        emptyText="暫無意外事件報告"
        renderCard={(item) => (
          <TouchableOpacity
            style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
            onPress={() => openEdit(item)} activeOpacity={0.7}
          >
            <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
              <View style={{ flex: 1 }}>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                  <TypeBadge type={item.incident_type} />
                  <Text style={{ fontSize: 12, color: '#6b7280' }}>{formatDate(item.incident_date)}{item.incident_time ? ` ${item.incident_time}` : ''}</Text>
                </View>
                {item.location && <Text style={{ fontSize: 12, color: '#9ca3af' }}>地點：{item.location === '其他地方' ? item.other_location : item.location}</Text>}
                {item.medical_arrangement && <Text style={{ fontSize: 12, color: '#9ca3af' }}>就診安排：{item.medical_arrangement}</Text>}
                {item.reporter_signature && <Text style={{ fontSize: 12, color: '#9ca3af' }}>填報人：{item.reporter_signature}</Text>}
              </View>
              <TouchableOpacity onPress={() => handleDelete(item)} style={{ padding: 4 }}>
                <Ionicons name="trash-outline" size={18} color="#ef4444" />
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        )}
      />

      <TouchableOpacity
        style={{ position: 'absolute', bottom: 32, right: 24, width: 56, height: 56, backgroundColor: '#3b82f6', borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 }}
        onPress={openCreate}>
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* ── 完整 8 章節模態框（完全對應 web IncidentReportModal） ── */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <KeyboardAvoidingView style={{ flex: 1, backgroundColor: '#f9fafb' }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            <TouchableOpacity onPress={() => setShowModal(false)}><Text style={{ fontSize: 16, color: '#6b7280' }}>取消</Text></TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>{editing ? '編輯意外事件報告' : '新增意外事件報告'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              {isSaving ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text style={{ fontSize: 16, fontWeight: '600', color: '#3b82f6' }}>儲存</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            {/* ① 基本資訊 */}
            <SectionHeader icon="alert-circle-outline" title="基本資訊" color="#f97316" />
            <FieldLabel>院友 *</FieldLabel>
            <View style={{ marginBottom: 14 }}>
              <PatientAutocomplete
                value={form.patient_id}
                onChange={(id) => set('patient_id', id)}
                showResidencyFilter
                defaultResidencyStatus="在住"
              />
            </View>

            <FieldLabel>意外發生日期 *</FieldLabel>
            <Input value={form.incident_date} onChangeText={(v: string) => set('incident_date', v)} placeholder="YYYY-MM-DD" />
            <FieldLabel>意外發生時間</FieldLabel>
            <Input value={form.incident_time} onChangeText={(v: string) => set('incident_time', v)} placeholder="HH:MM（可選）" />

            <FieldLabel>事故性質</FieldLabel>
            <RadioChips options={COMMON_INCIDENT_TYPES} value={form.incident_type} onChange={(v) => set('incident_type', v)} />
            {form.incident_type === '其他' && (
              <Input value={form.other_incident_type} onChangeText={(v: string) => set('other_incident_type', v)} placeholder="請輸入其他事故性質..." />
            )}

            <FieldLabel>地點</FieldLabel>
            <RadioChips options={LOCATION_OPTIONS} value={form.location ?? ''} onChange={(v) => set('location', v)} />
            {form.location === '其他地方' && (
              <Input value={form.other_location} onChangeText={(v: string) => set('other_location', v)} placeholder="請輸入其他地點..." />
            )}

            {/* ② 意外發生經過 */}
            <SectionHeader icon="walk-outline" title="意外發生經過" color="#f97316" />
            <FieldLabel>院友活動</FieldLabel>
            <RadioChips options={ACTIVITY_OPTIONS} value={form.patient_activity ?? ''} onChange={(v) => set('patient_activity', v)} />
            {form.patient_activity === '其他' && (
              <Input value={form.other_patient_activity} onChangeText={(v: string) => set('other_patient_activity', v)} placeholder="請輸入其他活動..." />
            )}

            <FieldLabel>院友身體不適（複選）</FieldLabel>
            <CheckChips options={DISCOMFORT_OPTIONS} selected={form.physical_discomfort ?? {}} onToggle={(o) => toggleCheck('physical_discomfort', o)} />
            {form.physical_discomfort?.['其他'] && (
              <Input value={form.physical_discomfort?.['其他說明'] ?? ''} onChangeText={(v: string) => set('physical_discomfort', { ...form.physical_discomfort, 其他說明: v })} placeholder="請詳細說明..." />
            )}

            <FieldLabel>院友不安全的行為（複選）</FieldLabel>
            <CheckChips options={UNSAFE_BEHAVIOR_OPTIONS} selected={form.unsafe_behavior ?? {}} onToggle={(o) => toggleCheck('unsafe_behavior', o)} />
            {form.unsafe_behavior?.['不安全的動作'] && (
              <Input value={form.unsafe_behavior?.['不安全的動作說明'] ?? ''} onChangeText={(v: string) => set('unsafe_behavior', { ...form.unsafe_behavior, 不安全的動作說明: v })} placeholder="請詳細說明不安全的動作..." />
            )}
            {form.unsafe_behavior?.['其他'] && (
              <Input value={form.unsafe_behavior?.['其他說明'] ?? ''} onChangeText={(v: string) => set('unsafe_behavior', { ...form.unsafe_behavior, 其他說明: v })} placeholder="請詳細說明..." />
            )}

            <FieldLabel>環境/個人因素（複選）</FieldLabel>
            <CheckChips options={ENVIRONMENTAL_OPTIONS} selected={form.environmental_factors ?? {}} onToggle={(o) => toggleCheck('environmental_factors', o)} />
            {form.environmental_factors?.['其他'] && (
              <Input value={form.environmental_factors?.['其他說明'] ?? ''} onChangeText={(v: string) => set('environmental_factors', { ...form.environmental_factors, 其他說明: v })} placeholder="請詳細說明..." />
            )}

            {/* ③ 詳情 */}
            <SectionHeader icon="document-text-outline" title="詳情" color="#f97316" />
            <FieldLabel>詳細經過說明</FieldLabel>
            <Input value={form.incident_details} onChangeText={(v: string) => set('incident_details', v)} placeholder="請詳細描述意外發生的經過..." multiline />

            {/* ④ 意外發生後處理 */}
            <SectionHeader icon="medkit-outline" title="意外發生後處理" color="#22c55e" />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><FieldLabel>處理日期</FieldLabel><Input value={form.treatment_date} onChangeText={(v: string) => set('treatment_date', v)} placeholder="YYYY-MM-DD" /></View>
              <View style={{ flex: 1 }}><FieldLabel>處理時間</FieldLabel><Input value={form.treatment_time} onChangeText={(v: string) => set('treatment_time', v)} placeholder="HH:MM" /></View>
            </View>

            <FieldLabel>生命表徵檢查</FieldLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {[
                { k: 'blood_pressure_systolic', label: '血壓（收縮壓）', ph: 'mmHg' },
                { k: 'blood_pressure_diastolic', label: '血壓（舒張壓）', ph: 'mmHg' },
                { k: 'pulse', label: '脈搏', ph: '次/分' },
                { k: 'respiration', label: '呼吸', ph: '次/分' },
                { k: 'temperature', label: '體溫', ph: '°C' },
                { k: 'oxygen_saturation', label: '血含氧量', ph: '%' },
                { k: 'blood_sugar', label: '血糖', ph: 'mmol/L' },
              ].map(vs => (
                <View key={vs.k} style={{ width: '47%' }}>
                  <Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>{vs.label}</Text>
                  <TextInput
                    style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#1f2937' }}
                    value={form.vital_signs?.[vs.k] ?? ''} onChangeText={(v) => setVital(vs.k, v)}
                    placeholder={vs.ph} placeholderTextColor="#9ca3af" keyboardType="decimal-pad"
                  />
                </View>
              ))}
            </View>

            <FieldLabel>清醒程度</FieldLabel>
            <RadioChips options={CONSCIOUSNESS_OPTIONS} value={form.consciousness_level ?? ''} onChange={(v) => set('consciousness_level', v)} />

            <FieldLabel>四肢活動情況</FieldLabel>
            <RadioChips options={['正常', '不正常']} value={form.limb_movement?.status ?? ''} onChange={(v) => set('limb_movement', { ...form.limb_movement, status: v })} />
            {form.limb_movement?.status === '不正常' && (
              <View style={{ marginBottom: 14 }}>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
                  {ABNORMAL_LIMB_OPTIONS.map(limb => {
                    const active = form.limb_movement?.abnormal_limbs?.includes(limb);
                    return (
                      <TouchableOpacity key={limb} onPress={() => toggleLimb(limb)}
                        style={{ flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, backgroundColor: active ? '#3b82f6' : 'white', borderColor: active ? '#3b82f6' : '#e5e7eb' }}>
                        {active && <Ionicons name="checkmark" size={13} color="white" style={{ marginRight: 4 }} />}
                        <Text style={{ color: active ? 'white' : '#374151', fontSize: 13 }}>{limb}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                <Input value={form.limb_movement?.details ?? ''} onChangeText={(v: string) => set('limb_movement', { ...form.limb_movement, details: v })} placeholder="請詳細說明..." multiline />
              </View>
            )}

            <FieldLabel>受傷情況（複選）</FieldLabel>
            <CheckChips options={INJURY_OPTIONS} selected={form.injury_situation ?? {}} onToggle={(o) => toggleCheck('injury_situation', o)} />
            {['瘀腫', '骨折', '其他'].map(opt => (
              form.injury_situation?.[opt] ? (
                <Input key={opt} value={form.injury_situation?.[`${opt}位置`] ?? ''} onChangeText={(v: string) => set('injury_situation', { ...form.injury_situation, [`${opt}位置`]: v })} placeholder={opt === '其他' ? '請詳細說明...' : `請輸入${opt}位置...`} />
              ) : null
            ))}

            <FieldLabel>院友申訴</FieldLabel>
            <Input value={form.patient_complaint} onChangeText={(v: string) => set('patient_complaint', v)} placeholder="請輸入院友申訴..." multiline />

            <FieldLabel>即時處理（複選）</FieldLabel>
            <CheckChips options={TREATMENT_OPTIONS} selected={form.immediate_treatment ?? {}} onToggle={(o) => toggleCheck('immediate_treatment', o)} />
            {form.immediate_treatment?.['其他'] && (
              <Input value={form.immediate_treatment?.['其他說明'] ?? ''} onChangeText={(v: string) => set('immediate_treatment', { ...form.immediate_treatment, 其他說明: v })} placeholder="請詳細說明..." />
            )}

            <FieldLabel>就診安排</FieldLabel>
            <RadioChips options={MEDICAL_ARRANGEMENT_OPTIONS} value={form.medical_arrangement ?? ''} onChange={(v) => set('medical_arrangement', v)} />

            {form.medical_arrangement === '急症室' && (
              <View style={{ borderLeftWidth: 3, borderLeftColor: '#3b82f6', paddingLeft: 12, marginBottom: 14 }}>
                <Text style={{ fontSize: 13, fontWeight: '600', color: '#1d4ed8', marginBottom: 8 }}>救護車資訊</Text>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}><Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>召車時間</Text><Input value={form.ambulance_call_time} onChangeText={(v: string) => set('ambulance_call_time', v)} placeholder="HH:MM" /></View>
                  <View style={{ flex: 1 }}><Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>到達時間</Text><Input value={form.ambulance_arrival_time} onChangeText={(v: string) => set('ambulance_arrival_time', v)} placeholder="HH:MM" /></View>
                </View>
                <View style={{ flexDirection: 'row', gap: 12 }}>
                  <View style={{ flex: 1 }}><Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>離開時間</Text><Input value={form.ambulance_departure_time} onChangeText={(v: string) => set('ambulance_departure_time', v)} placeholder="HH:MM" /></View>
                  <View style={{ flex: 1 }}><Text style={{ fontSize: 11, color: '#6b7280', marginBottom: 4 }}>送往醫院</Text><Input value={form.hospital_destination} onChangeText={(v: string) => set('hospital_destination', v)} placeholder="醫院名稱..." /></View>
                </View>
              </View>
            )}

            {/* ⑤ 通知家屬 */}
            <SectionHeader icon="people-outline" title="通知家屬" color="#8b5cf6" />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><FieldLabel>通知日期</FieldLabel><Input value={form.family_notification_date} onChangeText={(v: string) => set('family_notification_date', v)} placeholder="YYYY-MM-DD" /></View>
              <View style={{ flex: 1 }}><FieldLabel>通知時間</FieldLabel><Input value={form.family_notification_time} onChangeText={(v: string) => set('family_notification_time', v)} placeholder="HH:MM" /></View>
            </View>
            <FieldLabel>家屬姓名</FieldLabel>
            <Input value={form.family_name} onChangeText={(v: string) => set('family_name', v)} placeholder="請輸入家屬姓名..." />
            <FieldLabel>聯絡電話</FieldLabel>
            <Input value={form.contact_phone} onChangeText={(v: string) => set('contact_phone', v)} placeholder="請輸入聯絡電話..." keyboardType="phone-pad" />
            <FieldLabel>家屬與院友關係</FieldLabel>
            <RadioChips options={RELATIONSHIP_OPTIONS} value={form.family_relationship ?? ''} onChange={(v) => set('family_relationship', v)} />
            {form.family_relationship === '其他' && (
              <Input value={form.other_family_relationship} onChangeText={(v: string) => set('other_family_relationship', v)} placeholder="請輸入關係..." />
            )}
            <FieldLabel>負責通知職員姓名</FieldLabel>
            <Input value={form.notifying_staff_name} onChangeText={(v: string) => set('notifying_staff_name', v)} placeholder="請輸入職員姓名..." />
            <FieldLabel>職位</FieldLabel>
            <Input value={form.notifying_staff_position} onChangeText={(v: string) => set('notifying_staff_position', v)} placeholder="請輸入職位..." />

            {/* ⑥ 院友在醫院診治情況 */}
            <SectionHeader icon="business-outline" title="院友在醫院診治情況" color="#0891b2" />
            <CheckChips options={HOSPITAL_TREATMENT_OPTIONS} selected={form.hospital_treatment ?? {}} onToggle={toggleHospitalTreatment} />
            {form.hospital_treatment?.['其他治療(例如藥物等)'] && (
              <Input value={form.hospital_treatment?.['其他治療說明'] ?? ''} onChangeText={(v: string) => set('hospital_treatment', { ...form.hospital_treatment, 其他治療說明: v })} placeholder="請詳細說明..." />
            )}
            {form.hospital_treatment?.['醫院留醫'] && (
              <View style={{ marginBottom: 14 }}>
                <TouchableOpacity onPress={() => toggleHospitalTreatment('觀察病房')}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 8 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: form.hospital_treatment?.['觀察病房'] ? '#3b82f6' : '#d1d5db', backgroundColor: form.hospital_treatment?.['觀察病房'] ? '#3b82f6' : 'white', alignItems: 'center', justifyContent: 'center' }}>
                    {form.hospital_treatment?.['觀察病房'] && <Ionicons name="checkmark" size={13} color="white" />}
                  </View>
                  <Text style={{ fontSize: 14, color: '#374151' }}>觀察病房</Text>
                </TouchableOpacity>
                {!form.hospital_treatment?.['觀察病房'] && (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                    {[['hospital','醫院'],['floor','樓層'],['ward','病房'],['bed_number','床號']].map(([k, ph]) => (
                      <View key={k} style={{ width: '47%' }}>
                        <TextInput style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#1f2937' }}
                          value={(form.hospital_admission as any)?.[k] ?? ''} onChangeText={(v) => set('hospital_admission', { ...form.hospital_admission, [k]: v })}
                          placeholder={ph} placeholderTextColor="#9ca3af" />
                      </View>
                    ))}
                  </View>
                )}
              </View>
            )}
            {form.hospital_treatment?.['返回護理院/家'] && !form.hospital_treatment?.['醫院留醫'] && (
              <View><FieldLabel>回院時間</FieldLabel><Input value={form.return_time} onChangeText={(v: string) => set('return_time', v)} placeholder="HH:MM" /></View>
            )}

            {/* ⑦ 事後跟進 */}
            <SectionHeader icon="clipboard-outline" title="事後跟進" color="#6366f1" />
            <FieldLabel>1. 呈交「特別事故報告」予社署安老院牌照事務處</FieldLabel>
            <RadioChips options={['需要', '不需要']} value={form.submit_to_social_welfare === true ? '需要' : form.submit_to_social_welfare === false ? '不需要' : ''} onChange={(v) => set('submit_to_social_welfare', v === '需要')} />
            <FieldLabel>2. 呈交「特別事故報告」(1)副本或「特別事故報告」(院舍存檔用)予總部</FieldLabel>
            <RadioChips options={['需要', '不需要']} value={form.submit_to_headquarters === true ? '需要' : form.submit_to_headquarters === false ? '不需要' : ''} onChange={(v) => set('submit_to_headquarters', v === '需要')} />
            <FieldLabel>3. 院方的即時改善行動</FieldLabel>
            <Input value={form.immediate_improvement_actions} onChangeText={(v: string) => set('immediate_improvement_actions', v)} placeholder="請輸入院方的即時改善行動..." multiline />
            <FieldLabel>4. 院方預防意外再次發生的方法</FieldLabel>
            <Input value={form.prevention_methods} onChangeText={(v: string) => set('prevention_methods', v)} placeholder="請輸入預防方法..." multiline />

            {/* ⑧ 簽署資訊 */}
            <SectionHeader icon="create-outline" title="簽署資訊" color="#374151" />
            <FieldLabel>填報人姓名 *</FieldLabel>
            <Input value={form.reporter_signature} onChangeText={(v: string) => set('reporter_signature', v)} placeholder="請輸入填報人姓名..." />
            <FieldLabel>職位 *</FieldLabel>
            <Input value={form.reporter_position} onChangeText={(v: string) => set('reporter_position', v)} placeholder="請輸入職位..." />
            <FieldLabel>填報日期</FieldLabel>
            <Input value={form.report_date} onChangeText={(v: string) => set('report_date', v)} placeholder="YYYY-MM-DD" />
            <FieldLabel>院長批閱日期</FieldLabel>
            <Input value={form.director_review_date} onChangeText={(v: string) => set('director_review_date', v)} placeholder="YYYY-MM-DD" />
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 10, borderWidth: 1, borderColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 14, color: '#374151' }}>呈交總部</Text>
              <Switch value={!!form.submit_to_headquarters_flag} onValueChange={(v) => set('submit_to_headquarters_flag', v)} trackColor={{ false: '#e5e7eb', true: '#3b82f6' }} />
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 20, borderWidth: 1, borderColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 14, color: '#374151' }}>呈交社署</Text>
              <Switch value={!!form.submit_to_social_welfare_flag} onValueChange={(v) => set('submit_to_social_welfare_flag', v)} trackColor={{ false: '#e5e7eb', true: '#3b82f6' }} />
            </View>
          </ScrollView>
        </KeyboardAvoidingView>
      </Modal>
    </View>
  );
}
