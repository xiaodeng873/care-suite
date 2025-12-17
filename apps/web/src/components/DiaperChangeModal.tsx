import React, { useState, useEffect } from 'react';
import { X, User, Trash2, Calendar, Clock } from 'lucide-react';
import type { Patient, DiaperChangeRecord } from '../lib/database';
import DeleteConfirmModal from './DeleteConfirmModal';

interface DiaperChangeModalProps {
  patient: Patient;
  date: string;
  timeSlot: string;
  staffName: string;
  existingRecord?: DiaperChangeRecord | null;
  onClose: () => void;
  onSubmit: (data: Omit<DiaperChangeRecord, 'id' | 'created_at' | 'updated_at'>) => void;
  onDelete?: (recordId: string) => void;
}

const DiaperChangeModal: React.FC<DiaperChangeModalProps> = ({
  patient,
  date,
  timeSlot,
  staffName,
  existingRecord,
  onClose,
  onSubmit,
  onDelete
}) => {
  const [hasUrine, setHasUrine] = useState(false);
  const [hasStool, setHasStool] = useState(false);
  const [hasNone, setHasNone] = useState(false);
  const [urineAmount, setUrineAmount] = useState('');
  const [stoolColor, setStoolColor] = useState('');
  const [stoolTexture, setStoolTexture] = useState('');
  const [stoolAmount, setStoolAmount] = useState('');
  const [recorder, setRecorder] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (existingRecord) {
      setHasUrine(existingRecord.has_urine);
      setHasStool(existingRecord.has_stool);
      setHasNone(existingRecord.has_none);
      setUrineAmount(existingRecord.urine_amount || '');
      setStoolColor(existingRecord.stool_color || '');
      setStoolTexture(existingRecord.stool_texture || '');
      setStoolAmount(existingRecord.stool_amount || '');
      setRecorder(existingRecord.recorder);
    } else {
      setHasUrine(false);
      setHasStool(false);
      setHasNone(false);
      setUrineAmount('');
      setStoolColor('');
      setStoolTexture('');
      setStoolAmount('');
      setRecorder(staffName);
    }
  }, [existingRecord, staffName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    const data: Omit<DiaperChangeRecord, 'id' | 'created_at' | 'updated_at'> = {
      patient_id: patient.院友id,
      change_date: date,
      time_slot: timeSlot,
      has_urine: hasUrine,
      has_stool: hasStool,
      has_none: hasNone,
      urine_amount: urineAmount || undefined,
      stool_color: stoolColor || undefined,
      stool_texture: stoolTexture || undefined,
      stool_amount: stoolAmount || undefined,
      recorder
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

  const getChangeDescription = () => {
    const parts = [];
    if (hasUrine) parts.push(`小便${urineAmount ? `: ${urineAmount}` : ''}`);
    if (hasStool) {
      const stoolDesc = [
        stoolColor,
        stoolTexture,
        stoolAmount
      ].filter(Boolean).join(', ');
      parts.push(`大便${stoolDesc ? `: ${stoolDesc}` : ''}`);
    }
    if (hasNone) parts.push('無');
    return parts.join(' / ') || '無記錄';
  };

  const handleCheckboxChange = (type: 'urine' | 'stool' | 'none') => {
    if (type === 'none') {
      setHasNone(!hasNone);
      if (!hasNone) {
        setHasUrine(false);
        setHasStool(false);
      }
    } else {
      setHasNone(false);
      if (type === 'urine') {
        setHasUrine(!hasUrine);
      } else {
        setHasStool(!hasStool);
      }
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto">
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            {existingRecord ? '查看/編輯換片記錄' : '新增換片記錄'}
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
              換片日期
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
              時段
            </label>
            <input
              type="text"
              value={timeSlot}
              disabled
              className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              排泄情況 *
            </label>
            <div className="space-y-2">
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasUrine}
                  onChange={() => handleCheckboxChange('urine')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>小便</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasStool}
                  onChange={() => handleCheckboxChange('stool')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>大便</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={hasNone}
                  onChange={() => handleCheckboxChange('none')}
                  className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                />
                <span>無</span>
              </label>
            </div>
          </div>

          {hasUrine && (
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                小便量
              </label>
              <select
                value={urineAmount}
                onChange={(e) => setUrineAmount(e.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">請選擇</option>
                <option value="少">少</option>
                <option value="中">中</option>
                <option value="多">多</option>
              </select>
            </div>
          )}

          {hasStool && (
            <>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  大便顏色
                </label>
                <select
                  value={stoolColor}
                  onChange={(e) => setStoolColor(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">請選擇</option>
                  <option value="黃">黃</option>
                  <option value="啡">啡</option>
                  <option value="綠">綠</option>
                  <option value="黑">黑</option>
                  <option value="紅">紅</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  大便質地
                </label>
                <select
                  value={stoolTexture}
                  onChange={(e) => setStoolTexture(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">請選擇</option>
                  <option value="硬">硬</option>
                  <option value="軟">軟</option>
                  <option value="稀">稀</option>
                  <option value="水狀">水狀</option>
                </select>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  大便量
                </label>
                <select
                  value={stoolAmount}
                  onChange={(e) => setStoolAmount(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                >
                  <option value="">請選擇</option>
                  <option value="少">少</option>
                  <option value="中">中</option>
                  <option value="多">多</option>
                </select>
              </div>
            </>
          )}

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
                {existingRecord ? '更新記錄' : '確認記錄'}
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
          title="刪除換片記錄確認"
          recordType="換片記錄"
          patientInfo={{
            name: patient.中文姓名,
            bedNumber: patient.床號,
            patientId: patient.院友id
          }}
          recordDetails={[
            {
              label: '換片日期',
              value: date,
              icon: <Calendar className="w-4 h-4 text-gray-500" />
            },
            {
              label: '時段',
              value: timeSlot,
              icon: <Clock className="w-4 h-4 text-gray-500" />
            },
            {
              label: '換片內容',
              value: getChangeDescription()
            },
            {
              label: '記錄者',
              value: recorder,
              icon: <User className="w-4 h-4 text-gray-500" />
            }
          ]}
        />
      )}
    </div>
  );
};

export default DiaperChangeModal;
