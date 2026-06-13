import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, TextInput, Alert, Switch,
} from 'react-native';
import { useLocalSearchParams, Stack, router } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useResident } from '@/features/residents/useResidents';
import {
  usePatrolRounds, useDiaperRecords,
  usePositionRecords, useHygieneRecords,
  useCreatePatrolRound, useDeletePatrolRound,
  useCreateDiaperRecord, useDeleteDiaperRecord,
  useCreatePositionRecord, useDeletePositionRecord,
  useCreateHygieneRecord, useDeleteHygieneRecord,
} from '@/features/care-records/useCareRecords';
import {
  CARE_TABS, TIME_SLOTS, DIAPER_SLOTS,
  type CareTabType, type PatrolRound,
  type DiaperChangeRecord, type PositionChangeRecord, type HygieneRecord,
} from '@/features/care-records/types';

// ─── helpers ───────────────────────────────────────────────
function formatDate(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}
function today() { return formatDate(new Date()); }
function displayDate(s: string) {
  const d = new Date(s + 'T00:00:00');
  const weekdays = ['日','一','二','三','四','五','六'];
  return `${d.getMonth()+1}/${d.getDate()} (${weekdays[d.getDay()]})`;
}
function shiftDate(s: string, delta: number) {
  const d = new Date(s + 'T00:00:00');
  d.setDate(d.getDate() + delta);
  return formatDate(d);
}

// ─── Sub-components ─────────────────────────────────────────

function StatusDot({ filled }: { filled: boolean }) {
  return (
    <View className={`w-2.5 h-2.5 rounded-full ${filled ? 'bg-green-500' : 'bg-gray-200'}`} />
  );
}

function SlotRow({ slot, filled, content }: { slot: string; filled: boolean; content?: React.ReactNode }) {
  return (
    <View className={`flex-row items-start px-4 py-3 border-b border-gray-50 ${filled ? 'bg-white' : 'bg-gray-50/50'}`}>
      <Text className="w-16 text-xs text-gray-400 pt-0.5">{slot}</Text>
      <StatusDot filled={filled} />
      <View className="flex-1 ml-3">{content ?? (filled ? null : <Text className="text-xs text-gray-300">—</Text>)}</View>
    </View>
  );
}

// ─── Patrol tab ─────────────────────────────────────────────
function PatrolTab({ patientId, date }: { patientId: number; date: string }) {
  const { data, isLoading } = usePatrolRounds(patientId, date);
  const bySlot = new Map((data ?? []).map(r => [r.scheduled_time, r]));

  if (isLoading) return <LoadingView />;
  return (
    <ScrollView>
      {TIME_SLOTS.map(slot => {
        const r = bySlot.get(slot);
        return (
          <SlotRow key={slot} slot={slot} filled={!!r}
            content={r ? (
              <View>
                <Text className="text-sm text-gray-800 font-medium">{r.patrol_time}</Text>
                <Text className="text-xs text-gray-500 mt-0.5">記錄員：{r.recorder}{r.co_signer ? ` / ${r.co_signer}` : ''}</Text>
                {r.notes ? <Text className="text-xs text-gray-400 mt-0.5">{r.notes}</Text> : null}
              </View>
            ) : undefined}
          />
        );
      })}
      <View className="h-8" />
    </ScrollView>
  );
}

// ─── Diaper tab ─────────────────────────────────────────────
const DIAPER_ICONS: Record<string, string> = { urine: '💛', stool: '🟤', none: '—' };
function DiaperTab({ patientId, date }: { patientId: number; date: string }) {
  const { data, isLoading } = useDiaperRecords(patientId, date);
  const bySlot = new Map((data ?? []).map(r => [r.time_slot, r]));

  if (isLoading) return <LoadingView />;
  return (
    <ScrollView>
      {DIAPER_SLOTS.map(slot => {
        const r = bySlot.get(slot);
        return (
          <SlotRow key={slot} slot={slot} filled={!!r}
            content={r ? (
              <View className="flex-row flex-wrap gap-2">
                {r.has_urine && (
                  <View className="bg-yellow-50 border border-yellow-200 px-2 py-0.5 rounded-full">
                    <Text className="text-xs text-yellow-700">尿 {r.urine_amount ?? ''}</Text>
                  </View>
                )}
                {r.has_stool && (
                  <View className="bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                    <Text className="text-xs text-amber-700">大便 {r.stool_amount ?? ''}{r.stool_color ? ` ${r.stool_color}` : ''}</Text>
                  </View>
                )}
                {r.has_none && (
                  <View className="bg-gray-100 px-2 py-0.5 rounded-full">
                    <Text className="text-xs text-gray-500">清潔</Text>
                  </View>
                )}
                {r.notes ? <Text className="text-xs text-gray-400 w-full">{r.notes}</Text> : null}
              </View>
            ) : undefined}
          />
        );
      })}
      <View className="h-8" />
    </ScrollView>
  );
}

// ─── Position tab ────────────────────────────────────────────
const POSITION_COLORS: Record<string, string> = { '左': '#3b82f6', '平': '#6b7280', '右': '#8b5cf6' };
function PositionTab({ patientId, date }: { patientId: number; date: string }) {
  const { data, isLoading } = usePositionRecords(patientId, date);
  const bySlot = new Map((data ?? []).map(r => [r.scheduled_time, r]));

  if (isLoading) return <LoadingView />;
  return (
    <ScrollView>
      {TIME_SLOTS.map(slot => {
        const r = bySlot.get(slot);
        const color = r ? POSITION_COLORS[r.position] ?? '#6b7280' : undefined;
        return (
          <SlotRow key={slot} slot={slot} filled={!!r}
            content={r ? (
              <View className="flex-row items-center gap-2">
                <View className="w-8 h-8 rounded-lg items-center justify-center" style={{ backgroundColor: color + '20' }}>
                  <Text className="text-sm font-bold" style={{ color }}>{r.position}</Text>
                </View>
                <Text className="text-xs text-gray-500">{r.recorder}</Text>
                {r.notes ? <Text className="text-xs text-gray-400">{r.notes}</Text> : null}
              </View>
            ) : undefined}
          />
        );
      })}
      <View className="h-8" />
    </ScrollView>
  );
}

// ─── Hygiene tab ─────────────────────────────────────────────
const HYGIENE_LABELS: [keyof HygieneRecord, string][] = [
  ['has_bath','沐浴'], ['has_face_wash','洗臉'], ['has_shave','剃鬚'],
  ['has_oral_care','口腔護理'], ['has_denture_care','假牙護理'],
  ['has_nail_trim','剪甲'], ['has_bedding_change','換被褥'],
  ['has_sheet_pillow_change','換床單枕袋'], ['has_cup_wash','洗杯'],
  ['has_bedside_cabinet','床頭櫃'], ['has_wardrobe','衣櫃'],
];
function HygieneTab({ patientId, date }: { patientId: number; date: string }) {
  const { data, isLoading } = useHygieneRecords(patientId, date);
  const record = data?.[0];

  if (isLoading) return <LoadingView />;
  if (!record) {
    return (
      <View className="flex-1 items-center justify-center py-16">
        <Ionicons name="medical-outline" size={40} color="#d1d5db" />
        <Text className="mt-3 text-gray-400 text-sm">今日暫無衛生記錄</Text>
      </View>
    );
  }
  return (
    <ScrollView contentContainerStyle={{ paddingBottom: 32 }}>
      {record.status_notes ? (
        <View className="bg-amber-50 mx-4 mt-4 p-3 rounded-xl border border-amber-200">
          <Text className="text-sm text-amber-800">{record.status_notes}</Text>
        </View>
      ) : null}

      <View className="bg-white mx-4 mt-3 rounded-xl overflow-hidden">
        {HYGIENE_LABELS.map(([key, label]) => (
          <View key={key} className="flex-row items-center px-4 py-2.5 border-b border-gray-50">
            <Text className="flex-1 text-sm text-gray-700">{label}</Text>
            {record[key] ? (
              <Ionicons name="checkmark-circle" size={20} color="#22c55e" />
            ) : (
              <Ionicons name="ellipse-outline" size={20} color="#d1d5db" />
            )}
          </View>
        ))}
      </View>

      {/* 大便記錄 */}
      {(record.bowel_count != null || record.bowel_amount || record.bowel_consistency) && (
        <View className="bg-white mx-4 mt-3 rounded-xl px-4 py-3">
          <Text className="text-xs font-semibold text-gray-400 uppercase mb-2">大便記錄</Text>
          {record.bowel_count != null && <Text className="text-sm text-gray-700">次數：{record.bowel_count}</Text>}
          {record.bowel_amount && <Text className="text-sm text-gray-700 mt-1">份量：{record.bowel_amount}</Text>}
          {record.bowel_consistency && <Text className="text-sm text-gray-700 mt-1">性狀：{record.bowel_consistency}</Text>}
          {record.bowel_medication && <Text className="text-sm text-gray-700 mt-1">通便藥：{record.bowel_medication}</Text>}
        </View>
      )}

      <View className="mx-4 mt-2">
        <Text className="text-xs text-gray-400">記錄員：{record.recorder}</Text>
      </View>
    </ScrollView>
  );
}

function LoadingView() {
  return (
    <View className="flex-1 items-center justify-center py-12">
      <ActivityIndicator color="#2563eb" />
    </View>
  );
}

// ─── Main screen ─────────────────────────────────────────────
export default function CareRecordDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const patientId = Number(id);
  const [date, setDate] = useState(today());
  const [activeTab, setActiveTab] = useState<CareTabType>('patrol');
  const [showModal, setShowModal] = useState(false);
  const queryClient = useQueryClient();

  const { data: resident } = useResident(patientId);
  const isToday = date === today();

  // Mutations
  const createPatrol = useCreatePatrolRound();
  const createDiaper = useCreateDiaperRecord();
  const createPosition = useCreatePositionRecord();
  const createHygiene = useCreateHygieneRecord();

  // Form states
  const [patrolForm, setPatrolForm] = useState({ scheduled_time: TIME_SLOTS[0], patrol_time: new Date().toTimeString().slice(0, 5), recorder: '', notes: '' });
  const [diaperForm, setDiaperForm] = useState({ time_slot: DIAPER_SLOTS[0], has_urine: false, has_stool: false, has_none: false, recorder: '', notes: '' });
  const [positionForm, setPositionForm] = useState({ scheduled_time: TIME_SLOTS[0], position: '平' as '左'|'平'|'右', recorder: '', notes: '' });
  const [hygieneForm, setHygieneForm] = useState({ has_bath: false, has_face_wash: false, has_shave: false, has_oral_care: false, has_denture_care: false, has_nail_trim: false, has_bedding_change: false, has_sheet_pillow_change: false, recorder: '', bowel_count: '' });

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['patrol-rounds', patientId, date] });
    queryClient.invalidateQueries({ queryKey: ['diaper-records', patientId, date] });
    queryClient.invalidateQueries({ queryKey: ['position-records', patientId, date] });
    queryClient.invalidateQueries({ queryKey: ['hygiene-records', patientId, date] });
  }, [patientId, date, queryClient]);

  async function handleSave() {
    if (activeTab === 'patrol') {
      if (!patrolForm.recorder) { Alert.alert('提示', '請輸入記錄員'); return; }
      await createPatrol.mutateAsync({ patient_id: patientId, patrol_date: date, patrol_time: patrolForm.patrol_time, scheduled_time: patrolForm.scheduled_time, recorder: patrolForm.recorder, notes: patrolForm.notes || undefined });
    } else if (activeTab === 'diaper') {
      if (!diaperForm.recorder) { Alert.alert('提示', '請輸入記錄員'); return; }
      await createDiaper.mutateAsync({ patient_id: patientId, change_date: date, time_slot: diaperForm.time_slot, has_urine: diaperForm.has_urine, has_stool: diaperForm.has_stool, has_none: diaperForm.has_none, recorder: diaperForm.recorder, notes: diaperForm.notes || undefined });
    } else if (activeTab === 'position') {
      if (!positionForm.recorder) { Alert.alert('提示', '請輸入記錄員'); return; }
      await createPosition.mutateAsync({ patient_id: patientId, change_date: date, scheduled_time: positionForm.scheduled_time, position: positionForm.position, recorder: positionForm.recorder, notes: positionForm.notes || undefined });
    } else {
      if (!hygieneForm.recorder) { Alert.alert('提示', '請輸入記錄員'); return; }
      await createHygiene.mutateAsync({ patient_id: patientId, record_date: date, recorder: hygieneForm.recorder, bowel_count: hygieneForm.bowel_count ? Number(hygieneForm.bowel_count) : null, has_bath: hygieneForm.has_bath, has_face_wash: hygieneForm.has_face_wash, has_shave: hygieneForm.has_shave, has_oral_care: hygieneForm.has_oral_care, has_denture_care: hygieneForm.has_denture_care, has_nail_trim: hygieneForm.has_nail_trim, has_bedding_change: hygieneForm.has_bedding_change, has_sheet_pillow_change: hygieneForm.has_sheet_pillow_change, has_cup_wash: false, has_bedside_cabinet: false, has_wardrobe: false, bowel_amount: null, bowel_consistency: null, bowel_medication: null });
    }
    setShowModal(false);
  }

  const isPending = createPatrol.isPending || createDiaper.isPending || createPosition.isPending || createHygiene.isPending;

  return (
    <>
      <Stack.Screen options={{ title: resident ? `${resident.中文姓名} 護理記錄` : '護理記錄' }} />
      <View className="flex-1 bg-gray-50">

        {/* Date navigator */}
        <View className="bg-white flex-row items-center justify-between px-4 py-2 border-b border-gray-100">
          <TouchableOpacity onPress={() => setDate(d => shiftDate(d, -1))} className="p-2">
            <Ionicons name="chevron-back" size={20} color="#2563eb" />
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDate(today())} activeOpacity={0.7}>
            <Text className={`text-base font-semibold ${isToday ? 'text-blue-600' : 'text-gray-800'}`}>
              {isToday ? '今天 ' : ''}{displayDate(date)}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDate(d => shiftDate(d, 1))} disabled={isToday} className="p-2">
            <Ionicons name="chevron-forward" size={20} color={isToday ? '#d1d5db' : '#2563eb'} />
          </TouchableOpacity>
        </View>

        {/* Tab bar */}
        <View className="bg-white flex-row border-b border-gray-100">
          {CARE_TABS.map(tab => (
            <TouchableOpacity key={tab.key} onPress={() => setActiveTab(tab.key)} className="flex-1 items-center py-2.5">
              <Ionicons name={tab.icon as any} size={18} color={activeTab === tab.key ? '#2563eb' : '#9ca3af'} />
              <Text className={`text-xs mt-0.5 font-medium ${activeTab === tab.key ? 'text-blue-600' : 'text-gray-400'}`}>{tab.label}</Text>
              {activeTab === tab.key && <View className="absolute bottom-0 left-4 right-4 h-0.5 bg-blue-600 rounded-full" />}
            </TouchableOpacity>
          ))}
        </View>

        {/* Tab content */}
        <View className="flex-1">
          {activeTab === 'patrol'   && <PatrolTab   patientId={patientId} date={date} />}
          {activeTab === 'diaper'   && <DiaperTab   patientId={patientId} date={date} />}
          {activeTab === 'position' && <PositionTab patientId={patientId} date={date} />}
          {activeTab === 'hygiene'  && <HygieneTab  patientId={patientId} date={date} />}
        </View>

        {/* FAB */}
        <TouchableOpacity
          className="absolute bottom-8 right-6 w-14 h-14 bg-blue-500 rounded-full items-center justify-center shadow-lg"
          style={{ elevation: 6 }}
          onPress={() => setShowModal(true)}
        >
          <Ionicons name="add" size={28} color="white" />
        </TouchableOpacity>
      </View>

      {/* Create Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowModal(false)}><Text className="text-base text-gray-500">取消</Text></TouchableOpacity>
            <Text className="text-base font-semibold">新增{CARE_TABS.find(t => t.key === activeTab)?.label}</Text>
            <TouchableOpacity onPress={handleSave} disabled={isPending}>
              {isPending ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text className="text-base font-semibold text-blue-500">儲存</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">

            {activeTab === 'patrol' && (<>
              <Text className="text-sm font-medium text-gray-700 mb-1">時間段</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {TIME_SLOTS.map(s => (
                  <TouchableOpacity key={s} onPress={() => setPatrolForm(f => ({ ...f, scheduled_time: s }))}
                    className="px-3 py-2 rounded-xl border"
                    style={{ backgroundColor: patrolForm.scheduled_time === s ? '#3b82f6' : 'white', borderColor: patrolForm.scheduled_time === s ? '#3b82f6' : '#e5e7eb' }}>
                    <Text style={{ color: patrolForm.scheduled_time === s ? 'white' : '#374151', fontSize: 13 }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text className="text-sm font-medium text-gray-700 mb-1">實際時間</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={patrolForm.patrol_time} onChangeText={v => setPatrolForm(f => ({ ...f, patrol_time: v }))} placeholder="HH:MM" />
              <Text className="text-sm font-medium text-gray-700 mb-1">記錄員 *</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={patrolForm.recorder} onChangeText={v => setPatrolForm(f => ({ ...f, recorder: v }))} placeholder="記錄員姓名" />
              <Text className="text-sm font-medium text-gray-700 mb-1">備註</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-8" value={patrolForm.notes} onChangeText={v => setPatrolForm(f => ({ ...f, notes: v }))} placeholder="備註（可選）" multiline numberOfLines={3} textAlignVertical="top" style={{ minHeight: 72 }} />
            </>)}

            {activeTab === 'diaper' && (<>
              <Text className="text-sm font-medium text-gray-700 mb-1">更換時段</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {DIAPER_SLOTS.map(s => (
                  <TouchableOpacity key={s} onPress={() => setDiaperForm(f => ({ ...f, time_slot: s }))}
                    className="px-3 py-2 rounded-xl border"
                    style={{ backgroundColor: diaperForm.time_slot === s ? '#3b82f6' : 'white', borderColor: diaperForm.time_slot === s ? '#3b82f6' : '#e5e7eb' }}>
                    <Text style={{ color: diaperForm.time_slot === s ? 'white' : '#374151', fontSize: 13 }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <View className="flex-row gap-4 mb-4">
                {([['has_urine', '有尿'], ['has_stool', '有便'], ['has_none', '乾淨']] as const).map(([key, label]) => (
                  <View key={key} className="flex-row items-center gap-2">
                    <Switch value={diaperForm[key]} onValueChange={v => setDiaperForm(f => ({ ...f, [key]: v }))} />
                    <Text className="text-sm text-gray-700">{label}</Text>
                  </View>
                ))}
              </View>
              <Text className="text-sm font-medium text-gray-700 mb-1">記錄員 *</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-8" value={diaperForm.recorder} onChangeText={v => setDiaperForm(f => ({ ...f, recorder: v }))} placeholder="記錄員姓名" />
            </>)}

            {activeTab === 'position' && (<>
              <Text className="text-sm font-medium text-gray-700 mb-1">時間段</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {TIME_SLOTS.map(s => (
                  <TouchableOpacity key={s} onPress={() => setPositionForm(f => ({ ...f, scheduled_time: s }))}
                    className="px-3 py-2 rounded-xl border"
                    style={{ backgroundColor: positionForm.scheduled_time === s ? '#3b82f6' : 'white', borderColor: positionForm.scheduled_time === s ? '#3b82f6' : '#e5e7eb' }}>
                    <Text style={{ color: positionForm.scheduled_time === s ? 'white' : '#374151', fontSize: 13 }}>{s}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text className="text-sm font-medium text-gray-700 mb-1">姿勢</Text>
              <View className="flex-row gap-3 mb-4">
                {(['左', '平', '右'] as const).map(p => (
                  <TouchableOpacity key={p} onPress={() => setPositionForm(f => ({ ...f, position: p }))}
                    className="flex-1 py-3 rounded-xl border items-center"
                    style={{ backgroundColor: positionForm.position === p ? '#3b82f6' : 'white', borderColor: positionForm.position === p ? '#3b82f6' : '#e5e7eb' }}>
                    <Text style={{ color: positionForm.position === p ? 'white' : '#374151', fontSize: 15, fontWeight: '600' }}>{p}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text className="text-sm font-medium text-gray-700 mb-1">記錄員 *</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={positionForm.recorder} onChangeText={v => setPositionForm(f => ({ ...f, recorder: v }))} placeholder="記錄員姓名" />
              <Text className="text-sm font-medium text-gray-700 mb-1">備註</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-8" value={positionForm.notes} onChangeText={v => setPositionForm(f => ({ ...f, notes: v }))} placeholder="備註（可選）" multiline numberOfLines={3} textAlignVertical="top" style={{ minHeight: 72 }} />
            </>)}

            {activeTab === 'hygiene' && (<>
              {([
                ['has_bath', '洗澡'], ['has_face_wash', '洗臉'], ['has_shave', '剃鬚'],
                ['has_oral_care', '口腔護理'], ['has_denture_care', '假牙護理'], ['has_nail_trim', '修甲'],
                ['has_bedding_change', '換床品'], ['has_sheet_pillow_change', '換床單枕套'],
              ] as const).map(([key, label]) => (
                <View key={key} className="flex-row items-center justify-between bg-white rounded-xl px-4 py-3 mb-2 border border-gray-100">
                  <Text className="text-base text-gray-700">{label}</Text>
                  <Switch value={hygieneForm[key]} onValueChange={v => setHygieneForm(f => ({ ...f, [key]: v }))} />
                </View>
              ))}
              <Text className="text-sm font-medium text-gray-700 mb-1 mt-2">大便次數</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={hygieneForm.bowel_count} onChangeText={v => setHygieneForm(f => ({ ...f, bowel_count: v }))} keyboardType="numeric" placeholder="0" />
              <Text className="text-sm font-medium text-gray-700 mb-1">記錄員 *</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-8" value={hygieneForm.recorder} onChangeText={v => setHygieneForm(f => ({ ...f, recorder: v }))} placeholder="記錄員姓名" />
            </>)}

          </ScrollView>
        </View>
      </Modal>
    </>
  );
}
