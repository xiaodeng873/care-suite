import { filterPrescriptions } from '../filterPrescriptions';
import type { MedicationPrescription } from '../usePrescriptions';
import type { Resident } from '@/features/residents/types';

// ─── 最小假資料 ───────────────────────────────────────────────────────────────

function makeRx(overrides: Partial<MedicationPrescription>): MedicationPrescription {
  return {
    id: '1',
    patient_id: 1,
    medication_name: 'Aspirin',
    prescription_date: '2026-01-01',
    start_date: '2026-01-01',
    frequency_type: 'QD',
    status: 'active',
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeResident(overrides: Partial<Resident>): Resident {
  return {
    院友id: 1,
    中文姓名: '陳大明',
    英文姓名: 'Chan Tai Ming',
    床號: 'A01',
    性別: '男',
    護理等級: '全護理',
    入住日期: '2025-01-01',
    感染控制: [],
    ...overrides,
  };
}

const RX_ACTIVE = makeRx({ id: '1', patient_id: 1, medication_name: 'Aspirin', status: 'active' });
const RX_INACTIVE = makeRx({ id: '2', patient_id: 2, medication_name: 'Metformin', status: 'inactive' });
const RX_PENDING = makeRx({ id: '3', patient_id: 1, medication_name: 'Lisinopril', status: 'pending_change' });

const RES_1 = makeResident({ 院友id: 1, 中文姓名: '陳大明', 床號: 'A01' });
const RES_2 = makeResident({ 院友id: 2, 中文姓名: '李小花', 床號: 'B02' });

const ALL_RX = [RX_ACTIVE, RX_INACTIVE, RX_PENDING];
const ALL_RES = [RES_1, RES_2];

// ─── 測試 ────────────────────────────────────────────────────────────────────

describe('filterPrescriptions', () => {

  // ─── 1. 空查詢 + all → 全部回傳（探針彈）────────────────────────────────────
  it('空查詢 + all 狀態 → 回傳全部處方', () => {
    const result = filterPrescriptions(ALL_RX, ALL_RES, '', 'all');
    expect(result).toHaveLength(3);
  });

  // ─── 2. 狀態過濾 ────────────────────────────────────────────────────────────
  describe('狀態過濾', () => {
    it("status='active' → 只回傳有效處方", () => {
      const result = filterPrescriptions(ALL_RX, ALL_RES, '', 'active');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('1');
    });

    it("status='inactive' → 只回傳停用處方", () => {
      const result = filterPrescriptions(ALL_RX, ALL_RES, '', 'inactive');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });

    it("status='pending_change' → 只回傳待更改處方", () => {
      const result = filterPrescriptions(ALL_RX, ALL_RES, '', 'pending_change');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('3');
    });
  });

  // ─── 3. 文字搜尋（三個欄位）────────────────────────────────────────────────
  describe('文字搜尋', () => {
    it('搜尋藥品名稱（英文）', () => {
      const result = filterPrescriptions(ALL_RX, ALL_RES, 'aspirin', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].medication_name).toBe('Aspirin');
    });

    it('搜尋院友中文姓名', () => {
      // RX_ACTIVE + RX_PENDING 屬於 院友id=1（陳大明），RX_INACTIVE 屬於 院友id=2（李小花）
      const result = filterPrescriptions(ALL_RX, ALL_RES, '陳大明', 'all');
      expect(result).toHaveLength(2);
    });

    it('搜尋院友床號', () => {
      const result = filterPrescriptions(ALL_RX, ALL_RES, 'B02', 'all');
      expect(result).toHaveLength(1);
      expect(result[0].id).toBe('2');
    });
  });

  // ─── 4. 邊界情境 ─────────────────────────────────────────────────────────────
  describe('邊界情境', () => {
    it('純空白查詢視為空 → 不套文字過濾', () => {
      const result = filterPrescriptions(ALL_RX, ALL_RES, '   ', 'all');
      expect(result).toHaveLength(3);
    });

    it('大小寫不分（藥品名稱）', () => {
      const result = filterPrescriptions(ALL_RX, ALL_RES, 'ASPIRIN', 'all');
      expect(result).toHaveLength(1);
    });

    it('查詢到找不到的詞 → 空陣列', () => {
      const result = filterPrescriptions(ALL_RX, ALL_RES, 'xxxxxx', 'all');
      expect(result).toHaveLength(0);
    });
  });

  // ─── 5. 狀態 + 文字組合過濾 ─────────────────────────────────────────────────
  it('status=active 且搜尋藥品名 → 組合過濾', () => {
    // ALL_RX 中只有 RX_ACTIVE 是 active 且名稱含 'aspirin'
    const result = filterPrescriptions(ALL_RX, ALL_RES, 'aspirin', 'active');
    expect(result).toHaveLength(1);
    expect(result[0].status).toBe('active');
  });

  it('status=inactive 且搜尋第一位院友名字 → 空（停用的不屬於陳大明）', () => {
    const result = filterPrescriptions(ALL_RX, ALL_RES, '陳大明', 'inactive');
    expect(result).toHaveLength(0);
  });

});
