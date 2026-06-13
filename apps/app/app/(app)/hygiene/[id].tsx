import { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  Switch,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
  Modal,
  TextInput,
  Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useHygieneRecords, useCreateHygieneRecord, useDeleteHygieneRecord } from '@/features/hygiene/useHygiene';
import type { HygieneRecord } from '@/features/hygiene/types';
import { HYGIENE_ITEMS } from '@/features/hygiene/types';

const TODAY = new Date().toISOString().slice(0, 10);

function formatDisplay(d: Date) {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${y}-${m}-${day}`;
}

function addDays(dateStr: string, n: number) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + n);
  return formatDisplay(d);
}

const TIME_SLOTS = ['早上', '下午', '晚上', '通宵'];
const BOWEL_AMOUNTS = ['少量', '中量', '大量'];
const BOWEL_CONSISTENCIES = ['稀爛', '軟', '硬', '乾硬', '水狀'];

function RecordCard({ record, onDelete }: { record: HygieneRecord; onDelete: () => void }) {
  const doneItems = HYGIENE_ITEMS.filter((item) => record[item.key] === true);
  const hasBowel = (record.bowel_count ?? 0) > 0;

  return (
    <TouchableOpacity
      onLongPress={onDelete}
      activeOpacity={0.85}
      className="rounded-xl bg-white shadow-sm overflow-hidden mb-3"
    >
      <View className="px-4 py-2 bg-teal-50 border-b border-teal-100 flex-row items-center justify-between">
        <Text className="text-sm font-semibold text-teal-800">
          {record.time_slot || '日常護理'}
        </Text>
        <Text className="text-xs text-teal-600">記錄者: {record.recorder}</Text>
      </View>

      <View className="px-4 py-3">
        {doneItems.length > 0 ? (
          <View className="flex-row flex-wrap gap-1.5 mb-2">
            {doneItems.map((item) => (
              <View key={item.key} className="bg-teal-100 px-2 py-0.5 rounded-full">
                <Text className="text-teal-700 text-xs">✓ {item.label}</Text>
              </View>
            ))}
          </View>
        ) : (
          <Text className="text-xs text-gray-400 mb-2">無完成護理項目</Text>
        )}

        {hasBowel && (
          <View className="bg-amber-50 rounded-lg px-3 py-2 mt-1 border border-amber-100">
            <Text className="text-xs font-semibold text-amber-800 mb-1">大便記錄</Text>
            <View className="flex-row gap-3 flex-wrap">
              <Text className="text-xs text-amber-700">次數: {record.bowel_count}</Text>
              {record.bowel_amount && <Text className="text-xs text-amber-700">量: {record.bowel_amount}</Text>}
              {record.bowel_consistency && <Text className="text-xs text-amber-700">性狀: {record.bowel_consistency}</Text>}
              {record.bowel_medication && <Text className="text-xs text-amber-700">藥物: {record.bowel_medication}</Text>}
            </View>
          </View>
        )}

        {record.notes && <Text className="text-xs text-gray-500 mt-2">{record.notes}</Text>}
        {record.status_notes && <Text className="text-xs text-orange-600 mt-1">⚠ {record.status_notes}</Text>}
      </View>
    </TouchableOpacity>
  );
}

type BoolKey = keyof Pick<HygieneRecord,
  'has_bath' | 'has_face_wash' | 'has_shave' | 'has_oral_care' | 'has_denture_care' |
  'has_haircut' | 'has_nail_trim' | 'has_bedding_change' | 'has_sheet_pillow_change' |
  'has_cup_wash' | 'has_bedside_cabinet' | 'has_wardrobe'
>;

type FormState = Record<BoolKey, boolean> & {
  time_slot: string;
  bowel_count: string;
  bowel_amount: string;
  bowel_consistency: string;
  bowel_medication: string;
  notes: string;
  recorder: string;
};

const EMPTY_FORM: FormState = {
  time_slot: '早上',
  has_bath: false, has_face_wash: false, has_shave: false, has_oral_care: false,
  has_denture_care: false, has_haircut: false, has_nail_trim: false,
  has_bedding_change: false, has_sheet_pillow_change: false, has_cup_wash: false,
  has_bedside_cabinet: false, has_wardrobe: false,
  bowel_count: '', bowel_amount: '', bowel_consistency: '', bowel_medication: '',
  notes: '', recorder: '',
};

export default function HygieneScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const patientId = parseInt(id, 10);
  const [date, setDate] = useState(formatDisplay(new Date()));
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);

  const { data, isLoading, isError, refetch } = useHygieneRecords(patientId, date);
  const createRecord = useCreateHygieneRecord();
  const deleteRecord = useDeleteHygieneRecord();

  function setField<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((f) => ({ ...f, [key]: value }));
  }

  async function handleSave() {
    if (!form.recorder.trim()) { Alert.alert('提示', '請填寫記錄員'); return; }
    await createRecord.mutateAsync({
      patient_id: patientId,
      record_date: date,
      time_slot: form.time_slot,
      has_bath: form.has_bath, has_face_wash: form.has_face_wash, has_shave: form.has_shave,
      has_oral_care: form.has_oral_care, has_denture_care: form.has_denture_care,
      has_haircut: form.has_haircut, has_nail_trim: form.has_nail_trim,
      has_bedding_change: form.has_bedding_change, has_sheet_pillow_change: form.has_sheet_pillow_change,
      has_cup_wash: form.has_cup_wash, has_bedside_cabinet: form.has_bedside_cabinet,
      has_wardrobe: form.has_wardrobe,
      bowel_count: form.bowel_count ? parseInt(form.bowel_count, 10) : undefined,
      bowel_amount: form.bowel_amount || undefined,
      bowel_consistency: form.bowel_consistency || undefined,
      bowel_medication: form.bowel_medication || undefined,
      notes: form.notes || undefined,
      recorder: form.recorder,
    });
    setShowModal(false);
    setForm(EMPTY_FORM);
  }

  return (
    <View className="flex-1 bg-gray-100">
      {/* Date navigator */}
      <View className="flex-row items-center justify-between px-4 py-2 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => setDate(addDays(date, -1))}
          className="w-9 h-9 items-center justify-center rounded-full bg-gray-100">
          <Text className="text-gray-600 text-base">‹</Text>
        </TouchableOpacity>
        <Text className={`font-semibold ${date === TODAY ? 'text-teal-700' : 'text-gray-800'}`}>
          {date}{date === TODAY ? ' (今天)' : ''}
        </Text>
        <TouchableOpacity onPress={() => setDate(addDays(date, 1))}
          disabled={date >= formatDisplay(new Date())}
          className={`w-9 h-9 items-center justify-center rounded-full ${date >= TODAY ? 'bg-gray-50' : 'bg-gray-100'}`}>
          <Text className={`text-base ${date >= TODAY ? 'text-gray-300' : 'text-gray-600'}`}>›</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#0d9488" />
        </View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-red-500 text-center">載入失敗</Text>
        </View>
      ) : !data?.length ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-gray-400 text-lg">當日無衛生護理記錄</Text>
        </View>
      ) : (
        <ScrollView
          contentContainerStyle={{ padding: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={refetch} />}
        >
          {data.map((record) => (
            <RecordCard
              key={record.id}
              record={record}
              onDelete={() => Alert.alert('確認刪除', '確定刪除此記錄？', [
                { text: '取消', style: 'cancel' },
                { text: '刪除', style: 'destructive', onPress: () => deleteRecord.mutate({ id: record.id, patientId, date }) },
              ])}
            />
          ))}
        </ScrollView>
      )}

      {/* FAB */}
      <TouchableOpacity
        className="absolute bottom-8 right-6 w-14 h-14 bg-teal-500 rounded-full items-center justify-center shadow-lg"
        style={{ elevation: 6 }}
        onPress={() => { setForm(EMPTY_FORM); setShowModal(true); }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      {/* Create Modal */}
      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowModal(false)}>
              <Text className="text-base text-gray-500">取消</Text>
            </TouchableOpacity>
            <Text className="text-base font-semibold">新增衛生護理記錄</Text>
            <TouchableOpacity onPress={handleSave} disabled={createRecord.isPending}>
              {createRecord.isPending
                ? <ActivityIndicator size="small" color="#0d9488" />
                : <Text className="text-base font-semibold text-teal-600">儲存</Text>}
            </TouchableOpacity>
          </View>

          <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
            {/* Time slot */}
            <Text className="text-sm font-medium text-gray-700 mb-1">時段</Text>
            <View className="flex-row gap-2 mb-4">
              {TIME_SLOTS.map((ts) => (
                <TouchableOpacity key={ts} onPress={() => setField('time_slot', ts)}
                  className="px-4 py-2 rounded-xl border"
                  style={{ backgroundColor: form.time_slot === ts ? '#0d9488' : 'white', borderColor: form.time_slot === ts ? '#0d9488' : '#e5e7eb' }}>
                  <Text style={{ color: form.time_slot === ts ? 'white' : '#374151', fontSize: 13 }}>{ts}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {/* Hygiene items */}
            <Text className="text-sm font-medium text-gray-700 mb-2">護理項目</Text>
            <View className="bg-white rounded-xl border border-gray-100 mb-4">
              {HYGIENE_ITEMS.map((item, idx) => (
                <View key={item.key} className={`flex-row items-center justify-between px-4 py-3 ${idx < HYGIENE_ITEMS.length - 1 ? 'border-b border-gray-100' : ''}`}>
                  <Text className="text-sm text-gray-800">{item.label}</Text>
                  <Switch
                    value={form[item.key as BoolKey] as boolean}
                    onValueChange={(v) => setField(item.key as BoolKey, v)}
                    trackColor={{ true: '#0d9488' }}
                  />
                </View>
              ))}
            </View>

            {/* Bowel */}
            <Text className="text-sm font-medium text-gray-700 mb-1">大便次數</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
              value={form.bowel_count} onChangeText={(v) => setField('bowel_count', v)}
              keyboardType="numeric" placeholder="0（無則留空）" />

            {form.bowel_count && parseInt(form.bowel_count, 10) > 0 && (<>
              <Text className="text-sm font-medium text-gray-700 mb-1">大便量</Text>
              <View className="flex-row gap-2 mb-4">
                {BOWEL_AMOUNTS.map((a) => (
                  <TouchableOpacity key={a} onPress={() => setField('bowel_amount', form.bowel_amount === a ? '' : a)}
                    className="px-3 py-2 rounded-xl border"
                    style={{ backgroundColor: form.bowel_amount === a ? '#f59e0b' : 'white', borderColor: form.bowel_amount === a ? '#f59e0b' : '#e5e7eb' }}>
                    <Text style={{ color: form.bowel_amount === a ? 'white' : '#374151', fontSize: 13 }}>{a}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-sm font-medium text-gray-700 mb-1">大便性狀</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {BOWEL_CONSISTENCIES.map((c) => (
                  <TouchableOpacity key={c} onPress={() => setField('bowel_consistency', form.bowel_consistency === c ? '' : c)}
                    className="px-3 py-2 rounded-xl border"
                    style={{ backgroundColor: form.bowel_consistency === c ? '#f59e0b' : 'white', borderColor: form.bowel_consistency === c ? '#f59e0b' : '#e5e7eb' }}>
                    <Text style={{ color: form.bowel_consistency === c ? 'white' : '#374151', fontSize: 13 }}>{c}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              <Text className="text-sm font-medium text-gray-700 mb-1">通便藥物</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
                value={form.bowel_medication} onChangeText={(v) => setField('bowel_medication', v)}
                placeholder="藥物名稱（可選）" />
            </>)}

            {/* Notes */}
            <Text className="text-sm font-medium text-gray-700 mb-1">備註</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4"
              value={form.notes} onChangeText={(v) => setField('notes', v)}
              placeholder="備註（可選）" multiline numberOfLines={2} />

            {/* Recorder */}
            <Text className="text-sm font-medium text-gray-700 mb-1">記錄員 *</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-8"
              value={form.recorder} onChangeText={(v) => setField('recorder', v)}
              placeholder="記錄員姓名" />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
