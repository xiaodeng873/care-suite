import { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResidents } from '@/features/residents/useResidents';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';
import {
  useVmoSchedulesInfinite, useReasons, useCreateSchedule, useDeleteSchedule,
  useAddPatientToSchedule, useRemovePatientFromSchedule,
  type ScheduleWithDetails,
} from '@/features/vmo-visits/useVmoVisits';

const WEEKDAYS = ['日', '一', '二', '三', '四', '五', '六'];

/** 相對日期資訊：用於日期模塊的視覺區分，避免混淆日子 */
function relativeDayInfo(dateStr: string) {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const d = new Date(dateStr + 'T00:00:00');
  const diff = Math.round((d.getTime() - today.getTime()) / 86400000);
  let label: string;
  if (diff === 0) label = '今天';
  else if (diff === 1) label = '明天';
  else if (diff === 2) label = '後天';
  else if (diff === -1) label = '昨天';
  else if (diff > 0) label = `${diff} 天後`;
  else label = `${Math.abs(diff)} 天前`;
  return { diff, label, isToday: diff === 0, isPast: diff < 0 };
}

/** 依相對日期決定模塊配色 */
function moduleTone(diff: number) {
  if (diff === 0) return { accent: '#2563eb', band: '#eff6ff', badge: '#2563eb', badgeText: '#ffffff' };
  if (diff > 0) return { accent: '#0ea5e9', band: '#f0f9ff', badge: '#e0f2fe', badgeText: '#0369a1' };
  return { accent: '#9ca3af', band: '#f9fafb', badge: '#f3f4f6', badgeText: '#6b7280' };
}

type AddPatientForm = {
  patient_id: number | null;
  症狀說明: string;
  備註: string;
  原因ids: number[];
};

const EMPTY_PATIENT_FORM: AddPatientForm = {
  patient_id: null,
  症狀說明: '',
  備註: '',
  原因ids: [],
};

export default function VmoVisitsScreen() {
  const { data: residents = [] } = useResidents();
  const {
    data, isLoading, refetch,
    fetchNextPage, hasNextPage, isFetchingNextPage,
  } = useVmoSchedulesInfinite();
  const { data: reasonOptions = [] } = useReasons();
  const createSchedule = useCreateSchedule();
  const deleteSchedule = useDeleteSchedule();
  const addPatient = useAddPatientToSchedule();
  const removePatient = useRemovePatientFromSchedule();

  const [search, setSearch] = useState('');
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [showAddPatientModal, setShowAddPatientModal] = useState(false);
  const [selectedSchedule, setSelectedSchedule] = useState<ScheduleWithDetails | null>(null);
  const [newDate, setNewDate] = useState(new Date().toISOString().split('T')[0]);
  const [patientForm, setPatientForm] = useState<AddPatientForm>(EMPTY_PATIENT_FORM);

  const schedules = useMemo<ScheduleWithDetails[]>(
    () => data?.pages.flatMap(p => p.items) ?? [],
    [data]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return schedules;
    return schedules.filter(s => {
      if (s.到診日期.includes(q)) return true;
      return s.院友列表?.some(d => {
        const p = residents.find(r => r.院友id === d.院友id);
        return p?.中文姓名.includes(q) || p?.床號?.includes(q) ||
          (d.症狀說明 ?? '').toLowerCase().includes(q) ||
          (d.備註 ?? '').toLowerCase().includes(q) ||
          (d.reasons ?? []).some(rs => rs.原因名稱.toLowerCase().includes(q));
      });
    });
  }, [schedules, residents, search]);

  async function handleCreateSchedule() {
    if (!newDate) { Alert.alert('提示', '請選擇到診日期'); return; }
    try {
      await createSchedule.mutateAsync({ 到診日期: newDate });
      setShowCreateModal(false);
      setNewDate(new Date().toISOString().split('T')[0]);
    } catch (e: any) { Alert.alert('儲存失敗', e?.message ?? '請重試'); }
  }

  function toggleReason(id: number) {
    setPatientForm(f => ({
      ...f,
      原因ids: f.原因ids.includes(id) ? f.原因ids.filter(x => x !== id) : [...f.原因ids, id],
    }));
  }

  async function handleAddPatient() {
    if (!patientForm.patient_id || !selectedSchedule) { Alert.alert('提示', '請選擇院友'); return; }
    if (selectedSchedule.院友列表?.some(d => d.院友id === patientForm.patient_id)) {
      Alert.alert('提示', '此院友已在排程中'); return;
    }
    try {
      await addPatient.mutateAsync({
        排程id: selectedSchedule.排程id,
        院友id: patientForm.patient_id,
        症狀說明: patientForm.症狀說明,
        備註: patientForm.備註,
        原因ids: patientForm.原因ids,
      });
      setShowAddPatientModal(false);
      setPatientForm(EMPTY_PATIENT_FORM);
    } catch (e: any) { Alert.alert('儲存失敗', e?.message ?? '請重試'); }
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput
            style={{ flex: 1, marginLeft: 8, fontSize: 16, color: '#1f2937' }}
            placeholder="搜尋到診日期、院友、症狀或原因..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
          {search ? (
            <TouchableOpacity onPress={() => setSearch('')} hitSlop={8}>
              <Ionicons name="close-circle" size={18} color="#9ca3af" />
            </TouchableOpacity>
          ) : null}
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} size="large" color="#3b82f6" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => String(item.排程id)}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          onEndReachedThreshold={0.4}
          onEndReached={() => { if (hasNextPage && !isFetchingNextPage && !search) fetchNextPage(); }}
          renderItem={({ item: schedule }) => {
            const info = relativeDayInfo(schedule.到診日期);
            const tone = moduleTone(info.diff);
            const count = schedule.院友列表?.length ?? 0;
            const d = new Date(schedule.到診日期 + 'T00:00:00');
            return (
              <View
                style={{
                  backgroundColor: 'white', borderRadius: 14, marginBottom: 16, overflow: 'hidden',
                  borderLeftWidth: 4, borderLeftColor: tone.accent,
                  shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 6, elevation: 2,
                  opacity: info.isPast ? 0.85 : 1,
                }}
              >
                {/* 日期模塊標題帶 */}
                <View style={{ backgroundColor: tone.band, paddingHorizontal: 16, paddingVertical: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12 }}>
                    <View style={{ alignItems: 'center', minWidth: 44 }}>
                      <Text style={{ fontSize: 22, fontWeight: '800', color: tone.accent, lineHeight: 26 }}>
                        {String(d.getDate()).padStart(2, '0')}
                      </Text>
                      <Text style={{ fontSize: 11, color: '#6b7280' }}>
                        {d.getFullYear()}/{String(d.getMonth() + 1).padStart(2, '0')}
                      </Text>
                    </View>
                    <View>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                        <Text style={{ fontSize: 15, fontWeight: '700', color: '#111827' }}>星期{WEEKDAYS[d.getDay()]}</Text>
                        <View style={{ backgroundColor: tone.badge, paddingHorizontal: 8, paddingVertical: 2, borderRadius: 999 }}>
                          <Text style={{ fontSize: 11, fontWeight: '700', color: tone.badgeText }}>{info.label}</Text>
                        </View>
                      </View>
                      <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>{count} 位院友</Text>
                    </View>
                  </View>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <TouchableOpacity
                      onPress={() => { setSelectedSchedule(schedule); setPatientForm(EMPTY_PATIENT_FORM); setShowAddPatientModal(true); }}
                      style={{ flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 10, paddingVertical: 6, borderRadius: 8, backgroundColor: 'white', borderWidth: 1, borderColor: tone.accent }}
                    >
                      <Ionicons name="person-add-outline" size={16} color={tone.accent} />
                      <Text style={{ fontSize: 13, fontWeight: '600', color: tone.accent }}>加院友</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => Alert.alert('確認刪除', `確定刪除 ${schedule.到診日期} 的排程？`, [
                        { text: '取消', style: 'cancel' },
                        { text: '刪除', style: 'destructive', onPress: () => deleteSchedule.mutate(schedule.排程id) },
                      ])}
                      style={{ padding: 6 }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>

                {/* 院友列表 */}
                {count === 0 ? (
                  <Text style={{ fontSize: 13, color: '#9ca3af', paddingHorizontal: 16, paddingVertical: 14 }}>尚未加入院友</Text>
                ) : (
                  schedule.院友列表.map((detail, idx) => {
                    const patient = residents.find(r => r.院友id === detail.院友id);
                    return (
                      <View key={detail.細項id} style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, borderTopWidth: idx === 0 ? 0 : 1, borderTopColor: '#f3f4f6' }}>
                        <View style={{ flex: 1 }}>
                          {patient && <Text style={{ fontSize: 14, fontWeight: '600', color: '#374151' }}>{patient.床號} {patient.中文姓名}</Text>}
                          {detail.reasons && detail.reasons.length > 0 && (
                            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                              {detail.reasons.map(r => (
                                <View key={r.原因id} style={{ backgroundColor: '#eef2ff', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 6 }}>
                                  <Text style={{ fontSize: 11, color: '#4338ca' }}>{r.原因名稱}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                          {detail.症狀說明 ? <Text style={{ fontSize: 12, color: '#6b7280', marginTop: 4 }}>症狀：{detail.症狀說明}</Text> : null}
                          {detail.備註 ? <Text style={{ fontSize: 12, color: '#9ca3af', marginTop: 2 }}>備註：{detail.備註}</Text> : null}
                        </View>
                        <TouchableOpacity
                          onPress={() => Alert.alert('確認移除', '確定從排程移除此院友？', [
                            { text: '取消', style: 'cancel' },
                            { text: '移除', style: 'destructive', onPress: () => removePatient.mutate(detail.細項id) },
                          ])}
                          style={{ padding: 4 }}
                        >
                          <Ionicons name="close-circle-outline" size={18} color="#9ca3af" />
                        </TouchableOpacity>
                      </View>
                    );
                  })
                )}
              </View>
            );
          }}
          ListFooterComponent={
            isFetchingNextPage ? (
              <ActivityIndicator style={{ marginVertical: 16 }} size="small" color="#3b82f6" />
            ) : hasNextPage && !search ? (
              <TouchableOpacity onPress={() => fetchNextPage()} style={{ alignItems: 'center', paddingVertical: 14 }}>
                <Text style={{ fontSize: 13, color: '#3b82f6' }}>載入更早的排程</Text>
              </TouchableOpacity>
            ) : schedules.length > 0 && !search ? (
              <Text style={{ textAlign: 'center', color: '#d1d5db', fontSize: 12, paddingVertical: 16 }}>已無更早的記錄</Text>
            ) : null
          }
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: '#9ca3af', marginTop: 64 }}>暫無VMO排程記錄</Text>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        style={{ position: 'absolute', bottom: 32, right: 24, width: 56, height: 56, backgroundColor: '#3b82f6', borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 }}
        onPress={() => setShowCreateModal(true)}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* 新增排程 Modal */}
      <Modal visible={showCreateModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            <TouchableOpacity onPress={() => setShowCreateModal(false)}>
              <Text style={{ fontSize: 16, color: '#6b7280' }}>取消</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>新增到診排程</Text>
            <TouchableOpacity onPress={handleCreateSchedule} disabled={createSchedule.isPending}>
              {createSchedule.isPending ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text style={{ fontSize: 16, fontWeight: '600', color: '#3b82f6' }}>儲存</Text>}
            </TouchableOpacity>
          </View>
          <View style={{ padding: 16 }}>
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>到診日期</Text>
            <TextInput
              style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937' }}
              value={newDate}
              onChangeText={setNewDate}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
            />
          </View>
        </View>
      </Modal>

      {/* 新增院友到排程 Modal */}
      <Modal visible={showAddPatientModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            <TouchableOpacity onPress={() => setShowAddPatientModal(false)}>
              <Text style={{ fontSize: 16, color: '#6b7280' }}>取消</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>新增院友到排程</Text>
            <TouchableOpacity onPress={handleAddPatient} disabled={addPatient.isPending}>
              {addPatient.isPending ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text style={{ fontSize: 16, fontWeight: '600', color: '#3b82f6' }}>儲存</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView style={{ flex: 1, padding: 16 }} keyboardShouldPersistTaps="handled">
            {selectedSchedule && (
              <View style={{ backgroundColor: '#eff6ff', borderRadius: 10, paddingHorizontal: 12, paddingVertical: 10, marginBottom: 16 }}>
                <Text style={{ fontSize: 13, color: '#1d4ed8', fontWeight: '600' }}>
                  排程日期：{selectedSchedule.到診日期}（星期{WEEKDAYS[new Date(selectedSchedule.到診日期 + 'T00:00:00').getDay()]}）
                </Text>
              </View>
            )}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>院友 *</Text>
            <View style={{ marginBottom: 16 }}>
              <PatientAutocomplete
                value={patientForm.patient_id}
                onChange={(id) => setPatientForm(f => ({ ...f, patient_id: id }))}
                placeholder="搜索院友..."
                showResidencyFilter
                defaultResidencyStatus="在住"
              />
            </View>

            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 8 }}>看診原因</Text>
            {reasonOptions.length === 0 ? (
              <Text style={{ fontSize: 13, color: '#9ca3af', marginBottom: 16 }}>尚無看診原因選項</Text>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {reasonOptions.map(r => {
                  const active = patientForm.原因ids.includes(r.原因id);
                  return (
                    <TouchableOpacity
                      key={r.原因id}
                      onPress={() => toggleReason(r.原因id)}
                      style={{
                        flexDirection: 'row', alignItems: 'center', gap: 4,
                        paddingHorizontal: 12, paddingVertical: 8, borderRadius: 999, borderWidth: 1,
                        backgroundColor: active ? '#3b82f6' : 'white',
                        borderColor: active ? '#3b82f6' : '#e5e7eb',
                      }}
                    >
                      {active && <Ionicons name="checkmark" size={14} color="white" />}
                      <Text style={{ fontSize: 13, color: active ? 'white' : '#374151' }}>{r.原因名稱}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}

            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>症狀說明</Text>
            <TextInput
              style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 16, minHeight: 80 }}
              value={patientForm.症狀說明}
              onChangeText={v => setPatientForm(f => ({ ...f, 症狀說明: v }))}
              placeholder="請輸入症狀說明（可選）"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>備註</Text>
            <TextInput
              style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 32, minHeight: 80 }}
              value={patientForm.備註}
              onChangeText={v => setPatientForm(f => ({ ...f, 備註: v }))}
              placeholder="備註（可選）"
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
