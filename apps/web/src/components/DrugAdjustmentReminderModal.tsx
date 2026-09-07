import React, { useState } from 'react';
import { X, Activity, AlertTriangle, Plus, Ban } from 'lucide-react';
import { useFilteredPatients } from '../context/PatientContext';
import BedNumberImprint from './BedNumberImprint';
import TaskModal from './TaskModal';
import {
  type DrugAdjustmentReminderItem,
  drugAdjustItemKey,
  dismissDrugAdjustItem,
} from '../utils/drugAdjustmentCheck';

interface DrugAdjustmentReminderModalProps {
  items: DrugAdjustmentReminderItem[];
  onClose: () => void;
  // 用戶選「不再提醒」後通知上層重算 items
  onDismissed?: () => void;
  // 任務建成後通知上層重載任務列表（items 會自動重算）
  onTaskCreated?: () => void | Promise<void>;
}

// 藥物調節監測提醒：糖尿病／降血壓藥物新增或調整劑量後，
// 提醒新增對應的一週「藥物調節」監測任務（血糖值／生命表徵）
const DrugAdjustmentReminderModal: React.FC<DrugAdjustmentReminderModalProps> = ({
  items,
  onClose,
  onDismissed,
  onTaskCreated,
}) => {
  const patients = useFilteredPatients();
  const [creatingItem, setCreatingItem] = useState<DrugAdjustmentReminderItem | null>(null);

  const getPatient = (patientId: number) => patients.find((p) => p.院友id === patientId);

  // 香港時區日期（YYYY-MM-DD）
  const hkDate = (offsetDays: number): string => {
    const now = new Date();
    const hk = new Date(now.getTime() + 8 * 60 * 60 * 1000);
    hk.setUTCDate(hk.getUTCDate() + offsetDays);
    return hk.toISOString().split('T')[0];
  };

  const handleDismiss = (item: DrugAdjustmentReminderItem) => {
    dismissDrugAdjustItem(drugAdjustItemKey(item));
    onDismissed?.();
  };

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
                  <h2 className="text-xl font-bold text-gray-900">藥物調節監測提醒</h2>
                  <p className="text-sm text-gray-600 mt-1">
                    以下院友新服用或調整了糖尿病／降血壓藥物劑量，建議新增為期一週的「藥物調節」監測任務
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
                const patient = getPatient(item.patient_id);
                const monitorLabel = item.tag === 'diabetic' ? '血糖值' : '生命表徵';
                const tagLabel = item.tag === 'diabetic' ? '糖尿病藥物' : '降血壓藥物';
                return (
                  <div key={drugAdjustItemKey(item)} className="border border-gray-200 rounded-lg p-4 hover:bg-gray-50 transition-colors">
                    <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                      <div className="space-y-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <span className="font-medium text-gray-900">
                            {patient ? `${patient.中文姓氏}${patient.中文名字}` : `院友 #${item.patient_id}`}
                          </span>
                          {patient && <BedNumberImprint patient={patient as any} size="sm" />}
                          <span className="text-xs px-2 py-1 rounded bg-gray-100 text-gray-800">
                            {item.medication_name}
                          </span>
                          <span className="text-xs px-2 py-1 rounded bg-amber-100 text-amber-800">
                            {tagLabel}
                          </span>
                        </div>
                        <div className="flex flex-wrap items-center gap-2 text-sm text-gray-600">
                          <Activity className="h-3 w-3 text-gray-400" />
                          <span>監測項目：{monitorLabel}</span>
                        </div>
                        <p className="text-xs text-gray-500">
                          建議任務：{monitorLabel}・每天 1 次・08:00・明天起為期一週・備註「藥物調節」（非循環）
                        </p>
                      </div>
                      <div className="flex flex-col gap-2 whitespace-nowrap">
                        <button
                          onClick={() => setCreatingItem(item)}
                          className="btn-primary flex items-center gap-2"
                        >
                          <Plus className="h-4 w-4" />
                          <span>新增任務</span>
                        </button>
                        <button
                          onClick={() => handleDismiss(item)}
                          className="btn-secondary flex items-center gap-2 text-gray-600"
                        >
                          <Ban className="h-4 w-4" />
                          <span>不再提醒</span>
                        </button>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-lg">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <p className="text-sm text-gray-500">選「暫不新增」會於下次進入處方管理時再次提醒；「不再提醒」會永久關閉該項提醒。</p>
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
            patient_id: creatingItem.patient_id,
            vitalType: creatingItem.vitalType,
            specificTime: '08:00',
            notes: '藥物調節',
            isRecurring: false,
            startDate: hkDate(1),
            endDate: hkDate(7),
            frequencyUnit: 'daily',
            frequencyValue: 1,
          }}
          onClose={() => setCreatingItem(null)}
          onUpdate={() => {
            setCreatingItem(null);
            onTaskCreated?.();
          }}
        />
      )}
    </>
  );
};

export default DrugAdjustmentReminderModal;
