import React, { useState, useMemo } from 'react';
import { X, Calendar, AlertTriangle, CheckCircle, User, Pill, Clock } from 'lucide-react';
import { usePatients } from '../context/PatientContext';

interface BatchPrescriptionDateUpdateModalProps {
  selectedPrescriptionIds: string[];
  onClose: () => void;
  onSuccess: () => void;
}

const BatchPrescriptionDateUpdateModal: React.FC<BatchPrescriptionDateUpdateModalProps> = ({
  selectedPrescriptionIds,
  onClose,
  onSuccess
}) => {
  const { prescriptions, patients, updatePrescription } = usePatients();
  const [newPrescriptionDate, setNewPrescriptionDate] = useState('');
  const [newMedicationSource, setNewMedicationSource] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  // 香港時區輔助函數
  const getHongKongDate = () => {
    const now = new Date();
    const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000));
    return hongKongTime.toISOString().split('T')[0];
  };

  // 獲取選中的處方並按院友分組
  const selectedPrescriptions = useMemo(() => {
    return prescriptions.filter(p => selectedPrescriptionIds.includes(p.id));
  }, [prescriptions, selectedPrescriptionIds]);

  const prescriptionsByPatient = useMemo(() => {
    const grouped = selectedPrescriptions.reduce((acc, prescription) => {
      const patientId = prescription.patient_id;
      if (!acc[patientId]) {
        acc[patientId] = [];
      }
      acc[patientId].push(prescription);
      return acc;
    }, {} as Record<number, any[]>);

    return Object.entries(grouped).map(([patientId, prescriptions]) => {
      const patient = patients.find(p => p.院友id === parseInt(patientId));
      return {
        patient,
        prescriptions: prescriptions.sort((a, b) => a.medication_name.localeCompare(b.medication_name))
      };
    }).sort((a, b) => {
      if (!a.patient || !b.patient) return 0;
      return a.patient.床號.localeCompare(b.patient.床號, 'zh-Hant', { numeric: true });
    });
  }, [selectedPrescriptions, patients]);

  // 初始化為今天的日期
  React.useEffect(() => {
    setNewPrescriptionDate(getHongKongDate());
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!newPrescriptionDate) {
      alert('請選擇新的處方日期');
      return;
    }

    if (selectedPrescriptions.length === 0) {
      alert('沒有選中的處方');
      return;
    }

    const updateFields = ['處方日期'];
    if (newMedicationSource) {
      updateFields.push('藥物來源');
    }

    const confirmMessage = `確定要將 ${selectedPrescriptions.length} 個處方的${updateFields.join('和')}更新嗎？

更新內容：
• 處方日期：${new Date(newPrescriptionDate).toLocaleDateString('zh-TW')}${newMedicationSource ? `\n• 藥物來源：${newMedicationSource}` : ''}

此操作將影響：
${prescriptionsByPatient.map(group => 
  `• ${group.patient?.中文姓氏}${group.patient?.中文名字} (${group.patient?.床號}): ${group.prescriptions.length} 個處方`
).join('\n')}

此操作無法復原，請確認。`;

    if (!confirm(confirmMessage)) {
      return;
    }

    setIsSubmitting(true);

    try {
      let successCount = 0;
      let errorCount = 0;
      const errors: string[] = [];

      // 批量更新處方日期
      for (const prescription of selectedPrescriptions) {
        try {
          const updateData = {
            ...prescription,
            prescription_date: newPrescriptionDate
          };

          // 如果有選擇新的藥物來源，也一併更新
          if (newMedicationSource) {
            updateData.medication_source = newMedicationSource;
          }

          await updatePrescription(updateData);
          successCount++;
        } catch (error) {
          console.error(`更新處方 ${prescription.id} 失敗:`, error);
          errorCount++;
          errors.push(`${prescription.medication_name}: ${error instanceof Error ? error.message : '未知錯誤'}`);
        }
      }

      if (errorCount === 0) {
        alert(`成功更新 ${successCount} 個處方的${updateFields.join('和')}`);
      } else if (successCount > 0) {
        alert(`部分更新成功：\n• 成功：${successCount} 個處方\n• 失敗：${errorCount} 個處方\n\n失敗詳情：\n${errors.join('\n')}`);
      } else {
        alert(`批量更新失敗：\n${errors.join('\n')}`);
        return; // 如果全部失敗，不調用 onSuccess
      }

      onSuccess();
    } catch (error) {
      console.error('批量更新處方日期失敗:', error);
      alert(`批量更新失敗：${error instanceof Error ? error.message : '未知錯誤'}\n\n請檢查網路連線並重試`);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Calendar className="h-6 w-6 text-blue-600" />
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">批量更新處方日期</h2>
                <p className="text-sm text-gray-600">
                  將為 {selectedPrescriptions.length} 個處方更新處方日期
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
              disabled={isSubmitting}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 新處方日期設定 */}
          <div className="bg-blue-50 rounded-lg p-4">
            <h3 className="text-lg font-medium text-gray-900 mb-4 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-blue-600" />
              批量更新設定
            </h3>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="form-label">
                  新處方日期 <span className="text-red-500">*</span>
                </label>
                <input
                  type="date"
                  value={newPrescriptionDate}
                  onChange={(e) => setNewPrescriptionDate(e.target.value)}
                  className="form-input"
                  required
                />
              </div>
              
              <div>
                <label className="form-label">
                  新藥物來源 (可選)
                </label>
                <select
                  value={newMedicationSource}
                  onChange={(e) => setNewMedicationSource(e.target.value)}
                  className="form-input"
                >
                  <option value="">不更新藥物來源</option>
                  <option value="醫院">醫院</option>
                  <option value="診所">診所</option>
                  <option value="藥房">藥房</option>
                  <option value="專科門診">專科門診</option>
                  <option value="急症室">急症室</option>
                  <option value="社康護士">社康護士</option>
                  <option value="家庭醫生">家庭醫生</option>
                  <option value="其他">其他</option>
                </select>
              </div>
              
              <div className="flex items-end">
                <div className="text-sm text-gray-600">
                  <div className="font-medium mb-1">將更新為：</div>
                  <div className="space-y-1">
                    <div className="text-sm font-semibold text-blue-600">
                      日期：{newPrescriptionDate ? new Date(newPrescriptionDate).toLocaleDateString('zh-TW') : '請選擇日期'}
                    </div>
                    {newMedicationSource && (
                      <div className="text-sm font-semibold text-green-600">
                        來源：{newMedicationSource}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* 安全提示 */}
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
            <div className="flex items-start space-x-3">
              <AlertTriangle className="h-5 w-5 text-yellow-600 mt-0.5" />
              <div>
                <h4 className="text-sm font-medium text-yellow-900 mb-2">重要提醒</h4>
                <ul className="text-sm text-yellow-800 space-y-1 list-disc list-inside">
                  <li>處方日期更新後將影響處方的時間記錄和工作流程</li>
                  {newMedicationSource && <li>藥物來源更新後將影響處方的來源追蹤</li>}
                  <li>此操作無法復原，請確認日期正確</li>
                  <li>建議在更新前備份重要資料</li>
                  <li>更新後請檢查相關的藥物工作流程記錄</li>
                </ul>
              </div>
            </div>
          </div>

          {/* 處方預覽 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <CheckCircle className="h-5 w-5 mr-2 text-green-600" />
              將要更新的處方 ({selectedPrescriptions.length} 個)
            </h3>

            <div className="space-y-4 max-h-96 overflow-y-auto">
              {prescriptionsByPatient.map(({ patient, prescriptions }) => (
                <div key={patient?.院友id} className="border border-gray-200 rounded-lg p-4">
                  {/* 院友資訊 */}
                  <div className="flex items-center space-x-3 mb-3 pb-3 border-b border-gray-200">
                    <div className="w-10 h-10 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center">
                      {patient?.院友相片 ? (
                        <img 
                          src={patient.院友相片} 
                          alt={patient.中文姓名} 
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <User className="h-5 w-5 text-blue-600" />
                      )}
                    </div>
                    <div>
                      <div className="font-medium text-gray-900">
                        {patient?.中文姓氏}{patient?.中文名字}
                      </div>
                      <div className="text-sm text-gray-500">
                        {patient?.床號} • {prescriptions.length} 個處方
                      </div>
                    </div>
                  </div>

                  {/* 處方列表 */}
                  <div className="space-y-2">
                    {prescriptions.map(prescription => (
                      <div key={prescription.id} className="bg-gray-50 rounded-lg p-3">
                        <div className="flex items-center justify-between">
                          <div className="flex items-center space-x-3">
                            <Pill className="h-4 w-4 text-gray-500" />
                            <div>
                              <div className="font-medium text-gray-900">
                                {prescription.medication_name}
                              </div>
                              <div className="text-sm text-gray-600">
                                {prescription.dosage_amount && (
                                  <span>
                                    {prescription.dosage_amount}{prescription.dosage_unit || ''} • 
                                  </span>
                                )}
                                {prescription.administration_route && (
                                  <span>{prescription.administration_route} • </span>
                                )}
                                <span>
                                  {prescription.frequency_type === 'daily' ? '每日' : 
                                   prescription.frequency_type === 'every_x_days' ? `隔${prescription.frequency_value}日` :
                                   prescription.frequency_type}
                                </span>
                              </div>
                            </div>
                          </div>
                          <div className="text-right">
                            <div className="text-sm text-gray-600">當前處方日期</div>
                            <div className="font-medium text-gray-900">
                              {new Date(prescription.prescription_date).toLocaleDateString('zh-TW')}
                            </div>
                            {prescription.medication_source && (
                              <div className="text-xs text-gray-500 mt-1">
                                來源：{prescription.medication_source}
                              </div>
                            )}
                            <div className="text-xs text-blue-600 mt-1">
                              → 日期：{newPrescriptionDate ? new Date(newPrescriptionDate).toLocaleDateString('zh-TW') : '待設定'}
                              {newMedicationSource && (
                                <div>→ 來源：{newMedicationSource}</div>
                              )}
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* 操作按鈕 */}
          <div className="flex space-x-3 pt-4 border-t border-gray-200">
            <button
              type="submit"
              disabled={!newPrescriptionDate || isSubmitting}
              className="btn-primary flex-1 flex items-center justify-center space-x-2"
            >
              {isSubmitting ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>更新中...</span>
                </>
              ) : (
                <>
                  <Calendar className="h-4 w-4" />
                  <span>確認批量更新</span>
                </>
              )}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
              disabled={isSubmitting}
            >
              取消
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default BatchPrescriptionDateUpdateModal;