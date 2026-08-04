import React, { useEffect, useMemo, useState } from 'react';
import { Building2, Check, Plus, Trash2 } from 'lucide-react';
import { useStation } from '../context/facility';
import { usePatients } from '../context/PatientContext';
import {
  DEFAULT_BED_COUNTS,
  DEFAULT_SPECIFIC_HOURS_CONFIG,
  FACILITY_NATURES,
  GRID_POSITIONS,
  NATURE_HOURS_POSITIONS,
  NATURE_RATIO_POSITIONS,
  PHYSIOTHERAPIST,
  loadFacilityNatureSettings,
  saveFacilityNatureSettings,
  type FacilityNature,
  type NatureBedCounts,
  type NatureRequirements,
  type SpecificHoursConfig,
  type TimeSegment,
} from '../utils/facilityNatureSettings';
import {
  ceilHalf,
  computeStaffingRequirements,
  natureDenominator,
  timeToMinutes,
} from '../utils/staffingRequirements';

const TABS = ['床位設定', '病護比例', '各職位總工時', '特定鐘點', '24小時最低人手'] as const;

const INPUT_CLASS =
  'w-24 px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm';
const TIME_INPUT_CLASS =
  'px-3 py-1.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-sm';

/** 整數輸入；留空 = null（無要求） */
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
  // 表單更新 helpers
  // -----------------------------------------------------

  const updateRatio = (nature: FacilityNature, position: string, value: number | null) => {
    setRequirements((prev) => ({
      ...prev,
      [nature]: {
        ratios: { ...prev[nature]?.ratios, [position]: value },
        hours: prev[nature]?.hours ?? {},
      },
    }));
  };

  const updateHours = (nature: FacilityNature, position: string, value: number | null) => {
    setRequirements((prev) => ({
      ...prev,
      [nature]: {
        ratios: prev[nature]?.ratios ?? {},
        hours: { ...prev[nature]?.hours, [position]: value },
      },
    }));
  };

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
    if (segs.length === 0) return '要求1至少需要一個時段';
    for (const seg of segs) {
      const s = timeToMinutes(seg.start);
      const e = timeToMinutes(seg.end);
      if (s < 7 * 60 || e > 22 * 60) return '要求1時段必須在 07:00–22:00 之內';
      if (s >= e) return '要求1時段的起始時間必須早於結束時間';
    }
    const sorted = [...segs].sort((a, b) => timeToMinutes(a.start) - timeToMinutes(b.start));
    for (let i = 1; i < sorted.length; i++) {
      if (timeToMinutes(sorted[i].start) < timeToMinutes(sorted[i - 1].end)) {
        return '要求1時段不可重疊';
      }
    }
    if (req1TotalMinutes !== 10 * 60) {
      return `要求1所有時段總和必須剛好 10 小時（目前 ${(req1TotalMinutes / 60).toFixed(1)} 小時）`;
    }
    return null;
  })();

  const req3Minutes = segmentMinutes(specific.requirement3);
  const req3Error =
    req3Minutes !== 11 * 60
      ? `要求3時段必須剛好連續 11 小時（目前 ${(req3Minutes / 60).toFixed(1)} 小時）`
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
        requirements,
        specific,
        currentResidents,
      }),
    [bedCounts, requirements, specific, currentResidents]
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
    const ratios = requirements[activeNature]?.ratios ?? {};
    return (
      <div>
        {natureSelector}
        <p className="text-sm text-gray-600 mb-4">
          分母：
          {activeNature === '安老院'
            ? `max(0, 全院在住 ${currentResidents} − 計劃類宿位總和) = `
            : `${activeNature}宿位數 = `}
          <span className="font-semibold text-gray-900">{denominator}</span>
        </p>
        <div className="space-y-3 max-w-xl">
          {NATURE_RATIO_POSITIONS[activeNature].map((position) => {
            const n = ratios[position] ?? null;
            return (
              <div key={position} className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-gray-700">{position}</label>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">1 :</span>
                  <IntInput value={n} onChange={(v) => updateRatio(activeNature, position, v)} />
                  <span className="text-sm text-gray-500 w-32">
                    {n != null && n > 0
                      ? `所需 ${Math.ceil(denominator / n)} 人`
                      : '無要求'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderHoursTab = () => {
    const hours = requirements[activeNature]?.hours ?? {};
    return (
      <div>
        {natureSelector}
        <p className="text-sm text-gray-600 mb-4">
          各職位每天最低總工時（物理治療師以每周計，每日換算 = 每周 ÷ 5 進位至 0.5）；留空 = 無要求。
        </p>
        <div className="space-y-3 max-w-xl">
          {NATURE_HOURS_POSITIONS[activeNature].map((position) => {
            const value = hours[position] ?? null;
            const isPT = position === PHYSIOTHERAPIST;
            return (
              <div key={position} className="flex items-center justify-between gap-4">
                <label className="text-sm font-medium text-gray-700">{position}</label>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-500">{isPT ? '每周總共' : '每天總共'}</span>
                  <IntInput value={value} onChange={(v) => updateHours(activeNature, position, v)} />
                  <span className="text-sm text-gray-500 w-44">
                    {value == null
                      ? '小時（無要求）'
                      : isPT
                        ? `小時（每日約 ${ceilHalf(value / 5)} 小時）`
                        : '小時'}
                  </span>
                </div>
              </div>
            );
          })}
        </div>
      </div>
    );
  };

  const renderSpecificTab = () => {
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
      <div className="space-y-8 max-w-2xl">
        {/* 要求1 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            要求1：指定時段護理員對住客比例
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            時段須在 07:00–22:00 內、起早於止、不可重疊，所有時段總和必須剛好 10 小時。
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
            <div className="flex items-center gap-2 text-sm text-gray-600">
              <span>護理員對住客 1 :</span>
              <IntInput
                value={specific.requirement1.ratio}
                onChange={(v) =>
                  setSpecific((prev) => ({
                    ...prev,
                    requirement1: { ...prev.requirement1, ratio: v ?? prev.requirement1.ratio },
                  }))
                }
              />
            </div>
          </div>
          <p className={`text-sm mt-2 ${req1Error ? 'text-red-600' : 'text-green-600'}`}>
            目前總計：{(req1TotalMinutes / 60).toFixed(1)} 小時
            {req1Error ? `（${req1Error}）` : '（符合 10 小時要求）'}
          </p>
        </div>

        {/* 要求2 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            要求2：其餘 14 小時護理員對住客比例
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            其餘 14 小時（24 小時 − 要求1時段）。
          </p>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            <span>護理員對住客 1 :</span>
            <IntInput
              value={specific.requirement2.ratio}
              onChange={(v) =>
                setSpecific((prev) => ({
                  ...prev,
                  requirement2: { ratio: v ?? prev.requirement2.ratio },
                }))
              }
            />
          </div>
        </div>

        {/* 要求3 */}
        <div>
          <h3 className="text-sm font-semibold text-gray-900 mb-1">
            要求3：護士／保健員最低連續當值時段
          </h3>
          <p className="text-xs text-gray-500 mb-3">
            每天有護士／保健員當值最低連續 11 小時，不可分割。
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
            目前長度：{(req3Minutes / 60).toFixed(1)} 小時
            {req3Error ? `（${req3Error}）` : '（符合 11 小時要求）'}
          </p>
        </div>
      </div>
    );
  };

  const renderGridTab = () => (
    <div className="space-y-4">
      <p className="text-xs text-gray-500">
        以表單當前值（未儲存亦會反映）及全院在住 {currentResidents} 人即時計算。
        要求3時段內護士／保健員欄除最少 1 人當值外，會同時提升至病護比例換算的最低僱用人數（11 小時內同樣要符合病護比例才合格）。
      </p>
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
                每日最低總工時要求
              </th>
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
                  {s.requiredDailyHours > 0 ? s.requiredDailyHours.toFixed(1) : '-'}
                </td>
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
          設定各院舍性質的床位數、病護比例、職位總工時與特定鐘點，並預覽 24 小時最低人手要求。
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
        {activeTab === 2 && renderHoursTab()}
        {activeTab === 3 && renderSpecificTab()}
        {activeTab === 4 && renderGridTab()}

        {message && (
          <div
            className={`mt-6 text-sm rounded-lg px-4 py-2 max-w-2xl ${
              message.type === 'success' ? 'bg-green-50 text-green-700' : 'bg-red-50 text-red-700'
            }`}
          >
            {message.text}
          </div>
        )}

        {activeTab !== 4 && (
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
