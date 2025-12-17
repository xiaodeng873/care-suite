import React, { useState, useEffect } from 'react';
import { X, User, RotateCcw, Trash2, Calendar, Clock } from 'lucide-react';
import type { Patient, PositionChangeRecord } from '../lib/database';
import { getPositionSequence } from '../utils/careRecordHelper';
import DeleteConfirmModal from './DeleteConfirmModal';

interface PositionChangeModalProps {
  patient: Patient;
  date: string;
  timeSlot: string;
  staffName: string;
  existingRecord?: PositionChangeRecord | null;
  onClose: () => void;
  onSubmit: (data: Omit<PositionChangeRecord, 'id' | 'created_at' | 'updated_at'>) => void;
  onDelete?: (recordId: string) => void;
}

const PositionChangeModal: React.FC<PositionChangeModalProps> = ({
  patient,
  date,
  timeSlot,
  staffName,
  existingRecord,
  onClose,
  onSubmit,
  onDelete
}) => {
  const [position, setPosition] = useState<'左' | '平' | '右'>('左');
  const [recorder, setRecorder] = useState('');
  const [notes, setNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (existingRecord) {
      setPosition(existingRecord.position);
      setRecorder(existingRecord.recorder || '');
      setNotes(existingRecord.notes || '');
    } else {
      const suggestedPosition = getPositionSequence(timeSlot);
      setPosition(suggestedPosition);
      setRecorder(staffName);
      setNotes('');
    }
  }, [existingRecord, timeSlot, staffName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: Omit<PositionChangeRecord, 'id' | 'created_at' | 'updated_at'> = {
      patient_id: patient.院友id,
      change_date: date,
      scheduled_time: timeSlot,
      position,
      recorder: recorder,
      notes: notes.trim() || undefined
    };

    onSubmit(data);
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = () => {
    if (existingRecord && onDelete) {
      onDelete(existingRecord.id);
    }
  };

  const getPositionButtonClass = (pos: '左' | '平' | '右') => {
    const baseClass = "flex-1 py-4 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center";
    if (isSpecialStatus) {
      return `${baseClass} bg-gray-100 text-gray-400 cursor-not-allowed opacity-50`;
    }
    if (position === pos) {
      return `${baseClass} bg-blue-600 text-white shadow-lg`;
    }
    return `${baseClass} bg-gray-100 text-gray-700 hover:bg-gray-200`;
  };

  const handleNoteButtonClick = (value: string) => {
    if (notes === value) {
      setNotes('');
    } else {
      setNotes(value);
      if (['入院', '渡假', '外出'].includes(value)) {
        setPosition('平');
      }
    }
  };

  const isSpecialStatus = ['入院', '渡假', '外出'].includes(notes);

  const getNoteButtonClass = (value: string) => {
    const baseClass = "flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200";
    if (notes === value) {
      return `${baseClass} bg-blue-600 text-white shadow-lg`;
    }
    return `${baseClass} bg-gray-100 text-gray-700 hover:bg-gray-200`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {existingRecord ? '查看/編輯轉身記錄' : '新增轉身記錄'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              院友姓名
            </label>
            <input
              type="text"
              value={patient.中文姓名}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              轉身日期
            </label>
            <input
              type="text"
              value={date}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              預定時段
            </label>
            <input
              type="text"
              value={timeSlot}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>

          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
            <div className="flex items-start space-x-2">
              <RotateCcw className="w-5 h-5 text-blue-600 flex-shrink-0 mt-0.5" />
              <div>
                <p className="text-sm font-medium text-blue-900">轉身順序提示</p>
                <p className="text-sm text-blue-700 mt-1">
                  左 → 平 → 右 → 左（循環）
                </p>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              轉身位置 *
            </label>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setPosition('左')}
                disabled={isSpecialStatus}
                className={getPositionButtonClass('左')}
              >
                左
              </button>
              <button
                type="button"
                onClick={() => setPosition('平')}
                disabled={isSpecialStatus}
                className={getPositionButtonClass('平')}
              >
                平
              </button>
              <button
                type="button"
                onClick={() => setPosition('右')}
                disabled={isSpecialStatus}
                className={getPositionButtonClass('右')}
              >
                右
              </button>
            </div>
            {!existingRecord && (
              <p className="text-xs text-gray-500 mt-2">
                系統已根據時段自動選擇建議位置，您可以手動調整
              </p>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              記錄者 *
            </label>
            <input
              type="text"
              value={recorder}
              onChange={(e) => setRecorder(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              備註
            </label>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => handleNoteButtonClick('入院')}
                className={getNoteButtonClass('入院')}
              >
                入院
              </button>
              <button
                type="button"
                onClick={() => handleNoteButtonClick('渡假')}
                className={getNoteButtonClass('渡假')}
              >
                渡假
              </button>
              <button
                type="button"
                onClick={() => handleNoteButtonClick('外出')}
                className={getNoteButtonClass('外出')}
              >
                外出
              </button>
            </div>
          </div>

          <div className="flex justify-between items-center pt-4">
            {existingRecord && onDelete && (
              <button
                type="button"
                onClick={handleDeleteClick}
                className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors flex items-center space-x-1"
              >
                <Trash2 className="h-4 w-4" />
                <span>刪除</span>
              </button>
            )}
            <div className="flex justify-end space-x-3 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {existingRecord ? '更新記錄' : '確認轉身'}
              </button>
            </div>
          </div>
        </form>
      </div>

      {/* 刪除確認對話框 */}
      {existingRecord && (
        <DeleteConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteConfirm}
          title="刪除轉身記錄確認"
          recordType="轉身記錄"
          patientInfo={{
            name: patient.中文姓名,
            bedNumber: patient.床號,
            patientId: patient.院友id
          }}
          recordDetails={[
            {
              label: '轉身日期',
              value: date,
              icon: <Calendar className="w-4 h-4 text-gray-500" />
            },
            {
              label: '預定時段',
              value: timeSlot,
              icon: <Clock className="w-4 h-4 text-gray-500" />
            },
            {
              label: '轉身位置',
              value: position,
              icon: <RotateCcw className="w-4 h-4 text-gray-500" />
            },
            {
              label: '記錄者',
              value: recorder,
              icon: <User className="w-4 h-4 text-gray-500" />
            },
            {
              label: '備註',
              value: notes || '無'
            }
          ]}
        />
      )}
    </div>
  );
};

export default PositionChangeModal;
