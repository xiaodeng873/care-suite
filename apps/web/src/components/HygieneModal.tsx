import React, { useState, useEffect } from 'react';
import { X, User, Trash2, Calendar, Check } from 'lucide-react';
import type { Patient, HygieneRecord } from '../lib/database';
import DeleteConfirmModal from './DeleteConfirmModal';

interface HygieneModalProps {
  patient: Patient;
  date: string;
  staffName: string;
  existingRecord?: HygieneRecord | null;
  onClose: () => void;
  onSubmit: (data: Omit<HygieneRecord, 'id' | 'created_at' | 'updated_at'>) => void;
  onDelete?: (recordId: string) => void;
}

const HygieneModal: React.FC<HygieneModalProps> = ({
  patient,
  date,
  staffName,
  existingRecord,
  onClose,
  onSubmit,
  onDelete
}) => {
  // 護理項目 state
  const [hasBath, setHasBath] = useState(false);
  const [hasFaceWash, setHasFaceWash] = useState(false);
  const [hasShave, setHasShave] = useState(false);
  const [hasOralCare, setHasOralCare] = useState(false);
  const [hasDentureCare, setHasDentureCare] = useState(false);
  const [hasNailTrim, setHasNailTrim] = useState(false);
  const [hasBeddingChange, setHasBeddingChange] = useState(false);
  const [hasSheetPillowChange, setHasSheetPillowChange] = useState(false);
  const [hasCupWash, setHasCupWash] = useState(false);
  const [hasBedsideCabinet, setHasBedsideCabinet] = useState(false);
  const [hasWardrobe, setHasWardrobe] = useState(false);
  const [hasHaircut, setHasHaircut] = useState(false);
  
  // 大便相關 state
  const [bowelCount, setBowelCount] = useState('');
  const [bowelAmount, setBowelAmount] = useState('');
  const [bowelConsistency, setBowelConsistency] = useState('');
  
  // 大便藥物
  const [bowelMedication, setBowelMedication] = useState('');
  
  // 標準欄位
  const [recorder, setRecorder] = useState('');
  const [notes, setNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  useEffect(() => {
    if (existingRecord) {
      setHasBath(existingRecord.has_bath);
      setHasFaceWash(existingRecord.has_face_wash);
      setHasShave(existingRecord.has_shave);
      setHasOralCare(existingRecord.has_oral_care);
      setHasDentureCare(existingRecord.has_denture_care);
      setHasNailTrim(existingRecord.has_nail_trim);
      setHasBeddingChange(existingRecord.has_bedding_change);
      setHasSheetPillowChange(existingRecord.has_sheet_pillow_change);
      setHasCupWash(existingRecord.has_cup_wash);
      setHasBedsideCabinet(existingRecord.has_bedside_cabinet);
      setHasWardrobe(existingRecord.has_wardrobe);
      setHasHaircut(existingRecord.has_haircut);
      setBowelCount(existingRecord.bowel_count !== null ? String(existingRecord.bowel_count) : '');
      setBowelAmount(existingRecord.bowel_amount || '');
      setBowelConsistency(existingRecord.bowel_consistency || '');
      setBowelMedication(existingRecord.bowel_medication || '');
      setRecorder(existingRecord.recorder);
      setNotes(existingRecord.notes || '');
    } else {
      // 重置所有欄位
      setHasBath(false);
      setHasFaceWash(false);
      setHasShave(false);
      setHasOralCare(false);
      setHasDentureCare(false);
      setHasNailTrim(false);
      setHasBeddingChange(false);
      setHasSheetPillowChange(false);
      setHasCupWash(false);
      setHasBedsideCabinet(false);
      setHasWardrobe(false);
      setHasHaircut(false);
      setBowelCount('');
      setBowelAmount('');
      setBowelConsistency('');
      setBowelMedication('');
      setRecorder(staffName);
      setNotes('');
    }
  }, [existingRecord, staffName]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!recorder.trim()) {
      alert('請輸入記錄者姓名');
      return;
    }

    // 驗證大便次數
    let parsedBowelCount: number | null = null;
    if (bowelCount.trim()) {
      parsedBowelCount = parseInt(bowelCount);
      if (isNaN(parsedBowelCount) || parsedBowelCount < 0) {
        alert('大便次數必須是非負整數');
        return;
      }
    }

    const data: Omit<HygieneRecord, 'id' | 'created_at' | 'updated_at'> = {
      patient_id: patient.院友id,
      record_date: date,
      time_slot: 'daily',
      has_bath: hasBath,
      has_face_wash: hasFaceWash,
      has_shave: hasShave,
      has_oral_care: hasOralCare,
      has_denture_care: hasDentureCare,
      has_nail_trim: hasNailTrim,
      has_bedding_change: hasBeddingChange,
      has_sheet_pillow_change: hasSheetPillowChange,
      has_cup_wash: hasCupWash,
      has_bedside_cabinet: hasBedsideCabinet,
      has_wardrobe: hasWardrobe,
      has_haircut: hasHaircut,
      bowel_count: parsedBowelCount,
      bowel_amount: parsedBowelCount === 0 ? null : (bowelAmount.trim() || null),
      bowel_consistency: parsedBowelCount === 0 ? null : (bowelConsistency.trim() || null),
      bowel_medication: bowelMedication.trim() || null,
      recorder: recorder.trim(),
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

  const handleNoteButtonClick = (value: string) => {
    if (notes === value) {
      setNotes('');
    } else {
      setNotes(value);
      if (['入院', '渡假', '外出'].includes(value)) {
        // 清空所有護理項目
        setHasBath(false);
        setHasFaceWash(false);
        setHasShave(false);
        setHasOralCare(false);
        setHasDentureCare(false);
        setHasNailTrim(false);
        setHasBeddingChange(false);
        setHasSheetPillowChange(false);
        setHasCupWash(false);
        setHasBedsideCabinet(false);
        setHasWardrobe(false);
        setHasHaircut(false);
        setBowelCount('');
        setBowelAmount('');
        setBowelConsistency('');
        setBowelMedication('');
      }
    }
  };

  const isSpecialStatus = ['入院', '渡假', '外出'].includes(notes);
  const parsedCount = bowelCount.trim() ? parseInt(bowelCount) : null;
  const isBowelFieldsDisabled = parsedCount === 0 || parsedCount === null;

  const getNoteButtonClass = (value: string) => {
    const baseClass = "flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200";
    if (notes === value) {
      return `${baseClass} bg-blue-600 text-white shadow-lg`;
    }
    return `${baseClass} bg-gray-100 text-gray-700 hover:bg-gray-200`;
  };

  const careItems = [
    { label: '沐浴', value: hasBath, setter: setHasBath },
    { label: '洗面', value: hasFaceWash, setter: setHasFaceWash },
    { label: '剃鬚', value: hasShave, setter: setHasShave },
    { label: '洗牙漱口', value: hasOralCare, setter: setHasOralCare },
    { label: '洗口受假牙', value: hasDentureCare, setter: setHasDentureCare },
    { label: '剪指甲', value: hasNailTrim, setter: setHasNailTrim },
    { label: '換被套', value: hasBeddingChange, setter: setHasBeddingChange },
    { label: '換床單枕袋', value: hasSheetPillowChange, setter: setHasSheetPillowChange },
    { label: '洗杯', value: hasCupWash, setter: setHasCupWash },
    { label: '整理床頭櫃', value: hasBedsideCabinet, setter: setHasBedsideCabinet },
    { label: '整理衣箱', value: hasWardrobe, setter: setHasWardrobe },
    { label: '剪髮', value: hasHaircut, setter: setHasHaircut },
  ];

  return (
    <>
      <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-2xl w-full max-w-3xl max-h-[90vh] overflow-hidden flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* Header */}
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700">
            <div className="flex items-center space-x-3">
              <div className="bg-white bg-opacity-20 p-2 rounded-lg">
                <User className="w-6 h-6 text-white" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-white">衛生記錄</h2>
                <p className="text-sm text-blue-100">{patient.中文姓名} - 床號: {patient.床號}</p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-white hover:bg-white hover:bg-opacity-20 rounded-full p-2 transition-colors"
            >
              <X className="w-6 h-6" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit} className="flex-1 overflow-y-auto px-6 py-6">
            <div className="space-y-6">
              {/* 日期信息 */}
              <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded-lg">
                <div className="flex items-center space-x-2">
                  <Calendar className="w-5 h-5 text-gray-500" />
                  <span className="text-sm font-medium text-gray-700">日期:</span>
                  <span className="text-sm text-gray-900">{date}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <User className="w-5 h-5 text-gray-500" />
                  <input
                    type="text"
                    value={recorder}
                    onChange={(e) => setRecorder(e.target.value)}
                    className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    placeholder="記錄者"
                    required
                    disabled={isSpecialStatus}
                  />
                </div>
              </div>

              {/* 狀態按鈕 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">狀態</label>
                <div className="flex gap-2">
                  {['入院', '渡假', '外出'].map(status => (
                    <button
                      key={status}
                      type="button"
                      onClick={() => handleNoteButtonClick(status)}
                      className={getNoteButtonClass(status)}
                    >
                      {status}
                    </button>
                  ))}
                </div>
              </div>

              {/* 護理項目 */}
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-3">護理項目</label>
                <div className="grid grid-cols-2 gap-3">
                  {careItems.map((item, index) => (
                    <button
                      key={index}
                      type="button"
                      onClick={() => !isSpecialStatus && item.setter(!item.value)}
                      disabled={isSpecialStatus}
                      className={`flex items-center justify-between p-3 rounded-lg border-2 transition-all ${
                        item.value
                          ? 'border-green-500 bg-green-50'
                          : 'border-gray-200 bg-white hover:border-gray-300'
                      } ${isSpecialStatus ? 'opacity-50 cursor-not-allowed' : 'cursor-pointer'}`}
                    >
                      <span className={`text-sm font-medium ${item.value ? 'text-green-700' : 'text-gray-700'}`}>
                        {item.label}
                      </span>
                      <div className={`w-6 h-6 rounded-full flex items-center justify-center ${
                        item.value ? 'bg-green-500' : 'bg-gray-200'
                      }`}>
                        {item.value && <Check className="w-4 h-4 text-white" />}
                      </div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 大便記錄 */}
              <div className="bg-gray-50 p-4 rounded-lg space-y-4">
                <h3 className="text-sm font-medium text-gray-700 mb-3">大便記錄</h3>
                
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">大便次數</label>
                  <div className="flex items-center space-x-2">
                    <input
                      type="number"
                      value={bowelCount}
                      onChange={(e) => setBowelCount(e.target.value)}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="0"
                      min="0"
                      disabled={isSpecialStatus}
                    />
                    <span className="text-sm text-gray-600">次</span>
                  </div>
                  {parsedCount === 0 && (
                    <p className="mt-1 text-xs text-gray-500">次數為 0 表示無大便</p>
                  )}
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isBowelFieldsDisabled ? 'text-gray-400' : 'text-gray-700'
                  }`}>
                    大便量
                  </label>
                  <div className="flex gap-2">
                    {['少', '中', '多'].map(amount => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setBowelAmount(amount)}
                        disabled={isSpecialStatus || isBowelFieldsDisabled}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                          bowelAmount === amount
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } ${(isSpecialStatus || isBowelFieldsDisabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {amount}
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <label className={`block text-sm font-medium mb-2 ${
                    isBowelFieldsDisabled ? 'text-gray-400' : 'text-gray-700'
                  }`}>
                    大便性質
                  </label>
                  <div className="flex gap-2">
                    {['硬', '軟', '稀', '水狀'].map(consistency => (
                      <button
                        key={consistency}
                        type="button"
                        onClick={() => setBowelConsistency(consistency)}
                        disabled={isSpecialStatus || isBowelFieldsDisabled}
                        className={`flex-1 py-2 px-4 rounded-lg font-medium transition-all ${
                          bowelConsistency === consistency
                            ? 'bg-blue-600 text-white'
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        } ${(isSpecialStatus || isBowelFieldsDisabled) ? 'opacity-50 cursor-not-allowed' : ''}`}
                      >
                        {consistency}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* 備註 */}
              {!isSpecialStatus && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">備註</label>
                  <textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    rows={3}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
                    placeholder="其他備註..."
                  />
                </div>
              )}
            </div>
          </form>

          {/* Footer */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
            <div>
              {existingRecord && onDelete && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="flex items-center space-x-2 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
                >
                  <Trash2 className="w-4 h-4" />
                  <span>刪除記錄</span>
                </button>
              )}
            </div>
            <div className="flex items-center space-x-3">
              <button
                type="button"
                onClick={onClose}
                className="px-6 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                onClick={handleSubmit}
                className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
              >
                {existingRecord ? '更新' : '儲存'}
              </button>
            </div>
          </div>
        </div>
      </div>

      {showDeleteConfirm && (
        <DeleteConfirmModal
          isOpen={showDeleteConfirm}
          onClose={() => setShowDeleteConfirm(false)}
          onConfirm={handleDeleteConfirm}
          title="刪除衛生記錄"
          recordType="衛生記錄"
          patientInfo={{
            name: patient.中文姓名,
            bedNumber: patient.床號
          }}
          recordDetails={[
            { label: '日期', value: date }
          ]}
          warningMessage={`確定要刪除 ${patient.中文姓名} 在 ${date} 的衛生記錄嗎？`}
        />
      )}
    </>
  );
};

export default HygieneModal;
