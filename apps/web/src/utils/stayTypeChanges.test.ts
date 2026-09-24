import { describe, it, expect } from 'vitest';
import { pickDueStayTypeChanges, type StayTypeChangeLike } from './stayTypeChanges';

const makeLog = (overrides: Partial<StayTypeChangeLike> = {}): StayTypeChangeLike => ({
  id: 'log-1',
  patient_id: 1,
  event_type: '類型變更',
  event_date: '2026-09-24',
  applied: false,
  created_at: '2026-09-01T10:00:00Z',
  ...overrides,
});

const TODAY = '2026-09-24';

describe('pickDueStayTypeChanges', () => {
  it('冇到期記錄 → 回傳空陣列', () => {
    expect(pickDueStayTypeChanges([], TODAY)).toEqual([]);
    expect(
      pickDueStayTypeChanges(
        [makeLog({ event_date: '2026-09-25' })], // 未來日期
        TODAY
      )
    ).toEqual([]);
  });

  it('到期記錄 → 揀中', () => {
    const due = makeLog({ id: 'a', patient_id: 1, event_date: '2026-09-24' });
    const past = makeLog({ id: 'b', patient_id: 2, event_date: '2026-09-01' });
    const result = pickDueStayTypeChanges([due, past], TODAY);
    expect(result.map(l => l.id).sort()).toEqual(['a', 'b']);
  });

  it('同一院友多筆到期 → 只取 event_date 最新一筆', () => {
    const older = makeLog({ id: 'old', event_date: '2026-09-10' });
    const newer = makeLog({ id: 'new', event_date: '2026-09-20' });
    const result = pickDueStayTypeChanges([older, newer], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('new');
  });

  it('同一院友同日多筆到期 → 取 created_at 最新一筆', () => {
    const early = makeLog({ id: 'early', created_at: '2026-09-01T09:00:00Z' });
    const late = makeLog({ id: 'late', created_at: '2026-09-02T09:00:00Z' });
    const result = pickDueStayTypeChanges([early, late], TODAY);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('late');
  });

  it('applied=true 嘅記錄唔揀', () => {
    const done = makeLog({ id: 'done', applied: true, event_date: '2026-09-01' });
    expect(pickDueStayTypeChanges([done], TODAY)).toEqual([]);
  });

  it('未來日期唔揀', () => {
    const future = makeLog({ id: 'future', event_date: '2026-10-01' });
    expect(pickDueStayTypeChanges([future], TODAY)).toEqual([]);
  });

  it('非類型變更事件唔揀', () => {
    const admission = makeLog({ id: 'adm', event_type: '入住', event_date: '2026-09-01' });
    const discharge = makeLog({ id: 'dis', event_type: '退住', event_date: '2026-09-01' });
    expect(pickDueStayTypeChanges([admission, discharge], TODAY)).toEqual([]);
  });

  it('唔同院友各自獨立揀最新一筆', () => {
    const p1 = makeLog({ id: 'p1', patient_id: 1, event_date: '2026-09-20' });
    const p2old = makeLog({ id: 'p2-old', patient_id: 2, event_date: '2026-09-01' });
    const p2new = makeLog({ id: 'p2-new', patient_id: 2, event_date: '2026-09-15' });
    const result = pickDueStayTypeChanges([p1, p2old, p2new], TODAY);
    expect(result.map(l => l.id).sort()).toEqual(['p1', 'p2-new']);
  });
});
