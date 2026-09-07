// 糖尿病／降血壓藥物「藥物調節」監測提醒的檢查邏輯。
//
// 規則：院友有標籤藥（藥物資料庫 is_diabetic_drug / is_antihypertensive_drug）的在服處方，
// 而該處方最後修改時間之後，沒有對應的「藥物調節」監測任務
// （糖尿病藥 → 血糖值；降血壓藥 → 生命表徵），即列入提醒。
// 「不再提醒」按 院友+藥物+監測類型 存於 localStorage，永久壓制該項提醒。

export interface DrugAdjustmentReminderItem {
  patient_id: number;
  medication_name: string;
  tag: 'diabetic' | 'antihypertensive';
  /** TaskModal prefill 用：血壓會由 TaskModal 合併為「生命表徵」任務 */
  vitalType: '血糖值' | '血壓';
  /** 實際檢查對應的任務 health_record_type */
  taskType: '血糖值' | '生命表徵';
}

export const DRUG_ADJUST_TASK_NOTES = '藥物調節';

const DISMISS_STORAGE_KEY = 'drug_adjustment_reminder_dismissed';

export const drugAdjustItemKey = (item: Pick<DrugAdjustmentReminderItem, 'patient_id' | 'medication_name' | 'taskType'>): string =>
  `${item.patient_id}|${item.medication_name}|${item.taskType}`;

export function getDismissedDrugAdjustKeys(): Set<string> {
  try {
    const raw = localStorage.getItem(DISMISS_STORAGE_KEY);
    const arr = raw ? JSON.parse(raw) : [];
    return new Set(Array.isArray(arr) ? arr.map(String) : []);
  } catch {
    return new Set();
  }
}

export function dismissDrugAdjustItem(key: string): void {
  try {
    const set = getDismissedDrugAdjustKeys();
    set.add(key);
    localStorage.setItem(DISMISS_STORAGE_KEY, JSON.stringify([...set]));
  } catch { /* ignore */ }
}

const parseTime = (s?: string | null): number => {
  const t = Date.parse(String(s ?? ''));
  return Number.isFinite(t) ? t : 0;
};

/**
 * 計算需要提醒的藥物調節監測項目。
 * @param dismissedKeys 已被用戶選「不再提醒」的項目 key（見 drugAdjustItemKey）
 */
export function findDrugAdjustmentReminders(
  prescriptions: any[],
  tasks: any[],
  drugDatabase: any[],
  dismissedKeys: Set<string>,
): DrugAdjustmentReminderItem[] {
  // 標籤藥清單
  const tagged = new Map<string, { diabetic: boolean; bp: boolean }>();
  for (const d of drugDatabase || []) {
    const name = String(d?.drug_name ?? '').trim();
    if (!name) continue;
    if (d.is_diabetic_drug || d.is_antihypertensive_drug) {
      const prev = tagged.get(name) ?? { diabetic: false, bp: false };
      tagged.set(name, {
        diabetic: prev.diabetic || Boolean(d.is_diabetic_drug),
        bp: prev.bp || Boolean(d.is_antihypertensive_drug),
      });
    }
  }
  if (tagged.size === 0) return [];

  // 每名院友每隻標籤藥的在服處方最後修改時間（取最大）
  const latestRxUpdate = new Map<string, number>();
  for (const rx of prescriptions || []) {
    if (rx?.status !== 'active') continue;
    const name = String(rx?.medication_name ?? '').trim();
    if (!tagged.has(name)) continue;
    const key = `${rx.patient_id}|${name}`;
    const ts = parseTime(rx.updated_at || rx.created_at);
    if (ts > (latestRxUpdate.get(key) ?? 0)) latestRxUpdate.set(key, ts);
  }

  const items: DrugAdjustmentReminderItem[] = [];
  for (const [key, rxTs] of latestRxUpdate) {
    const sep = key.indexOf('|');
    const patientId = Number(key.slice(0, sep));
    const name = key.slice(sep + 1);
    const tags = tagged.get(name)!;
    const combos: Array<Pick<DrugAdjustmentReminderItem, 'tag' | 'vitalType' | 'taskType'>> = [];
    if (tags.diabetic) combos.push({ tag: 'diabetic', vitalType: '血糖值', taskType: '血糖值' });
    if (tags.bp) combos.push({ tag: 'antihypertensive', vitalType: '血壓', taskType: '生命表徵' });
    for (const combo of combos) {
      const item: DrugAdjustmentReminderItem = { patient_id: patientId, medication_name: name, ...combo };
      if (dismissedKeys.has(drugAdjustItemKey(item))) continue;
      const hasTask = (tasks || []).some((t) =>
        t?.patient_id === patientId &&
        t?.notes === DRUG_ADJUST_TASK_NOTES &&
        t?.health_record_type === combo.taskType &&
        parseTime(t.created_at) >= rxTs
      );
      if (!hasTask) items.push(item);
    }
  }
  return items;
}

/**
 * 判斷一次處方儲存是否觸發藥物調節提醒。
 * 觸發條件（藥物有標籤，且符合以下任一）：
 *   1. 新增處方，該院友在服處方無同名藥（全新加入）
 *   2. 新增處方，同名在服處方的劑量有變
 *   3. 直接在在服處方內更改劑量
 * @returns 觸發的提醒項目（可能同時觸發糖尿病及降血壓兩項），無觸發則為空陣列
 */
export function getDrugAdjustmentTriggersForSave(args: {
  isNew: boolean;
  patientId: number;
  medicationName: string;
  newDosageAmount?: string;
  newDosageUnit?: string;
  originalDosageAmount?: string;
  originalDosageUnit?: string;
  originalStatus?: string;
  prescriptions: any[];
  drugDatabase: any[];
}): DrugAdjustmentReminderItem[] {
  const name = String(args.medicationName ?? '').trim();
  if (!name || !args.patientId) return [];
  const drug = (args.drugDatabase || []).find((d) => String(d?.drug_name ?? '').trim() === name);
  if (!drug || (!drug.is_diabetic_drug && !drug.is_antihypertensive_drug)) return [];

  let triggered = false;
  if (args.isNew) {
    const sameNameActive = (args.prescriptions || []).filter((rx) =>
      rx?.status === 'active' &&
      rx?.patient_id === args.patientId &&
      String(rx?.medication_name ?? '').trim() === name
    );
    if (sameNameActive.length === 0) {
      triggered = true; // 全新加入
    } else {
      triggered = sameNameActive.some((rx) =>
        String(rx?.dosage_amount ?? '') !== String(args.newDosageAmount ?? '') ||
        String(rx?.dosage_unit ?? '') !== String(args.newDosageUnit ?? '')
      );
    }
  } else {
    triggered = args.originalStatus === 'active' && (
      String(args.originalDosageAmount ?? '') !== String(args.newDosageAmount ?? '') ||
      String(args.originalDosageUnit ?? '') !== String(args.newDosageUnit ?? '')
    );
  }
  if (!triggered) return [];

  const items: DrugAdjustmentReminderItem[] = [];
  if (drug.is_diabetic_drug) {
    items.push({ patient_id: args.patientId, medication_name: name, tag: 'diabetic', vitalType: '血糖值', taskType: '血糖值' });
  }
  if (drug.is_antihypertensive_drug) {
    items.push({ patient_id: args.patientId, medication_name: name, tag: 'antihypertensive', vitalType: '血壓', taskType: '生命表徵' });
  }
  return items;
}
