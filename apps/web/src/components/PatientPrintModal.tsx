import React, { useState, useMemo } from 'react';
import { X, Search, Printer } from 'lucide-react';
import type { Patient } from '../lib/database';
import type { PrintContentMode } from '../utils/patientPrintBundleGenerator';

export type PrintDocumentCategory = '入住文件' | '常用表格';

export interface PrintDocumentOption {
  id: string;
  name: string;
  category: PrintDocumentCategory;
  defaultChecked: boolean;
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
  { id: 'temperature_record', name: '院友體溫記錄', category: '常用表格', defaultChecked: false },
  { id: 'bodyweight_record', name: '院友體重記錄', category: '常用表格', defaultChecked: false },
  { id: 'blood_sugar_record', name: '院友血糖記錄', category: '常用表格', defaultChecked: false },
  { id: 'nursing_treatment', name: '護理及治療記錄', category: '常用表格', defaultChecked: true },
  { id: 'wound_assessment', name: '傷口評估記錄表', category: '常用表格', defaultChecked: false },
  { id: 'restraint_usage_common', name: '使用約束物品紀錄', category: '常用表格', defaultChecked: false },
  { id: 'restraint_consent', name: '使用約束措施的評估及同意書', category: '常用表格', defaultChecked: false },
  { id: 'medication_proxy', name: '要求院舍派發成藥確認書', category: '常用表格', defaultChecked: false },
  { id: 'self_medication', name: '自行存放及使用藥物同意書', category: '常用表格', defaultChecked: false },
];

interface PatientPrintModalProps {
  patients: Patient[];
  onClose: () => void;
  onPrint: (selectedPatients: Patient[], selectedDocuments: string[], startDate: string, endDate: string, contentMode: PrintContentMode) => void;
}

const CONTENT_MODE_OPTIONS: { value: PrintContentMode; label: string }[] = [
  { value: 'basic', label: '含院友基本資料' },
  { value: 'data', label: '含既有輸入內容' },
  { value: 'blank', label: '空白文件' },
];

const PatientPrintModal: React.FC<PatientPrintModalProps> = ({ patients, onClose, onPrint }) => {
  const [activeTab, setActiveTab] = useState<PrintDocumentCategory>('入住文件');
  const [patientSearch, setPatientSearch] = useState('');
  const [selectedPatientIds, setSelectedPatientIds] = useState<Set<number>>(new Set());
  const [checkedDocuments, setCheckedDocuments] = useState<Set<string>>(() => {
    const initial = new Set<string>();
    PRINT_DOCUMENTS.forEach(doc => {
      if (doc.defaultChecked) initial.add(doc.id);
    });
    return initial;
  });

  const today = new Date().toISOString().split('T')[0];
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState(today);
  const [contentMode, setContentMode] = useState<PrintContentMode>('data');

  const filteredPatients = useMemo(() => {
    if (!patientSearch.trim()) return patients;
    const term = patientSearch.toLowerCase();
    return patients.filter(p =>
      (p.中文姓名 && p.中文姓名.toLowerCase().includes(term)) ||
      (p.中文姓氏 && p.中文姓氏.toLowerCase().includes(term)) ||
      (p.中文名字 && p.中文名字.toLowerCase().includes(term)) ||
      (p.床號 && p.床號.toLowerCase().includes(term))
    );
  }, [patients, patientSearch]);

  const tabDocuments = useMemo(() => PRINT_DOCUMENTS.filter(d => d.category === activeTab), [activeTab]);

  const togglePatient = (id: number) => {
    const next = new Set(selectedPatientIds);
    if (next.has(id)) next.delete(id); else next.add(id);
    setSelectedPatientIds(next);
  };

  const toggleAllPatients = (checked: boolean) => {
    if (checked) {
      setSelectedPatientIds(new Set(filteredPatients.map(p => p.院友id)));
    } else {
      setSelectedPatientIds(new Set());
    }
  };

  const toggleDocument = (id: string) => {
    const next = new Set(checkedDocuments);
    if (next.has(id)) next.delete(id); else next.add(id);
    setCheckedDocuments(next);
  };

  const toggleAllDocuments = (checked: boolean) => {
    const next = new Set(checkedDocuments);
    tabDocuments.forEach(doc => {
      if (checked) next.add(doc.id); else next.delete(doc.id);
    });
    setCheckedDocuments(next);
  };

  const handlePrint = () => {
    const selected = patients.filter(p => selectedPatientIds.has(p.院友id));
    if (selected.length === 0) {
      alert('請先選擇院友');
      return;
    }
    if (checkedDocuments.size === 0) {
      alert('請先勾選文件');
      return;
    }
    const effectiveStartDate = startDate || selected[0]?.入住日期 || '';
    onPrint(selected, Array.from(checkedDocuments), effectiveStartDate, endDate, contentMode);
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
          <div className="flex items-center gap-3">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">日期範圍：</label>
            <input
              type="date"
              value={startDate}
              onChange={e => setStartDate(e.target.value)}
              className="form-input text-sm"
              placeholder="入住日期"
            />
            <span className="text-sm text-gray-500">至</span>
            <input
              type="date"
              value={endDate}
              onChange={e => setEndDate(e.target.value)}
              className="form-input text-sm"
            />
            <span className="text-xs text-gray-500">（預設由入住日起至當日）</span>
          </div>
          <div className="flex items-center gap-4">
            <label className="text-sm font-medium text-gray-700 whitespace-nowrap">列印內容：</label>
            {CONTENT_MODE_OPTIONS.map(option => (
              <label key={option.value} className="flex items-center gap-1.5 text-sm text-gray-700 cursor-pointer">
                <input
                  type="radio"
                  name="print-content-mode"
                  value={option.value}
                  checked={contentMode === option.value}
                  onChange={() => setContentMode(option.value)}
                  className="h-4 w-4"
                />
                {option.label}
              </label>
            ))}
          </div>
        </div>

        <div className="flex-1 overflow-hidden flex flex-col lg:flex-row">
          {/* 左側：院友選擇 */}
          <div className="lg:w-1/3 border-r border-gray-200 flex flex-col">
            <div className="p-3 border-b border-gray-200">
              <div className="relative">
                <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="搜索院友..."
                  value={patientSearch}
                  onChange={e => setPatientSearch(e.target.value)}
                  className="w-full pl-9 pr-3 py-2 text-sm border border-gray-300 rounded"
                />
              </div>
            </div>
            <div className="p-3 border-b border-gray-200 flex items-center gap-2 text-sm">
              <button onClick={() => toggleAllPatients(true)} className="text-blue-600 hover:underline">全選</button>
              <span className="text-gray-400">|</span>
              <button onClick={() => toggleAllPatients(false)} className="text-blue-600 hover:underline">取消全選</button>
              <span className="ml-auto text-gray-500">已選 {selectedCount} 人</span>
            </div>
            <div className="flex-1 overflow-y-auto p-2">
              {filteredPatients.map(patient => (
                <label key={patient.院友id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={selectedPatientIds.has(patient.院友id)}
                    onChange={() => togglePatient(patient.院友id)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">{patient.中文姓名 || `${patient.中文姓氏}${patient.中文名字}`}</span>
                  <span className="text-xs text-gray-500 ml-auto">{patient.床號}</span>
                </label>
              ))}
            </div>
          </div>

          {/* 右側：文件選擇 */}
          <div className="flex-1 flex flex-col">
            <div className="border-b border-gray-200">
              <div className="flex">
                {(['入住文件', '常用表格'] as PrintDocumentCategory[]).map(tab => (
                  <button
                    key={tab}
                    onClick={() => setActiveTab(tab)}
                    className={`px-6 py-3 text-sm font-medium border-b-2 ${
                      activeTab === tab
                        ? 'border-blue-600 text-blue-600'
                        : 'border-transparent text-gray-600 hover:text-gray-900'
                    }`}
                  >
                    {tab}
                  </button>
                ))}
              </div>
            </div>

            <div className="p-3 border-b border-gray-200 flex items-center gap-2 text-sm">
              <button onClick={() => toggleAllDocuments(true)} className="text-blue-600 hover:underline">全選</button>
              <span className="text-gray-400">|</span>
              <button onClick={() => toggleAllDocuments(false)} className="text-blue-600 hover:underline">取消全選</button>
              <span className="ml-auto text-gray-500">已選 {checkedCount} 份文件</span>
            </div>

            <div className="flex-1 overflow-y-auto p-3">
              {tabDocuments.map((doc, index) => (
                <label key={doc.id} className="flex items-center gap-2 p-2 hover:bg-gray-50 rounded cursor-pointer">
                  <input
                    type="checkbox"
                    checked={checkedDocuments.has(doc.id)}
                    onChange={() => toggleDocument(doc.id)}
                    className="h-4 w-4"
                  />
                  <span className="text-sm">{index + 1}. {doc.name}</span>
                </label>
              ))}
            </div>
          </div>
        </div>

        <div className="p-4 border-t border-gray-200 flex justify-end gap-3">
          <button onClick={onClose} className="btn-secondary px-4 py-2">取消</button>
          <button
            onClick={handlePrint}
            disabled={selectedCount === 0 || checkedCount === 0}
            className="btn-primary flex items-center gap-2 px-4 py-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Printer className="h-4 w-4" />
            列印 ({selectedCount} 位院友)
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientPrintModal;
