import React, { useState } from 'react';
import { X, ArrowRight, AlertTriangle, CheckCircle, FileText } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import PrescriptionEndDateModal from './PrescriptionEndDateModal';

interface PrescriptionTransferModalProps {
  prescription: any;
  onClose: () => void;
}

const PrescriptionTransferModal: React.FC<PrescriptionTransferModalProps> = ({ 
  prescription, 
  onClose 
}) => {
  const { prescriptions, updatePrescription, patients } = usePatients();
  const [targetStatus, setTargetStatus] = useState<'active' | 'inactive'>('active');
  const [comparisonResult, setComparisonResult] = useState<any>(null);
  const [selectedAction, setSelectedAction] = useState<'replace' | 'keep_both'>('replace');
  const [showEndDateModal, setShowEndDateModal] = useState(false);
  const [pendingTransfer, setPendingTransfer] = useState<{
    targetStatus: 'active' | 'pending_change' | 'inactive';
    endDate?: string | null;
  } | null>(null);

  const patient = patients.find(p => p.院友id === prescription.patient_id);

  // 比較處方差異
  React.useEffect(() => {
    if (targetStatus === 'active') {
      // 查找相同藥物名稱的在服處方
      const existingActivePrescription = prescriptions.find(p => 
        p.patient_id === prescription.patient_id &&
        p.medication_name === prescription.medication_name &&
        p.status === 'active' &&
        p.id !== prescription.id
      );

      if (existingActivePrescription) {
        // 比較差異
        const differences = [];
        
        if (existingActivePrescription.dosage_amount !== prescription.dosage_amount) {
          differences.push({
            field: '服用份量',
            old: existingActivePrescription.dosage_amount ? 
              `${existingActivePrescription.dosage_amount}${existingActivePrescription.dosage_unit || ''}` : 
              '未設定',
            new: prescription.dosage_amount ? 
              `${prescription.dosage_amount}${prescription.dosage_unit || ''}` : 
              '未設定'
          });
        }
        
        if (existingActivePrescription.frequency_type !== prescription.frequency_type) {
          differences.push({
            field: '服用頻率',
            old: getFrequencyDescription(existingActivePrescription),
            new: getFrequencyDescription(prescription)
          });
        }
        
        if (existingActivePrescription.meal_timing !== prescription.meal_timing) {
          differences.push({
            field: '服用時段',
            old: existingActivePrescription.meal_timing || '未設定',
            new: prescription.meal_timing || '未設定'
          });
        }
        
        if (existingActivePrescription.is_prn !== prescription.is_prn) {
          differences.push({
            field: '需要時(PRN)',
            old: existingActivePrescription.is_prn ? '是' : '否',
            new: prescription.is_prn ? '是' : '否'
          });
        }

        // 比較服用時間點
        const oldTimeSlots = existingActivePrescription.medication_time_slots || [];
        const newTimeSlots = prescription.medication_time_slots || [];
        if (JSON.stringify(oldTimeSlots.sort()) !== JSON.stringify(newTimeSlots.sort())) {
          differences.push({
            field: '服用時間點',
            old: oldTimeSlots.join(', ') || '未設定',
            new: newTimeSlots.join(', ') || '未設定'
          });
        }

        setComparisonResult({
          existingPrescription: existingActivePrescription,
          differences,
          isNewMedication: false
        });
      } else {
        setComparisonResult({
          existingPrescription: null,
          differences: [],
          isNewMedication: true
        });
      }
    } else {
      setComparisonResult(null);
    }
  }, [targetStatus, prescription, prescriptions]);

  const getFrequencyDescription = (prescription: any) => {
    const { frequency_type, frequency_value, specific_weekdays, is_odd_even_day } = prescription;
    
    switch (frequency_type) {
      case 'daily':
        return '每日服';
      case 'every_x_days':
        return `隔${frequency_value}日服`;
      case 'every_x_months':
        return `隔${frequency_value}月服`;
      case 'weekly_days':
        const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
        const days = specific_weekdays?.map((day: number) => dayNames[day - 1]).join('、') || '';
        return `逢${days}服`;
      case 'odd_even_days':
        return is_odd_even_day === 'odd' ? '單日服' : '雙日服';
      case 'hourly':
        return `每${frequency_value}小時服用`;
      default:
        return frequency_type;
    }
  };

  const handleTransfer = async (endDate?: string | null) => {
    const finalTargetStatus = pendingTransfer?.targetStatus || targetStatus;
    const finalEndDate = endDate !== undefined ? endDate : (pendingTransfer?.endDate || null);

    try {
      // 準備更新資料
      const updateData: any = {
        ...prescription,
        status: finalTargetStatus
      };

      // 根據目標狀態設定結束日期
      if (finalTargetStatus === 'inactive') {
        // 轉移到停用處方：必須有結束日期
        updateData.end_date = finalEndDate;
      } else {
        // 轉移到在服/待變更處方：允許保留用戶輸入的結束日期
        if (finalEndDate !== undefined) {
          updateData.end_date = finalEndDate;
        }
      }

      // 更新處方
      await updatePrescription(updateData);

      // 如果是轉為在服處方且有衝突，處理現有處方
      if (finalTargetStatus === 'active' && comparisonResult?.existingPrescription) {
        if (selectedAction === 'replace') {
          // 將現有處方轉為停用，設定結束日期和時間為當前系統時間
          await updatePrescription({
            ...comparisonResult.existingPrescription,
            status: 'inactive',
            end_date: getHongKongDate(),
            end_time: getHongKongTime()
          });
        }
        // 如果選擇保留兩者，不需要額外操作
      }

      // 清理狀態
      setPendingTransfer(null);
      onClose();
    } catch (error) {
      console.error('轉移處方失敗:', error);
      alert('轉移處方失敗，請重試');
    }
  };

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };

  const getHongKongTime = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[1].substring(0, 8); // HH:MM:SS
  };

  const handleInitiateTransfer = () => {
    // 檢查是否需要設定結束日期
    const needsEndDate = targetStatus === 'inactive' && !prescription.end_date;
    const needsEndDateRemoval = (targetStatus === 'active' || targetStatus === 'pending_change') && prescription.end_date;

    if (needsEndDate || needsEndDateRemoval) {
      // 需要處理結束日期，顯示結束日期模態框
      setPendingTransfer({ targetStatus, endDate: prescription.end_date });
      setShowEndDateModal(true);
    } else {
      // 不需要處理結束日期，直接轉移
      handleTransfer();
    }
  };

  const handleEndDateConfirm = (endDate: string | null) => {
    setShowEndDateModal(false);
    handleTransfer(endDate);
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'active': return 'text-green-600';
      case 'pending_change': return 'text-yellow-600';
      case 'inactive': return 'text-gray-600';
      default: return 'text-gray-600';
    }
  };

  const getStatusLabel = (status: string) => {
    switch (status) {
      case 'active': return '在服處方';
      case 'pending_change': return '待變更處方';
      case 'inactive': return '停用處方';
      default: return status;
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <ArrowRight className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">處方轉移</h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* 當前處方資訊 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">當前處方資訊</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <span className="text-sm text-gray-600">院友：</span>
                <span className="font-medium text-gray-900 ml-2">
                  {patient ? `${patient.床號} - ${patient.中文姓氏}${patient.中文名字}` : '未知院友'}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-600">藥物：</span>
                <span className="font-medium text-gray-900 ml-2">{prescription.medication_name}</span>
              </div>
              <div>
                <span className="text-sm text-gray-600">當前狀態：</span>
                <span className={`font-medium ml-2 ${getStatusColor(prescription.status)}`}>
                  {getStatusLabel(prescription.status)}
                </span>
              </div>
              <div>
                <span className="text-sm text-gray-600">服用份量：</span>
                <span className="font-medium text-gray-900 ml-2">
                  {prescription.dosage_amount ? 
                    `${prescription.dosage_amount}${prescription.dosage_unit || ''}` : 
                    '未設定'
                  }
                </span>
              </div>
            </div>
          </div>

          {/* 目標狀態選擇 */}
          <div>
            <label className="form-label">轉移到</label>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <label className={`flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                targetStatus === 'active' ? 'border-green-500 bg-green-50' : 'border-gray-200'
              }`}>
                <input
                  type="radio"
                  name="targetStatus"
                  value="active"
                  checked={targetStatus === 'active'}
                  onChange={(e) => setTargetStatus(e.target.value as 'active')}
                  className="h-4 w-4 text-green-600 focus:ring-green-500"
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <CheckCircle className="h-5 w-5 text-green-600" />
                    <span className="font-medium text-green-900">在服處方</span>
                  </div>
                  <p className="text-sm text-green-700">院友正在服用的處方</p>
                </div>
              </label>

              <label className={`flex items-center space-x-3 p-4 border-2 rounded-lg cursor-pointer transition-all ${
                targetStatus === 'inactive' ? 'border-gray-500 bg-gray-50' : 'border-gray-200'
              }`}>
                <input
                  type="radio"
                  name="targetStatus"
                  value="inactive"
                  checked={targetStatus === 'inactive'}
                  onChange={(e) => setTargetStatus(e.target.value as 'inactive')}
                  className="h-4 w-4 text-gray-600 focus:ring-gray-500"
                />
                <div>
                  <div className="flex items-center space-x-2">
                    <X className="h-5 w-5 text-gray-600" />
                    <span className="font-medium text-gray-900">停用處方</span>
                  </div>
                  <p className="text-sm text-gray-700">不再使用的處方</p>
                </div>
              </label>
            </div>
          </div>

          {/* 處方比較結果 */}
          {comparisonResult && targetStatus === 'active' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-blue-900 mb-3 flex items-center">
                <FileText className="h-5 w-5 mr-2" />
                處方比較結果
              </h3>

              {comparisonResult.isNewMedication ? (
                <div className="flex items-center space-x-2 text-green-700">
                  <CheckCircle className="h-5 w-5" />
                  <span>這是新增的藥物，沒有衝突的在服處方</span>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="flex items-center space-x-2 text-orange-700">
                    <AlertTriangle className="h-5 w-5" />
                    <span className="font-medium">發現相同藥物的在服處方，存在以下差異：</span>
                  </div>

                  {comparisonResult.differences.length > 0 ? (
                    <div className="bg-white border border-blue-300 rounded-lg overflow-hidden">
                      <table className="w-full text-sm">
                        <thead className="bg-blue-100">
                          <tr>
                            <th className="px-4 py-2 text-left font-medium text-blue-900">項目</th>
                            <th className="px-4 py-2 text-left font-medium text-blue-900">現有處方</th>
                            <th className="px-4 py-2 text-left font-medium text-blue-900">新處方</th>
                          </tr>
                        </thead>
                        <tbody>
                          {comparisonResult.differences.map((diff: any, index: number) => (
                            <tr key={index} className={index % 2 === 0 ? 'bg-white' : 'bg-blue-50'}>
                              <td className="px-4 py-2 font-medium text-gray-900">{diff.field}</td>
                              <td className="px-4 py-2 text-gray-700">{diff.old}</td>
                              <td className="px-4 py-2 text-gray-700">{diff.new}</td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  ) : (
                    <div className="flex items-center space-x-2 text-green-700">
                      <CheckCircle className="h-5 w-5" />
                      <span>處方內容相同，無需變更</span>
                    </div>
                  )}

                  {/* 處理選項 */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-blue-900">處理方式：</h4>
                    
                    <label className={`flex items-start space-x-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedAction === 'replace' ? 'border-red-500 bg-red-50' : 'border-gray-200'
                    }`}>
                      <input
                        type="radio"
                        name="action"
                        value="replace"
                        checked={selectedAction === 'replace'}
                        onChange={(e) => setSelectedAction(e.target.value as 'replace')}
                        className="h-4 w-4 text-red-600 focus:ring-red-500 mt-0.5"
                      />
                      <div>
                        <div className="font-medium text-gray-900">替換現有處方</div>
                        <p className="text-sm text-gray-600">
                          將現有的在服處方轉為停用處方，新處方成為在服處方
                        </p>
                      </div>
                    </label>

                    <label className={`flex items-start space-x-3 p-3 border-2 rounded-lg cursor-pointer transition-all ${
                      selectedAction === 'keep_both' ? 'border-blue-500 bg-blue-50' : 'border-gray-200'
                    }`}>
                      <input
                        type="radio"
                        name="action"
                        value="keep_both"
                        checked={selectedAction === 'keep_both'}
                        onChange={(e) => setSelectedAction(e.target.value as 'keep_both')}
                        className="h-4 w-4 text-blue-600 focus:ring-blue-500 mt-0.5"
                      />
                      <div>
                        <div className="font-medium text-gray-900">保留兩個處方</div>
                        <p className="text-sm text-gray-600">
                          保留現有的在服處方，新處方也成為在服處方（適用於不同劑量或時間的同一藥物）
                        </p>
                      </div>
                    </label>
                  </div>
                </div>
              )}
            </div>
          )}

          {/* 確認區域 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-3">轉移確認</h3>
            <div className="flex items-center space-x-4">
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">當前狀態：</span>
                <span className={`font-medium ${getStatusColor(prescription.status)}`}>
                  {getStatusLabel(prescription.status)}
                </span>
              </div>
              <ArrowRight className="h-5 w-5 text-gray-400" />
              <div className="flex items-center space-x-2">
                <span className="text-sm text-gray-600">目標狀態：</span>
                <span className={`font-medium ${getStatusColor(targetStatus)}`}>
                  {getStatusLabel(targetStatus)}
                </span>
              </div>
            </div>

            {comparisonResult?.existingPrescription && targetStatus === 'active' && (
              <div className="mt-3 p-3 bg-orange-100 border border-orange-300 rounded-lg">
                <div className="flex items-center space-x-2 text-orange-800">
                  <AlertTriangle className="h-4 w-4" />
                  <span className="text-sm font-medium">
                    {selectedAction === 'replace' 
                      ? '現有的在服處方將被轉為停用處方' 
                      : '將同時保留兩個在服處方'}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* 操作按鈕 */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              onClick={handleInitiateTransfer}
              className="btn-primary flex-1"
            >
              確認轉移
            </button>
            <button
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              取消
            </button>
          </div>
        </div>
      </div>

      {/* 結束日期設定模態框 */}
      {showEndDateModal && pendingTransfer && (
        <PrescriptionEndDateModal
          isOpen={showEndDateModal}
          onClose={() => {
            setShowEndDateModal(false);
            setPendingTransfer(null);
          }}
          prescription={prescription}
          targetStatus={pendingTransfer.targetStatus}
          onConfirm={handleEndDateConfirm}
        />
      )}
    </div>
  );
};

export default PrescriptionTransferModal;