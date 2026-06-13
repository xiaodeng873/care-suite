import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  Modal, TextInput, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import {
  useWounds, useWoundAssessments,
  useCreateWound, useUpdateWound, useDeleteWound,
  useCreateWoundAssessment, useDeleteWoundAssessment,
} from '@/features/wounds/useWounds';
import { isOverdue } from '@/lib/utils/isOverdue';
import type { Wound, WoundAssessment } from '@/features/wounds/types';
import {
  WOUND_TYPE_LABEL, WOUND_STATUS_LABEL, WOUND_ORIGIN_LABEL, RESPONSIBLE_UNIT_LABEL,
  ASSESSMENT_STATUS_COLOR, ASSESSMENT_STATUS_LABEL,
} from '@/features/wounds/types';

function formatDate(d?: string) {
  if (!d) return '—';
  return d.slice(0, 10);
}

function AssessmentHistory({ woundId }: { woundId: string }) {
  const { data: assessments, isLoading } = useWoundAssessments(woundId);

  if (isLoading) return <ActivityIndicator size="small" color="#ef4444" className="my-2" />;
  if (!assessments?.length) return <Text className="text-xs text-gray-400 py-2">無評估記錄</Text>;

  return (
    <View className="gap-1.5">
      {assessments.slice(0, 5).map((a) => (
        <View key={a.id} className="rounded-lg bg-gray-50 border border-gray-200 px-3 py-2">
          <View className="flex-row items-center justify-between mb-1">
            <Text className="text-xs font-semibold text-gray-700">{formatDate(a.assessment_date)}</Text>
            <View className="flex-row gap-1.5">
              {a.stage && (
                <View className="bg-orange-100 px-1.5 py-0.5 rounded-full">
                  <Text className="text-orange-700 text-xs">{a.stage}</Text>
                </View>
              )}
              {a.wound_status && (
                <View className={`px-1.5 py-0.5 rounded-full ${ASSESSMENT_STATUS_COLOR[a.wound_status]}`}>
                  <Text className="text-xs">{ASSESSMENT_STATUS_LABEL[a.wound_status]}</Text>
                </View>
              )}
            </View>
          </View>
          {(a.area_length || a.area_width) && (
            <Text className="text-xs text-gray-600">
              尺寸: {a.area_length}×{a.area_width}
              {a.area_depth ? `×${a.area_depth}` : ''} cm
            </Text>
          )}
          {a.infection && a.infection !== '無' && (
            <Text className="text-xs text-red-600">感染: {a.infection}</Text>
          )}
          {a.remarks && (
            <Text className="text-xs text-gray-500 mt-0.5">{a.remarks}</Text>
          )}
          {a.assessor && (
            <Text className="text-xs text-gray-400 mt-0.5">評估者: {a.assessor}</Text>
          )}
        </View>
      ))}
      {assessments.length > 5 && (
        <Text className="text-xs text-gray-400 text-center py-1">
          共 {assessments.length} 筆記錄，顯示最近 5 筆
        </Text>
      )}
    </View>
  );
}

function WoundCard({ wound, onAddAssessment, onDelete }: { wound: Wound; onAddAssessment: () => void; onDelete: () => void }) {
  const [expanded, setExpanded] = useState(false);
  const overdue = isOverdue(wound.next_assessment_due) && wound.status === 'active';

  return (
    <View className="mb-3 rounded-xl bg-white shadow-sm overflow-hidden">
      <TouchableOpacity
        onPress={() => setExpanded(!expanded)}
        className="px-4 py-3"
      >
        <View className="flex-row items-start justify-between">
          <View className="flex-1">
            <View className="flex-row items-center gap-2 mb-1">
              <Text className="font-bold text-gray-900 text-base">
                [{wound.wound_code}] {wound.wound_name || WOUND_TYPE_LABEL[wound.wound_type]}
              </Text>
            </View>
            <View className="flex-row items-center gap-2 flex-wrap">
              <View className={`px-2 py-0.5 rounded-full ${wound.status === 'active' ? 'bg-red-100' : wound.status === 'healed' ? 'bg-green-100' : 'bg-gray-100'}`}>
                <Text className={`text-xs font-medium ${wound.status === 'active' ? 'text-red-700' : wound.status === 'healed' ? 'text-green-700' : 'text-gray-600'}`}>
                  {WOUND_STATUS_LABEL[wound.status]}
                </Text>
              </View>
              <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                <Text className="text-xs text-gray-600">{WOUND_TYPE_LABEL[wound.wound_type]}</Text>
              </View>
              <View className="bg-blue-50 px-2 py-0.5 rounded-full">
                <Text className="text-xs text-blue-600">{WOUND_ORIGIN_LABEL[wound.wound_origin]}</Text>
              </View>
            </View>
          </View>
          <Text className="text-gray-400 text-lg ml-2">{expanded ? '▲' : '▼'}</Text>
        </View>

        <View className="flex-row gap-4 mt-2">
          <View>
            <Text className="text-xs text-gray-400">發現日期</Text>
            <Text className="text-sm text-gray-700">{formatDate(wound.discovery_date)}</Text>
          </View>
          {wound.next_assessment_due && (
            <View>
              <Text className="text-xs text-gray-400">下次評估</Text>
              <Text className={`text-sm ${overdue ? 'text-red-600 font-semibold' : 'text-gray-700'}`}>
                {formatDate(wound.next_assessment_due)}{overdue ? ' ⚠️' : ''}
              </Text>
            </View>
          )}
          {wound.healed_date && (
            <View>
              <Text className="text-xs text-gray-400">癒合日期</Text>
              <Text className="text-sm text-green-700">{formatDate(wound.healed_date)}</Text>
            </View>
          )}
        </View>

        {wound.remarks && !expanded && (
          <Text className="text-xs text-gray-500 mt-1" numberOfLines={1}>{wound.remarks}</Text>
        )}
      </TouchableOpacity>

      {expanded && (
        <View className="px-4 pb-3 border-t border-gray-100">
          {wound.remarks && (
            <Text className="text-sm text-gray-600 py-2">{wound.remarks}</Text>
          )}
          <View className="flex-row justify-between items-center mb-2 mt-1">
            <Text className="text-xs font-semibold text-gray-500">評估記錄</Text>
            <View className="flex-row gap-2">
              <TouchableOpacity onPress={onAddAssessment} className="px-2 py-1 bg-red-50 rounded-lg">
                <Text className="text-xs text-red-600 font-medium">+ 新增評估</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={onDelete} className="px-2 py-1 bg-gray-100 rounded-lg">
                <Text className="text-xs text-gray-500">刪除傷口</Text>
              </TouchableOpacity>
            </View>
          </View>
          <AssessmentHistory woundId={wound.id} />
        </View>
      )}
    </View>
  );
}

export default function WoundsScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const patientId = parseInt(id, 10);
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'healed'>('active');
  const [showWoundModal, setShowWoundModal] = useState(false);
  const [showAssessModal, setShowAssessModal] = useState<string | null>(null); // woundId
  const [woundForm, setWoundForm] = useState({
    wound_code: '', wound_name: '', wound_type: 'pressure_ulcer' as any, wound_origin: 'facility' as any,
    responsible_unit: 'facility_staff' as string,
    discovery_date: new Date().toISOString().split('T')[0], next_assessment_due: '', remarks: '',
  });
  const [assessForm, setAssessForm] = useState({
    assessment_date: new Date().toISOString().split('T')[0],
    next_assessment_date: '', assessor: '', stage: '' as any, wound_status: 'treating' as any,
    area_length: '', area_width: '', area_depth: '', infection: '無', remarks: '',
  });

  const INFECTION_OPTIONS = ['有', '懷疑', '無'];
  const RESPONSIBLE_UNIT_OPTIONS = Object.entries(RESPONSIBLE_UNIT_LABEL) as [string, string][];

  const { data, isLoading, isError } = useWounds(patientId);
  const createWound = useCreateWound();
  const deleteWound = useDeleteWound();
  const createAssessment = useCreateWoundAssessment();

  const filtered = data?.filter((w) => statusFilter === 'all' ? true : w.status === statusFilter);

  async function handleSaveWound() {
    if (!woundForm.wound_code) { Alert.alert('提示', '請輸入傷口編號'); return; }
    await createWound.mutateAsync({ ...woundForm, patient_id: patientId, status: 'active' });
    setShowWoundModal(false);
  }

  async function handleSaveAssessment() {
    if (!showAssessModal) return;
    await createAssessment.mutateAsync({
      patient_id: patientId,
      wound_id: showAssessModal,
      assessment_date: assessForm.assessment_date,
      next_assessment_date: assessForm.next_assessment_date || undefined,
      assessor: assessForm.assessor || undefined,
      stage: assessForm.stage || undefined,
      wound_status: assessForm.wound_status || undefined,
      area_length: assessForm.area_length ? Number(assessForm.area_length) : undefined,
      area_width: assessForm.area_width ? Number(assessForm.area_width) : undefined,
      area_depth: assessForm.area_depth ? Number(assessForm.area_depth) : undefined,
      infection: assessForm.infection || undefined,
      remarks: assessForm.remarks || undefined,
    });
    setShowAssessModal(null);
  }

  return (
    <View className="flex-1 bg-gray-100">
      <View className="flex-row gap-2 px-4 py-2 bg-white border-b border-gray-200">
        {([['active', '活躍'], ['healed', '已癒合'], ['all', '全部']] as const).map(([val, label]) => (
          <TouchableOpacity key={val} onPress={() => setStatusFilter(val)}
            className={`px-3 py-1.5 rounded-full ${statusFilter === val ? 'bg-red-600' : 'bg-gray-100'}`}>
            <Text className={`text-sm font-medium ${statusFilter === val ? 'text-white' : 'text-gray-600'}`}>{label}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#ef4444" /></View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8"><Text className="text-red-500 text-center">載入失敗</Text></View>
      ) : !filtered?.length ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-gray-400 text-lg">{statusFilter === 'active' ? '沒有活躍傷口記錄' : '沒有傷口記錄'}</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          <Text className="text-xs text-gray-500 mb-2">共 {filtered.length} 個傷口</Text>
          {filtered.map((wound) => (
            <WoundCard key={wound.id} wound={wound} onAddAssessment={() => {
              setAssessForm({ assessment_date: new Date().toISOString().split('T')[0], next_assessment_date: '', assessor: '', stage: '', wound_status: 'treating', area_length: '', area_width: '', area_depth: '', infection: '無', remarks: '' });
              setShowAssessModal(wound.id);
            }} onDelete={() => Alert.alert('確認刪除', '確定刪除此傷口記錄？', [{ text: '取消', style: 'cancel' }, { text: '刪除', style: 'destructive', onPress: () => deleteWound.mutate({ id: wound.id, patientId }) }])} />
          ))}
        </ScrollView>
      )}

      <TouchableOpacity
        className="absolute bottom-8 right-6 w-14 h-14 bg-red-500 rounded-full items-center justify-center shadow-lg"
        style={{ elevation: 6 }}
        onPress={() => setShowWoundModal(true)}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Create Wound Modal */}
      <Modal visible={showWoundModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowWoundModal(false)}><Text className="text-base text-gray-500">取消</Text></TouchableOpacity>
            <Text className="text-base font-semibold">新增傷口記錄</Text>
            <TouchableOpacity onPress={handleSaveWound} disabled={createWound.isPending}>
              {createWound.isPending ? <ActivityIndicator size="small" color="#ef4444" /> : <Text className="text-base font-semibold text-red-500">儲存</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
            <Text className="text-sm font-medium text-gray-700 mb-1">傷口編號 *</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={woundForm.wound_code} onChangeText={v => setWoundForm(f => ({ ...f, wound_code: v }))} placeholder="如：W001" />
            <Text className="text-sm font-medium text-gray-700 mb-1">傷口名稱</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={woundForm.wound_name} onChangeText={v => setWoundForm(f => ({ ...f, wound_name: v }))} placeholder="傷口名稱（可選）" />
            <Text className="text-sm font-medium text-gray-700 mb-1">傷口類型</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {(Object.entries(WOUND_TYPE_LABEL) as [string, string][]).map(([key, label]) => (
                <TouchableOpacity key={key} onPress={() => setWoundForm(f => ({ ...f, wound_type: key }))}
                  className="px-3 py-2 rounded-xl border"
                  style={{ backgroundColor: woundForm.wound_type === key ? '#ef4444' : 'white', borderColor: woundForm.wound_type === key ? '#ef4444' : '#e5e7eb' }}>
                  <Text style={{ color: woundForm.wound_type === key ? 'white' : '#374151', fontSize: 13 }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text className="text-sm font-medium text-gray-700 mb-1">傷口來源</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {(Object.entries(WOUND_ORIGIN_LABEL) as [string, string][]).map(([key, label]) => (
                <TouchableOpacity key={key} onPress={() => setWoundForm(f => ({ ...f, wound_origin: key }))}
                  className="px-3 py-2 rounded-xl border"
                  style={{ backgroundColor: woundForm.wound_origin === key ? '#ef4444' : 'white', borderColor: woundForm.wound_origin === key ? '#ef4444' : '#e5e7eb' }}>
                  <Text style={{ color: woundForm.wound_origin === key ? 'white' : '#374151', fontSize: 13 }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text className="text-sm font-medium text-gray-700 mb-1">傀口來源</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {RESPONSIBLE_UNIT_OPTIONS.map(([key, label]) => (
                <TouchableOpacity key={key} onPress={() => setWoundForm(f => ({ ...f, responsible_unit: key }))}
                  className="px-3 py-2 rounded-xl border"
                  style={{ backgroundColor: woundForm.responsible_unit === key ? '#ef4444' : 'white', borderColor: woundForm.responsible_unit === key ? '#ef4444' : '#e5e7eb' }}>
                  <Text style={{ color: woundForm.responsible_unit === key ? 'white' : '#374151', fontSize: 13 }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text className="text-sm font-medium text-gray-700 mb-1">發現日期</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={woundForm.discovery_date} onChangeText={v => setWoundForm(f => ({ ...f, discovery_date: v }))} placeholder="YYYY-MM-DD" />
            <Text className="text-sm font-medium text-gray-700 mb-1">下次評估日期</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={woundForm.next_assessment_due} onChangeText={v => setWoundForm(f => ({ ...f, next_assessment_due: v }))} placeholder="YYYY-MM-DD（可選）" />
            <Text className="text-sm font-medium text-gray-700 mb-1">備註</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-8" value={woundForm.remarks} onChangeText={v => setWoundForm(f => ({ ...f, remarks: v }))} placeholder="備註（可選）" multiline numberOfLines={3} textAlignVertical="top" style={{ minHeight: 80 }} />
          </ScrollView>
        </View>
      </Modal>

      {/* Add Assessment Modal */}
      <Modal visible={!!showAssessModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowAssessModal(null)}><Text className="text-base text-gray-500">取消</Text></TouchableOpacity>
            <Text className="text-base font-semibold">新增傷口評估</Text>
            <TouchableOpacity onPress={handleSaveAssessment} disabled={createAssessment.isPending}>
              {createAssessment.isPending ? <ActivityIndicator size="small" color="#ef4444" /> : <Text className="text-base font-semibold text-red-500">儲存</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
            <Text className="text-sm font-medium text-gray-700 mb-1">評估日期</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={assessForm.assessment_date} onChangeText={v => setAssessForm(f => ({ ...f, assessment_date: v }))} placeholder="YYYY-MM-DD" />
            <Text className="text-sm font-medium text-gray-700 mb-1">下次評估日期</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={assessForm.next_assessment_date} onChangeText={v => setAssessForm(f => ({ ...f, next_assessment_date: v }))} placeholder="YYYY-MM-DD（可選）" />
            <Text className="text-sm font-medium text-gray-700 mb-1">評估者</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={assessForm.assessor} onChangeText={v => setAssessForm(f => ({ ...f, assessor: v }))} placeholder="評估者姓名（可選）" />
            <Text className="text-sm font-medium text-gray-700 mb-1">傷口狀態</Text>
            <View className="flex-row flex-wrap gap-2 mb-4">
              {(Object.entries(ASSESSMENT_STATUS_LABEL) as [string, string][]).map(([key, label]) => (
                <TouchableOpacity key={key} onPress={() => setAssessForm(f => ({ ...f, wound_status: key }))}
                  className="px-3 py-2 rounded-xl border"
                  style={{ backgroundColor: assessForm.wound_status === key ? '#ef4444' : 'white', borderColor: assessForm.wound_status === key ? '#ef4444' : '#e5e7eb' }}>
                  <Text style={{ color: assessForm.wound_status === key ? 'white' : '#374151', fontSize: 13 }}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1"><Text className="text-sm font-medium text-gray-700 mb-1">長 (cm)</Text><TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base" value={assessForm.area_length} onChangeText={v => setAssessForm(f => ({ ...f, area_length: v }))} keyboardType="decimal-pad" placeholder="0.0" /></View>
              <View className="flex-1"><Text className="text-sm font-medium text-gray-700 mb-1">寬 (cm)</Text><TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base" value={assessForm.area_width} onChangeText={v => setAssessForm(f => ({ ...f, area_width: v }))} keyboardType="decimal-pad" placeholder="0.0" /></View>
              <View className="flex-1"><Text className="text-sm font-medium text-gray-700 mb-1">深 (cm)</Text><TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base" value={assessForm.area_depth} onChangeText={v => setAssessForm(f => ({ ...f, area_depth: v }))} keyboardType="decimal-pad" placeholder="0.0" /></View>
            </View>
            <Text className="text-sm font-medium text-gray-700 mb-1">感染情況</Text>
            <View className="flex-row gap-2 mb-4">
              {INFECTION_OPTIONS.map(opt => (
                <TouchableOpacity key={opt} onPress={() => setAssessForm(f => ({ ...f, infection: opt }))}
                  className="flex-1 py-2.5 rounded-xl border items-center"
                  style={{ backgroundColor: assessForm.infection === opt ? '#ef4444' : 'white', borderColor: assessForm.infection === opt ? '#ef4444' : '#e5e7eb' }}>
                  <Text style={{ color: assessForm.infection === opt ? 'white' : '#374151', fontSize: 13, fontWeight: '600' }}>{opt}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text className="text-sm font-medium text-gray-700 mb-1">備註</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-8" value={assessForm.remarks} onChangeText={v => setAssessForm(f => ({ ...f, remarks: v }))} placeholder="備註（可選）" multiline numberOfLines={3} textAlignVertical="top" style={{ minHeight: 80 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
