import { assessVitals } from '../assessVitals';

// 正常數值基準
const NORMAL = {
  血壓收縮壓: 120,
  血壓舒張壓: 80,
  血含氧量: 98,
  體溫: 36.8,
  血糖值: 6.5,
};

describe('assessVitals（生命體徵警示）', () => {

  // ─── 1. 全部正常 ────────────────────────────────────────────────────────────
  it('正常數值 → 無任何警示', () => {
    const result = assessVitals(NORMAL);
    expect(result.sbpAbnormal).toBe(false);
    expect(result.dbpAbnormal).toBe(false);
    expect(result.spo2Low).toBe(false);
    expect(result.tempAbnormal).toBe(false);
    expect(result.glucoseHigh).toBe(false);
    expect(result.glucoseLow).toBe(false);
    expect(result.hasAlert).toBe(false);
  });

  // ─── 2. 收縮壓邊界 ──────────────────────────────────────────────────────────
  describe('收縮壓（SBP）', () => {
    it('SBP 160 → 正常（不超過）', () =>
      expect(assessVitals({ 血壓收縮壓: 160 }).sbpAbnormal).toBe(false));
    it('SBP 161 → 偏高警示', () =>
      expect(assessVitals({ 血壓收縮壓: 161 }).sbpAbnormal).toBe(true));
    it('SBP 90 → 正常（不低於）', () =>
      expect(assessVitals({ 血壓收縮壓: 90 }).sbpAbnormal).toBe(false));
    it('SBP 89 → 偏低警示', () =>
      expect(assessVitals({ 血壓收縮壓: 89 }).sbpAbnormal).toBe(true));
  });

  // ─── 3. 舒張壓邊界 ──────────────────────────────────────────────────────────
  describe('舒張壓（DBP）', () => {
    it('DBP 100 → 正常', () =>
      expect(assessVitals({ 血壓舒張壓: 100 }).dbpAbnormal).toBe(false));
    it('DBP 101 → 偏高警示', () =>
      expect(assessVitals({ 血壓舒張壓: 101 }).dbpAbnormal).toBe(true));
    it('DBP 60 → 正常', () =>
      expect(assessVitals({ 血壓舒張壓: 60 }).dbpAbnormal).toBe(false));
    it('DBP 59 → 偏低警示', () =>
      expect(assessVitals({ 血壓舒張壓: 59 }).dbpAbnormal).toBe(true));
    it('SBP 或 DBP 任一異常 → bpAbnormal true', () =>
      expect(assessVitals({ 血壓收縮壓: 120, 血壓舒張壓: 59 }).bpAbnormal).toBe(true));
  });

  // ─── 4. 血氧 ────────────────────────────────────────────────────────────────
  describe('血氧（SpO2）', () => {
    it('SpO2 95 → 正常（不低於）', () =>
      expect(assessVitals({ 血含氧量: 95 }).spo2Low).toBe(false));
    it('SpO2 94 → 偏低警示', () =>
      expect(assessVitals({ 血含氧量: 94 }).spo2Low).toBe(true));
  });

  // ─── 5. 體溫 ────────────────────────────────────────────────────────────────
  describe('體溫', () => {
    it('體溫 37.5 → 正常（不超過）', () =>
      expect(assessVitals({ 體溫: 37.5 }).tempAbnormal).toBe(false));
    it('體溫 37.6 → 偏高警示', () =>
      expect(assessVitals({ 體溫: 37.6 }).tempAbnormal).toBe(true));
    it('體溫 35.5 → 正常（不低於）', () =>
      expect(assessVitals({ 體溫: 35.5 }).tempAbnormal).toBe(false));
    it('體溫 35.4 → 偏低警示', () =>
      expect(assessVitals({ 體溫: 35.4 }).tempAbnormal).toBe(true));
  });

  // ─── 6. 血糖 ────────────────────────────────────────────────────────────────
  describe('血糖', () => {
    it('血糖 11.1 → 正常（不超過）', () =>
      expect(assessVitals({ 血糖值: 11.1 }).glucoseHigh).toBe(false));
    it('血糖 11.2 → 偏高警示', () =>
      expect(assessVitals({ 血糖值: 11.2 }).glucoseHigh).toBe(true));
    it('血糖 4.0 → 正常（不低於）', () =>
      expect(assessVitals({ 血糖值: 4.0 }).glucoseLow).toBe(false));
    it('血糖 3.9 → 偏低警示', () =>
      expect(assessVitals({ 血糖值: 3.9 }).glucoseLow).toBe(true));
  });

  // ─── 7. null / undefined 安全性 ─────────────────────────────────────────────
  describe('未輸入數值不觸發警示', () => {
    it('全部 undefined → hasAlert false', () =>
      expect(assessVitals({}).hasAlert).toBe(false));
    it('null 血壓 → sbpAbnormal false', () =>
      expect(assessVitals({ 血壓收縮壓: undefined }).sbpAbnormal).toBe(false));
  });

  // ─── 8. hasAlert 複合旗標 ────────────────────────────────────────────────────
  it('任一指標異常 → hasAlert true', () =>
    expect(assessVitals({ 血含氧量: 90 }).hasAlert).toBe(true));

});
