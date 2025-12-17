import React from 'react';
import { X, AlertTriangle, Clock, User, Pill, CheckCircle, XCircle } from 'lucide-react';
import { usePatients } from '../context/PatientContext';

interface RevertConfirmModalProps {
  isOpen: boolean;
  onClose: () => void;
  workflowRecord: any;
  step: 'preparation' | 'verification' | 'dispensing';
  onConfirm: () => void;
}

const RevertConfirmModal: React.FC<RevertConfirmModalProps> = ({
  isOpen,
  onClose,
  workflowRecord,
  step,
  onConfirm
}) => {
  const { patients, prescriptions } = usePatients();

  if (!isOpen) return null;

  const patient = patients.find(p => p.院友id === workflowRecord.patient_id);
  const prescription = prescriptions.find(p => p.id === workflowRecord.prescription_id);

  const getStepLabel = (step: string) => {
    switch (step) {
      case 'preparation': return '執藥';
      case 'verification': return '核藥';
      case 'dispensing': return '派藥';
      default: return step;
    }
  };

  const getStepStaff = () => {
    switch (step) {
      case 'preparation':
        return workflowRecord.preparation_staff;
      case 'verification':
        return workflowRecord.verification_staff;
      case 'dispensing':
        return workflowRecord.dispensing_staff;
      default:
        return null;
    }
  };

  const getStepTime = () => {
    switch (step) {
      case 'preparation':
        return workflowRecord.preparation_time;
      case 'verification':
        return workflowRecord.verification_time;
      case 'dispensing':
        return workflowRecord.dispensing_time;
      default:
        return null;
    }
  };

  const staff = getStepStaff();
  const time = getStepTime();

  const getDispensingStatus = () => {
    if (step !== 'dispensing') return null;
    return workflowRecord.dispensing_status;
  };

  const getDispensingInfo = () => {
    if (step !== 'dispensing') return null;

    const status = workflowRecord.dispensing_status;
    const failureReason = workflowRecord.dispensing_failure_reason;
    const customReason = workflowRecord.custom_failure_reason;

    let inspectionData = null;
    if (workflowRecord.inspection_check_result) {
      try {
        const result = typeof workflowRecord.inspection_check_result === 'string'
          ? JSON.parse(workflowRecord.inspection_check_result)
          : workflowRecord.inspection_check_result;

        // 提取檢測項數據
        const usedVitalSignData = result?.usedVitalSignData || {};
        const blockedRules = result?.blockedRules || [];

        inspectionData = {
          usedVitalSignData,
          blockedRules
        };
      } catch (error) {
        console.error('解析檢測結果失敗:', error);
      }
    }

    return {
      status,
      failureReason,
      customReason,
      inspectionData
    };
  };

  const dispensingStatus = getDispensingStatus();
  const dispensingInfo = getDispensingInfo();

  const handleConfirm = () => {
    onConfirm();
    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-md w-full p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center space-x-3">
            <div className="p-2 rounded-lg bg-orange-100">
              <AlertTriangle className="h-6 w-6 text-orange-600" />
            </div>
            <h2 className="text-xl font-semibold text-gray-900">
              確認撤銷{getStepLabel(step)}
            </h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="mb-6 p-4 bg-orange-50 border border-orange-200 rounded-lg">
          <p className="text-sm text-orange-800 font-medium mb-2">
            <AlertTriangle className="h-4 w-4 inline mr-1" />
            您即將撤銷此{getStepLabel(step)}操作
          </p>
          <p className="text-sm text-orange-700">
            撤銷後，此記錄將恢復為待處理狀態，之後的步驟也會被重置。
          </p>
        </div>

        <div className="mb-6 space-y-4">
          <div className="p-4 bg-gray-50 rounded-lg space-y-3">
            <div className="flex items-start space-x-3">
              <User className="h-5 w-5 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-gray-500">院友資訊</div>
                <div className="font-medium text-gray-900">
                  {patient?.中文姓氏}{patient?.中文名字} ({patient?.床號})
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Pill className="h-5 w-5 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-gray-500">藥物名稱</div>
                <div className="font-medium text-gray-900">
                  {prescription?.medication_name}
                </div>
              </div>
            </div>

            <div className="flex items-start space-x-3">
              <Clock className="h-5 w-5 text-gray-500 mt-0.5" />
              <div className="flex-1">
                <div className="text-xs text-gray-500">排程時間</div>
                <div className="font-medium text-gray-900">
                  {new Date(workflowRecord.scheduled_date).toLocaleDateString('zh-TW')} {workflowRecord.scheduled_time}
                </div>
              </div>
            </div>

            {staff && time && (
              <div className="pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 mb-1">執行資訊</div>
                <div className="text-sm text-gray-700">
                  執行人員：{staff}
                </div>
                <div className="text-sm text-gray-700">
                  執行時間：{new Date(time).toLocaleString('zh-TW')}
                </div>
              </div>
            )}

            {/* 派藥狀態區塊 */}
            {step === 'dispensing' && dispensingStatus && dispensingInfo && (
              <div className="pt-3 border-t border-gray-200">
                <div className="text-xs text-gray-500 mb-1">派藥狀態</div>
                {dispensingStatus === 'completed' && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <CheckCircle className="h-5 w-5 text-green-600" />
                      <span className="text-sm font-medium text-green-700">派藥成功</span>
                    </div>

                    {/* 檢測項資訊（iPad橫向模式隱藏檢測數據，Web桌面顯示） */}
                    {dispensingInfo.inspectionData && Object.keys(dispensingInfo.inspectionData.usedVitalSignData).length > 0 && (
                      <div className="pl-7 max-[1024px]:landscape:hidden">
                        <div className="text-xs text-gray-600 mb-1">檢測項數據：</div>
                        <div className="space-y-1">
                          {Object.entries(dispensingInfo.inspectionData.usedVitalSignData).map(([key, value]) => (
                            <div key={key} className="text-sm text-green-700">
                              <span className="font-medium">{key}:</span> {value as string}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
                {dispensingStatus === 'failed' && (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      <XCircle className="h-5 w-5 text-red-600" />
                      <span className="text-sm font-medium text-red-700">派藥失敗</span>
                    </div>

                    {/* 失敗原因 */}
                    {dispensingInfo.failureReason && (
                      <div className="pl-7">
                        <div className="text-xs text-gray-600">失敗原因：</div>
                        <div className="text-sm text-red-700 font-medium">
                          {dispensingInfo.failureReason === '其他' && dispensingInfo.customReason
                            ? dispensingInfo.customReason
                            : dispensingInfo.failureReason}
                        </div>
                      </div>
                    )}

                    {/* 檢測不合格項目（iPad橫向模式隱藏檢測數據，Web桌面顯示） */}
                    {dispensingInfo.inspectionData && dispensingInfo.inspectionData.blockedRules.length > 0 && (
                      <div className="pl-7 max-[1024px]:landscape:hidden">
                        <div className="text-xs text-gray-600 mb-1">檢測不合格項目：</div>
                        <div className="space-y-1">
                          {dispensingInfo.inspectionData.blockedRules.map((rule: any, index: number) => (
                            <div key={index} className="text-sm text-red-700">
                              <span className="font-medium">{rule.vital_sign_type}:</span>{' '}
                              {rule.actual_value || rule.actualValue}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>

        <div className="flex space-x-3">
          <button
            onClick={handleConfirm}
            className="btn-danger flex-1 flex items-center justify-center space-x-2"
          >
            <AlertTriangle className="h-4 w-4" />
            <span>確認撤銷</span>
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
  );
};

export default RevertConfirmModal;
