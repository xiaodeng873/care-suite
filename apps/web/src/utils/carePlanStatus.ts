import type { CarePlan } from '../lib/database';

export type CarePlanStatus = '生效中' | '待檢討' | '已完成' | '待生效';

/**
 * 計算 ICP 的顯示狀態。
 * 優先順序：待生效 > 已完成 > 待檢討 > 生效中
 */
export function getCarePlanStatus(plan: CarePlan, asOf: Date = new Date()): CarePlanStatus {
  if (plan.status === '待生效') {
    return '待生效';
  }

  const today = asOf.toISOString().split('T')[0];

  // 已完成：同時有檢討日期和會議日期
  if (plan.review_date && plan.case_conference_date) {
    return '已完成';
  }

  // 已過複檢到期日但尚未完成檢討 + 會議
  if (plan.review_due_date && plan.review_due_date < today) {
    return '待檢討';
  }

  // 在計劃日期與複檢到期日之間
  if (plan.plan_date <= today && (!plan.review_due_date || plan.review_due_date >= today)) {
    return '生效中';
  }

  // 未來計劃（理論上應以 status = 待生效 標記）
  return '待生效';
}

export function isPlanActive(plan: CarePlan, asOf: Date = new Date()): boolean {
  return getCarePlanStatus(plan, asOf) === '生效中';
}

export function getActiveCarePlan(
  carePlans: CarePlan[],
  patientId: number,
  asOf: Date = new Date()
): CarePlan | null {
  const plans = carePlans
    .filter(p => p.patient_id === patientId && isPlanActive(p, asOf))
    .sort((a, b) => new Date(b.plan_date).getTime() - new Date(a.plan_date).getTime());
  return plans[0] || null;
}

export function hasInProgressCarePlan(
  carePlans: CarePlan[],
  patientId: number,
  asOf: Date = new Date()
): boolean {
  return carePlans.some(p => p.patient_id === patientId && isPlanActive(p, asOf));
}

export function getCarePlanStatusColor(status: CarePlanStatus): string {
  switch (status) {
    case '生效中':
      return 'bg-green-100 text-green-800';
    case '待檢討':
      return 'bg-red-100 text-red-800';
    case '已完成':
      return 'bg-blue-100 text-blue-800';
    case '待生效':
      return 'bg-gray-100 text-gray-800';
    default:
      return 'bg-gray-100 text-gray-800';
  }
}

export function getCarePlanStatusLabel(status: CarePlanStatus): string {
  if (status === '待檢討') return '待處理';
  return status;
}
