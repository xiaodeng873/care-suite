import React, { useState } from 'react';
import { Clock, Pill, ChevronDown, ChevronUp, ArrowRight, PackageX, User } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface Patient {
  院友id: number;
  中文姓名: string;
  床號: string;
  中文姓氏?: string;
  中文名字?: string;
  院友相片?: string;
}

interface OverdueWorkflow {
  patient: Patient;
  overdueCount: number;
  dates: { [date: string]: number };
}

interface PendingPrescription {
  patient: Patient;
  count: number;
}

export interface LowStockGroup {
  patient: Patient;
  source: string;
  specialty: string;
  prescriptionDate: string;
  estimatedEndDate: string;
  remainingDays: number;
  count: number;
}

interface MedicationRemindersCardProps {
  overdueWorkflows: OverdueWorkflow[];
  pendingPrescriptions: PendingPrescription[];
  lowStockGroups?: LowStockGroup[];
}

const MedicationRemindersCard: React.FC<MedicationRemindersCardProps> = ({
  overdueWorkflows,
  pendingPrescriptions,
  lowStockGroups = [],
}) => {
  const navigate = useNavigate();
  const [showAllOverdue, setShowAllOverdue] = useState(false);
  const [showAllPending, setShowAllPending] = useState(false);
  const [showAllLowStock, setShowAllLowStock] = useState(false);
  const [expandedPatients, setExpandedPatients] = useState<Set<number>>(new Set());

  if (overdueWorkflows.length === 0 && pendingPrescriptions.length === 0 && lowStockGroups.length === 0) return null;

  const displayOverdue = showAllOverdue ? overdueWorkflows : overdueWorkflows.slice(0, 2);
  const displayPending = showAllPending ? pendingPrescriptions : pendingPrescriptions.slice(0, 2);
  const displayLowStock = showAllLowStock ? lowStockGroups : lowStockGroups.slice(0, 3);

  const togglePatientExpand = (patientId: number, e: React.MouseEvent) => {
    e.stopPropagation();
    setExpandedPatients(prev => {
      const next = new Set(prev);
      next.has(patientId) ? next.delete(patientId) : next.add(patientId);
      return next;
    });
  };

  return (
    <div className="card p-6 space-y-6">
      <div className="flex flex-wrap items-center gap-3">
        <div className="p-2 rounded-lg bg-amber-100">
          <Clock className="h-6 w-6 text-amber-600" />
        </div>
        <div>
          <h2 className="text-lg font-semibold text-gray-900">藥物管理提醒</h2>
          <p className="text-sm text-gray-600">
            {overdueWorkflows.length > 0 && `${overdueWorkflows.length} 位逾期執核`}
            {overdueWorkflows.length > 0 && pendingPrescriptions.length > 0 && ' · '}
            {pendingPrescriptions.length > 0 && `${pendingPrescriptions.length} 位待變更處方`}
            {(overdueWorkflows.length > 0 || pendingPrescriptions.length > 0) && lowStockGroups.length > 0 && ' · '}
            {lowStockGroups.length > 0 && `${lowStockGroups.length} 組藥物庫存不足`}
          </p>
        </div>
      </div>

      {/* 執核派藥逾期 */}
      {overdueWorkflows.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Clock className="h-4 w-4 text-amber-600" />
            <span className="text-sm font-medium text-amber-800">執核派藥逾期</span>
          </div>
          <div className="space-y-2">
            {displayOverdue.map((item) => {
              const dateEntries = Object.entries(item.dates).sort();
              const isExpanded = expandedPatients.has(item.patient.院友id);
              return (
                <div key={item.patient.院友id} className="bg-amber-50 border border-amber-200 rounded-lg">
                  <div
                    className="p-3 hover:bg-amber-100 cursor-pointer"
                    onClick={() => navigate(`/medication-workflow?patientId=${item.patient.院友id}`)}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex items-center gap-3 flex-1">
                        <div className="w-10 h-10 rounded-full bg-amber-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                          {item.patient.院友相片 ? (
                            <img src={item.patient.院友相片} alt="" className="w-full h-full object-cover" />
                          ) : (
                            <User className="h-5 w-5 text-amber-600" />
                          )}
                        </div>
                        <div className="flex-1">
                          <div className="font-medium text-amber-900">
                            {item.patient.中文姓氏}{item.patient.中文名字} <span className="text-xs text-amber-600">({item.patient.床號})</span>
                          </div>
                          <div className="text-sm text-amber-700">
                            {item.overdueCount} 個逾期流程 · {dateEntries.length} 個日期
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={(e) => togglePatientExpand(item.patient.院友id, e)}
                          className="p-1 hover:bg-amber-200 rounded"
                        >
                          {isExpanded ? <ChevronUp className="h-4 w-4 text-amber-600" /> : <ChevronDown className="h-4 w-4 text-amber-600" />}
                        </button>
                        <ArrowRight className="h-4 w-4 text-amber-600" />
                      </div>
                    </div>
                  </div>
                  {isExpanded && (
                    <div className="px-3 pb-3">
                      <div className="text-xs text-amber-600 font-medium mb-2">逾期日期列表：</div>
                      <div className="grid grid-cols-2 gap-2">
                        {dateEntries.map(([date, count]) => (
                          <button
                            key={date}
                            onClick={(e) => { e.stopPropagation(); navigate(`/medication-workflow?patientId=${item.patient.院友id}&date=${date}`); }}
                            className="text-left px-3 py-2 bg-amber-100 hover:bg-amber-200 border border-amber-300 rounded text-sm text-amber-900"
                          >
                            <div className="font-medium">{date}</div>
                            <div className="text-xs text-amber-700">{count} 個流程</div>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            {overdueWorkflows.length > 2 && (
              <button
                onClick={() => setShowAllOverdue(!showAllOverdue)}
                className="w-full p-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                {showAllOverdue ? <><ChevronUp className="h-4 w-4" /><span>收起</span></> : <><ChevronDown className="h-4 w-4" /><span>展開另外 {overdueWorkflows.length - 2} 位</span></>}
              </button>
            )}
          </div>
        </div>
      )}

      {/* 待變更處方 */}
      {pendingPrescriptions.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <Pill className="h-4 w-4 text-blue-600" />
            <span className="text-sm font-medium text-blue-800">待變更處方</span>
          </div>
          <div className="space-y-2">
            {displayPending.map((item) => (
              <div
                key={item.patient.院友id}
                className="p-3 bg-blue-50 border border-blue-200 rounded-lg hover:bg-blue-100 cursor-pointer"
                onClick={() => navigate(`/prescriptions?patient=${item.patient.院友id}&tab=pending_change`)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-blue-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {item.patient.院友相片 ? (
                        <img src={item.patient.院友相片} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-blue-900">
                        {item.patient.中文姓氏}{item.patient.中文名字} <span className="text-xs text-blue-600">({item.patient.床號})</span>
                      </div>
                      <div className="text-sm text-blue-700">{item.count} 個待變更處方</div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-blue-600" />
                </div>
              </div>
            ))}
            {pendingPrescriptions.length > 2 && (
              <button
                onClick={() => setShowAllPending(!showAllPending)}
                className="w-full p-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                {showAllPending ? <><ChevronUp className="h-4 w-4" /><span>收起</span></> : <><ChevronDown className="h-4 w-4" /><span>展開另外 {pendingPrescriptions.length - 2} 位</span></>}
              </button>
            )}
          </div>
        </div>
      )}

      {/*藥物庫存見底） */}
      {lowStockGroups.length > 0 && (
        <div>
          <div className="flex items-center gap-2 mb-2">
            <PackageX className="h-4 w-4 text-rose-600" />
            <span className="text-sm font-medium text-rose-800">藥物庫存見底</span>
          </div>
          <div className="space-y-2">
            {displayLowStock.map((g, idx) => (
              <div
                key={`${g.patient.院友id}-${g.prescriptionDate}-${g.source}-${g.specialty}-${g.estimatedEndDate}-${idx}`}
                className="p-3 bg-rose-50 border border-rose-200 rounded-lg hover:bg-rose-100 cursor-pointer"
                onClick={() => navigate(`/prescriptions?patient=${g.patient.院友id}`)}
              >
                <div className="flex items-center justify-between gap-3">
                  <div className="flex items-center gap-3 flex-1">
                    <div className="w-10 h-10 rounded-full bg-rose-100 flex items-center justify-center overflow-hidden flex-shrink-0">
                      {g.patient.院友相片 ? (
                        <img src={g.patient.院友相片} alt="" className="w-full h-full object-cover" />
                      ) : (
                        <User className="h-5 w-5 text-rose-600" />
                      )}
                    </div>
                    <div className="flex-1">
                      <div className="font-medium text-rose-900">
                        {(g.patient.中文姓氏 || g.patient.中文名字) ? `${g.patient.中文姓氏 ?? ''}${g.patient.中文名字 ?? ''}` : (g.patient.中文姓名 ?? '')} <span className="text-xs text-rose-600">({g.patient.床號})</span>
                      </div>
                      <div className="text-sm text-rose-700">
                        {g.source}{g.specialty ? `${g.specialty}` : ''}的藥物尚餘 {g.remainingDays} 天服完
                      </div>
                      <div className="text-xs text-rose-500 mt-0.5">預計結束：{g.estimatedEndDate}</div>
                    </div>
                  </div>
                  <ArrowRight className="h-4 w-4 text-rose-600" />
                </div>
              </div>
            ))}
            {lowStockGroups.length > 3 && (
              <button
                onClick={() => setShowAllLowStock(!showAllLowStock)}
                className="w-full p-2 border-2 border-dashed border-gray-300 rounded-lg text-sm text-gray-600 hover:border-gray-400 hover:bg-gray-50 flex items-center justify-center gap-2"
              >
                {showAllLowStock ? <><ChevronUp className="h-4 w-4" /><span>收起</span></> : <><ChevronDown className="h-4 w-4" /><span>展開另外 {lowStockGroups.length - 3} 組</span></>}
              </button>
            )}
          </div>
        </div>
      )}
    </div>
  );
};

export default MedicationRemindersCard;
