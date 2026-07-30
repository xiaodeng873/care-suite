import type { BedTransferLogEntry, BedTransferActionType } from '../lib/database';
import type { BedTransferActor } from './bedTransferUtils';
import { bedTransferActorToLogFields } from './bedTransferUtils';

export const ACTION_TYPE_LABELS: Record<BedTransferActionType, string> = {
  admission: '入住',
  discharge: '退住',
  routine_transfer: '常規調動',
  temporary_transfer: '暫時性調動',
  swap: '床位互換',
  return: '返回原床',
  cancel_temporary: '取消暫時性調動',
  original_bed_change: '更改原床位',
};

export const ACTION_TYPE_STYLES: Record<BedTransferActionType, string> = {
  admission: 'bg-green-100 text-green-700 border-green-200',
  discharge: 'bg-gray-100 text-gray-700 border-gray-200',
  routine_transfer: 'bg-blue-100 text-blue-700 border-blue-200',
  temporary_transfer: 'bg-amber-100 text-amber-700 border-amber-200',
  swap: 'bg-purple-100 text-purple-700 border-purple-200',
  return: 'bg-teal-100 text-teal-700 border-teal-200',
  cancel_temporary: 'bg-orange-100 text-orange-700 border-orange-200',
  original_bed_change: 'bg-indigo-100 text-indigo-700 border-indigo-200',
};

export interface BedTransferLogPayload {
  patientId: number;
  patientName?: string | null;
  fromBedId?: string | null;
  toBedId?: string | null;
  fromBedNumber?: string | null;
  toBedNumber?: string | null;
  actionType: BedTransferActionType;
  transferSubtype?: string | null;
  actor: BedTransferActor;
  notes?: string | null;
  groupId?: string | null;
}

export function buildBedTransferLogEntry(
  payload: BedTransferLogPayload
): Omit<BedTransferLogEntry, 'id' | 'created_at'> {
  return {
    patient_id: payload.patientId,
    patient_name: payload.patientName ?? null,
    from_bed_id: payload.fromBedId ?? null,
    to_bed_id: payload.toBedId ?? null,
    from_bed_number: payload.fromBedNumber ?? null,
    to_bed_number: payload.toBedNumber ?? null,
    action_type: payload.actionType,
    transfer_subtype: payload.transferSubtype ?? null,
    notes: payload.notes ?? null,
    group_id: payload.groupId ?? null,
    ...bedTransferActorToLogFields(payload.actor),
  };
}

export function formatBedTransferDescription(entry: BedTransferLogEntry): string {
  const label = ACTION_TYPE_LABELS[entry.action_type] || entry.action_type;

  switch (entry.action_type) {
    case 'admission':
      return `入住 ${entry.to_bed_number || '未知床位'}`;
    case 'discharge':
      return `從 ${entry.from_bed_number || '未知床位'} 退住`;
    case 'routine_transfer':
      return `常規調動 ${entry.from_bed_number || '—'} → ${entry.to_bed_number || '—'}`;
    case 'temporary_transfer':
      return `暫時性調動 ${entry.from_bed_number || '—'} → ${entry.to_bed_number || '—'}`;
    case 'swap':
      return `床位互換 ${entry.from_bed_number || '—'} ↔ ${entry.to_bed_number || '—'}`;
    case 'return':
      return `返回原床 ${entry.to_bed_number || '—'}`;
    case 'cancel_temporary':
      if (entry.transfer_subtype === 'failed_root_occupied') {
        return `取消暫時性調動失敗：原床 ${entry.to_bed_number || '—'} 已被佔用，院友困在現床`;
      }
      if (entry.transfer_subtype === 'swap_pair') {
        return `成對取消暫時性互換並返回原床 ${entry.to_bed_number || '—'}`;
      }
      return `取消暫時性調動並返回原床 ${entry.to_bed_number || '—'}`;
    case 'original_bed_change':
      return `更改原床位 ${entry.from_bed_number || '—'} → ${entry.to_bed_number || '—'}`;
    default:
      return `${label} ${entry.from_bed_number || '—'} → ${entry.to_bed_number || '—'}`;
  }
}

export function formatTimestamp(iso: string): string {
  try {
    const d = new Date(iso);
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
  } catch {
    return iso;
  }
}

export function generateGroupId(): string {
  return crypto.randomUUID();
}
