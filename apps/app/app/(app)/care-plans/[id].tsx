import { useState } from 'react';
import {
  View, Text, ScrollView, TouchableOpacity,
  ActivityIndicator, Modal, TextInput, Alert,
} from 'react-native';
import { useLocalSearchParams } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import { useCarePlans, useCarePlanProblems, useCreateCarePlan, useDeleteCarePlan } from '@/features/care-plans/useCarePlans';
import type { CarePlan, CarePlanProblem, PlanType } from '@/features/care-plans/types';
import { PLAN_TYPE_COLOR, OUTCOME_COLOR } from '@/features/care-plans/types';

function formatDate(d?: string) {
  if (!d) return '—';
  return d.slice(0, 10);
}

function isOverdue(dateStr?: string) {
  if (!dateStr) return false;
  return new Date(dateStr) < new Date();
}

function ProblemCard({ problem }: { problem: CarePlanProblem }) {
  const [expanded, setExpanded] = useState(false);
  return (
    <TouchableOpacity
      onPress={() => setExpanded(!expanded)}
      className="mb-2 rounded-lg bg-white border border-gray-200 overflow-hidden"
    >
      <View className="flex-row items-center justify-between px-3 py-2.5">
        <View className="flex-row items-center gap-2 flex-1">
          <View className="bg-indigo-100 px-2 py-0.5 rounded-full">
            <Text className="text-indigo-700 text-xs font-medium">{problem.problem_category}</Text>
          </View>
          <Text className="text-sm text-gray-800 flex-1" numberOfLines={expanded ? 0 : 1}>
            {problem.problem_description}
          </Text>
        </View>
        {problem.outcome_review && (
          <View className={`ml-2 px-2 py-0.5 rounded-full ${OUTCOME_COLOR[problem.outcome_review]}`}>
            <Text className="text-xs">{problem.outcome_review}</Text>
          </View>
        )}
      </View>
      {expanded && (
        <View className="px-3 pb-3 gap-2 border-t border-gray-100">
          {problem.expected_goals?.length > 0 && (
            <View>
              <Text className="text-xs font-semibold text-gray-500 mt-2 mb-1">期待目標</Text>
              {problem.expected_goals.map((g, i) => (
                <Text key={i} className="text-sm text-gray-700">• {g}</Text>
              ))}
            </View>
          )}
          {problem.interventions?.length > 0 && (
            <View>
              <Text className="text-xs font-semibold text-gray-500 mt-1 mb-1">介入方式</Text>
              {problem.interventions.map((v, i) => (
                <Text key={i} className="text-sm text-gray-700">• {v}</Text>
              ))}
            </View>
          )}
          {problem.problem_assessor && (
            <Text className="text-xs text-gray-400 mt-1">評估者: {problem.problem_assessor}</Text>
          )}
        </View>
      )}
    </TouchableOpacity>
  );
}

function PlanDetail({ plan }: { plan: CarePlan }) {
  const { data: problems, isLoading } = useCarePlanProblems(plan.id);
  const overdue = isOverdue(plan.review_due_date) && !plan.reviewed_at;

  return (
    <View className="mb-4 rounded-xl bg-white shadow-sm overflow-hidden">
      {/* Header */}
      <View className="px-4 py-3 border-b border-gray-100 flex-row items-center justify-between">
        <View className="flex-row items-center gap-2">
          <View className={`px-2 py-0.5 rounded-full ${PLAN_TYPE_COLOR[plan.plan_type]}`}>
            <Text className="text-xs font-semibold">{plan.plan_type}</Text>
          </View>
          <Text className="text-sm font-medium text-gray-700">
            v{plan.version_number} · {formatDate(plan.plan_date)}
          </Text>
        </View>
        <View className={`px-2 py-0.5 rounded-full ${plan.status === 'active' ? 'bg-green-100' : 'bg-gray-100'}`}>
          <Text className={`text-xs ${plan.status === 'active' ? 'text-green-700' : 'text-gray-500'}`}>
            {plan.status === 'active' ? '有效' : '已歸檔'}
          </Text>
        </View>
      </View>

      {/* Review info */}
      <View className="px-4 py-2 flex-row gap-4 flex-wrap">
        <View>
          <Text className="text-xs text-gray-400">復檢到期</Text>
          <Text className={`text-sm font-medium ${overdue ? 'text-red-600' : 'text-gray-800'}`}>
            {formatDate(plan.review_due_date)}{overdue ? ' ⚠️' : ''}
          </Text>
        </View>
        {plan.reviewed_at && (
          <View>
            <Text className="text-xs text-gray-400">已復檢</Text>
            <Text className="text-sm font-medium text-gray-800">{formatDate(plan.reviewed_at)}</Text>
          </View>
        )}
        {plan.created_by && (
          <View>
            <Text className="text-xs text-gray-400">建立人</Text>
            <Text className="text-sm text-gray-700">{plan.created_by}</Text>
          </View>
        )}
      </View>

      {plan.remarks && (
        <View className="px-4 pb-2">
          <Text className="text-xs text-gray-500 italic">{plan.remarks}</Text>
        </View>
      )}

      {/* Problems */}
      <View className="px-4 py-2 border-t border-gray-100">
        <Text className="text-xs font-semibold text-gray-500 mb-2">
          問題明細 {problems ? `(${problems.length})` : ''}
        </Text>
        {isLoading ? (
          <ActivityIndicator size="small" color="#6366f1" />
        ) : !problems?.length ? (
          <Text className="text-xs text-gray-400">無問題記錄</Text>
        ) : (
          problems.map((p) => <ProblemCard key={p.id} problem={p} />)
        )}
      </View>
    </View>
  );
}

export default function CarePlansScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const patientId = parseInt(id, 10);
  const [showArchived, setShowArchived] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [form, setForm] = useState<{
    plan_type: PlanType;
    plan_date: string;
    review_due_date: string;
    created_by: string;
    remarks: string;
  }>({
    plan_type: '首月計劃',
    plan_date: new Date().toISOString().split('T')[0],
    review_due_date: '', created_by: '', remarks: '',
  });

  const { data, isLoading, isError } = useCarePlans(patientId);
  const createPlan = useCreateCarePlan();
  const deletePlan = useDeleteCarePlan();

  const filtered = data?.filter((p) => showArchived ? true : p.status === 'active');

  async function handleSave() {
    await createPlan.mutateAsync({
      patient_id: patientId,
      plan_type: form.plan_type,
      plan_date: form.plan_date,
      review_due_date: form.review_due_date || undefined,
      created_by: form.created_by || undefined,
      remarks: form.remarks || undefined,
      version_number: 1,
      status: 'active',
    });
    setShowModal(false);
    setForm({ plan_type: '首月計劃', plan_date: new Date().toISOString().split('T')[0], review_due_date: '', created_by: '', remarks: '' });
  }

  return (
    <View className="flex-1 bg-gray-100">
      <View className="flex-row gap-2 px-4 py-2 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => setShowArchived(false)}
          className={`px-4 py-1.5 rounded-full ${!showArchived ? 'bg-indigo-600' : 'bg-gray-100'}`}>
          <Text className={`text-sm font-medium ${!showArchived ? 'text-white' : 'text-gray-600'}`}>有效計劃</Text>
        </TouchableOpacity>
        <TouchableOpacity onPress={() => setShowArchived(true)}
          className={`px-4 py-1.5 rounded-full ${showArchived ? 'bg-indigo-600' : 'bg-gray-100'}`}>
          <Text className={`text-sm font-medium ${showArchived ? 'text-white' : 'text-gray-600'}`}>全部</Text>
        </TouchableOpacity>
      </View>

      {isLoading ? (
        <View className="flex-1 items-center justify-center"><ActivityIndicator size="large" color="#6366f1" /></View>
      ) : isError ? (
        <View className="flex-1 items-center justify-center px-8"><Text className="text-red-500 text-center">載入失敗</Text></View>
      ) : !filtered?.length ? (
        <View className="flex-1 items-center justify-center px-8">
          <Text className="text-gray-400 text-lg">沒有照護計劃記錄</Text>
        </View>
      ) : (
        <ScrollView contentContainerStyle={{ padding: 16, paddingBottom: 100 }}>
          {filtered.map((plan) => (
            <TouchableOpacity key={plan.id} onLongPress={() => Alert.alert('確認刪除', '確定刪除此計劃？', [
              { text: '取消', style: 'cancel' },
              { text: '刪除', style: 'destructive', onPress: () => deletePlan.mutate({ id: plan.id, patientId }) },
            ])} activeOpacity={0.85}>
              <PlanDetail plan={plan} />
            </TouchableOpacity>
          ))}
        </ScrollView>
      )}

      <TouchableOpacity
        className="absolute bottom-8 right-6 w-14 h-14 bg-indigo-600 rounded-full items-center justify-center shadow-lg"
        style={{ elevation: 6 }}
        onPress={() => setShowModal(true)}
      >
        <Ionicons name="add" size={28} color="white" />
      </TouchableOpacity>

      <Modal visible={showModal} animationType="slide" presentationStyle="pageSheet">
        <View className="flex-1 bg-gray-50">
          <View className="flex-row items-center justify-between px-4 py-4 bg-white border-b border-gray-200">
            <TouchableOpacity onPress={() => setShowModal(false)}><Text className="text-base text-gray-500">取消</Text></TouchableOpacity>
            <Text className="text-base font-semibold">新增照護計劃</Text>
            <TouchableOpacity onPress={handleSave} disabled={createPlan.isPending}>
              {createPlan.isPending ? <ActivityIndicator size="small" color="#6366f1" /> : <Text className="text-base font-semibold text-indigo-600">儲存</Text>}
            </TouchableOpacity>
          </View>
          <ScrollView className="flex-1 px-4 pt-4" keyboardShouldPersistTaps="handled">
            <Text className="text-sm font-medium text-gray-700 mb-1">計劃類型</Text>
            <View className="flex-row gap-3 mb-4">
              {(['首月計劃', '半年計劃', '年度計劃'] as const).map(t => (
                <TouchableOpacity key={t} onPress={() => setForm(f => ({ ...f, plan_type: t }))}
                  className="flex-1 py-3 rounded-xl border items-center"
                  style={{ backgroundColor: form.plan_type === t ? '#6366f1' : 'white', borderColor: form.plan_type === t ? '#6366f1' : '#e5e7eb' }}>
                  <Text style={{ color: form.plan_type === t ? 'white' : '#374151', fontSize: 13, fontWeight: '600' }}>{t}</Text>
                </TouchableOpacity>
              ))}
            </View>
            <Text className="text-sm font-medium text-gray-700 mb-1">計劃日期</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={form.plan_date} onChangeText={v => setForm(f => ({ ...f, plan_date: v }))} placeholder="YYYY-MM-DD" />
            <Text className="text-sm font-medium text-gray-700 mb-1">複查日期</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={form.review_due_date} onChangeText={v => setForm(f => ({ ...f, review_due_date: v }))} placeholder="YYYY-MM-DD（可選）" />
            <Text className="text-sm font-medium text-gray-700 mb-1">建立人</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-4" value={form.created_by} onChangeText={v => setForm(f => ({ ...f, created_by: v }))} placeholder="姓名（可選）" />
            <Text className="text-sm font-medium text-gray-700 mb-1">備註</Text>
            <TextInput className="bg-white border border-gray-200 rounded-xl px-3 py-3 text-base mb-8" value={form.remarks} onChangeText={v => setForm(f => ({ ...f, remarks: v }))} placeholder="備註（可選）" multiline numberOfLines={3} textAlignVertical="top" style={{ minHeight: 80 }} />
          </ScrollView>
        </View>
      </Modal>
    </View>
  );
}
