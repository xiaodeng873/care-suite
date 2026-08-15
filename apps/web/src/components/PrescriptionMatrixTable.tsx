import React from 'react';
import { formatDisplayDate } from '../utils/dateFormat';
import { getMedicationSettings } from '../utils/medicationSettings';

/**
 * 處方矩陣表格（唯讀）：
 * Y 軸 = 藥物（每張處方一行，首欄凍結）
 * X 軸 = 處方 Modal 所有控制項，表頭統一 2 字簡寫，內容簡約化
 *
 * 顯示規則（同用戶約定）：
 * - 日期一律 DD/MM/YYYY（必須有年份），不列時間；本專案時間顯示一律 HH:MM
 * - 次數/頻率用 QD、BD、TDS、QID；隔1天 QOD，隔N天 Q{N}D，隔N週 Q{N}W，隔N月 Q{N}M
 * - 劑型、時段不簡化
 * - 來源/專科優先用藥物設定嘅英文簡稱（如 CGAT、KWH），無簡稱先至用中文簡寫
 */

/** DD/MM/YYYY（必須有年份），無值顯示 — */
const shortDate = (v: unknown): string => {
  const s = formatDisplayDate(v as string | undefined);
  return s || '—';
};

const QD_MAP: Record<number, string> = { 1: 'QD', 2: 'BD', 3: 'TDS', 4: 'QID' };

/** 每日次數碼：QD / BD / TDS / QID，其他顯示 N次 */
const dailyCode = (n: number): string => QD_MAP[n] || `${n}次`;

/** 頻率碼：每日照次數碼；隔1天 QOD、隔N天 Q{N}D、隔N週 Q{N}W、隔N月 Q{N}M */
const freqCode = (p: any): string => {
  const slots = p.medication_time_slots?.length || 0;
  const n = Number(p.frequency_value) || 0;
  switch (p.frequency_type) {
    case 'daily':
      return slots ? dailyCode(slots) : dailyCode(p.daily_frequency || 1);
    case 'every_x_days':
      return n <= 1 ? 'QOD' : `Q${n}D`;
    case 'every_x_weeks':
      return `Q${n}W`;
    case 'every_x_months':
      return `Q${n}M`;
    case 'weekly_days': {
      const dayNames = ['一', '二', '三', '四', '五', '六', '日'];
      const days = (p.specific_weekdays || [])
        .map((d: number) => dayNames[d === 7 ? 0 : d])
        .join('');
      return days ? `逢${days}` : '逢星期';
    }
    case 'odd_even_days':
      return p.is_odd_even_day === 'odd' ? '單日' : p.is_odd_even_day === 'even' ? '雙日' : '單雙日';
    case 'hourly':
      return `Q${n}H`;
    default:
      return slots ? dailyCode(slots) : '—';
  }
};

/** 來源顯示：優先藥物設定嘅英文簡稱；無簡稱就去「醫院/診所/中心」字尾（廣華醫院→廣華） */
const sourceText = (v: string | undefined, abbrs: Record<string, string>): string => {
  if (!v) return '—';
  if (abbrs[v]) return abbrs[v];
  if (v === '醫管局') return '醫局';
  return v.replace(/(醫院|診所|醫務所|醫療中心|中心)$/, '');
};

/** 專科顯示：優先藥物設定嘅英文簡稱（如 CGAT），否則原字 */
const specialtyText = (v: string | undefined, abbrs: Record<string, string>): string => {
  if (!v) return '—';
  return abbrs[v] || v;
};

const PREPARATION_MAP: Record<string, string> = {
  immediate: '即時',
  advanced: '提前',
  custom: '自理',
};

/** 份量 + 單位（純數字先合併單位） */
const dosageText = (p: any): string => {
  if (p.dosage_amount === undefined || p.dosage_amount === null || p.dosage_amount === '') return '—';
  return /^\d+(\.\d+)?$/.test(String(p.dosage_amount))
    ? `${p.dosage_amount}${p.dosage_unit || ''}`
    : String(p.dosage_amount);
};

interface MatrixColumn {
  key: string;
  label: string;
  render: (p: any) => React.ReactNode;
}

const PrescriptionMatrixTable: React.FC<{ prescriptions: any[] }> = ({ prescriptions }) => {
  const settings = getMedicationSettings();
  const sourceAbbrs = settings.機構簡稱 || {};
  const specialtyAbbrs = settings.專科簡稱 || {};

  const COLUMNS: MatrixColumn[] = [
    { key: 'start', label: '開始日期', render: (p) => shortDate(p.start_date) },
    { key: 'end', label: '結束日期', render: (p) => (p.end_date ? shortDate(p.end_date) : '—') },
    { key: 'prescription_date', label: '處方日期', render: (p) => shortDate(p.prescription_date) },
    {
      key: 'duration', label: '日數',
      render: (p) => (p.duration_days ? String(p.duration_days) : p.is_long_term === false ? '—' : '長期'),
    },
    { key: 'source', label: '來源', render: (p) => sourceText(p.medication_source, sourceAbbrs) },
    { key: 'specialty', label: '專科', render: (p) => specialtyText(p.medication_source_specialty, specialtyAbbrs) },
    { key: 'quantity', label: '數量', render: (p) => p.medication_quantity ?? '—' },
    { key: 'form', label: '劑型', render: (p) => p.dosage_form || '—' },
    { key: 'route', label: '途徑', render: (p) => p.administration_route || '—' },
    {
      key: 'daily_frequency', label: '次數',
      render: (p) => {
        const n = p.daily_frequency || (p.medication_time_slots?.length ?? 0);
        return n ? dailyCode(n) : '—';
      },
    },
    { key: 'dosage', label: '份量', render: dosageText },
    { key: 'special', label: '特殊', render: (p) => p.special_dosage_instruction || '—' },
    { key: 'timing', label: '時段', render: (p) => p.meal_timing || '—' },
    { key: 'prn', label: 'PRN', render: (p) => (p.is_prn ? '✓' : '—') },
    { key: 'prep', label: '備藥', render: (p) => PREPARATION_MAP[p.preparation_method] || p.preparation_method || '—' },
    { key: 'frequency', label: '頻率', render: freqCode },
    {
      key: 'slots', label: '時間',
      render: (p) => (p.medication_time_slots && p.medication_time_slots.length > 0
        ? p.medication_time_slots.join(' ')
        : '—'),
    },
    {
      key: 'inspection', label: '檢測',
      render: (p) => {
        const rules = p.inspection_rules || [];
        if (rules.length === 0) return '—';
        const opMap: Record<string, string> = { gt: '>', lt: '<', gte: '≥', lte: '≤' };
        const actionMap: Record<string, string> = { block_dispensing: '停服', warning_only: '僅警告' };
        return rules
          .map((r: any) => {
            const cond = `${r.vital_sign_type}${opMap[r.condition_operator] || ''}${r.condition_value}`;
            const action = actionMap[r.action_if_met] || r.action_if_met || '';
            return action ? `${cond} ${action}` : cond;
          })
          .join(' ');
      },
    },
    { key: 'notes', label: '備註', render: (p) => p.notes || '—' },
  ];

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
      <table className="min-w-max text-sm border-collapse">
        <thead>
          <tr>
            <th className="sticky left-0 z-10 bg-gray-100 px-3 py-2 text-left font-semibold text-gray-700 border-b border-r border-gray-200 whitespace-nowrap">
              藥物
            </th>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className="bg-gray-100 px-2 py-2 text-center font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap"
              >
                {c.label}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {prescriptions.map((p) => (
            <tr key={p.id} className="hover:bg-blue-50/40">
              <td className="sticky left-0 z-10 bg-white px-3 py-2 border-b border-r border-gray-200 font-medium text-gray-900 whitespace-nowrap">
                {p.medication_name}
                {p.is_long_term === false && (
                  <span className="ml-1 inline-flex items-center px-1 rounded text-xs font-medium bg-amber-100 text-amber-800">短</span>
                )}
              </td>
              {COLUMNS.map((c) => (
                <td
                  key={c.key}
                  className="px-2 py-2 text-center border-b border-gray-200 whitespace-nowrap text-gray-700"
                >
                  {c.render(p)}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
};

export default PrescriptionMatrixTable;
