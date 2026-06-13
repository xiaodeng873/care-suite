export type PlanType = '首月計劃' | '半年計劃' | '年度計劃';
export type PlanStatus = 'active' | 'archived';
export type ProblemCategory = '護理' | '社工' | '物理治療' | '職業治療' | '言語治療' | '營養師' | '醫生';
export type OutcomeReview = '保持現狀' | '滿意' | '部分滿意' | '需要持續改善';

export interface CarePlan {
  id: string;
  patient_id: number;
  parent_plan_id?: string;
  version_number: number;
  plan_type: PlanType;
  plan_date: string;
  review_due_date?: string;
  reviewed_at?: string;
  reviewed_by?: string;
  created_by?: string;
  status: PlanStatus;
  archived_at?: string;
  remarks?: string;
  created_at: string;
  updated_at: string;
}

export interface CarePlanProblem {
  id: string;
  care_plan_id: string;
  problem_category: ProblemCategory;
  problem_description: string;
  expected_goals: string[];
  interventions: string[];
  outcome_review?: OutcomeReview;
  problem_assessor?: string;
  outcome_assessor?: string;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export const PLAN_TYPE_COLOR: Record<PlanType, string> = {
  '首月計劃': 'bg-blue-100 text-blue-700',
  '半年計劃': 'bg-green-100 text-green-700',
  '年度計劃': 'bg-purple-100 text-purple-700',
};

export const OUTCOME_COLOR: Record<OutcomeReview, string> = {
  '保持現狀': 'bg-gray-100 text-gray-700',
  '滿意': 'bg-green-100 text-green-700',
  '部分滿意': 'bg-yellow-100 text-yellow-700',
  '需要持續改善': 'bg-red-100 text-red-700',
};
