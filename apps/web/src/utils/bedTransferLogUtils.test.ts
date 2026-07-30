import { describe, it, expect } from 'vitest';
import type { BedTransferLogEntry } from '../lib/database';
import {
  ACTION_TYPE_LABELS,
  formatBedTransferDescription,
  buildBedTransferLogEntry,
  generateGroupId,
} from './bedTransferLogUtils';

const actor = {
  user_id: 'u1',
  username: 'admin',
  name: 'Admin User',
  role: '護士',
  department: '護理部',
};

const makeEntry = (overrides: Partial<BedTransferLogEntry> = {}): BedTransferLogEntry =>
  ({
    id: 'log-1',
    patient_id: 1,
    patient_name: '測試院友',
    from_bed_id: 'bed-a',
    to_bed_id: 'bed-b',
    from_bed_number: 'A101-1',
    to_bed_number: 'A102-2',
    action_type: 'routine_transfer',
    transfer_subtype: null,
    notes: null,
    group_id: null,
    actor_user_id: actor.user_id,
    actor_username: actor.username,
    actor_name: actor.name,
    actor_role: actor.role,
    actor_department: actor.department,
    created_at: '2026-07-29T10:00:00Z',
    ...overrides,
  } as BedTransferLogEntry);

describe('ACTION_TYPE_LABELS', () => {
  it('contains labels for all action types', () => {
    expect(ACTION_TYPE_LABELS.admission).toBe('入住');
    expect(ACTION_TYPE_LABELS.routine_transfer).toBe('常規調動');
    expect(ACTION_TYPE_LABELS.temporary_transfer).toBe('暫時性調動');
    expect(ACTION_TYPE_LABELS.cancel_temporary).toBe('取消暫時性調動');
    expect(ACTION_TYPE_LABELS.original_bed_change).toBe('更改原床位');
  });
});

describe('formatBedTransferDescription', () => {
  it('describes routine transfer', () => {
    expect(formatBedTransferDescription(makeEntry())).toBe('常規調動 A101-1 → A102-2');
  });

  it('describes temporary transfer', () => {
    const e = makeEntry({ action_type: 'temporary_transfer' });
    expect(formatBedTransferDescription(e)).toBe('暫時性調動 A101-1 → A102-2');
  });

  it('describes swap', () => {
    const e = makeEntry({ action_type: 'swap' });
    expect(formatBedTransferDescription(e)).toBe('床位互換 A101-1 ↔ A102-2');
  });

  it('describes return to root bed', () => {
    const e = makeEntry({ action_type: 'return', to_bed_number: 'A101-1' });
    expect(formatBedTransferDescription(e)).toBe('返回原床 A101-1');
  });

  it('describes failed cancel due to root bed occupied', () => {
    const e = makeEntry({
      action_type: 'cancel_temporary',
      transfer_subtype: 'failed_root_occupied',
      to_bed_number: 'A101-1',
    });
    expect(formatBedTransferDescription(e)).toContain('取消暫時性調動失敗');
    expect(formatBedTransferDescription(e)).toContain('A101-1');
  });

  it('describes successful cancel temporary', () => {
    const e = makeEntry({ action_type: 'cancel_temporary', to_bed_number: 'A101-1' });
    expect(formatBedTransferDescription(e)).toBe('取消暫時性調動並返回原床 A101-1');
  });

  it('describes swap pair cancel', () => {
    const e = makeEntry({
      action_type: 'cancel_temporary',
      transfer_subtype: 'swap_pair',
      to_bed_number: 'A101-1',
    });
    expect(formatBedTransferDescription(e)).toBe('成對取消暫時性互換並返回原床 A101-1');
  });

  it('describes original bed change', () => {
    const e = makeEntry({ action_type: 'original_bed_change' });
    expect(formatBedTransferDescription(e)).toBe('更改原床位 A101-1 → A102-2');
  });
});

describe('buildBedTransferLogEntry', () => {
  it('builds a log entry with actor fields and preserves nulls', () => {
    const entry = buildBedTransferLogEntry({
      patientId: 1,
      fromBedId: 'bed-a',
      toBedId: 'bed-b',
      fromBedNumber: 'A101-1',
      toBedNumber: 'A102-2',
      actionType: 'temporary_transfer',
      actor,
    });

    expect(entry.patient_id).toBe(1);
    expect(entry.action_type).toBe('temporary_transfer');
    expect(entry.from_bed_number).toBe('A101-1');
    expect(entry.to_bed_number).toBe('A102-2');
    expect(entry.actor_name).toBe('Admin User');
    expect(entry.actor_role).toBe('護士');
    expect(entry.actor_department).toBe('護理部');
    expect(entry.patient_name).toBeNull();
  });

  it('builds a log entry with patient name', () => {
    const entry = buildBedTransferLogEntry({
      patientId: 1,
      patientName: '陳大文',
      fromBedId: 'bed-a',
      toBedId: 'bed-b',
      fromBedNumber: 'A101-1',
      toBedNumber: 'A102-2',
      actionType: 'routine_transfer',
      actor,
    });
    expect(entry.patient_id).toBe(1);
    expect(entry.patient_name).toBe('陳大文');
  });

  it('builds a return entry', () => {
    const entry = buildBedTransferLogEntry({
      patientId: 2,
      fromBedId: 'bed-b',
      toBedId: 'bed-a',
      fromBedNumber: 'A102-2',
      toBedNumber: 'A101-1',
      actionType: 'return',
      actor,
    });
    expect(entry.action_type).toBe('return');
    expect(entry.to_bed_number).toBe('A101-1');
  });

  it('builds a cancel temporary entry', () => {
    const entry = buildBedTransferLogEntry({
      patientId: 3,
      fromBedId: 'bed-a',
      toBedId: 'bed-b',
      fromBedNumber: 'A101-1',
      toBedNumber: 'A102-2',
      actionType: 'cancel_temporary',
      transferSubtype: 'failed_root_occupied',
      actor,
    });
    expect(entry.action_type).toBe('cancel_temporary');
    expect(entry.transfer_subtype).toBe('failed_root_occupied');
  });

  it('builds an original bed change entry', () => {
    const entry = buildBedTransferLogEntry({
      patientId: 4,
      fromBedId: 'bed-a',
      toBedId: 'bed-c',
      fromBedNumber: 'A101-1',
      toBedNumber: 'A103-3',
      actionType: 'original_bed_change',
      actor,
    });
    expect(entry.action_type).toBe('original_bed_change');
    expect(entry.to_bed_number).toBe('A103-3');
  });
});

describe('generateGroupId', () => {
  it('returns unique ids', () => {
    const a = generateGroupId();
    const b = generateGroupId();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[0-9a-f-]{36}$/);
  });
});
