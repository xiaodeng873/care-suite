import { useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  RefreshControl,
} from 'react-native';
import { useLocalSearchParams, useNavigation } from 'expo-router';
import { useQueryClient } from '@tanstack/react-query';
import { useResident } from '@/features/residents/useResidents';
import { usePrescriptions, useWorkflowRecords, useUpdateWorkflowStep } from '@/features/medications/useMedications';
import type { MedicationPrescription, MedicationWorkflowRecord, WorkflowStatusType } from '@/features/medications/types';

type MedTab = 'mar' | 'prescriptions';

const TODAY = new Date().toISOString().slice(0, 10);

function formatDate(iso: string): string {
  const [y, m, d] = iso.split('-');
  return `${y}/${m}/${d}`;
}

function addDays(iso: string, n: number): string {
  const d = new Date(iso);
  d.setDate(d.getDate() + n);
  return d.toISOString().slice(0, 10);
}

// ─── Status badge ────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<WorkflowStatusType, string> = {
  pending: '待處理',
  completed: '已完成',
  failed: '失敗',
};
const STATUS_CLASS: Record<WorkflowStatusType, { bg: string; text: string }> = {
  pending: { bg: 'bg-yellow-100', text: 'text-yellow-700' },
  completed: { bg: 'bg-green-100', text: 'text-green-700' },
  failed: { bg: 'bg-red-100', text: 'text-red-700' },
};

function StatusBadge({
  status,
  onPress,
  loading,
}: {
  status: WorkflowStatusType;
  onPress?: () => void;
  loading?: boolean;
}) {
  const { bg, text } = STATUS_CLASS[status] ?? STATUS_CLASS.pending;
  if (onPress) {
    return (
      <TouchableOpacity
        className={`px-2 py-0.5 rounded-full ${bg} ${loading ? 'opacity-50' : ''}`}
        onPress={onPress}
        disabled={loading}
        activeOpacity={0.6}
      >
        <Text className={`text-xs font-medium ${text}`}>{loading ? '…' : STATUS_LABEL[status]}</Text>
      </TouchableOpacity>
    );
  }
  return (
    <View className={`px-2 py-0.5 rounded-full ${bg}`}>
      <Text className={`text-xs font-medium ${text}`}>{STATUS_LABEL[status]}</Text>
    </View>
  );
}

// ─── MAR tab ─────────────────────────────────────────────────────────────────

function MARTab({
  prescriptions,
  workflowRecords,
}: {
  prescriptions: MedicationPrescription[];
  workflowRecords: MedicationWorkflowRecord[];
}) {
  const updateStep = useUpdateWorkflowStep();
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  function toggle(
    rec: MedicationWorkflowRecord,
    step: 'preparation_status' | 'verification_status' | 'dispensing_status'
  ) {
    const key = `${rec.id}:${step}`;
    if (pendingKey === key) return;
    const current = rec[step];
    const next: WorkflowStatusType = current === 'completed' ? 'pending' : 'completed';
    setPendingKey(key);
    updateStep.mutate(
      { id: rec.id, step, status: next },
      { onSettled: () => setPendingKey(null) }
    );
  }
  if (prescriptions.length === 0) {
    return (
      <View className="items-center justify-center py-16">
        <Text className="text-gray-400 text-base">今日無藥物記錄</Text>
      </View>
    );
  }

  // group workflow records by prescription_id → scheduled_time
  const recordMap: Record<string, MedicationWorkflowRecord[]> = {};
  for (const rec of workflowRecords) {
    if (!recordMap[rec.prescription_id]) recordMap[rec.prescription_id] = [];
    recordMap[rec.prescription_id].push(rec);
  }

  return (
    <View className="gap-3">
      {prescriptions.map((rx) => {
        const records = recordMap[rx.id] ?? [];
        return (
          <View key={rx.id} className="bg-white rounded-xl p-4 shadow-sm">
            <View className="flex-row items-start justify-between mb-2">
              <View className="flex-1">
                <Text className="text-base font-bold text-gray-900">{rx.medication_name}</Text>
                {rx.dosage_amount ? (
                  <Text className="text-sm text-gray-500">
                    {rx.dosage_amount}
                    {rx.dosage_unit ? ` ${rx.dosage_unit}` : ''}
                    {rx.administration_route ? ` · ${rx.administration_route}` : ''}
                  </Text>
                ) : null}
              </View>
              {rx.is_prn && (
                <View className="bg-purple-100 px-2 py-0.5 rounded-full ml-2">
                  <Text className="text-xs font-medium text-purple-700">PRN</Text>
                </View>
              )}
            </View>

            {rx.medication_time_slots && rx.medication_time_slots.length > 0 ? (
              <View className="gap-1.5 mt-1">
                {rx.medication_time_slots.map((slot) => {
                  const rec = records.find((r) => r.scheduled_time === slot);
                  return (
                    <View key={slot} className="flex-row items-center justify-between bg-gray-50 rounded-lg px-3 py-2">
                      <Text className="text-sm font-mono text-gray-700">{slot}</Text>
                      <View className="flex-row gap-1.5">
                        {/* Preparation */}
                        {rec ? (
                          <>
                            <View className="items-center">
                              <Text className="text-[10px] text-gray-400 mb-0.5">執藥</Text>
                              <StatusBadge
                                status={rec.preparation_status}
                                loading={pendingKey === `${rec.id}:preparation_status`}
                                onPress={() => toggle(rec, 'preparation_status')}
                              />
                            </View>
                            <View className="items-center">
                              <Text className="text-[10px] text-gray-400 mb-0.5">核藥</Text>
                              <StatusBadge
                                status={rec.verification_status}
                                loading={pendingKey === `${rec.id}:verification_status`}
                                onPress={() => toggle(rec, 'verification_status')}
                              />
                            </View>
                            <View className="items-center">
                              <Text className="text-[10px] text-gray-400 mb-0.5">派藥</Text>
                              <StatusBadge
                                status={rec.dispensing_status}
                                loading={pendingKey === `${rec.id}:dispensing_status`}
                                onPress={() => toggle(rec, 'dispensing_status')}
                              />
                              {rec.dispensing_failure_reason ? (
                                <Text className="text-[10px] text-red-500 mt-0.5">
                                  {rec.dispensing_failure_reason}
                                </Text>
                              ) : null}
                            </View>
                          </>
                        ) : (
                          <Text className="text-xs text-gray-400 italic">未記錄</Text>
                        )}
                      </View>
                    </View>
                  );
                })}
              </View>
            ) : (
              <Text className="text-xs text-gray-400 italic mt-1">未設定時間</Text>
            )}

            {rx.notes ? (
              <Text className="text-xs text-gray-500 mt-2">備註：{rx.notes}</Text>
            ) : null}
          </View>
        );
      })}
    </View>
  );
}

// ─── Prescriptions tab ───────────────────────────────────────────────────────

const FREQ_LABEL: Record<string, string> = {
  daily: '每日',
  weekly: '每週',
  biweekly: '隔週',
  monthly: '每月',
  specific_days: '指定星期',
  odd_even: '單/雙日',
};

function PrescriptionsTab({ prescriptions }: { prescriptions: MedicationPrescription[] }) {
  if (prescriptions.length === 0) {
    return (
      <View className="items-center justify-center py-16">
        <Text className="text-gray-400 text-base">無有效處方</Text>
      </View>
    );
  }

  return (
    <View className="gap-3">
      {prescriptions.map((rx) => (
        <View key={rx.id} className="bg-white rounded-xl p-4 shadow-sm">
          <View className="flex-row items-start justify-between">
            <View className="flex-1">
              <Text className="text-base font-bold text-gray-900">{rx.medication_name}</Text>
              <Text className="text-xs text-gray-400 mt-0.5">來源：{rx.medication_source}</Text>
            </View>
            {rx.is_prn && (
              <View className="bg-purple-100 px-2 py-0.5 rounded-full ml-2">
                <Text className="text-xs font-medium text-purple-700">PRN</Text>
              </View>
            )}
          </View>

          <View className="mt-2 gap-1">
            {rx.dosage_amount ? (
              <Text className="text-sm text-gray-600">
                劑量：{rx.dosage_amount}
                {rx.dosage_unit ? ` ${rx.dosage_unit}` : ''}
                {rx.dosage_form ? ` (${rx.dosage_form})` : ''}
              </Text>
            ) : null}
            {rx.administration_route ? (
              <Text className="text-sm text-gray-600">途徑：{rx.administration_route}</Text>
            ) : null}
            <Text className="text-sm text-gray-600">
              頻率：{FREQ_LABEL[rx.frequency_type] ?? rx.frequency_type}
            </Text>
            {rx.medication_time_slots && rx.medication_time_slots.length > 0 ? (
              <Text className="text-sm text-gray-600">
                時間：{rx.medication_time_slots.join('、')}
              </Text>
            ) : null}
            {rx.meal_timing ? (
              <Text className="text-sm text-gray-600">餐次：{rx.meal_timing}</Text>
            ) : null}
            <Text className="text-sm text-gray-600">
              開始：{formatDate(rx.start_date)}
              {rx.end_date ? ` ～ ${formatDate(rx.end_date)}` : ''}
            </Text>
          </View>

          {rx.notes ? (
            <Text className="text-xs text-gray-500 mt-2 pt-2 border-t border-gray-100">
              備註：{rx.notes}
            </Text>
          ) : null}
        </View>
      ))}
    </View>
  );
}

// ─── Screen ──────────────────────────────────────────────────────────────────

export default function MedicationsDetail() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const patientId = id ? parseInt(id, 10) : undefined;
  const navigation = useNavigation();
  const queryClient = useQueryClient();

  const [activeTab, setActiveTab] = useState<MedTab>('mar');
  const [date, setDate] = useState(TODAY);

  const { data: resident } = useResident(patientId);
  const { data: prescriptions = [], isLoading: rxLoading } = usePrescriptions(patientId);
  const { data: workflowRecords = [], isLoading: wfLoading } = useWorkflowRecords(patientId, date);

  const isLoading = rxLoading || wfLoading;

  const handleRefresh = useCallback(() => {
    queryClient.invalidateQueries({ queryKey: ['prescriptions', patientId] });
    queryClient.invalidateQueries({ queryKey: ['medication-workflow', patientId, date] });
  }, [queryClient, patientId, date]);

  // Update header title when resident data loads
  if (resident?.中文姓名) {
    navigation.setOptions?.({ title: `${resident.中文姓名} - 藥物` });
  }

  const tabs: { key: MedTab; label: string }[] = [
    { key: 'mar', label: '今日用藥' },
    { key: 'prescriptions', label: '有效處方' },
  ];

  return (
    <View className="flex-1 bg-gray-50">
      {/* Header: resident + date navigator (MAR tab only) */}
      <View className="bg-white border-b border-gray-200 px-4 py-3 gap-2">
        {resident && (
          <Text className="text-sm font-semibold text-gray-700">
            {resident.中文姓名}
            {resident.床號 ? ` · ${resident.床號}` : ''}
          </Text>
        )}

        {activeTab === 'mar' && (
          <View className="flex-row items-center justify-between">
            <TouchableOpacity
              className="w-9 h-9 items-center justify-center rounded-full bg-gray-100"
              onPress={() => setDate((d) => addDays(d, -1))}
            >
              <Text className="text-base text-gray-600">‹</Text>
            </TouchableOpacity>

            <TouchableOpacity onPress={() => setDate(TODAY)}>
              <Text
                className={`text-sm font-semibold ${
                  date === TODAY ? 'text-blue-600' : 'text-gray-800'
                }`}
              >
                {formatDate(date)}
                {date === TODAY ? ' (今天)' : ''}
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              className="w-9 h-9 items-center justify-center rounded-full bg-gray-100"
              onPress={() => setDate((d) => addDays(d, 1))}
            >
              <Text className="text-base text-gray-600">›</Text>
            </TouchableOpacity>
          </View>
        )}
      </View>

      {/* Tab bar */}
      <View className="flex-row bg-white border-b border-gray-200">
        {tabs.map((tab) => (
          <TouchableOpacity
            key={tab.key}
            className={`flex-1 py-3 items-center border-b-2 ${
              activeTab === tab.key ? 'border-blue-500' : 'border-transparent'
            }`}
            onPress={() => setActiveTab(tab.key)}
          >
            <Text
              className={`text-sm font-semibold ${
                activeTab === tab.key ? 'text-blue-600' : 'text-gray-500'
              }`}
            >
              {tab.label}
            </Text>
          </TouchableOpacity>
        ))}
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color="#3b82f6" />
        </View>
      ) : (
        <ScrollView
          className="flex-1"
          contentContainerClassName="px-4 py-4 pb-12"
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={handleRefresh} />
          }
        >
          {activeTab === 'mar' ? (
            <MARTab prescriptions={prescriptions} workflowRecords={workflowRecords} />
          ) : (
            <PrescriptionsTab prescriptions={prescriptions} />
          )}
        </ScrollView>
      )}
    </View>
  );
}
