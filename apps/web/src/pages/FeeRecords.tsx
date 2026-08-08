import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  Receipt,
  Plus,
  Printer,
  Settings,
  Trash2,
  ChevronUp,
  ChevronDown,
  Loader2,
} from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { LoadingScreen } from '../components/PageLoadingScreen';
import BedNumberImprint from '../components/BedNumberImprint';
import PatientAutocomplete from '../components/PatientAutocomplete';
import FeeItemsModal from '../components/FeeItemsModal';
import PatientPrintModal, { type PrintDocumentCategory, type PrintDocumentOptions } from '../components/PatientPrintModal';
import {
  getMedicationSettings,
  getMedicationSettingsFromDB,
  type MedicationSettingsData,
} from '../utils/medicationSettings';
import {
  type Patient,
  type FeeItem,
  type PatientFeeRecord,
  type UserProfile,
  getFeeItems,
  getPatientFeeRecordsInDateRange,
  getUserProfiles,
  createPatientFeeRecord,
  updatePatientFeeRecord,
  deletePatientFeeRecord,
  carryForwardRecurringFeeRecordsForPatient,
} from '../lib/database';
import type { PrintContentMode } from '../utils/patientPrintBundleGenerator';

type SortField =
  | 'record_date'
  | 'item_name'
  | 'quantity'
  | 'unit_price'
  | 'amount'
  | 'is_recurring';
type SortDirection = 'asc' | 'desc';

interface DraftRow {
  localId: string;
  id?: string;
  patient_id: number;
  fee_item_id?: string | null;
  code: string;
  record_date: string;
  start_time: string;
  end_time: string;
  item_name: string;
  item_category: string;
  unit: string;
  unit_price: string;
  quantity: string;
  amount: string;
  is_recurring: boolean;
  notes: string;
  isSaving?: boolean;
  error?: string;
}

const getCurrentMonth = (): string => {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
};

const getLastDayOfMonth = (yearMonth: string): string => {
  const [year, month] = yearMonth.split('-').map(Number);
  const lastDay = new Date(year, month, 0).getDate();
  return `${yearMonth}-${String(lastDay).padStart(2, '0')}`;
};

const formatMoney = (value: number): string => {
  return `$${Number(value).toLocaleString('zh-HK', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  })}`;
};

const computeAmount = (unitPrice: string, quantity: string): string => {
  const p = Number(unitPrice);
  const q = Number(quantity);
  if (Number.isNaN(p) || Number.isNaN(q)) return '';
  return String(Number((p * q).toFixed(2)));
};

/** 根據開始與結束時間計算小時數，不足一小時以實際分鐘數計算（不進位） */
const computeHoursFromTimes = (startTime: string, endTime: string): string => {
  if (!startTime || !endTime) return '';
  const [startH, startM] = startTime.split(':').map(Number);
  const [endH, endM] = endTime.split(':').map(Number);
  if (Number.isNaN(startH) || Number.isNaN(startM) || Number.isNaN(endH) || Number.isNaN(endM)) return '';
  const startMinutes = startH * 60 + startM;
  const endMinutes = endH * 60 + endM;
  if (endMinutes <= startMinutes) return '';
  const diffHours = (endMinutes - startMinutes) / 60;
  return String(Number(diffHours.toFixed(2)));
};

const createBlankRow = (patientId: number, selectedMonth: string): DraftRow => ({
  localId: `new-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
  patient_id: patientId,
  fee_item_id: null,
  code: '',
  record_date: `${selectedMonth}-01`,
  start_time: '',
  end_time: '',
  item_name: '',
  item_category: '',
  unit: '',
  unit_price: '',
  quantity: '1',
  amount: '',
  is_recurring: false,
  notes: '',
});

const recordsToDrafts = (
  records: PatientFeeRecord[],
  feeItems: FeeItem[],
  patientId: number,
  yearMonth: string
): DraftRow[] =>
  records
    .filter(r => r.patient_id === patientId && r.record_date.startsWith(yearMonth))
    .map(record => {
      const feeItem = record.fee_item_id
        ? feeItems.find(item => item.id === record.fee_item_id)
        : undefined;
      return {
        localId: record.id,
        id: record.id,
        patient_id: record.patient_id,
        fee_item_id: record.fee_item_id,
        code: feeItem?.code || '',
        record_date: record.record_date,
        start_time: record.start_time || '',
        end_time: record.end_time || '',
        item_name: record.item_name,
        item_category: record.item_category,
        unit: record.unit,
        unit_price: String(record.unit_price),
        quantity: String(record.quantity),
        amount: String(record.amount),
        is_recurring: record.is_recurring,
        notes: record.notes || '',
      };
    });

const FeeRecords: React.FC = () => {
  const { patients } = usePatients();

  const [selectedMonth, setSelectedMonth] = useState<string>(getCurrentMonth());
  const [selectedPatientId, setSelectedPatientId] = useState<number | undefined>(undefined);
  const [feeItems, setFeeItems] = useState<FeeItem[]>([]);
  const [userProfiles, setUserProfiles] = useState<UserProfile[]>([]);
  const [medicationSettings, setMedicationSettings] = useState<MedicationSettingsData>(getMedicationSettings);
  const [records, setRecords] = useState<PatientFeeRecord[]>([]);
  const [drafts, setDrafts] = useState<DraftRow[]>([]);
  const [loading, setLoading] = useState<boolean>(false);
  const [showItemsModal, setShowItemsModal] = useState<boolean>(false);
  const [printModalOpen, setPrintModalOpen] = useState<boolean>(false);
  const [openNoteDropdown, setOpenNoteDropdown] = useState<string | null>(null);

  const [sortField, setSortField] = useState<SortField>('record_date');
  const [sortDirection, setSortDirection] = useState<SortDirection>('asc');

  const rowRefs = useRef<Record<string, HTMLTableRowElement | null>>({});
  const inputRefs = useRef<Record<string, HTMLInputElement | HTMLSelectElement | null>>({});
  const saveTimeoutsRef = useRef<Record<string, number>>({});
  const draftsRef = useRef<DraftRow[]>([]);

  const selectedPatient = useMemo(
    () => patients.find(p => p.院友id === selectedPatientId),
    [patients, selectedPatientId]
  );

  const assistantNames = useMemo(
    () =>
      userProfiles
        .filter(p => p.hygiene_position === '清潔員')
        .map(p => p.name_zh)
        .filter(Boolean),
    [userProfiles]
  );

  const nurseNames = useMemo(
    () =>
      userProfiles
        .filter(p => p.nursing_position === '護理員')
        .map(p => p.name_zh)
        .filter(Boolean),
    [userProfiles]
  );

  const hospitalNames = useMemo(
    () => medicationSettings?.['機構_醫管局醫院'] || [],
    [medicationSettings]
  );

  const staffOptions = useMemo(() => [...assistantNames, ...nurseNames], [assistantNames, nurseNames]);

  useEffect(() => {
    if (patients.length === 1 && !selectedPatientId) {
      setSelectedPatientId(patients[0].院友id);
    }
  }, [patients, selectedPatientId]);

  const loadData = async () => {
    if (!selectedPatientId) return;
    setLoading(true);
    try {
      const [year, month] = selectedMonth.split('-').map(Number);
      const prevDate = new Date(year, month - 2, 1);
      const prevStart = `${prevDate.getFullYear()}-${String(prevDate.getMonth() + 1).padStart(2, '0')}-01`;
      const targetEnd = getLastDayOfMonth(selectedMonth);

      const [items, fetchedRecords, profiles, medSettings] = await Promise.all([
        getFeeItems(),
        getPatientFeeRecordsInDateRange(prevStart, targetEnd),
        getUserProfiles(),
        getMedicationSettingsFromDB().catch(() => getMedicationSettings()),
      ]);

      setUserProfiles(profiles);
      setMedicationSettings(medSettings);

      // 只對當前或未來月份自動帶入上月的常駐項目；過去月份不主動帶入
      const currentMonth = getCurrentMonth();
      const targetRecords = fetchedRecords.filter(
        r => r.patient_id === selectedPatientId && r.record_date.startsWith(selectedMonth)
      );
      const prevRecurring = fetchedRecords.filter(
        r =>
          r.patient_id === selectedPatientId &&
          r.record_date >= prevStart &&
          r.record_date < `${selectedMonth}-01` &&
          r.is_recurring
      );

      console.log('[FeeRecords loadData]', {
        selectedMonth,
        currentMonth,
        isFutureOrCurrent: selectedMonth >= currentMonth,
        targetRecordsCount: targetRecords.length,
        prevRecurringCount: prevRecurring.length,
        prevRecurring: prevRecurring.map(r => ({ id: r.id, item_name: r.item_name, record_date: r.record_date })),
      });

      let finalRecords = fetchedRecords;
      if (selectedMonth >= currentMonth && prevRecurring.length > 0) {
        const carried = await carryForwardRecurringFeeRecordsForPatient(selectedPatientId, year, month);
        console.log('[FeeRecords loadData] carried forward:', carried.length, carried.map(r => r.item_name));
        finalRecords = await getPatientFeeRecordsInDateRange(prevStart, targetEnd);
      }

      setFeeItems(items);
      setRecords(finalRecords);
      const nextDrafts = recordsToDrafts(finalRecords, items, selectedPatientId, selectedMonth);
      setDrafts(nextDrafts);
      draftsRef.current = nextDrafts;
    } catch (error) {
      console.error('載入雜費記錄失敗:', error);
      alert('載入雜費記錄失敗，請重試');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    return () => {
      // 切換月份或院友前，強制儲存所有排程中未儲存的變更
      const pendingIds = Object.keys(saveTimeoutsRef.current);
      for (const localId of pendingIds) {
        window.clearTimeout(saveTimeoutsRef.current[localId]);
        delete saveTimeoutsRef.current[localId];
      }
      for (const localId of pendingIds) {
        saveRow(localId);
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedMonth, selectedPatientId]);

  const handleSort = (field: SortField) => {
    if (sortField === field) {
      setSortDirection(sortDirection === 'asc' ? 'desc' : 'asc');
    } else {
      setSortField(field);
      setSortDirection('asc');
    }
  };

  const sortedDrafts = useMemo(() => {
    return [...drafts].sort((a, b) => {
      let valueA: number | string;
      let valueB: number | string;

      switch (sortField) {
        case 'record_date':
          valueA = a.record_date;
          valueB = b.record_date;
          break;
        case 'item_name':
          valueA = a.item_name.toLowerCase();
          valueB = b.item_name.toLowerCase();
          break;
        case 'quantity':
          valueA = Number(a.quantity);
          valueB = Number(b.quantity);
          break;
        case 'unit_price':
          valueA = Number(a.unit_price);
          valueB = Number(b.unit_price);
          break;
        case 'amount':
          valueA = Number(a.amount);
          valueB = Number(b.amount);
          break;
        case 'is_recurring':
          valueA = a.is_recurring ? 1 : 0;
          valueB = b.is_recurring ? 1 : 0;
          break;
        default:
          valueA = a.record_date;
          valueB = b.record_date;
      }

      if (typeof valueA === 'number' && typeof valueB === 'number') {
        return sortDirection === 'asc' ? valueA - valueB : valueB - valueA;
      }

      return sortDirection === 'asc'
        ? String(valueA).localeCompare(String(valueB))
        : String(valueB).localeCompare(String(valueA));
    });
  }, [drafts, sortField, sortDirection]);

  const updateDraft = (localId: string, updates: Partial<DraftRow>) => {
    setDrafts(prev => {
      const next = prev.map(d => (d.localId === localId ? { ...d, ...updates } : d));
      draftsRef.current = next;
      return next;
    });
  };

  const validateRow = (row: DraftRow): string | null => {
    if (!row.record_date) return '請選擇日期';
    if (!row.item_name.trim()) return '請輸入項目名稱';
    const qty = Number(row.quantity);
    if (row.quantity.trim() === '' || Number.isNaN(qty) || qty <= 0) return '數量必須大於 0';
    const price = Number(row.unit_price);
    if (row.unit_price.trim() === '' || Number.isNaN(price)) return '請輸入有效單價';
    const amount = Number(row.amount);
    if (row.amount.trim() === '' || Number.isNaN(amount)) return '請輸入有效金額';
    return null;
  };

  const syncRowFromRecord = (localId: string, record: PatientFeeRecord): DraftRow[] => {
    const next = draftsRef.current.map(d =>
      d.localId === localId
        ? {
            ...d,
            id: record.id,
            patient_id: record.patient_id,
            fee_item_id: record.fee_item_id,
            record_date: record.record_date,
            start_time: record.start_time || '',
            end_time: record.end_time || '',
            item_name: record.item_name,
            item_category: record.item_category,
            unit: record.unit,
            unit_price: String(record.unit_price),
            quantity: String(record.quantity),
            amount: String(record.amount),
            is_recurring: record.is_recurring,
            notes: record.notes || '',
            isSaving: false,
            error: undefined,
          }
        : d
    );
    draftsRef.current = next;
    setDrafts(next);
    return next;
  };

  const saveRow = async (localId: string) => {
    const latestRow = draftsRef.current.find(d => d.localId === localId);
    if (!latestRow) return;

    const error = validateRow(latestRow);
    if (error) {
      updateDraft(localId, { error });
      return;
    }

    updateDraft(localId, { isSaving: true, error: undefined });

    try {
      const payload = {
        patient_id: latestRow.patient_id,
        fee_item_id: latestRow.fee_item_id || null,
        record_date: latestRow.record_date,
        start_time: latestRow.start_time.trim() || null,
        end_time: latestRow.end_time.trim() || null,
        item_name: latestRow.item_name.trim(),
        item_category: latestRow.item_category.trim(),
        unit: latestRow.unit.trim(),
        unit_price: Number(latestRow.unit_price),
        quantity: Number(latestRow.quantity),
        amount: Number(latestRow.amount),
        is_recurring: latestRow.is_recurring,
        notes: latestRow.notes.trim() || null,
      };

      if (latestRow.id) {
        const updated = await updatePatientFeeRecord({
          ...records.find(r => r.id === latestRow.id)!,
          ...payload,
        });
        setRecords(prev => prev.map(r => (r.id === updated.id ? updated : r)));
        syncRowFromRecord(localId, updated);
      } else {
        const created = await createPatientFeeRecord(payload);
        setRecords(prev => [...prev, created]);
        syncRowFromRecord(localId, created);
      }
    } catch (err) {
      console.error('儲存雜費記錄失敗:', err);
      updateDraft(localId, { isSaving: false, error: '儲存失敗' });
    }
  };

  const scheduleSave = (localId: string) => {
    if (saveTimeoutsRef.current[localId]) {
      window.clearTimeout(saveTimeoutsRef.current[localId]);
    }
    saveTimeoutsRef.current[localId] = window.setTimeout(() => {
      const rowEl = rowRefs.current[localId];
      const active = document.activeElement;
      if (rowEl && active && rowEl.contains(active)) return;
      saveRow(localId);
    }, 150);
  };

  const handleFocus = (localId: string) => {
    if (saveTimeoutsRef.current[localId]) {
      window.clearTimeout(saveTimeoutsRef.current[localId]);
      delete saveTimeoutsRef.current[localId];
    }
  };

  const handleItemNameChange = (row: DraftRow, value: string) => {
    const trimmed = value.trim();
    const matched = feeItems.find(
      item => item.name_zh.toLowerCase() === trimmed.toLowerCase()
    );
    if (matched) {
      updateDraft(row.localId, {
        item_name: matched.name_zh,
        code: matched.code,
        fee_item_id: matched.id,
        item_category: matched.category,
        unit: matched.unit,
        unit_price: String(matched.unit_price),
        amount: computeAmount(String(matched.unit_price), row.quantity),
      });
    } else {
      updateDraft(row.localId, {
        item_name: trimmed,
        code: '',
        fee_item_id: null,
      });
    }
    scheduleSave(row.localId);
  };

  const handleQuantityChange = (row: DraftRow, value: string) => {
    updateDraft(row.localId, {
      quantity: value,
      amount: computeAmount(row.unit_price, value),
    });
    scheduleSave(row.localId);
  };

  const handleUnitPriceChange = (row: DraftRow, value: string) => {
    updateDraft(row.localId, {
      unit_price: value,
      amount: computeAmount(value, row.quantity),
    });
    scheduleSave(row.localId);
  };

  const handleAmountChange = (row: DraftRow, value: string) => {
    updateDraft(row.localId, { amount: value });
    scheduleSave(row.localId);
  };

  const handleTimeChange = (row: DraftRow, field: 'start_time' | 'end_time', value: string) => {
    const updates: Partial<DraftRow> = { [field]: value };
    const otherField = field === 'start_time' ? 'end_time' : 'start_time';
    const otherValue = row[otherField];
    if (row.unit === '小時' && value && otherValue) {
      const hours = computeHoursFromTimes(
        field === 'start_time' ? value : otherValue,
        field === 'end_time' ? value : otherValue
      );
      if (hours) {
        updates.quantity = hours;
        updates.amount = computeAmount(row.unit_price, hours);
      }
    }
    updateDraft(row.localId, updates);
    scheduleSave(row.localId);
  };

  const handleAddRow = () => {
    if (!selectedPatientId) return;
    const newRow = createBlankRow(selectedPatientId, selectedMonth);
    setDrafts(prev => {
      const next = [...prev, newRow];
      draftsRef.current = next;
      return next;
    });
    window.setTimeout(() => {
      inputRefs.current[`${newRow.localId}-record_date`]?.focus();
    }, 0);
  };

  const handleDelete = async (row: DraftRow) => {
    if (!window.confirm(`確定要刪除「${row.item_name || row.code || '此項目'}」嗎？`)) {
      return;
    }
    if (row.id) {
      try {
        await deletePatientFeeRecord(row.id);
      } catch (err) {
        console.error('刪除雜費記錄失敗:', err);
        alert('刪除失敗，請重試');
        return;
      }
    }
    setDrafts(prev => {
      const next = prev.filter(d => d.localId !== row.localId);
      draftsRef.current = next;
      return next;
    });
  };

  const handlePrint = () => {
    setPrintModalOpen(true);
  };

  const handlePrintBundle = async (
    selectedPatients: Patient[],
    selectedDocuments: string[],
    startDate: string,
    endDate: string,
    contentMode: PrintContentMode,
    printOptions?: PrintDocumentOptions
  ) => {
    const { generatePatientPrintBundle } = await import('../utils/patientPrintBundleGenerator');
    await generatePatientPrintBundle({
      patients: selectedPatients,
      documentIds: selectedDocuments,
      startDate,
      endDate,
      contentMode,
      printOptions,
    });
  };

  const SortableHeader: React.FC<{
    field: SortField;
    children: React.ReactNode;
    className?: string;
  }> = ({ field, children, className = '' }) => (
    <th
      className={`px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider cursor-pointer hover:bg-gray-100 select-none ${className}`}
      onClick={() => handleSort(field)}
    >
      <div className="flex items-center space-x-1">
        <span>{children}</span>
        {sortField === field &&
          (sortDirection === 'asc' ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />)}
      </div>
    </th>
  );

  const inputClass = (hasError?: boolean) =>
    `form-input text-sm py-1 px-2 w-full ${hasError ? 'border-red-500' : ''}`;

  if (loading && records.length === 0 && feeItems.length === 0) {
    return <LoadingScreen pageName="雜費記錄" />;
  }

  return (
    <div className="space-y-6">
      <div className="sticky top-0 bg-white z-30 py-4 border-b border-gray-200 shadow-sm">
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between gap-3">
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-2xl font-bold text-gray-900">雜費記錄</h1>
            <input
              type="month"
              value={selectedMonth}
              onChange={(e) => setSelectedMonth(e.target.value)}
              className="form-input w-40"
            />
            <div className="w-64">
              <PatientAutocomplete
                value={selectedPatientId?.toString() || ''}
                onChange={(patientIdStr) =>
                  setSelectedPatientId(patientIdStr ? Number(patientIdStr) : undefined)
                }
                placeholder="選擇院友..."
                showResidencyFilter={true}
                defaultResidencyStatus="全部"
              />
            </div>  
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setShowItemsModal(true)}
              className="btn-secondary flex items-center gap-2"
            >
              <Settings className="h-4 w-4" />
              <span>管理雜費項目</span>
            </button>
            <button
              onClick={handlePrint}
              className="btn-primary flex items-center gap-2"
            >
              <Printer className="h-4 w-4" />
              <span>列印</span>
            </button>
            <button
              onClick={handleAddRow}
              disabled={!selectedPatientId || loading}
              className="btn-primary flex items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Plus className="h-4 w-4" />
              <span>新增雜費</span>
            </button>
          </div>
        </div>
      </div>

      {!selectedPatientId ? (
        <div className="card p-12 text-center">
          <Receipt className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">請選擇院友</h3>
          <p className="mt-1 text-sm text-gray-500">選擇院友後即可編輯該月份的費用明細</p>
        </div>
      ) : (
        <div className="card overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1200px] divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <SortableHeader field="record_date" className="w-36">
                    日期
                  </SortableHeader>
                  <SortableHeader field="item_name" className="w-56">
                    項目名稱
                  </SortableHeader>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    開始時間
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-28">
                    結束時間
                  </th>
                  <SortableHeader field="quantity" className="w-24">
                    數量
                  </SortableHeader>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-24">
                    單位
                  </th>
                  <SortableHeader field="unit_price" className="w-28">
                    單價
                  </SortableHeader>
                  <SortableHeader field="amount" className="w-28">
                    金額
                  </SortableHeader>
                  <SortableHeader field="is_recurring" className="w-20">
                    常駐
                  </SortableHeader>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-40">
                    備註
                  </th>
                  <th className="px-3 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider w-20">
                    操作
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {sortedDrafts.length === 0 && !loading && (
                  <tr>
                    <td colSpan={11} className="px-4 py-12 text-center text-gray-500">
                      <Receipt className="mx-auto h-10 w-10 text-gray-300 mb-2" />
                      沒有雜費記錄，點擊「新增雜費」開始
                    </td>
                  </tr>
                )}
                {sortedDrafts.map((row, rowIndex) => {
                  const isLastRow = rowIndex === sortedDrafts.length - 1;
                  const error = row.error;
                  return (
                    <tr
                      key={row.localId}
                      ref={(el) => (rowRefs.current[row.localId] = el)}
                      className={`${error ? 'bg-red-50' : ''} ${row.isSaving ? 'opacity-60' : ''}`}
                    >
                      <td className="px-2 py-2 align-top">
                        <input
                          ref={(el) => (inputRefs.current[`${row.localId}-record_date`] = el)}
                          type="date"
                          value={row.record_date}
                          onChange={(e) => updateDraft(row.localId, { record_date: e.target.value })}
                          onBlur={() => scheduleSave(row.localId)}
                          onFocus={() => handleFocus(row.localId)}
                          className={inputClass(!!error && !row.record_date)}
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          ref={(el) => (inputRefs.current[`${row.localId}-item_name`] = el)}
                          type="text"
                          value={row.item_name}
                          list="fee-item-datalist"
                          onChange={(e) => handleItemNameChange(row, e.target.value)}
                          onBlur={() => scheduleSave(row.localId)}
                          onFocus={() => handleFocus(row.localId)}
                          className={inputClass(!!error && !row.item_name.trim())}
                          placeholder="項目名稱"
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          ref={(el) => (inputRefs.current[`${row.localId}-start_time`] = el)}
                          type="time"
                          value={row.start_time}
                          onChange={(e) => handleTimeChange(row, 'start_time', e.target.value)}
                          onBlur={() => scheduleSave(row.localId)}
                          onFocus={() => handleFocus(row.localId)}
                          disabled={row.unit !== '小時'}
                          className={inputClass(false)}
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          ref={(el) => (inputRefs.current[`${row.localId}-end_time`] = el)}
                          type="time"
                          value={row.end_time}
                          onChange={(e) => handleTimeChange(row, 'end_time', e.target.value)}
                          onBlur={() => scheduleSave(row.localId)}
                          onFocus={() => handleFocus(row.localId)}
                          disabled={row.unit !== '小時'}
                          className={inputClass(false)}
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          ref={(el) => (inputRefs.current[`${row.localId}-quantity`] = el)}
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.quantity}
                          onChange={(e) => handleQuantityChange(row, e.target.value)}
                          onBlur={() => scheduleSave(row.localId)}
                          onFocus={() => handleFocus(row.localId)}
                          className={inputClass(
                            !!error &&
                              (row.quantity.trim() === '' ||
                                Number.isNaN(Number(row.quantity)) ||
                                Number(row.quantity) <= 0)
                          )}
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          ref={(el) => (inputRefs.current[`${row.localId}-unit`] = el)}
                          type="text"
                          value={row.unit}
                          onChange={(e) => updateDraft(row.localId, { unit: e.target.value })}
                          onBlur={() => scheduleSave(row.localId)}
                          onFocus={() => handleFocus(row.localId)}
                          className={inputClass()}
                          placeholder="單位"
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          ref={(el) => (inputRefs.current[`${row.localId}-unit_price`] = el)}
                          type="number"
                          step="0.01"
                          min="0"
                          value={row.unit_price}
                          onChange={(e) => handleUnitPriceChange(row, e.target.value)}
                          onBlur={() => scheduleSave(row.localId)}
                          onFocus={() => handleFocus(row.localId)}
                          className={inputClass(
                            !!error &&
                              (row.unit_price.trim() === '' || Number.isNaN(Number(row.unit_price)))
                          )}
                          placeholder="單價"
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          ref={(el) => (inputRefs.current[`${row.localId}-amount`] = el)}
                          type="number"
                          step="0.01"
                          value={row.amount}
                          onChange={(e) => handleAmountChange(row, e.target.value)}
                          onBlur={() => scheduleSave(row.localId)}
                          onFocus={() => handleFocus(row.localId)}
                          className={inputClass(
                            !!error && (row.amount.trim() === '' || Number.isNaN(Number(row.amount)))
                          )}
                          placeholder="金額"
                        />
                      </td>
                      <td className="px-2 py-2 align-top">
                        <input
                          ref={(el) => (inputRefs.current[`${row.localId}-is_recurring`] = el)}
                          type="checkbox"
                          checked={row.is_recurring}
                          onChange={(e) => {
                            updateDraft(row.localId, { is_recurring: e.target.checked });
                            // 「常駐」勾選即自動儲存，不需要額外按儲存鍵
                            handleFocus(row.localId);
                            window.setTimeout(() => {
                              saveRow(row.localId);
                            }, 0);
                          }}
                          onFocus={() => handleFocus(row.localId)}
                          className="w-5 h-5 rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                        />
                      </td>
                      <td className="px-2 py-2 align-top relative">
                        <div className="relative flex items-center">
                          <input
                            ref={(el) => (inputRefs.current[`${row.localId}-notes`] = el)}
                            type="text"
                            value={row.notes}
                            onChange={(e) => updateDraft(row.localId, { notes: e.target.value })}
                            onBlur={() => {
                              setOpenNoteDropdown(null);
                              scheduleSave(row.localId);
                            }}
                            onFocus={() => {
                              handleFocus(row.localId);
                              setOpenNoteDropdown(row.localId);
                            }}
                            onKeyDown={(e) => {
                              if (e.key === 'Tab' && !e.shiftKey && isLastRow) {
                                e.preventDefault();
                                handleAddRow();
                              }
                              if (e.key === 'Escape') {
                                setOpenNoteDropdown(null);
                              }
                            }}
                            className={inputClass()}
                            placeholder="選擇助理員/護理員/醫院或輸入備註"
                          />
                          <button
                            type="button"
                            tabIndex={-1}
                            onMouseDown={(e) => {
                              e.preventDefault();
                              setOpenNoteDropdown(openNoteDropdown === row.localId ? null : row.localId);
                              inputRefs.current[`${row.localId}-notes`]?.focus();
                            }}
                            className="absolute right-1 p-1 text-gray-400 hover:text-gray-600"
                          >
                            <ChevronDown className="h-4 w-4" />
                          </button>
                        </div>
                        {openNoteDropdown === row.localId && (
                          <div className="absolute z-50 left-2 right-2 mt-1 bg-white border border-gray-200 rounded-lg shadow-lg max-h-60 overflow-y-auto">
                            <div className="p-2 border-b border-gray-100">
                              <div className="text-xs font-semibold text-blue-700 mb-1">助理員及護理員</div>
                              {staffOptions.length === 0 ? (
                                <div className="text-xs text-gray-400 py-1">無資料</div>
                              ) : (
                                staffOptions.map(name => (
                                  <div
                                    key={name}
                                    className="text-sm px-2 py-1 hover:bg-blue-50 cursor-pointer rounded"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      updateDraft(row.localId, { notes: name });
                                      setOpenNoteDropdown(null);
                                      scheduleSave(row.localId);
                                    }}
                                  >
                                    {name}
                                  </div>
                                ))
                              )}
                            </div>
                            <div className="p-2">
                              <div className="text-xs font-semibold text-green-700 mb-1">醫管局所有醫院</div>
                              {hospitalNames.length === 0 ? (
                                <div className="text-xs text-gray-400 py-1">無資料</div>
                              ) : (
                                hospitalNames.map(name => (
                                  <div
                                    key={name}
                                    className="text-sm px-2 py-1 hover:bg-green-50 cursor-pointer rounded"
                                    onMouseDown={(e) => {
                                      e.preventDefault();
                                      updateDraft(row.localId, { notes: name });
                                      setOpenNoteDropdown(null);
                                      scheduleSave(row.localId);
                                    }}
                                  >
                                    {name}
                                  </div>
                                ))
                              )}
                            </div>
                          </div>
                        )}
                      </td>
                      <td className="px-2 py-2 align-top">
                        <div className="flex items-center gap-2">
                          {row.isSaving && <Loader2 className="h-4 w-4 animate-spin text-blue-600" />}
                          <button
                            onClick={() => handleDelete(row)}
                            className="p-1.5 text-red-600 hover:bg-red-50 rounded"
                            title="刪除"
                          >
                            <Trash2 className="h-4 w-4" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
          {sortedDrafts.length > 0 && (
            <div className="px-4 py-3 border-t border-gray-200 bg-gray-50 flex items-center justify-between">
              <span className="text-sm text-gray-600">共 {sortedDrafts.length} 筆</span>
              <span className="text-sm font-medium text-gray-900">
                合計：
                {formatMoney(
                  sortedDrafts.reduce((sum, row) => sum + (Number(row.amount) || 0), 0)
                )}
              </span>
            </div>
          )}
          <datalist id="fee-item-datalist">
            {feeItems.map(item => (
              <option key={item.id} value={item.name_zh} />
            ))}
          </datalist>
        </div>
      )}

      {showItemsModal && <FeeItemsModal onClose={() => setShowItemsModal(false)} />}
      {printModalOpen && (
        <PatientPrintModal
          patients={patients.filter(p => p.在住狀態 === '在住')}
          onClose={() => setPrintModalOpen(false)}
          onPrint={handlePrintBundle}
          initialTab="統計報表"
          initialSelectedDocumentIds={['fee_statistics_report']}
          initialSelectedPatientIds={selectedPatientId ? [selectedPatientId] : patients.filter(p => p.在住狀態 === '在住').map(p => p.院友id)}
          initialStartDate={(() => { const d = new Date(); d.setMonth(d.getMonth() - 1); return d.toISOString().split('T')[0]; })()}
          initialEndDate={new Date().toISOString().split('T')[0]}
        />
      )}
    </div>
  );
};

export default FeeRecords;
