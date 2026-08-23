import { X, Search, Printer } from 'lucide-react';
import type { Patient } from '../lib/database';
import type { PrintContentMode } from '../utils/patientPrintBundleGenerator';
import { ROSTER_PRINT_DEPARTMENTS } from '../utils/rosterPrintGenerator';
import BedNumberImprint from './BedNumberImprint';
import React, { useState, useMemo } from 'react';
import DateInput from './DateInput';

export type PrintDocumentCategory = '入住文件' | '常用表格' | '床頭記錄' | '統計報表' | '排班管理';

export interface PrintDocumentOption {
  id: string;
  name: string;
  category: PrintDocumentCategory;
  defaultChecked: boolean;
  disabled?: boolean;
  disabledHint?: string;
}

export const PRINT_DOCUMENTS: PrintDocumentOption[] = [
// 入住文件
{ id: 'personal_health_record', name: '院友個人及健康記錄', category: '入住文件', defaultChecked: true },
{ id: 'nursing_assessment', name: '院友護理評估記錄', category: '入住文件', defaultChecked: true },
{ id: 'vital_signs_record', name: '生命表徵觀察記錄表', category: '入住文件', defaultChecked: true },
{ id: 'health_assessment', name: '院友健康評估及記錄', category: '入住文件', defaultChecked: true },
{ id: 'er_record', name: '使用急症室留院記錄', category: '入住文件', defaultChecked: true },
{ id: 'follow_up_record', name: '院友覆診記錄表', category: '入住文件', defaultChecked: true },
{ id: 'incident_report', name: '個人意外事件記錄表', category: '入住文件', defaultChecked: true },
{ id: 'activity_record', name: '院友健康教育/活動記錄表', category: '入住文件', defaultChecked: true },
{ id: 'doctor_visit', name: '醫生診治記錄', category: '入住文件', defaultChecked: true },
{ id: 'orientation_plan', name: '新院友入住導向計劃紀錄', category: '入住文件', defaultChecked: true },
{ id: 'publicity_consent', name: '發佈資料同意書', category: '入住文件', defaultChecked: true },
{ id: 'outing_consent', name: '院友外出同意書', category: '入住文件', defaultChecked: true },
{ id: 'personal_belongings', name: '私人物品記錄表', category: '入住文件', defaultChecked: true },
{ id: 'financial_proxy_p1', name: '託管院友財物授權書P1', category: '入住文件', defaultChecked: true },
{ id: 'financial_proxy_p2', name: '託管院友財物授權書P2', category: '入住文件', defaultChecked: true },
{ id: 'financial_return', name: '領回託管財物證明書', category: '入住文件', defaultChecked: true },
// 常用表格
{ id: 'medication_list_short', name: '院友服用藥物一覽表（短期藥）', category: '常用表格', defaultChecked: true },
{ id: 'medication_list_long', name: '院友服用藥物一覽表（長期藥）', category: '常用表格', defaultChecked: false },
{ id: 'vaccination_record', name: '疫苗接種記錄', category: '常用表格', defaultChecked: false },
{ id: 'temperature_record', name: '院友體溫記錄', category: '常用表格', defaultChecked: false },
{ id: 'bodyweight_record', name: '院友體重記錄', category: '常用表格', defaultChecked: false },
{ id: 'blood_sugar_record', name: '院友血糖記錄', category: '常用表格', defaultChecked: false },
{ id: 'nursing_treatment', name: '護理及治療記錄', category: '常用表格', defaultChecked: true },
{ id: 'wound_assessment', name: '傷口評估記錄表', category: '常用表格', defaultChecked: false },
{ id: 'restraint_usage_common', name: '使用約束物品紀錄', category: '常用表格', defaultChecked: false },
{ id: 'restraint_consent', name: '使用約束措施的評估及同意書', category: '常用表格', defaultChecked: false },
{ id: 'accident_report', name: '意外事件報告', category: '常用表格', defaultChecked: false },
{ id: 'medication_proxy', name: '要求院舍派發成藥確認書', category: '常用表格', defaultChecked: false },
{ id: 'self_medication', name: '自行存放及使用藥物同意書', category: '常用表格', defaultChecked: false },
// 床頭記錄
{ id: 'bedhead_patrol_rounds', name: '院友巡房記錄表', category: '床頭記錄', defaultChecked: true },
{ id: 'bedhead_diaper', name: '換片及大便記錄', category: '床頭記錄', defaultChecked: true },
{ id: 'bedhead_intake_output', name: '個人出入量記錄表', category: '床頭記錄', defaultChecked: true },
{ id: 'bedhead_hygiene', name: '個人衛生、清潔及大便記錄', category: '床頭記錄', defaultChecked: true },
{ id: 'bedhead_restraint_observation', name: '身體約束物品觀察記錄表', category: '床頭記錄', defaultChecked: true },
{ id: 'bedhead_position_change', name: '轉身記錄', category: '床頭記錄', defaultChecked: true },
{ id: 'bedhead_toilet_training', name: '如廁訓練', category: '床頭記錄', defaultChecked: false, disabled: true, disabledHint: '未開放' },
// 統計報表
{ id: 'meal_statistics_report', name: '餐膳統計報表', category: '統計報表', defaultChecked: false },
{ id: 'tube_care_statistics_report', name: '喉管護理報表', category: '統計報表', defaultChecked: false },
{ id: 'infection_control_statistics_report', name: '感染控制報表', category: '統計報表', defaultChecked: false },
{ id: 'special_care_statistics_report', name: '特別關顧報表', category: '統計報表', defaultChecked: false },
{ id: 'drug_sensitivity_statistics_report', name: '藥物敏感報表', category: '統計報表', defaultChecked: false },
{ id: 'diaper_statistics_report', name: '尿片統計報表', category: '統計報表', defaultChecked: false },
{ id: 'fee_statistics_report', name: '雜費記錄報表', category: '統計報表', defaultChecked: false },
// 排班管理
{ id: 'roster_pre_schedule', name: '假期預排表', category: '排班管理', defaultChecked: true },
{ id: 'roster_schedule', name: '排班表', category: '排班管理', defaultChecked: true }];


const TAB_ORDER: PrintDocumentCategory[] = ['入住文件', '常用表格', '床頭記錄', '統計報表', '排班管理'];

export interface PrintDocumentOptions {
  /** Excel 匯出時，是否按院友分開工作表；false 則全部院友堆在同一張工作表 */
  separateSheetsPerPatient?: boolean;
  /** Excel 匯出時，是否按居住區分開工作表；false 則全部居住區合併在同一張工作表 */
  separateSheetsPerStation?: boolean;
  /** 意外事件報告：指定要列印的報告 ID；若未指定則對每位院友取最近一份 */
  selectedIncidentReportIds?: string[];
  /** 尿片統計報表：指定月份範圍（YYYY-MM）；未指定則預設最近 9 個月 */
  diaperMonthRange?: {startMonth: string;endMonth: string;};
  /** 雜費記錄報表：指定月份（YYYY-MM）；未指定則使用 endDate 所在月份 */
  feeMonth?: string;
  /** 雜費記錄報表：當月無記錄的院友是否跳過不列印 */
  feeSkipEmptyPatients?: boolean;
  /** 排班管理：要列印的部門 */
  rosterDepartments?: string[];
  /** 排班管理：每部門各一份 HTML 或綜合一份 */
  rosterOutputMode?: 'separate' | 'combined';
  /** 排班管理：預排表是否列印累積欄 */
  rosterIncludeBalance?: boolean;
  /** 排班管理：排班表是否列印達標檢查 */
  rosterIncludeCompliance?: boolean;
  /** 排班管理：被勾選的員工 id（只有這些員工會出現在輸出） */
  rosterUserIds?: string[];
  /** 排班管理：列印月份（YYYY-MM），兩份文件統一使用 */
  rosterYearMonth?: string;
}

/** 排班管理 tab 左側員工欄的項目 */
export interface RosterEmployeeItem {
  id: string;
  name: string;
  /** 右側小字（例如職位） */
  detail?: string;
  /** 所屬部門（篩選用） */
  department?: string;
}

interface PatientPrintModalProps {
  patients: Patient[];
  onClose: () => void;
  onPrint: (selectedPatients: Patient[], selectedDocuments: string[], startDate: string, endDate: string, contentMode: PrintContentMode, printOptions?: PrintDocumentOptions) => void;
  initialTab?: PrintDocumentCategory;
  initialSelectedPatientIds?: number[];
  initialSelectedDocumentIds?: string[];
  initialStartDate?: string;
  initialEndDate?: string;
  /** 提供此 prop 才會出現「排班管理」tab，左側欄改為員工勾選 */
  rosterEmployees?: RosterEmployeeItem[];
}

const CONTENT_MODE_OPTIONS: {value: PrintContentMode;label: string;}[] = [
{ value: 'basic', label: '含院友基本資料' },
{ value: 'data', label: '含既有輸入內容' },
{ value: 'blank', label: '空白文件' }];


const PatientPrintModal: React.FC<PatientPrintModalProps> = ({
  patients,
  onClose,
  onPrint,
  initialTab,
  initialSelectedPatientIds,
  initialSelectedDocumentIds,
  initialStartDate,
  initialEndDate,
  rosterEmployees
}) => {
  const [activeTab, setActiveTab] = useState<PrintDocumentCategory>(initialTab ?? '入住文件');
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<number>>(() => {
    const initial = new Set<number>();
    if (initialSelectedPatientIds) {
      initialSelectedPatientIds.forEach((id) => initial.add(id));
    } else if (patients.length === 1) {
      initial.add(patients[0].院友id);
    }
    return initial;
  });
  const [checkedDocuments, setCheckedDocuments] = useState<Set<string>>(() => {
    // 不預設勾選任何文件；只有外部明確指定（initialSelectedDocumentIds）才帶入
    const initial = new Set<string>();
    if (initialSelectedDocumentIds) {
      PRINT_DOCUMENTS.forEach((doc) => {
        if (!doc.disabled && initialSelectedDocumentIds.includes(doc.id)) initial.add(doc.id);
      });
    } else if (initialTab === '排班管理') {
      // 排班管理 tab 依 defaultChecked 預設勾選（此入口無院友文件）
      PRINT_DOCUMENTS.forEach((doc) => {
        if (!doc.disabled && doc.category === '排班管理' && doc.defaultChecked) initial.add(doc.id);
      });
    }
    return initial;
  });

  const today = new Date().toISOString().split('T')[0];
  const defaultStartDate = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 1);
    return d.toISOString().split('T')[0];
  })();
  // 防禦性處理：若外部傳入的初始範圍 start > end，自動對調，避免「預設最近一個月」顯示反了
  const resolvedInitialStart = initialStartDate ?? defaultStartDate;
  const resolvedInitialEnd = initialEndDate ?? today;
  const [startDate, setStartDate] = useState(
    resolvedInitialStart > resolvedInitialEnd ? resolvedInitialEnd : resolvedInitialStart
  );
  const [endDate, setEndDate] = useState(
    resolvedInitialStart > resolvedInitialEnd ? resolvedInitialStart : resolvedInitialEnd
  );
  const [contentMode, setContentMode] = useState<PrintContentMode>('data');
  const [separateSheetsPerPatient, setSeparateSheetsPerPatient] = useState(false);
  const [separateSheetsPerStation, setSeparateSheetsPerStation] = useState(false);
  // 尿片統計報表月份範圍（預設最近 9 個月）
  const currentMonth = today.slice(0, 7);
  const defaultDiaperStartMonth = (() => {
    const d = new Date();
    d.setMonth(d.getMonth() - 8);
    return d.toISOString().slice(0, 7);
  })();
  const [diaperStartMonth, setDiaperStartMonth] = useState(defaultDiaperStartMonth);
  const [diaperEndMonth, setDiaperEndMonth] = useState(currentMonth);
  // 雜費記錄報表月份（預設當月）
  const [feeMonth, setFeeMonth] = useState(currentMonth);
  const [feeSkipEmptyPatients, setFeeSkipEmptyPatients] = useState(false);

  // 排班管理 tab 選項
  const [rosterDepartments, setRosterDepartments] = useState<Set<string>>(() => new Set(ROSTER_PRINT_DEPARTMENTS));
  const [rosterOutputMode, setRosterOutputMode] = useState<'separate' | 'combined'>('combined');
  const [rosterIncludeBalance, setRosterIncludeBalance] = useState(true);
  const [rosterIncludeCompliance, setRosterIncludeCompliance] = useState(false);
  // 排班管理 tab：列印月份（YYYY-MM，預設當月）
  const [rosterYearMonth, setRosterYearMonth] = useState(() => new Date().toISOString().slice(0, 7));
  // 排班管理 tab：員工勾選（預設全選）
  const [employeeSearch, setEmployeeSearch] = useState('');
  const [employeePositionFilter, setEmployeePositionFilter] = useState('');
  const [employeeDepartmentFilter, setEmployeeDepartmentFilter] = useState('');
  const [selectedEmployeeIds, setSelectedEmployeeIds] = useState<Set<string>>(
    () => new Set((rosterEmployees ?? []).map((e) => e.id))
  );

  const [residencyFilter, setResidencyFilter] = useState<string>('');

  const filteredPatients = useMemo(() => {
    return patients.filter((p) => {
      const matchesResidency = !residencyFilter || p.在住狀態 === residencyFilter;
      if (!patientSearch.trim()) return matchesResidency;
      const term = patientSearch.toLowerCase();
      const matchesSearch =
      p.中文姓名 && p.中文姓名.toLowerCase().includes(term) ||
      p.中文姓氏 && p.中文姓氏.toLowerCase().includes(term) ||
      p.中文名字 && p.中文名字.toLowerCase().includes(term) ||
      p.床號 && p.床號.toLowerCase().includes(term);
      return matchesResidency && matchesSearch;
    });
  }, [patients, patientSearch, residencyFilter]);

  const tabDocuments = useMemo(() => PRINT_DOCUMENTS.filter((d) => d.category === activeTab), [activeTab]);

  const togglePatient = (id: number) => {
    const next = new Set(selectedPatientIds);
    if (next.has(id)) next.delete(id);else next.add(id);
    setSelectedPatientIds(next);
  };

  const toggleAllPatients = (checked: boolean) => {
    if (checked) {
      setSelectedPatientIds(new Set(filteredPatients.map((p) => p.院友id)));
    } else {
      setSelectedPatientIds(new Set());
    }
  };

  // 同一時間只能列印一個 tab 的內容：切換 tab 時清空已勾選的文件
  const handleTabChange = (tab: PrintDocumentCategory) => {
    if (tab === activeTab) return;
    setActiveTab(tab);
    setCheckedDocuments(new Set());
  };

  const toggleDocument = (id: string) => {
    const doc = PRINT_DOCUMENTS.find((d) => d.id === id);
    if (doc?.disabled) return;
    const next = new Set(checkedDocuments);
    if (next.has(id)) next.delete(id);else next.add(id);
    setCheckedDocuments(next);
  };

  const toggleAllDocuments = (checked: boolean) => {
    const next = new Set(checkedDocuments);
    tabDocuments.forEach((doc) => {
      if (doc.disabled) return;
      if (checked) next.add(doc.id);else next.delete(doc.id);
    });
    setCheckedDocuments(next);
  };

  const hasVaccinationRecord = checkedDocuments.has('vaccination_record');
  const STATISTICS_REPORT_IDS = new Set([
  'meal_statistics_report',
  'tube_care_statistics_report',
  'infection_control_statistics_report',
  'special_care_statistics_report',
  'drug_sensitivity_statistics_report',
  'diaper_statistics_report']
  );
  const hasStatisticsReport = Array.from(checkedDocuments).some((id) => STATISTICS_REPORT_IDS.has(id));
  const hasDiaperReport = checkedDocuments.has('diaper_statistics_report');
  const hasFeeReport = checkedDocuments.has('fee_statistics_report');

  // 排班管理 tab：院友選擇與日期範圍不適用
  const isRosterTab = activeTab === '排班管理';
  const ROSTER_DOCUMENT_IDS = new Set(['roster_pre_schedule', 'roster_schedule']);
  const hasRosterDoc = Array.from(checkedDocuments).some((id) => ROSTER_DOCUMENT_IDS.has(id));

  const toggleRosterDepartment = (dept: string) => {
    const next = new Set(rosterDepartments);
    if (next.has(dept)) next.delete(dept);else next.add(dept);
    setRosterDepartments(next);
  };

  // 排班管理 tab：員工清單（文字搜尋 + 按職位/部門篩選）
  const employeePositionOptions = useMemo(
    () => Array.from(new Set((rosterEmployees ?? []).map((e) => e.detail).filter((d): d is string => !!d))),
    [rosterEmployees]
  );
  const employeeDepartmentOptions = useMemo(
    () => Array.from(new Set((rosterEmployees ?? []).map((e) => e.department).filter((d): d is string => !!d))),
    [rosterEmployees]
  );
  const filteredEmployees = useMemo(() => {
    const list = rosterEmployees ?? [];
    const term = employeeSearch.trim().toLowerCase();
    return list.filter((e) => {
      if (employeePositionFilter && e.detail !== employeePositionFilter) return false;
      if (employeeDepartmentFilter && e.department !== employeeDepartmentFilter) return false;
      if (!term) return true;
      return e.name.toLowerCase().includes(term) || (e.detail ?? '').toLowerCase().includes(term);
    });
  }, [rosterEmployees, employeeSearch, employeePositionFilter, employeeDepartmentFilter]);

  const toggleEmployee = (id: string) => {
    const next = new Set(selectedEmployeeIds);
    if (next.has(id)) next.delete(id);else next.add(id);
    setSelectedEmployeeIds(next);
  };

  const toggleAllEmployees = (checked: boolean) => {
    if (checked) {
      setSelectedEmployeeIds(new Set(filteredEmployees.map((e) => e.id)));
    } else {
      setSelectedEmployeeIds(new Set());
    }
  };

  const handlePrint = () => {
    const selected = patients.filter((p) => selectedPatientIds.has(p.院友id));
    if (!isRosterTab && selected.length === 0) {
      alert('請先選擇院友');
      return;
    }
    if (checkedDocuments.size === 0) {
      alert('請先勾選文件');
      return;
    }
    if (isRosterTab && rosterDepartments.size === 0) {
      alert('請先勾選部門');
      return;
    }
    if (isRosterTab && selectedEmployeeIds.size === 0) {
      alert('請先勾選員工');
      return;
    }
    // 列印時也確保 startDate 不大於 endDate
    let effectiveStartDate = startDate || selected[0]?.入住日期 || '';
    let effectiveEndDate = endDate;
    if (effectiveStartDate && effectiveEndDate && effectiveStartDate > effectiveEndDate) {
      [effectiveStartDate, effectiveEndDate] = [effectiveEndDate, effectiveStartDate];
    }
    const printOptions: PrintDocumentOptions | undefined = hasVaccinationRecord || hasStatisticsReport || hasFeeReport || hasRosterDoc ?
    {
      separateSheetsPerPatient,
      separateSheetsPerStation,
      ...(hasDiaperReport && diaperStartMonth && diaperEndMonth ?
      { diaperMonthRange: { startMonth: diaperStartMonth, endMonth: diaperEndMonth } } :
      {}),
      ...(hasFeeReport ?
      { feeMonth, feeSkipEmptyPatients } :
      {}),
      ...(hasRosterDoc ?
      {
        rosterDepartments: ROSTER_PRINT_DEPARTMENTS.filter((d) => rosterDepartments.has(d)),
        rosterOutputMode,
        rosterIncludeBalance,
        rosterIncludeCompliance,
        rosterUserIds: (rosterEmployees ?? []).
        map((e) => e.id).
        filter((id) => selectedEmployeeIds.has(id)),
        rosterYearMonth
      } :
      {})
    } :
    undefined;
    onPrint(selected, Array.from(checkedDocuments), effectiveStartDate, effectiveEndDate, contentMode, printOptions);
  };

  const selectedCount = selectedPatientIds.size;
  const checkedCount = checkedDocuments.size;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-4xl max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between p-4 border-b border-gray-200">
          <h2 className="text-xl font-bold text-gray-900">列印綜合文件</h2>
          <button onClick={onClose} className="p-1 hover:bg-gray-100 rounded">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-4 border-b border-gray-200 space-y-3">
          {!isRosterTab &&
          <>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">日期範圍：</label>
                <DateInput

                value={startDate}

                className="form-input text-sm"
                placeholder="入住日期" onChange={(value) => setStartDate(value)} />
              
                <span className="text-sm text-gray-500">至</span>
                <DateInput

                value={endDate}

                className="form-input text-sm" onChange={(value) => setEndDate(value)} />
              
                <span className="text-xs text-gray-500">（預設最近一個月）</span>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">列印內容：</label>
                {CONTENT_MODE_OPTIONS.map((option) =>
              <label key={option.value} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                    <input
                  type="radio"
                  name="print-content-mode"
                  value={option.value}
                  checked={contentMode === option.value}
                  onChange={() => setContentMode(option.value)}
                  className="h-4 w-4" />
                
                    {option.label}
                  </label>
              )}
              </div>
            </>
          }
          {isRosterTab &&
          <>
              <div className="flex items-center gap-3">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">列印月份：</label>
                <input
                type="month"
                value={rosterYearMonth}
                onChange={(e) => setRosterYearMonth(e.target.value)}
                className="form-input text-sm" />
              
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">部門：</label>
                {ROSTER_PRINT_DEPARTMENTS.map((dept) =>
              <label key={dept} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                    <input
                  type="checkbox"
                  checked={rosterDepartments.has(dept)}
                  onChange={() => toggleRosterDepartment(dept)}
                  className="h-4 w-4" />
                
                    {dept}
                  </label>
              )}
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">輸出模式：</label>
                <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                  <input
                  type="radio"
                  name="roster-output-mode"
                  value="separate"
                  checked={rosterOutputMode === 'separate'}
                  onChange={() => setRosterOutputMode('separate')}
                  className="h-4 w-4" />
                
                  每部門各一份 HTML
                </label>
                <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                  <input
                  type="radio"
                  name="roster-output-mode"
                  value="combined"
                  checked={rosterOutputMode === 'combined'}
                  onChange={() => setRosterOutputMode('combined')}
                  className="h-4 w-4" />
                
                  綜合一份 HTML
                </label>
              </div>
              <div className="flex items-center gap-4">
                <label className="text-sm font-medium text-gray-700 whitespace-nowrap">選項：</label>
                <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                  <input
                  type="checkbox"
                  checked={rosterIncludeBalance}
                  onChange={(e) => setRosterIncludeBalance(e.target.checked)}
                  className="h-4 w-4" />
                
                  列印累積欄（預排表）
                </label>
                <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                  <input
                  type="checkbox"
                  checked={rosterIncludeCompliance}
                  onChange={(e) => setRosterIncludeCompliance(e.target.checked)}
                  className="h-4 w-4" />
                
                  列印達標檢查（排班表）
                </label>
              </div>
              <p className="text-xs text-gray-500">兩份文件統一使用「列印月份」的資料；預排表 A4 橫向，排班表 A4 直向。</p>
            </>
          }
          {hasVaccinationRecord &&
          <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Excel 工作表：</label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                <input
                type="checkbox"
                checked={separateSheetsPerPatient}
                onChange={(e) => setSeparateSheetsPerPatient(e.target.checked)}
                className="h-4 w-4" />
              
                按院友分開 sheet
              </label>
            </div>
          }
          {hasStatisticsReport &&
          <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">統計報表工作表：</label>
              <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                <input
                type="checkbox"
                checked={separateSheetsPerStation}
                onChange={(e) => setSeparateSheetsPerStation(e.target.checked)}
                className="h-4 w-4" />
              
                按居住區分開 sheet
              </label>
            </div>
          }
          {hasDiaperReport &&
          <div className="flex items-center gap-3">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">尿片統計月份：</label>
              <input
              type="month"
              value={diaperStartMonth}
              onChange={(e) => setDiaperStartMonth(e.target.value)}
              className="form-input text-sm" />
            
              <span className="text-sm text-gray-500">至</span>
              <input
              type="month"
              value={diaperEndMonth}
              onChange={(e) => setDiaperEndMonth(e.target.value)}
              className="form-input text-sm" />
            
              <span className="text-xs text-gray-500">（預設最近 9 個月，可指定任何月份）</span>
            </div>
          }
          {hasFeeReport &&
          <div className="flex items-center gap-4">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">雜費記錄月份：</label>
              <input
              type="month"
              value={feeMonth}
              onChange={(e) => setFeeMonth(e.target.value)}
              className="form-input text-sm" />
            
              <label className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                <input
                type="checkbox"
                checked={feeSkipEmptyPatients}
                onChange={(e) => setFeeSkipEmptyPatients(e.target.checked)}
                className="h-4 w-4" />
              
                跳過當月無記錄院友
              </label>
            </div>
          }
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* 左側：院友選擇（排班管理 tab 改為員工選擇） */}
          {!isRosterTab &&
          <div className="lg:w-1/3 border-r border-gray-200 flex flex-col">
            <div className="p-3 border-b border-gray-200 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索院友..."
                  value={patientSearch}
                  onChange={(e) => setPatientSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded" />
                
              </div>
              <select
                value={residencyFilter}
                onChange={(e) => setResidencyFilter(e.target.value)}
                className="w-full text-sm border border-gray-300 rounded py-2 px-3">
                
                <option value="">全部在住狀態</option>
                <option value="在住">在住</option>
                <option value="待入住">待入住</option>
                <option value="已退住">已退住</option>
              </select>
            </div>
            <div className="p-3 border-b border-gray-200 flex items-center gap-2 text-sm">
              <button onClick={() => toggleAllPatients(true)} className="text-blue-600 hover:underline">全選</button>
              <span className="text-gray-400">|</span>
              <button onClick={() => toggleAllPatients(false)} className="text-blue-600 hover:underline">取消全選</button>
              <span className="ml-auto text-gray-500">已選 {selectedCount} 人</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredPatients.map((patient) =>
              <label key={patient.院友id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                  type="checkbox"
                  checked={selectedPatientIds.has(patient.院友id)}
                  onChange={() => togglePatient(patient.院友id)}
                  className="h-4 w-4" />
                
                  <span className="text-sm">{patient.中文姓名 || `${patient.中文姓氏}${patient.中文名字}`}</span>
                  <BedNumberImprint patient={patient} size="sm" className="text-xs text-gray-500 ml-auto" />
                </label>
              )}
            </div>
          </div>
          }
          {isRosterTab &&
          <div className="lg:w-1/3 border-r border-gray-200 flex flex-col">
            <div className="p-3 border-b border-gray-200 space-y-2">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索員工..."
                  value={employeeSearch}
                  onChange={(e) => setEmployeeSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded" />
                
              </div>
              <div className="flex gap-2">
                <select
                  value={employeePositionFilter}
                  onChange={(e) => setEmployeePositionFilter(e.target.value)}
                  className="flex-1 text-sm border border-gray-300 rounded py-2 px-3">
                  
                  <option value="">全部職位</option>
                  {employeePositionOptions.map((p) =>
                  <option key={p} value={p}>{p}</option>
                  )}
                </select>
                <select
                  value={employeeDepartmentFilter}
                  onChange={(e) => setEmployeeDepartmentFilter(e.target.value)}
                  className="flex-1 text-sm border border-gray-300 rounded py-2 px-3">
                  
                  <option value="">全部部門</option>
                  {employeeDepartmentOptions.map((d) =>
                  <option key={d} value={d}>{d}</option>
                  )}
                </select>
              </div>
            </div>
            <div className="p-3 border-b border-gray-200 flex items-center gap-2 text-sm">
              <button onClick={() => toggleAllEmployees(true)} className="text-blue-600 hover:underline">全選</button>
              <span className="text-gray-400">|</span>
              <button onClick={() => toggleAllEmployees(false)} className="text-blue-600 hover:underline">取消全選</button>
              <span className="ml-auto text-gray-500">已選 {selectedEmployeeIds.size} 人</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredEmployees.map((employee) =>
              <label key={employee.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                  type="checkbox"
                  checked={selectedEmployeeIds.has(employee.id)}
                  onChange={() => toggleEmployee(employee.id)}
                  className="h-4 w-4" />
                
                  <span className="text-sm">{employee.name}</span>
                  {employee.detail && <span className="text-xs text-gray-500 ml-auto">{employee.detail}</span>}
                </label>
              )}
            </div>
          </div>
          }

          {/* 右側：文件選擇 */}
          <div className="flex-1 flex flex-col">
            <div className="border-b border-gray-200">
              <div className="flex">
                {TAB_ORDER.filter((tab) => tab !== '排班管理' || rosterEmployees).map((tab) =>
                <button
                  key={tab}
                  onClick={() => handleTabChange(tab)}
                  className={`px-6 py-3 text-sm font-medium border-b-2 ${
                  activeTab === tab ?
                  'border-blue-600 text-blue-600' :
                  'border-transparent text-gray-600 hover:text-gray-900'}`
                  }>
                  
                    {tab}
                  </button>
                )}
              </div>
            </div>

            <div className="p-3 border-b border-gray-200 flex items-center gap-2 text-sm">
              <button onClick={() => toggleAllDocuments(true)} className="text-blue-600 hover:underline">全選</button>
              <span className="text-gray-400">|</span>
              <button onClick={() => toggleAllDocuments(false)} className="text-blue-600 hover:underline">取消全選</button>
              <span className="ml-auto text-gray-500">已選 {checkedCount} 份文件</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {tabDocuments.map((doc, index) =>
              <label
                key={doc.id}
                className={`flex items-center gap-2 p-2 rounded ${
                doc.disabled ?
                'text-gray-400 cursor-not-allowed' :
                'hover:bg-gray-50 cursor-pointer'}`
                }
                title={doc.disabled ? doc.disabledHint : undefined}>
                
                  <input
                  type="checkbox"
                  checked={checkedDocuments.has(doc.id)}
                  onChange={() => !doc.disabled && toggleDocument(doc.id)}
                  disabled={doc.disabled}
                  className="h-4 w-4 disabled:opacity-50" />
                
                  <span className="text-sm">
                    {index + 1}. {doc.name}
                    {doc.disabled && doc.disabledHint &&
                  <span className="ml-1 text-xs text-gray-400">（{doc.disabledHint}）</span>
                  }
                  </span>
                </label>
              )}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary px-4 py-2">取消</button>
          <button
            onClick={handlePrint}
            disabled={isRosterTab ? checkedCount === 0 || rosterDepartments.size === 0 || selectedEmployeeIds.size === 0 : selectedCount === 0 || checkedCount === 0}
            className="btn-primary flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed">
            
            <Printer className="h-4 w-4" />
            {isRosterTab ? '列印' : `列印 (${selectedCount} 位院友)`}
          </button>
        </div>
      </div>
    </div>);

};

export default PatientPrintModal;