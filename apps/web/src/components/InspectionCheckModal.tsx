import React, { useState, useEffect } from 'react';
import { X, Activity, Droplets, Heart, Thermometer, Wind, Eye, AlertTriangle, CheckCircle, Plus, XCircle } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import HealthRecordModal from './HealthRecordModal';

interface InspectionCheckModalProps {
  workflowRecord: any;
  onClose: () => void;
  onResult: (canDispense: boolean, failureReason?: string, inspectionCheckResult?: any) => void;
  isBatchMode?: boolean;
  batchProgress?: { current: number; total: number };
}

const InspectionCheckModal: React.FC<InspectionCheckModalProps> = ({
  workflowRecord,
  onClose,
  onResult,
  isBatchMode = false,
  batchProgress
}) => {
  const {
    patients,
    prescriptions,
    checkPrescriptionInspectionRules,
    fetchLatestVitalSigns,
    dispenseMedication,
    hospitalEpisodes
  } = usePatients();
  const { displayName } = useAuth();

  const [matchedRecords, setMatchedRecords] = useState<Record<string, { record: any; isMatched: boolean }>>({});
  const [missingVitalSigns, setMissingVitalSigns] = useState<string[]>([]);
  const [checkResult, setCheckResult] = useState<any>(null);
  const [isChecking, setIsChecking] = useState(false);
  const [loading, setLoading] = useState(true);
  const [hasNoRulesAndHandled, setHasNoRulesAndHandled] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [showHealthRecordModal, setShowHealthRecordModal] = useState(false);
  const [currentAddingVitalSign, setCurrentAddingVitalSign] = useState<string | null>(null);
  const isMountedRef = React.useRef(true);

  const patient = patients.find(p => p.院友id === workflowRecord.patient_id);
  const prescription = prescriptions.find(p => p.id === workflowRecord.prescription_id);
  const isHospitalized = patient?.is_hospitalized || false;

  const isOnVacation = hospitalEpisodes.some(episode => {
    if (episode.patient_id !== workflowRecord.patient_id || !episode.episode_events) {
      return false;
    }

    const vacationStartEvents = episode.episode_events.filter((e: any) => e.event_type === 'vacation_start');
    const vacationEndEvents = episode.episode_events.filter((e: any) => e.event_type === 'vacation_end');

    if (vacationStartEvents.length > vacationEndEvents.length) {
      return true;
    }

    return false;
  });

  const getVitalSignIcon = (type: string) => {
    switch (type) {
      case '上壓':
      case '下壓':
        return <Heart className="h-4 w-4" />;
      case '脈搏':
        return <Activity className="h-4 w-4" />;
      case '血糖值':
        return <Droplets className="h-4 w-4" />;
      case '呼吸':
        return <Wind className="h-4 w-4" />;
      case '血含氧量':
        return <Eye className="h-4 w-4" />;
      case '體溫':
        return <Thermometer className="h-4 w-4" />;
      default:
        return <Activity className="h-4 w-4" />;
    }
  };

  useEffect(() => {
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  useEffect(() => {
    setCheckResult(null);
    setMatchedRecords({});
    setMissingVitalSigns([]);
    setIsChecking(false);
    setLoading(true);
    setHasNoRulesAndHandled(false);
  }, [workflowRecord.id]);

  useEffect(() => {
    const initializeCheck = async () => {
      if (!prescription?.inspection_rules || prescription.inspection_rules.length === 0) {
        if (!hasNoRulesAndHandled) {
          setHasNoRulesAndHandled(true);

          setTimeout(() => {
            if (isMountedRef.current) {
              onResult(true, undefined, { canDispense: true, blockedRules: [], usedVitalSignData: {}, missingVitalSigns: [] });
            }
          }, 100);
        }
        setLoading(false);
        return;
      }

      if (isHospitalized) {
        try {
          const inspectionResult = {
            canDispense: false,
            isHospitalized: true,
            blockedRules: [],
            usedVitalSignData: {},
            missingVitalSigns: []
          };

          if (isBatchMode) {
            setHasNoRulesAndHandled(true);
            setTimeout(() => {
              if (isMountedRef.current) {
                onResult(false, '入院', inspectionResult);
              }
            }, 100);
          } else {
            await dispenseMedication(
              workflowRecord.id,
              displayName || '未知',
              '入院',
              undefined,
              workflowRecord.patient_id,
              workflowRecord.scheduled_date,
              undefined,
              inspectionResult
            );

            setHasNoRulesAndHandled(true);
            onClose();
          }
        } catch (error) {
          console.error('處理入院中院友派藥失敗:', error);
          alert(`處理失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
        }
        setLoading(false);
        return;
      }

      if (isOnVacation) {
        try {
          const inspectionResult = {
            canDispense: false,
            isOnVacation: true,
            blockedRules: [],
            usedVitalSignData: {},
            missingVitalSigns: []
          };

          if (isBatchMode) {
            setHasNoRulesAndHandled(true);
            setTimeout(() => {
              if (isMountedRef.current) {
                onResult(false, '回家', inspectionResult);
              }
            }, 100);
          } else {
            await dispenseMedication(
              workflowRecord.id,
              displayName || '未知',
              '回家',
              undefined,
              workflowRecord.patient_id,
              workflowRecord.scheduled_date,
              undefined,
              inspectionResult
            );

            setHasNoRulesAndHandled(true);
            onClose();
          }
        } catch (error) {
          console.error('處理渡假中院友派藥失敗:', error);
          alert(`處理失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
        }
        setLoading(false);
        return;
      }

      try {
        await loadMatchedRecords();
      } catch (error) {
        console.error('載入監測記錄失敗:', error);
      } finally {
        setLoading(false);
      }
    };

    initializeCheck();
  }, [prescription, workflowRecord.patient_id, workflowRecord.scheduled_date, workflowRecord.scheduled_time, hasNoRulesAndHandled, onResult, isHospitalized, dispenseMedication, displayName, workflowRecord, onClose, isBatchMode]);

  const loadMatchedRecords = async () => {
    if (!prescription?.inspection_rules) return;

    const vitalSignTypes = prescription.inspection_rules.map((rule: any) => rule.vital_sign_type);
    const matchedData: Record<string, { record: any; isMatched: boolean }> = {};
    const missing: string[] = [];

    for (const type of vitalSignTypes) {
      const result = await fetchLatestVitalSigns(
        workflowRecord.patient_id,
        type,
        workflowRecord.scheduled_date,
        workflowRecord.scheduled_time
      );

      if (result.record && result.isExactMatch) {
        matchedData[type] = { record: result.record, isMatched: true };
      } else {
        missing.push(type);
        matchedData[type] = { record: null, isMatched: false };
      }
    }

    setMatchedRecords(matchedData);
    setMissingVitalSigns(missing);
  };

  const performInspectionCheck = async () => {
    if (isChecking || isSubmitting) {
      return;
    }

    if (missingVitalSigns.length > 0) {
      alert(`請先新增以下檢測項的監測記錄：${missingVitalSigns.join('、')}`);
      return;
    }

    setIsChecking(true);

    try {
      const result = await checkPrescriptionInspectionRules(
        workflowRecord.prescription_id,
        workflowRecord.patient_id,
        workflowRecord.scheduled_date,
        workflowRecord.scheduled_time
      );

      setCheckResult(result);
    } catch (error) {
      console.error('檢測檢查失敗:', error);
      const errorMessage = error instanceof Error ? error.message : '未知錯誤';
      alert(`檢測檢查失敗: ${errorMessage}\n\n請檢查網絡連接或聯繫技術支持。`);
    } finally {
      setIsChecking(false);
    }
  };

  const handleConfirmDispense = async () => {
    if (!checkResult || isSubmitting) return;

    setIsSubmitting(true);

    try {
      if (checkResult.canDispense) {
        onResult(true, undefined, checkResult);
      } else {
        await dispenseMedication(
          workflowRecord.id,
          displayName || '未知',
          '其他',
          '檢測項條件不符',
          workflowRecord.patient_id,
          workflowRecord.scheduled_date,
          undefined,
          checkResult
        );

        onClose();
      }
    } catch (error) {
      console.error('處理派藥確認失敗:', error);
      alert(`操作失敗: ${error instanceof Error ? error.message : '未知錯誤'}`);
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleAddRecord = (vitalSignType: string) => {
    setCurrentAddingVitalSign(vitalSignType);
    setShowHealthRecordModal(true);
  };

  const handleHealthRecordSaved = async () => {
    setShowHealthRecordModal(false);
    setCurrentAddingVitalSign(null);
    setLoading(true);
    try {
      await loadMatchedRecords();
    } finally {
      setLoading(false);
    }
  };

  const getRecordType = (vitalSignType: string): string => {
    if (vitalSignType === '血糖值') {
      return '血糖控制';
    }
    return '生命表徵';
  };

  const getFocusField = (vitalSignType: string): string => {
    const fieldMap: Record<string, string> = {
      '上壓': '血壓收縮壓',
      '下壓': '血壓舒張壓',
      '脈搏': '脈搏',
      '血糖值': '血糖值',
      '呼吸': '呼吸頻率',
      '血含氧量': '血含氧量',
      '體溫': '體溫'
    };
    return fieldMap[vitalSignType] || '';
  };

  const getVitalSignValue = (record: any, vitalSignType: string): any => {
    const fieldMap: Record<string, string> = {
      '上壓': '血壓收縮壓',
      '下壓': '血壓舒張壓',
      '脈搏': '脈搏',
      '血糖值': '血糖值',
      '呼吸': '呼吸頻率',
      '血含氧量': '血含氧量',
      '體溫': '體溫'
    };
    return record?.[fieldMap[vitalSignType]];
  };

  if (loading) {
    return (
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg p-8 flex items-center space-x-3">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600"></div>
          <span className="text-gray-700">載入檢測數據中...</span>
        </div>
      </div>
    );
  }

  if (hasNoRulesAndHandled) {
    return null;
  }

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
        <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
          <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-3">
                <div className="p-2 rounded-lg bg-orange-100">
                  <AlertTriangle className="h-6 w-6 text-orange-600" />
                </div>
                <div>
                  <div className="flex items-center space-x-3">
                    <h2 className="text-xl font-semibold text-gray-900">派藥前檢測</h2>
                    {batchProgress && (
                      <span className="px-3 py-1 bg-blue-100 text-blue-700 text-sm font-medium rounded-full">
                        第 {batchProgress.current} / {batchProgress.total} 筆
                      </span>
                    )}
                  </div>
                  <p className="text-sm text-gray-600">
                    {patient?.中文姓氏}{patient?.中文名字} - {prescription?.medication_name}
                    {workflowRecord?.scheduled_time && (
                      <span className="ml-2 text-blue-600 font-medium">
                        ({workflowRecord.scheduled_time.substring(0, 5)})
                      </span>
                    )}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
                disabled={isChecking || isSubmitting}
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          <div className="p-6 space-y-6">
            <div className="bg-orange-50 border border-orange-200 rounded-lg p-4">
              <h3 className="text-lg font-medium text-orange-900 mb-3">此處方的檢測規則</h3>
              <div className="space-y-2">
                {prescription.inspection_rules.map((rule: any, index: number) => (
                  <div key={index} className="flex items-center space-x-2 text-sm">
                    {getVitalSignIcon(rule.vital_sign_type)}
                    <span className="font-medium">{rule.vital_sign_type}</span>
                    <span>
                      {rule.condition_operator === 'gt' ? '>' :
                       rule.condition_operator === 'lt' ? '<' :
                       rule.condition_operator === 'gte' ? '≥' :
                       rule.condition_operator === 'lte' ? '≤' : ''}
                    </span>
                    <span className="font-medium">{rule.condition_value}</span>
                    <span className="text-orange-700">
                      → {rule.action_if_met === 'block_dispensing' ? '阻止派藥' : '僅警告'}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            <div className="space-y-4">
              <h3 className="text-lg font-medium text-gray-900">
                監測記錄狀態 ({workflowRecord.scheduled_date} {workflowRecord.scheduled_time?.substring(0, 5)})
              </h3>

              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {prescription.inspection_rules.map((rule: any, index: number) => {
                  const matchedData = matchedRecords[rule.vital_sign_type];
                  const isMatched = matchedData?.isMatched || false;
                  const record = matchedData?.record;
                  const value = record ? getVitalSignValue(record, rule.vital_sign_type) : null;

                  return (
                    <div key={index} className={`border rounded-lg p-4 ${
                      isMatched ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
                    }`}>
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center space-x-2">
                          {getVitalSignIcon(rule.vital_sign_type)}
                          <h4 className="font-medium text-gray-900">{rule.vital_sign_type}</h4>
                        </div>
                        {isMatched ? (
                          <CheckCircle className="h-5 w-5 text-green-600" />
                        ) : (
                          <XCircle className="h-5 w-5 text-red-600" />
                        )}
                      </div>

                      {isMatched && record ? (
                        <div>
                          <div className="flex items-center space-x-2 text-sm text-green-700 mb-2">
                            <CheckCircle className="h-4 w-4" />
                            <span className="font-medium">已有監測記錄</span>
                          </div>
                          <div className="text-sm">
                            <div className="font-medium text-gray-900">
                              數值: {value}
                            </div>
                            <div className="text-gray-600">
                              {new Date(record.記錄日期).toLocaleDateString('zh-TW')} {record.記錄時間}
                            </div>
                          </div>
                        </div>
                      ) : (
                        <div>
                          <div className="flex items-center space-x-2 text-sm text-red-700 mb-3">
                            <XCircle className="h-4 w-4" />
                            <span className="font-medium">無監測記錄（需新增）</span>
                          </div>
                          <button
                            onClick={() => handleAddRecord(rule.vital_sign_type)}
                            className="w-full btn-primary flex items-center justify-center space-x-2"
                          >
                            <Plus className="h-4 w-4" />
                            <span>新增記錄</span>
                          </button>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>

            {checkResult && (
              <div className={`border rounded-lg p-4 ${
                checkResult.canDispense ? 'border-green-200 bg-green-50' : 'border-red-200 bg-red-50'
              }`}>
                <div className="flex items-center space-x-2 mb-3">
                  {checkResult.canDispense ? (
                    <CheckCircle className="h-5 w-5 text-green-600" />
                  ) : (
                    <AlertTriangle className="h-5 w-5 text-red-600" />
                  )}
                  <h3 className={`font-medium ${
                    checkResult.canDispense ? 'text-green-900' : 'text-red-900'
                  }`}>
                    檢測結果
                  </h3>
                </div>

                <div className={`text-sm ${
                  checkResult.canDispense ? 'text-green-800' : 'text-red-800'
                }`}>
                  {checkResult.canDispense ? (
                    <p>所有檢測項目均符合安全條件，可以派藥</p>
                  ) : (
                    <div>
                      <p>以下檢測項目不符合安全條件：</p>
                      <ul className="list-disc list-inside mt-2 space-y-1">
                        {checkResult.blockedRules?.map((rule: any, index: number) => (
                          <li key={index}>
                            {rule.vital_sign_type}: {rule.actual_value} {
                              rule.condition_operator === 'gt' ? '≤' :
                              rule.condition_operator === 'lt' ? '≥' :
                              rule.condition_operator === 'gte' ? '<' :
                              rule.condition_operator === 'lte' ? '>' : ''
                            } {rule.condition_value} (不符合 {
                              rule.condition_operator === 'gt' ? '>' :
                              rule.condition_operator === 'lt' ? '<' :
                              rule.condition_operator === 'gte' ? '≥' :
                              rule.condition_operator === 'lte' ? '≤' : ''
                            } {rule.condition_value} 的要求)
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}
                </div>

                {checkResult.usedVitalSignData && Object.keys(checkResult.usedVitalSignData).length > 0 && (
                  <div className="mt-3 pt-3 border-t border-gray-200">
                    <p className="text-xs text-gray-600">
                      使用的監測數據: {Object.entries(checkResult.usedVitalSignData).map(([type, value]) =>
                        `${type}: ${value}`
                      ).join(', ')}
                    </p>
                  </div>
                )}
              </div>
            )}

            <div className="flex space-x-3 pt-4 border-t border-gray-200">
              {!checkResult ? (
                <button
                  onClick={performInspectionCheck}
                  disabled={isChecking || isSubmitting || missingVitalSigns.length > 0}
                  className="btn-primary flex-1 flex items-center justify-center space-x-2"
                  title={missingVitalSigns.length > 0 ? '請先新增所有監測記錄' : ''}
                >
                  {isChecking || isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>{isChecking ? '檢測中...' : '處理中...'}</span>
                    </>
                  ) : (
                    <>
                      <AlertTriangle className="h-4 w-4" />
                      <span>{missingVitalSigns.length > 0 ? '請先新增所有監測記錄' : '執行檢測'}</span>
                    </>
                  )}
                </button>
              ) : (
                <button
                  onClick={handleConfirmDispense}
                  disabled={isSubmitting}
                  className={`flex-1 flex items-center justify-center space-x-2 ${
                    checkResult.canDispense ? 'btn-primary' : 'btn-danger'
                  }`}
                >
                  {isSubmitting ? (
                    <>
                      <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                      <span>處理中...</span>
                    </>
                  ) : checkResult.canDispense ? (
                    <>
                      <CheckCircle className="h-4 w-4" />
                      <span>確認派藥</span>
                    </>
                  ) : (
                    <>
                      <XCircle className="h-4 w-4" />
                      <span>無法派藥</span>
                    </>
                  )}
                </button>
              )}

              <button
                onClick={onClose}
                className="btn-secondary flex-1"
                disabled={isChecking || isSubmitting}
              >
                取消
              </button>
            </div>
          </div>
        </div>
      </div>

      {showHealthRecordModal && currentAddingVitalSign && (
        <HealthRecordModal
          initialData={{
            patient: patient ? {
              院友id: patient.院友id,
              中文姓名: `${patient.中文姓氏}${patient.中文名字}`,
              床號: patient.床號
            } : undefined,
            預設記錄類型: getRecordType(currentAddingVitalSign),
            預設日期: `${workflowRecord.scheduled_date}T${workflowRecord.scheduled_time || '00:00:00'}`
          }}
          onClose={() => {
            setShowHealthRecordModal(false);
            setCurrentAddingVitalSign(null);
          }}
          onTaskCompleted={handleHealthRecordSaved}
        />
      )}
    </>
  );
};

export default InspectionCheckModal;
