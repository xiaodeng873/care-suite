import { describe, it, expect } from 'vitest';
import type { Patient, Bed } from '../lib/database';
import {
  isTemporaryTransfer,
  getRootBed,
  getRootBedNumber,
  getRootBedId,
  getPrintBedNumber,
} from './bedTransferUtils';

const beds: Bed[] = [
  { id: 'bed-a', station_id: 's1', bed_number: 'A101-1', is_occupied: true, qr_code_id: 'q1', room_id: 'r1', bed_no: '1' },
  { id: 'bed-b', station_id: 's1', bed_number: 'A102-2', is_occupied: true, qr_code_id: 'q2', room_id: 'r1', bed_no: '2' },
];

const makePatient = (overrides: Partial<Patient> = {}): Patient =>
  ({
    院友id: 1,
    中文姓名: '張三',
    中文姓氏: '張',
    中文名字: '三',
    性別: '男',
    身份證號碼: 'A123456',
    床號: 'A101-1',
    bed_id: 'bed-a',
    ...overrides,
  } as Patient);

describe('isTemporaryTransfer', () => {
  it('returns false for routine patient', () => {
    const p = makePatient({ bed_transfer_type: 'routine', original_bed_id: 'bed-a' });
    expect(isTemporaryTransfer(p)).toBe(false);
  });

  it('returns true only when type is temporary and original_bed_id exists', () => {
    expect(isTemporaryTransfer(makePatient({ bed_transfer_type: 'temporary', original_bed_id: 'bed-b' }))).toBe(true);
    expect(isTemporaryTransfer(makePatient({ bed_transfer_type: 'temporary' }))).toBe(false);
    expect(isTemporaryTransfer(makePatient({ original_bed_id: 'bed-b' }))).toBe(false);
  });
});

describe('getRootBed / getRootBedNumber / getRootBedId', () => {
  it('routine patient: root bed equals current bed', () => {
    const p = makePatient({ bed_transfer_type: 'routine', original_bed_id: 'bed-a', bed_id: 'bed-a', 床號: 'A101-1' });
    expect(getRootBed(p, beds)?.bed_number).toBe('A101-1');
    expect(getRootBedNumber(p, beds)).toBe('A101-1');
    expect(getRootBedId(p)).toBe('bed-a');
  });

  it('temporary patient: root bed is original bed, not current bed', () => {
    const p = makePatient({
      bed_transfer_type: 'temporary',
      original_bed_id: 'bed-b',
      bed_id: 'bed-a',
      床號: 'A101-1',
      original_bed_number: 'A102-2',
    });
    expect(getRootBed(p, beds)?.bed_number).toBe('A102-2');
    expect(getRootBedNumber(p, beds)).toBe('A102-2');
    expect(getRootBedId(p)).toBe('bed-b');
  });

  it('falls back to original_bed_number when beds array is missing', () => {
    const p = makePatient({
      bed_transfer_type: 'temporary',
      original_bed_id: 'bed-b',
      bed_id: 'bed-a',
      床號: 'A101-1',
      original_bed_number: 'A102-2',
    });
    expect(getRootBedNumber(p)).toBe('A102-2');
  });

  it('falls back to current bed number when no root info exists', () => {
    const p = makePatient({ 床號: 'A101-1' });
    expect(getRootBedNumber(p)).toBe('A101-1');
    expect(getRootBedId(p)).toBe('bed-a');
  });
});

describe('getPrintBedNumber', () => {
  it('uses original_bed_number for print when available', () => {
    const p = makePatient({ 床號: 'A101-1', original_bed_number: 'A102-2' });
    expect(getPrintBedNumber(p)).toBe('A102-2');
  });

  it('falls back to current bed number when original_bed_number is absent', () => {
    const p = makePatient({ 床號: 'A101-1' });
    expect(getPrintBedNumber(p)).toBe('A101-1');
  });
});
