import React, { useState, useEffect, useRef } from 'react';
import { X, Clock, User, Trash2 } from 'lucide-react';
import type { Bed, Patient, PatrolRound } from '../../lib/database';
import { addRandomOffset } from '../../utils/careRecordHelper';
import { t2s, s2t } from '../utils/chinese';

interface NursePatrolRoundModalProps {
  bed: Bed;
  patient: Patient | null;
  date: string;
  timeSlot: string;
  staffName: string;
  existingRecord?: PatrolRound | null;
  onClose: () => void;
  onSubmit: (data: Omit<PatrolRound, 'id' | 'created_at' | 'updated_at'>) => void;
  onDelete?: (recordId: string) => void;
}

const NursePatrolRoundModal: React.FC<NursePatrolRoundModalProps> = ({
  bed, patient, date, timeSlot, staffName,
  existingRecord, onClose, onSubmit, onDelete,
}) => {
  const [patrolTime, setPatrolTime] = useState('');
  const [recorder, setRecorder] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (existingRecord) {
      setPatrolTime(existingRecord.patrol_time || '');
      setRecorder(existingRecord.recorder || '');
    } else {
      setPatrolTime(addRandomOffset(timeSlot));
      setRecorder(staffName);
    }
  }, [existingRecord, timeSlot, staffName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    onSubmit({
      bed_id: bed.id,
      patient_id: patient?.院友id ?? null,
      patrol_date: date,
      patrol_time: patrolTime,
      scheduled_time: timeSlot,
      recorder: s2t(recorder),
    });
  };

  const patientDisplay = patient
    ? t2s(patient.中文姓名)
    : '（空床）';

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div
        className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4"
        onClick={e => e.stopPropagation()}
      >
        <div className="flex items-center justify-between">
          <h2 className="text-lg font-semibold text-gray-900">
            {existingRecord ? '查看/编辑巡房记录' : '新增巡房记录'}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="space-y-3">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <p className="text-gray-500 mb-0.5">床号</p>
              <p className="font-medium">{bed.bed_number}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-0.5">院友</p>
              <p className="font-medium">{patientDisplay}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-0.5">巡房日期</p>
              <p className="font-medium">{date}</p>
            </div>
            <div>
              <p className="text-gray-500 mb-0.5">预定时段</p>
              <p className="font-medium">{timeSlot}</p>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="w-4 h-4 inline mr-1" />
              实际巡房时间 *
            </label>
            <input
              type="time"
              value={patrolTime}
              onChange={e => setPatrolTime(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              记录者 *
            </label>
            <input
              type="text"
              value={t2s(recorder)}
              onChange={e => setRecorder(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div className="flex gap-3 pt-2">
            {existingRecord && onDelete && (
              <button
                type="button"
                onClick={() => setShowDeleteConfirm(true)}
                className="flex items-center gap-1 px-4 py-2 text-red-600 border border-red-300 rounded-lg hover:bg-red-50"
              >
                <Trash2 className="w-4 h-4" /> 删除
              </button>
            )}
            <button
              type="submit"
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg font-medium hover:bg-blue-700 active:bg-blue-800"
            >
              {existingRecord ? '保存更改' : '提交记录'}
            </button>
          </div>
        </form>

        {showDeleteConfirm && (
          <div className="fixed inset-0 bg-black/60 flex items-center justify-center z-60 p-4" onClick={e => e.stopPropagation()}>
            <div className="bg-white rounded-xl p-5 w-full max-w-sm space-y-3 shadow-xl">
              <p className="font-semibold text-gray-900">确认删除</p>
              <p className="text-sm text-gray-600">确定要删除这条巡房记录吗？此操作无法撤销。</p>
              <div className="flex gap-2 pt-1">
                <button
                  type="button"
                  onClick={() => setShowDeleteConfirm(false)}
                  className="flex-1 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50"
                >
                  取消
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setShowDeleteConfirm(false);
                    if (existingRecord && onDelete) onDelete(existingRecord.id);
                  }}
                  className="flex-1 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
                >
                  确定删除
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default NursePatrolRoundModal;
