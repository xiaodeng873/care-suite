import { filterTasks } from '../filterTasks';
import type { PatientTask } from '../useTasks';
import type { Resident } from '@/features/residents/types';

// ─── Fixtures ────────────────────────────────────────────────────────────────

function makeTask(overrides: Partial<PatientTask> & Pick<PatientTask, 'id' | 'patient_id' | 'health_record_type'>): PatientTask {
  return {
    frequency_unit: 'daily',
    frequency_value: 1,
    next_due_at: '2026-06-01',
    is_recurring: true,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  };
}

function makeResident(overrides: Partial<Resident> & Pick<Resident, '院友id' | '中文姓名' | '床號'>): Resident {
  return {
    中文姓氏: '', 中文名字: '', 性別: '男', 身份證號碼: '',
    ...overrides,
  };
}

const TASK_VITAL   = makeTask({ id: '1', patient_id: 1, health_record_type: '生命表徵' });
const TASK_GLUCOSE = makeTask({ id: '2', patient_id: 2, health_record_type: '血糖控制' });
const TASK_WOUND   = makeTask({ id: '3', patient_id: 1, health_record_type: '傷口換症' });

const RES_1 = makeResident({ 院友id: 1, 中文姓名: '陳大明', 床號: 'A01' });
const RES_2 = makeResident({ 院友id: 2, 中文姓名: '李小花', 床號: 'B02' });

const ALL_TASKS = [TASK_VITAL, TASK_GLUCOSE, TASK_WOUND];
const ALL_RES   = [RES_1, RES_2];

// ─── Tests ───────────────────────────────────────────────────────────────────

describe('filterTasks', () => {

  // 1. 探針彈
  it('空查詢 → 回傳全部工作', () => {
    expect(filterTasks(ALL_TASKS, ALL_RES, '')).toHaveLength(3);
  });

  // 2. 文字搜尋 — 工作類型
  it('搜尋工作類型', () => {
    const result = filterTasks(ALL_TASKS, ALL_RES, '血糖');
    expect(result).toHaveLength(1);
    expect(result[0].health_record_type).toBe('血糖控制');
  });

  // 3. 文字搜尋 — 院友中文姓名
  it('搜尋院友中文姓名 → 回傳該院友的所有工作', () => {
    // 院友id=1（陳大明）有 TASK_VITAL + TASK_WOUND
    const result = filterTasks(ALL_TASKS, ALL_RES, '陳大明');
    expect(result).toHaveLength(2);
  });

  // 4. 文字搜尋 — 院友床號（大小寫不分）
  it('搜尋院友床號（大小寫不分）', () => {
    const result = filterTasks(ALL_TASKS, ALL_RES, 'b02');
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  // 5. 純空白查詢視為空
  it('純空白查詢 → 不套過濾', () => {
    expect(filterTasks(ALL_TASKS, ALL_RES, '   ')).toHaveLength(3);
  });

  // 6. 查詢不到任何結果
  it('無符合結果 → 空陣列', () => {
    expect(filterTasks(ALL_TASKS, ALL_RES, 'xxxxxx')).toHaveLength(0);
  });

  // 7. 搜尋詞部分匹配
  it('部分匹配工作類型', () => {
    // '傷口' 部分匹配 '傷口換症'
    const result = filterTasks(ALL_TASKS, ALL_RES, '傷口');
    expect(result).toHaveLength(1);
  });

});
