import { useState, useCallback } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity, ActivityIndicator,
  RefreshControl, Modal, TextInput, Alert,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useQueryClient } from '@tanstack/react-query';
import { useResident } from '@/features/residents/useResidents';
import { useHealthRecords, useCreateHealthRecord, useDeleteHealthRecord } from '@/features/health/useHealth';
import type { HealthRecord, HealthRecordType } from '@/features/health/types';
import { assessVitals } from '@/features/health/assessVitals';

type HealthTab = '生命表徵' | '血糖控制' | '體重控制';

const TABS: { key: HealthTab; label: string }[] = [
  { key: '生命表徵', label: '生命表徵' },
  { key: '血糖控制', label: '血糖' },
  { key: '體重控制', label: '體重' },
];

// ─── Vital signs card ────────────────────────────────────────────────────────

function VitalRow({ label, value, unit, warning }: { label: string; value?: number; unit: string; warning?: boolean }) {
  if (value == null) return null;
  return (
    <View className="flex-row items-center justify-between py-0.5">
      <Text className="text-xs text-gray-500 w-20">{label}</Text>
      <Text className={`text-sm font-semibold ${warning ? 'text-red-600' : 'text-gray-800'}`}>
        {value} <Text className="text-xs font-normal text-gray-400">{unit}</Text>
      </Text>
    </View>
  );
}

function VitalCard({ record }: { record: HealthRecord }) {
  const { sbpAbnormal, dbpAbnormal, bpAbnormal, spo2Low, tempAbnormal } = assessVitals(record);

  return (
    <View className="bg-white rounded-xl px-4 py-3 mb-2 shadow-sm">
      <View className="flex-row items-center justify-between mb-2">
        <Text className="text-sm font-bold text-gray-700">
          {record.記錄日期} {record.記錄時間}
        </Text>
        {record.記錄人員 ? (
          <Text className="text-xs text-gray-400">{record.記錄人員}</Text>
        ) : null}
      </View>
      {record.血壓收縮壓 != null && record.血壓舒張壓 != null ? (
        <View className="flex-row items-center justify-between py-0.5">
          <Text className="text-xs text-gray-500 w-20">血壓</Text>
          <Text className={`text-sm font-semibold ${bpAbnormal ? 'text-red-600' : 'text-gray-800'}`}>
            {record.血壓收縮壓}/{record.血壓舒張壓}{' '}
            <Text className="text-xs font-normal text-gray-400">mmHg</Text>
          </Text>
        </View>
      ) : null}
      <VitalRow label="脈搏" value={record.脈搏} unit="/min" />
      <VitalRow label="體溫" value={record.體溫} unit="°C" warning={tempAbnormal} />
      <VitalRow label="血氧" value={record.血含氧量} unit="%" warning={spo2Low} />
      <VitalRow label="呼吸" value={record.呼吸} unit="/min" />
      {record.備註 ? (
        <Text className="text-xs text-gray-400 mt-1 pt-1 border-t border-gray-100">
          {record.備註}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Blood glucose card ──────────────────────────────────────────────────────

function GlucoseCard({ record }: { record: HealthRecord }) {
  const { glucoseHigh: high, glucoseLow: low } = assessVitals(record);
  return (
    <View className="bg-white rounded-xl px-4 py-3 mb-2 shadow-sm">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold text-gray-700">
          {record.記錄日期} {record.記錄時間}
        </Text>
        <View className="flex-row items-center gap-2">
          {(high || low) && (
            <View className={`px-1.5 py-0.5 rounded ${high ? 'bg-red-100' : 'bg-yellow-100'}`}>
              <Text className={`text-[10px] font-bold ${high ? 'text-red-600' : 'text-yellow-700'}`}>
                {high ? '偏高' : '偏低'}
              </Text>
            </View>
          )}
          <Text className={`text-lg font-bold ${high ? 'text-red-600' : low ? 'text-yellow-600' : 'text-gray-800'}`}>
            {record.血糖值}
          </Text>
          <Text className="text-xs text-gray-400">mmol/L</Text>
        </View>
      </View>
      {record.記錄人員 ? (
        <Text className="text-xs text-gray-400 mt-1">{record.記錄人員}</Text>
      ) : null}
      {record.備註 ? (
        <Text className="text-xs text-gray-400 mt-1 pt-1 border-t border-gray-100">
          {record.備註}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Weight card ─────────────────────────────────────────────────────────────

function WeightCard({ record, prevRecord }: { record: HealthRecord; prevRecord?: HealthRecord }) {
  const diff =
    prevRecord?.體重 != null && record.體重 != null
      ? +(record.體重 - prevRecord.體重).toFixed(1)
      : null;

  return (
    <View className="bg-white rounded-xl px-4 py-3 mb-2 shadow-sm">
      <View className="flex-row items-center justify-between">
        <Text className="text-sm font-bold text-gray-700">
          {record.記錄日期} {record.記錄時間}
        </Text>
        <View className="flex-row items-center gap-2">
          {diff != null && diff !== 0 && (
            <Text className={`text-xs font-semibold ${diff > 0 ? 'text-red-500' : 'text-blue-500'}`}>
              {diff > 0 ? `+${diff}` : diff} kg
            </Text>
          )}
          <Text className="text-lg font-bold text-gray-800">{record.體重}</Text>
          <Text className="text-xs text-gray-400">kg</Text>
        </View>
      </View>
      {record.記錄人員 ? (
        <Text className="text-xs text-gray-400 mt-1">{record.記錄人員}</Text>
      ) : null}
      {record.備註 ? (
        <Text className="text-xs text-gray-400 mt-1 pt-1 border-t border-gray-100">
          {record.備註}
        </Text>
      ) : null}
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

const DAYS_OPTIONS = [7, 14, 30];

type CreateForm = {
  sbp: string; dbp: string; pulse: string; temp: string; spo2: string; resp: string;
  glucose: string; weight: string;
  recorder: string; notes: string;
  date: string; time: string;
};
const EMPTY_FORM: CreateForm = {
  sbp: '', dbp: '', pulse: '', temp: '', spo2: '', resp: '',
  glucose: '', weight: '', recorder: '', notes: '',
  date: new Date().toISOString().split('T')[0],
  time: new Date().toTimeString().slice(0, 5),
};

export default function HealthDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const patientId = id ? parseInt(id, 10) : undefined;
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<HealthTab>('生命表徵');
  const [days, setDays] = useState(14);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<CreateForm>(EMPTY_FORM);

  const { data: resident } = useResident(patientId);
  const { data: records = [], isLoading } = useHealthRecords(patientId, activeTab, days);
  const createRecord = useCreateHealthRecord();
  const deleteRecord = useDeleteHealthRecord();

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['health-records', patientId, activeTab, days] });
  }, [queryClient, patientId, activeTab, days]);

  if (resident?.中文姓名) {
    navigation.setOptions?.({ title: `${resident.中文姓名} - 健康記錄` });
  }

  async function handleSave() {
    if (!patientId) return;
    const base = {
      院友id: patientId,
      記錄類型: activeTab as HealthRecordType,
      記錄日期: form.date,
      記錄時間: form.time,
      記錄人員: form.recorder || undefined,
      備註: form.notes || undefined,
    };
    let payload: any = base;
    if (activeTab === '生命表徵') {
      payload = { ...base,
        血壓收縮壓: form.sbp ? Number(form.sbp) : undefined,
        血壓舒張壓: form.dbp ? Number(form.dbp) : undefined,
        脈搏: form.pulse ? Number(form.pulse) : undefined,
        體溫: form.temp ? Number(form.temp) : undefined,
        血含氧量: form.spo2 ? Number(form.spo2) : undefined,
        呼吸: form.resp ? Number(form.resp) : undefined,
      };
    } else if (activeTab === '血糖控制') {
      if (!form.glucose) { Alert.alert('提示', '請輸入血糖值'); return; }
      payload = { ...base, 血糖值: Number(form.glucose) };
    } else {
      if (!form.weight) { Alert.alert('提示', '請輸入體重'); return; }
      payload = { ...base, 體重: Number(form.weight) };
    }
    await createRecord.mutateAsync(payload);
    setShowModal(false);
    setForm(EMPTY_FORM);
  }

  function handleDelete(record: HealthRecord) {
    Alert.alert('確認刪除', '確定刪除此記錄？（長按卡片刪除）', [
      { text: '取消', style: 'cancel' },
      { text: '刪除', style: 'destructive', onPress: () => deleteRecord.mutate({ id: record.記錄id, patientId: record.院友id }) },
    ]);
  }

  return (
    <View className="flex-1 bg-gray-50">
      {resident && (
        <View className="bg-white border-b border-gray-200 px-4 py-2">
          <Text className="text-sm font-semibold text-gray-700">
            {resident.中文姓名}{resident.床號 ? ` · ${resident.床號}` : ''}
          </Text>
        </View>
      )}

      <View className="flex-row bg-white border-b border-gray-200">
        {TABS.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            className={`flex-1 py-3 items-center border-b-2 ${activeTab === tab.key ? 'border-blue-500' : 'border-transparent'}`}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text className={`text-sm font-semibold ${activeTab === tab.key ? 'text-blue-600' : 'text-gray-500'}`}>
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      <View className="flex-row bg-white border-b border-gray-100 px-4 py-2 gap-2">
        <Text className="text-xs text-gray-500 self-center mr-1">顯示近</Text>
        {DAYS_OPTIONS.map((d) => (
          <TouchableOpacity
            key={d}
            className={`px-3 py-1 rounded-full ${days === d ? 'bg-blue-500' : 'bg-gray-100'}`}
            onPress={() => setDays(d)}
          >
            <Text className={`text-xs font-semibold ${days === d ? 'text-white' : 'text-gray-600'}`}>{d} 天</Text>
          </TouchableOpacity>
        ))}
        <Text className="text-xs text-gray-400 self-center ml-auto">共 {records.length} 筆</Text>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#3b82f6" /></View>
      ) : (
        <ScrollView className="flex-1" contentContainerStyle={{ paddingHorizontal: 16, paddingTop: 16, paddingBottom: 100 }}
          refreshControl={<RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />}
        >
          {records.length === 0 ? (
            <View className="items-center justify-center py-16">
              <Text className="text-gray-400 text-base">近 {days} 天無記錄</Text>
            </View>
          ) : activeTab === '生命表徵' ? (
            records.map((r) => (
              <TouchableOpacity key={r.記錄id} onLongPress={() => handleDelete(r)} activeOpacity={0.85}>
                <VitalCard record={r} />
              </TouchableOpacity>
            ))
          ) : activeTab === '血糖控制' ? (
            records.map((r) => (
              <TouchableOpacity key={r.記錄id} onLongPress={() => handleDelete(r)} activeOpacity={0.85}>
                <GlucoseCard record={r} />
              </TouchableOpacity>
            ))
          ) : (
            records.map((r, i) => (
              <TouchableOpacity key={r.記錄id} onLongPress={() => handleDelete(r)} activeOpacity={0.85}>
                <WeightCard record={r} prevRecord={records[i + 1]} />
              </TouchableOpacity>
            ))
          )}
        </ScrollView>
      )}

      <TouchableOpacity
        className="absolute bottom-8 right-6 w-14 h-14 bg-blue-500 rounded-full items-center justify-center shadow-lg"
        style={{ elevation: 6 }}
        onPress={() => { setForm(EMPTY_FORM); setShowModal(true); }}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowModal(false)}><Text className="text-base text-gray-500">取消</Text></TouchableOpacity>
            <Text className="text-base font-semibold">新增{activeTab}</Text>
            <TouchableOpacity onPress={handleSave} disabled={createRecord.isPending}>
              {createRecord.isPending ? <ActivityIndicator size="small" color="#3b82f6" /> : <Text className="text-base font-semibold text-blue-500">儲存</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
            <View className="flex-row gap-3 mb-4">
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 mb-1">日期</Text>
                <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base" value={form.date} onChangeText={v => setForm(f => ({ ...f, date: v }))} placeholder="YYYY-MM-DD" />
              </View>
              <View className="flex-1">
                <Text className="text-sm font-medium text-gray-700 mb-1">時間</Text>
                <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base" value={form.time} onChangeText={v => setForm(f => ({ ...f, time: v }))} placeholder="HH:MM" />
              </View>
            </View>

            {activeTab === '生命表徵' && (<>
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-700 mb-1">收縮壓</Text>
                  <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base" value={form.sbp} onChangeText={v => setForm(f => ({ ...f, sbp: v }))} keyboardType="numeric" placeholder="120" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-700 mb-1">舒張壓</Text>
                  <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base" value={form.dbp} onChangeText={v => setForm(f => ({ ...f, dbp: v }))} keyboardType="numeric" placeholder="80" />
                </View>
              </View>
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-700 mb-1">脈搏 (bpm)</Text>
                  <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base" value={form.pulse} onChangeText={v => setForm(f => ({ ...f, pulse: v }))} keyboardType="numeric" placeholder="72" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-700 mb-1">體溫 (°C)</Text>
                  <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base" value={form.temp} onChangeText={v => setForm(f => ({ ...f, temp: v }))} keyboardType="decimal-pad" placeholder="36.5" />
                </View>
              </View>
              <View className="flex-row gap-3 mb-4">
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-700 mb-1">血氧 (%)</Text>
                  <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base" value={form.spo2} onChangeText={v => setForm(f => ({ ...f, spo2: v }))} keyboardType="numeric" placeholder="98" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-medium text-gray-700 mb-1">呼吸 (/min)</Text>
                  <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base" value={form.resp} onChangeText={v => setForm(f => ({ ...f, resp: v }))} keyboardType="numeric" placeholder="16" />
                </View>
              </View>
            </>)}

            {activeTab === '血糖控制' && (<>
              <Text className="text-sm font-medium text-gray-700 mb-1">血糖值 (mmol/L) *</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={form.glucose} onChangeText={v => setForm(f => ({ ...f, glucose: v }))} keyboardType="decimal-pad" placeholder="6.0" />
            </>)}

            {activeTab === '體重控制' && (<>
              <Text className="text-sm font-medium text-gray-700 mb-1">體重 (kg) *</Text>
              <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={form.weight} onChangeText={v => setForm(f => ({ ...f, weight: v }))} keyboardType="decimal-pad" placeholder="60.0" />
            </>)}

            <Text className="text-sm font-medium text-gray-700 mb-1">記錄人員</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={form.recorder} onChangeText={v => setForm(f => ({ ...f, recorder: v }))} placeholder="記錄員姓名（可選）" />

            <Text className="text-sm font-medium text-gray-700 mb-1">備註</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-8" value={form.notes} onChangeText={v => setForm(f => ({ ...f, notes: v }))} placeholder="備註（可選）" multiline numberOfLines={3} textAlignVertical="top" style={{ minHeight: 80 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
