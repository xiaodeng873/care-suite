import React, { useState } from 'react';
import { X, Activity, AlertTriangle, Plus, Clock } from 'lucide-react';
import { useFilteredPatients } from '../context/PatientContext';
import BedNumberImprint from './BedNumberImprint';
import TaskModal from './TaskModal';
import type { MissingMonitoringTask } from '../utils/prescriptionMonitoringCheck';

interface PrescriptionMonitoringReminderModalProps {
  items: MissingMonitoringTask[];
  onClose: () => void;
  // 任務建成後通知上層重載任務列表（items 會自動重算）
  onTaskCreated?: () => void | Promise<void>;
}

// 處方監測任務提醒：在服處方有檢測項條件，但院友欠「服藥前」循環監測任務
const PrescriptionMonitoringReminderModal: React.FC<PrescriptionMonitoringReminderModalProps> = ({
  items,
  onClose,
  onTaskCreated,
}) => {
  const patients = useFilteredPatients();
  const [creatingItem, setCreatingItem] = useState<MissingMonitoringTask | null>(null);

  const getPatient = (patientId: number) => patients.find((p) => p.院友id === patientId);

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div
          className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[85vh] flex flex-col"
          onClick={(e) => e.stopPropagation()}
        >
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg z-10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="p-2 bg-yellow-100 rounded-lg">
                  <AlertTriangle className="h-6 w-6 text-yellow-600" />
                </div>
                <div>
                  <h2 className="text-xl font-bold text-gray-900">監測任務提醒</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    以下在服處方設有檢測項條件，但未找到對應「服藥前／注射前」循環監測任務
                  </p>
                </div>
              </div>
              <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="flex-1 overflow-y-auto px-6 py-4">
            <div className="space-y-3">
              {items.map((item) => {
                const patient = getPatient(item.patientId);
                return (
                  <div key={item.key} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {patient ? `${patient.中文姓氏}${patient.中文名字}` : `院友 #${item.patientId}`}
                          </span>
                          {patient && <BedNumberImprint patient={patient as any} size="sm" />}
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
                            {item.medicationName}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                          <Activity className="h-3 w-3 text-gray-400" />
                          <span>
                            檢測項目：{item.ruleVitalSign}（{item.taskType}）
                          </span>
                          <span className="text-gray-300">|</span>
                          <Clock className="h-3 w-3 text-gray-400" />
                          <span>服藥時間點：{item.timeSlot}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          對應任務：{item.taskType}・每天・{item.timeSlot}・備註「服藥前」或「注射前」（{item.timeSlot} 或前半小時均可）
                        </p>
                      </div>
                      <button
                        onClick={() => setCreatingItem(item)}
                        className="btn-primary flex items-center gap-2 whitespace-nowrap"
                      >
                        <Plus className="h-4 w-4" />
                        <span>新增任務</span>
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-gray-500">可以稍後在「任務管理」自行新增，此處只作提醒。</p>
              <button onClick={onClose} className="btn-secondary">
                暫不新增
              </button>
            </div>
          </div>
        </div>
      </div>

      {creatingItem && (
        <TaskModal
          prefill={{
            patient_id: creatingItem.patientId,
            vitalType: creatingItem.taskType,
            specificTime: creatingItem.timeSlot,
            notes: creatingItem.administrationRoute?.includes('注') ? '注射前' : '服藥前',
          }}
          onClose={() => setCreatingItem(null)}
          onUpdate={() => {
            // 任務建成後由外層重拉任務列表，items 會自動重算
            setCreatingItem(null);
            onTaskCreated?.();
          }}
        />
      )}
    </>
  );
};

export default PrescriptionMonitoringReminderModal;
