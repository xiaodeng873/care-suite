import React, { useMemo, useRef, useState } from 'react';
import { ArrowRight, Trash2, Plus, X, ChevronUp, ChevronDown } from 'lucide-react';
import { formatDisplayDate } from '../utils/dateFormat';
import { getMedicationSettings, INSTITUTION_GROUPS, type MedicationSettingsData } from '../utils/medicationSettings';
import DrugAutocomplete from './DrugAutocomplete';

/**
 * 處方矩陣表格（格仔內直接編輯，唔開 Modal）：
 * Y 軸 = 藥物（每張處方一行，首欄凍結）
 * X 軸 = 處方 Modal 所有控制項 + 操作欄（轉移/刪除，最右凍結）
 *
 * 顯示規則（同用戶約定）：
 * - 日期一律 DD/MM/YYYY（必須有年份），不列時間；本專案時間顯示一律 HH:MM
 * - 次數/頻率用 QD、BD、TDS、QID；隔1天 QOD，隔N天 Q{N}D，隔N週 Q{N}W，隔N月 Q{N}M
 * - 劑型、時段、特殊不簡化
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

const WEEKDAY_NAMES = ['一', '二', '三', '四', '五', '六', '日']; // 儲存值 1–7

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
      const days = (p.specific_weekdays || [])
        .map((d: number) => WEEKDAY_NAMES[d - 1] || '')
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

const INSPECTION_SIGNS = ['上壓', '下壓', '脈搏', '血糖值', '呼吸', '血含氧量', '體溫'];
const OP_MAP: Record<string, string> = { gt: '>', lt: '<', gte: '≥', lte: '≤' };
const ACTION_MAP: Record<string, string> = { block_dispensing: '停服', warning_only: '僅警告' };

/** 份量 + 單位（純數字先合併單位） */
const dosageText = (p: any): string => {
  if (p.dosage_amount === undefined || p.dosage_amount === null || p.dosage_amount === '') return '—';
  return /^\d+(\.\d+)?$/.test(String(p.dosage_amount))
    ? `${p.dosage_amount}${p.dosage_unit || ''}`
    : String(p.dosage_amount);
};

const HHMM_RE = /^([01]\d|2[0-3]):[0-5]\d$/;

/** 檢測項文字（顯示同排序共用），無規則回傳空字串 */
const inspectionText = (p: any): string => {
  const rules = p.inspection_rules || [];
  if (rules.length === 0) return '';
  return rules
    .map((r: any) => {
      const cond = `${r.vital_sign_type}${OP_MAP[r.condition_operator] || ''}${r.condition_value}`;
      const action = ACTION_MAP[r.action_if_met] || r.action_if_met || '';
      return action ? `${cond} ${action}` : cond;
    })
    .join(' ');
};

interface MatrixCtx {
  settings: MedicationSettingsData;
}

type Commit = (patch: Record<string, any>) => void;

interface MatrixColumn {
  key: string;
  label: string;
  render: (p: any, ctx: MatrixCtx) => React.ReactNode;
  editor?: (p: any, commit: Commit, close: () => void, ctx: MatrixCtx) => React.ReactNode;
}

// ── 共用 editor 小元件 ──────────────────────────────────────────────────────

const inputCls = 'px-1.5 py-0.5 border border-blue-400 rounded text-sm focus:outline-none focus:ring-1 focus:ring-blue-500 bg-white';

/** 文字/數字輸入：Enter 或失焦提交，Esc 取消 */
const TextEditor: React.FC<{
  defaultValue: string;
  type?: string;
  step?: string;
  min?: string;
  width?: string;
  onCommit: (value: string) => void;
  close: () => void;
}> = ({ defaultValue, type = 'text', step, min, width = 'w-28', onCommit, close }) => (
  <input
    type={type}
    step={step}
    min={min}
    defaultValue={defaultValue}
    autoFocus
    onFocus={(e) => { if (type === 'date') return; e.target.select(); }}
    className={`${inputCls} ${width}`}
    onBlur={(e) => { onCommit(e.target.value); close(); }}
    onKeyDown={(e) => {
      if (e.key === 'Enter') { onCommit((e.target as HTMLInputElement).value); close(); }
      if (e.key === 'Escape') close();
    }}
  />
);

/** 下拉：選擇即提交 */
const SelectEditor: React.FC<{
  value: string;
  onCommit: (value: string) => void;
  close: () => void;
  children: React.ReactNode;
}> = ({ value, onCommit, close, children }) => (
  <select
    value={value}
    autoFocus
    className={`${inputCls} max-w-[10rem]`}
    onChange={(e) => { onCommit(e.target.value); close(); }}
    onBlur={close}
    onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
  >
    {children}
  </select>
);

/** 複合編輯器外框：失焦（移出容器）先關閉 */
const CompositeBox: React.FC<{ close: () => void; children: React.ReactNode }> = ({ close, children }) => (
  <div
    tabIndex={-1}
    className="flex flex-wrap items-center gap-1 bg-blue-50 border border-blue-300 rounded p-1"
    onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) close(); }}
    onKeyDown={(e) => { if (e.key === 'Escape') close(); }}
  >
    {children}
  </div>
);

/**
 * 藥物名稱編輯器：用 DrugAutocomplete（藥物資料庫 autocomplete，同處方 Modal 一致）。
 * 打字唔會即時落 DB；揀中藥物先一次過提交（連劑型/途徑自動帶出），
 * 手輸冇揀嘅就失焦/Enter 先提交名稱。
 */
const DrugNameEditor: React.FC<{
  p: any;
  commit: Commit;
  close: () => void;
}> = ({ p, commit, close }) => {
  const original = p.medication_name || '';
  const latest = useRef(original);
  const committed = useRef<string | null>(null);

  const commitIfChanged = () => {
    const v = latest.current.trim();
    if (v && v !== original && v !== committed.current) {
      committed.current = v;
      commit({ medication_name: v });
    }
  };

  return (
    <div
      tabIndex={-1}
      className="flex flex-wrap items-center gap-1 bg-blue-50 border border-blue-300 rounded p-1 w-full"
      onBlur={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { commitIfChanged(); close(); } }}
      onKeyDown={(e) => { if (e.key === 'Escape') { commitIfChanged(); close(); } }}
    >
      <DrugAutocomplete
        value={original}
        onChange={(name, drugData) => {
          latest.current = name;
          if (drugData) {
            // 揀中資料庫藥物：名稱 + 劑型 + 途徑一次過提交
            committed.current = name;
            commit({
              medication_name: name,
              dosage_form: drugData.dosage_form || p.dosage_form || null,
              administration_route: drugData.administration_route || p.administration_route || null,
            });
          }
        }}
        placeholder="搜索或輸入藥物名稱..."
        className="w-full min-w-64"
      />
    </div>
  );
};

// ── 主元件 ──────────────────────────────────────────────────────────────────

interface PrescriptionMatrixTableProps {
  prescriptions: any[];
  /** 格仔編輯提交（partial 合併後整張處方傳返上層） */
  onUpdate: (prescription: any) => Promise<void> | void;
  onTransfer: (prescription: any) => void;
  onDelete: (id: string) => void;
  deletingIds: Set<string>;
  /** 勾選（批量操作用，同列表模式共用 selection state） */
  selectedIds: Set<string>;
  onSelect: (id: string) => void;
  onSelectAll: () => void;
}

const PrescriptionMatrixTable: React.FC<PrescriptionMatrixTableProps> = ({ prescriptions, onUpdate, onTransfer, onDelete, deletingIds, selectedIds, onSelect, onSelectAll }) => {
  const settings = getMedicationSettings();
  const sourceAbbrs = settings.機構簡稱 || {};
  const specialtyAbbrs = settings.專科簡稱 || {};
  const ctx: MatrixCtx = { settings };

  const [editing, setEditing] = useState<{ id: string; key: string } | null>(null);
  const close = () => setEditing(null);

  // 勾選狀態（目前視圖）
  const currentIds = prescriptions.map((p) => p.id);
  const selectedInView = currentIds.filter((id) => selectedIds.has(id));
  const isAllSelected = currentIds.length > 0 && selectedInView.length === currentIds.length;
  const isPartiallySelected = selectedInView.length > 0 && selectedInView.length < currentIds.length;

  const commitFactory = (p: any): Commit => async (patch) => {
    try {
      await onUpdate({ ...p, ...patch });
    } catch (e: any) {
      alert(`更新失敗：${e?.message || e}`);
    }
  };

  const dateEditor = (field: string): MatrixColumn['editor'] =>
    (p, commit, done) => (
      <TextEditor
        type="date"
        defaultValue={p[field] || ''}
        width="w-36"
        onCommit={(v) => commit({ [field]: v || null })}
        close={done}
      />
    );

  const selectFromList = (field: string, listKey: keyof MedicationSettingsData, allowEmpty = true): MatrixColumn['editor'] =>
    (p, commit, done, c) => (
      <SelectEditor value={p[field] || ''} onCommit={(v) => commit({ [field]: v || null })} close={done}>
        {allowEmpty && <option value="">—</option>}
        {((c.settings[listKey] as string[]) || []).map((v) => <option key={v} value={v}>{v}</option>)}
      </SelectEditor>
    );

  const COLUMNS: MatrixColumn[] = [
    {
      key: 'start', label: '開始日期',
      render: (p) => shortDate(p.start_date),
      editor: dateEditor('start_date'),
    },
    {
      key: 'prescription_date', label: '處方日期',
      render: (p) => shortDate(p.prescription_date),
      editor: dateEditor('prescription_date'),
    },
    {
      key: 'end', label: '結束日期',
      render: (p) => (p.end_date ? shortDate(p.end_date) : '—'),
      editor: dateEditor('end_date'),
    },
    {
      key: 'last_taken', label: '上次服用',
      render: (p) => (p.last_taken_date ? shortDate(p.last_taken_date) : '—'),
      editor: dateEditor('last_taken_date'),
    },
    {
      key: 'duration', label: '日數',
      render: (p) => (p.duration_days ? String(p.duration_days) : p.is_long_term === false ? '—' : '長期'),
      editor: (p, commit, done) => (
        <TextEditor
          type="number" min="0"
          defaultValue={p.duration_days ?? ''}
          width="w-16"
          onCommit={(v) => commit({ duration_days: v ? parseInt(v) || null : null })}
          close={done}
        />
      ),
    },
    {
      key: 'source', label: '來源',
      render: (p) => sourceText(p.medication_source, sourceAbbrs),
      editor: (p, commit, done, c) => (
        <SelectEditor value={p.medication_source || ''} onCommit={(v) => commit({ medication_source: v })} close={done}>
          <option value="">—</option>
          {INSTITUTION_GROUPS.map((g) => {
            const list = (c.settings[g.key] as string[]) || [];
            if (list.length === 0) return null;
            return (
              <optgroup key={g.label} label={g.label}>
                {list.map((src) => <option key={src} value={src}>{src}</option>)}
              </optgroup>
            );
          })}
        </SelectEditor>
      ),
    },
    {
      key: 'specialty', label: '專科',
      render: (p) => specialtyText(p.medication_source_specialty, specialtyAbbrs),
      editor: selectFromList('medication_source_specialty', '專科'),
    },
    {
      key: 'quantity', label: '數量',
      render: (p) => p.medication_quantity ?? '—',
      editor: (p, commit, done) => (
        <TextEditor
          type="number" min="0" step="0.5"
          defaultValue={p.medication_quantity ?? ''}
          width="w-16"
          onCommit={(v) => commit({ medication_quantity: v ? parseFloat(v) : null })}
          close={done}
        />
      ),
    },
    { key: 'form', label: '劑型', render: (p) => p.dosage_form || '—', editor: selectFromList('dosage_form', '劑型') },
    { key: 'route', label: '途徑', render: (p) => p.administration_route || '—', editor: selectFromList('administration_route', '服用途徑') },
    {
      key: 'daily_frequency', label: '次數',
      render: (p) => {
        const n = p.daily_frequency || (p.medication_time_slots?.length ?? 0);
        return n ? dailyCode(n) : '—';
      },
      editor: (p, commit, done, c) => (
        <SelectEditor
          value={String(p.daily_frequency || '')}
          onCommit={(v) => commit({ daily_frequency: v ? parseInt(v) : null })}
          close={done}
        >
          <option value="">—</option>
          {[...(c.settings.每日次數 || [])].sort((a, b) => a - b).map((n) => (
            <option key={n} value={n}>{dailyCode(n)}（{n}次）</option>
          ))}
        </SelectEditor>
      ),
    },
    {
      key: 'dosage', label: '份量',
      render: dosageText,
      editor: (p, commit) => (
        <CompositeBox close={close}>
          <input
            type="number" min="0" step="0.25"
            defaultValue={p.dosage_amount ?? ''}
            autoFocus
            className={`${inputCls} w-16`}
            onBlur={(e) => commit({ dosage_amount: e.target.value ? parseFloat(e.target.value) : null })}
            onKeyDown={(e) => { if (e.key === 'Enter') commit({ dosage_amount: (e.target as HTMLInputElement).value ? parseFloat((e.target as HTMLInputElement).value) : null }); }}
          />
          <select
            value={p.dosage_unit || ''}
            className={inputCls}
            onChange={(e) => commit({ dosage_unit: e.target.value || null })}
          >
            <option value="">單位</option>
            {(settings.服用單位 || []).map((v) => <option key={v} value={v}>{v}</option>)}
          </select>
        </CompositeBox>
      ),
    },
    { key: 'special', label: '特殊', render: (p) => p.special_dosage_instruction || '—', editor: selectFromList('special_dosage_instruction', '特殊用法') },
    { key: 'timing', label: '時段', render: (p) => p.meal_timing || '—', editor: selectFromList('meal_timing', '服用時段') },
    {
      key: 'prn', label: 'PRN',
      render: (p, _c) => null, // 用自定義 cell（常駐 checkbox）
      editor: undefined,
    },
    {
      key: 'prep', label: '備藥',
      render: (p) => PREPARATION_MAP[p.preparation_method] || p.preparation_method || '—',
      editor: (p, commit, done) => (
        <SelectEditor value={p.preparation_method || ''} onCommit={(v) => commit({ preparation_method: v || null })} close={done}>
          <option value="">—</option>
          <option value="immediate">即時</option>
          <option value="advanced">提前</option>
          <option value="custom">自理</option>
        </SelectEditor>
      ),
    },
    {
      key: 'frequency', label: '頻率',
      render: freqCode,
      editor: (p, commit) => {
        const type = p.frequency_type || 'daily';
        return (
          <CompositeBox close={close}>
            <select
              value={type}
              autoFocus
              className={inputCls}
              onChange={(e) => commit({ frequency_type: e.target.value })}
            >
              <option value="daily">每日服</option>
              <option value="every_x_days">隔N日服</option>
              <option value="every_x_weeks">隔N週服</option>
              <option value="every_x_months">隔N月服</option>
              <option value="weekly_days">逢星期N服</option>
              <option value="odd_even_days">單日/雙日服</option>
              <option value="hourly">每小時</option>
            </select>
            {(type === 'every_x_days' || type === 'every_x_weeks' || type === 'every_x_months' || type === 'hourly') && (
              <input
                type="number" min="1"
                defaultValue={p.frequency_value ?? 1}
                className={`${inputCls} w-14`}
                onBlur={(e) => commit({ frequency_value: parseInt(e.target.value) || 1 })}
              />
            )}
            {type === 'weekly_days' && (
              <div className="flex items-center gap-1">
                {WEEKDAY_NAMES.map((name, i) => {
                  const val = i + 1;
                  const checked = (p.specific_weekdays || []).includes(val);
                  return (
                    <label key={val} className="flex items-center gap-0.5 text-xs">
                      <input
                        type="checkbox"
                        checked={checked}
                        onChange={(e) => {
                          const cur: number[] = p.specific_weekdays || [];
                          const next = e.target.checked ? [...cur, val].sort() : cur.filter((d) => d !== val);
                          commit({ specific_weekdays: next });
                        }}
                      />
                      {name}
                    </label>
                  );
                })}
              </div>
            )}
            {type === 'odd_even_days' && (
              <select
                value={p.is_odd_even_day || 'odd'}
                className={inputCls}
                onChange={(e) => commit({ is_odd_even_day: e.target.value })}
              >
                <option value="odd">單日</option>
                <option value="even">雙日</option>
              </select>
            )}
          </CompositeBox>
        );
      },
    },
    {
      key: 'slots', label: '時間',
      render: (p) => (p.medication_time_slots && p.medication_time_slots.length > 0
        ? p.medication_time_slots.join(',')
        : '—'),
      editor: (p, commit, done) => (
        <TextEditor
          defaultValue={(p.medication_time_slots || []).join(',')}
          width="w-44"
          onCommit={(v) => {
            const parts = v.split(/[\s,，、]+/).filter(Boolean);
            if (parts.some((t) => !HHMM_RE.test(t))) {
              alert('時間格式必須係 HH:MM（24小時制），多個時間用逗號分隔');
              return;
            }
            commit({ medication_time_slots: parts });
          }}
          close={done}
        />
      ),
    },
    {
      key: 'inspection', label: '檢測',
      render: (p) => inspectionText(p) || '—',
      editor: (p, commit) => {
        const rules: any[] = p.inspection_rules || [];
        const setRules = (next: any[]) => commit({ inspection_rules: next });
        return (
          <CompositeBox close={close}>
            {rules.map((r, i) => (
              <div key={i} className="flex items-center gap-1">
                <select
                  value={r.vital_sign_type}
                  className={inputCls}
                  onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, vital_sign_type: e.target.value } : x)))}
                >
                  {INSPECTION_SIGNS.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
                <select
                  value={r.condition_operator}
                  className={inputCls}
                  onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, condition_operator: e.target.value } : x)))}
                >
                  <option value="gt">&gt;</option>
                  <option value="lt">&lt;</option>
                  <option value="gte">≥</option>
                  <option value="lte">≤</option>
                </select>
                <input
                  type="number" step="0.1"
                  defaultValue={r.condition_value}
                  className={`${inputCls} w-16`}
                  onBlur={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, condition_value: parseFloat(e.target.value) || 0 } : x)))}
                />
                <select
                  value={r.action_if_met}
                  className={inputCls}
                  onChange={(e) => setRules(rules.map((x, j) => (j === i ? { ...x, action_if_met: e.target.value } : x)))}
                >
                  <option value="block_dispensing">停服</option>
                  <option value="warning_only">僅警告</option>
                </select>
                <button
                  type="button"
                  className="text-gray-400 hover:text-red-500"
                  title="刪除此檢測項"
                  onClick={() => setRules(rules.filter((_, j) => j !== i))}
                >
                  <X className="h-3.5 w-3.5" />
                </button>
              </div>
            ))}
            <button
              type="button"
              className="inline-flex items-center gap-0.5 text-xs text-blue-600 hover:text-blue-800"
              onClick={() => setRules([...rules, { vital_sign_type: '上壓', condition_operator: 'lt', condition_value: 60, action_if_met: 'block_dispensing' }])}
            >
              <Plus className="h-3.5 w-3.5" />加檢測項
            </button>
          </CompositeBox>
        );
      },
    },
    {
      key: 'notes', label: '備註',
      render: (p) => p.notes || '—',
      editor: (p, commit, done) => (
        <TextEditor
          defaultValue={p.notes || ''}
          width="w-48"
          onCommit={(v) => commit({ notes: v || null })}
          close={done}
        />
      ),
    },
  ];

  // ── 排序 ──────────────────────────────────────────────────────────────────
  // 每欄排序取值；null/空值永遠排最後
  const SORTERS: Record<string, (p: any) => string | number | null> = {
    start: (p) => p.start_date || null,
    prescription_date: (p) => p.prescription_date || null,
    end: (p) => p.end_date || null,
    last_taken: (p) => p.last_taken_date || null,
    duration: (p) => p.duration_days ?? (p.is_long_term === false ? -1 : Number.MAX_SAFE_INTEGER),
    source: (p) => p.medication_source || null,
    specialty: (p) => p.medication_source_specialty || null,
    quantity: (p) => p.medication_quantity ?? null,
    form: (p) => p.dosage_form || null,
    route: (p) => p.administration_route || null,
    daily_frequency: (p) => p.daily_frequency ?? (p.medication_time_slots?.length ?? null),
    dosage: (p) => {
      const n = parseFloat(p.dosage_amount);
      return isNaN(n) ? null : n;
    },
    special: (p) => p.special_dosage_instruction || null,
    timing: (p) => p.meal_timing || null,
    prn: (p) => (p.is_prn ? 1 : 0),
    prep: (p) => PREPARATION_MAP[p.preparation_method] || p.preparation_method || null,
    frequency: (p) => freqCode(p),
    slots: (p) => (p.medication_time_slots || []).join(',') || null,
    inspection: (p) => inspectionText(p) || null,
    notes: (p) => p.notes || null,
  };

  const [sortKey, setSortKey] = useState<string | null>(null); // 'medication_name' 或 COLUMNS key
  const [sortDir, setSortDir] = useState<'asc' | 'desc'>('asc');

  /** 撳表頭：升序 → 降序 → 取消排序 */
  const handleSort = (key: string) => {
    if (sortKey !== key) {
      setSortKey(key);
      setSortDir('asc');
    } else if (sortDir === 'asc') {
      setSortDir('desc');
    } else {
      setSortKey(null);
    }
  };

  const sortedPrescriptions = useMemo(() => {
    if (!sortKey) return prescriptions;
    const getVal = (p: any): string | number | null =>
      sortKey === 'medication_name' ? p.medication_name || null : SORTERS[sortKey]?.(p) ?? null;
    return prescriptions
      .map((p, i) => ({ p, i, v: getVal(p) }))
      .sort((a, b) => {
        if (a.v == null && b.v == null) return a.i - b.i;
        if (a.v == null) return 1;
        if (b.v == null) return -1;
        let cmp: number;
        if (typeof a.v === 'number' && typeof b.v === 'number') cmp = a.v - b.v;
        else cmp = String(a.v).localeCompare(String(b.v), 'zh-Hant');
        return (sortDir === 'asc' ? cmp : -cmp) || a.i - b.i;
      })
      .map((x) => x.p);
  }, [prescriptions, sortKey, sortDir]);

  return (
    <div className="overflow-x-auto border border-gray-200 rounded-lg bg-white">
      <table className="w-full min-w-max text-sm border-collapse">
        <thead>
          <tr>
            <th className="bg-gray-100 px-2 py-2 text-center border-b border-r border-gray-200 whitespace-nowrap">
              <input
                type="checkbox"
                checked={isAllSelected}
                ref={(el) => { if (el) el.indeterminate = isPartiallySelected; }}
                onChange={onSelectAll}
                className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                title="全選/取消全選"
              />
            </th>
            <th className="bg-gray-100 px-2 py-2 text-center font-semibold text-gray-700 border-b border-r border-gray-200 whitespace-nowrap">
              #
            </th>
            <th
              className="sticky left-0 z-10 bg-gray-100 px-3 py-2 text-left font-semibold text-gray-700 border-b border-r border-gray-200 whitespace-nowrap cursor-pointer select-none hover:bg-gray-200"
              onClick={() => handleSort('medication_name')}
              title="撳嚟排序"
            >
              <span className="inline-flex items-center gap-1">
                藥物
                {sortKey === 'medication_name' && (
                  sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                )}
              </span>
            </th>
            {COLUMNS.map((c) => (
              <th
                key={c.key}
                className="bg-gray-100 px-2 py-2 text-center font-semibold text-gray-700 border-b border-gray-200 whitespace-nowrap cursor-pointer select-none hover:bg-gray-200"
                onClick={() => handleSort(c.key)}
                title="撳嚟排序"
              >
                <span className="inline-flex items-center gap-1">
                  {c.label}
                  {sortKey === c.key && (
                    sortDir === 'asc' ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />
                  )}
                </span>
              </th>
            ))}
            <th className="sticky right-0 z-10 bg-gray-100 px-2 py-2 text-center font-semibold text-gray-700 border-b border-l border-gray-200 whitespace-nowrap">
              操作
            </th>
          </tr>
        </thead>
        <tbody>
          {sortedPrescriptions.map((p, rowIndex) => {
            const commit = commitFactory(p);
            return (
              <tr key={p.id} className={`hover:bg-blue-50/40 ${selectedIds.has(p.id) ? 'bg-blue-50/60' : ''}`}>
                <td
                  className="px-2 py-2 text-center border-b border-r border-gray-200 whitespace-nowrap"
                  onClick={(e) => e.stopPropagation()}
                >
                  <input
                    type="checkbox"
                    checked={selectedIds.has(p.id)}
                    onChange={() => onSelect(p.id)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                  />
                </td>
                <td className="px-2 py-2 text-center border-b border-r border-gray-200 whitespace-nowrap text-gray-500">
                  {rowIndex + 1}
                </td>
                <td
                  className={`sticky left-0 bg-white px-3 py-2 border-b border-r border-gray-200 font-medium text-gray-900 whitespace-nowrap cursor-pointer ${
                    editing?.id === p.id && editing?.key === 'medication_name' ? 'z-30' : 'z-10'
                  }`}
                  onClick={() => setEditing({ id: p.id, key: 'medication_name' })}
                >
                  {editing?.id === p.id && editing?.key === 'medication_name' ? (
                    <DrugNameEditor p={p} commit={commit} close={close} />
                  ) : (
                    <>
                      {p.medication_name}
                      {p.is_long_term === false && (
                        <span className="ml-1 inline-flex items-center px-1 rounded text-xs font-medium bg-amber-100 text-amber-800">短</span>
                      )}
                    </>
                  )}
                </td>
                {COLUMNS.map((c) => {
                  const isEditing = editing?.id === p.id && editing?.key === c.key;
                  // PRN 欄常駐 checkbox，直接撳即改
                  if (c.key === 'prn') {
                    return (
                      <td
                        key={c.key}
                        className="px-2 py-2 text-center border-b border-gray-200 whitespace-nowrap text-gray-700"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <input
                          type="checkbox"
                          checked={!!p.is_prn}
                          onChange={(e) => commit({ is_prn: e.target.checked })}
                          className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded cursor-pointer"
                        />
                      </td>
                    );
                  }
                  return (
                    <td
                      key={c.key}
                      className={`px-2 py-2 text-center border-b border-gray-200 whitespace-nowrap text-gray-700 ${c.editor ? 'cursor-pointer hover:bg-blue-50' : ''}`}
                      onClick={() => c.editor && setEditing({ id: p.id, key: c.key })}
                      title={c.editor ? '撳入格編輯' : undefined}
                    >
                      {isEditing && c.editor ? c.editor(p, commit, close, ctx) : c.render(p, ctx)}
                    </td>
                  );
                })}
                <td
                  className="sticky right-0 z-10 bg-white px-2 py-2 border-b border-l border-gray-200 whitespace-nowrap text-center"
                  onClick={(e) => e.stopPropagation()}
                >
                  <div className="flex items-center justify-center gap-1">
                    <button
                      onClick={() => onTransfer(p)}
                      className="text-green-600 hover:text-green-800 p-1.5 rounded-lg hover:bg-green-50"
                      title="轉移處方"
                    >
                      <ArrowRight className="h-4 w-4" />
                    </button>
                    <button
                      onClick={() => onDelete(p.id)}
                      className="text-red-600 hover:text-red-800 p-1.5 rounded-lg hover:bg-red-50"
                      title="刪除"
                      disabled={deletingIds.has(p.id)}
                    >
                      {deletingIds.has(p.id) ? (
                        <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-red-600"></div>
                      ) : (
                        <Trash2 className="h-4 w-4" />
                      )}
                    </button>
                  </div>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
};

export default PrescriptionMatrixTable;
