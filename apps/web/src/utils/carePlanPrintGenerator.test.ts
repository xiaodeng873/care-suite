import { describe, it, expect, vi, beforeAll, afterAll, beforeEach } from 'vitest';
import type { Patient, CarePlanWithDetails } from '../lib/database';

const getFacilitySettingsMock = vi.fn();
const getDiagnosisRecordsByPatientIdMock = vi.fn();
const getPreviousCarePlanReviewDateMock = vi.fn();

vi.mock('./facilitySettings', () => ({
  getFacilitySettings: getFacilitySettingsMock,
}));

vi.mock('../lib/database', async (importOriginal) => {
  const original = await importOriginal<typeof import('../lib/database')>();
  return {
    ...original,
    getDiagnosisRecordsByPatientId: getDiagnosisRecordsByPatientIdMock,
    getPreviousCarePlanReviewDate: getPreviousCarePlanReviewDateMock,
  };
});

const { printCarePlan } = await import('./carePlanPrintGenerator');

describe('carePlanPrintGenerator', () => {
  const originalDocument = globalThis.document;
  const originalAlert = globalThis.alert;

  beforeAll(() => {
    const eventHandlers: Record<string, Array<() => void>> = {};
    const fakeIframe = {
      id: '',
      style: {} as CSSStyleDeclaration,
      contentWindow: {
        document: {
          open: vi.fn(),
          write: vi.fn(),
          close: vi.fn(),
        },
        focus: vi.fn(),
        print: vi.fn(),
        addEventListener: (event: string, handler: () => void) => {
          if (!eventHandlers[event]) eventHandlers[event] = [];
          eventHandlers[event].push(handler);
        },
      } as unknown as Window,
      remove: vi.fn(),
    };

    const fakeDocument = {
      createElement: vi.fn(() => fakeIframe),
      body: {
        appendChild: vi.fn(),
      },
    };

    (globalThis as unknown as Record<string, unknown>).document = fakeDocument as unknown as Document;
    (globalThis as unknown as Record<string, unknown>).__fakeIframeEventHandlers = eventHandlers;
    (globalThis as unknown as Record<string, unknown>).__fakeIframe = fakeIframe;
  });

  afterAll(() => {
    (globalThis as unknown as Record<string, unknown>).document = originalDocument as Document;
    globalThis.alert = originalAlert;
  });

  beforeEach(() => {
    getFacilitySettingsMock.mockReset();
    getDiagnosisRecordsByPatientIdMock.mockReset();
    getPreviousCarePlanReviewDateMock.mockReset();
    globalThis.alert = vi.fn();
  });

  const basePatient = {
    院友id: 1,
    中文姓氏: '張',
    中文名字: '三',
    中文姓名: '張三',
    出生日期: '1944-01-01',
    入住日期: '2024-01-01',
    bed_id: null,
  } as unknown as Patient;

  const baseCarePlan = {
    id: 'plan-1',
    patient_id: 1,
    plan_date: '2024-01-01',
    plan_type: '年度計劃',
    status: '生效中',
    problems: [],
    nursing_needs: [],
    problem_count: 0,
    version_number: 1,
    created_at: '2024-01-01T00:00:00Z',
    updated_at: '2024-01-01T00:00:00Z',
  } as unknown as CarePlanWithDetails;

  it('calls getFacilitySettings when printing a care plan', async () => {
    getFacilitySettingsMock.mockResolvedValue({ facilityNameZh: 'Test Facility' });
    getDiagnosisRecordsByPatientIdMock.mockResolvedValue([]);
    getPreviousCarePlanReviewDateMock.mockResolvedValue(null);

    await printCarePlan({ patient: basePatient, carePlan: baseCarePlan });

    expect(getFacilitySettingsMock).toHaveBeenCalled();
    expect(getDiagnosisRecordsByPatientIdMock).toHaveBeenCalledWith(1);
    expect(getPreviousCarePlanReviewDateMock).toHaveBeenCalledWith('plan-1');
  });

  it('falls back to empty facility name when getFacilitySettings fails', async () => {
    getFacilitySettingsMock.mockRejectedValue(new Error('facility settings unavailable'));
    getDiagnosisRecordsByPatientIdMock.mockResolvedValue([]);
    getPreviousCarePlanReviewDateMock.mockResolvedValue(null);

    await printCarePlan({ patient: basePatient, carePlan: baseCarePlan });

    expect(getFacilitySettingsMock).toHaveBeenCalled();
    expect(globalThis.alert).not.toHaveBeenCalled();
  });

  it('alerts when iframe document cannot be created', async () => {
    getFacilitySettingsMock.mockResolvedValue({ facilityNameZh: 'Test Facility' });
    getDiagnosisRecordsByPatientIdMock.mockResolvedValue([]);
    getPreviousCarePlanReviewDateMock.mockResolvedValue(null);

    const fakeIframeWithoutDoc = {
      id: '',
      style: {} as CSSStyleDeclaration,
      contentWindow: null,
      remove: vi.fn(),
    };
    (globalThis.document as unknown as { createElement: () => unknown }).createElement = vi.fn(() => fakeIframeWithoutDoc);

    await printCarePlan({ patient: basePatient, carePlan: baseCarePlan });

    expect(globalThis.alert).toHaveBeenCalledWith('無法建立列印文件');
  });
});
