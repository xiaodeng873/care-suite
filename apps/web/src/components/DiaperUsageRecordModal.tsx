import React, { useState, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { X, Layers, RefreshCw, Download } from 'lucide-react';
import { usePatientData } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';
import * as db from '../lib/database';
import type { DiaperUsageRecord } from '../lib/database';
import { DIAPER_CHANGE_SLOTS } from '../utils/careRecordHelper';
import { daysInMonth, generateMonthGrid, getSlotAbsence, diaperRecordSkipReason } from '../utils/diaperUsageGenerator';
import type { DiaperUsageGrid } from '../utils/diaperUsageGenerator';

interface DiaperUsageRecordModalProps {
  record?: DiaperUsageRecord;      // 編輯既有記錄
  copyFrom?: DiaperUsageRecord;    // 另存新檔（複製欄位，新增一筆）
  onClose: () => void;
  onSaved: () => void;
}

// 本地可編輯格：允許空字串（清除），儲存/插入時空值視為 0
type EditableGrid = Record<string, Record<string, { urine: number | ''; core: number | '' }>>;

const toEditable = (grid?: DiaperUsageGrid): EditableGrid => {
  const out: EditableGrid = {};
  if (!grid) return out;
  for (const [date, slots] of Object.entries(grid)) {
    out[date] = {};
    for (const [slot, cell] of Object.entries(slots)) {
      out[date][slot] = { urine: cell.urine, core: cell.core };
    }
  }
  return out;
};

const toStored = (grid: EditableGrid): DiaperUsageGrid => {
  const out: DiaperUsageGrid = {};
  for (const [date, slots] of Object.entries(grid)) {
    out[date] = {};
    for (const [slot, cell] of Object.entries(slots)) {
      out[date][slot] = { urine: cell.urine === '' ? 0 : cell.urine, core: cell.core === '' ? 0 : cell.core };
    }
  }
  return out;
};

const DiaperUsageRecordModal: React.FC<DiaperUsageRecordModalProps> = ({ record, copyFrom, onClose, onSaved }) => {
  const { patients, admissionRecords, hospitalEpisodes } = usePatientData();
  const source = record || copyFrom;
  const now = new Date();

  const [patientId, setPatientId] = useState<string>(source ? String(source.patient_id) : '');
  const [yearMonth, setYearMonth] = useState<string>(
    record ? `${record.year}-${String(record.month).padStart(2, '0')}`
      : `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`
  );
  const [monthlyDiaper, setMonthlyDiaper] = useState<string>(source?.monthly_diaper_estimate != null ? String(source.monthly_diaper_estimate) : '');
  const [monthlyCore, setMonthlyCore] = useState<string>(source?.monthly_core_estimate != null ? String(source.monthly_core_estimate) : '');
  const [minDiaper, setMinDiaper] = useState<string>(source?.daily_min_diaper != null ? String(source.daily_min_diaper) : '0');
  const [maxDiaper, setMaxDiaper] = useState<string>(source?.daily_max_diaper != null ? String(source.daily_max_diaper) : '');
  const [minCore, setMinCore] = useState<string>(source?.daily_min_core != null ? String(source.daily_min_core) : '0');
  const [maxCore, setMaxCore] = useState<string>(source?.daily_max_core != null ? String(source.daily_max_core) : '');
  const [pcMinDiaper, setPcMinDiaper] = useState<string>(source?.per_change_min_diaper != null ? String(source.per_change_min_diaper) : '0');
  const [pcMaxDiaper, setPcMaxDiaper] = useState<string>(source?.per_change_max_diaper != null ? String(source.per_change_max_diaper) : '');
  const [pcMinCore, setPcMinCore] = useState<string>(source?.per_change_min_core != null ? String(source.per_change_min_core) : '0');
  const [pcMaxCore, setPcMaxCore] = useState<string>(source?.per_change_max_core != null ? String(source.per_change_max_core) : '');
  const [grid, setGrid] = useState<EditableGrid>(() => toEditable(record?.generated_data));
  const [existingSlots, setExistingSlots] = useState<Map<string, string | null> | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isInserting, setIsInserting] = useState(false);
  const [validationError, setValidationError] = useState('');

  const patient = useMemo(
    () => patients.find(p => p.院友id === Number(patientId)),
    [patients, patientId]
  );

  const { year, month } = useMemo(() => {
    const [y, m] = yearMonth.split('-').map(Number);
    return { year: y || now.getFullYear(), month: m || (now.getMonth() + 1) };
  }, [yearMonth]);

  const monthDays = daysInMonth(year, month);
  const dailyAvgDiaper = monthlyDiaper && Number(monthlyDiaper) > 0 ? (Number(monthlyDiaper) / monthDays).toFixed(1) : '-';
  const dailyAvgCore = monthlyCore && Number(monthlyCore) > 0 ? (Number(monthlyCore) / monthDays).toFixed(1) : '-';

  // 生成合計與每月估算的偏差
  const generatedTotals = useMemo(() => {
    let urine = 0;
    let core = 0;
    for (const slots of Object.values(grid)) {
      for (const cell of Object.values(slots)) {
        urine += cell.urine === '' ? 0 : cell.urine;
        core += cell.core === '' ? 0 : cell.core;
      }
    }
    return { urine, core };
  }, [grid]);

  const diffLabel = (total: number, monthly: string): string => {
    const m = Number(monthly);
    if (!monthly || m <= 0) return '（無每月估算）';
    const pct = Math.round(((total - m) / m) * 100);
    return `（較每月估算 ${pct >= 0 ? '+' : ''}${pct}%）`;
  };

  const monthDates = useMemo(
    () => Array.from({ length: monthDays }, (_, i) =>
      `${year}-${String(month).padStart(2, '0')}-${String(i + 1).padStart(2, '0')}`),
    [year, month, monthDays]
  );

  const absenceOf = (date: string, slotTime: string) =>
    patient ? getSlotAbsence(patient, date, slotTime, admissionRecords as any, hospitalEpisodes as any) : null;

  // 該月真實換片記錄：date|slot -> 記錄本身的跳過原因（無則為 null，表示可生成）
  const recordSkipReason = diaperRecordSkipReason;

  const loadExistingSlots = async (): Promise<Map<string, string | null>> => {
    const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
    const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(monthDays).padStart(2, '0')}`;
    const all = await db.getDiaperChangeRecordsInDateRange(monthStart, monthEnd);
    const map = new Map<string, string | null>(
      all.filter(r => r.patient_id === Number(patientId))
        .map(r => [`${r.change_date}|${r.time_slot}`, recordSkipReason(r)] as const)
    );
    setExistingSlots(map);
    return map;
  };

  // 院友/年月改變時預載（供表格灰列顯示）
  React.useEffect(() => {
    setExistingSlots(null);
    if (patientId && yearMonth) {
      loadExistingSlots().catch(err => console.error('載入換片記錄失敗:', err));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [patientId, yearMonth]);

  /** 跳過原因：入院/渡假（episodes）、記錄備註事件、無大小便，或該時段無真實換片記錄 */
  const skipReasonOf = (date: string, slotTime: string): string | null => {
    const absence = absenceOf(date, slotTime);
    if (absence) return absence;
    if (existingSlots) {
      const key = `${date}|${slotTime}`;
      if (!existingSlots.has(key)) return '無記錄';
      return existingSlots.get(key) ?? null;
    }
    return null;
  };

  const hasGrid = Object.keys(grid).length > 0;

  const validateBase = (): string => {
    if (!patientId) return '請選擇院友';
    if (!yearMonth) return '請選擇年月';
    if (maxDiaper !== '' && Number(maxDiaper) < Number(minDiaper || 0)) return '每日最多尿片不可少於每日最少尿片';
    if (maxCore !== '' && Number(maxCore) < Number(minCore || 0)) return '每日最多片芯不可少於每日最少片芯';
    if (pcMaxDiaper !== '' && Number(pcMaxDiaper) < Number(pcMinDiaper || 0)) return '每次換片最多尿片不可少於最少尿片';
    if (pcMaxCore !== '' && Number(pcMaxCore) < Number(pcMinCore || 0)) return '每次換片最多片芯不可少於最少片芯';
    return '';
  };

  const handleGenerate = async () => {
    const err = validateBase();
    if (err) { setValidationError(err); return; }
    if (!monthlyDiaper && !monthlyCore) { setValidationError('請輸入估計每月尿片或片芯使用量'); return; }
    setValidationError('');
    // 重新拉一次，確保用最新真實換片記錄判斷跳過
    let slots = existingSlots;
    try {
      slots = await loadExistingSlots();
    } catch (e) {
      console.error('載入換片記錄失敗:', e);
      setValidationError('載入換片記錄失敗，請重試');
      return;
    }
    if (slots.size === 0) {
      setValidationError(`${year}年${month}月沒有該院友的換片記錄，無法生成（請先在床頭記錄建立換片記錄）`);
      setGrid({});
      return;
    }
    const generated = generateMonthGrid({
      year,
      month,
      monthlyDiaper: Number(monthlyDiaper) || 0,
      monthlyCore: Number(monthlyCore) || 0,
      dailyMinDiaper: Number(minDiaper) || 0,
      dailyMaxDiaper: maxDiaper === '' ? Number.MAX_SAFE_INTEGER : Number(maxDiaper),
      dailyMinCore: Number(minCore) || 0,
      dailyMaxCore: maxCore === '' ? Number.MAX_SAFE_INTEGER : Number(maxCore),
      perChangeMinDiaper: pcMinDiaper === '' ? 0 : Number(pcMinDiaper),
      perChangeMaxDiaper: pcMaxDiaper === '' ? undefined : Number(pcMaxDiaper),
      perChangeMinCore: pcMinCore === '' ? 0 : Number(pcMinCore),
      perChangeMaxCore: pcMaxCore === '' ? undefined : Number(pcMaxCore),
      absenceCheck: (date, slotTime) => {
        const absence = absenceOf(date, slotTime);
        if (absence) return absence;
        const key = `${date}|${slotTime}`;
        if (!slots!.has(key)) return '無記錄';
        return slots!.get(key) ?? null;
      },
    });
    setGrid(toEditable(generated));
  };

  const updateCell = (date: string, slot: string, field: 'urine' | 'core', value: string) => {
    const num = value === '' ? '' : Math.max(0, parseInt(value, 10) || 0);
    setGrid(prev => {
      const existing = prev[date]?.[slot] || { urine: 0 as number | '', core: 0 as number | '' };
      return {
        ...prev,
        [date]: {
          ...(prev[date] || {}),
          [slot]: { ...existing, [field]: num },
        },
      };
    });
  };

  const buildPayload = () => ({
    patient_id: Number(patientId),
    year,
    month,
    monthly_diaper_estimate: monthlyDiaper === '' ? null : Number(monthlyDiaper),
    monthly_core_estimate: monthlyCore === '' ? null : Number(monthlyCore),
    daily_min_diaper: minDiaper === '' ? 0 : Number(minDiaper),
    daily_max_diaper: maxDiaper === '' ? null : Number(maxDiaper),
    daily_min_core: minCore === '' ? 0 : Number(minCore),
    daily_max_core: maxCore === '' ? null : Number(maxCore),
    per_change_min_diaper: pcMinDiaper === '' ? 0 : Number(pcMinDiaper),
    per_change_max_diaper: pcMaxDiaper === '' ? null : Number(pcMaxDiaper),
    per_change_min_core: pcMinCore === '' ? 0 : Number(pcMinCore),
    per_change_max_core: pcMaxCore === '' ? null : Number(pcMaxCore),
    generated_data: toStored(grid),
  });

  const handleSave = async () => {
    const err = validateBase();
    if (err) { setValidationError(err); return; }
    setValidationError('');
    setIsSaving(true);
    try {
      const payload = buildPayload();
      if (record) {
        await db.updateDiaperUsageRecord({ ...record, ...payload });
      } else {
        await db.createDiaperUsageRecord(payload);
      }
      onSaved();
    } catch (error: any) {
      console.error('儲存尿片記錄失敗:', error);
      if (error?.code === '23505' || String(error?.message || '').includes('duplicate')) {
        setValidationError('該院友此月份的尿片記錄已存在');
      } else {
        setValidationError('儲存失敗，請重試');
      }
    } finally {
      setIsSaving(false);
    }
  };

  // 插入床頭記錄：只覆蓋已存在真實換片記錄的尿片/片芯數，無記錄時段與缺席時段跳過
  const handleInsertToCareRecords = async () => {
    const err = validateBase();
    if (err) { setValidationError(err); return; }
    if (!hasGrid) { setValidationError('請先按「生成」產生數據'); return; }
    if (!confirm(`確定把 ${year}年${month}月 的虛擬數據插入床頭記錄嗎？\n\n已存在的真實換片記錄之尿片/片芯數會被覆蓋（無記錄的時段會跳過）。`)) return;
    setValidationError('');
    setIsInserting(true);
    try {
      const monthStart = `${year}-${String(month).padStart(2, '0')}-01`;
      const monthEnd = `${year}-${String(month).padStart(2, '0')}-${String(monthDays).padStart(2, '0')}`;
      const all = await db.getDiaperChangeRecordsInDateRange(monthStart, monthEnd);
      const existing = new Map(
        all.filter(r => r.patient_id === Number(patientId))
          .map(r => [`${r.change_date}|${r.time_slot}`, r] as const)
      );
      const stored = toStored(grid);
      let updated = 0;
      let skipped = 0;
      let skippedNotApplicable = 0;
      for (const [date, slots] of Object.entries(stored)) {
        for (const [slot, cell] of Object.entries(slots)) {
          const target = existing.get(`${date}|${slot}`);
          if (!target) { skipped++; continue; }
          // 事件備註（入院/渡假/外出）或無大小便的記錄不覆蓋
          if (recordSkipReason(target)) { skippedNotApplicable++; continue; }
          await db.updateDiaperChangeRecord({ ...target, urine_count: cell.urine, core_count: cell.core });
          updated++;
        }
      }
      alert(`插入完成：已更新 ${updated} 筆真實換片記錄；跳過 ${skipped} 個無記錄時段、${skippedNotApplicable} 個無大小便/事件時段。`);
    } catch (error) {
      console.error('插入床頭記錄失敗:', error);
      alert('插入床頭記錄失敗，請重試');
    } finally {
      setIsInserting(false);
    }
  };

  const patientLocked = !!source;

  return createPortal(
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-5xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between z-10">
          <div className="flex items-center space-x-3">
            <div className="p-2 bg-blue-100 rounded-lg">
              <Layers className="h-6 w-6 text-blue-600" />
            </div>
            <h2 className="text-xl font-bold text-gray-900">
              {record ? '編輯尿片記錄' : '新增尿片記錄'}
            </h2>
          </div>
          <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="p-6 space-y-6">
          {validationError && (
            <div className="bg-red-50 border border-red-200 text-red-700 px-4 py-3 rounded-lg text-sm">
              {validationError}
            </div>
          )}

          {/* 基本資料 */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">院友 *</label>
              {patientLocked ? (
                <div className="form-input bg-gray-50">
                  {patient ? `${patient.床號} - ${patient.中文姓名}` : `院友ID: ${patientId}`}
                </div>
              ) : (
                <PatientAutocomplete
                  value={patientId}
                  onChange={(id) => setPatientId(id)}
                  placeholder="搜尋院友..."
                  showResidencyFilter={true}
                  defaultResidencyStatus="在住"
                />
              )}
            </div>
            <div>
              <label className="form-label">年月 *</label>
              <input
                type="month"
                value={yearMonth}
                onChange={(e) => setYearMonth(e.target.value)}
                className="form-input"
              />
            </div>
          </div>

          {/* 估算設定 */}
          <div className="bg-blue-50 rounded-lg p-4 space-y-4">
            <h3 className="text-base font-medium text-gray-900">用量估算</h3>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label className="form-label">估計每月尿片使用量</label>
                <input type="number" min="0" value={monthlyDiaper} onChange={(e) => setMonthlyDiaper(e.target.value)} className="form-input" placeholder="例如 120" />
              </div>
              <div>
                <label className="form-label">估計每月片芯使用量</label>
                <input type="number" min="0" value={monthlyCore} onChange={(e) => setMonthlyCore(e.target.value)} className="form-input" placeholder="例如 60" />
              </div>
              <div>
                <label className="form-label">每日尿片（最少 - 最多）</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={minDiaper} onChange={(e) => setMinDiaper(e.target.value)} className="form-input" placeholder="0" />
                  <span className="text-gray-500">至</span>
                  <input type="number" min="0" value={maxDiaper} onChange={(e) => setMaxDiaper(e.target.value)} className="form-input" placeholder="例如 6" />
                </div>
              </div>
              <div>
                <label className="form-label">每日片芯（最少 - 最多）</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={minCore} onChange={(e) => setMinCore(e.target.value)} className="form-input" placeholder="0" />
                  <span className="text-gray-500">至</span>
                  <input type="number" min="0" value={maxCore} onChange={(e) => setMaxCore(e.target.value)} className="form-input" placeholder="例如 4" />
                </div>
              </div>
              <div>
                <label className="form-label">每次尿片（最少 - 最多）</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={pcMinDiaper} onChange={(e) => setPcMinDiaper(e.target.value)} className="form-input" placeholder="0" />
                  <span className="text-gray-500">至</span>
                  <input type="number" min="0" value={pcMaxDiaper} onChange={(e) => setPcMaxDiaper(e.target.value)} className="form-input" placeholder="例如 2" />
                </div>
              </div>
              <div>
                <label className="form-label">每次片芯（最少 - 最多）</label>
                <div className="flex items-center gap-2">
                  <input type="number" min="0" value={pcMinCore} onChange={(e) => setPcMinCore(e.target.value)} className="form-input" placeholder="0" />
                  <span className="text-gray-500">至</span>
                  <input type="number" min="0" value={pcMaxCore} onChange={(e) => setPcMaxCore(e.target.value)} className="form-input" placeholder="例如 1" />
                </div>
              </div>
            </div>
            <div className="text-sm text-gray-700">
              {year}年{month}月共 {monthDays} 日；估計每天使用量：尿片 <span className="font-medium">{dailyAvgDiaper}</span> 條、片芯 <span className="font-medium">{dailyAvgCore}</span> 條
            </div>
            {hasGrid && (
              <div className="text-sm text-gray-700">
                本次生成合計：尿片 <span className="font-medium">{generatedTotals.urine}</span> 條{diffLabel(generatedTotals.urine, monthlyDiaper)}、片芯 <span className="font-medium">{generatedTotals.core}</span> 條{diffLabel(generatedTotals.core, monthlyCore)}
              </div>
            )}
            <div className="flex flex-wrap gap-2">
              <button
                type="button"
                onClick={handleGenerate}
                className="btn-secondary flex items-center gap-2"
              >
                <RefreshCw className="h-4 w-4" />
                <span>{hasGrid ? '再生成' : '生成'}</span>
              </button>
              <button
                type="button"
                onClick={handleInsertToCareRecords}
                disabled={!hasGrid || isInserting}
                className="btn-primary flex items-center gap-2 disabled:opacity-50"
              >
                <Download className="h-4 w-4" />
                <span>{isInserting ? '插入中…' : '插入床頭記錄'}</span>
              </button>
            </div>
          </div>

          {/* 虛擬數據表 */}
          {hasGrid && (
            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-4 py-2 text-sm font-medium text-gray-700">
                虛擬數據表（可手調；灰列為入院/渡假/無記錄/無大小便，已跳過生成）
              </div>
              <div className="max-h-96 overflow-y-auto">
                <table className="w-full divide-y divide-gray-200 text-sm">
                  <thead className="bg-gray-50 sticky top-0">
                    <tr>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">日期</th>
                      <th className="px-3 py-2 text-left text-xs font-medium text-gray-500">時段</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-24">尿片</th>
                      <th className="px-3 py-2 text-center text-xs font-medium text-gray-500 w-24">片芯</th>
                    </tr>
                  </thead>
                  <tbody className="bg-white divide-y divide-gray-100">
                    {monthDates.map(date => {
                      const slotRows = DIAPER_CHANGE_SLOTS.map(slot => {
                        const skipReason = skipReasonOf(date, slot.time);
                        const cell = grid[date]?.[slot.time];
                        return { slot, skipReason, cell };
                      });
                      // 整日跳過：仍顯示灰列
                      return slotRows.map(({ slot, skipReason, cell }, idx) => (
                        <tr key={`${date}-${slot.time}`} className={skipReason ? 'bg-gray-100 text-gray-400' : ''}>
                          {idx === 0 && (
                            <td rowSpan={slotRows.length} className="px-3 py-2 whitespace-nowrap align-middle border-r border-gray-100">
                              {month}/{date.split('-')[2]}
                            </td>
                          )}
                          <td className="px-3 py-1.5 whitespace-nowrap">{slot.label}</td>
                          {skipReason ? (
                            <td colSpan={2} className="px-3 py-1.5 text-center text-xs">{skipReason}</td>
                          ) : (
                            <>
                              <td className="px-3 py-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  value={cell?.urine ?? ''}
                                  onChange={(e) => updateCell(date, slot.time, 'urine', e.target.value)}
                                  className="form-input w-full text-center py-1"
                                />
                              </td>
                              <td className="px-3 py-1.5">
                                <input
                                  type="number"
                                  min="0"
                                  value={cell?.core ?? ''}
                                  onChange={(e) => updateCell(date, slot.time, 'core', e.target.value)}
                                  className="form-input w-full text-center py-1"
                                />
                              </td>
                            </>
                          )}
                        </tr>
                      ));
                    })}
                  </tbody>
                </table>
              </div>
            </div>
          )}

          {/* 操作按鈕 */}
          <div className="flex justify-end gap-3 pt-2 border-t border-gray-200">
            <button type="button" onClick={onClose} className="btn-secondary">
              取消
            </button>
            <button
              type="button"
              onClick={handleSave}
              disabled={isSaving}
              className="btn-primary disabled:opacity-50"
            >
              {isSaving ? '儲存中…' : '儲存'}
            </button>
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
};

export default DiaperUsageRecordModal;
