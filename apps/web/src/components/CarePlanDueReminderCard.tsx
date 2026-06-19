import React, { useMemo } from 'react';
import { ClipboardList, ArrowRight } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface CarePlan {
  id: string;
  patient_id: number;
  plan_date: string;
  review_due_date?: string | null;
  plan_type?: string;
}

interface Patient {
  院友id: number;
  中文姓名: string;
  床號: string;
  中文姓氏?: string;
  中文名字?: string;
  在住狀態?: string;
}

interface CarePlanDueReminderCardProps {
  carePlans: CarePlan[];
  patients: Patient[];
}

// Returns true if plan is superseded by a later plan for the same patient
function isSuperseded(plan: CarePlan, allPlans: CarePlan[]): boolean {
  const patientPlans = allPlans
    .filter(p => p.patient_id === plan.patient_id)
    .sort((a, b) => new Date(a.plan_date).getTime() - new Date(b.plan_date).getTime());

  const idx = patientPlans.findIndex(p => p.id === plan.id);
  if (idx !== -1 && idx < patientPlans.length - 1) {
    const nextPlan = patientPlans[idx + 1];
    if (nextPlan && plan.review_due_date && new Date(nextPlan.plan_date) >= new Date(plan.review_due_date)) {
      return true;
    }
  }
  return false;
}

const CarePlanDueReminderCard: React.FC<CarePlanDueReminderCardProps> = ({ carePlans, patients }) => {
  const navigate = useNavigate();

  const dueThisMonth = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();

    const patientsMap = new Map(patients.map(p => [p.院友id, p]));

    return carePlans.filter(plan => {
      if (!plan.review_due_date) return false;
      const patient = patientsMap.get(plan.patient_id);
      if (!patient || patient.在住狀態 !== '在住') return false;

      const due = new Date(plan.review_due_date);
      if (due.getFullYear() !== year || due.getMonth() !== month) return false;

      return !isSuperseded(plan, carePlans);
    });
  }, [carePlans, patients]);

  if (dueThisMonth.length === 0) return null;

  const patientsMap = new Map(patients.map(p => [p.院友id, p]));

  return (
    <div className="card p-6">
      <div className="flex flex-wrap items-center gap-3">
          <div className="p-2 rounded-lg bg-green-100">
            <ClipboardList className="h-6 w-6 text-green-600" />
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">個人照顧計劃提醒</h2>
            <p className="text-sm text-gray-600">
              本月有 {dueThisMonth.length} 份照顧計劃即將到期，請安排續期
            </p>
          </div>
        </div>

      <div className="space-y-2">
        {dueThisMonth.slice(0, 5).map(plan => {
          const patient = patientsMap.get(plan.patient_id);
          return (
            <div
              key={plan.id}
              className="p-3 bg-green-50 border border-green-200 rounded-lg hover:bg-green-100 cursor-pointer flex items-center justify-between gap-3"
              onClick={() => navigate('/individual-care-plan')}
            >
              <div>
                <div className="font-medium text-green-900">
                  {patient ? `${patient.床號} ${patient.中文姓氏 ?? ''}${patient.中文名字 ?? ''}` : `院友 #${plan.patient_id}`}
                </div>
                <div className="text-sm text-green-700">
                  到期：{plan.review_due_date}
                  {plan.plan_type && ` · ${plan.plan_type}`}
                </div>
              </div>
              <ArrowRight className="h-4 w-4 text-green-600 flex-shrink-0" />
            </div>
          );
        })}
        {dueThisMonth.length > 5 && (
          <div
            className="p-3 text-center text-sm text-green-700 cursor-pointer hover:underline"
            onClick={() => navigate('/individual-care-plan')}
          >
            另有 {dueThisMonth.length - 5} 份，點擊查看全部
          </div>
        )}
      </div>
    </div>
  );
};

export default CarePlanDueReminderCard;
