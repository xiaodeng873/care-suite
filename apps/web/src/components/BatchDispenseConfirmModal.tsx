import React, { useState, useMemo } from 'react';
import { isPrescriptionValidAt } from '../utils/prescriptionExpiry';
import { X, Clock, CheckCircle, Pill, AlertTriangle, ChevronDown, ChevronUp, ChevronLeft, ChevronRight, Activity } from 'lucide-react';
import InspectionCheckModal from './InspectionCheckModal';
import InjectionWorkflowModal, { InjectionWorkflowPayload } from './InjectionWorkflowModal';
import PatientInfoCard from './PatientInfoCard';

// 判斷注射途徑
const isInjectionRoute = (route?: string | null): boolean => /注射/.test(String(route ?? ''));

// 派藥分類：口服 / 外用 / 注射（注射涵蓋皮下/肌肉；其餘非口服歸外用）
type RouteCategory = '口服' | '外用' | '注射';
const ROUTE_CATEGORIES: RouteCategory[] = ['口服', '外用', '注射'];
const getRouteCategory = (route?: string | null): RouteCategory => {
  const r = String(route ?? '');
  if (/注射/.test(r)) return '注射';
  if (r === '口服') return '口服';
  return '外用';
};

interface TimeSlotSummary {
  time: string;
  records: any[];
  uniquePrescriptions: Set<string>;
  medicationSummary: {
    [unit: string]: number;
  };
  hasInspectionRequired: boolean;
}

interface BatchDispenseConfirmModalProps {
  workflowRecords: any[];
  prescriptions: any[];
  patients: any[];
  selectedPatientId: string;
  selectedDate: string;
  onConfirm: (selectedTimeSlots: string[], recordsToProcess: any[], inspectionResults?: Map<string, any>, injectionResults?: Map<string, InjectionWorkflowPayload>) => Promise<void>;
  onClose: () => void;
  onNavigatePatient?: (direction: 'prev' | 'next') => void;
}

const BatchDispenseConfirmModal: React.FC<BatchDispenseConfirmModalProps> = ({
  workflowRecords,
  prescriptions,
  patients,
  selectedPatientId,
  selectedDate,
  onConfirm,
  onClose,
  onNavigatePatient,
}) => {
  // 每個分類各自獨立的已選時間點
  const [selectedByTab, setSelectedByTab] = useState<Record<RouteCategory, Set<string>>>({
    口服: new Set(),
    外用: new Set(),
    注射: new Set(),
  });
  const [isProcessing, setIsProcessing] = useState(false);
  const [showInspectionModal, setShowInspectionModal] = useState(false);
  const [currentInspectionRecords, setCurrentInspectionRecords] = useState<any[]>([]);
  const [currentInspectionIndex, setCurrentInspectionIndex] = useState(0);
  const [inspectionResults, setInspectionResults] = useState<Map<string, any>>(new Map());
  const [recordsToProcess, setRecordsToProcess] = useState<any[]>([]);
  const [expandedTimeSlots, setExpandedTimeSlots] = useState<Set<string>>(new Set());

  // 目前分類 Tab（口服 / 外用 / 注射）
  const [activeTab, setActiveTab] = useState<RouteCategory>('口服');

  // 當前分類的已選時間點
  const selectedTimeSlots = selectedByTab[activeTab];
  const setCurrentSelected = (next: Set<string>) => {
    setSelectedByTab(prev => ({ ...prev, [activeTab]: next }));
  };

  // 切換院友時清空所有分類已選（每位院友重新選）
  React.useEffect(() => {
    setSelectedByTab({ 口服: new Set(), 外用: new Set(), 注射: new Set() });
  }, [selectedPatientId]);

  // 注射逐筆序列狀態
  const [showInjectionModal, setShowInjectionModal] = useState(false);
  const [currentInjectionRecords, setCurrentInjectionRecords] = useState<any[]>([]);
  const [currentInjectionIndex, setCurrentInjectionIndex] = useState(0);
  const [injectionResults, setInjectionResults] = useState<Map<string, InjectionWorkflowPayload>>(new Map());
  const [pendingInspectionResults, setPendingInspectionResults] = useState<Map<string, any>>(new Map());

  const currentPatient = useMemo(() => {
    return patients.find(p => p.院友id === parseInt(selectedPatientId));
  }, [patients, selectedPatientId]);

  // 過濾只包含處方在排程時點仍有效的記錄
  const activeWorkflowRecords = useMemo(() => {
    return workflowRecords.filter(record => {
      const prescription = prescriptions.find(p => p.id === record.prescription_id);
      if (!prescription) return false;
      if (prescription.status !== 'active' && prescription.status !== 'inactive') return false;
      return isPrescriptionValidAt(prescription, record.scheduled_date, record.scheduled_time);
    });
  }, [workflowRecords, prescriptions]);

  // 格式化時間為 HH:MM
  const formatTime = (time: string) => {
    if (!time) return '';
    const parts = time.split(':');
    if (parts.length >= 2) {
      return `${parts[0]}:${parts[1]}`;
    }
    return time;
  };

  // 取得記錄所屬的分類
  const getRecordCategory = (record: any): RouteCategory => {
    const prescription = prescriptions.find(p => p.id === record.prescription_id);
    return getRouteCategory(prescription?.administration_route);
  };

  // 各分類的派藥記錄筆數（用於 Tab 標籤）
  const categoryCounts = useMemo(() => {
    const counts: Record<RouteCategory, number> = { 口服: 0, 外用: 0, 注射: 0 };
    activeWorkflowRecords.forEach(record => {
      counts[getRecordCategory(record)]++;
    });
    return counts;
  }, [activeWorkflowRecords, prescriptions]);

  // 當前 Tab 的派藥記錄
  const tabWorkflowRecords = useMemo(() => {
    return activeWorkflowRecords.filter(record => getRecordCategory(record) === activeTab);
  }, [activeWorkflowRecords, prescriptions, activeTab]);

  // 預設停在第一個有記錄的分類（口服 → 外用 → 注射）
  React.useEffect(() => {
    if (categoryCounts[activeTab] === 0) {
      const firstNonEmpty = ROUTE_CATEGORIES.find(c => categoryCounts[c] > 0);
      if (firstNonEmpty) setActiveTab(firstNonEmpty);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [categoryCounts]);

  // 依一組記錄建立各時段摘要
  const buildSummaries = (records: any[]) => {
    const summaryMap = new Map<string, TimeSlotSummary>();

    records.forEach(record => {
      const time = record.scheduled_time;
      const prescription = prescriptions.find(p => p.id === record.prescription_id);

      if (!prescription) return;

      if (!summaryMap.has(time)) {
        summaryMap.set(time, {
          time,
          records: [],
          uniquePrescriptions: new Set(),
          medicationSummary: {},
          hasInspectionRequired: false,
        });
      }

      const summary = summaryMap.get(time)!;
      summary.records.push(record);
      summary.uniquePrescriptions.add(record.prescription_id);

      // 檢查是否有檢測項要求
      if (prescription.inspection_rules && prescription.inspection_rules.length > 0) {
        summary.hasInspectionRequired = true;
      }

      const unit = prescription.dosage_unit || '單位';
      const amount = parseFloat(prescription.dosage_amount) || 1;

      if (!summary.medicationSummary[unit]) {
        summary.medicationSummary[unit] = 0;
      }
      summary.medicationSummary[unit] += amount;
    });

    return Array.from(summaryMap.values())
      .sort((a, b) => a.time.localeCompare(b.time))
      .map(s => ({
        ...s,
        uniquePrescriptionCount: s.uniquePrescriptions.size
      }));
  };

  // 全部時段摘要（跨分類，用於全選 / 已選統計 / 派藥）
  const timeSlotSummaries = useMemo(() => {
    return buildSummaries(activeWorkflowRecords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeWorkflowRecords, prescriptions]);

  // 當前分類 Tab 的時段摘要（用於卡片顯示，數量/總量只算該分類）
  const visibleTimeSlotSummaries = useMemo(() => {
    return buildSummaries(tabWorkflowRecords);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [tabWorkflowRecords, prescriptions]);

  const handleTimeSlotToggle = (time: string) => {
    const newSelected = new Set(selectedTimeSlots);
    if (newSelected.has(time)) {
      newSelected.delete(time);
    } else {
      newSelected.add(time);
    }
    setCurrentSelected(newSelected);
  };

  const handleSelectAll = () => {
    // 只針對當前分類的時段全選 / 取消
    if (selectedTimeSlots.size === visibleTimeSlotSummaries.length) {
      setCurrentSelected(new Set());
    } else {
      setCurrentSelected(new Set(visibleTimeSlotSummaries.map(s => s.time)));
    }
  };

  const handleToggleExpand = (time: string, e: React.MouseEvent) => {
    e.stopPropagation();
    const newExpanded = new Set(expandedTimeSlots);
    if (newExpanded.has(time)) {
      newExpanded.delete(time);
    } else {
      newExpanded.add(time);
    }
    setExpandedTimeSlots(newExpanded);
  };

  const getPrescriptionDetails = (time: string) => {
    const records = tabWorkflowRecords.filter(r => r.scheduled_time === time);
    return records.map(record => {
      const prescription = prescriptions.find(p => p.id === record.prescription_id);
      if (!prescription) return null;

      // 組合劑量資訊：數量 + 單位
      const dosageParts = [];
      if (prescription.dosage_amount) {
        dosageParts.push(prescription.dosage_amount);
      }
      if (prescription.dosage_unit) {
        dosageParts.push(prescription.dosage_unit);
      }

      const dosageInfo = dosageParts.length > 0 ? dosageParts.join('') : '劑量資訊未提供';

      return {
        id: record.id,
        medicationName: prescription.medication_name,
        dosageInfo: dosageInfo
      };
    }).filter(Boolean);
  };

  const handleConfirm = async () => {
    if (selectedTimeSlots.size === 0) return;

    // 只處理「當前分類」在選定時間點的記錄
    const selectedRecords = tabWorkflowRecords.filter(r =>
      selectedTimeSlots.has(r.scheduled_time)
    );

    // 找出需要檢測的記錄（排除注射，注射另行以注射給藥程序處理）
    const recordsNeedingInspection = selectedRecords.filter(record => {
      const prescription = prescriptions.find(p => p.id === record.prescription_id);
      if (isInjectionRoute(prescription?.administration_route)) return false;
      return prescription?.inspection_rules && prescription.inspection_rules.length > 0;
    });


    // 保存要處理的所有記錄
    setRecordsToProcess(selectedRecords);
    setInspectionResults(new Map());
    setInjectionResults(new Map());

    if (recordsNeedingInspection.length > 0) {
      // 有檢測項要求，逐個打開檢測模態框

      setCurrentInspectionRecords(recordsNeedingInspection);
      setCurrentInspectionIndex(0);
      setShowInspectionModal(true);
    } else {
      // 沒有檢測項要求，進入注射序列或直接派藥
      startInjectionSequenceOrProceed(selectedRecords, new Map());
    }
  };

  // 檢測序列完成後：若有注射記錄則逐筆開注射給藥程序，否則直接派藥
  const startInjectionSequenceOrProceed = (
    records: any[],
    inspResults: Map<string, any>
  ) => {
    const injectionRecords = records.filter(record => {
      const prescription = prescriptions.find(p => p.id === record.prescription_id);
      return isInjectionRoute(prescription?.administration_route);
    });
    if (injectionRecords.length > 0) {
      setPendingInspectionResults(inspResults);
      setCurrentInjectionRecords(injectionRecords);
      setCurrentInjectionIndex(0);
      setInjectionResults(new Map());
      setShowInjectionModal(true);
    } else {
      proceedWithDispensing(inspResults, new Map());
    }
  };

  // 注射給藥程序完成（逐筆）
  const handleInjectionComplete = (payload: InjectionWorkflowPayload) => {
    const currentRecord = currentInjectionRecords[currentInjectionIndex];
    const newInj = new Map(injectionResults);
    newInj.set(currentRecord.id, payload);
    setInjectionResults(newInj);

    if (currentInjectionIndex < currentInjectionRecords.length - 1) {
      setCurrentInjectionIndex(currentInjectionIndex + 1);
    } else {
      setShowInjectionModal(false);
      setTimeout(() => {
        proceedWithDispensing(pendingInspectionResults, newInj);
      }, 150);
    }
  };

  const handleInspectionResult = (canDispense: boolean, failureReason?: string, inspectionCheckResult?: any) => {
    const currentRecord = currentInspectionRecords[currentInspectionIndex];
    const prescription = prescriptions.find(p => p.id === currentRecord.prescription_id);






    if (inspectionCheckResult?.usedVitalSignData) {

    }

    // 保存檢測結果
    const newResults = new Map(inspectionResults);
    newResults.set(currentRecord.id, {
      canDispense,
      failureReason,
      inspectionCheckResult
    });


    // 更新檢測結果狀態
    setInspectionResults(newResults);

    // 檢查是否還有更多記錄需要檢測
    if (currentInspectionIndex < currentInspectionRecords.length - 1) {
      // 繼續下一個檢測
      const nextIndex = currentInspectionIndex + 1;
      const nextRecord = currentInspectionRecords[nextIndex];
      const nextPrescription = prescriptions.find(p => p.id === nextRecord.prescription_id);


      setCurrentInspectionIndex(nextIndex);
    } else {
      // 所有檢測完成，關閉檢測模態框並執行派藥


      newResults.forEach((result, recordId) => {
        const record = currentInspectionRecords.find(r => r.id === recordId);

      });
      setShowInspectionModal(false);
      // 使用 setTimeout 確保狀態更新和模態框關閉後再執行
      setTimeout(() => {
        startInjectionSequenceOrProceed(recordsToProcess, newResults);
      }, 150);
    }
  };

  const proceedWithDispensing = async (
    finalResults: Map<string, any>,
    finalInjectionResults: Map<string, InjectionWorkflowPayload>
  ) => {
    setIsProcessing(true);
    try {
      await onConfirm(Array.from(selectedTimeSlots), recordsToProcess, finalResults, finalInjectionResults);
      // 派完當前分類：清掉該分類已選、保持 modal 開啟；已派記錄會自動從清單移除
      setCurrentSelected(new Set());
    } catch (error) {
      console.error('批量派藥失敗:', error);
    } finally {
      setIsProcessing(false);
    }
  };

  const selectedRecordsCount = useMemo(() => {
    return visibleTimeSlotSummaries
      .filter(s => selectedTimeSlots.has(s.time))
      .reduce((sum, s) => sum + s.records.length, 0);
  }, [visibleTimeSlotSummaries, selectedTimeSlots]);

  // 格式化藥物總量顯示
  const formatMedicationSummary = (medicationSummary: { [unit: string]: number }) => {
    const parts = Object.entries(medicationSummary).map(([unit, amount]) => `${amount}${unit}`);
    return parts.join('、');
  };

  return (
    <>
      <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
        <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
          {/* 標題欄 */}
          <div className="px-6 py-4 border-b border-gray-200">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <div className="flex flex-wrap items-center gap-3">
                <div className="p-2 rounded-lg bg-blue-100">
                  <Pill className="h-6 w-6 text-blue-600" />
                </div>
                <div>
                  <h2 className="text-xl font-semibold text-gray-900">一鍵派藥確認</h2>
                  <p className="text-sm text-gray-600">
                    選擇要派藥的時間點 - {selectedDate}
                  </p>
                </div>
              </div>
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600 transition-colors"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>

          {/* 院友資訊區 - 左右跳頁箭頭 + 可摺疊的 PatientInfoCard */}
          <div className="px-4 py-2 bg-gray-50 border-b border-gray-200">
            <div className="flex items-center gap-2">
              {onNavigatePatient && (
                <button
                  onClick={() => onNavigatePatient('prev')}
                  className="flex-shrink-0 p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="上一位院友（依床號）"
                >
                  <ChevronLeft className="h-5 w-5" />
                </button>
              )}
              <div className="flex-1 min-w-0">
                <PatientInfoCard
                  patient={currentPatient}
                  defaultExpanded={false}
                />
              </div>
              {onNavigatePatient && (
                <button
                  onClick={() => onNavigatePatient('next')}
                  className="flex-shrink-0 p-2 rounded-lg text-gray-500 hover:text-blue-600 hover:bg-blue-50 transition-colors"
                  title="下一位院友（依床號）"
                >
                  <ChevronRight className="h-5 w-5" />
                </button>
              )}
            </div>
          </div>

          {/* 時間點列表 */}
          <div className="flex-1 overflow-y-auto p-6">
            {timeSlotSummaries.length === 0 ? (
              <div className="text-center py-12">
                <Pill className="h-16 w-16 text-gray-300 mx-auto mb-4" />
                <p className="text-gray-500">沒有可派藥的記錄</p>
              </div>
            ) : (
              <div className="space-y-4">
                {/* 分類 Tab（左） + 全選/已選（右）：桌面同一行，直向手機分兩行 */}
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-blue-50 border border-blue-200 rounded-lg px-4 py-3">
                  {/* 分類 Tab */}
                  <div className="flex gap-1 bg-white/70 rounded-lg p-1 self-start sm:self-auto">
                    {ROUTE_CATEGORIES.map(cat => (
                      <button
                        key={cat}
                        onClick={() => setActiveTab(cat)}
                        className={`px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${
                          activeTab === cat
                            ? 'bg-blue-600 text-white shadow-sm'
                            : 'text-gray-600 hover:text-gray-800 hover:bg-gray-100'
                        }`}
                      >
                        {cat} ({categoryCounts[cat]})
                      </button>
                    ))}
                  </div>
                  {/* 全選時間點 + 已選時間點 */}
                  <div className="flex flex-col sm:flex-row sm:items-center gap-1 sm:gap-4">
                    <button
                      onClick={handleSelectAll}
                      className="text-sm text-blue-700 hover:text-blue-800 font-medium text-left"
                    >
                      {selectedTimeSlots.size === visibleTimeSlotSummaries.length && visibleTimeSlotSummaries.length > 0 ? '取消全選時間點' : '全選時間點'}
                    </button>
                    {selectedTimeSlots.size > 0 && (
                      <div className="text-sm font-medium text-gray-700">
                        已選擇 <span className="text-blue-700 font-bold">{selectedTimeSlots.size}</span> 個時間點，
                        共 <span className="text-blue-700 font-bold">{selectedRecordsCount}</span> 筆派藥記錄
                      </div>
                    )}
                  </div>
                </div>

                {visibleTimeSlotSummaries.length === 0 ? (
                  <div className="text-center py-12">
                    <Pill className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                    <p className="text-gray-500">此分類暫無派藥記錄</p>
                  </div>
                ) : (
                <div className="space-y-3">
                  {visibleTimeSlotSummaries.map((summary) => {
                    const isSelected = selectedTimeSlots.has(summary.time);
                    return (
                      <button
                        key={summary.time}
                        onClick={() => handleTimeSlotToggle(summary.time)}
                        className={`
                          w-full text-left border-2 rounded-lg p-4 transition-all
                          ${isSelected
                            ? 'border-blue-500 bg-blue-50 shadow-md'
                            : 'border-gray-200 bg-white hover:border-blue-300 hover:shadow-sm'
                          }
                        `}
                      >
                        <div className="flex items-start justify-between">
                          <div className="flex flex-wrap items-center gap-3 flex-1">
                            <Clock className={`h-6 w-6 flex-shrink-0 ${isSelected ? 'text-blue-600' : 'text-gray-400'}`} />
                            <div className="flex-1">
                              <div className={`text-2xl font-bold mb-2 ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                                {formatTime(summary.time)}
                              </div>

                              <div className="space-y-1 text-sm">
                                <div
                                  className="flex items-center cursor-pointer hover:bg-gray-50 rounded px-2 py-1 -mx-2"
                                  onClick={(e) => handleToggleExpand(summary.time, e)}
                                >
                                  <span className="text-gray-600">處方數量: </span>
                                  <span className={`font-bold text-lg ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                                    {summary.uniquePrescriptionCount}
                                  </span>
                                  <span className="text-gray-600 ml-1">筆</span>
                                  {expandedTimeSlots.has(summary.time) ? (
                                    <ChevronUp className="h-4 w-4 ml-2 text-gray-500" />
                                  ) : (
                                    <ChevronDown className="h-4 w-4 ml-2 text-gray-500" />
                                  )}
                                </div>

                                {expandedTimeSlots.has(summary.time) && (
                                  <div className="ml-4 mt-2 p-3 bg-gray-50 rounded-lg border border-gray-200 space-y-2">
                                    <div className="text-xs font-medium text-gray-700 mb-2">處方細節：</div>
                                    {getPrescriptionDetails(summary.time).map((detail: any) => (
                                      <div key={detail.id} className="text-xs text-gray-700 flex flex-wrap items-center gap-2">
                                        <Pill className="h-3 w-3 flex-shrink-0 text-gray-500" />
                                        <span className="font-medium">{detail.medicationName}</span>
                                        <span className="text-gray-600">{detail.dosageInfo}</span>
                                      </div>
                                    ))}
                                  </div>
                                )}

                                <div>
                                  <span className="text-gray-600">藥物總量: </span>
                                  <span className={`font-bold text-lg ${isSelected ? 'text-blue-700' : 'text-gray-900'}`}>
                                    {formatMedicationSummary(summary.medicationSummary)}
                                  </span>
                                </div>
                              </div>

                              {summary.hasInspectionRequired && (
                                <div className="mt-2 flex flex-wrap items-center gap-2 text-orange-700">
                                  <Activity className="h-4 w-4" />
                                  <span className="text-sm font-medium">含檢測項要求</span>
                                </div>
                              )}
                            </div>
                          </div>

                          {isSelected && (
                            <CheckCircle className="h-6 w-6 text-blue-600 flex-shrink-0 ml-3" />
                          )}
                        </div>
                      </button>
                    );
                  })}
                </div>
                )}
              </div>
            )}
          </div>

          {/* 底部按鈕 */}
          <div className="px-6 py-4 border-t border-gray-200 bg-gray-50 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary px-6"
              disabled={isProcessing}
            >
              取消
            </button>
            <button
              onClick={handleConfirm}
              disabled={selectedTimeSlots.size === 0 || isProcessing}
              className="btn-primary flex flex-wrap items-center gap-2 px-6"
            >
              {isProcessing ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>派藥中...</span>
                </>
              ) : (
                <>
                  <CheckCircle className="h-5 w-5" />
                  <span>確認派藥‧{activeTab} ({selectedTimeSlots.size} 個時間點)</span>
                </>
              )}
            </button>
          </div>
        </div>
      </div>

      {/* 檢測模態框 */}
      {showInspectionModal && currentInspectionRecords[currentInspectionIndex] && (
        <InspectionCheckModal
          workflowRecord={currentInspectionRecords[currentInspectionIndex]}
          onClose={() => {
            setShowInspectionModal(false);
            setCurrentInspectionRecords([]);
            setCurrentInspectionIndex(0);
          }}
          onResult={handleInspectionResult}
          isBatchMode={true}
          batchProgress={{
            current: currentInspectionIndex + 1,
            total: currentInspectionRecords.length
          }}
        />
      )}

      {/* 注射給藥程序模態框（逐筆） */}
      {showInjectionModal && currentInjectionRecords[currentInjectionIndex] && (
        <InjectionWorkflowModal
          isOpen={showInjectionModal}
          workflowRecord={currentInjectionRecords[currentInjectionIndex]}
          onClose={() => {
            // 取消注射序列＝取消整批（尚未派藥）
            setShowInjectionModal(false);
            setCurrentInjectionRecords([]);
            setCurrentInjectionIndex(0);
            setInjectionResults(new Map());
          }}
          onComplete={handleInjectionComplete}
        />
      )}
    </>
  );
};

export default BatchDispenseConfirmModal;
