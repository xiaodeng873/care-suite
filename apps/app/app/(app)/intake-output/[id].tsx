import { useCallback, useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useResident } from '@/features/residents/useResidents';
import {
  useIntakeOutputRecords, useCreateIntakeOutputRecord, useDeleteIntakeOutputRecord,
} from '@/features/intake-output/useIntakeOutput';
import type {
  IntakeOutputRecord, IntakeItem, OutputItem, IntakeCategory, OutputCategory,
} from '@/features/intake-output/types';
import { calculateBalance } from '@/features/intake-output/calculateBalance';
import {
  INTAKE_CATEGORY_LABEL, OUTPUT_CATEGORY_LABEL, UNIT_LABEL,
} from '@/features/intake-output/types';

const TODAY = new Date().toISOString().slice(0, 10);

function formatDate(iso: string) {
  const [y, m, d] = iso.split('-');
  return `${y}/${m}/${d}`;
}

function addDays(iso: string, n: number) {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ─── Intake summary ──────────────────────────────────────────────────────────

const INTAKE_CATEGORY_COLOR: Record<IntakeCategory, { bg: string; text: string }> = {
  meal: { bg: 'bg-orange-100', text: 'text-orange-700' },
  beverage: { bg: 'bg-blue-100', text: 'text-blue-700' },
  tube_feeding: { bg: 'bg-purple-100', text: 'text-purple-700' },
  other: { bg: 'bg-gray-100', text: 'text-gray-600' },
};

const OUTPUT_CATEGORY_COLOR: Record<OutputCategory, { bg: string; text: string }> = {
  urine: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  gastric: { bg: 'bg-green-100', text: 'text-green-700' },
};

function IntakeItemRow({ item }: { item: IntakeItem }) {
  const { bg, text } = INTAKE_CATEGORY_COLOR[item.category];
  return (
    <View className="flex-row items-center justify-between py-1">
      <View className="flex-row items-center gap-2 flex-1">
        <View className={`px-1.5 py-0.5 rounded ${bg}`}>
          <Text className={`text-[10px] font-medium ${text}`}>
            {INTAKE_CATEGORY_LABEL[item.category]}
          </Text>
        </View>
        <Text className="text-sm text-gray-700 flex-1" numberOfLines={1}>
          {item.item_type}
        </Text>
      </View>
      <Text className="text-sm font-semibold text-gray-800 ml-2">
        {item.amount} {UNIT_LABEL[item.unit]}
      </Text>
    </View>
  );
}

function OutputItemRow({ item }: { item: OutputItem }) {
  const { bg, text } = OUTPUT_CATEGORY_COLOR[item.category];
  return (
    <View className="flex-row items-center justify-between py-1">
      <View className="flex-row items-center gap-2 flex-1">
        <View className={`px-1.5 py-0.5 rounded ${bg}`}>
          <Text className={`text-[10px] font-medium ${text}`}>
            {OUTPUT_CATEGORY_LABEL[item.category]}
          </Text>
        </View>
        {item.color ? (
          <Text className="text-xs text-gray-500">{item.color}</Text>
        ) : null}
        {item.ph_value != null ? (
          <Text className="text-xs text-gray-500">pH {item.ph_value}</Text>
        ) : null}
      </View>
      <Text className="text-sm font-semibold text-gray-800 ml-2">{item.amount_ml} ml</Text>
    </View>
  );
}

function RecordCard({ record }: { record: IntakeOutputRecord }) {
  const { intakeMl: intakeTotal, outputMl: outputTotal } = calculateBalance(
    record.intake_items ?? [],
    record.output_items ?? []
  );

  return (
    <View className="bg-white rounded-xl shadow-sm overflow-hidden mb-3">
      {/* Time header */}
      <View className="flex-row items-center justify-between px-4 py-2 bg-gray-50 border-b border-gray-100">
        <Text className="text-sm font-bold text-gray-800">{record.time_slot}</Text>
        <Text className="text-xs text-gray-400">{record.recorder}</Text>
      </View>

      <View className="px-4 py-3 gap-2">
        {/* Intake section */}
        {(record.intake_items ?? []).length > 0 ? (
          <View>
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide">攝入</Text>
              {intakeTotal > 0 && (
                <Text className="text-xs text-blue-600 font-medium">液體 {intakeTotal} ml</Text>
              )}
            </View>
            {(record.intake_items ?? []).map((item) => (
              <IntakeItemRow key={item.id} item={item} />
            ))}
          </View>
        ) : null}

        {/* Divider */}
        {(record.intake_items ?? []).length > 0 && (record.output_items ?? []).length > 0 && (
          <View className="border-t border-dashed border-gray-200" />
        )}

        {/* Output section */}
        {(record.output_items ?? []).length > 0 ? (
          <View>
            <View className="flex-row items-center justify-between mb-1">
              <Text className="text-xs font-semibold text-gray-500 uppercase tracking-wide">排出</Text>
              {outputTotal > 0 && (
                <Text className="text-xs text-yellow-600 font-medium">合計 {outputTotal} ml</Text>
              )}
            </View>
            {(record.output_items ?? []).map((item) => (
              <OutputItemRow key={item.id} item={item} />
            ))}
          </View>
        ) : null}
      </View>

      {record.notes ? (
        <View className="px-4 pb-3">
          <Text className="text-xs text-gray-500 italic">備註：{record.notes}</Text>
        </View>
      ) : null}
    </View>
  );
}

// ─── Daily summary bar ───────────────────────────────────────────────────────

function DailySummary({ records }: { records: IntakeOutputRecord[] }) {
  const allIntake = records.flatMap((r) => r.intake_items ?? []);
  const allOutput = records.flatMap((r) => r.output_items ?? []);
  const { intakeMl: totalIntakeMl, outputMl: totalOutputMl, balance } = calculateBalance(allIntake, allOutput);

  return (
    <View className="flex-row bg-white border-b border-gray-200 px-4 py-2 gap-4">
      <View className="flex-1 items-center">
        <Text className="text-[10px] text-gray-400 mb-0.5">總攝入(液體)</Text>
        <Text className="text-sm font-bold text-blue-600">{totalIntakeMl} ml</Text>
      </View>
      <View className="w-px bg-gray-200" />
      <View className="flex-1 items-center">
        <Text className="text-[10px] text-gray-400 mb-0.5">總排出</Text>
        <Text className="text-sm font-bold text-yellow-600">{totalOutputMl} ml</Text>
      </View>
      <View className="w-px bg-gray-200" />
      <View className="flex-1 items-center">
        <Text className="text-[10px] text-gray-400 mb-0.5">出入差</Text>
        <Text
          className={`text-sm font-bold ${
            balance >= 0 ? 'text-green-600' : 'text-red-600'
          }`}
        >
          {balance >= 0 ? '+' : ''}{balance} ml
        </Text>
      </View>
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function IntakeOutputDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const patientId = id ? parseInt(id, 10) : undefined;
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(TODAY);
  const [showModal, setShowModal] = useState(false);
  const [hourSlot, setHourSlot] = useState(8);
  const [recorder, setRecorder] = useState('');
  const [intakeCategory, setIntakeCategory] = useState<string>('meal');
  const [intakeType, setIntakeType] = useState('');
  const [intakeAmount, setIntakeAmount] = useState('');
  const [outputCategory, setOutputCategory] = useState<string>('urine');
  const [outputAmountMl, setOutputAmountMl] = useState('');
  const [addType, setAddType] = useState<'intake' | 'output'>('intake');

  const { data: resident } = useResident(patientId);
  const { data: records = [], isLoading } = useIntakeOutputRecords(patientId, date);
  const createRecord = useCreateIntakeOutputRecord();
  const deleteRecord = useDeleteIntakeOutputRecord();

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['intake-output', patientId, date] });
  }, [queryClient, patientId, date]);

  if (resident?.中文姓名) {
    navigation.setOptions?.({ title: `${resident.中文姓名} - 出入量` });
  }

  async function handleSave() {
    if (!patientId) return;
    const intakeItems = addType === 'intake' && intakeAmount
      ? [{ category: intakeCategory, item_type: intakeType || intakeCategory, amount: intakeAmount, amount_numeric: Number(intakeAmount) || 0, unit: 'ml' }]
      : [];
    const outputItems = addType === 'output' && outputAmountMl
      ? [{ category: outputCategory, amount_ml: Number(outputAmountMl) }]
      : [];
    if (intakeItems.length === 0 && outputItems.length === 0) {
      Alert.alert('提示', '請輸入出量或入量數值');
      return;
    }
    await createRecord.mutateAsync({ patientId, date, hourSlot, recorder: recorder || undefined, intakeItems, outputItems });
    setShowModal(false);
    setIntakeAmount(''); setOutputAmountMl(''); setIntakeType(''); setRecorder('');
  }

  const HOURS = Array.from({ length: 24 }, (_, i) => i);

  return (
    <View className="flex-1 bg-gray-50">
      <View className="bg-white border-b border-gray-200 px-4 py-3 gap-2">
        {resident && (
          <Text className="text-sm font-semibold text-gray-700">
            {resident.中文姓名}{resident.床號 ? ` · ${resident.床號}` : ''}
          </Text>
        )}
        <View className="flex-row items-center justify-between">
          <TouchableOpacity className="w-9 h-9 items-center justify-center rounded-full bg-gray-100" onPress={() => setDate((d) => addDays(d, -1))}>
            <Text className="text-base text-gray-600">‹</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => setDate(TODAY)}>
            <Text className={`text-sm font-semibold ${date === TODAY ? 'text-blue-600' : 'text-gray-800'}`}>
              {formatDate(date)}{date === TODAY ? ' (今天)' : ''}
            </Text>
          </TouchableOpacity>
          <TouchableOpacity className="w-9 h-9 items-center justify-center rounded-full bg-gray-100" onPress={() => setDate((d) => addDays(d, 1))}>
            <Text className="text-base text-gray-600">›</Text>
          </TouchableOpacity>
        </View>
      </View>

      {records.length > 0 && <DailySummary records={records} />}

      {isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#3b82f6" /></View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}>
          {records.length === 0 ? (
            <View className="items-center justify-center py-16">
              <Text className="text-gray-400 text-base">當日無出入量記錄</Text>
            </View>
          ) : (
            records.map((record) => (
              <TouchableOpacity key={record.id} onLongPress={() => Alert.alert('確認刪除', '確定刪除此記錄？', [
                { text: '取消', style: 'cancel' },
                { text: '刪除', style: 'destructive', onPress: () => deleteRecord.mutate({ id: record.id, patientId: patientId!, date }) },
              ])} activeOpacity={0.85}>
                <RecordCard record={record} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <TouchableOpacity
        className="absolute bottom-8 right-6 w-14 h-14 bg-blue-500 rounded-full items-center justify-center shadow-lg"
        style={{ elevation: 6 }}
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowModal(false)}><Text className="text-base text-gray-500">取消</Text></TouchableOpacity>
            <Text className="text-base font-semibold">新增出入量</Text>
            <TouchableOpacity onPress={handleSave} disabled={createRecord.isPending}>
              {createRecord.isPending ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text className="text-base font-semibold text-blue-500">儲存</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
            <Text className="text-sm font-medium text-gray-700 mb-1">小時段</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="mb-4">
              <View className="flex-row gap-2">
                {HOURS.map(h => (
                  <TouchableOpacity key={h} onPress={() => setHourSlot(h)}
                    className="px-3 py-2 rounded-xl border"
                    style={{ backgroundColor: hourSlot === h ? '#3b82f6' : 'white', borderColor: hourSlot === h ? '#3b82f6' : '#e5e7eb' }}>
                    <Text style={{ color: hourSlot === h ? 'white' : '#374151', fontSize: 13 }}>{String(h).padStart(2,'0')}:00</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </ScrollView>

            <Text className="text-sm font-medium text-gray-700 mb-1">類型</Text>
            <View className="flex-row gap-3 mb-4">
              {(['intake', 'output'] as const).map(t => (
                <TouchableOpacity key={t} onPress={() => setAddType(t)}
                  className="flex-1 py-3 rounded-xl border items-center"
                  style={{ backgroundColor: addType === t ? '#3b82f6' : 'white', borderColor: addType === t ? '#3b82f6' : '#e5e7eb' }}>
                  <Text style={{ color: addType === t ? 'white' : '#374151', fontSize: 14, fontWeight: '600' }}>{t === 'intake' ? '入量' : '出量'}</Text>
                </TouchableOpacity>
              ))}
            </View>

            {addType === 'intake' && (<>
              <Text className="text-sm font-medium text-gray-700 mb-1">入量類別</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {(Object.entries(INTAKE_CATEGORY_LABEL) as [string, string][]).map(([key, label]) => (
                  <TouchableOpacity key={key} onPress={() => setIntakeCategory(key)}
                    className="px-3 py-2 rounded-xl border"
                    style={{ backgroundColor: intakeCategory === key ? '#3b82f6' : 'white', borderColor: intakeCategory === key ? '#3b82f6' : '#e5e7eb' }}>
                    <Text style={{ color: intakeCategory === key ? 'white' : '#374151', fontSize: 13 }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text className="text-sm font-medium text-gray-700 mb-1">項目名稱</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={intakeType} onChangeText={setIntakeType} placeholder="如：白粥、水" />
              <Text className="text-sm font-medium text-gray-700 mb-1">數量 (ml)</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={intakeAmount} onChangeText={setIntakeAmount} keyboardType="numeric" placeholder="200" />
            </>)}

            {addType === 'output' && (<>
              <Text className="text-sm font-medium text-gray-700 mb-1">出量類別</Text>
              <View className="flex-row flex-wrap gap-2 mb-4">
                {(Object.entries(OUTPUT_CATEGORY_LABEL) as [string, string][]).map(([key, label]) => (
                  <TouchableOpacity key={key} onPress={() => setOutputCategory(key)}
                    className="px-3 py-2 rounded-xl border"
                    style={{ backgroundColor: outputCategory === key ? '#3b82f6' : 'white', borderColor: outputCategory === key ? '#3b82f6' : '#e5e7eb' }}>
                    <Text style={{ color: outputCategory === key ? 'white' : '#374151', fontSize: 13 }}>{label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              <Text className="text-sm font-medium text-gray-700 mb-1">數量 (ml)</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={outputAmountMl} onChangeText={setOutputAmountMl} keyboardType="numeric" placeholder="300" />
            </>)}

            <Text className="text-sm font-medium text-gray-700 mb-1">記錄員</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-8" value={recorder} onChangeText={setRecorder} placeholder="記錄員姓名（可選）" />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
