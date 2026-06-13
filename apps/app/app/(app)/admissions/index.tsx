import { useState, useMemo } from 'react';
import {
  View, Text, FlatList, TextInput, TouchableOpacity,
  ActivityIndicator, RefreshControl, Modal, ScrollView, Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useResidents } from '@/features/residents/useResidents';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';
import {
  useAdmissionRecords, useCreateAdmissionRecord, useAddEpisodeEvent, useDeleteAdmissionRecord,
  EVENT_TYPE_LABELS, EVENT_TYPE_COLORS,
  getEpisodeStatusLabel, getEpisodeStatusColor,
  type HospitalEpisode, type EpisodeEventType,
  DISCHARGE_TYPE_LABELS, VACATION_END_TYPE_LABELS,
} from '@/features/admissions/useAdmissions';

const ALL_EVENT_TYPES: EpisodeEventType[] = ['admission', 'transfer', 'discharge', 'vacation_start', 'vacation_end'];

// 新增事件的表單
type EventForm = {
  patient_id: number | null;
  event_type: EpisodeEventType;
  event_date: string;
  event_time: string;
  hospital_name: string;
  hospital_ward: string;
  hospital_bed_number: string;
  remarks: string;
};

const EMPTY_FORM: EventForm = {
  patient_id: null,
  event_type: 'admission',
  event_date: new Date().toISOString().split('T')[0],
  event_time: '',
  hospital_name: '',
  hospital_ward: '',
  hospital_bed_number: '',
  remarks: '',
};

export default function AdmissionsScreen() {
  const { data: residents = [] } = useResidents();
  const { data: episodes = [], isLoading, refetch } = useAdmissionRecords();
  const createAdmission = useCreateAdmissionRecord();
  const addEvent = useAddEpisodeEvent();
  const deleteAdmission = useDeleteAdmissionRecord();

  const [search, setSearch] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [selectedEpisode, setSelectedEpisode] = useState<HospitalEpisode | null>(null);
  const [form, setForm] = useState<EventForm>(EMPTY_FORM);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    if (!q) return episodes;
    return episodes.filter(ep => {
      const patient = residents.find(r => r.院友id === ep.patient_id);
      return (
        patient?.中文姓名.includes(q) ||
        patient?.床號?.includes(q) ||
        (ep.primary_hospital ?? '').toLowerCase().includes(q) ||
        ep.episode_events?.some(e =>
          (e.hospital_name ?? '').toLowerCase().includes(q)
        )
      );
    });
  }, [episodes, residents, search]);

  function openCreateNew() {
    setSelectedEpisode(null);
    setForm(EMPTY_FORM);
    setShowModal(true);
  }

  function openAddEvent(episode: HospitalEpisode) {
    setSelectedEpisode(episode);
    setForm({ ...EMPTY_FORM, patient_id: episode.patient_id });
    setShowModal(true);
  }

  async function handleSave() {
    if (!form.patient_id) { Alert.alert('提示', '請選擇院友'); return; }
    try {
      if (selectedEpisode) {
        // 為現有 episode 新增事件
        await addEvent.mutateAsync({
          episode_id: selectedEpisode.id,
          event_type: form.event_type,
          event_date: form.event_date,
          event_time: form.event_time || undefined,
          hospital_name: form.hospital_name || undefined,
          hospital_ward: form.hospital_ward || undefined,
          hospital_bed_number: form.hospital_bed_number || undefined,
          remarks: form.remarks || undefined,
          event_order: (selectedEpisode.episode_events?.length ?? 0) + 1,
        });
      } else {
        // 建立新 episode
        await createAdmission.mutateAsync({
          patient_id: form.patient_id,
          episode_start_date: form.event_date,
          primary_hospital: form.hospital_name || undefined,
          primary_ward: form.hospital_ward || undefined,
          primary_bed_number: form.hospital_bed_number || undefined,
          remarks: form.remarks || undefined,
          event_type: form.event_type,
          event_date: form.event_date,
          event_time: form.event_time || undefined,
        });
      }
      setShowModal(false);
    } catch (e: any) {
      Alert.alert('儲存失敗', e?.message ?? '請重試');
    }
  }

  const isSaving = createAdmission.isPending || addEvent.isPending;

  return (
    <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
      <View style={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 8 }}>
        <View style={{ flexDirection: 'row', alignItems: 'center', backgroundColor: 'white', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 8, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}>
          <Ionicons name="search-outline" size={18} color="#9ca3af" />
          <TextInput
            style={{ flex: 1, marginLeft: 8, fontSize: 16, color: '#1f2937' }}
            placeholder="搜尋院友或醫院..."
            placeholderTextColor="#9ca3af"
            value={search}
            onChangeText={setSearch}
          />
        </View>
      </View>

      {isLoading ? (
        <ActivityIndicator style={{ marginTop: 32 }} size="large" color="#3b82f6" />
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={item => item.id}
          refreshControl={<RefreshControl refreshing={false} onRefresh={refetch} />}
          contentContainerStyle={{ paddingHorizontal: 16, paddingBottom: 100 }}
          renderItem={({ item: episode }) => {
            const patient = residents.find(r => r.院友id === episode.patient_id);
            const statusLabel = getEpisodeStatusLabel(episode);
            const statusColor = getEpisodeStatusColor(statusLabel);
            // 最新事件
            const sortedEvents = [...(episode.episode_events ?? [])].sort(
              (a, b) => b.event_date.localeCompare(a.event_date)
            );
            const latestEvent = sortedEvents[0];
            return (
              <View
                style={{ backgroundColor: 'white', borderRadius: 12, marginBottom: 12, paddingHorizontal: 16, paddingVertical: 12, shadowColor: '#000', shadowOpacity: 0.06, shadowRadius: 4, elevation: 2 }}
              >
                <View style={{ flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' }}>
                  <View style={{ flex: 1 }}>
                    {/* 院友 + 狀態 */}
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                      <View style={{ paddingHorizontal: 8, paddingVertical: 2, borderRadius: 9999, backgroundColor: statusColor + '20' }}>
                        <Text style={{ fontSize: 12, fontWeight: '600', color: statusColor }}>{statusLabel}</Text>
                      </View>
                      {patient && (
                        <Text style={{ fontSize: 14, color: '#374151' }}>
                          {patient.床號} {patient.中文姓名}
                        </Text>
                      )}
                    </View>
                    {/* 開始日期 */}
                    <Text style={{ fontSize: 12, color: '#6b7280', marginBottom: 2 }}>
                      缺席開始：{episode.episode_start_date}
                    </Text>
                    {/* 最新事件 */}
                    {latestEvent && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 4 }}>
                        <View style={{ paddingHorizontal: 6, paddingVertical: 1, borderRadius: 6, backgroundColor: EVENT_TYPE_COLORS[latestEvent.event_type] + '20' }}>
                          <Text style={{ fontSize: 11, color: EVENT_TYPE_COLORS[latestEvent.event_type] }}>
                            {EVENT_TYPE_LABELS[latestEvent.event_type]}
                          </Text>
                        </View>
                        <Text style={{ fontSize: 11, color: '#9ca3af' }}>{latestEvent.event_date}</Text>
                        {latestEvent.hospital_name && (
                          <Text style={{ fontSize: 11, color: '#9ca3af' }}>{latestEvent.hospital_name}</Text>
                        )}
                      </View>
                    )}
                    {episode.remarks && (
                      <Text style={{ fontSize: 11, color: '#9ca3af', marginTop: 4 }}>{episode.remarks}</Text>
                    )}
                  </View>
                  <View style={{ flexDirection: 'row', gap: 4 }}>
                    <TouchableOpacity onPress={() => openAddEvent(episode)} style={{ padding: 4 }}>
                      <Ionicons name="add-circle-outline" size={20} color="#3b82f6" />
                    </TouchableOpacity>
                    <TouchableOpacity
                      onPress={() => Alert.alert('確認刪除', '確定刪除此缺席記錄？', [
                        { text: '取消', style: 'cancel' },
                        { text: '刪除', style: 'destructive', onPress: () => deleteAdmission.mutate(episode.id) },
                      ])}
                      style={{ padding: 4 }}
                    >
                      <Ionicons name="trash-outline" size={18} color="#ef4444" />
                    </TouchableOpacity>
                  </View>
                </View>
              </View>
            );
          }}
          ListEmptyComponent={
            <Text style={{ textAlign: 'center', color: '#9ca3af', marginTop: 64 }}>暫無缺席記錄</Text>
          }
        />
      )}

      <TouchableOpacity
        style={{ position: 'absolute', bottom: 32, right: 24, width: 56, height: 56, backgroundColor: '#3b82f6', borderRadius: 28, alignItems: 'center', justifyContent: 'center', shadowColor: '#000', shadowOpacity: 0.2, shadowRadius: 8, elevation: 6 }}
        onPress={openCreateNew}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* 新增事件 Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View style={{ flex: 1, backgroundColor: '#f9fafb' }}>
          {/* 標題列 */}
          <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 16, backgroundColor: 'white', borderBottomWidth: 1, borderBottomColor: '#e5e7eb' }}>
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text style={{ fontSize: 16, color: '#6b7280' }}>取消</Text>
            </TouchableOpacity>
            <Text style={{ fontSize: 16, fontWeight: '600', color: '#111827' }}>
              {selectedEpisode ? '新增缺席事件' : '新增缺席事件'}
            </Text>
            <TouchableOpacity onPress={handleSave} disabled={isSaving}>
              {isSaving ? (
                <ActivityIndicator size="small" color="#3b82f6" />
              ) : (
                <Text style={{ fontSize: 16, fontWeight: '600', color: '#3b82f6' }}>儲存</Text>
              )}
            </TouchableOpacity>
          </View>

          <ScrollView style={{ flex: 1, paddingHorizontal: 16, paddingTop: 16 }} keyboardShouldPersistTaps="handled">
            {/* 院友 */}
            {!selectedEpisode && (
              <>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>院友 *</Text>
                <View style={{ marginBottom: 16 }}>
                  <PatientAutocomplete
                    value={form.patient_id}
                    onChange={(id) => setForm(f => ({ ...f, patient_id: id }))}
                    showResidencyFilter
                    defaultResidencyStatus="在住"
                  />
                </View>
              </>
            )}

            {/* 事件類型 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>事件類型</Text>
            <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
              {ALL_EVENT_TYPES.map(t => (
                <TouchableOpacity
                  key={t}
                  onPress={() => setForm(f => ({ ...f, event_type: t }))}
                  style={{ paddingHorizontal: 12, paddingVertical: 8, borderRadius: 12, borderWidth: 1, backgroundColor: form.event_type === t ? EVENT_TYPE_COLORS[t] : 'white', borderColor: form.event_type === t ? EVENT_TYPE_COLORS[t] : '#e5e7eb' }}
                >
                  <Text style={{ color: form.event_type === t ? 'white' : '#374151', fontSize: 13, fontWeight: '600' }}>
                    {EVENT_TYPE_LABELS[t]}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* 事件日期 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>事件日期</Text>
            <TextInput
              style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 16 }}
              value={form.event_date}
              onChangeText={v => setForm(f => ({ ...f, event_date: v }))}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
            />

            {/* 事件時間 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>事件時間</Text>
            <TextInput
              style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 16 }}
              value={form.event_time}
              onChangeText={v => setForm(f => ({ ...f, event_time: v }))}
              placeholder="HH:MM（可選）"
              placeholderTextColor="#9ca3af"
            />

            {/* 醫院名稱（渡假類型不需要） */}
            {!form.event_type.startsWith('vacation') && (
              <>
                <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>醫院名稱</Text>
                <TextInput
                  style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 16 }}
                  value={form.hospital_name}
                  onChangeText={v => setForm(f => ({ ...f, hospital_name: v }))}
                  placeholder="醫院名稱（可選）"
                  placeholderTextColor="#9ca3af"
                />

                <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>病房</Text>
                <TextInput
                  style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 16 }}
                  value={form.hospital_ward}
                  onChangeText={v => setForm(f => ({ ...f, hospital_ward: v }))}
                  placeholder="病房（可選）"
                  placeholderTextColor="#9ca3af"
                />

                <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>床號</Text>
                <TextInput
                  style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 16 }}
                  value={form.hospital_bed_number}
                  onChangeText={v => setForm(f => ({ ...f, hospital_bed_number: v }))}
                  placeholder="床號（可選）"
                  placeholderTextColor="#9ca3af"
                />
              </>
            )}

            {/* 備註 */}
            <Text style={{ fontSize: 14, fontWeight: '500', color: '#374151', marginBottom: 4 }}>備註</Text>
            <TextInput
              style={{ backgroundColor: 'white', borderWidth: 1, borderColor: '#e5e7eb', borderRadius: 12, paddingHorizontal: 12, paddingVertical: 12, fontSize: 16, color: '#1f2937', marginBottom: 32, minHeight: 80 }}
              value={form.remarks}
              onChangeText={v => setForm(f => ({ ...f, remarks: v }))}
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
