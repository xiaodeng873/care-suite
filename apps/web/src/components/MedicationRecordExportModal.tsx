import { X, FileDown, Calendar, Users, CheckSquare, Square, AlertCircle, Pill, Syringe, Package, Building2 } from 'lucide-react';
import { usePatientData, useFilteredPatients } from '../context/PatientContext';
import { exportMedicationRecordToHtml, exportBlankMedicationRecordToHtml, orderPrescriptionsForSignatureEfficiency } from '../utils/medicationRecordHtmlExporter';
import { exportMedicationListToHtml, classifyMedicationTerm } from '../utils/medicationListHtmlGenerator';
import { useStationData } from '../context/facility/StationContext';
import { supabase } from '../lib/supabase';
import { fuzzyMatch, matchChineseName, matchEnglishName, matchBedNumber, comparePatientsForSearch } from '../utils/searchUtils';
import BedNumberImprint from './BedNumberImprint';
import React, { useState, useMemo, useEffect, useDeferredValue } from 'react';
import DateInput from './DateInput';

interface MedicationRecordExportModalProps {
  onClose: () => void;
  currentPatient?: any;
  selectedPrescriptionIds?: Set<string>;
  allPrescriptions?: any[];
}

interface RouteStats {
  oral: number;
  injection: number; // 皮下注射 + 肌肉注射 合併
  topical: number;
  noRoute: number;
}

type PrescriptionSortOrder = 'efficiency' | 'name' | 'time' | 'source';

const sortPrescriptionsByOrder = (prescriptions: any[], order: PrescriptionSortOrder): any[] => {
  const sorted = [...prescriptions];
  const firstSlot = (p: any): string => [...(p.medication_time_slots ?? [])].sort()[0] ?? '';
  const byName = (a: any, b: any): number =>
  (a.medication_name ?? '').localeCompare(b.medication_name ?? '', 'zh-TW');
  switch (order) {
    case 'name':
      return sorted.sort(byName);
    case 'time':
      return sorted.sort((a, b) => firstSlot(a).localeCompare(firstSlot(b)) || byName(a, b));
    case 'source':
      return sorted.sort((a, b) =>
      (a.medication_source ?? '').localeCompare(b.medication_source ?? '', 'zh-TW') || byName(a, b));
    case 'efficiency':
    default:
      // 與匯出器共用同一排序：時段重疊高者相鄰（每頁彙總列最少），無時段處方置最後
      return orderPrescriptionsForSignatureEfficiency(sorted);
  }
};

const MedicationRecordExportModal: React.FC<MedicationRecordExportModalProps> = ({
  onClose,
  currentPatient,
  selectedPrescriptionIds = new Set(),
  allPrescriptions = []
}) => {
  const { prescriptions } = usePatientData();
  const patients = useFilteredPatients();

  const [exportMode, setExportMode] = useState<'batch' | 'batchBlank' | 'current' | 'currentBlank'>(currentPatient ? 'current' : 'batch');
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<number>>(new Set());
  const [currentPatientSelectedPrescriptions, setCurrentPatientSelectedPrescriptions] = useState<Set<string>>(selectedPrescriptionIds);
  const [selectedMonth, setSelectedMonth] = useState<string>(() => {
    const now = new Date();
    return now.getFullYear() + '-' + String(now.getMonth() + 1).padStart(2, '0');
  });
  const [includeInactive, setIncludeInactive] = useState(false);
  const [includeWorkflowRecords, setIncludeWorkflowRecords] = useState(false);
  const [includeMedicationRecord, setIncludeMedicationRecord] = useState(true);
  const [includePersonalMedicationList, setIncludePersonalMedicationList] = useState(false);
  const [includeShortTerm, setIncludeShortTerm] = useState(true);
  const [includeLongTerm, setIncludeLongTerm] = useState(true);
  const [isExporting, setIsExporting] = useState(false);
  const [searchTerm, setSearchTerm] = useState('');
  const deferredSearch = useDeferredValue(searchTerm);
  const [prescriptionsWithWorkflowRecords, setPrescriptionsWithWorkflowRecords] = useState<Set<string>>(new Set());
  // 空白藥紙途徑選擇
  const [blankRouteOral, setBlankRouteOral] = useState(true);
  const [blankRouteInjection, setBlankRouteInjection] = useState(true);
  const [blankRouteTopical, setBlankRouteTopical] = useState(true);
  const [batchRouteFilter, setBatchRouteFilter] = useState<Set<string>>(new Set());
  const [prescriptionSortOrder, setPrescriptionSortOrder] = useState<PrescriptionSortOrder>('efficiency');
  const [includeBlankRows, setIncludeBlankRows] = useState(false);
  // 個人藥物記錄日期範圍（不受月份局限）
  const [listStartDate, setListStartDate] = useState<string>(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-01`;
  });
  const [listEndDate, setListEndDate] = useState<string>(() => {
    const now = new Date();
    return now.toISOString().split('T')[0];
  });
  // 批量模式居住區過濾
  const [selectedStationIds, setSelectedStationIds] = useState<Set<string>>(new Set());

  const { stations } = useStationData();

  const activePatients = useMemo(() => {
    return patients.filter((p) => p.在住狀態 === '在住').
    sort((a, b) => a.床號.localeCompare(b.床號, 'zh-Hant', { numeric: true }));
  }, [patients]);

  const filteredPatients = useMemo(() => {
    let base = activePatients;
    if (selectedStationIds.size > 0) {
      base = base.filter((p) => p.station_id && selectedStationIds.has(p.station_id));
    }
    if (!deferredSearch) return base;

    return base.filter((p) => {
      return (
        matchChineseName(p.中文姓氏, p.中文名字, p.中文姓名, deferredSearch) ||
        matchEnglishName(p.英文姓氏, p.英文名字, p.英文姓名, deferredSearch) ||
        matchBedNumber(p.床號, deferredSearch) ||
        fuzzyMatch(p.身份證號碼, deferredSearch));

    }).sort((a, b) => comparePatientsForSearch(a, b, deferredSearch));
  }, [activePatients, deferredSearch, selectedStationIds]);

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

      const { data, error } = await supabase.
      from('medication_workflow_records').
      select('prescription_id').
      gte('scheduled_date', monthStart).
      lte('scheduled_date', monthEnd);

      if (error) {
        console.error('查詢工作流程記錄失敗:', error);
        return;
      }

      const prescriptionIds = new Set(data?.map((r) => r.prescription_id) || []);
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

    const filtered = allPrescriptions.filter((p) => {
      if (p.patient_id !== currentPatient.patient.院友id) return false;
      if (p.status === 'pending_change') return false;
      if (p.status === 'inactive') {
        if (includeInactive) return true;
        if (includeWorkflowRecords && prescriptionsWithWorkflowRecords.has(p.id)) return true;
        return false;
      }
      const term = classifyMedicationTerm(p);
      if (term === 'short' && !includeShortTerm) return false;
      if (term === 'long' && !includeLongTerm) return false;
      return true;
    });
    return sortPrescriptionsByOrder(filtered, prescriptionSortOrder);
  }, [exportMode, currentPatient, allPrescriptions, includeInactive, includeWorkflowRecords, prescriptionsWithWorkflowRecords, prescriptionSortOrder, includeShortTerm, includeLongTerm]);

  const batchRouteStats = useMemo(() => {
    const stats: RouteStats = { oral: 0, injection: 0, topical: 0, noRoute: 0 };

    selectedPatientIds.forEach((patientId) => {
      const patientPrescriptions = prescriptions.filter((p) => p.patient_id === patientId);

      patientPrescriptions.forEach((prescription) => {
        if (prescription.status === 'pending_change') return;
        if (prescription.status === 'inactive') {
          if (!includeInactive && !(includeWorkflowRecords && prescriptionsWithWorkflowRecords.has(prescription.id))) {
            return;
          }
        }
        const term = classifyMedicationTerm(prescription);
        if (term === 'short' && !includeShortTerm) return;
        if (term === 'long' && !includeLongTerm) return;
        if (!prescription.prescription_date) return;
        if (!isInDateRange(prescription.prescription_date, prescription.end_date || null, selectedMonth)) return;

        const route = prescription.administration_route?.trim() || '';

        if (!route) {
          stats.noRoute++;
        } else if (route === '口服' || route === '舌下' || route === '漱口') {
          stats.oral++;
        } else if (route.includes('注射')) {
          stats.injection++;
        } else {
          stats.topical++;
        }
      });
    });

    return stats;
  }, [selectedPatientIds, prescriptions, includeInactive, includeWorkflowRecords, prescriptionsWithWorkflowRecords, selectedMonth, includeShortTerm, includeLongTerm]);

  const currentPatientPrescriptionsToExport = useMemo(() => {
    if (exportMode !== 'current' || !currentPatient) return [];

    const isExportAll = currentPatientSelectedPrescriptions.size === 0;
    const base = isExportAll ?
    currentPatientAvailablePrescriptions :
    allPrescriptions.filter((p) =>
    currentPatientSelectedPrescriptions.has(p.id) &&
    p.patient_id === currentPatient.patient.院友id
    );
    const filtered = base.filter((p) => {
      const term = classifyMedicationTerm(p);
      if (term === 'short' && !includeShortTerm) return false;
      if (term === 'long' && !includeLongTerm) return false;
      return true;
    });
    // 匯出排序必須與 modal 預覽一致（勾選模式下的 base 是未排序的 allPrescriptions）
    return sortPrescriptionsByOrder(filtered, prescriptionSortOrder);
  }, [exportMode, currentPatient, currentPatientSelectedPrescriptions, allPrescriptions, currentPatientAvailablePrescriptions, includeShortTerm, includeLongTerm, prescriptionSortOrder]);

  const currentRouteStats = useMemo((): RouteStats => {
    if (exportMode !== 'current') return { oral: 0, injection: 0, topical: 0, noRoute: 0 };

    const stats: RouteStats = { oral: 0, injection: 0, topical: 0, noRoute: 0 };
    currentPatientPrescriptionsToExport.forEach((p) => {
      const route = p.administration_route?.trim() || '';
      if (!route) stats.noRoute++;else
      if (route === '口服' || route === '舌下' || route === '漱口') stats.oral++;else
      if (route.includes('注射')) stats.injection++;else
      stats.topical++;
    });
    return stats;
  }, [exportMode, currentPatientPrescriptionsToExport]);

  const handleTogglePatient = (patientId: number) => {
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
      setSelectedPatientIds(new Set(filteredPatients.map((p) => p.院友id)));
    }
  };

  const handleSelectAllCurrentPatientPrescriptions = () => {
    if (currentPatientSelectedPrescriptions.size === currentPatientAvailablePrescriptions.length) {
      setCurrentPatientSelectedPrescriptions(new Set());
    } else {
      setCurrentPatientSelectedPrescriptions(new Set(currentPatientAvailablePrescriptions.map((p) => p.id)));
    }
  };

  const handleRouteClick = (routeLabel: string) => {
    if (exportMode === 'current') {
      const routePrescriptions = currentPatientAvailablePrescriptions.filter((p) => {
        const r = p.administration_route?.trim() || '';
        if (routeLabel === '口服') return r === '口服';
        if (routeLabel === '注射') return r.includes('注射');
        return !!(r && r !== '口服' && !r.includes('注射'));
      });
      if (routePrescriptions.length === 0) return;
      const allSelected = routePrescriptions.every((p) => currentPatientSelectedPrescriptions.has(p.id));
      const newSet = new Set(currentPatientSelectedPrescriptions);
      if (allSelected) {
        for (const p of routePrescriptions) newSet.delete(p.id);
      } else {
        for (const p of routePrescriptions) newSet.add(p.id);
      }
      setCurrentPatientSelectedPrescriptions(newSet);
    } else if (exportMode === 'batch') {
      const newFilter = new Set(batchRouteFilter);
      if (newFilter.has(routeLabel)) newFilter.delete(routeLabel);else
      newFilter.add(routeLabel);
      setBatchRouteFilter(newFilter);
    }
  };

  const handleExport = async () => {
    // 驗證批量模式需要選擇院友
    if ((exportMode === 'batch' || exportMode === 'batchBlank') && selectedPatientIds.size === 0) {
      alert('請選擇至少一位院友');
      return;
    }

    // 非空白模式需要有處方
    if (exportMode === 'current' && currentPatientPrescriptionsToExport.length === 0 && !includePersonalMedicationList) {
      alert('沒有可匯出的處方');
      return;
    }

    setIsExporting(true);

    try {
      // 空白藥紙模式的處理
      if (exportMode === 'currentBlank' && currentPatient) {
        const selectedRouteTypes: ('oral' | 'injection' | 'topical')[] = [];
        if (blankRouteOral) selectedRouteTypes.push('oral');
        if (blankRouteInjection) selectedRouteTypes.push('injection');
        if (blankRouteTopical) selectedRouteTypes.push('topical');

        if (selectedRouteTypes.length === 0) {
          alert('請至少選擇一種藥紙類型');
          setIsExporting(false);
          return;
        }

        await exportBlankMedicationRecordToHtml([currentPatient.patient], selectedMonth, selectedRouteTypes);

        const routeNames = selectedRouteTypes.map((r) => r === 'oral' ? '口服' : r === 'injection' ? '注射' : '外用').join('、');
        alert(`匯出成功！\n\n【空白藥紙】\n已為 ${currentPatient.patient.中文姓氏}${currentPatient.patient.中文名字} 匯出空白藥紙\n（包含 ${routeNames} 工作表）`);
        onClose();
        return;
      }

      if (exportMode === 'batchBlank') {
        const selectedRouteTypes: ('oral' | 'injection' | 'topical')[] = [];
        if (blankRouteOral) selectedRouteTypes.push('oral');
        if (blankRouteInjection) selectedRouteTypes.push('injection');
        if (blankRouteTopical) selectedRouteTypes.push('topical');

        if (selectedRouteTypes.length === 0) {
          alert('請至少選擇一種藥紙類型');
          setIsExporting(false);
          return;
        }

        const selectedPatientsForBlank = activePatients.filter((p) => selectedPatientIds.has(p.院友id));

        await exportBlankMedicationRecordToHtml(selectedPatientsForBlank, selectedMonth, selectedRouteTypes);

        const routeNames = selectedRouteTypes.map((r) => r === 'oral' ? '口服' : r === 'injection' ? '注射' : '外用').join('、');
        alert(`匯出成功！\n\n【空白藥紙】\n已為 ${selectedPatientsForBlank.length} 位院友匯出空白藥紙\n（每位院友包含 ${routeNames} 工作表）`);
        onClose();
        return;
      }

      const shouldExportMedicationRecord = includeMedicationRecord;
      const shouldExportPersonalMedicationList = includePersonalMedicationList;

      if (exportMode === 'current' && currentPatient) {
        if (shouldExportMedicationRecord) {
          await exportMedicationRecordToHtml([
          {
            ...currentPatient.patient,
            prescriptions: currentPatientPrescriptionsToExport
          }],
          selectedMonth, includeWorkflowRecords, includeBlankRows, prescriptionSortOrder);
        }

        if (shouldExportPersonalMedicationList) {
          const currentListPrescriptions = currentPatientPrescriptionsToExport.filter((p) => {
            const term = classifyMedicationTerm(p);
            if (term === 'short' && !includeShortTerm) return false;
            if (term === 'long' && !includeLongTerm) return false;
            return true;
          });
          if (currentListPrescriptions.length === 0) {
            alert('所選院友沒有符合長期/短期篩選的處方，無法匯出個人藥物記錄');
          } else {
            exportMedicationListToHtml([{ ...currentPatient.patient, prescriptions: currentListPrescriptions }], {
              startDate: listStartDate,
              endDate: listEndDate
            });
          }
        }
      } else {
        const selectedPatients = activePatients.
        filter((p) => selectedPatientIds.has(p.院友id)).
        map((patient) => {
          const allPrescriptions = prescriptions.filter((p) => p.patient_id === patient.院友id);

          const validPrescriptions = allPrescriptions.filter((prescription) => {
            if (prescription.status === 'pending_change') {
              return false;
            }

            if (prescription.status === 'inactive') {
              if (!includeInactive && !(includeWorkflowRecords && prescriptionsWithWorkflowRecords.has(prescription.id))) {
                return false;
              }
            }

            const term = classifyMedicationTerm(prescription);
            if (term === 'short' && !includeShortTerm) return false;
            if (term === 'long' && !includeLongTerm) return false;

            if (!prescription.prescription_date) {
              return false;
            }

            if (!isInDateRange(
              prescription.prescription_date,
              prescription.end_date || null,
              selectedMonth
            )) return false;
            if (batchRouteFilter.size > 0) {
              const r = prescription.administration_route?.trim() || '';
              const isOral = r === '口服';
              const isInjection = r.includes('注射');
              const isTopical = !!(r && !isOral && !isInjection);
              if (!(batchRouteFilter.has('口服') && isOral ||
              batchRouteFilter.has('注射') && isInjection ||
              batchRouteFilter.has('外用') && isTopical)) return false;
            }
            return true;
          });

          return {
            ...patient,
            prescriptions: sortPrescriptionsByOrder(validPrescriptions, prescriptionSortOrder)
          };
        }).
        filter((p) => p.prescriptions.length > 0);

        if (selectedPatients.length === 0 && !shouldExportPersonalMedicationList) {
          alert('所選院友在指定月份沒有符合條件的處方記錄');
          setIsExporting(false);
          return;
        }

        if (shouldExportMedicationRecord && selectedPatients.length > 0) {
          await exportMedicationRecordToHtml(selectedPatients, selectedMonth, includeWorkflowRecords, includeBlankRows, prescriptionSortOrder);
        }

        if (shouldExportPersonalMedicationList) {
          const patientsForList = activePatients.
          filter((p) => selectedPatientIds.has(p.院友id)).
          map((patient) => {
            const patientPrescriptions = prescriptions.filter((p) => {
              if (p.patient_id !== patient.院友id) return false;
              if (p.status === 'pending_change') return false;
              if (p.status === 'inactive') {
                if (!includeInactive && !(includeWorkflowRecords && prescriptionsWithWorkflowRecords.has(p.id))) {
                  return false;
                }
              }
              const term = classifyMedicationTerm(p);
              if (term === 'short' && !includeShortTerm) return false;
              if (term === 'long' && !includeLongTerm) return false;
              return true;
            });
            return { ...patient, prescriptions: patientPrescriptions };
          }).
          filter((p) => p.prescriptions.length > 0);
          if (patientsForList.length > 0) {
            exportMedicationListToHtml(patientsForList, {
              startDate: listStartDate,
              endDate: listEndDate
            });
          } else {
            alert('所選院友沒有在服處方，無法匯出個人藥物記錄');
            setIsExporting(false);
            return;
          }
        }
      }

      onClose();
    } catch (error: any) {
      console.error('匯出失敗:', error);
      alert('匯出失敗: ' + (error.message || '未知錯誤'));
    } finally {
      setIsExporting(false);
    }
  };

  const routeStats = exportMode === 'current' || exportMode === 'currentBlank' ? currentRouteStats : batchRouteStats;
  const isExportAll = exportMode === 'current' && currentPatientSelectedPrescriptions.size === 0;
  const isBlankMode = exportMode === 'currentBlank' || exportMode === 'batchBlank';

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-4xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-6 border-b border-gray-200">
          <div className="flex flex-wrap items-center gap-3">
            <FileDown className="h-6 w-6 text-blue-600" />
            <h2 className="text-xl font-semibold text-gray-900">匯出個人備藥及給藥記錄</h2>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors">
            
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6 space-y-6">
          {currentPatient &&
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
              <h4 className="font-medium text-blue-900 mb-3">選擇匯出模式</h4>
              <div className="grid grid-cols-2 gap-2">
                <label className="flex flex-wrap items-center gap-3 cursor-pointer">
                  <input
                  type="radio"
                  name="exportMode"
                  checked={exportMode === 'current'}
                  onChange={() => setExportMode('current')}
                  className="form-radio h-4 w-4 text-blue-600" />
                
                  <div>
                    <span className="font-medium text-gray-900">匯出當前院友藥紙</span>
                    <p className="text-sm text-gray-600">
                      匯出 {currentPatient.patient.中文姓氏}{currentPatient.patient.中文名字} 的指定處方
                    </p>
                  </div>
                </label>
                <label className="flex flex-wrap items-center gap-3 cursor-pointer">
                  <input
                  type="radio"
                  name="exportMode"
                  checked={exportMode === 'currentBlank'}
                  onChange={() => setExportMode('currentBlank')}
                  className="form-radio h-4 w-4 text-blue-600" />
                
                  <div>
                    <span className="font-medium text-gray-900">匯出當前院友空白藥紙</span>
                    <p className="text-sm text-gray-600">
                      只填入 {currentPatient.patient.中文姓氏}{currentPatient.patient.中文名字} 的基本資訊，不包含處方
                    </p>
                  </div>
                </label>
                <label className="flex flex-wrap items-center gap-3 cursor-pointer">
                  <input
                  type="radio"
                  name="exportMode"
                  checked={exportMode === 'batch'}
                  onChange={() => setExportMode('batch')}
                  className="form-radio h-4 w-4 text-blue-600" />
                
                  <div>
                    <span className="font-medium text-gray-900">批量匯出多位院友藥紙</span>
                    <p className="text-sm text-gray-600">選擇多位院友進行批量匯出</p>
                  </div>
                </label>
                <label className="flex flex-wrap items-center gap-3 cursor-pointer">
                  <input
                  type="radio"
                  name="exportMode"
                  checked={exportMode === 'batchBlank'}
                  onChange={() => setExportMode('batchBlank')}
                  className="form-radio h-4 w-4 text-blue-600" />
                
                  <div>
                    <span className="font-medium text-gray-900">批量匯出多位院友空白藥紙</span>
                    <p className="text-sm text-gray-600">選擇多位院友，只填入基本資訊，不包含處方</p>
                  </div>
                </label>
              </div>
            </div>
          }

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label flex flex-wrap items-center gap-2">
                <Calendar className="h-4 w-4" />
                <span>選擇月份</span>
              </label>
              <input
                type="month"
                value={selectedMonth}
                onChange={(e) => setSelectedMonth(e.target.value)}
                className="form-input" />
              
            </div>

            <div className="grid grid-cols-2 gap-x-4 gap-y-2 pt-8 items-start">
              {!isBlankMode &&
              <label className="flex items-center gap-2 cursor-pointer">
                  <input
                  type="checkbox"
                  checked={includeMedicationRecord}
                  onChange={(e) => setIncludeMedicationRecord(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded" />
                
                  <span className="text-sm text-gray-700">匯出個人備藥及給藥記錄</span>
                </label>
              }
              {!isBlankMode &&
              <label className="flex items-center gap-2 cursor-pointer">
                  <input
                  type="checkbox"
                  checked={includePersonalMedicationList}
                  onChange={(e) => setIncludePersonalMedicationList(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded" />
                
                  <span className="text-sm text-gray-700">匯出個人藥物記錄</span>
                </label>
              }
              {includePersonalMedicationList && !isBlankMode &&
              <div className="col-span-2 grid grid-cols-1 sm:grid-cols-2 gap-3 bg-amber-50 border border-amber-200 rounded-md p-3">
                  <div>
                    <label className="form-label flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4" />
                      <span>列印日期範圍（開始）</span>
                    </label>
                    <DateInput

                    value={listStartDate}

                    className="form-input" onChange={(value) => setListStartDate(value)} />
                  
                  </div>
                  <div>
                    <label className="form-label flex items-center gap-2 mb-1">
                      <Calendar className="h-4 w-4" />
                      <span>列印日期範圍（結束）</span>
                    </label>
                    <DateInput

                    value={listEndDate}

                    className="form-input" onChange={(value) => setListEndDate(value)} />
                  
                  </div>
                  <div className="col-span-1 sm:col-span-2 flex flex-wrap gap-4 items-center">
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                      type="checkbox"
                      checked={includeShortTerm}
                      onChange={(e) => setIncludeShortTerm(e.target.checked)}
                      className="form-checkbox h-5 w-5 text-blue-600 rounded" />
                    
                      <span className="text-sm text-gray-700">短期藥</span>
                    </label>
                    <label className="flex items-center gap-2 cursor-pointer">
                      <input
                      type="checkbox"
                      checked={includeLongTerm}
                      onChange={(e) => setIncludeLongTerm(e.target.checked)}
                      className="form-checkbox h-5 w-5 text-blue-600 rounded" />
                    
                      <span className="text-sm text-gray-700">長期藥</span>
                    </label>
                  </div>
                </div>
              }
              {!isBlankMode &&
              <label className="flex items-center gap-2 cursor-pointer">
                  <input
                  type="checkbox"
                  checked={includeWorkflowRecords}
                  onChange={(e) => setIncludeWorkflowRecords(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded" />
                
                  <span className="text-sm text-gray-700">包含執核派記錄</span>
                </label>
              }
              {!isBlankMode &&
              <label className="flex items-center gap-2 cursor-pointer">
                  <input
                  type="checkbox"
                  checked={includeInactive}
                  onChange={(e) => setIncludeInactive(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded" />
                
                  <span className="text-sm text-gray-700">包含停用處方</span>
                </label>
              }
              {!isBlankMode &&
              <label className="flex items-center gap-2 cursor-pointer">
                  <input
                  type="checkbox"
                  checked={includeBlankRows}
                  onChange={(e) => setIncludeBlankRows(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded" />
                
                  <span className="text-sm text-gray-700">包含處方空白列</span>
                </label>
              }
              {!isBlankMode &&
              <div className="flex items-center gap-2">
                  <span className="text-sm text-gray-700 whitespace-nowrap">處方排列：</span>
                  <select
                  value={prescriptionSortOrder}
                  onChange={(e) => setPrescriptionSortOrder(e.target.value as PrescriptionSortOrder)}
                  className="form-input text-sm py-1 px-2 h-8">
                  
                    <option value="efficiency">按簽署效益</option>
                    <option value="name">按藥物名稱</option>
                    <option value="time">按派藥時間</option>
                    <option value="source">按藥物來源</option>
                  </select>
                </div>
              }
            </div>
          </div>

          {/* 空白藥紙模式說明 */}
          {isBlankMode &&
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <h4 className="font-medium text-yellow-900 mb-2">空白藥紙設定</h4>
              <p className="text-sm text-yellow-800 mb-3">選擇要匯出的藥紙類型：</p>
              <div className="flex flex-wrap gap-4 mb-3">
                <label className="flex flex-wrap items-center gap-2 cursor-pointer">
                  <input
                  type="checkbox"
                  checked={blankRouteOral}
                  onChange={(e) => setBlankRouteOral(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-blue-600 rounded" />
                
                  <span className="text-sm text-gray-700 flex items-center space-x-1">
                    <Pill className="h-4 w-4 text-blue-600" />
                    <span>口服</span>
                  </span>
                </label>
                <label className="flex flex-wrap items-center gap-2 cursor-pointer">
                  <input
                  type="checkbox"
                  checked={blankRouteInjection}
                  onChange={(e) => setBlankRouteInjection(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-red-600 rounded" />
                
                  <span className="text-sm text-gray-700 flex items-center space-x-1">
                    <Syringe className="h-4 w-4 text-red-600" />
                    <span>注射（皮下/肌肉）</span>
                  </span>
                </label>
                <label className="flex flex-wrap items-center gap-2 cursor-pointer">
                  <input
                  type="checkbox"
                  checked={blankRouteTopical}
                  onChange={(e) => setBlankRouteTopical(e.target.checked)}
                  className="form-checkbox h-5 w-5 text-green-600 rounded" />
                
                  <span className="text-sm text-gray-700 flex items-center space-x-1">
                    <Package className="h-4 w-4 text-green-600" />
                    <span>外用</span>
                  </span>
                </label>
              </div>
              {!blankRouteOral && !blankRouteInjection && !blankRouteTopical &&
            <p className="text-sm text-red-600 font-medium">請至少選擇一種藥紙類型</p>
            }
              <div className="border-t border-yellow-200 mt-3 pt-3">
                <h5 className="font-medium text-yellow-900 mb-2">說明</h5>
                <ul className="text-sm text-yellow-800 space-y-1">
                  <li>• 將只填入院友基本資訊（姓名、床號、年齡、藥物敏感等）</li>
                  <li>• 不會填入任何處方資料</li>
                  <li>• 適用於需要手動填寫處方的情況</li>
                </ul>
              </div>
            </div>
          }

          {!isBlankMode && (exportMode === 'current' && currentPatient || exportMode === 'batch') &&
          <div className="flex flex-wrap items-center gap-2 border-b border-gray-100 pb-3">
              <span className="text-sm font-medium text-gray-600">途徑分布：</span>
              {(['口服', '注射', '外用'] as const).map((label) => {
              const count = label === '口服' ? routeStats.oral :
              label === '注射' ? routeStats.injection :
              routeStats.topical;
              if (count === 0) return null; // 沒有該途徑的處方就不顯示
              const Icon = label === '口服' ? Pill : label === '外用' ? Package : Syringe;
              const color = label === '口服' ? 'text-blue-600' : label === '外用' ? 'text-green-600' : 'text-red-600';
              const activeCls = label === '口服' ? 'bg-blue-50 border-blue-400' : label === '外用' ? 'bg-green-50 border-green-400' : 'bg-red-50 border-red-400';
              const isActive = exportMode === 'batch' ?
              batchRouteFilter.has(label) :
              currentPatientAvailablePrescriptions.some((p) => {
                if (!currentPatientSelectedPrescriptions.has(p.id)) return false;
                const r = p.administration_route?.trim() || '';
                if (label === '口服') return r === '口服';
                if (label === '注射') return r.includes('注射');
                return !!(r && r !== '口服' && !r.includes('注射'));
              });
              return (
                <button key={label} type="button" onClick={() => handleRouteClick(label)}
                className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full border text-sm font-medium transition-colors ${isActive ? `${activeCls} ring-1 ring-offset-0` : 'border-gray-300 bg-white'} ${color}`}
                title={exportMode === 'batch' ? `篩選：只匯出${label}處方（再點取消）` : `選取所有${label}處方（再點取消）`}>
                  
                    <Icon className="h-3.5 w-3.5" />
                    <span>{label}</span><span className="font-bold ml-0.5">{count}</span>
                  </button>);

            })}
              {exportMode === 'batch' && batchRouteFilter.size > 0 &&
            <button type="button" onClick={() => setBatchRouteFilter(new Set())} className="text-xs text-gray-400 hover:text-gray-700 underline ml-1">清除篩選</button>
            }
            </div>
          }

          {exportMode === 'current' && currentPatient &&
          <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                  <label className="form-label flex flex-wrap items-center gap-2 mb-0">
                    <Package className="h-4 w-4" />
                    <span>選擇處方 ({currentPatientSelectedPrescriptions.size}/{currentPatientAvailablePrescriptions.length})</span>
                  </label>
                  <button
                onClick={handleSelectAllCurrentPatientPrescriptions}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                
                    {currentPatientSelectedPrescriptions.size === currentPatientAvailablePrescriptions.length ? '取消全選' : '全選'}
                  </button>
                </div>

                <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                  {currentPatientAvailablePrescriptions.length === 0 ?
              <div className="p-8 text-center text-gray-500">
                      <Package className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                      <p>沒有可用的處方</p>
                    </div> :

              <div className="divide-y divide-gray-200">
                      {currentPatientAvailablePrescriptions.map((prescription) => {
                  const isSelected = currentPatientSelectedPrescriptions.has(prescription.id);
                  const route = prescription.administration_route;
                  const routeIcon = (route === '口服' || route === '舌下' || route === '漱口') ? Pill : route?.includes('注射') ? Syringe : Package;
                  const RouteIcon = routeIcon;
                  const routeColor = (route === '口服' || route === '舌下' || route === '漱口') ? 'text-blue-600' : route?.includes('注射') ? 'text-red-600' : 'text-green-600';

                  return (
                    <div
                      key={prescription.id}
                      onClick={() => handleToggleCurrentPatientPrescription(prescription.id)}
                      className={`p-4 cursor-pointer transition-colors border-b border-gray-100 last:border-b-0 ${
                      isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`
                      }>
                      
                            <div className="flex items-start gap-3">
                              <div className="pt-1">
                                {isSelected ?
                          <CheckSquare className="h-5 w-5 text-blue-600 flex-shrink-0" /> :

                          <Square className="h-5 w-5 text-gray-400 flex-shrink-0" />
                          }
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-2">
                                  {route ?
                            <span className={`inline-flex items-center space-x-1 ${routeColor} font-medium`}>
                                      <RouteIcon className="h-4 w-4 flex-shrink-0" />
                                      <span className="text-sm">{route}</span>
                                    </span> :

                            <span className="inline-flex items-center space-x-1 text-orange-600 font-medium">
                                      <AlertCircle className="h-4 w-4 flex-shrink-0" />
                                      <span className="text-sm">未設定途徑</span>
                                    </span>
                            }
                                  {prescription.status === 'inactive' &&
                            <span className="px-2 py-0.5 text-xs font-medium bg-gray-200 text-gray-700 rounded flex-shrink-0">已停用</span>
                            }
                                </div>

                                <div className="mb-2">
                                  <div className="font-bold text-gray-900 text-lg mb-2">
                                    {prescription.medication_name || prescription.drug_name || '未命名藥物'}
                                  </div>
                                  <div className="text-sm text-gray-700">
                                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1">
                                      {(prescription.dosage_amount || prescription.dosage_unit) &&
                                <div className="flex items-baseline">
                                          <span className="font-medium text-gray-900 mr-1.5">劑量：</span>
                                          <span className="text-gray-800">
                                            {String(prescription.dosage_amount || '').match(/^\d+(\.\d+)?$/) ?
                                    `${prescription.dosage_amount}${prescription.dosage_unit || ''}` :
                                    String(prescription.dosage_amount || '')}
                                          </span>
                                        </div>
                                }
                                      {prescription.frequency_type && (() => {
                                  const getFrequencyDesc = () => {
                                    const timeSlotsCount = prescription.medication_time_slots?.length || 0;
                                    const getAbbr = (count: number) => {
                                      switch (count) {
                                        case 1:return 'QD';
                                        case 2:return 'BD';
                                        case 3:return 'TDS';
                                        case 4:return 'QID';
                                        default:return `${count}次/日`;
                                      }
                                    };
                                    switch (prescription.frequency_type) {
                                      case 'daily':return getAbbr(timeSlotsCount);
                                      case 'every_x_days':return `隔${prescription.frequency_value}日服`;
                                      case 'every_x_months':return `隔${prescription.frequency_value}月服`;
                                      case 'weekly_days':
                                        const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
                                        const days = prescription.specific_weekdays?.map((day: number) => dayNames[day === 7 ? 0 : day]).join('、') || '';
                                        return `逢${days}服`;
                                      case 'odd_even_days':
                                        return prescription.is_odd_even_day === 'odd' ? '單日服' : prescription.is_odd_even_day === 'even' ? '雙日服' : '單雙日服';
                                      case 'hourly':return `每${prescription.frequency_value}小時服用`;
                                      default:return getAbbr(timeSlotsCount);
                                    }
                                  };
                                  return (
                                    <div className="flex items-baseline">
                                            <span className="font-medium text-gray-900 mr-1.5">頻率：</span>
                                            <span className="text-gray-800">{getFrequencyDesc()}</span>
                                          </div>);

                                })()}
                                      {prescription.medication_time_slots && prescription.medication_time_slots.length > 0 &&
                                <div className="flex items-baseline">
                                          <span className="font-medium text-gray-900 mr-1.5">每日次數：</span>
                                          <span className="text-gray-800">
                                            {prescription.medication_time_slots.length}次 ({prescription.medication_time_slots.join(', ')})
                                          </span>
                                        </div>
                                }
                                      {prescription.meal_timing &&
                                <div className="flex items-baseline">
                                          <span className="font-medium text-gray-900 mr-1.5">用法：</span>
                                          <span className="text-gray-800">{prescription.meal_timing}</span>
                                        </div>
                                }
                                      {prescription.preparation_method &&
                                <div className="flex items-baseline">
                                          <span className="font-medium text-gray-900 mr-1.5">備藥：</span>
                                          <span className="text-gray-800">
                                            {prescription.preparation_method === 'immediate' ? '即時備藥' :
                                    prescription.preparation_method === 'advanced' ? '提前備藥' :
                                    prescription.preparation_method === 'custom' ? '自理' : prescription.preparation_method}
                                          </span>
                                        </div>
                                }
                                      {prescription.inspection_rules && prescription.inspection_rules.length > 0 &&
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
                                }
                                    </div>
                                  </div>
                                </div>

                                {prescription.prescription_date &&
                          <div className="text-xs text-gray-500 bg-gray-50 rounded px-2 py-1 inline-block">
                                    📅 處方日期：{prescription.prescription_date}
                                    {prescription.end_date && ` ～ ${prescription.end_date}`}
                                  </div>
                          }
                              </div>
                            </div>
                          </div>);

                })}
                    </div>
              }
                </div>
              </div>
          }

          {(exportMode === 'batch' || exportMode === 'batchBlank') &&
          <div>
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                <label className="form-label flex flex-wrap items-center gap-2 mb-0">
                  <Users className="h-4 w-4" />
                  <span>選擇院友 ({selectedPatientIds.size}/{filteredPatients.length})</span>
                </label>
                <button
                onClick={handleSelectAll}
                className="text-sm text-blue-600 hover:text-blue-800 font-medium">
                
                  {selectedPatientIds.size === filteredPatients.length ? '取消全選' : '全選'}
                </button>
              </div>

              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="text-sm font-medium text-gray-600 flex items-center gap-1">
                  <Building2 className="h-4 w-4" />
                  居住區篩選：
                </span>
                {stations.length === 0 ?
              <span className="text-sm text-gray-400">暫無居住區資料</span> :

              stations.map((station) => {
                const isActive = selectedStationIds.size === 0 || selectedStationIds.has(station.id);
                return (
                  <button
                    key={station.id}
                    type="button"
                    onClick={() => {
                      const newSet = new Set(selectedStationIds);
                      if (newSet.has(station.id)) {
                        newSet.delete(station.id);
                      } else {
                        newSet.add(station.id);
                      }
                      setSelectedStationIds(newSet);
                    }}
                    className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full border text-xs font-medium transition-colors ${
                    isActive ?
                    'bg-blue-50 border-blue-400 text-blue-700' :
                    'bg-white border-gray-300 text-gray-600'}`
                    }>
                    
                        <span>{station.code || station.name}</span>
                      </button>);

              })
              }
                {selectedStationIds.size > 0 &&
              <button
                type="button"
                onClick={() => setSelectedStationIds(new Set())}
                className="text-xs text-gray-500 hover:text-gray-700 underline">
                
                    清除篩選
                  </button>
              }
              </div>

              <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="搜尋院友姓名或床號..."
              className="form-input mb-3" />
            

              <div className="border border-gray-200 rounded-lg max-h-96 overflow-y-auto">
                {filteredPatients.length === 0 ?
              <div className="p-8 text-center text-gray-500">
                    <Users className="h-12 w-12 mx-auto mb-2 text-gray-300" />
                    <p>沒有找到符合條件的院友</p>
                  </div> :

              <div className="divide-y divide-gray-200">
                    {filteredPatients.map((patient) => {
                  const isSelected = selectedPatientIds.has(patient.院友id);
                  const patientPrescriptions = prescriptions.filter((p) => p.patient_id === patient.院友id);
                  const validPrescriptions = patientPrescriptions.filter((prescription) => {
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

                  const isOral = (route: string | undefined) => route === '口服' || route === '舌下' || route === '漱口';
                  const oralCount = validPrescriptions.filter((p) => isOral(p.administration_route)).length;
                  const injectionCount = validPrescriptions.filter((p) => p.administration_route?.includes('注射')).length;
                  const topicalCount = validPrescriptions.filter((p) =>
                  p.administration_route && !isOral(p.administration_route) && !p.administration_route.includes('注射')
                  ).length;
                  const noRouteCount = validPrescriptions.filter((p) => !p.administration_route).length;

                  return (
                    <div
                      key={patient.院友id}
                      onClick={() => handleTogglePatient(patient.院友id)}
                      className={`p-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 cursor-pointer transition-colors ${
                      isSelected ? 'bg-blue-50 hover:bg-blue-100' : 'hover:bg-gray-50'}`
                      }>
                      
                          <div className="flex flex-wrap items-center gap-3 flex-1">
                            {isSelected ?
                        <CheckSquare className="h-5 w-5 text-blue-600" /> :

                        <Square className="h-5 w-5 text-gray-400" />
                        }
                            <div className="flex-1">
                              <div className="font-medium text-gray-900">
                                <BedNumberImprint patient={patient} size="sm" className="text-gray-900" /> {patient.中文姓氏}{patient.中文名字}
                              </div>
                              <div className="text-sm text-gray-600 mt-1">
                                {validPrescriptions.length > 0 ?
                            <div className="flex flex-wrap items-center gap-3">
                                    <span className="text-green-600 font-medium">
                                      {validPrescriptions.length} 個處方
                                    </span>
                                    {oralCount > 0 &&
                              <span className="inline-flex items-center space-x-1 text-blue-600">
                                        <Pill className="h-3 w-3" />
                                        <span>{oralCount}</span>
                                      </span>
                              }
                                    {injectionCount > 0 &&
                              <span className="inline-flex items-center space-x-1 text-red-600">
                                        <Syringe className="h-3 w-3" />
                                        <span>{injectionCount}</span>
                                      </span>
                              }
                                    {topicalCount > 0 &&
                              <span className="inline-flex items-center space-x-1 text-green-600">
                                        <Package className="h-3 w-3" />
                                        <span>{topicalCount}</span>
                                      </span>
                              }
                                    {noRouteCount > 0 &&
                              <span className="inline-flex items-center space-x-1 text-orange-600">
                                        <AlertCircle className="h-3 w-3" />
                                        <span>{noRouteCount}</span>
                                      </span>
                              }
                                  </div> :

                            <span className="text-gray-400">該月份沒有處方</span>
                            }
                              </div>
                            </div>
                          </div>
                        </div>);

                })}
                  </div>
              }
              </div>
            </div>
          }
        </div>

        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 p-6 border-t border-gray-200 bg-gray-50">
          <div className="text-sm text-gray-600">
            {exportMode === 'batch' || exportMode === 'batchBlank' ?
            <span>
                已選擇 <span className="font-semibold text-gray-900">{selectedPatientIds.size}</span> 位院友
                {exportMode === 'batchBlank' && <span className="text-yellow-600 ml-1">（空白藥紙）</span>}
              </span> :
            exportMode === 'currentBlank' ?
            <span>
                將匯出 <span className="font-semibold text-gray-900">{currentPatient?.patient.中文姓氏}{currentPatient?.patient.中文名字}</span> 的空白藥紙
              </span> :

            <span>
                {isExportAll ?
              <span>將匯出 <span className="font-semibold text-gray-900">{currentPatientPrescriptionsToExport.length}</span> 個處方（全部）</span> :

              <span>將匯出 <span className="font-semibold text-gray-900">{currentPatientPrescriptionsToExport.length}</span> 個處方（已選）</span>
              }
              </span>
            }
          </div>
          <div className="flex flex-col-reverse sm:flex-row gap-2">
            <button
              onClick={onClose}
              className="btn-secondary"
              disabled={isExporting}>
              
              取消
            </button>
            <button
              onClick={handleExport}
              disabled={
              isExporting ||
              (exportMode === 'batch' || exportMode === 'batchBlank') && selectedPatientIds.size === 0 ||
              exportMode === 'current' && currentPatientPrescriptionsToExport.length === 0 && !includePersonalMedicationList ||
              isBlankMode && !blankRouteOral && !blankRouteInjection && !blankRouteTopical
              }
              className="btn-primary flex flex-wrap items-center gap-2">
              
              <FileDown className="h-4 w-4" />
              <span>{isExporting ? '匯出中...' : isBlankMode ? '匯出空白藥紙' : '匯出記錄'}</span>
            </button>
          </div>
        </div>
      </div>
    </div>);

};

export default MedicationRecordExportModal;