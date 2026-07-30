import React, { useMemo, useState } from 'react';
import { X, Users, Printer, Plus } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { getCarePlanStatus } from '../utils/carePlanStatus';
import { generateCaseConferenceListHtml } from '../utils/caseConferenceListPrintGenerator';
import { formatDisplayDate } from '../utils/dateFormat';
import type { CarePlan, Patient } from '../lib/database';
import BedNumberImprint from './BedNumberImprint';
import type {
  CaseConferenceGroupInput,
  CaseConferenceRoomInput,
  CaseConferencePlanInput,
} from '../utils/caseConferenceListPrintGenerator';

interface CaseConferenceListModalProps {
  isOpen: boolean;
  onClose: () => void;
  carePlans: CarePlan[];
  patients: Patient[];
  onSave?: () => void;
}

function getStationCode(bedNumber: string): string {
  const match = bedNumber.match(/^([A-Za-z]+)/);
  return match ? match[1] : '未分區';
}

function getRoomNumber(bedNumber: string): string {
  const i = bedNumber.lastIndexOf('-');
  if (i > 0) return bedNumber.slice(0, i);
  return bedNumber;
}

function buildPrintGroups(
  plans: CarePlan[],
  patients: Patient[]
): CaseConferenceGroupInput[] {
  const stationMap = new Map<string, { stationName: string; roomMap: Map<string, CaseConferencePlanInput[]> }>();

  for (const plan of plans) {
    const patient = patients.find(p => p.院友id === plan.patient_id);
    const bedNumber = patient?.床號 || '-';
    const stationCode = getStationCode(bedNumber);
    const stationName = `${stationCode}區`;
    const roomNumber = getRoomNumber(bedNumber);
    const patientName = patient?.中文姓名 || '-';

    const professionals = (plan.case_conference_professionals || []).map(p => ({
      category: p.category,
      assessor: p.assessor,
      assessmentDate: p.assessment_date,
    }));

    if (!stationMap.has(stationName)) {
      stationMap.set(stationName, { stationName, roomMap: new Map() });
    }
    const group = stationMap.get(stationName)!;
    if (!group.roomMap.has(roomNumber)) {
      group.roomMap.set(roomNumber, []);
    }
    group.roomMap.get(roomNumber)!.push({
      bedNumber,
      patientName,
      planType: plan.plan_type,
      reviewDueDate: plan.review_due_date || '',
      professionals,
    });
  }

  const groups: CaseConferenceGroupInput[] = [];
  for (const { stationName, roomMap } of stationMap.values()) {
    const roomsArr = Array.from(roomMap.entries()).sort((a, b) =>
      a[0].localeCompare(b[0], 'zh-Hant', { numeric: true })
    );
    groups.push({
      stationName,
      rooms: roomsArr.map(([roomNumber, roomPlans]) => ({
        roomNumber,
        plans: roomPlans.sort((a, b) =>
          a.bedNumber.localeCompare(b.bedNumber, 'zh-Hant', { numeric: true })
        ),
      })),
    });
  }

  return groups.sort((a, b) => a.stationName.localeCompare(b.stationName, 'zh-Hant'));
}

const CaseConferenceListModal: React.FC<CaseConferenceListModalProps> = ({
  isOpen,
  onClose,
  carePlans,
  patients,
  onSave,
}) => {
  const { updateCarePlan, refreshCarePlanData } = usePatients();
  const [meetingDate, setMeetingDate] = useState(() => new Date().toISOString().split('T')[0]);
  const [selectedPlanIds, setSelectedPlanIds] = useState<Set<string>>(new Set());
  const [saving, setSaving] = useState(false);

  const activePlans = useMemo(
    () => carePlans.filter(p => getCarePlanStatus(p) === '生效中'),
    [carePlans]
  );

  const selectedPlans = useMemo(
    () => activePlans.filter(p => selectedPlanIds.has(p.id)),
    [activePlans, selectedPlanIds]
  );

  const otherActiveOptions = useMemo(
    () => activePlans.filter(p => !selectedPlanIds.has(p.id)),
    [activePlans, selectedPlanIds]
  );

  const handleGenerate = () => {
    const ids = new Set<string>();
    activePlans.forEach(plan => {
      if (plan.review_due_date && plan.review_due_date <= meetingDate) {
        ids.add(plan.id);
      }
    });
    setSelectedPlanIds(ids);
  };

  const togglePlan = (planId: string) => {
    setSelectedPlanIds(prev => {
      const next = new Set(prev);
      if (next.has(planId)) {
        next.delete(planId);
      } else {
        next.add(planId);
      }
      return next;
    });
  };

  const handleAddOther = (planId: string) => {
    if (!planId) return;
    setSelectedPlanIds(prev => new Set(prev).add(planId));
  };

  const handleSelectAll = () => {
    if (selectedPlanIds.size > 0 && selectedPlans.every(p => selectedPlanIds.has(p.id))) {
      setSelectedPlanIds(new Set());
    } else {
      setSelectedPlanIds(new Set(selectedPlans.map(p => p.id)));
    }
  };

  const handleConfirm = async () => {
    if (selectedPlanIds.size === 0) {
      alert('請先選擇至少一份 ICP');
      return;
    }
    setSaving(true);
    try {
      await Promise.all(
        Array.from(selectedPlanIds).map(async planId => {
          const plan = carePlans.find(p => p.id === planId);
          if (!plan) return;
          const updates: Partial<CarePlan> = { case_conference_date: meetingDate };
          if (plan.review_date) {
            updates.status = '已完成';
          }
          await updateCarePlan(planId, updates);
        })
      );
      await refreshCarePlanData();
      onSave?.();
      onClose();
    } catch (error) {
      console.error('儲存個案會議名單失敗:', error);
      alert('儲存失敗，請重試');
    } finally {
      setSaving(false);
    }
  };

  const handlePrint = () => {
    if (selectedPlanIds.size === 0) {
      alert('請先選擇至少一份 ICP');
      return;
    }
    const selectedPlans = carePlans.filter(p => selectedPlanIds.has(p.id));
    const groups = buildPrintGroups(selectedPlans, patients);
    const html = generateCaseConferenceListHtml({ meetingDate, groups });
    const win = window.open('', '_blank');
    if (!win) {
      alert('無法開啟列印視窗，請檢查瀏覽器彈出視窗設定');
      return;
    }
    win.document.open();
    win.document.write(html);
    win.document.close();
    win.focus();
    setTimeout(() => win.print(), 300);
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
          <div className="flex items-center gap-2">
            <Users className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-medium text-gray-900">個案會議名單</h3>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
            disabled={saving}
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="px-6 py-4 space-y-4 overflow-y-auto">
          <div className="flex flex-wrap items-center gap-3">
            <label className="text-sm font-medium text-gray-700">會議日期</label>
            <input
              type="date"
              value={meetingDate}
              onChange={e => setMeetingDate(e.target.value)}
              className="form-input"
            />
            <button
              onClick={handleGenerate}
              className="btn-secondary flex items-center gap-2"
              disabled={saving}
            >
              <Plus className="h-4 w-4" />
              <span>生成名單</span>
            </button>
          </div>

          <div>
            <div className="flex items-center justify-between mb-2">
              <h4 className="text-sm font-medium text-gray-700">
                已選 ICP 名單（共 {selectedPlans.length} 份）
              </h4>
              {selectedPlans.length > 0 && (
                <label className="inline-flex items-center gap-1 text-sm text-gray-600 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPlanIds.size === selectedPlans.length}
                    onChange={handleSelectAll}
                    className="form-checkbox"
                    disabled={saving}
                  />
                  全選
                </label>
              )}
            </div>
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <table className="min-w-full divide-y divide-gray-200">
                <thead className="bg-gray-50">
                  <tr>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      選取
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      床號
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      姓名
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      計劃類型
                    </th>
                    <th className="px-3 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                      複檢到期日
                    </th>
                  </tr>
                </thead>
                <tbody className="bg-white divide-y divide-gray-200">
                  {selectedPlans.length === 0 ? (
                    <tr>
                      <td
                        colSpan={5}
                        className="px-4 py-8 text-center text-sm text-gray-500"
                      >
                        請選擇會議日期並按「生成名單」，或從下方加入其他生效中 ICP
                      </td>
                    </tr>
                  ) : (
                    selectedPlans.map(plan => {
                      const patient = patients.find(p => p.院友id === plan.patient_id);
                      return (
                        <tr key={plan.id}>
                          <td className="px-3 py-2">
                            <input
                              type="checkbox"
                              checked={selectedPlanIds.has(plan.id)}
                              onChange={() => togglePlan(plan.id)}
                              className="form-checkbox"
                              disabled={saving}
                            />
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900">
                            {patient ? <BedNumberImprint patient={patient} size="sm" className="text-sm text-gray-900" /> : '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900">
                            {patient?.中文姓名 || '-'}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900">
                            {plan.plan_type}
                          </td>
                          <td className="px-3 py-2 text-sm text-gray-900">
                            {plan.review_due_date
                              ? formatDisplayDate(`${plan.review_due_date}T00:00:00`)
                              : '-'}
                          </td>
                        </tr>
                      );
                    })
                  )}
                </tbody>
              </table>
            </div>
          </div>

          <div className="flex items-center gap-3">
            <select
              value=""
              onChange={e => {
                handleAddOther(e.target.value);
                e.target.value = '';
              }}
              className="form-select"
              disabled={saving || otherActiveOptions.length === 0}
            >
              <option value="">+ 加入其他生效中 ICP</option>
              {otherActiveOptions.map(plan => {
                const patient = patients.find(p => p.院友id === plan.patient_id);
                return (
                  <option key={plan.id} value={plan.id}>
                    {patient ? <BedNumberImprint patient={patient} size="sm" className="text-sm" /> : '-'} {patient?.中文姓名 || '-'} · {plan.plan_type}
                    {plan.review_due_date ? `（複檢到期 ${plan.review_due_date}）` : ''}
                  </option>
                );
              })}
            </select>
          </div>
        </div>

        <div className="flex justify-end gap-3 px-6 py-4 bg-gray-50 border-t border-gray-200">
          <button onClick={onClose} className="btn-secondary" disabled={saving}>
            取消
          </button>
          <button
            onClick={handleConfirm}
            className="btn-primary flex items-center gap-2"
            disabled={saving || selectedPlanIds.size === 0}
          >
            {saving ? '儲存中...' : '確定'}
          </button>
          <button
            onClick={handlePrint}
            className="btn-secondary flex items-center gap-2"
            disabled={saving || selectedPlanIds.size === 0}
          >
            <Printer className="h-4 w-4" />
            列印
          </button>
        </div>
      </div>
    </div>
  );
};

export default CaseConferenceListModal;
