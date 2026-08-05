import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Plus, Trash2 } from 'lucide-react';
import { useStation } from '../context/facility';
import { usePatients } from '../context/PatientContext';
import {
  DEFAULT_BED_COUNTS,
  DEFAULT_SPECIFIC_HOURS_CONFIG,
  FACILITY_NATURES,
  GRID_POSITIONS,
  NATURE_RATIO_POSITIONS,
  NIGHT_ANY_STAFF,
  STATUTORY_RATIOS,
  loadFacilityNatureSettings,
  saveFacilityNatureSettings,
  type FacilityNature,
  type NatureBedCounts,
  type NatureRequirements,
  type SpecificHoursConfig,
  type TimeSegment,
} from '../utils/facilityNatureSettings';
import {
  computeStaffingRequirements,
  natureDenominator,
  ratioHeadcount,
  timeToMinutes,
} from '../utils/staffingRequirements';

const TABS = ['床位設定', '病護比例', '24小時最低人手'] as const;

const INPUT_CLASS =
  'w-24 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm';
const TIME_INPUT_CLASS =
  'px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm';

/** 整數輸入；留空 = null */
const IntInput: React.FC<{
  value: number | null;
  onChange: (v: number | null) => void;
  min?: number;
  placeholder?: string;
}> = ({ value, onChange, min = 1, placeholder }) => (
  <input
    type="number"
    min={min}
    step={1}
    value={value ?? ''}
    placeholder={placeholder ?? '無要求'}
    onChange={(e) => {
      if (e.target.value === '') {
        onChange(null);
        return;
      }
      const n = parseInt(e.target.value, 10);
      onChange(Number.isFinite(n) ? Math.max(min, n) : null);
    }}
    className={INPUT_CLASS}
  />
);

const FacilityNatureSettings: React.FC = () => {
  const { beds } = useStation();
  const { allPatients } = usePatients();

  const [activeTab, setActiveTab] = useState(0);
  const [activeNature, setActiveNature] = useState<FacilityNature>('安老院');
  const [bedCounts, setBedCounts] = useState<NatureBedCounts>({ ...DEFAULT_BED_COUNTS });
  const [requirements, setRequirements] = useState<NatureRequirements>({});
  const [specific, setSpecific] = useState<SpecificHoursConfig>(DEFAULT_SPECIFIC_HOURS_CONFIG);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const totalBeds = beds.length;
  const currentResidents = useMemo(
    () => allPatients.filter((p) => p.在住狀態 === '在住').length,
    [allPatients]
  );

  useEffect(() => {
    let active = true;
    (async () => {
      const settings = await loadFacilityNatureSettings();
      if (!active) return;
      setBedCounts(settings.bedCounts);
      setRequirements(settings.requirements);
      setSpecific(settings.specific);
      setLoading(false);
    })();
    return () => {
      active = false;
    };
  }, []);

  // -----------------------------------------------------
  // 特定鐘點驗證
  // -----------------------------------------------------

  const segmentMinutes = (seg: TimeSegment) => timeToMinutes(seg.end) - timeToMinutes(seg.start);

  const req1TotalMinutes = specific.requirement1.segments.reduce(
    (sum, seg) => sum + Math.max(0, segmentMinutes(seg)),
    0
  );

  const req1Error = ((): string | null => {
    const segs = specific.requirement1.segments;
    if (segs.length === 0) return '護理員指明期間至少需要一個時段';
    for (const seg of segs) {
      const s = timeToMinutes(seg.start);
      const e = timeToMinutes(seg.end);
      if (s < 7 * 60 || e > 22 * 60) return '護理員指明期間必須在 07:00–22:00 之內';
      if (s >= e) return '護理員指明期間的起始時間必須早於結束時間';
    }
    const sorted = [...segs].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    for (let i = 1; i < sorted.length; i++) {
      if (timeToMinutes(sorted[i].start) < timeToMinutes(sorted[i - 1].end)) {
        return '護理員指明期間時段不可重疊';
      }
    }
    if (req1TotalMinutes !== 10 * 60) {
      return `護理員指明期間所有時段總和必須剛好 10 小時（目前 ${(req1TotalMinutes / 60).toFixed(1)} 小時）`;
    }
    return null;
  })();

  const req3Minutes = segmentMinutes(specific.requirement3);
  const req3Error =
    req3Minutes !== 13 * 60
      ? `護士／保健員指明期間必須剛好連續 13 小時（目前 ${(req3Minutes / 60).toFixed(1)} 小時）`
      : null;

  const assistantMinutes = segmentMinutes(specific.assistantWindow);
  const assistantError =
    assistantMinutes !== 11 * 60
      ? `助理員指明期間必須剛好連續 11 小時（目前 ${(assistantMinutes / 60).toFixed(1)} 小時）`
      : null;

  const bedCountsTotal = FACILITY_NATURES.reduce((sum, n) => sum + (bedCounts[n] || 0), 0);

  // -----------------------------------------------------
  // 儲存（全卡片共用，驗證不通過則拒絕）
  // -----------------------------------------------------

  const handleSave = async () => {
    if (bedCountsTotal !== totalBeds) {
      setMessage({
        type: 'error',
        text: `四個性質床位數總和（${bedCountsTotal}）必須等於床位管理總床數（${totalBeds}），請先修正「床位設定」`,
      });
      return;
    }
    if (req1Error) {
      setMessage({ type: 'error', text: req1Error });
      return;
    }
    if (req3Error) {
      setMessage({ type: 'error', text: req3Error });
      return;
    }
    if (assistantError) {
      setMessage({ type: 'error', text: assistantError });
      return;
    }
    setSaving(true);
    setMessage(null);
    try {
      await saveFacilityNatureSettings({ bedCounts, requirements, specific });
      setMessage({ type: 'success', text: '院舍性質設定已儲存' });
    } catch (err) {
      setMessage({ type: 'error', text: err instanceof Error ? err.message : '儲存失敗' });
    } finally {
      setSaving(false);
    }
  };

  // -----------------------------------------------------
  // 24 小時最低人手（用表單當前值即時預覽）
  // -----------------------------------------------------

  const staffing = useMemo(
    () =>
      computeStaffingRequirements({
        bedCounts,
        specific,
        currentResidents,
      }),
    [bedCounts, specific, currentResidents]
  );

  if (loading) {
    return (
      <div className="bg-white rounded-lg shadow-sm mt-6">
        <div className="text-center py-12">
          <div className="inline-block h-8 w-8 animate-spin rounded-full border-4 border-solid border-blue-600 border-r-transparent"></div>
          <p className="mt-2 text-gray-500">載入中...</p>
        </div>
      </div>
    );
  }

  // -----------------------------------------------------
  // 各 tab 內容
  // -----------------------------------------------------

  const natureSelector = (
    <div className="flex flex-wrap gap-2 mb-4">
      {FACILITY_NATURES.map((nature) => (
        <button
          key={nature}
          type="button"
          onClick={() => setActiveNature(nature)}
          className={`px-3 py-1.5 rounded-lg text-sm font-medium border ${
            activeNature === nature
              ? 'bg-blue-600 text-white border-blue-600'
              : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'
          }`}
        >
          {nature}
        </button>
      ))}
    </div>
  );

  const renderBedTab = () => (
    <div className="space-y-4 max-w-xl">
      <p className="text-sm text-gray-600">
        床位管理總床數：<span className="font-semibold text-gray-900">{totalBeds}</span>
      </p>
      {FACILITY_NATURES.map((nature) => (
        <div key={nature} className="flex items-center justify-between gap-4">
          <label className="text-sm font-medium text-gray-700">
            {nature}
            {nature === '安老院' && <span className="text-xs text-gray-400 ml-1">（私位）</span>}
          </label>
          <IntInput
            value={bedCounts[nature]}
            min={0}
            placeholder="0"
            onChange={(v) => setBedCounts((prev) => ({ ...prev, [nature]: v ?? 0 }))}
          />
        </div>
      ))}
      <p
        className={`text-sm ${bedCountsTotal === totalBeds ? 'text-green-600' : 'text-red-600'}`}
      >
        四者總和：{bedCountsTotal}（必須等於總床數 {totalBeds}）
      </p>
    </div>
  );

  const renderRatioTab = () => {
    const denominator = natureDenominator(activeNature, bedCounts, currentResidents);
    const isContractNature = activeNature === '甲一買位' || activeNature === '院舍卷計劃';
    const healthWorkerNeeded = ratioHeadcount(currentResidents, STATUTORY_RATIOS.healthWorker);
    const segs = specific.requirement1.segments;
    const updateSegment = (index: number, field: 'start' | 'end', value: string) => {
      setSpecific((prev) => ({
        ...prev,
        requirement1: {
          ...prev.requirement1,
          segments: prev.requirement1.segments.map((s, i) =>
            i === index ? { ...s, [field]: value } : s
          ),
        },
      }));
    };
    return (
      <div className="space-y-8">
        {/* 三個特定鐘點（全院共用；比例按附表1寫死，不可手調） */}
        <div className="max-w-2xl">
          <h3 className="text-sm font-semibold text-gray-900 mb-1">特定鐘點（全院共用）</h3>
          <p className="text-xs text-gray-500 mb-3">
            三個指明期間分別針對護理員（10 小時）、護士／保健員（連續 13 小時）、助理員（連續 11 小時）；
            比例為《安老院規例》附表1的法定底線，所有人手換算向上取整。
          </p>

          {/* 護理員指明期間（10 小時，可分割） */}
          <div className="border border-gray-200 rounded-lg p-3 mb-4">
            <p className="text-sm font-medium text-gray-900 mb-1">
              護理員指明期間（合共 10 小時，可分割，須在 07:00–22:00 內）
            </p>
            <p className="text-xs text-gray-500 mb-3">
              期間內每 {STATUTORY_RATIOS.careWorkerDay} 名住客須有 1 名護理員當值；期間以外任何時間每{' '}
              {STATUTORY_RATIOS.careWorkerNight} 名住客須有 1 名護理員當值。
            </p>
            <div className="space-y-2">
              {segs.map((seg, index) => (
                <div key={index} className="flex items-center gap-2">
                  <input
                    type="time"
                    value={seg.start}
                    min="07:00"
                    max="22:00"
                    onChange={(e) => updateSegment(index, 'start', e.target.value)}
                    className={TIME_INPUT_CLASS}
                  />
                  <span className="text-sm text-gray-500">至</span>
                  <input
                    type="time"
                    value={seg.end}
                    min="07:00"
                    max="22:00"
                    onChange={(e) => updateSegment(index, 'end', e.target.value)}
                    className={TIME_INPUT_CLASS}
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setSpecific((prev) => ({
                        ...prev,
                        requirement1: {
                          ...prev.requirement1,
                          segments: prev.requirement1.segments.filter((_, i) => i !== index),
                        },
                      }))
                    }
                    className="p-1.5 text-red-500 hover:text-red-700"
                    title="刪除此時段"
                  >
                    <Trash2 className="h-4 w-4" />
                  </button>
                </div>
              ))}
            </div>
            <div className="flex items-center gap-4 mt-3">
              <button
                type="button"
                onClick={() =>
                  setSpecific((prev) => ({
                    ...prev,
                    requirement1: {
                      ...prev.requirement1,
                      segments: [...prev.requirement1.segments, { start: '07:00', end: '08:00' }],
                    },
                  }))
                }
                className="inline-flex items-center px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50"
              >
                <Plus className="h-4 w-4 mr-1" />
                新增時段
              </button>
            </div>
            <p className={`text-sm mt-2 ${req1Error ? 'text-red-600' : 'text-green-600'}`}>
              10 小時時段總計：{(req1TotalMinutes / 60).toFixed(1)} 小時
              {req1Error ? `（${req1Error}）` : '（符合 10 小時要求）'}
            </p>
          </div>

          {/* 護士／保健員指明期間（連續 13 小時） */}
          <div className="border border-gray-200 rounded-lg p-3 mb-4">
            <p className="text-sm font-medium text-gray-900 mb-1">
              護士／保健員指明期間（連續 13 小時，不可分割）
            </p>
            <p className="text-xs text-gray-500 mb-3">
              期間內每 {STATUTORY_RATIOS.healthWorker} 名住客須有 1 名保健員（在場及當值）；1 名護士（在場及當值）視為等同於
              2 名保健員。以全院在住 {currentResidents} 人計，最少需要 {healthWorkerNeeded} 名保健員當量
              （純護士 {ratioHeadcount(currentResidents, STATUTORY_RATIOS.nurse)} 人／純保健員 {healthWorkerNeeded} 人，可混合）。
            </p>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={specific.requirement3.start}
                onChange={(e) =>
                  setSpecific((prev) => ({
                    ...prev,
                    requirement3: { ...prev.requirement3, start: e.target.value },
                  }))
                }
                className={TIME_INPUT_CLASS}
              />
              <span className="text-sm text-gray-500">至</span>
              <input
                type="time"
                value={specific.requirement3.end}
                onChange={(e) =>
                  setSpecific((prev) => ({
                    ...prev,
                    requirement3: { ...prev.requirement3, end: e.target.value },
                  }))
                }
                className={TIME_INPUT_CLASS}
              />
            </div>
            <p className={`text-sm mt-2 ${req3Error ? 'text-red-600' : 'text-green-600'}`}>
              連續當值長度：{(req3Minutes / 60).toFixed(1)} 小時
              {req3Error ? `（${req3Error}）` : '（符合 13 小時要求）'}
            </p>
          </div>

          {/* 助理員指明期間（連續 11 小時） */}
          <div className="border border-gray-200 rounded-lg p-3">
            <p className="text-sm font-medium text-gray-900 mb-1">
              助理員指明期間（連續 11 小時，不可分割）
            </p>
            <p className="text-xs text-gray-500 mb-3">
              期間內每 {STATUTORY_RATIOS.assistant} 名住客須有 1 名助理員當值（如廚子、家務助理、文員等，須在場）。
            </p>
            <div className="flex items-center gap-2">
              <input
                type="time"
                value={specific.assistantWindow.start}
                onChange={(e) =>
                  setSpecific((prev) => ({
                    ...prev,
                    assistantWindow: { ...prev.assistantWindow, start: e.target.value },
                  }))
                }
                className={TIME_INPUT_CLASS}
              />
              <span className="text-sm text-gray-500">至</span>
              <input
                type="time"
                value={specific.assistantWindow.end}
                onChange={(e) =>
                  setSpecific((prev) => ({
                    ...prev,
                    assistantWindow: { ...prev.assistantWindow, end: e.target.value },
                  }))
                }
                className={TIME_INPUT_CLASS}
              />
            </div>
            <p className={`text-sm mt-2 ${assistantError ? 'text-red-600' : 'text-green-600'}`}>
              指明期間長度：{(assistantMinutes / 60).toFixed(1)} 小時
              {assistantError ? `（${assistantError}）` : '（符合 11 小時要求）'}
            </p>
          </div>

          <p className="text-xs text-gray-500 mt-3">
            附表1第5項：每日 {NIGHT_ANY_STAFF.start} 至翌日 {NIGHT_ANY_STAFF.end} 須有 {NIGHT_ANY_STAFF.count}{' '}
            名員工當值（可以是為遵守其他項目而聘用的人），已反映於「24小時最低人手」表格的「任何員工」欄。
          </p>
        </div>

        {/* 各性質人手換算（法定比例寫死，向上取整，即時反映分母） */}
        <div>
          {natureSelector}
          <p className="text-sm text-gray-600 mb-4">
            分母：
            {activeNature === '安老院'
              ? `max(0, 全院在住 ${currentResidents} − 計劃類宿位總和) = `
              : `${activeNature}宿位數 = `}
            <span className="font-semibold text-gray-900">{denominator}</span>
          </p>
          <div className="space-y-3 max-w-2xl">
            {NATURE_RATIO_POSITIONS[activeNature].map((position) => {
              if (position === '主管') {
                return (
                  <div key={position} className="flex items-center justify-between gap-4">
                    <label className="text-sm font-medium text-gray-700">{position}</label>
                    <span className="text-sm text-gray-500">1 人</span>
                  </div>
                );
              }
              if (position === '註冊護士') {
                return (
                  <div key={position} className="flex items-center justify-between gap-4">
                    <label className="text-sm font-medium text-gray-700">{position}</label>
                    <span className="text-sm text-gray-500">最少 1 名當值（買位合約要求）</span>
                  </div>
                );
              }
              if (position === '保健員') {
                return (
                  <div key={position} className="flex items-center justify-between gap-4">
                    <label className="text-sm font-medium text-gray-700">{position}</label>
                    <span className="text-sm text-gray-500">
                      {isContractNature
                        ? `13 小時時段內與護士混合貢獻（全院需 ${healthWorkerNeeded} 名保健員當量）`
                        : `13 小時時段 1:${STATUTORY_RATIOS.healthWorker}（全院在住需 ${healthWorkerNeeded} 名）`}
                    </span>
                  </div>
                );
              }
              if (position === '護理員') {
                return (
                  <div key={position} className="flex items-center justify-between gap-4">
                    <label className="text-sm font-medium text-gray-700">{position}</label>
                    <span className="text-sm text-gray-500">
                      指明期間 1:{STATUTORY_RATIOS.careWorkerDay}（此性質需{' '}
                      {ratioHeadcount(denominator, STATUTORY_RATIOS.careWorkerDay)} 人）；其餘時間 1:
                      {STATUTORY_RATIOS.careWorkerNight}（需{' '}
                      {ratioHeadcount(denominator, STATUTORY_RATIOS.careWorkerNight)} 人）
                    </span>
                  </div>
                );
              }
              if (position === '助理員') {
                return (
                  <div key={position} className="flex items-center justify-between gap-4">
                    <label className="text-sm font-medium text-gray-700">{position}</label>
                    <span className="text-sm text-gray-500">
                      指明期間 1:{STATUTORY_RATIOS.assistant}（此性質需{' '}
                      {ratioHeadcount(denominator, STATUTORY_RATIOS.assistant)} 人當值）
                    </span>
                  </div>
                );
              }
              return null;
            })}
          </div>
        </div>
      </div>
    );
  };

  const a1VoucherBedTotal = (bedCounts['甲一買位'] || 0) + (bedCounts['院舍卷計劃'] || 0);
  const healthWorkerNeeded = ratioHeadcount(currentResidents, STATUTORY_RATIOS.healthWorker);

  const renderGridTab = () => (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        以表單當前值（未儲存亦會反映）及全院在住 {currentResidents} 人即時計算，法定比例寫死、向上取整。
        護理員按 10 小時（1:{STATUTORY_RATIOS.careWorkerDay}）／其餘時間（1:{STATUTORY_RATIOS.careWorkerNight}）逐小時填充；
        助理員按指明期間 11 小時（1:{STATUTORY_RATIOS.assistant}）填充；
        「任何員工」欄為附表1第5項（{NIGHT_ANY_STAFF.start}–翌日 {NIGHT_ANY_STAFF.end} 須 {NIGHT_ANY_STAFF.count} 名當值，可兼任）。
      </p>
      {a1VoucherBedTotal > 0 ? (
        <div className="border border-blue-200 bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-800">
          連續 13 小時時段（{specific.requirement3.start}–{specific.requirement3.end}）混合要求（甲一／院舍卷，排班指引）：
          護士人數 × 2 ＋ 保健員人數 ≥ {healthWorkerNeeded} 名保健員當量（全院在住 {currentResidents} 人 ÷{' '}
          {STATUTORY_RATIOS.healthWorker}，向上取整）。由誰貢獻這 13 小時在排班時決定，此處不預填任何欄；
          註冊護士欄保底 1 名當值（買位合約要求）。
        </div>
      ) : (
        bedCountsTotal > 0 && (
          <div className="border border-blue-200 bg-blue-50 rounded-lg px-4 py-3 text-sm text-blue-800">
            連續 13 小時時段（{specific.requirement3.start}–{specific.requirement3.end}）無護士要求，完全由保健員達標：
            每 {STATUTORY_RATIOS.healthWorker} 名住客 1 名，全院在住 {currentResidents} 人 → 時段內保健員欄已填入最少{' '}
            {healthWorkerNeeded} 人（向上取整）。
          </div>
        )
      )}
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border border-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-2 py-1.5 text-left font-medium text-gray-600">
                小時
              </th>
              {GRID_POSITIONS.map((pos) => (
                <th
                  key={pos}
                  className="border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600"
                >
                  {pos}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {staffing.grid.map((row, h) => (
              <tr key={h} className={h % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                <td className="border border-gray-200 px-2 py-1 text-gray-700 whitespace-nowrap">
                  {String(h).padStart(2, '0')}:00
                </td>
                {row.map((value, i) => (
                  <td
                    key={i}
                    className={`border border-gray-200 px-2 py-1 text-center ${
                      value > 0 ? 'text-gray-900 font-medium' : 'text-gray-300'
                    }`}
                  >
                    {value > 0 ? value : '-'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      <div className="overflow-x-auto">
        <table className="min-w-full text-xs border border-gray-200">
          <thead>
            <tr className="bg-gray-50">
              <th className="border border-gray-200 px-2 py-1.5 text-left font-medium text-gray-600">職位</th>
              <th className="border border-gray-200 px-2 py-1.5 text-center font-medium text-gray-600">
                每日最低僱用人數
              </th>
            </tr>
          </thead>
          <tbody>
            {staffing.dailySummaries.map((s) => (
              <tr key={s.position} className="bg-white">
                <td className="border border-gray-200 px-2 py-1 text-gray-700">{s.position}</td>
                <td className="border border-gray-200 px-2 py-1 text-center text-gray-700">
                  {s.minHeadcount > 0 ? s.minHeadcount : '-'}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );

  return (
    <div className="bg-white rounded-lg shadow-sm mt-6">
      {/* 工具列 */}
      <div className="border-b px-6 py-4">
        <div className="flex flex-wrap items-center gap-2">
          <Building2 className="h-5 w-5 text-gray-500" />
          <h2 className="text-lg font-medium text-gray-900">院舍性質</h2>
        </div>
        <p className="mt-1 text-sm text-gray-500">
          設定各院舍性質的床位數與三個特定鐘點（護理員 10 小時、護士／保健員連續 13 小時、助理員連續 11 小時），
          比例按《安老院規例》附表1寫死、向上取整，並預覽 24 小時最低人手要求。
        </p>
      </div>

      {/* Tab 列 */}
      <div className="border-b px-6">
        <nav className="flex flex-wrap gap-1">
          {TABS.map((tab, index) => (
            <button
              key={tab}
              type="button"
              onClick={() => {
                setActiveTab(index);
                setMessage(null);
              }}
              className={`px-4 py-3 text-sm font-medium border-b-2 -mb-px ${
                activeTab === index
                  ? 'border-blue-600 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300'
              }`}
            >
              {tab}
            </button>
          ))}
        </nav>
      </div>

      <div className="p-6">
        {activeTab === 0 && renderBedTab()}
        {activeTab === 1 && renderRatioTab()}
        {activeTab === 2 && renderGridTab()}

        {message && (
          <div
            className={`mt-6 text-sm rounded-lg px-4 py-2 max-w-2xl ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {activeTab !== 2 && (
          <div className="pt-6">
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="inline-flex items-center px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50"
            >
              <Check className="h-4 w-4 mr-2" />
              {saving ? '儲存中...' : '儲存設定'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default FacilityNatureSettings;
