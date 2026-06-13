import { useCallback, useState } from 'react';
import {
  View,
  Text,
  SectionList,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  ScrollView,
  TextInput,
  Alert,
  KeyboardAvoidingView,
  Platform,
} from 'react-native';
import { useQueryClient } from '@tanstack/react-query';
import {
  useFollowUps,
  useCreateFollowUp,
  useUpdateFollowUp,
  useDeleteFollowUp,
} from '@/features/follow-ups/useFollowUps';
import { useResidents } from '@/features/residents/useResidents';
import { PatientAutocomplete } from '@/components/PatientAutocomplete';
import type { FollowUpStatus, FollowUpAppointment } from '@/features/follow-ups/types';
import { STATUS_COLOR, ALL_STATUSES, HOSPITAL_OPTIONS, TRANSPORT_OPTIONS, COMPANION_OPTIONS } from '@/features/follow-ups/types';

// ─── helpers ─────────────────────────────────────────────────────────────────

function getHKDate() {
  return new Date(Date.now() + 8 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const DAYS_OPTIONS = [
  { label: '本週', days: 7 },
  { label: '本月', days: 30 },
  { label: '3個月', days: 90 },
];

function formatDate(iso: string) {
  const d = new Date(iso + 'T00:00:00');
  const weekDays = ['日', '一', '二', '三', '四', '五', '六'];
  return `${iso} (${weekDays[d.getDay()]})`;
}

// ─── StatusBadge ─────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: FollowUpStatus }) {
  const { bg, text } = STATUS_COLOR[status] ?? { bg: 'bg-gray-100', text: 'text-gray-600' };
  return (
    <View className={`px-2 py-0.5 rounded-full ${bg}`}>
      <Text className={`text-xs font-semibold ${text}`}>{status || '尚未安排'}</Text>
    </View>
  );
}

// ─── Field ───────────────────────────────────────────────────────────────────

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <View className="mb-4">
      <Text className="text-xs font-semibold text-gray-500 mb-1.5">{label}</Text>
      {children}
    </View>
  );
}

// ─── FollowUpFormModal ────────────────────────────────────────────────────────

type FormData = {
  院友id: number | null;
  覆診日期: string;
  出發時間: string;
  覆診時間: string;
  覆診地點: string;
  覆診專科: string;
  交通安排: string;
  陪診人員: string;
  狀態: FollowUpStatus;
  備註: string;
};

function FollowUpFormModal({
  visible,
  editing,
  residents,
  onClose,
}: {
  visible: boolean;
  editing: FollowUpAppointment | null;
  residents: Array<{ 院友id: number; 中文姓名: string; 床號?: string }>;
  onClose: () => void;
}) {
  const createMut = useCreateFollowUp();
  const updateMut = useUpdateFollowUp();
  const deleteMut = useDeleteFollowUp();
  const isCreate = editing === null;

  const [form, setForm] = useState<FormData>(() =>
    editing
      ? {
          院友id: editing.院友id,
          覆診日期: editing.覆診日期 ?? getHKDate(),
          出發時間: editing.出發時間 ?? '',
          覆診時間: editing.覆診時間 ?? '',
          覆診地點: editing.覆診地點 ?? '',
          覆診專科: editing.覆診專科 ?? '',
          交通安排: editing.交通安排 ?? '',
          陪診人員: editing.陪診人員 ?? '',
          狀態: editing.狀態 ?? '尚未安排',
          備註: editing.備註 ?? '',
        }
      : {
          院友id: null,
          覆診日期: getHKDate(),
          出發時間: '',
          覆診時間: '',
          覆診地點: '',
          覆診專科: '',
          交通安排: '',
          陪診人員: '',
          狀態: '尚未安排',
          備註: '',
        }
  );

  const saving = createMut.isPending || updateMut.isPending;

  function set<K extends keyof FormData>(key: K, value: FormData[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.院友id) { Alert.alert('請選擇院友'); return; }
    if (!form.覆診日期) { Alert.alert('請填寫覆診日期'); return; }
    try {
      const payload: any = {
        院友id: form.院友id,
        覆診日期: form.覆診日期,
        出發時間: form.出發時間 || null,
        覆診時間: form.覆診時間 || null,
        覆診地點: form.覆診地點 || null,
        覆診專科: form.覆診專科 || null,
        交通安排: form.交通安排 || null,
        陪診人員: form.陪診人員 || null,
        狀態: form.狀態,
        備註: form.備註 || null,
      };
      if (isCreate) {
        await createMut.mutateAsync(payload);
      } else {
        await updateMut.mutateAsync({ ...editing!, ...payload });
      }
      onClose();
    } catch (e: any) {
      Alert.alert('儲存失敗', e?.message ?? '請重試');
    }
  }

  function handleDelete() {
    Alert.alert('確認刪除', '確定要刪除此覆診安排嗎？', [
      { text: '取消', style: 'cancel' },
      {
        text: '刪除',
        style: 'destructive',
        onPress: async () => {
          try {
            await deleteMut.mutateAsync(editing!.覆診id);
            onClose();
          } catch (e: any) {
            Alert.alert('刪除失敗', e?.message ?? '請重試');
          }
        },
      },
    ]);
  }

  return (
    <Modal visible={visible} animationType="slide" presentationStyle="pageSheet" onRequestClose={onClose}>
      <KeyboardAvoidingView
        className="flex-1 bg-white"
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View className="flex-row items-center justify-between px-4 py-3 border-b border-gray-200">
          <TouchableOpacity onPress={onClose} className="py-1 pr-3">
            <Text className="text-base text-gray-500">取消</Text>
          </TouchableOpacity>
          <Text className="text-base font-bold text-gray-900">
            {isCreate ? '新增覆診安排' : '編輯覆診安排'}
          </Text>
          <TouchableOpacity onPress={handleSave} disabled={saving} className="py-1 pl-3">
            <Text className={`text-base font-semibold ${saving ? 'text-gray-300' : 'text-blue-600'}`}>
              儲存
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView className="flex-1 px-4 py-4" keyboardShouldPersistTaps="handled">
          {/* 院友 */}
          <Field label="院友 *">
            <PatientAutocomplete
              value={form.院友id}
              onChange={(id) => set('院友id', id)}
              showResidencyFilter
              defaultResidencyStatus="在住"
            />
          </Field>

          <Field label="覆診日期 *">
            <TextInput
              className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-900 border border-gray-200"
              value={form.覆診日期}
              onChangeText={(v) => set('覆診日期', v)}
              placeholder="YYYY-MM-DD"
              placeholderTextColor="#9ca3af"
            />
          </Field>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="出發時間">
                <TextInput
                  className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-900 border border-gray-200"
                  value={form.出發時間}
                  onChangeText={(v) => set('出發時間', v)}
                  placeholder="HH:MM"
                  placeholderTextColor="#9ca3af"
                />
              </Field>
            </View>
            <View className="flex-1">
              <Field label="覆診時間">
                <TextInput
                  className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-900 border border-gray-200"
                  value={form.覆診時間}
                  onChangeText={(v) => set('覆診時間', v)}
                  placeholder="HH:MM"
                  placeholderTextColor="#9ca3af"
                />
              </Field>
            </View>
          </View>

          <Field label="覆診專科">
            <TextInput
              className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-900 border border-gray-200"
              value={form.覆診專科}
              onChangeText={(v) => set('覆診專科', v)}
              placeholder="例如：內科、骨科..."
              placeholderTextColor="#9ca3af"
            />
          </Field>

          <Field label="覆診地點">
            <View className="flex-row flex-wrap gap-1.5">
              {HOSPITAL_OPTIONS.map((h) => {
                const active = form.覆診地點 === h;
                return (
                  <TouchableOpacity key={h}
                    className={`px-3 py-1.5 rounded-full border ${active ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-200'}`}
                    onPress={() => set('覆診地點', active ? '' : h)}>
                    <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-gray-700'}`}>{h}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <TextInput
              className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-900 border border-gray-200 mt-2"
              value={form.覆診地點}
              onChangeText={(v) => set('覆診地點', v)}
              placeholder="或自行輸入醫院/診所名稱"
              placeholderTextColor="#9ca3af"
            />
          </Field>

          <View className="flex-row gap-3">
            <View className="flex-1">
              <Field label="交通安排">
                <View className="flex-row flex-wrap gap-1.5">
                  {TRANSPORT_OPTIONS.map((t) => {
                    const active = form.交通安排 === t;
                    return (
                      <TouchableOpacity key={t}
                        className={`px-3 py-1.5 rounded-full border ${active ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-200'}`}
                        onPress={() => set('交通安排', active ? '' : t)}>
                        <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-gray-700'}`}>{t}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </Field>
            </View>
          </View>

          <Field label="陪診人員">
            <View className="flex-row flex-wrap gap-1.5">
              {COMPANION_OPTIONS.map((c) => {
                const active = form.陪診人員 === c;
                return (
                  <TouchableOpacity key={c}
                    className={`px-3 py-1.5 rounded-full border ${active ? 'bg-blue-500 border-blue-500' : 'bg-white border-gray-200'}`}
                    onPress={() => set('陪診人員', active ? '' : c)}>
                    <Text className={`text-xs font-medium ${active ? 'text-white' : 'text-gray-700'}`}>{c}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          <Field label="狀態">
            <View className="flex-row flex-wrap gap-1.5">
              {ALL_STATUSES.map((s) => {
                const active = form.狀態 === s;
                const { bg, text } = STATUS_COLOR[s];
                return (
                  <TouchableOpacity
                    key={s}
                    className={`px-3 py-1.5 rounded-full ${active ? 'bg-blue-500' : bg}`}
                    onPress={() => set('狀態', s)}
                  >
                    <Text className={`text-xs font-semibold ${active ? 'text-white' : text}`}>
                      {s}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </Field>

          <Field label="備註">
            <TextInput
              className="bg-gray-50 rounded-lg px-3 py-2.5 text-sm text-gray-900 border border-gray-200"
              value={form.備註}
              onChangeText={(v) => set('備註', v)}
              placeholder="備註..."
              placeholderTextColor="#9ca3af"
              multiline
              numberOfLines={3}
              style={{ minHeight: 72, textAlignVertical: 'top' }}
            />
          </Field>

          {!isCreate && (
            <TouchableOpacity
              className="mt-2 mb-8 py-3 rounded-xl border border-red-300 items-center"
              onPress={handleDelete}
              disabled={deleteMut.isPending}
            >
              <Text className="text-red-600 font-semibold text-sm">刪除此覆診安排</Text>
            </TouchableOpacity>
          )}

          <View className="h-8" />
        </ScrollView>
      </KeyboardAvoidingView>
    </Modal>
  );
}

// ─── AppointmentCard ──────────────────────────────────────────────────────────

function AppointmentCard({
  item,
  residentName,
  bedNumber,
  onPress,
}: {
  item: FollowUpAppointment;
  residentName: string;
  bedNumber?: string;
  onPress: () => void;
}) {
  return (
    <TouchableOpacity
      className="bg-white rounded-xl px-4 py-3 mb-2 shadow-sm"
      onPress={onPress}
      activeOpacity={0.7}
    >
      <View className="flex-row items-center justify-between mb-1.5">
        <View className="flex-1 flex-row items-center gap-2">
          <Text className="text-base font-bold text-gray-900">{residentName}</Text>
          {bedNumber ? <Text className="text-xs text-gray-400">{bedNumber}</Text> : null}
        </View>
        <StatusBadge status={item.狀態} />
      </View>

      <View className="flex-row flex-wrap gap-x-4 gap-y-0.5 mb-1">
        {item.覆診專科 ? (
          <Text className="text-sm font-semibold text-blue-600">{item.覆診專科}</Text>
        ) : null}
        {item.覆診地點 ? (
          <Text className="text-sm text-gray-600">📍 {item.覆診地點}</Text>
        ) : null}
      </View>

      <View className="flex-row flex-wrap gap-x-4 gap-y-0.5">
        {item.覆診時間 ? <Text className="text-xs text-gray-500">覆診：{item.覆診時間}</Text> : null}
        {item.出發時間 ? <Text className="text-xs text-gray-500">出發：{item.出發時間}</Text> : null}
        {item.交通安排 ? <Text className="text-xs text-gray-500">交通：{item.交通安排}</Text> : null}
        {item.陪診人員 ? <Text className="text-xs text-gray-500">陪診：{item.陪診人員}</Text> : null}
      </View>

      {item.備註 ? (
        <Text className="text-xs text-gray-400 mt-1.5 pt-1.5 border-t border-gray-100 italic">
          {item.備註}
        </Text>
      ) : null}
    </TouchableOpacity>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function FollowUpsIndex() {
  const queryClient = useQueryClient();
  const [days, setDays] = useState(30);
  const [statusFilter, setStatusFilter] = useState<FollowUpStatus | null>(null);
  const [modalVisible, setModalVisible] = useState(false);
  const [editingItem, setEditingItem] = useState<FollowUpAppointment | null>(null);

  const { data: appointments = [], isLoading } = useFollowUps(days);
  const { data: residents = [] } = useResidents();

  const residentMap = new Map(
    residents.map((r) => [r.院友id, { name: r.中文姓名 ?? '未知', bed: r.床號 }])
  );

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['follow-ups', days] });
  }, [queryClient, days]);

  const filtered = statusFilter
    ? appointments.filter((a) => a.狀態 === statusFilter)
    : appointments;

  const grouped = filtered.reduce<Record<string, FollowUpAppointment[]>>((acc, item) => {
    if (!acc[item.覆診日期]) acc[item.覆診日期] = [];
    acc[item.覆診日期].push(item);
    return acc;
  }, {});
  const sections = Object.keys(grouped)
    .sort()
    .map((date) => ({ title: date, data: grouped[date] }));

  function openCreate() { setEditingItem(null); setModalVisible(true); }
  function openEdit(item: FollowUpAppointment) { setEditingItem(item); setModalVisible(true); }
  function closeModal() { setModalVisible(false); setEditingItem(null); }

  return (
    <View className="flex-1 bg-gray-50">
      {/* Controls */}
      <View className="bg-white border-b border-gray-200 px-4 pt-3 pb-2 gap-2">
        <View className="flex-row items-center gap-2">
          <Text className="text-xs text-gray-500 mr-1">範圍</Text>
          {DAYS_OPTIONS.map((opt) => (
            <TouchableOpacity
              key={opt.days}
              className={`px-3 py-1 rounded-full ${days === opt.days ? 'bg-blue-500' : 'bg-gray-100'}`}
              onPress={() => setDays(opt.days)}
            >
              <Text className={`text-xs font-semibold ${days === opt.days ? 'text-white' : 'text-gray-600'}`}>
                {opt.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        <View className="flex-row flex-wrap gap-1.5">
          <TouchableOpacity
            className={`px-3 py-1 rounded-full ${statusFilter === null ? 'bg-gray-700' : 'bg-gray-100'}`}
            onPress={() => setStatusFilter(null)}
          >
            <Text className={`text-xs font-semibold ${statusFilter === null ? 'text-white' : 'text-gray-600'}`}>
              全部 ({appointments.length})
            </Text>
          </TouchableOpacity>
          {ALL_STATUSES.map((s) => {
            const count = appointments.filter((a) => a.狀態 === s).length;
            if (count === 0) return null;
            const active = statusFilter === s;
            const { bg, text } = STATUS_COLOR[s];
            return (
              <TouchableOpacity
                key={s}
                className={`px-3 py-1 rounded-full ${active ? 'bg-gray-700' : bg}`}
                onPress={() => setStatusFilter(active ? null : s)}
              >
                <Text className={`text-xs font-semibold ${active ? 'text-white' : text}`}>
                  {s} ({count})
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <SectionList
          sections={sections}
          keyExtractor={(item) => item.覆診id}
          contentContainerClassName="px-4 pb-24"
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
          renderSectionHeader={({ section }) => (
            <View className="pt-4 pb-1">
              <Text className="text-sm font-bold text-gray-600">{formatDate(section.title)}</Text>
            </View>
          )}
          renderItem={({ item }) => {
            const info = residentMap.get(item.院友id);
            return (
              <AppointmentCard
                item={item}
                residentName={info?.name ?? `院友 #${item.院友id}`}
                bedNumber={info?.bed}
                onPress={() => openEdit(item)}
              />
            );
          }}
          ListEmptyComponent={
            <View className="items-center justify-center py-16">
              <Text className="text-gray-400 text-base">未有覆診記錄</Text>
            </View>
          }
        />
      )}

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-8 right-5 w-14 h-14 bg-blue-500 rounded-full items-center justify-center shadow-lg"
        onPress={openCreate}
        activeOpacity={0.8}
      >
        <Text className="text-white text-3xl font-light" style={{ lineHeight: 40 }}>+</Text>
      </TouchableOpacity>

      {modalVisible && (
        <FollowUpFormModal
          visible={modalVisible}
          editing={editingItem}
          residents={residents}
          onClose={closeModal}
        />
      )}
    </View>
  );
}
