import { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  ActivityIndicator, Modal, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';
import { ResidentGroupedList } from '@/components/ResidentGroupedList';
import {
  useRestraintAssessments, useCreateRestraintAssessment, useUpdateRestraintAssessment, useDeleteRestraintAssessment,
  useRestraintObservations, useCreateRestraintObservation, useDeleteRestraintObservation,
  OBSERVATION_STATUS_LABELS, type RestraintAssessment, type RestraintObservation, type ObservationStatus,
} from '@/features/restraints/useRestraints';

// ─── 完全按照 web RestraintAssessmentModal 的定義 ─────────────────────────────

const RISK_FACTOR_CATEGORIES = [
  {
    category: '精神及/或行為異常的情況',
    subcategories: ['情緒問題/神志昏亂', '遊走', '傷害自己的行為，請註明：', '傷害/騷擾他人的行為，請註明：'],
  },
  {
    category: '未能保持正確坐姿',
    subcategories: ['背部及腰肢肌肉無力', '癱瘓', '關節退化', '其他，請註明：'],
  },
  {
    category: '有跌倒風險',
    subcategories: ['步履失平衡', '住院期間曾經跌倒', '視/聽力衰退', '受藥物影響', '其他跌倒的風險，請註明：'],
  },
  {
    category: '曾除去治療用之醫療器材及／或維護身體的用品',
    subcategories: ['餵食管', '氧氣喉管或面罩', '尿片或衣服', '其他造口護理裝置', '導尿管', '其他醫療器材，請註明：'],
  },
  { category: '其他，請註明：', subcategories: [] },
];

const ALTERNATIVE_OPTIONS = [
  '延醫診治，找出影響情緒或神志昏亂的原因並處理',
  '與註冊醫生/註冊中醫/表列中醫商討療程或調校藥物',
  '尋求物理治療師/職業治療師/臨床心理學家/社工的介入',
  '改善家具：使用更合適的座椅、座墊或其他配件',
  '改善環境：令住客對環境感安全、舒適及熟悉',
  '提供消閒及分散注意力的活動',
  '多與住客傾談，建立融洽互信的關係',
  '安老院員工定期觀察及巡視',
  '調節日常護理程序以配合住客的特殊需要',
  '請家人/親友探望協助',
  '其他，請註明：',
];

const RESTRAINT_OPTIONS = [
  { name: '約束衣',         conditions: ['坐在椅上', '躺在床上', '坐在椅上及躺在床上'] },
  { name: '約束腰帶',       conditions: ['坐在椅上', '躺在床上', '坐在椅上及躺在床上'] },
  { name: '手腕帶',         conditions: ['坐在椅上', '躺在床上', '坐在椅上及躺在床上'] },
  { name: '約束手套/連指手套', conditions: ['坐在椅上', '躺在床上', '坐在椅上及躺在床上'] },
  { name: '防滑褲/防滑褲帶', conditions: ['坐在椅上', '躺在床上', '坐在椅上及躺在床上'] },
  { name: '枱板',            conditions: ['坐在椅上/輪椅上'] },
  { name: '其他：',          conditions: ['坐在椅上', '躺在床上', '坐在椅上及躺在床上'] },
];

const OBS_STATUS_COLORS: Record<ObservationStatus, string> = {
  N: '#22c55e', P: '#f59e0b', S: '#ef4444',
};

// ─── 表單狀態 ────────────────────────────────────────────────────────────────

type AssessForm = {
  patient_id: number | null;
  doctor_signature_date: string;
  next_due_date: string;
  risk_factors: Record<string, any>;
  alternatives: Record<string, any>;
  suggested_restraints: Record<string, any>;
  other_restraint_notes: string;
};

const EMPTY_ASSESS: AssessForm = {
  patient_id: null,
  doctor_signature_date: '',
  next_due_date: '',
  risk_factors: {},
  alternatives: {},
  suggested_restraints: {},
  other_restraint_notes: '',
};

type ObsForm = {
  patient_id: number | null;
  observation_date: string;
  observation_time: string;
  scheduled_time: string;
  observation_status: ObservationStatus;
  recorder: string;
  notes: string;
};

const EMPTY_OBS: ObsForm = {
  patient_id: null,
  observation_date: new Date().toISOString().split('T')[0],
  observation_time: '',
  scheduled_time: '',
  observation_status: 'N',
  recorder: '',
  notes: '',
};

// ─── 主組件 ─────────────────────────────────────────────────────────────────

export default function RestraintsScreen() {
  const { data: assessments = [], isLoading: loadingAssess, refetch: refetchAssess } = useRestraintAssessments();
  const { data: observations = [], isLoading: loadingObs, refetch: refetchObs } = useRestraintObservations();

  const createAssessment = useCreateRestraintAssessment();
  const updateAssessment = useUpdateRestraintAssessment();
  const deleteAssessment = useDeleteRestraintAssessment();
  const createObs = useCreateRestraintObservation();
  const deleteObs = useDeleteRestraintObservation();

  const [tab, setTab] = useState<'assess' | 'obs'>('assess');
  const [showAssessModal, setShowAssessModal] = useState(false);
  const [showObsModal, setShowObsModal] = useState(false);
  const [editingAssess, setEditingAssess] = useState<RestraintAssessment | null>(null);
  const [assessForm, setAssessForm] = useState<AssessForm>(EMPTY_ASSESS);
  const [obsForm, setObsForm] = useState<ObsForm>(EMPTY_OBS);

  function openCreateAssess() {
    setEditingAssess(null);
    setAssessForm(EMPTY_ASSESS);
    setShowAssessModal(true);
  }

  function openEditAssess(a: RestraintAssessment) {
    setEditingAssess(a);
    setAssessForm({
      patient_id: a.patient_id,
      doctor_signature_date: a.doctor_signature_date ?? '',
      next_due_date: a.next_due_date ?? '',
      risk_factors: (a.risk_factors as any) ?? {},
      alternatives: (a.alternatives as any) ?? {},
      suggested_restraints: (a.suggested_restraints as any) ?? {},
      other_restraint_notes: a.other_restraint_notes ?? '',
    });
    setShowAssessModal(true);
  }

  async function handleSaveAssess() {
    if (!assessForm.patient_id) { Alert.alert('提示', '請選擇院友'); return; }
    const payload = {
      patient_id: assessForm.patient_id,
      doctor_signature_date: assessForm.doctor_signature_date || undefined,
      next_due_date: assessForm.next_due_date || undefined,
      risk_factors: assessForm.risk_factors,
      alternatives: assessForm.alternatives,
      suggested_restraints: assessForm.suggested_restraints,
      other_restraint_notes: assessForm.other_restraint_notes || undefined,
    };
    try {
      if (editingAssess) { await updateAssessment.mutateAsync({ ...editingAssess, ...payload }); }
      else { await createAssessment.mutateAsync(payload); }
      setShowAssessModal(false);
    } catch (e: any) { Alert.alert('儲存失敗', e?.message ?? '請重試'); }
  }

  async function handleSaveObs() {
    if (!obsForm.patient_id) { Alert.alert('提示', '請選擇院友'); return; }
    try {
      await createObs.mutateAsync({
        patient_id: obsForm.patient_id,
        observation_date: obsForm.observation_date,
        observation_time: obsForm.observation_time || '',
        scheduled_time: obsForm.scheduled_time || '',
        observation_status: obsForm.observation_status,
        recorder: obsForm.recorder || '',
        notes: obsForm.notes || undefined,
      });
      setShowObsModal(false);
    } catch (e: any) { Alert.alert('儲存失敗', e?.message ?? '請重試'); }
  }

  function toggleRiskFactor(key: string) {
    setAssessForm(f => ({
      ...f,
      risk_factors: { ...f.risk_factors, [key]: !f.risk_factors[key] },
    }));
  }

  function toggleAlternative(key: string) {
    setAssessForm(f => ({
      ...f,
      alternatives: { ...f.alternatives, [key]: !f.alternatives[key] },
    }));
  }

  function toggleRestraint(name: string) {
    setAssessForm(f => {
      const current = f.suggested_restraints[name];
      if (current) {
        const next = { ...f.suggested_restraints };
        delete next[name];
        return { ...f, suggested_restraints: next };
      }
      return { ...f, suggested_restraints: { ...f.suggested_restraints, [name]: { condition: '', times: [] } } };
    });
  }

  function setRestraintCondition(name: string, condition: string) {
    setAssessForm(f => ({
      ...f,
      suggested_restraints: {
        ...f.suggested_restraints,
        [name]: { ...f.suggested_restraints[name], condition },
      },
    }));
  }

  const isSavingAssess = createAssessment.isPending || updateAssessment.isPending;
  const isSavingObs = createObs.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      {/* Tab */}
      <View style={{ paddingHorizontal: 16, paddingTop: 12 }}>
        <View style={{ flexDirection: 'row', backgroundColor: 'white', borderRadius: 12, padding: 4, borderWidth: 1, borderColor: '#e5e7eb' }}>
          {(['assess', 'obs'] as const).map(t => (
            <TouchableOpacity
              key={t}
              onPress={() => setTab(t)}
              style={{ flex: 1, paddingVertical: 8, borderRadius: 10, alignItems: 'center', backgroundColor: tab === t ? '#3b82f6' : 'transparent' }}
            >
              <Text style={{ color: tab === t ? 'white' : '#6b7280', fontSize: 13, fontWeight: '600' }}>
                {t === 'assess' ? '評估記錄' : '觀察記錄'}
              </Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      {/* 列表 */}
      {tab === 'assess' ? (
        <ResidentGroupedList
          records={assessments}
          isLoading={loadingAssess}
          onRefresh={refetchAssess}
          getPatientId={(a) => a.patient_id}
          getDate={(a) => a.doctor_signature_date || a.next_due_date}
          getRecordSearchText={(a) => a.other_restraint_notes ?? ''}
          emptyText="暫無約束評估記錄"
          renderCard={(item) => {
            const overdue = item.next_due_date && new Date(item.next_due_date) < new Date();
            const riskCount = Object.values((item.risk_factors as any) ?? {}).filter(Boolean).length;
            const restraintCount = Object.keys((item.suggested_restraints as any) ?? {}).length;
            return (
              <TouchableOpacity
                style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
                onPress={() => openEditAssess(item)}
                activeOpacity={0.7}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    {item.doctor_signature_date && <Text style={{ fontSize: 12, color: '#6b7280' }}>醫生簽署日期：{item.doctor_signature_date}</Text>}
                    {item.next_due_date && (
                      <View style={{ marginTop: 4, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, alignSelf: 'flex-start', backgroundColor: overdue ? '#fee2e2' : '#eff6ff' }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: overdue ? '#b91c1c' : '#1d4ed8' }}>
                          {overdue ? '已逾期 ' : '下次到期：'}{item.next_due_date}
                        </Text>
                      </View>
                    )}
                    <View style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                      {riskCount > 0 && (
                        <View style={{ backgroundColor: '#fef3c7', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 11, color: '#92400e' }}>風險因素 {riskCount} 項</Text>
                        </View>
                      )}
                      {restraintCount > 0 && (
                        <View style={{ backgroundColor: '#fee2e2', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 6 }}>
                          <Text style={{ fontSize: 11, color: '#991b1b' }}>約束物品 {restraintCount} 項</Text>
                        </View>
                      )}
                    </View>
                    {item.other_restraint_notes && <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{item.other_restraint_notes}</Text>}
                  </View>
                  <TouchableOpacity
                    onPress={() => Alert.alert('確認刪除', '確定刪除此評估記錄？', [
                      { text: '取消', style: 'cancel' },
                      { text: '刪除', style: 'destructive', onPress: () => deleteAssessment.mutate(item.id) },
                    ])}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </TouchableOpacity>
            );
          }}
        />
      ) : (
        <ResidentGroupedList
          records={observations}
          isLoading={loadingObs}
          onRefresh={refetchObs}
          getPatientId={(o) => o.patient_id}
          getDate={(o) => o.observation_date}
          getRecordSearchText={(o) => o.recorder ?? ''}
          emptyText="暫無約束觀察記錄"
          renderCard={(item) => {
            const statusColor = OBS_STATUS_COLORS[item.observation_status as ObservationStatus] ?? '#9ca3af';
            const statusLabel = OBSERVATION_STATUS_LABELS[item.observation_status as ObservationStatus] ?? item.observation_status;
            return (
              <View style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 8, paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: statusColor + '20' }}>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: statusColor }}>{statusLabel}</Text>
                      </View>
                      <Text style={{ fontSize: 12, color: '#6b7280' }}>{item.observation_date}{item.observation_time ? ` ${item.observation_time}` : ''}</Text>
                    </View>
                    {item.scheduled_time && <Text style={{ fontSize: 12, color: '#9ca3af' }}>預定時間：{item.scheduled_time}</Text>}
                    {item.recorder && <Text style={{ fontSize: 12, color: '#9ca3af' }}>記錄員：{item.recorder}</Text>}
                    {item.notes && <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{item.notes}</Text>}
                  </View>
                  <TouchableOpacity
                    onPress={() => Alert.alert('確認刪除', '確定刪除此觀察記錄？', [
                      { text: '取消', style: 'cancel' },
                      { text: '刪除', style: 'destructive', onPress: () => deleteObs.mutate(item.id) },
                    ])}
                    style={{ padding: 4 }}
                  >
                    <Ionicons name="trash-outline" size={18} color="#ef4444" />
                  </TouchableOpacity>
                </View>
              </View>
            );
          }}
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={{ position: 'absolute', bottom: 32, right: 24, width: 56, height: 56, backgroundColor: '#3b82f6', borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 }}
        onPress={tab === 'assess' ? openCreateAssess : () => { setObsForm(EMPTY_OBS); setShowObsModal(true); }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* ── 評估記錄模態框 ── */}
      <Modal visible={showAssessModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            <TouchableOpacity onPress={() => setShowAssessModal(false)}>
              <Text style={{ fontSize: 16, color: '#6b7280' }}>取消</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
              {editingAssess ? '編輯約束物品評估' : '新增約束物品評估'}
            </Text>
            <TouchableOpacity onPress={handleSaveAssess} disabled={isSavingAssess}>
              {isSavingAssess ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text style={{ fontSize: 16, fontWeight: '600', color: '#3b82f6' }}>儲存</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 16 }} keyboardShouldPersistTaps="handled">
            {/* 院友 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>院友 *</Text>
            <View style={{ marginBottom: 16 }}>
              <PatientAutocomplete
                value={assessForm.patient_id}
                onChange={(id) => setAssessForm(f => ({ ...f, patient_id: id }))}
                showResidencyFilter
                defaultResidencyStatus="在住"
              />
            </View>

            {/* 醫生簽署日期 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>醫生簽署日期</Text>
            <TextInput
              style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 16 }}
              value={assessForm.doctor_signature_date}
              onChangeText={v => setAssessForm(f => ({ ...f, doctor_signature_date: v }))}
              placeholder="YYYY-MM-DD（可選）"
              placeholderTextColor="#9ca3af"
            />

            {/* 下次到期日 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>下次到期日</Text>
            <TextInput
              style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 24 }}
              value={assessForm.next_due_date}
              onChangeText={v => setAssessForm(f => ({ ...f, next_due_date: v }))}
              placeholder="YYYY-MM-DD（可選）"
              placeholderTextColor="#9ca3af"
            />

            {/* 風險因素 */}
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>風險因素</Text>
            {RISK_FACTOR_CATEGORIES.map(cat => (
              <View key={cat.category} style={{ marginBottom: 16, backgroundColor: 'white', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e5e7eb' }}>
                <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 }}>{cat.category}</Text>
                {cat.subcategories.length > 0 ? cat.subcategories.map(sub => (
                  <TouchableOpacity
                    key={sub}
                    onPress={() => toggleRiskFactor(sub)}
                    style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: assessForm.risk_factors[sub] ? '#3b82f6' : '#d1d5db', backgroundColor: assessForm.risk_factors[sub] ? '#3b82f6' : 'white', alignItems: 'center', justifyContent: 'center' }}>
                      {assessForm.risk_factors[sub] && <Ionicons name="checkmark" size={13} color="white" />}
                    </View>
                    <Text style={{ fontSize: 14, color: '#374151', flex: 1 }}>{sub}</Text>
                  </TouchableOpacity>
                )) : (
                  <TextInput
                    style={{ backgroundColor: '#f9fafb', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 8, paddingHorizontal: 10, paddingVertical: 8, fontSize: 14, color: '#1f2937' }}
                    value={assessForm.risk_factors[cat.category + '_text'] ?? ''}
                    onChangeText={v => setAssessForm(f => ({ ...f, risk_factors: { ...f.risk_factors, [cat.category + '_text']: v } }))}
                    placeholder="請說明..."
                    placeholderTextColor="#9ca3af"
                  />
                )}
              </View>
            ))}

            {/* 折衷辦法 */}
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12, marginTop: 8 }}>折衷辦法</Text>
            <View style={{ backgroundColor: 'white', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: '#e5e7eb', marginBottom: 24 }}>
              {ALTERNATIVE_OPTIONS.map(opt => (
                <TouchableOpacity
                  key={opt}
                  onPress={() => toggleAlternative(opt)}
                  style={{ flexDirection: 'row', alignItems: 'center', paddingVertical: 6, gap: 10 }}
                >
                  <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: assessForm.alternatives[opt] ? '#3b82f6' : '#d1d5db', backgroundColor: assessForm.alternatives[opt] ? '#3b82f6' : 'white', alignItems: 'center', justifyContent: 'center' }}>
                    {assessForm.alternatives[opt] && <Ionicons name="checkmark" size={13} color="white" />}
                  </View>
                  <Text style={{ fontSize: 14, color: '#374151', flex: 1 }}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 約束物品建議 */}
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 }}>約束物品建議</Text>
            {RESTRAINT_OPTIONS.map(opt => {
              const selected = !!assessForm.suggested_restraints[opt.name];
              return (
                <View key={opt.name} style={{ backgroundColor: 'white', borderRadius: 12, padding: 12, borderWidth: 1, borderColor: selected ? '#3b82f6' : '#e5e7eb', marginBottom: 8 }}>
                  <TouchableOpacity
                    onPress={() => toggleRestraint(opt.name)}
                    style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}
                  >
                    <View style={{ width: 20, height: 20, borderRadius: 4, borderWidth: 1.5, borderColor: selected ? '#3b82f6' : '#d1d5db', backgroundColor: selected ? '#3b82f6' : 'white', alignItems: 'center', justifyContent: 'center' }}>
                      {selected && <Ionicons name="checkmark" size={13} color="white" />}
                    </View>
                    <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151', flex: 1 }}>{opt.name}</Text>
                  </TouchableOpacity>
                  {selected && (
                    <View style={{ marginTop: 8, paddingLeft: 30 }}>
                      <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 4 }}>使用情況</Text>
                      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
                        {opt.conditions.map(cond => {
                          const isActive = assessForm.suggested_restraints[opt.name]?.condition === cond;
                          return (
                            <TouchableOpacity
                              key={cond}
                              onPress={() => setRestraintCondition(opt.name, cond)}
                              style={{ paddingHorizontal: 10, paddingVertical: 5, borderRadius: 8, borderWidth: 1, backgroundColor: isActive ? '#3b82f6' : 'white', borderColor: isActive ? '#3b82f6' : '#e5e7eb' }}
                            >
                              <Text style={{ fontSize: 12, color: isActive ? 'white' : '#374151' }}>{cond}</Text>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>
              );
            })}

            {/* 其他備註 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4, marginTop: 16 }}>其他約束物品備註</Text>
            <TextInput
              style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 40, minHeight: 80 }}
              value={assessForm.other_restraint_notes}
              onChangeText={v => setAssessForm(f => ({ ...f, other_restraint_notes: v }))}
              placeholder="備註（可選）"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </ScrollView>
        </View>
      </Modal>

      {/* ── 觀察記錄模態框 ── */}
      <Modal visible={showObsModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            <TouchableOpacity onPress={() => setShowObsModal(false)}>
              <Text style={{ fontSize: 16, color: '#6b7280' }}>取消</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>新增觀察記錄</Text>
            <TouchableOpacity onPress={handleSaveObs} disabled={isSavingObs}>
              {isSavingObs ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text style={{ fontSize: 16, fontWeight: '600', color: '#3b82f6' }}>儲存</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
            {/* 院友 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>院友 *</Text>
            <View style={{ marginBottom: 16 }}>
              <PatientAutocomplete
                value={obsForm.patient_id}
                onChange={(id) => setObsForm(f => ({ ...f, patient_id: id }))}
                showResidencyFilter
                defaultResidencyStatus="在住"
              />
            </View>

            {/* 觀察狀態 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>觀察狀態</Text>
            <View style={{ flexDirection: 'row', gap: 8, marginBottom: 16 }}>
              {(['N', 'P', 'S'] as ObservationStatus[]).map(s => (
                <TouchableOpacity
                  key={s}
                  onPress={() => setObsForm(f => ({ ...f, observation_status: s }))}
                  style={{ flex: 1, paddingVertical: 10, borderRadius: 12, borderWidth: 1, alignItems: 'center', backgroundColor: obsForm.observation_status === s ? OBS_STATUS_COLORS[s] : 'white', borderColor: obsForm.observation_status === s ? OBS_STATUS_COLORS[s] : '#e5e7eb' }}
                >
                  <Text style={{ color: obsForm.observation_status === s ? 'white' : '#374151', fontSize: 13, fontWeight: '600' }}>{OBSERVATION_STATUS_LABELS[s]}</Text>
                </TouchableOpacity>
              ))}
            </View>

            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>觀察日期</Text>
            <TextInput style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 16 }} value={obsForm.observation_date} onChangeText={v => setObsForm(f => ({ ...f, observation_date: v }))} placeholder="YYYY-MM-DD" placeholderTextColor="#9ca3af" />

            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>觀察時間</Text>
            <TextInput style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 16 }} value={obsForm.observation_time} onChangeText={v => setObsForm(f => ({ ...f, observation_time: v }))} placeholder="HH:MM（可選）" placeholderTextColor="#9ca3af" />

            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>預定時間</Text>
            <TextInput style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 16 }} value={obsForm.scheduled_time} onChangeText={v => setObsForm(f => ({ ...f, scheduled_time: v }))} placeholder="HH:MM（可選）" placeholderTextColor="#9ca3af" />

            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>記錄員</Text>
            <TextInput style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 16 }} value={obsForm.recorder} onChangeText={v => setObsForm(f => ({ ...f, recorder: v }))} placeholder="記錄員姓名（可選）" placeholderTextColor="#9ca3af" />

            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>備註</Text>
            <TextInput style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 40, minHeight: 80 }} value={obsForm.notes} onChangeText={v => setObsForm(f => ({ ...f, notes: v }))} placeholder="備註（可選）" placeholderTextColor="#9ca3af" multiline numberOfLines={3} textAlignVertical="top" />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
