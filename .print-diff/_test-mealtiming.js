const esbuild = require('esbuild');
const path = require('path');
const r = esbuild.buildSync({
  entryPoints: [path.resolve('../apps/web/src/utils/mealTiming.ts')],
  bundle: true, write: false, format: 'cjs', platform: 'node',
});
const m = { exports: {} };
new Function('module', 'exports', r.outputFiles[0].text)(m, m.exports);
const { getMealTimings, formatMealTimings, formatMealTimingFrom, toMealTimingPayload } = m.exports;

const assert = (name, got, want) => console.log(JSON.stringify(got) === JSON.stringify(want) ? `OK  ${name}` : `FAIL ${name}: got ${JSON.stringify(got)} want ${JSON.stringify(want)}`);

// 舊資料 fallback
assert('legacy 1 slot', formatMealTimingFrom({ meal_timing: '餐前' }), '餐前');
assert('legacy 2 slots 或', formatMealTimingFrom({ meal_timing: '餐前', meal_timing_2: '睡前' }), '餐前 或 睡前');
assert('legacy 2 slots 及', formatMealTimingFrom({ meal_timing: '餐前', meal_timing_2: '睡前', meal_timing_connector: '及' }), '餐前 及 睡前');
// drug db 欄名
assert('drug db legacy', formatMealTimingFrom({ meal_timing_1: '早餐前', meal_timing_2: '晚餐前', meal_timing_connector: '及' }), '早餐前 及 晚餐前');
// 新 jsonb 優先
assert('jsonb 3 slots', formatMealTimingFrom({ meal_timings: { slots: ['早餐前', '午餐前', '睡前'], connectors: ['及', '或'] }, meal_timing: '餐前' }), '早餐前 及 午餐前 或 睡前');
// payload：過濾空時段 + connectors 對齊 + 舊欄同步
assert('payload filter gap', toMealTimingPayload({ slots: ['餐前', '', '睡前'], connectors: ['及', '或'] }), { meal_timings: { slots: ['餐前', '睡前'], connectors: ['或'] }, meal_timing: '餐前', meal_timing_2: '睡前', meal_timing_connector: '或' });
assert('payload empty', toMealTimingPayload({ slots: ['', ''], connectors: ['或'] }), { meal_timings: null, meal_timing: null, meal_timing_2: null, meal_timing_connector: null });
assert('payload drug key', toMealTimingPayload({ slots: ['餐前'], connectors: [] }, 'meal_timing_1'), { meal_timings: { slots: ['餐前'], connectors: [] }, meal_timing_1: '餐前', meal_timing_2: null, meal_timing_connector: null });
// 壞資料耐性
assert('jsonb connectors 不足補或', formatMealTimings({ slots: ['a', 'b', 'c'], connectors: [] }), 'a 或 b 或 c');
assert('null source', formatMealTimingFrom(null), '');
