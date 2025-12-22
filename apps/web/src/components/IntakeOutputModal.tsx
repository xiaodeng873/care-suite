import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { Patient, IntakeOutputRecord, MealItem, BeverageItem, TubeFeedingItem, UrineOutputItem, GastricOutputItem } from '../lib/database';
import DeleteConfirmModal from './DeleteConfirmModal';

interface IntakeOutputModalProps {
  patient: Patient;
  date: string;
  timeSlot: string;
  staffName: string;
  existingRecord?: IntakeOutputRecord | null;
  onClose: () => void;
  onSubmit: (data: Omit<IntakeOutputRecord, 'id' | 'created_at' | 'updated_at'>) => void;
  onDelete?: (recordId: string) => void;
}

const IntakeOutputModal: React.FC<IntakeOutputModalProps> = ({
  patient,
  date,
  timeSlot,
  staffName,
  existingRecord,
  onClose,
  onSubmit,
  onDelete
}) => {
  // 動態數組狀態
  const [meals, setMeals] = useState<MealItem[]>([]);
  const [beverages, setBeverages] = useState<BeverageItem[]>([]);
  const [tubeFeeding, setTubeFeeding] = useState<TubeFeedingItem[]>([]);
  const [urineOutput, setUrineOutput] = useState<UrineOutputItem[]>([]);
  const [gastricOutput, setGastricOutput] = useState<GastricOutputItem[]>([]);
  
  // 標準欄位
  const [recorder, setRecorder] = useState('');
  const [notes, setNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 從timeSlot解析hour_slot
  const getHourSlotFromTimeSlot = (ts: string): number => {
    return parseInt(ts.split(':')[0]);
  };

  useEffect(() => {
    if (existingRecord) {
      setMeals(existingRecord.meals || []);
      setBeverages(existingRecord.beverages || []);
      setTubeFeeding(existingRecord.tube_feeding || []);
      setUrineOutput(existingRecord.urine_output || []);
      setGastricOutput(existingRecord.gastric_output || []);
      setRecorder(existingRecord.recorder);
      setNotes(existingRecord.notes || '');
    } else {
      setMeals([]);
      setBeverages([]);
      setTubeFeeding([]);
      setUrineOutput([]);
      setGastricOutput([]);
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

    // 驗證胃液pH值
    for (const item of gastricOutput) {
      if (item.ph < 0 || item.ph > 14) {
        alert('pH值必須在0-14之間');
        return;
      }
    }

    const hourSlot = getHourSlotFromTimeSlot(timeSlot);

    const data: Omit<IntakeOutputRecord, 'id' | 'created_at' | 'updated_at'> = {
      patient_id: patient.院友id,
      record_date: date,
      hour_slot: hourSlot,
      meals,
      beverages,
      tube_feeding: tubeFeeding,
      urine_output: urineOutput,
      gastric_output: gastricOutput,
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
      // 清空所有輸入
      setMeals([]);
      setBeverages([]);
      setTubeFeeding([]);
      setUrineOutput([]);
      setGastricOutput([]);
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

  const mealTypes = ['早餐', '午餐', '下午茶', '晚餐'] as const;
  const mealAmounts = ['1', '1/4', '1/2', '3/4'] as const;
  const beverageTypes = ['清水', '湯', '奶', '果汁', '糖水', '茶'] as const;
  const tubeFeedingTypes = ['Isocal', 'Glucerna', 'Compleat'] as const;

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto">
          <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
            <h2 className="text-xl font-semibold text-gray-900">
              {existingRecord ? '查看/編輯出入量記錄' : '新增出入量記錄'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <form onSubmit={handleSubmit} className="p-6 space-y-4">
            {/* 院友信息 */}
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

            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  記錄日期
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
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                記錄者 *
              </label>
              <input
                type="text"
                value={recorder}
                onChange={(e) => setRecorder(e.target.value)}
                disabled={isSpecialStatus}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent disabled:bg-gray-50 disabled:text-gray-600"
                placeholder="請輸入記錄者姓名"
                required
              />
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

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-lg font-semibold text-green-600 mb-3">▲ 攝入量</h3>

              {/* 餐食 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">餐食</label>
                  <button
                    type="button"
                    onClick={() => setMeals([...meals, { meal_type: '早餐', amount: '1' }])}
                    disabled={isSpecialStatus}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    新增餐食
                  </button>
                </div>
                {meals.map((meal, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <select
                      value={meal.meal_type}
                      onChange={(e) => {
                        const newMeals = [...meals];
                        newMeals[index].meal_type = e.target.value as typeof mealTypes[number];
                        setMeals(newMeals);
                      }}
                      disabled={isSpecialStatus}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    >
                      {mealTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <select
                      value={meal.amount}
                      onChange={(e) => {
                        const newMeals = [...meals];
                        newMeals[index].amount = e.target.value as typeof mealAmounts[number];
                        setMeals(newMeals);
                      }}
                      disabled={isSpecialStatus}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    >
                      {mealAmounts.map(amount => (
                        <option key={amount} value={amount}>{amount}</option>
                      ))}
                    </select>
                    <button
                      type="button"
                      onClick={() => setMeals(meals.filter((_, i) => i !== index))}
                      disabled={isSpecialStatus}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* 飲品 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">飲品 (ml)</label>
                  <button
                    type="button"
                    onClick={() => setBeverages([...beverages, { type: '清水', amount: 0 }])}
                    disabled={isSpecialStatus}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    新增飲品
                  </button>
                </div>
                {beverages.map((beverage, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <select
                      value={beverage.type}
                      onChange={(e) => {
                        const newBeverages = [...beverages];
                        newBeverages[index].type = e.target.value as typeof beverageTypes[number];
                        setBeverages(newBeverages);
                      }}
                      disabled={isSpecialStatus}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    >
                      {beverageTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={beverage.amount}
                      onChange={(e) => {
                        const newBeverages = [...beverages];
                        newBeverages[index].amount = parseInt(e.target.value) || 0;
                        setBeverages(newBeverages);
                      }}
                      disabled={isSpecialStatus}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                      placeholder="ml"
                      min="0"
                    />
                    <button
                      type="button"
                      onClick={() => setBeverages(beverages.filter((_, i) => i !== index))}
                      disabled={isSpecialStatus}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* 管飼 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">管飼 (ml)</label>
                  <button
                    type="button"
                    onClick={() => setTubeFeeding([...tubeFeeding, { type: 'Isocal', amount: 0 }])}
                    disabled={isSpecialStatus}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    新增管飼
                  </button>
                </div>
                {tubeFeeding.map((tube, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <select
                      value={tube.type}
                      onChange={(e) => {
                        const newTubeFeeding = [...tubeFeeding];
                        newTubeFeeding[index].type = e.target.value as typeof tubeFeedingTypes[number];
                        setTubeFeeding(newTubeFeeding);
                      }}
                      disabled={isSpecialStatus}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                    >
                      {tubeFeedingTypes.map(type => (
                        <option key={type} value={type}>{type}</option>
                      ))}
                    </select>
                    <input
                      type="number"
                      value={tube.amount}
                      onChange={(e) => {
                        const newTubeFeeding = [...tubeFeeding];
                        newTubeFeeding[index].amount = parseInt(e.target.value) || 0;
                        setTubeFeeding(newTubeFeeding);
                      }}
                      disabled={isSpecialStatus}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                      placeholder="ml"
                      min="0"
                    />
                    <button
                      type="button"
                      onClick={() => setTubeFeeding(tubeFeeding.filter((_, i) => i !== index))}
                      disabled={isSpecialStatus}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            <div className="border-t border-gray-200 pt-4">
              <h3 className="text-lg font-semibold text-red-600 mb-3">▼ 排出量</h3>

              {/* 尿液 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">尿液</label>
                  <button
                    type="button"
                    onClick={() => setUrineOutput([...urineOutput, { volume: 0, color: '' }])}
                    disabled={isSpecialStatus}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    新增尿液記錄
                  </button>
                </div>
                {urineOutput.map((urine, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="number"
                      value={urine.volume}
                      onChange={(e) => {
                        const newUrineOutput = [...urineOutput];
                        newUrineOutput[index].volume = parseInt(e.target.value) || 0;
                        setUrineOutput(newUrineOutput);
                      }}
                      disabled={isSpecialStatus}
                      className="w-32 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                      placeholder="ml"
                      min="0"
                    />
                    <input
                      type="text"
                      value={urine.color}
                      onChange={(e) => {
                        const newUrineOutput = [...urineOutput];
                        newUrineOutput[index].color = e.target.value;
                        setUrineOutput(newUrineOutput);
                      }}
                      disabled={isSpecialStatus}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                      placeholder="顏色（例如：透明、黃、啡）"
                    />
                    <button
                      type="button"
                      onClick={() => setUrineOutput(urineOutput.filter((_, i) => i !== index))}
                      disabled={isSpecialStatus}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>

              {/* 胃液 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <label className="text-sm font-medium text-gray-700">胃液</label>
                  <button
                    type="button"
                    onClick={() => setGastricOutput([...gastricOutput, { volume: 0, ph: 7, color: '' }])}
                    disabled={isSpecialStatus}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    新增胃液記錄
                  </button>
                </div>
                {gastricOutput.map((gastric, index) => (
                  <div key={index} className="flex gap-2 mb-2">
                    <input
                      type="number"
                      value={gastric.volume}
                      onChange={(e) => {
                        const newGastricOutput = [...gastricOutput];
                        newGastricOutput[index].volume = parseInt(e.target.value) || 0;
                        setGastricOutput(newGastricOutput);
                      }}
                      disabled={isSpecialStatus}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                      placeholder="ml"
                      min="0"
                    />
                    <input
                      type="number"
                      value={gastric.ph}
                      onChange={(e) => {
                        const newGastricOutput = [...gastricOutput];
                        newGastricOutput[index].ph = parseFloat(e.target.value) || 0;
                        setGastricOutput(newGastricOutput);
                      }}
                      disabled={isSpecialStatus}
                      className="w-24 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                      placeholder="pH"
                      min="0"
                      max="14"
                      step="0.1"
                    />
                    <input
                      type="text"
                      value={gastric.color}
                      onChange={(e) => {
                        const newGastricOutput = [...gastricOutput];
                        newGastricOutput[index].color = e.target.value;
                        setGastricOutput(newGastricOutput);
                      }}
                      disabled={isSpecialStatus}
                      className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 disabled:bg-gray-50"
                      placeholder="顏色"
                    />
                    <button
                      type="button"
                      onClick={() => setGastricOutput(gastricOutput.filter((_, i) => i !== index))}
                      disabled={isSpecialStatus}
                      className="px-3 py-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>

            {/* 按鈕 */}
            <div className="flex gap-3 pt-4 border-t border-gray-200">
              {existingRecord && onDelete && (
                <button
                  type="button"
                  onClick={handleDeleteClick}
                  className="px-6 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors flex items-center gap-2"
                >
                  <Trash2 className="w-4 h-4" />
                  刪除
                </button>
              )}
              <button
                type="button"
                onClick={onClose}
                className="flex-1 px-6 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
              >
                取消
              </button>
              <button
                type="submit"
                className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
              >
                {existingRecord ? '更新' : '儲存'}
              </button>
            </div>
          </form>
        </div>
      </div>

      {showDeleteConfirm && (
        <DeleteConfirmModal
          title="確認刪除"
          message="確定要刪除此出入量記錄嗎？此操作無法復原。"
          onConfirm={handleDeleteConfirm}
          onCancel={() => setShowDeleteConfirm(false)}
        />
      )}
    </>
  );
};

export default IntakeOutputModal;
