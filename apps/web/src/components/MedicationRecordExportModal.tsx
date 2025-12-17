import React, { useState, useMemo, useEffect } from 'react';
import { X, FileDown, Calendar, Users, CheckSquare, Square, AlertCircle, Pill, Syringe, Package } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { getTemplatesMetadata } from '../lib/database';
import { exportMedicationRecordToExcel, exportSelectedMedicationRecordToExcel, categorizePrescriptionsByRoute } from '../utils/medicationRecordExcelGenerator';
import { exportPersonalMedicationListToExcel, exportSelectedPersonalMedicationListToExcel } from '../utils/personalMedicationListExcelGenerator';
import { supabase } from '../lib/supabase';

interface MedicationRecordExportModalProps {
  onClose: () => void;
  currentPatient?: any;
  selectedPrescriptionIds?: Set<string>;
  allPrescriptions?: any[];
}

interface RouteStats {
  oral: number;
  injection: number;
  topical: number;
  noRoute: number;
}

const MedicationRecordExportModal: React.FC<MedicationRecordExportModalProps> = ({
  onClose,
  currentPatient,
  selectedPrescriptionIds = new Set(),
  allPrescriptions = []
}) => {
  const { patients, prescriptions } = usePatients();

  const [exportMode, setExportMode] = useState<'batch' | 'current'>(currentPatient ? 'current' : 'batch');
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<string>>(new Set());
  const [currentPatientSelectedPrescriptions, setCurrentPatientSelectedPrescriptions] = useState<Set<string>>(selectedPrescriptionIds);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  });
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeWorkflowRecords, setIncludeWorkflowRecords] = useState(false);
  const [includePersonalMedicationList, setIncludePersonalMedicationList] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const [prescriptionsWithWorkflowRecords, setPrescriptionsWithWorkflowRecords] = useState<Set<string>>(new Set());

  const activePatients = useMemo(() => {
    return patients.filter(p => p.在住狀態 === '在住')
      .sort((a, b) => a.床號.localeCompare(b.床號, 'zh-Hant', { numeric: true }));
  }, [patients]);

  const filteredPatients = useMemo(() => {
    if (!searchTerm) return activePatients;

    const term = searchTerm.toLowerCase();
    return activePatients.filter(p => {
      const name = (p.中文姓氏 + p.中文名字).toLowerCase();
      const bed = p.床號.toLowerCase();
      return name.includes(term) || bed.includes(term);
    });
  }, [activePatients, searchTerm]);

  // 查詢在選定月份有工作流程記錄的處方
  useEffect(() => {
    const fetchPrescriptionsWithRecords = async () => {
      if (!includeWorkflowRecords) {
        setPrescriptionsWithWorkflowRecords(new Set());
        return;
      }

      const [year, month] = selectedMonth.split('-').map(Number);
      const monthStart = new Date(year, month - 1, 1).toISOString().split('T')[0];
      const monthEnd = new Date(year, month, 0).toISOString().split('T')[0];

      const { data, error } = await supabase
        .from('medication_workflow_records')
        .select('prescription_id')
        .gte('scheduled_date', monthStart)
        .lte('scheduled_date', monthEnd);

      if (error) {
        console.error('查詢工作流程記錄失敗:', error);
        return;
      }

      const prescriptionIds = new Set(data?.map(r => r.prescription_id) || []);
      setPrescriptionsWithWorkflowRecords(prescriptionIds);
    };

    fetchPrescriptionsWithRecords();
  }, [selectedMonth, includeWorkflowRecords]);

  const isInDateRange = (prescriptionDate: string, endDate: string | null, targetMonth: string): boolean => {
    const [year, month] = targetMonth.split('-').map(Number);
    const monthStart = new Date(year, month - 1, 1);
    const monthEnd = new Date(year, month, 0);

    const prescDate = new Date(prescriptionDate);

    if (prescDate > monthEnd) {
      return false;
    }

    if (endDate) {
      const prescEndDate = new Date(endDate);
      if (prescEndDate < monthStart) {
        return false;
      }
      return prescDate <= monthEnd && prescEndDate >= monthStart;
    } else {
      return prescDate <= monthEnd;
    }
  };

  const currentPatientAvailablePrescriptions = useMemo(() => {
    if (exportMode !== 'current' || !currentPatient) return [];

    return allPrescriptions.filter(p => {
      if (p.patient_id !== currentPatient.patient.院友id) return false;
      if (p.status === 'pending_change') return false;
      if (p.status === 'inactive') {
        if (includeInactive) return true;
        if (includeWorkflowRecords && prescriptionsWithWorkflowRecords.has(p.id)) return true;
        return false;
      }
      return true;
    });
  }, [exportMode, currentPatient, allPrescriptions, includeInactive, includeWorkflowRecords, prescriptionsWithWorkflowRecords]);

  const batchRouteStats = useMemo(() => {
    const stats: RouteStats = { oral: 0, injection: 0, topical: 0, noRoute: 0 };

    selectedPatientIds.forEach(patientId => {
      const patientPrescriptions = prescriptions.filter(p => p.patient_id === patientId);

      patientPrescriptions.forEach(prescription => {
        if (prescription.status === 'pending_change') return;
        if (prescription.status === 'inactive') {
          if (!includeInactive && !(includeWorkflowRecords && prescriptionsWithWorkflowRecords.has(prescription.id))) {
            return;
          }
        }
        if (!prescription.prescription_date) return;
        if (!isInDateRange(prescription.prescription_date, prescription.end_date || null, selectedMonth)) return;

        const route = prescription.administration_route?.trim();

        if (!route) {
          stats.noRoute++;
        } else if (route === '口服') {
          stats.oral++;
        } else if (route === '注射') {
          stats.injection++;
        } else {
          stats.topical++;
        }
      });
    });

    return stats;
  }, [selectedPatientIds, prescriptions, includeInactive, selectedMonth]);

  const currentPatientPrescriptionsToExport = useMemo(() => {
    if (exportMode !== 'current' || !currentPatient) return [];

    const isExportAll = currentPatientSelectedPrescriptions.size === 0;

    if (isExportAll) {
      return currentPatientAvailablePrescriptions;
    } else {
      return allPrescriptions.filter(p =>
        currentPatientSelectedPrescriptions.has(p.id) &&
        p.patient_id === currentPatient.patient.院友id
      );
    }
  }, [exportMode, currentPatient, currentPatientSelectedPrescriptions, allPrescriptions, currentPatientAvailablePrescriptions]);

  const currentRouteStats = useMemo((): RouteStats => {
    if (exportMode !== 'current') return { oral: 0, injection: 0, topical: 0, noRoute: 0 };

    const categorized = categorizePrescriptionsByRoute(currentPatientPrescriptionsToExport);
    return {
      oral: categorized.oral.length,
      injection: categorized.injection.length,
      topical: categorized.topical.length,
      noRoute: categorized.noRoute.length
    };
  }, [exportMode, currentPatientPrescriptionsToExport]);

  const handleTogglePatient = (patientId: string) => {
    const newSet = new Set(selectedPatientIds);
    if (newSet.has(patientId)) {
      newSet.delete(patientId);
    } else {
      newSet.add(patientId);
    }
    setSelectedPatientIds(newSet);
  };

  const handleToggleCurrentPatientPrescription = (prescriptionId: string) => {
    const newSet = new Set(currentPatientSelectedPrescriptions);
    if (newSet.has(prescriptionId)) {
      newSet.delete(prescriptionId);
    } else {
      newSet.add(prescriptionId);
    }
    setCurrentPatientSelectedPrescriptions(newSet);
  };

  const handleSelectAll = () => {
    if (selectedPatientIds.size === filteredPatients.length) {
      setSelectedPatientIds(new Set());
    } else {
      setSelectedPatientIds(new Set(filteredPatients.map(p => p.院友id)));
    }
  };

  const handleSelectAllCurrentPatientPrescriptions = () => {
    if (currentPatientSelectedPrescriptions.size === currentPatientAvailablePrescriptions.length) {
      setCurrentPatientSelectedPrescriptions(new Set());
    } else {
      setCurrentPatientSelectedPrescriptions(new Set(currentPatientAvailablePrescriptions.map(p => p.id)));
    }
  };

  const handleExport = async () => {
    if (exportMode === 'batch' && selectedPatientIds.size === 0) {
      alert('請選擇至少一位院友');
      return;
    }

    if (exportMode === 'current' && currentPatientPrescriptionsToExport.length === 0 && !includePersonalMedicationList) {
      alert('沒有可匯出的處方');
      return;
    }

    setIsExporting(true);

    try {
      const templates = await getTemplatesMetadata();
      const medicationTemplate = templates.find(t => t.type === 'medication-record');
      const personalMedicationTemplate = templates.find(t => t.type === 'personal-medication-list');

      const shouldExportMedicationRecord = !includePersonalMedicationList || includeInactive || includeWorkflowRecords;
      const shouldExportPersonalMedicationList = includePersonalMedicationList;

      if (shouldExportMedicationRecord && !medicationTemplate) {
        alert('找不到個人備藥及給藥記錄範本，請先在範本管理上傳範本');
        setIsExporting(false);
        return;
      }

      if (shouldExportPersonalMedicationList && !personalMedicationTemplate) {
        alert('找不到個人藥物記錄範本，請先在範本管理上傳範本');
        setIsExporting(false);
        return;
      }

      let medicationRecordSuccess = false;
      let personalMedicationListSuccess = false;
      let medicationRecordMessage = '';
      let personalMedicationListMessage = '';

      if (exportMode === 'current' && currentPatient) {
        if (shouldExportMedicationRecord && medicationTemplate) {
          await exportSelectedMedicationRecordToExcel(
            Array.from(currentPatientSelectedPrescriptions),
            currentPatient.patient,
            allPrescriptions,
            medicationTemplate,
            selectedMonth,
            includeInactive,
            includeWorkflowRecords
          );

          medicationRecordSuccess = true;
          const totalPrescriptions = currentRouteStats.oral + currentRouteStats.injection + currentRouteStats.topical;
          medicationRecordMessage = `【個人備藥及給藥記錄】\n`;
          medicationRecordMessage += `共匯出 ${totalPrescriptions} 個處方\n\n`;
          medicationRecordMessage += `途徑分布：\n`;
          if (currentRouteStats.oral > 0) medicationRecordMessage += `  口服：${currentRouteStats.oral} 個\n`;
          if (currentRouteStats.injection > 0) medicationRecordMessage += `  注射：${currentRouteStats.injection} 個\n`;
          if (currentRouteStats.topical > 0) medicationRecordMessage += `  外用：${currentRouteStats.topical} 個\n`;

          if (currentRouteStats.noRoute > 0) {
            medicationRecordMessage += `\n⚠️ 注意：有 ${currentRouteStats.noRoute} 個處方因缺少途徑資訊而未被匯出`;
          }
        }

        if (shouldExportPersonalMedicationList && personalMedicationTemplate) {
          await exportSelectedPersonalMedicationListToExcel(
            Array.from(currentPatientSelectedPrescriptions),
            currentPatient.patient,
            allPrescriptions,
            personalMedicationTemplate,
            'start_date',
            includeInactive
          );

          personalMedicationListSuccess = true;
          const activePrescriptions = currentPatientPrescriptionsToExport.filter(p => p.status === 'active');
          personalMedicationListMessage = `【個人藥物記錄】\n`;
          personalMedicationListMessage += `共匯出 ${activePrescriptions.length} 個在服處方\n`;
          personalMedicationListMessage += `排序方式：按開始使用藥物日期`;
        }

        let successMessage = '匯出成功！\n\n';
        if (medicationRecordSuccess) successMessage += medicationRecordMessage + '\n\n';
        if (personalMedicationListSuccess) successMessage += personalMedicationListMessage;

        alert(successMessage);
      } else {
        const selectedPatients = activePatients
          .filter(p => selectedPatientIds.has(p.院友id))
          .map(patient => {
            const allPrescriptions = prescriptions.filter(p => p.patient_id === patient.院友id);

            const validPrescriptions = allPrescriptions.filter(prescription => {
              if (prescription.status === 'pending_change') {
                return false;
              }

              if (prescription.status === 'inactive') {
                if (!includeInactive && !(includeWorkflowRecords && prescriptionsWithWorkflowRecords.has(prescription.id))) {
                  return false;
                }
              }

              if (!prescription.prescription_date) {
                return false;
              }

              return isInDateRange(
                prescription.prescription_date,
                prescription.end_date || null,
                selectedMonth
              );
            });

            return {
              ...patient,
              prescriptions: validPrescriptions
            };
          })
          .filter(p => p.prescriptions.length > 0);

        if (selectedPatients.length === 0 && !shouldExportPersonalMedicationList) {
          alert('所選院友在指定月份沒有符合條件的處方記錄');
          setIsExporting(false);
          return;
        }

        if (shouldExportMedicationRecord && medicationTemplate && selectedPatients.length > 0) {
          await exportMedicationRecordToExcel(selectedPatients, medicationTemplate, selectedMonth, undefined, includeWorkflowRecords);

          medicationRecordSuccess = true;
          const totalPrescriptions = batchRouteStats.oral + batchRouteStats.injection + batchRouteStats.topical;
          medicationRecordMessage = `【個人備藥及給藥記錄】\n`;
          medicationRecordMessage += `共匯出 ${selectedPatients.length} 位院友的處方記錄\n`;
          medicationRecordMessage += `總處方數：${totalPrescriptions} 個\n\n`;
          medicationRecordMessage += `途徑分布：\n`;
          if (batchRouteStats.oral > 0) medicationRecordMessage += `  口服：${batchRouteStats.oral} 個\n`;
          if (batchRouteStats.injection > 0) medicationRecordMessage += `  注射：${batchRouteStats.injection} 個\n`;
          if (batchRouteStats.topical > 0) medicationRecordMessage += `  外用：${batchRouteStats.topical} 個\n`;

          if (batchRouteStats.noRoute > 0) {
            medicationRecordMessage += `\n⚠️ 注意：有 ${batchRouteStats.noRoute} 個處方因缺少途徑資訊而未被匯出`;
          }
        }

        if (shouldExportPersonalMedicationList && personalMedicationTemplate) {
          const patientsForPersonalList = activePatients
            .filter(p => selectedPatientIds.has(p.院友id))
            .map(patient => {
              const patientPrescriptions = prescriptions.filter(p =>
                p.patient_id === patient.院友id &&
                p.status === 'active'
              );

              return {
                ...patient,
                prescriptions: patientPrescriptions
              };
            })
            .filter(p => p.prescriptions.length > 0);

          if (patientsForPersonalList.length > 0) {
            await exportPersonalMedicationListToExcel(
              patientsForPersonalList,
              personalMedicationTemplate,
              'start_date'
            );

            personalMedicationListSuccess = true;
            const totalActivePrescriptions = patientsForPersonalList.reduce((sum, p) => sum + p.prescriptions.length, 0);
            personalMedicationListMessage = `【個人藥物記錄】\n`;
            personalMedicationListMessage += `共匯出 ${patientsForPersonalList.length} 位院友\n`;
            personalMedicationListMessage += `總在服處方數：${totalActivePrescriptions} 個\n`;
            personalMedicationListMessage += `排序方式：按開始使用藥物日期`;
          } else {
            alert('所選院友沒有在服處方，無法匯出個人藥物記錄');
            setIsExporting(false);
            return;
          }
        }

        let successMessage = '匯出成功！\n\n';
        if (medicationRecordSuccess) successMessage += medicationRecordMessage + '\n\n';
        if (personalMedicationListSuccess) successMessage += personalMedicationListMessage;

        alert(successMessage);
      }

      onClose();
    } catch (error: any) {
      console.error('匯出失敗:', error);
      alert('匯出失敗: ' + (error.message || '未知錯誤'));
    } finally {
      setIsExporting(false);
    }
  };

  const routeStats = exportMode === 'current' ? currentRouteStats : batchRouteStats;
  const isExportAll = exportMode === 'current' && currentPatientSelectedPrescriptions.size === 0;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-6 border-b border-gray-200">
          <div className="flex items-center space-x-3">
            <FileDown className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">匯出個人備藥及給藥記錄</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {currentPatient && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-3">選擇匯出模式</h4>
              <div className="space-y-2">
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="exportMode"
                    checked={exportMode === 'current'}
                    onChange={() => setExportMode('current')}
                    className="form-radio h-4 w-4 text-blue-600"
                  />
                  <div>
                    <span className="font-medium text-gray-900">匯出當前院友特定處方</span>
                    <p className="text-sm text-gray-600">
                      匯出 {currentPatient.patient.中文姓氏}{currentPatient.patient.中文名字} 的指定處方
                    </p>
                  </div>
                </label>
                <label className="flex items-center space-x-3 cursor-pointer">
                  <input
                    type="radio"
                    name="exportMode"
                    checked={exportMode === 'batch'}
                    onChange={() => setExportMode('batch')}
                    className="form-radio h-4 w-4 text-blue-600"
                  />
                  <div>
                    <span className="font-medium text-gray-900">批量匯出多位院友</span>
                    <p className="text-sm text-gray-600">選擇多位院友進行批量匯出</p>
                  </div>
                </label>
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label flex items-center space-x-2">
                <Calendar className="h-4 w-4" />
                <span>選擇月份</span>
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="form-input"
              />
            </div>

            <div className="flex flex-col space-y-2 pt-8">
              {(exportMode === 'batch' || isExportAll) && (
                <label className="flex items-center space-x-2 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={includeInactive}
                    onChange={(e) => setIncludeInactive(e.target.checked)}
                    className="form-checkbox h-5 w-5 text-blue-600 rounded"
                  />
                  <span className="text-sm text-gray-700">
                    {exportMode === 'batch' ? '匯出停用處方' : '包含停用處方'}
                  </span>
                </label>
              )}
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includeWorkflowRecords}
                  onChange={(e) => setIncludeWorkflowRecords(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">包含執核派記錄</span>
              </label>
              <label className="flex items-center space-x-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={includePersonalMedicationList}
                  onChange={(e) => setIncludePersonalMedicationList(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded"
                />
                <span className="text-sm text-gray-700">匯出個人藥物記錄</span>
              </label>
            </div>
          </div>

          {exportMode === 'current' && currentPatient && (
            <>
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">匯出範圍</h4>
                <div className="text-sm text-blue-800">
                  {isExportAll ? (
                    <div>
                      <p className="mb-1">將匯出該院友的所有在服處方（共 {currentPatientAvailablePrescriptions.length} 個）</p>
                      <ul className="list-disc list-inside space-y-1 ml-2">
                        <li>不包含待變更處方</li>
                        <li>停用處方 {includeInactive ? '包含' : '不包含'}</li>
                      </ul>
                      <p className="mt-2 text-blue-900 font-medium">💡 提示：勾選下方特定處方可進行選擇性匯出</p>
                    </div>
                  ) : (
                    <p>將只匯出您勾選的處方（共 {currentPatientSelectedPrescriptions.size} 個）</p>
                  )}
                </div>
              </div>

              <div>
                <div className="flex items-center justify-between mb-3">
                  <label className="form-label flex items-center space-x-2 mb-0">
                    <Package className="h-4 w-4" />
                    <span>選擇處方 ({currentPatientSelectedPrescriptions.size}/{currentPatientAvailablePrescriptions.length})</span>
                  </label>
                  <button
                    onClick={handleSelectAllCurrentPatientPrescriptions}
                    className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                  >
                    {currentPatientSelectedPrescriptions.size === currentPatientAvailablePrescriptions.length ? '取消全選' : '全選'}
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                  {currentPatientAvailablePrescriptions.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p>沒有可用的處方</p>
                    </div>
                  ) : (
                    <div className="divide-y divide-gray-200">
                      {currentPatientAvailablePrescriptions.map(prescription => {
                        const isSelected = currentPatientSelectedPrescriptions.has(prescription.id);
                        const route = prescription.administration_route;
                        const routeIcon = route === '口服' ? Pill : route === '注射' ? Syringe : Package;
                        const RouteIcon = routeIcon;
                        const routeColor = route === '口服' ? 'text-blue-600' : route === '注射' ? 'text-red-600' : 'text-green-600';

                        return (
                          <div
                            key={prescription.id}
                            onClick={() => handleToggleCurrentPatientPrescription(prescription.id)}
                            className={`p-4 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 ${
                              isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                            }`}
                          >
                            <div className="flex items-start space-x-3">
                              <div className="pt-1">
                                {isSelected ? (
                                  <CheckSquare className="h-5 w-5 text-blue-600 flex-shrink-0" />
                                ) : (
                                  <Square className="h-5 w-5 text-gray-400 flex-shrink-0" />
                                )}
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  {route ? (
                                    <span className={`inline-flex items-center space-x-1 ${routeColor} font-medium`}>
                                      <RouteIcon className="h-4 w-4 flex-shrink-0" />
                                      <span className="text-sm">{route}</span>
                                    </span>
                                  ) : (
                                    <span className="inline-flex items-center space-x-1 text-orange-600 font-medium">
                                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                      <span className="text-sm">未設定途徑</span>
                                    </span>
                                  )}
                                  {prescription.status === 'inactive' && (
                                    <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded flex-shrink-0">已停用</span>
                                  )}
                                </div>

                                <div className="mb-2">
                                  <div className="font-bold text-gray-900 text-lg mb-2">
                                    {prescription.medication_name || prescription.drug_name || '未命名藥物'}
                                  </div>
                                  <div className="text-sm text-gray-700">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                      {(prescription.dosage_amount || prescription.dosage_unit) && (
                                        <div className="flex items-baseline">
                                          <span className="font-medium text-gray-900 mr-1.5">劑量：</span>
                                          <span className="text-gray-800">
                                            {prescription.dosage_amount || ''}{prescription.dosage_unit || ''}
                                          </span>
                                        </div>
                                      )}
                                      {prescription.frequency_type && (() => {
                                        const getFrequencyDesc = () => {
                                          const timeSlotsCount = prescription.medication_time_slots?.length || 0;
                                          const getAbbr = (count: number) => {
                                            switch (count) {
                                              case 1: return 'QD';
                                              case 2: return 'BD';
                                              case 3: return 'TDS';
                                              case 4: return 'QID';
                                              default: return `${count}次/日`;
                                            }
                                          };
                                          switch (prescription.frequency_type) {
                                            case 'daily': return getAbbr(timeSlotsCount);
                                            case 'every_x_days': return `隔${prescription.frequency_value}日服`;
                                            case 'every_x_months': return `隔${prescription.frequency_value}月服`;
                                            case 'weekly_days':
                                              const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
                                              const days = prescription.specific_weekdays?.map((day: number) => dayNames[day === 7 ? 0 : day]).join('、') || '';
                                              return `逢${days}服`;
                                            case 'odd_even_days':
                                              return prescription.is_odd_even_day === 'odd' ? '單日服' : prescription.is_odd_even_day === 'even' ? '雙日服' : '單雙日服';
                                            case 'hourly': return `每${prescription.frequency_value}小時服用`;
                                            default: return getAbbr(timeSlotsCount);
                                          }
                                        };
                                        return (
                                          <div className="flex items-baseline">
                                            <span className="font-medium text-gray-900 mr-1.5">頻率：</span>
                                            <span className="text-gray-800">{getFrequencyDesc()}</span>
                                          </div>
                                        );
                                      })()}
                                      {prescription.medication_time_slots && prescription.medication_time_slots.length > 0 && (
                                        <div className="flex items-baseline">
                                          <span className="font-medium text-gray-900 mr-1.5">每日次數：</span>
                                          <span className="text-gray-800">
                                            {prescription.medication_time_slots.length}次 ({prescription.medication_time_slots.join(', ')})
                                          </span>
                                        </div>
                                      )}
                                      {prescription.meal_timing && (
                                        <div className="flex items-baseline">
                                          <span className="font-medium text-gray-900 mr-1.5">用法：</span>
                                          <span className="text-gray-800">{prescription.meal_timing}</span>
                                        </div>
                                      )}
                                      {prescription.preparation_method && (
                                        <div className="flex items-baseline">
                                          <span className="font-medium text-gray-900 mr-1.5">備藥：</span>
                                          <span className="text-gray-800">
                                            {prescription.preparation_method === 'immediate' ? '即時備藥' :
                                             prescription.preparation_method === 'advanced' ? '提前備藥' :
                                             prescription.preparation_method === 'custom' ? '自理' : prescription.preparation_method}
                                          </span>
                                        </div>
                                      )}
                                      {prescription.inspection_rules && prescription.inspection_rules.length > 0 && (
                                        <div className="flex items-baseline">
                                          <span className="font-medium text-gray-900 mr-1.5">檢測：</span>
                                          <span className="text-gray-800">
                                            {prescription.inspection_rules.map((rule: any) => {
                                              const operator =
                                                rule.condition_operator === 'gt' ? '>' :
                                                rule.condition_operator === 'lt' ? '<' :
                                                rule.condition_operator === 'gte' ? '≥' :
                                                rule.condition_operator === 'lte' ? '≤' : '';
                                              return `${rule.vital_sign_type} ${operator} ${rule.condition_value}`;
                                            }).join('、')}
                                          </span>
                                        </div>
                                      )}
                                    </div>
                                  </div>
                                </div>

                                {prescription.prescription_date && (
                                  <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 inline-block">
                                    📅 處方日期：{prescription.prescription_date}
                                    {prescription.end_date && ` ～ ${prescription.end_date}`}
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </>
          )}

          {exportMode === 'batch' && (
            <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-2">匯出說明</h4>
              <ul className="text-sm text-blue-800 space-y-1">
                <li>• 只會匯出處方日期在選定月份範圍內的處方</li>
                <li>• 待變更處方不會匯出</li>
                <li>• 停用處方預設不匯出，可勾選「匯出停用處方」來包含</li>
                <li>• 每位院友會根據途徑（口服/注射/外用）生成獨立工作表</li>
                <li>• <span className="font-semibold">外用</span>包含：外用、滴眼、滴耳、鼻胃管、吸入、舌下、直腸等所有非口服、非注射途徑</li>
                {includeWorkflowRecords && (
                  <>
                    <li className="font-semibold mt-2">• 執核派記錄說明：</li>
                    <li className="ml-4">- 將填入每個處方每日的執藥、核藥、派藥人員代號</li>
                    <li className="ml-4">- 人員代號以英文字母表示（B-Z，跳過 A、S、R、O）</li>
                    <li className="ml-4">- A=入院、S=自理、R=拒服、O=暫停</li>
                    <li className="ml-4">- 備藥方式為「自理」的處方將以淡藍色背景顯示</li>
                  </>
                )}
              </ul>
            </div>
          )}

          {((exportMode === 'batch' && selectedPatientIds.size > 0) || (exportMode === 'current' && currentPatient)) && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4">
              <h4 className="font-medium text-green-900 mb-3 flex items-center space-x-2">
                <Package className="h-5 w-5" />
                <span>途徑分布預覽</span>
              </h4>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="flex items-center space-x-2 mb-1">
                    <Pill className="h-4 w-4 text-blue-600" />
                    <span className="text-sm font-medium text-gray-700">口服</span>
                  </div>
                  <div className="text-2xl font-bold text-blue-600">{routeStats.oral}</div>
                  <div className="text-xs text-gray-500">個處方</div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="flex items-center space-x-2 mb-1">
                    <Syringe className="h-4 w-4 text-red-600" />
                    <span className="text-sm font-medium text-gray-700">注射</span>
                  </div>
                  <div className="text-2xl font-bold text-red-600">{routeStats.injection}</div>
                  <div className="text-xs text-gray-500">個處方</div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="flex items-center space-x-2 mb-1">
                    <Package className="h-4 w-4 text-green-600" />
                    <span className="text-sm font-medium text-gray-700">外用</span>
                  </div>
                  <div className="text-2xl font-bold text-green-600">{routeStats.topical}</div>
                  <div className="text-xs text-gray-500">個處方</div>
                </div>

                <div className="bg-white rounded-lg p-3 border border-green-200">
                  <div className="flex items-center space-x-2 mb-1">
                    <AlertCircle className="h-4 w-4 text-orange-600" />
                    <span className="text-sm font-medium text-gray-700">缺少途徑</span>
                  </div>
                  <div className="text-2xl font-bold text-orange-600">{routeStats.noRoute}</div>
                  <div className="text-xs text-gray-500">個處方</div>
                </div>
              </div>

              {routeStats.noRoute > 0 && (
                <div className="mt-3 bg-orange-50 border border-orange-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-orange-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-orange-800">
                      <span className="font-semibold">警告：</span>
                      有 {routeStats.noRoute} 個處方沒有設定途徑，這些處方將不會被匯出。請先在處方管理中補充途徑資訊。
                    </div>
                  </div>
                </div>
              )}

              {exportMode === 'current' && routeStats.oral === 0 && routeStats.injection === 0 && routeStats.topical === 0 && routeStats.noRoute > 0 && (
                <div className="mt-3 bg-red-50 border border-red-200 rounded-lg p-3">
                  <div className="flex items-start space-x-2">
                    <AlertCircle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
                    <div className="text-sm text-red-800">
                      <span className="font-semibold">錯誤：</span>
                      所有處方都缺少途徑資訊，無法匯出任何記錄。
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}

          {exportMode === 'batch' && (
            <div>
              <div className="flex items-center justify-between mb-3">
                <label className="form-label flex items-center space-x-2 mb-0">
                  <Users className="h-4 w-4" />
                  <span>選擇院友 ({selectedPatientIds.size}/{filteredPatients.length})</span>
                </label>
                <button
                  onClick={handleSelectAll}
                  className="text-sm text-blue-600 hover:text-blue-800 font-medium"
                >
                  {selectedPatientIds.size === filteredPatients.length ? '取消全選' : '全選'}
                </button>
              </div>

              <input
                type="text"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                placeholder="搜尋院友姓名或床號..."
                className="form-input mb-3"
              />

              <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                {filteredPatients.length === 0 ? (
                  <div className="p-8 text-center text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>沒有找到符合條件的院友</p>
                  </div>
                ) : (
                  <div className="divide-y divide-gray-200">
                    {filteredPatients.map(patient => {
                      const isSelected = selectedPatientIds.has(patient.院友id);
                      const patientPrescriptions = prescriptions.filter(p => p.patient_id === patient.院友id);
                      const validPrescriptions = patientPrescriptions.filter(prescription => {
                        if (prescription.status === 'pending_change') return false;
                        if (prescription.status === 'inactive') {
                          if (!includeInactive && !(includeWorkflowRecords && prescriptionsWithWorkflowRecords.has(prescription.id))) {
                            return false;
                          }
                        }
                        if (!prescription.prescription_date) return false;
                        return isInDateRange(
                          prescription.prescription_date,
                          prescription.end_date || null,
                          selectedMonth
                        );
                      });

                      const oralCount = validPrescriptions.filter(p => p.administration_route === '口服').length;
                      const injectionCount = validPrescriptions.filter(p => p.administration_route === '注射').length;
                      const topicalCount = validPrescriptions.filter(p =>
                        p.administration_route && p.administration_route !== '口服' && p.administration_route !== '注射'
                      ).length;
                      const noRouteCount = validPrescriptions.filter(p => !p.administration_route).length;

                      return (
                        <div
                          key={patient.院友id}
                          onClick={() => handleTogglePatient(patient.院友id)}
                          className={`p-4 flex items-center justify-between cursor-pointer transition-colors ${
                            isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'
                          }`}
                        >
                          <div className="flex items-center space-x-3 flex-1">
                            {isSelected ? (
                              <CheckSquare className="h-5 w-5 text-blue-600" />
                            ) : (
                              <Square className="h-5 w-5 text-gray-400" />
                            )}
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                {patient.床號} {patient.中文姓氏}{patient.中文名字}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {validPrescriptions.length > 0 ? (
                                  <div className="flex items-center space-x-3">
                                    <span className="text-green-600 font-medium">
                                      {validPrescriptions.length} 個處方
                                    </span>
                                    {oralCount > 0 && (
                                      <span className="inline-flex items-center space-x-1 text-blue-600">
                                        <Pill className="h-3 w-3" />
                                        <span>{oralCount}</span>
                                      </span>
                                    )}
                                    {injectionCount > 0 && (
                                      <span className="inline-flex items-center space-x-1 text-red-600">
                                        <Syringe className="h-3 w-3" />
                                        <span>{injectionCount}</span>
                                      </span>
                                    )}
                                    {topicalCount > 0 && (
                                      <span className="inline-flex items-center space-x-1 text-green-600">
                                        <Package className="h-3 w-3" />
                                        <span>{topicalCount}</span>
                                      </span>
                                    )}
                                    {noRouteCount > 0 && (
                                      <span className="inline-flex items-center space-x-1 text-orange-600">
                                        <AlertCircle className="h-3 w-3" />
                                        <span>{noRouteCount}</span>
                                      </span>
                                    )}
                                  </div>
                                ) : (
                                  <span className="text-gray-400">該月份沒有處方</span>
                                )}
                              </div>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        <div className="flex items-center justify-between p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {exportMode === 'batch' ? (
              <span>已選擇 <span className="font-semibold text-gray-900">{selectedPatientIds.size}</span> 位院友</span>
            ) : (
              <span>
                {isExportAll ? (
                  <span>將匯出 <span className="font-semibold text-gray-900">{currentPatientPrescriptionsToExport.length}</span> 個處方（全部）</span>
                ) : (
                  <span>將匯出 <span className="font-semibold text-gray-900">{currentPatientPrescriptionsToExport.length}</span> 個處方（已選）</span>
                )}
              </span>
            )}
          </div>
          <div className="flex space-x-3">
            <button
              onClick={onClose}
              className="btn-secondary"
              disabled={isExporting}
            >
              取消
            </button>
            <button
              onClick={handleExport}
              disabled={
                isExporting ||
                (exportMode === 'batch' && selectedPatientIds.size === 0) ||
                (exportMode === 'current' && currentPatientPrescriptionsToExport.length === 0) ||
                (exportMode === 'current' && routeStats.oral === 0 && routeStats.injection === 0 && routeStats.topical === 0)
              }
              className="btn-primary flex items-center space-x-2"
            >
              <FileDown className="h-4 w-4" />
              <span>{isExporting ? '匯出中...' : '匯出記錄'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default MedicationRecordExportModal;
