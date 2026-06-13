import React, { useState, useEffect, useMemo } from 'react';
import { X, Clock, User, AlertTriangle, CheckCircle, PauseCircle, Trash2, Info, Shield, Calendar } from 'lucide-react';
import type { Patient, RestraintObservationRecord, PatientRestraintAssessment } from '../lib/database';
import { addRandomOffset } from '../utils/careRecordHelper';
import DeleteConfirmModal from './DeleteConfirmModal';

interface RestraintObservationModalProps {
  patient: Patient;
  date: string;
  timeSlot: string;
  staffName: string;
  existingRecord?: RestraintObservationRecord | null;
  restraintAssessments: PatientRestraintAssessment[];
  allRestraintRecords?: RestraintObservationRecord[];
  onClose: () => void;
  onSubmit: (data: Omit<RestraintObservationRecord, 'id' | 'created_at' | 'updated_at'>) => void;
  onDelete?: (recordId: string) => void;
}

const RestraintObservationModal: React.FC<RestraintObservationModalProps> = ({
  patient,
  date,
  timeSlot,
  staffName,
  existingRecord,
  restraintAssessments,
  allRestraintRecords = [],
  onClose,
  onSubmit,
  onDelete
}) => {
  const [observationTime, setObservationTime] = useState('');
  const [observationStatus, setObservationStatus] = useState<'N' | 'P' | 'S'>('N');
  const [recorder, setRecorder] = useState('');
  const [coSigner, setCoSigner] = useState('');
  const [notes, setNotes] = useState('');
  const [selectedRestraints, setSelectedRestraints] = useState<string[]>([]);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);

  // 獲取最新的約束評估
  const latestAssessment = useMemo(() => {
    const patientAssessments = restraintAssessments
      .filter(a => a.patient_id === patient.院友id)
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());

    return patientAssessments[0] || null;
  }, [restraintAssessments, patient.院友id]);

  // 解析建議的約束物品
  const suggestedRestraints = useMemo(() => {
    if (!latestAssessment || !latestAssessment.suggested_restraints) return [];

    const restraints = latestAssessment.suggested_restraints;
    const items: string[] = [];

    if (typeof restraints === 'object') {
      // 遍歷所有約束物品並檢查 checked 欄位
      Object.entries(restraints).forEach(([key, value]: [string, any]) => {
        // 檢查是否有 checked 欄位且為 true
        if (typeof value === 'object' && value !== null && value.checked === true) {
          // 將約束物品名稱添加到列表（使用鍵名作為顯示名稱）
          items.push(key);
        }
        // 也支持舊版本的布林值格式
        else if (typeof value === 'boolean' && value === true) {
          // 英文鍵名對照表
          const nameMap: Record<string, string> = {
            'bed_rail': '床欄',
            'wheelchair_belt': '輪椅安全帶',
            'wheelchair_table': '輪椅餐桌板',
            'vest': '約束背心',
            'wrist_restraint': '手部約束帶',
            'ankle_restraint': '腳部約束帶',
            'mitt': '手套'
          };
          items.push(nameMap[key] || key);
        }
      });

      // 檢查其他約束物品
      if (restraints.others && restraints.others_specify) {
        items.push(restraints.others_specify);
      }
      if (restraints['其他約束物品'] && restraints['其他約束物品'].checked && restraints['其他約束物品']['名稱']) {
        items.push(restraints['其他約束物品']['名稱']);
      }
    }

    return items;
  }, [latestAssessment]);

  useEffect(() => {
    if (existingRecord) {
      setObservationTime(existingRecord.observation_time);
      setObservationStatus(existingRecord.observation_status);
      setRecorder(existingRecord.recorder);
      setCoSigner(existingRecord.co_signer || '');
      setNotes(existingRecord.notes || '');
      // 從 used_restraints 轉換為字串陣列
      const restraintList = existingRecord.used_restraints
        ? Object.keys(existingRecord.used_restraints).filter(key => existingRecord.used_restraints[key])
        : [];
      setSelectedRestraints(restraintList);
    } else {
      const randomTime = addRandomOffset(timeSlot);
      setObservationTime(randomTime);
      setObservationStatus('N');
      setRecorder(staffName);
      setCoSigner('');
      setNotes('');
      
      // 根據上一個時間段的記錄預填約束物品
      const getPreviousRestraints = () => {
        // 將 HH:00 格式轉換為 XA/XP/12N/12M 格式
        const convertTimeToSlot = (time: string): string => {
          const hour = parseInt(time.split(':')[0]);
          if (hour === 7) return '7A';
          if (hour === 8) return '8A';
          if (hour === 9) return '9A';
          if (hour === 10) return '10A';
          if (hour === 11) return '11A';
          if (hour === 12) return '12N';
          if (hour === 13) return '1P';
          if (hour === 14) return '2P';
          if (hour === 15) return '3P';
          if (hour === 16) return '4P';
          if (hour === 17) return '5P';
          if (hour === 18) return '6P';
          if (hour === 19) return '7P';
          if (hour === 20) return '8P';
          if (hour === 21) return '9P';
          if (hour === 22) return '10P';
          if (hour === 23) return '11P';
          if (hour === 0) return '12M';
          if (hour === 1) return '1A';
          if (hour === 2) return '2A';
          if (hour === 3) return '3A';
          if (hour === 4) return '4A';
          if (hour === 5) return '5A';
          if (hour === 6) return '6A';
          return time; // 如果已經是 XA/XP 格式，直接返回
        };
        
        // 定義時段順序
        const timeSlots = ['7A', '8A', '9A', '10A', '11A', '12N', '1P', '2P', '3P', '4P', '5P', '6P', '7P', '8P', '9P', '10P', '11P', '12M', '1A', '2A', '3A', '4A', '5A', '6A'];
        
        // 轉換當前時段
        const currentSlot = convertTimeToSlot(timeSlot);
        
        // 找出當前時段的索引
        const currentIndex = timeSlots.indexOf(currentSlot);
        if (currentIndex === -1) return [];
        
        // 如果是第一個時段(7A)，不預填
        if (currentIndex === 0) {
          return [];
        }
        
        // 過濾同一院友的記錄
        const patientRecords = allRestraintRecords.filter(r => r.patient_id === patient.院友id);
        
        // 查找當天之前時段的記錄
        const todayRecords = patientRecords
          .filter(r => r.observation_date === date)
          .filter(r => {
            const recordSlot = convertTimeToSlot(r.scheduled_time);
            const recordIndex = timeSlots.indexOf(recordSlot);
            return recordIndex !== -1 && recordIndex < currentIndex;
          })
          .sort((a, b) => {
            const aSlot = convertTimeToSlot(a.scheduled_time);
            const bSlot = convertTimeToSlot(b.scheduled_time);
            const aIndex = timeSlots.indexOf(aSlot);
            const bIndex = timeSlots.indexOf(bSlot);
            return bIndex - aIndex; // 降序排列，最近的在前
          });
        
        if (todayRecords.length > 0) {
          const latestRecord = todayRecords[0]; // 最近的一條記錄
          
          // 只檢查上一個時段，如果沒有數據就不預填
          if (latestRecord.used_restraints) {
            const restraints = Object.keys(latestRecord.used_restraints).filter(key => latestRecord.used_restraints[key]);
            if (restraints.length > 0) {
              return restraints;
            }
          }
        }
        
        return []; // 沒有找到上一個記錄，不預填
      };
      
      setSelectedRestraints(getPreviousRestraints());
    }
  }, [existingRecord, timeSlot, staffName, date, patient.院友id, allRestraintRecords]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 將選中的約束物品轉換為 object 格式
    const usedRestraintsObj: Record<string, boolean> = {};
    selectedRestraints.forEach(item => {
      usedRestraintsObj[item] = true;
    });

    const trimmedNotes = notes.trim();
    const trimmedCoSigner = coSigner.trim();

    const data: Omit<RestraintObservationRecord, 'id' | 'created_at' | 'updated_at'> = {
      patient_id: patient.院友id,
      observation_date: date,
      observation_time: observationTime,
      scheduled_time: timeSlot,
      co_signer: trimmedCoSigner || null,
      observation_status: observationStatus,
      recorder: recorder,
      notes: trimmedNotes || null,
      used_restraints: selectedRestraints.length > 0 ? usedRestraintsObj : null
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
      // 反選時清空 notes
      setNotes('');
      // 注意：反選時不恢復之前的值，保持空白狀態，讓用戶重新輸入
    } else {
      setNotes(value);
      if (['入院', '渡假', '外出'].includes(value)) {
        // 選擇特殊狀態時清空觀察狀態和約束物品
        setObservationStatus('N');
        setSelectedRestraints([]);
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

  const getStatusText = () => {
    switch (observationStatus) {
      case 'N': return '正常';
      case 'P': return '問題';
      case 'S': return '睡眠';
      default: return '未設定';
    }
  };

  const getStatusButtonClass = (status: 'N' | 'P' | 'S') => {
    const baseClass = "flex-1 py-4 px-4 rounded-lg font-medium transition-all duration-200 flex items-center justify-center space-x-2";
    if (isSpecialStatus) {
      return `${baseClass} bg-gray-100 text-gray-400 cursor-not-allowed opacity-50`;
    }
    if (observationStatus === status) {
      if (status === 'N') return `${baseClass} bg-green-600 text-white shadow-lg`;
      if (status === 'P') return `${baseClass} bg-red-600 text-white shadow-lg`;
      if (status === 'S') return `${baseClass} bg-gray-600 text-white shadow-lg`;
    }
    return `${baseClass} bg-gray-100 text-gray-700 hover:bg-gray-200`;
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white z-10">
          <h2 className="text-xl font-semibold text-gray-900">
            {existingRecord ? '查看/編輯約束觀察記錄' : '新增約束觀察記錄'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div className="grid grid-cols-2 gap-4">
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
                床號
              </label>
              <input
                type="text"
                value={patient.床號}
                disabled
                className="w-full px-3 py-2 border border-gray-300 rounded-lg bg-gray-50 text-gray-600"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              觀察日期
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

          {/* 院友約束物品建議 - 可複選 */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              <Shield className="w-4 h-4 inline mr-1" />
              使用的約束物品
            </label>
            {!latestAssessment ? (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3">
                <p className="text-sm text-yellow-800">
                  <AlertTriangle className="w-4 h-4 inline mr-1" />
                  該院友尚未進行約束評估，無法選擇約束物品
                </p>
              </div>
            ) : suggestedRestraints.length === 0 ? (
              <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
                <p className="text-sm text-gray-600">
                  <Info className="w-4 h-4 inline mr-1" />
                  該院友的評估結果無建議使用約束物品
                </p>
              </div>
            ) : (
              <>
                {latestAssessment?.other_restraint_notes && (
                  <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mb-3">
                    <p className="text-sm text-blue-700">
                      <Info className="w-4 h-4 inline mr-1" />
                      備註：{latestAssessment.other_restraint_notes}
                    </p>
                  </div>
                )}
                <div className="grid grid-cols-2 gap-3">
                  {suggestedRestraints.map((item) => (
                    <label key={item} className={`flex items-center space-x-2 p-3 border rounded-lg ${isSpecialStatus ? 'border-gray-300 bg-gray-100 opacity-50 cursor-not-allowed' : 'border-blue-400 bg-blue-50 hover:bg-blue-100 cursor-pointer'}`}>
                      <input
                        type="checkbox"
                        checked={selectedRestraints.includes(item)}
                        onChange={(e) => {
                          if (e.target.checked) {
                            setSelectedRestraints([...selectedRestraints, item]);
                          } else {
                            setSelectedRestraints(selectedRestraints.filter(r => r !== item));
                          }
                        }}
                        disabled={isSpecialStatus}
                        className="w-4 h-4 text-blue-600 rounded focus:ring-2 focus:ring-blue-500 disabled:opacity-50 disabled:cursor-not-allowed"
                      />
                      <span className="text-sm text-gray-700">{item}</span>
                    </label>
                  ))}
                </div>
              </>
            )}
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <Clock className="w-4 h-4 inline mr-1" />
              實際觀察時間 *
            </label>
            <input
              type="time"
              value={observationTime}
              onChange={(e) => setObservationTime(e.target.value)}
              required
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-900 mb-3">
              觀察狀態 *
            </label>
            <div className="flex space-x-2">
              <button
                type="button"
                onClick={() => setObservationStatus('N')}
                disabled={isSpecialStatus}
                className={getStatusButtonClass('N')}
              >
                <CheckCircle className="w-5 h-5" />
                <span>正常 (N)</span>
              </button>
              <button
                type="button"
                onClick={() => setObservationStatus('P')}
                disabled={isSpecialStatus}
                className={getStatusButtonClass('P')}
              >
                <AlertTriangle className="w-5 h-5" />
                <span>異常 (P)</span>
              </button>
              <button
                type="button"
                onClick={() => setObservationStatus('S')}
                disabled={isSpecialStatus}
                className={getStatusButtonClass('S')}
              >
                <PauseCircle className="w-5 h-5" />
                <span>暫停 (S)</span>
              </button>
            </div>
            <p className="text-xs text-gray-500 mt-2">
              N = 正常，P = 異常（需要注意或處理），S = 暫停約束
            </p>
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

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              <User className="w-4 h-4 inline mr-1" />
              加簽者
            </label>
            <input
              type="text"
              value={coSigner}
              onChange={(e) => setCoSigner(e.target.value)}
              placeholder="選填"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
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
                {existingRecord ? '更新記錄' : '確認觀察'}
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
          title="刪除約束觀察記錄確認"
          recordType="約束觀察記錄"
          patientInfo={{
            name: patient.中文姓名,
            bedNumber: patient.床號,
            patientId: patient.院友id
          }}
          recordDetails={[
            {
              label: '觀察日期',
              value: date,
              icon: <Calendar className="w-4 h-4 text-gray-500" />
            },
            {
              label: '預定時段',
              value: timeSlot,
              icon: <Clock className="w-4 h-4 text-gray-500" />
            },
            {
              label: '實際觀察時間',
              value: observationTime,
              icon: <Clock className="w-4 h-4 text-gray-500" />
            },
            {
              label: '觀察狀態',
              value: getStatusText()
            },
            {
              label: '使用約束物品',
              value: selectedRestraints.length > 0 ? selectedRestraints.join(', ') : '無'
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

export default RestraintObservationModal;
