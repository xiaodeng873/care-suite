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
  const [urineCount, setUrineCount] = useState('');
  const [coreCount, setCoreCount] = useState('');
  const [recorder, setRecorder] = useState('');
  const [notes, setNotes] = useState('');
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
      setUrineCount(existingRecord.urine_count ? String(existingRecord.urine_count) : '');
      setCoreCount(existingRecord.core_count ? String(existingRecord.core_count) : '');
      setRecorder(existingRecord.recorder);
      setNotes(existingRecord.notes || '');
    } else {
      setHasUrine(false);
      setHasStool(false);
      setHasNone(false);
      setUrineAmount('');
      setStoolColor('');
      setStoolTexture('');
      setStoolAmount('');
      setUrineCount('');
      setCoreCount('');
      setRecorder(staffName);
      setNotes('');
    }
  }, [existingRecord, staffName]);

  // ESC 鍵監聽 - 關閉 modal
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        onClose();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 互斥邏輯：如果同時無大小便，自動設定為"無"
    const finalHasNone = !hasUrine && !hasStool ? true : hasNone;
    const finalHasUrine = finalHasNone ? false : hasUrine;
    const finalHasStool = finalHasNone ? false : hasStool;

    const data: Omit<DiaperChangeRecord, 'id' | 'created_at' | 'updated_at'> = {
      patient_id: patient.院友id,
      change_date: date,
      time_slot: timeSlot,
      has_urine: finalHasUrine,
      has_stool: finalHasStool,
      has_none: finalHasNone,
      urine_amount: finalHasUrine ? urineAmount || undefined : undefined,
      stool_color: finalHasStool ? stoolColor || undefined : undefined,
      stool_texture: finalHasStool ? stoolTexture || undefined : undefined,
      stool_amount: finalHasStool ? stoolAmount || undefined : undefined,
      urine_count: urineCount ? parseInt(urineCount, 10) : null,
      core_count: coreCount ? parseInt(coreCount, 10) : null,
      recorder,
      notes: notes.trim() || null
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

  // 無：切換；選無會清空小便/大便
  const toggleNone = () => {
    if (isSpecialStatus) return;
    const next = !hasNone;
    setHasNone(next);
    if (next) {
      setHasUrine(false);
      setHasStool(false);
      setUrineAmount('');
      setStoolColor('');
      setStoolTexture('');
      setStoolAmount('');
    }
  };

  // 小便：選子選項 = 連動選中小便；再點同一個 = 取消（無小便）
  const toggleUrineAmount = (option: string) => {
    if (isSpecialStatus) return;
    const next = urineAmount === option ? '' : option;
    setUrineAmount(next);
    setHasUrine(!!next);
    if (next) setHasNone(false);
  };

  // 大便：三組子選項各自可切換；任何一組有選擇 = 選中大便，全部取消 = 無大便
  const toggleStoolField = (field: 'color' | 'texture' | 'amount', option: string) => {
    if (isSpecialStatus) return;
    const color = field === 'color' ? (stoolColor === option ? '' : option) : stoolColor;
    const texture = field === 'texture' ? (stoolTexture === option ? '' : option) : stoolTexture;
    const amount = field === 'amount' ? (stoolAmount === option ? '' : option) : stoolAmount;
    setStoolColor(color);
    setStoolTexture(texture);
    setStoolAmount(amount);
    const any = !!(color || texture || amount);
    setHasStool(any);
    if (any) setHasNone(false);
  };

  // 尿片/片芯：加減按鈕，每按 +/-1；0 視為無（存空字串）
  const stepCount = (current: string, delta: number, setter: (v: string) => void) => {
    const n = current === '' ? 0 : parseInt(current, 10);
    const next = Math.max(0, n + delta);
    setter(next === 0 ? '' : String(next));
  };

  const handleNoteButtonClick = (value: string) => {
    if (notes === value) {
      // 反選時清空 notes
      setNotes('');
      // 注意：反選時不恢復之前的值，保持空白狀態，讓用戶重新輸入
    } else {
      setNotes(value);
      if (['入院', '渡假', '外出'].includes(value)) {
        // 選擇特殊狀態時清空所有輸入（尿片/片芯數亦不適用）
        setHasUrine(false);
        setHasStool(false);
        setHasNone(false);
        setUrineAmount('');
        setStoolColor('');
        setStoolTexture('');
        setStoolAmount('');
        setUrineCount('');
        setCoreCount('');
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
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-md max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
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
            <div className={`space-y-3 ${isSpecialStatus ? 'pointer-events-none opacity-50' : ''}`}>
              {/* 無 */}
              <button
                type="button"
                onClick={toggleNone}
                className={`w-full py-3 px-4 rounded-lg font-medium transition-colors ${
                  hasNone ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                無
              </button>

              {/* 小便：子選項常駐，點選即連動選中小便 */}
              <div className="border border-gray-200 rounded-lg p-3">
                <div className={`text-sm font-medium mb-2 ${hasUrine ? 'text-blue-600' : 'text-gray-700'}`}>小便</div>
                <div className="flex gap-2">
                  {['少', '中', '多'].map(option => (
                    <button
                      key={option}
                      type="button"
                      onClick={() => toggleUrineAmount(option)}
                      className={`flex-1 py-3 px-3 rounded-lg font-medium transition-colors ${
                        hasUrine && urineAmount === option ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                      }`}
                    >
                      {option}
                    </button>
                  ))}
                </div>
              </div>

              {/* 大便：子選項常駐，任何一組有選擇即選中大便 */}
              <div className="border border-gray-200 rounded-lg p-3 space-y-2">
                <div className={`text-sm font-medium ${hasStool ? 'text-blue-600' : 'text-gray-700'}`}>大便</div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">顏色</div>
                  <div className="flex gap-2 flex-wrap">
                    {['黃', '啡', '綠', '黑', '紅'].map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleStoolField('color', option)}
                        className={`flex-1 min-w-[3rem] py-2 px-3 rounded-lg font-medium transition-colors ${
                          stoolColor === option ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">質地</div>
                  <div className="flex gap-2 flex-wrap">
                    {['硬', '軟', '稀', '水狀'].map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleStoolField('texture', option)}
                        className={`flex-1 min-w-[3rem] py-2 px-3 rounded-lg font-medium transition-colors ${
                          stoolTexture === option ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
                <div>
                  <div className="text-xs text-gray-500 mb-1">量</div>
                  <div className="flex gap-2">
                    {['少', '中', '多'].map(option => (
                      <button
                        key={option}
                        type="button"
                        onClick={() => toggleStoolField('amount', option)}
                        className={`flex-1 py-2 px-3 rounded-lg font-medium transition-colors ${
                          stoolAmount === option ? 'bg-blue-600 text-white shadow' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {option}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              尿片
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => stepCount(urineCount, -1, setUrineCount)}
                className="w-12 h-12 shrink-0 rounded-lg bg-gray-100 text-2xl font-bold text-gray-700 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                aria-label="減少尿片"
              >
                −
              </button>
              <div className="flex-1 py-2 border border-gray-200 rounded-lg bg-gray-50 text-center text-xl font-semibold text-gray-800">
                {urineCount === '' ? '—' : urineCount}
              </div>
              <button
                type="button"
                onClick={() => stepCount(urineCount, 1, setUrineCount)}
                className="w-12 h-12 shrink-0 rounded-lg bg-blue-600 text-2xl font-bold text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
                aria-label="增加尿片"
              >
                +
              </button>
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              片芯
            </label>
            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={() => stepCount(coreCount, -1, setCoreCount)}
                className="w-12 h-12 shrink-0 rounded-lg bg-gray-100 text-2xl font-bold text-gray-700 hover:bg-gray-200 active:bg-gray-300 transition-colors"
                aria-label="減少片芯"
              >
                −
              </button>
              <div className="flex-1 py-2 border border-gray-200 rounded-lg bg-gray-50 text-center text-xl font-semibold text-gray-800">
                {coreCount === '' ? '—' : coreCount}
              </div>
              <button
                type="button"
                onClick={() => stepCount(coreCount, 1, setCoreCount)}
                className="w-12 h-12 shrink-0 rounded-lg bg-blue-600 text-2xl font-bold text-white hover:bg-blue-700 active:bg-blue-800 transition-colors"
                aria-label="增加片芯"
              >
                +
              </button>
            </div>
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
            <div className="flex flex-wrap gap-2">
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

          <div className="flex flex-col sm:flex-row sm:justify-between gap-2 items-center pt-4">
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
            <div className="flex flex-col-reverse sm:flex-row sm:justify-end gap-2 ml-auto">
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

export default DiaperChangeModal;
