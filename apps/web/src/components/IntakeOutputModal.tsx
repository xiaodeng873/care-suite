import React, { useState, useEffect } from 'react';
import { X, Plus, Trash2 } from 'lucide-react';
import type { Patient, IntakeOutputRecord, IntakeItem, OutputItem, IntakeCategory, OutputCategory } from '../lib/database';
import {
  createIntakeOutputRecord,
  updateIntakeOutputRecord,
  deleteIntakeOutputRecord,
  createIntakeItems,
  createOutputItems,
  deleteIntakeItem,
  deleteOutputItem,
} from '../lib/database';
import DeleteConfirmModal from './DeleteConfirmModal';

interface IntakeOutputModalProps {
  patient: Patient;
  date: string;
  timeSlot: string;
  staffName: string;
  existingRecord?: IntakeOutputRecord | null;
  onClose: () => void;
  onSave: (record: IntakeOutputRecord) => void;
  onDelete?: (recordId: string) => void;
}

// 配置選項（與 mobile 端同步）
const INTAKE_CATEGORIES = {
  meal: {
    label: '餐膳',
    types: ['早餐', '午餐', '下午茶', '晚餐'],
    amounts: ['1', '3/4', '1/2', '1/4'],
    unit: 'portion' as const,
    icon: '🍚'
  },
  beverage: {
    label: '飲料',
    types: ['水', '湯', '奶', '果汁', '糖水', '茶'],
    unit: 'ml' as const,
    icon: '💧'
  },
  other: {
    label: '其他',
    types: ['餅乾', '點心', '零食', '甜品'],
    units: ['塊', '粒'],
    unit: 'piece' as const,
    icon: '🍪'
  },
  tube_feeding: {
    label: '鼻胃飼',
    types: ['Isocal', 'Ultracal', 'Glucerna', 'Isosource', 'Compleat'],
    unit: 'ml' as const,
    icon: '💊'
  }
};

const OUTPUT_CATEGORIES = {
  urine: {
    label: '尿液',
    colors: ['透明', '白', '黃', '啡', '紅', '綠', '紫'],
    hasPH: false,
    icon: '💧'
  },
  gastric: {
    label: '胃液',
    colors: ['透明', '白', '黃', '啡', '紅', '綠', '紫'],
    hasPH: true,
    icon: '🧪'
  }
};

const IntakeOutputModal: React.FC<IntakeOutputModalProps> = ({
  patient,
  date,
  timeSlot,
  staffName,
  existingRecord,
  onClose,
  onSave,
  onDelete
}) => {
  // 項目列表
  const [intakeItems, setIntakeItems] = useState<Partial<IntakeItem>[]>([]);
  const [outputItems, setOutputItems] = useState<Partial<OutputItem>[]>([]);
  
  // 標準欄位
  const [recorder, setRecorder] = useState('');
  const [notes, setNotes] = useState('');
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  // 新增項目臨時狀態
  const [showAddIntakeModal, setShowAddIntakeModal] = useState(false);
  const [showAddOutputModal, setShowAddOutputModal] = useState(false);
  const [addCategory, setAddCategory] = useState<IntakeCategory | OutputCategory>('meal');
  
  // 新增攝入項目臨時表單
  const [newIntakeItemType, setNewIntakeItemType] = useState('');
  const [newIntakeAmount, setNewIntakeAmount] = useState('');
  const [newIntakeVolume, setNewIntakeVolume] = useState<number>(0);
  
  // 新增排出項目臨時表單
  const [newOutputColor, setNewOutputColor] = useState('');
  const [newOutputVolume, setNewOutputVolume] = useState<number>(0);
  const [newOutputPH, setNewOutputPH] = useState<number>(7);
  const [isNoOutput, setIsNoOutput] = useState(false);

  // 載入已有記錄
  useEffect(() => {
    if (existingRecord) {
      setRecorder(existingRecord.recorder || '');
      setNotes(existingRecord.notes || '');
      setIntakeItems(existingRecord.intake_items || []);
      setOutputItems(existingRecord.output_items || []);
    } else {
      setRecorder(staffName);
      setNotes('');
      setIntakeItems([]);
      setOutputItems([]);
    }
  }, [existingRecord, staffName]);

  const isSpecialStatus = ['入院', '渡假', '外出'].includes(notes);

  const handleNoteButtonClick = (value: string) => {
    if (notes === value) {
      setNotes('');
    } else {
      setNotes(value);
      // 清空所有輸入項目
      setIntakeItems([]);
      setOutputItems([]);
    }
  };

  // 保存記錄
  const handleSave = async () => {
    if (!recorder?.trim()) {
      alert('請輸入記錄者姓名');
      return;
    }

    // 驗證：非特殊狀態時必須至少有一個項目
    if (!isSpecialStatus && intakeItems.length === 0 && outputItems.length === 0) {
      alert('請至少新增一個攝入或排出項目');
      return;
    }

    setIsSaving(true);

    try {
      let record: IntakeOutputRecord;
      const hourSlot = parseInt(timeSlot.split(':')[0], 10);

      if (existingRecord) {
        // 更新現有記錄
        const trimmedNotes = notes.trim();
        const updateData = {
          recorder: recorder.trim(),
          notes: trimmedNotes === '' ? null : trimmedNotes,
        };
        const updatedRecord = await updateIntakeOutputRecord(existingRecord.id, updateData);
        if (!updatedRecord) {
          throw new Error('更新記錄失敗');
        }
        record = updatedRecord;

        // 刪除現有的項目（將重新創建）
        if (existingRecord.intake_items) {
          for (const item of existingRecord.intake_items) {
            if (item.id) await deleteIntakeItem(item.id);
          }
        }
        if (existingRecord.output_items) {
          for (const item of existingRecord.output_items) {
            if (item.id) await deleteOutputItem(item.id);
          }
        }
      } else {
        // 創建新記錄
        record = await createIntakeOutputRecord({
          patient_id: patient.院友id,
          record_date: date,
          time_slot: timeSlot,
          hour_slot: hourSlot,
          recorder: recorder.trim(),
          notes: notes.trim() || undefined,
        });
      }

      // 創建攝入項目
      if (intakeItems.length > 0) {
        const itemsWithRecordId = intakeItems.map(item => {
          const { id, created_at, ...rest } = item as IntakeItem;
          return {
            ...rest,
            record_id: record.id,
          };
        }) as Omit<IntakeItem, 'id' | 'created_at'>[];
        
        const createdIntakeItems = await createIntakeItems(itemsWithRecordId);
        record.intake_items = createdIntakeItems;
      }

      // 創建排出項目
      if (outputItems.length > 0) {
        const itemsWithRecordId = outputItems.map(item => {
          const { id, created_at, ...rest } = item as OutputItem;
          return {
            ...rest,
            record_id: record.id,
          };
        }) as Omit<OutputItem, 'id' | 'created_at'>[];
        
        const createdOutputItems = await createOutputItems(itemsWithRecordId);
        record.output_items = createdOutputItems;
      }

      onSave(record);
      onClose();
    } catch (error) {
      console.error('保存出入量記錄失敗:', error);
      alert('保存失敗，請重試');
    } finally {
      setIsSaving(false);
    }
  };

  const handleDeleteClick = () => {
    setShowDeleteConfirm(true);
  };

  const handleDeleteConfirm = async () => {
    if (existingRecord && onDelete) {
      try {
        await deleteIntakeOutputRecord(existingRecord.id);
        onDelete(existingRecord.id);
        onClose();
      } catch (error) {
        console.error('刪除記錄失敗:', error);
        alert('刪除失敗，請重試');
      }
    }
    setShowDeleteConfirm(false);
  };

  // 開啟新增攝入項目對話框
  const openAddIntakeModal = (category: IntakeCategory) => {
    setAddCategory(category);
    setNewIntakeItemType(INTAKE_CATEGORIES[category].types[0]);
    if (category === 'meal') {
      setNewIntakeAmount(INTAKE_CATEGORIES.meal.amounts[0]);
    } else {
      setNewIntakeVolume(0);
    }
    setShowAddIntakeModal(true);
  };

  // 開啟新增排出項目對話框
  const openAddOutputModal = (category: OutputCategory) => {
    setAddCategory(category);
    setNewOutputColor(OUTPUT_CATEGORIES[category].colors[0]);
    setNewOutputVolume(0);
    setNewOutputPH(7);
    setIsNoOutput(false);
    setShowAddOutputModal(true);
  };

  // 新增攝入項目
  const handleAddIntakeItem = () => {
    const category = addCategory as IntakeCategory;
    const config = INTAKE_CATEGORIES[category];
    
    let newItem: Partial<IntakeItem> = {
      category,
      item_type: newIntakeItemType,
      unit: config.unit,
    };

    if (category === 'meal') {
      newItem.amount = newIntakeAmount;
    } else if (category === 'beverage' || category === 'tube_feeding') {
      newItem.volume = newIntakeVolume;
      newItem.amount = `${newIntakeVolume}ml`;
    } else if (category === 'other') {
      newItem.amount = newIntakeAmount;
    }

    setIntakeItems([...intakeItems, newItem]);
    setShowAddIntakeModal(false);
  };

  // 新增排出項目
  const handleAddOutputItem = () => {
    const category = addCategory as OutputCategory;
    
    let newItem: Partial<OutputItem> = {
      category,
    };

    if (isNoOutput) {
      newItem.color = '無';
      newItem.amount_ml = 0;
    } else {
      newItem.color = newOutputColor;
      newItem.amount_ml = newOutputVolume;
      if (category === 'gastric') {
        newItem.ph_value = newOutputPH;
      }
    }

    setOutputItems([...outputItems, newItem]);
    setShowAddOutputModal(false);
  };

  // 刪除攝入項目
  const handleDeleteIntakeItem = (index: number) => {
    setIntakeItems(intakeItems.filter((_, i) => i !== index));
  };

  // 刪除排出項目
  const handleDeleteOutputItem = (index: number) => {
    setOutputItems(outputItems.filter((_, i) => i !== index));
  };

  // 格式化項目顯示
  const formatIntakeItem = (item: Partial<IntakeItem>) => {
    if (item.category === 'meal') {
      return `${item.item_type} ${item.amount}`;
    } else if (item.category === 'beverage' || item.category === 'tube_feeding') {
      return `${item.item_type} ${item.volume || 0}ml`;
    } else {
      return `${item.item_type} ${item.amount}`;
    }
  };

  const formatOutputItem = (item: Partial<OutputItem>) => {
    if (item.color === '無' || item.amount_ml === 0) {
      return item.category === 'urine' ? '無尿' : '無胃液';
    }
    if (item.category === 'urine') {
      return `尿(${item.color}) ${item.amount_ml}ml`;
    } else {
      const phText = item.ph_value ? ` pH${item.ph_value}` : '';
      return `胃液(${item.color})${phText} ${item.amount_ml}ml`;
    }
  };

  const getNoteButtonClass = (value: string) => {
    const baseClass = "flex-1 py-3 px-4 rounded-lg font-medium transition-all duration-200";
    if (notes === value) {
      return `${baseClass} bg-blue-600 text-white shadow-lg`;
    }
    return `${baseClass} bg-gray-100 text-gray-700 hover:bg-gray-200`;
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
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

          <div className="p-6 space-y-6">
            {/* 院友信息 */}
            <div className="grid grid-cols-3 gap-4">
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

            {/* 攝入區塊 */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-green-600 mb-4">▲ 攝入量 (Intake)</h3>
              
              {/* 餐膳 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">🍚 餐膳</span>
                  <button
                    type="button"
                    onClick={() => openAddIntakeModal('meal')}
                    disabled={isSpecialStatus}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    新增
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {intakeItems.filter(i => i.category === 'meal').map((item, index) => {
                    const globalIndex = intakeItems.findIndex(i => i === item);
                    return (
                      <div key={index} className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full">
                        <span className="text-sm text-green-700">{formatIntakeItem(item)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteIntakeItem(globalIndex)}
                          disabled={isSpecialStatus}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 飲料 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">💧 飲料</span>
                  <button
                    type="button"
                    onClick={() => openAddIntakeModal('beverage')}
                    disabled={isSpecialStatus}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    新增
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {intakeItems.filter(i => i.category === 'beverage').map((item, index) => {
                    const globalIndex = intakeItems.findIndex(i => i === item);
                    return (
                      <div key={index} className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full">
                        <span className="text-sm text-green-700">{formatIntakeItem(item)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteIntakeItem(globalIndex)}
                          disabled={isSpecialStatus}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 其他 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">🍪 其他</span>
                  <button
                    type="button"
                    onClick={() => openAddIntakeModal('other')}
                    disabled={isSpecialStatus}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    新增
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {intakeItems.filter(i => i.category === 'other').map((item, index) => {
                    const globalIndex = intakeItems.findIndex(i => i === item);
                    return (
                      <div key={index} className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full">
                        <span className="text-sm text-green-700">{formatIntakeItem(item)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteIntakeItem(globalIndex)}
                          disabled={isSpecialStatus}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 鼻胃飼 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">💊 鼻胃飼</span>
                  <button
                    type="button"
                    onClick={() => openAddIntakeModal('tube_feeding')}
                    disabled={isSpecialStatus}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-green-50 text-green-600 rounded-lg hover:bg-green-100 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    新增
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {intakeItems.filter(i => i.category === 'tube_feeding').map((item, index) => {
                    const globalIndex = intakeItems.findIndex(i => i === item);
                    return (
                      <div key={index} className="flex items-center gap-2 bg-green-50 px-3 py-1 rounded-full">
                        <span className="text-sm text-green-700">{formatIntakeItem(item)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteIntakeItem(globalIndex)}
                          disabled={isSpecialStatus}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>
            </div>

            {/* 排出區塊 */}
            <div className="border border-gray-200 rounded-lg p-4">
              <h3 className="text-lg font-semibold text-red-600 mb-4">▼ 排出量 (Output)</h3>
              
              {/* 尿液 */}
              <div className="mb-4">
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">💧 尿液</span>
                  <button
                    type="button"
                    onClick={() => openAddOutputModal('urine')}
                    disabled={isSpecialStatus}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    新增
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {outputItems.filter(i => i.category === 'urine').map((item, index) => {
                    const globalIndex = outputItems.findIndex(i => i === item);
                    return (
                      <div key={index} className="flex items-center gap-2 bg-red-50 px-3 py-1 rounded-full">
                        <span className="text-sm text-red-700">{formatOutputItem(item)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteOutputItem(globalIndex)}
                          disabled={isSpecialStatus}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
              </div>

              {/* 胃液 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-sm font-medium text-gray-700">🧪 胃液</span>
                  <button
                    type="button"
                    onClick={() => openAddOutputModal('gastric')}
                    disabled={isSpecialStatus}
                    className="flex items-center gap-1 px-3 py-1 text-sm bg-red-50 text-red-600 rounded-lg hover:bg-red-100 disabled:opacity-50"
                  >
                    <Plus className="w-4 h-4" />
                    新增
                  </button>
                </div>
                <div className="flex flex-wrap gap-2">
                  {outputItems.filter(i => i.category === 'gastric').map((item, index) => {
                    const globalIndex = outputItems.findIndex(i => i === item);
                    return (
                      <div key={index} className="flex items-center gap-2 bg-red-50 px-3 py-1 rounded-full">
                        <span className="text-sm text-red-700">{formatOutputItem(item)}</span>
                        <button
                          type="button"
                          onClick={() => handleDeleteOutputItem(globalIndex)}
                          disabled={isSpecialStatus}
                          className="text-red-500 hover:text-red-700 disabled:opacity-50"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    );
                  })}
                </div>
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
                type="button"
                onClick={handleSave}
                disabled={isSaving}
                className="flex-1 px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
              >
                {isSaving ? '保存中...' : (existingRecord ? '更新' : '儲存')}
              </button>
            </div>
          </div>
        </div>
      </div>

      {/* 新增攝入項目對話框 */}
      {showAddIntakeModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={() => setShowAddIntakeModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">
              新增{INTAKE_CATEGORIES[addCategory as IntakeCategory]?.label}
            </h3>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">類型</label>
                <select
                  value={newIntakeItemType}
                  onChange={(e) => setNewIntakeItemType(e.target.value)}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                >
                  {INTAKE_CATEGORIES[addCategory as IntakeCategory]?.types.map(type => (
                    <option key={type} value={type}>{type}</option>
                  ))}
                </select>
              </div>
              
              {addCategory === 'meal' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">份量</label>
                  <div className="flex gap-2 flex-wrap">
                    {INTAKE_CATEGORIES.meal.amounts.map(amount => (
                      <button
                        key={amount}
                        type="button"
                        onClick={() => setNewIntakeAmount(amount)}
                        className={`px-4 py-2 rounded-lg ${
                          newIntakeAmount === amount 
                            ? 'bg-blue-600 text-white' 
                            : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                        }`}
                      >
                        {amount}
                      </button>
                    ))}
                  </div>
                </div>
              )}
              
              {(addCategory === 'beverage' || addCategory === 'tube_feeding') && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">容量 (ml)</label>
                  <input
                    type="number"
                    value={newIntakeVolume}
                    onChange={(e) => setNewIntakeVolume(parseInt(e.target.value) || 0)}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                    min="0"
                  />
                </div>
              )}
              
              {addCategory === 'other' && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">數量</label>
                  <input
                    type="text"
                    value={newIntakeAmount}
                    onChange={(e) => setNewIntakeAmount(e.target.value)}
                    placeholder="例如：3塊"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowAddIntakeModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleAddIntakeItem}
                className="flex-1 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700"
              >
                確認新增
              </button>
            </div>
          </div>
        </div>
      )}

      {/* 新增排出項目對話框 */}
      {showAddOutputModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-[60] p-4" onClick={() => setShowAddOutputModal(false)}>
          <div className="bg-white rounded-lg shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-lg font-semibold mb-4">
              新增{OUTPUT_CATEGORIES[addCategory as OutputCategory]?.label}
            </h3>
            
            <div className="space-y-4">
              {/* 無尿/無胃液 選項 */}
              <div>
                <label className="flex items-center gap-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={isNoOutput}
                    onChange={(e) => setIsNoOutput(e.target.checked)}
                    className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span className="text-sm font-medium text-gray-700">
                    {addCategory === 'urine' ? '無尿' : '無胃液'}
                  </span>
                </label>
              </div>
              
              {!isNoOutput && (
                <>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">顏色</label>
                    <div className="flex gap-2 flex-wrap">
                      {OUTPUT_CATEGORIES[addCategory as OutputCategory]?.colors.map(color => (
                        <button
                          key={color}
                          type="button"
                          onClick={() => setNewOutputColor(color)}
                          className={`px-4 py-2 rounded-lg ${
                            newOutputColor === color 
                              ? 'bg-blue-600 text-white' 
                              : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                          }`}
                        >
                          {color}
                        </button>
                      ))}
                    </div>
                  </div>
                  
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">容量 (ml)</label>
                    <input
                      type="number"
                      value={newOutputVolume}
                      onChange={(e) => setNewOutputVolume(parseInt(e.target.value) || 0)}
                      className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                      min="0"
                    />
                  </div>
                  
                  {addCategory === 'gastric' && (
                    <div>
                      <label className="block text-sm font-medium text-gray-700 mb-1">pH值</label>
                      <input
                        type="number"
                        value={newOutputPH}
                        onChange={(e) => setNewOutputPH(parseFloat(e.target.value) || 0)}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
                        min="0"
                        max="14"
                        step="0.1"
                      />
                    </div>
                  )}
                </>
              )}
            </div>
            
            <div className="flex gap-3 mt-6">
              <button
                type="button"
                onClick={() => setShowAddOutputModal(false)}
                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                取消
              </button>
              <button
                type="button"
                onClick={handleAddOutputItem}
                className="flex-1 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700"
              >
                確認新增
              </button>
            </div>
          </div>
        </div>
      )}

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
