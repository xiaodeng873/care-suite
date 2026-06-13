import { useState, useMemo } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Alert, Switch,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';
import { ResidentGroupedList } from '@/components/ResidentGroupedList';
import {
  usePrescriptions, useCreatePrescription, useUpdatePrescription, useDeletePrescription,
  PRESCRIPTION_STATUS_LABELS, PRESCRIPTION_STATUS_COLORS,
  DOSAGE_FORM_OPTIONS, ADMIN_ROUTE_OPTIONS, DOSAGE_UNIT_OPTIONS, SPECIAL_DOSAGE_OPTIONS,
  MEAL_TIMING_OPTIONS, PREPARATION_METHOD_OPTIONS, DAILY_FREQUENCY_OPTIONS,
  FREQUENCY_TYPE_OPTIONS, WEEKDAY_NAMES,
  type MedicationPrescription, type PrescriptionStatusType,
} from '@/features/prescriptions/usePrescriptions';

const STATUSES: PrescriptionStatusType[] = ['active', 'pending_change', 'inactive'];

// ─── 小元件 ──────────────────────────────────────────────────────────────────

function FieldLabel({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 13, fontWeight: '500', color: '#374151', marginBottom: 6 }}>{children}</Text>;
}

function Input({ value, onChangeText, placeholder, keyboardType, multiline }: any) {
  return (
    <TextInput
      style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1f2937', marginBottom: 14, minHeight: multiline ? 70 : undefined }}
      value={value} onChangeText={onChangeText} placeholder={placeholder} placeholderTextColor="#9ca3af"
      keyboardType={keyboardType} multiline={multiline} textAlignVertical={multiline ? 'top' : 'center'}
    />
  );
}

function Chips({ options, value, onChange }: { options: readonly string[]; value: string; onChange: (v: string) => void }) {
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

function SectionTitle({ children }: { children: React.ReactNode }) {
  return <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12, marginTop: 12 }}>{children}</Text>;
}

// ─── 表單狀態 ────────────────────────────────────────────────────────────────

type FormState = {
  patient_id: number | null;
  medication_name: string;
  medication_source: string;
  medication_quantity: string;
  prescription_date: string;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  duration_days: string;
  dosage_form: string;
  administration_route: string;
  dosage_amount: string;
  dosage_unit: string;
  special_dosage_instruction: string;
  daily_frequency: number;
  frequency_type: string;
  frequency_value: string;
  specific_weekdays: number[];
  is_odd_even_day: string;
  medication_time_slots: string[];
  meal_timing: string;
  is_prn: boolean;
  preparation_method: string;
  status: PrescriptionStatusType;
  notes: string;
};

function emptyForm(): FormState {
  const today = new Date().toISOString().split('T')[0];
  return {
    patient_id: null,
    medication_name: '',
    medication_source: '',
    medication_quantity: '',
    prescription_date: today,
    start_date: today,
    start_time: '',
    end_date: '',
    end_time: '',
    duration_days: '',
    dosage_form: '',
    administration_route: '',
    dosage_amount: '',
    dosage_unit: '',
    special_dosage_instruction: '',
    daily_frequency: 1,
    frequency_type: 'daily',
    frequency_value: '1',
    specific_weekdays: [],
    is_odd_even_day: 'none',
    medication_time_slots: [],
    meal_timing: '',
    is_prn: false,
    preparation_method: 'advanced',
    status: 'pending_change',
    notes: '',
  };
}

export default function PrescriptionsScreen() {
  const { data: prescriptions = [], isLoading, refetch } = usePrescriptions();
  const createPrescription = useCreatePrescription();
  const updatePrescription = useUpdatePrescription();
  const deletePrescription = useDeletePrescription();

  const [filterStatus, setFilterStatus] = useState<PrescriptionStatusType | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editing, setEditing] = useState<MedicationPrescription | null>(null);
  const [form, setForm] = useState<FormState>(emptyForm());
  const [newTimeSlot, setNewTimeSlot] = useState('');

  const statusFiltered = useMemo(
    () => filterStatus === 'all' ? prescriptions : prescriptions.filter(p => p.status === filterStatus),
    [prescriptions, filterStatus]
  );

  function set<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm(f => ({ ...f, [key]: value }));
  }

  function openCreate() { setEditing(null); setForm(emptyForm()); setNewTimeSlot(''); setShowModal(true); }
  function openEdit(p: MedicationPrescription) {
    setEditing(p);
    setForm({
      patient_id: p.patient_id,
      medication_name: p.medication_name,
      medication_source: p.medication_source ?? '',
      medication_quantity: p.medication_quantity ?? '',
      prescription_date: p.prescription_date ?? '',
      start_date: p.start_date ?? '',
      start_time: p.start_time ?? '',
      end_date: p.end_date ?? '',
      end_time: p.end_time ?? '',
      duration_days: p.duration_days ? String(p.duration_days) : '',
      dosage_form: p.dosage_form ?? '',
      administration_route: p.administration_route ?? '',
      dosage_amount: p.dosage_amount ? String(p.dosage_amount) : '',
      dosage_unit: p.dosage_unit ?? '',
      special_dosage_instruction: p.special_dosage_instruction ?? '',
      daily_frequency: p.daily_frequency ?? 1,
      frequency_type: p.frequency_type ?? 'daily',
      frequency_value: p.frequency_value ? String(p.frequency_value) : '1',
      specific_weekdays: p.specific_weekdays ?? [],
      is_odd_even_day: p.is_odd_even_day ?? 'none',
      medication_time_slots: p.medication_time_slots ?? [],
      meal_timing: p.meal_timing ?? '',
      is_prn: p.is_prn ?? false,
      preparation_method: p.preparation_method ?? 'advanced',
      status: p.status,
      notes: p.notes ?? p.remarks ?? '',
    });
    setNewTimeSlot('');
    setShowModal(true);
  }

  function addTimeSlot() {
    const t = newTimeSlot.trim();
    if (!t) return;
    if (form.medication_time_slots.includes(t)) { setNewTimeSlot(''); return; }
    set('medication_time_slots', [...form.medication_time_slots, t].sort());
    setNewTimeSlot('');
  }

  function removeTimeSlot(t: string) {
    set('medication_time_slots', form.medication_time_slots.filter(x => x !== t));
  }

  function toggleWeekday(idx: number) {
    const next = form.specific_weekdays.includes(idx)
      ? form.specific_weekdays.filter(x => x !== idx)
      : [...form.specific_weekdays, idx];
    set('specific_weekdays', next);
  }

  async function handleSave() {
    if (!form.patient_id) { Alert.alert('提示', '請選擇院友'); return; }
    if (!form.medication_name.trim()) { Alert.alert('提示', '請輸入藥物名稱'); return; }
    // 非 PRN：服用時間點數量須等於每日服用次數
    if (!form.is_prn && form.medication_time_slots.length !== form.daily_frequency) {
      Alert.alert('提示', `非PRN藥物的服用時間點數量必須與每日服用次數相同。\n目前每日 ${form.daily_frequency} 次，實際時間點 ${form.medication_time_slots.length} 個。`);
      return;
    }
    if (form.is_prn && form.medication_time_slots.length === 0) {
      Alert.alert('提示', 'PRN藥物至少需要設定一個服用時間點'); return;
    }
    if (form.status === 'inactive' && !form.end_date) {
      Alert.alert('提示', '停用處方必須設定結束日期'); return;
    }
    try {
      const payload: any = {
        patient_id: form.patient_id,
        medication_name: form.medication_name.trim(),
        medication_source: form.medication_source || undefined,
        medication_quantity: form.medication_quantity || undefined,
        prescription_date: form.prescription_date || new Date().toISOString().slice(0, 10),
        start_date: form.start_date || new Date().toISOString().slice(0, 10),
        start_time: form.start_time || undefined,
        end_date: form.end_date || undefined,
        end_time: form.end_time || undefined,
        duration_days: form.duration_days ? Number(form.duration_days) : undefined,
        dosage_form: form.dosage_form || undefined,
        administration_route: form.administration_route || undefined,
        dosage_amount: form.special_dosage_instruction ? undefined : (form.dosage_amount || undefined),
        dosage_unit: form.special_dosage_instruction ? undefined : (form.dosage_unit || undefined),
        special_dosage_instruction: form.special_dosage_instruction || undefined,
        daily_frequency: form.daily_frequency,
        frequency_type: form.frequency_type,
        frequency_value: Number(form.frequency_value) || 1,
        specific_weekdays: form.specific_weekdays,
        is_odd_even_day: form.is_odd_even_day,
        medication_time_slots: form.medication_time_slots,
        meal_timing: form.meal_timing || undefined,
        is_prn: form.is_prn,
        preparation_method: form.preparation_method,
        status: form.status,
        notes: form.notes || undefined,
      };
      if (editing) { await updatePrescription.mutateAsync({ ...editing, ...payload }); }
      else { await createPrescription.mutateAsync(payload); }
      setShowModal(false);
    } catch (e: any) { Alert.alert('儲存失敗', e?.message ?? '請重試'); }
  }

  function handleDelete(id: string) {
    Alert.alert('確認刪除', '確定刪除此處方？', [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => deletePrescription.mutate(id) },
    ]);
  }

  const isSaving = createPrescription.isPending || updatePrescription.isPending;
  const showWeekdayValue = form.frequency_type === 'every_x_days' || form.frequency_type === 'every_x_months' || form.frequency_type === 'hourly';

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* 狀態篩選 */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false}>
          {(['all', ...STATUSES] as const).map(s => {
            const label = s === 'all' ? '全部' : PRESCRIPTION_STATUS_LABELS[s];
            const color = s === 'all' ? '#6b7280' : PRESCRIPTION_STATUS_COLORS[s];
            return (
              <TouchableOpacity key={s} onPress={() => setFilterStatus(s)}
                style={{ marginRight: 8, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, borderWidth: 1, backgroundColor: filterStatus === s ? color : 'white', borderColor: filterStatus === s ? color : '#e5e7eb' }}>
                <Text style={{ color: filterStatus === s ? 'white' : '#374151', fontSize: 12, fontWeight: '600' }}>{label}</Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>
      </View>

      <ResidentGroupedList
        records={statusFiltered}
        isLoading={isLoading}
        onRefresh={refetch}
        getPatientId={(p) => p.patient_id}
        getDate={(p) => p.start_date}
        getRecordSearchText={(p) => `${p.medication_name} ${p.medication_source ?? ''}`}
        emptyText="暫無處方記錄"
        renderCard={(item) => {
          const statusColor = PRESCRIPTION_STATUS_COLORS[item.status];
          const statusLabel = PRESCRIPTION_STATUS_LABELS[item.status];
          const dosageText = item.special_dosage_instruction || `${item.dosage_amount ?? ''}${item.dosage_unit ?? ''}`;
          return (
            <TouchableOpacity
              style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
              onPress={() => openEdit(item)} activeOpacity={0.7}
            >
              <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                <View style={{ flex: 1 }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#111827' }}>{item.medication_name}</Text>
                    <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: statusColor + '20' }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: statusColor }}>{statusLabel}</Text>
                    </View>
                    {item.is_prn && (
                      <View style={{ paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6, backgroundColor: '#fef3c7' }}>
                        <Text style={{ fontSize: 11, color: '#92400e' }}>PRN</Text>
                      </View>
                    )}
                  </View>
                  <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>
                    {dosageText}{item.dosage_form ? ` · ${item.dosage_form}` : ''}{item.administration_route ? ` · ${item.administration_route}` : ''}
                  </Text>
                  {item.medication_time_slots && item.medication_time_slots.length > 0 && (
                    <Text style={{ fontSize: 12, color: '#9ca3af' }}>服用時間：{item.medication_time_slots.join('、')}{item.meal_timing ? `（${item.meal_timing}）` : ''}</Text>
                  )}
                  <Text style={{ fontSize: 12, color: '#9ca3af' }}>{item.start_date}{item.end_date ? ` → ${item.end_date}` : ''}</Text>
                </View>
                <TouchableOpacity onPress={() => handleDelete(item.id)} style={{ padding: 4 }}>
                  <Ionicons name="trash-outline" size={18} color="#ef4444" />
                </TouchableOpacity>
              </View>
            </TouchableOpacity>
          );
        }}
      />

      <TouchableOpacity
        style={{ position: 'absolute', bottom: 32, right: 24, width: 56, height: 56, backgroundColor: '#3b82f6', borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 }}
        onPress={openCreate}>
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* ── 完整處方模態框（完全對應 web PrescriptionModal） ── */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet" onRequestClose={() => setShowModal(false)}>
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            <TouchableOpacity onPress={() => setShowModal(false)}><Text style={{ fontSize: 16, color: '#6b7280' }}>取消</Text></TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>{editing ? '編輯處方' : '新增處方'}</Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              {isSaving ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text style={{ fontSize: 16, fontWeight: '600', color: '#3b82f6' }}>儲存</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16, paddingBottom: 60 }} keyboardShouldPersistTaps="handled">
            {/* 基本資訊 */}
            <SectionTitle>基本資訊</SectionTitle>
            <FieldLabel>院友 *</FieldLabel>
            <View style={{ marginBottom: 14 }}>
              <PatientAutocomplete
                value={form.patient_id}
                onChange={(id) => set('patient_id', id)}
                showResidencyFilter
                defaultResidencyStatus="在住"
              />
            </View>

            <FieldLabel>藥物名稱 *</FieldLabel>
            <Input value={form.medication_name} onChangeText={(v: string) => set('medication_name', v)} placeholder="搜索或輸入藥物名稱..." />
            <FieldLabel>藥物來源</FieldLabel>
            <Input value={form.medication_source} onChangeText={(v: string) => set('medication_source', v)} placeholder="例如：醫院、診所、藥房" />
            <FieldLabel>藥物數量</FieldLabel>
            <Input value={form.medication_quantity} onChangeText={(v: string) => set('medication_quantity', v)} placeholder="例如：30片、100ml" />
            <FieldLabel>處方日期 *</FieldLabel>
            <Input value={form.prescription_date} onChangeText={(v: string) => set('prescription_date', v)} placeholder="YYYY-MM-DD" />

            {/* 服用時間設定 */}
            <SectionTitle>服用時間設定</SectionTitle>
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><FieldLabel>開始日期 *</FieldLabel><Input value={form.start_date} onChangeText={(v: string) => set('start_date', v)} placeholder="YYYY-MM-DD" /></View>
              <View style={{ flex: 1 }}><FieldLabel>開始時間</FieldLabel><Input value={form.start_time} onChangeText={(v: string) => set('start_time', v)} placeholder="HH:MM" /></View>
            </View>
            <FieldLabel>服用日數（填寫後自動計算結束日期）</FieldLabel>
            <Input value={form.duration_days} onChangeText={(v: string) => {
              const days = parseInt(v);
              if (!isNaN(days) && days > 0 && form.start_date) {
                const d = new Date(form.start_date); d.setDate(d.getDate() + days);
                setForm(f => ({ ...f, duration_days: v, end_date: d.toISOString().split('T')[0] }));
              } else { set('duration_days', v); }
            }} placeholder="例如：7" keyboardType="numeric" />
            <View style={{ flexDirection: 'row', gap: 12 }}>
              <View style={{ flex: 1 }}><FieldLabel>結束日期</FieldLabel><Input value={form.end_date} onChangeText={(v: string) => set('end_date', v)} placeholder="YYYY-MM-DD" /></View>
              <View style={{ flex: 1 }}><FieldLabel>結束時間</FieldLabel><Input value={form.end_time} onChangeText={(v: string) => set('end_time', v)} placeholder="HH:MM" /></View>
            </View>

            {/* 服用資訊 */}
            <SectionTitle>服用資訊</SectionTitle>
            <FieldLabel>劑型</FieldLabel>
            <Chips options={DOSAGE_FORM_OPTIONS} value={form.dosage_form} onChange={(v) => set('dosage_form', v)} />
            <FieldLabel>服用途徑</FieldLabel>
            <Chips options={ADMIN_ROUTE_OPTIONS} value={form.administration_route} onChange={(v) => set('administration_route', v)} />

            <FieldLabel>每日服用次數</FieldLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {DAILY_FREQUENCY_OPTIONS.map(opt => {
                const active = form.daily_frequency === opt.value;
                return (
                  <TouchableOpacity key={opt.value} onPress={() => set('daily_frequency', opt.value)}
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, backgroundColor: active ? '#3b82f6' : 'white', borderColor: active ? '#3b82f6' : '#e5e7eb' }}>
                    <Text style={{ color: active ? 'white' : '#374151', fontSize: 13 }}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 份量／特殊用法 互斥 */}
            <FieldLabel>用量方式</FieldLabel>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 10 }}>
              <TouchableOpacity onPress={() => set('special_dosage_instruction', '')}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, backgroundColor: !form.special_dosage_instruction ? '#3b82f6' : 'white', borderColor: !form.special_dosage_instruction ? '#3b82f6' : '#e5e7eb' }}>
                <Text style={{ color: !form.special_dosage_instruction ? 'white' : '#374151', fontSize: 13 }}>使用份量和單位</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => setForm(f => ({ ...f, special_dosage_instruction: '適量', dosage_amount: '', dosage_unit: '' }))}
                style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, backgroundColor: form.special_dosage_instruction ? '#3b82f6' : 'white', borderColor: form.special_dosage_instruction ? '#3b82f6' : '#e5e7eb' }}>
                <Text style={{ color: form.special_dosage_instruction ? 'white' : '#374151', fontSize: 13 }}>使用特殊用法</Text>
              </TouchableOpacity>
            </View>
            {!form.special_dosage_instruction ? (
              <View style={{ flexDirection: 'row', gap: 12 }}>
                <View style={{ flex: 1 }}><FieldLabel>服用份量</FieldLabel><Input value={form.dosage_amount} onChangeText={(v: string) => set('dosage_amount', v)} placeholder="1" keyboardType="decimal-pad" /></View>
                <View style={{ flex: 1 }}>
                  <FieldLabel>單位</FieldLabel>
                  <ScrollView horizontal showsHorizontalScrollIndicator={false} style={{ marginBottom: 14 }}>
                    {DOSAGE_UNIT_OPTIONS.map(u => (
                      <TouchableOpacity key={u} onPress={() => set('dosage_unit', u)}
                        style={{ marginRight: 6, paddingHorizontal: 10, paddingVertical: 8, borderRadius: 10, borderWidth: 1, backgroundColor: form.dosage_unit === u ? '#3b82f6' : 'white', borderColor: form.dosage_unit === u ? '#3b82f6' : '#e5e7eb' }}>
                        <Text style={{ color: form.dosage_unit === u ? 'white' : '#374151', fontSize: 13 }}>{u}</Text>
                      </TouchableOpacity>
                    ))}
                  </ScrollView>
                </View>
              </View>
            ) : (
              <>
                <FieldLabel>特殊用法</FieldLabel>
                <Chips options={SPECIAL_DOSAGE_OPTIONS} value={form.special_dosage_instruction} onChange={(v) => set('special_dosage_instruction', v)} />
              </>
            )}

            <FieldLabel>服用時段</FieldLabel>
            <Chips options={MEAL_TIMING_OPTIONS} value={form.meal_timing} onChange={(v) => set('meal_timing', v)} />

            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: 'white', borderRadius: 10, paddingHorizontal: 14, paddingVertical: 10, marginBottom: 14, borderWidth: 1, borderColor: '#e5e7eb' }}>
              <Text style={{ fontSize: 14, color: '#374151' }}>需要時 (PRN)</Text>
              <Switch value={form.is_prn} onValueChange={(v) => set('is_prn', v)} trackColor={{ false: '#e5e7eb', true: '#3b82f6' }} />
            </View>

            <FieldLabel>備藥方式</FieldLabel>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 14 }}>
              {PREPARATION_METHOD_OPTIONS.map(opt => {
                const active = form.preparation_method === opt.value;
                return (
                  <TouchableOpacity key={opt.value} onPress={() => set('preparation_method', opt.value)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center', backgroundColor: active ? '#3b82f6' : 'white', borderColor: active ? '#3b82f6' : '#e5e7eb' }}>
                    <Text style={{ color: active ? 'white' : '#374151', fontSize: 13 }}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* 服用頻率 */}
            <SectionTitle>服用頻率</SectionTitle>
            <FieldLabel>頻率類型 *</FieldLabel>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {FREQUENCY_TYPE_OPTIONS.map(opt => {
                const active = form.frequency_type === opt.value;
                return (
                  <TouchableOpacity key={opt.value} onPress={() => set('frequency_type', opt.value)}
                    style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, backgroundColor: active ? '#3b82f6' : 'white', borderColor: active ? '#3b82f6' : '#e5e7eb' }}>
                    <Text style={{ color: active ? 'white' : '#374151', fontSize: 13 }}>{opt.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {showWeekdayValue && (
              <>
                <FieldLabel>{form.frequency_type === 'every_x_days' ? '間隔天數' : form.frequency_type === 'every_x_months' ? '間隔月數' : '服用次數'}</FieldLabel>
                <Input value={form.frequency_value} onChangeText={(v: string) => set('frequency_value', v)} placeholder="1" keyboardType="numeric" />
              </>
            )}
            {form.frequency_type === 'weekly_days' && (
              <>
                <FieldLabel>選擇星期幾 *</FieldLabel>
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
                  {WEEKDAY_NAMES.map((name, idx) => {
                    const active = form.specific_weekdays.includes(idx);
                    return (
                      <TouchableOpacity key={idx} onPress={() => toggleWeekday(idx)}
                        style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 10, borderWidth: 1, backgroundColor: active ? '#3b82f6' : 'white', borderColor: active ? '#3b82f6' : '#e5e7eb' }}>
                        <Text style={{ color: active ? 'white' : '#374151', fontSize: 13 }}>{name}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </>
            )}

            {/* 服用時間點 */}
            <FieldLabel>服用時間點{form.is_prn ? '（PRN：至少 1 個）' : `（須與每日次數 ${form.daily_frequency} 一致）`}</FieldLabel>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 8 }}>
              <TextInput
                style={{ flex: 1, backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, fontSize: 15, color: '#1f2937' }}
                value={newTimeSlot} onChangeText={setNewTimeSlot} placeholder="HH:MM（如 08:00）" placeholderTextColor="#9ca3af"
              />
              <TouchableOpacity onPress={addTimeSlot} style={{ paddingHorizontal: 16, justifyContent: 'center', backgroundColor: '#3b82f6', borderRadius: 10 }}>
                <Text style={{ color: 'white', fontWeight: '600' }}>加入</Text>
              </TouchableOpacity>
            </View>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
              {form.medication_time_slots.map(t => (
                <TouchableOpacity key={t} onPress={() => removeTimeSlot(t)}
                  style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 9999, backgroundColor: '#eff6ff', borderWidth: 1, borderColor: '#bfdbfe' }}>
                  <Text style={{ color: '#1d4ed8', fontSize: 13 }}>{t}</Text>
                  <Ionicons name="close-circle" size={14} color="#1d4ed8" />
                </TouchableOpacity>
              ))}
            </View>

            {/* 狀態 */}
            <SectionTitle>狀態</SectionTitle>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 20 }}>
              {STATUSES.map(s => {
                const active = form.status === s;
                return (
                  <TouchableOpacity key={s} onPress={() => set('status', s)}
                    style={{ flex: 1, paddingVertical: 10, borderRadius: 10, borderWidth: 1, alignItems: 'center', backgroundColor: active ? PRESCRIPTION_STATUS_COLORS[s] : 'white', borderColor: active ? PRESCRIPTION_STATUS_COLORS[s] : '#e5e7eb' }}>
                    <Text style={{ color: active ? 'white' : '#374151', fontSize: 13, fontWeight: '600' }}>{PRESCRIPTION_STATUS_LABELS[s]}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            <FieldLabel>備註</FieldLabel>
            <Input value={form.notes} onChangeText={(v: string) => set('notes', v)} placeholder="備註（可選）" multiline />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
