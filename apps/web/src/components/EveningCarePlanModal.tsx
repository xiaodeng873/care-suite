import { X, HeartHandshake, Calendar, User, FileText } from 'lucide-react';
import { usePatientData, type PatientEveningCarePlan } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';
import React, { useState } from 'react';
import DateInput from './DateInput';

interface EveningCarePlanModalProps {
  plan?: PatientEveningCarePlan;
  onClose: () => void;
  onUpdate?: () => void;
  renewFrom?: PatientEveningCarePlan | null;
}

const EveningCarePlanModal: React.FC<EveningCarePlanModalProps> = ({ plan, onClose, onUpdate, renewFrom }) => {
  const { patients, addPatientEveningCarePlan, updatePatientEveningCarePlan } = usePatientData();

  const [formData, setFormData] = useState({
    patient_id: plan?.patient_id || (renewFrom ? renewFrom.patient_id : '') as string | number,
    acp_date: plan?.acp_date || renewFrom?.acp_date || '',
    amd_date: plan?.amd_date || renewFrom?.amd_date || '',
    dnacpr_date: plan?.dnacpr_date || renewFrom?.dnacpr_date || '',
    notes: plan?.notes || renewFrom?.notes || ''
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!formData.patient_id) {
      alert('請選擇院友');
      return;
    }

    // 必須至少填寫一份文件日期
    if (!formData.acp_date && !formData.amd_date && !formData.dnacpr_date) {
      alert('請至少填寫一份文件日期');
      return;
    }

    try {
      const planData = {
        patient_id: parseInt(String(formData.patient_id)),
        acp_date: formData.acp_date || null,
        amd_date: formData.amd_date || null,
        dnacpr_date: formData.dnacpr_date || null,
        notes: formData.notes || null
      };

      if (plan) {
        await updatePatientEveningCarePlan({
          id: plan.id,
          ...planData
        } as any);
      } else {
        // 續期（renewFrom）亦在此新建一筆，舊記錄保留為歷史
        await addPatientEveningCarePlan(planData as any);
      }

      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('儲存晚晴計劃記錄失敗:', error);
      alert('儲存晚晴計劃記錄失敗，請重試');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-2 rounded-lg bg-purple-100">
                <HeartHandshake className="h-6 w-6 text-purple-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {plan ? '編輯晚晴計劃記錄' : renewFrom ? '新增記錄（續期）' : '新增晚晴計劃記錄'}
              </h2>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600">

              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* 基本資訊 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">
                <User className="h-4 w-4 inline mr-1" />
                院友 *
              </label>
              {plan || renewFrom ?
              <div className="form-input bg-gray-100 cursor-not-allowed">
                  {(() => {
                  const pid = plan?.patient_id ?? renewFrom?.patient_id;
                  const p = patients.find((pt) => pt.院友id === Number(pid));
                  return p ? `${p.床號} - ${p.中文姓名}` : '未知院友';
                })()
                }
                </div> :

              <PatientAutocomplete
                value={formData.patient_id}
                onChange={(patientId) => setFormData((prev) => ({ ...prev, patient_id: patientId }))}
                placeholder="搜尋院友..."
                showResidencyFilter={true}
                defaultResidencyStatus="在住" />

              }
            </div>
            <div>
              <label className="form-label">
                <FileText className="h-4 w-4 inline mr-1" />
                備註
              </label>
              <textarea
                value={formData.notes}
                onChange={(e) => setFormData((prev) => ({ ...prev, notes: e.target.value }))}
                className="form-input"
                rows={1}
                placeholder="請輸入備註..." />
            </div>
          </div>

          {/* 文件到期日 */}
          <div className="space-y-4">
            <h3 className="text-lg font-medium text-gray-900 flex items-center">
              <Calendar className="h-5 w-5 mr-2 text-purple-600" />
              文件到期日（至少填寫一份）
            </h3>

            <div className="border rounded-lg p-4 bg-gray-50">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <label className="form-label">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    ACP 到期日
                  </label>
                  <DateInput

                    value={formData.acp_date}

                    className="form-input" onChange={(value) => setFormData((prev) => ({ ...prev, acp_date: value }))} />

                </div>

                <div>
                  <label className="form-label">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    AMD 到期日
                  </label>
                  <DateInput

                    value={formData.amd_date}

                    className="form-input" onChange={(value) => setFormData((prev) => ({ ...prev, amd_date: value }))} />

                </div>

                <div>
                  <label className="form-label">
                    <Calendar className="h-4 w-4 inline mr-1" />
                    DNACPR 到期日
                  </label>
                  <DateInput

                    value={formData.dnacpr_date}

                    className="form-input" onChange={(value) => setFormData((prev) => ({ ...prev, dnacpr_date: value }))} />

                </div>
              </div>
            </div>
          </div>

          {/* 提交按鈕 */}
          <div className="flex flex-col sm:flex-row gap-2 pt-4 border-t border-gray-200">
            <button
              type="submit"
              className="btn-primary flex-1">

              {plan ? '更新晚晴計劃記錄' : '新增晚晴計劃記錄'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1">

              取消
            </button>
          </div>
        </form>
      </div>
    </div>);

};

export default EveningCarePlanModal;
