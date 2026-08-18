import { describe, it, expect } from 'vitest';
import { calculateNextDueDate } from './taskScheduler';
import type { PatientHealthTask } from '../lib/database';

const baseTask = (overrides: Partial<PatientHealthTask> = {}): PatientHealthTask => ({
  id: 'test-id',
  patient_id: 1,
  health_record_type: '血壓',
  frequency_unit: 'weekly',
  frequency_value: 1,
  specific_times: ['09:00'],
  next_due_at: '',
  created_at: '',
  updated_at: '',
  is_recurring: true,
  ...overrides,
});

describe('calculateNextDueDate', () => {
  it('週一建立週一、週二任務，下次到期應為當天週一', () => {
    const monday = new Date('2026-08-17T10:00:00+08:00'); // 週一
    const task = baseTask({ specific_days_of_week: [1, 2] });
    const result = calculateNextDueDate(task, monday);
    expect(result.getDay()).toBe(1); // 週一
    expect(result.getDate()).toBe(17);
    expect(result.getHours()).toBe(9);
    expect(result.getMinutes()).toBe(0);
  });

  it('週一建立週三、週五任務，下次到期應為週三', () => {
    const monday = new Date('2026-08-17T10:00:00+08:00');
    const task = baseTask({ specific_days_of_week: [3, 5] });
    const result = calculateNextDueDate(task, monday);
    expect(result.getDay()).toBe(3); // 週三
    expect(result.getDate()).toBe(19);
  });

  it('週日建立週一、週二任務，下次到期應為週一', () => {
    const sunday = new Date('2026-08-16T10:00:00+08:00'); // 週日
    const task = baseTask({ specific_days_of_week: [1, 2] });
    const result = calculateNextDueDate(task, sunday);
    expect(result.getDay()).toBe(1); // 週一
    expect(result.getDate()).toBe(17);
  });

  it('週六建立週日任務，下次到期應為週日', () => {
    const saturday = new Date('2026-08-15T10:00:00+08:00'); // 週六
    const task = baseTask({ specific_days_of_week: [7] });
    const result = calculateNextDueDate(task, saturday);
    expect(result.getDay()).toBe(0); // 週日
    expect(result.getDate()).toBe(16);
  });
});
