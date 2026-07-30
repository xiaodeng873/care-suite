import type { Patient, Bed, BedTransferLogEntry, BedTransferActionType, BedTransferType } from '../lib/database';
import { getBeds } from '../lib/database';

export function isTemporaryTransfer(patient: Patient): boolean {
  return patient.bed_transfer_type === 'temporary' && !!patient.original_bed_id;
}

export function getDisplayBedNumber(patient: Patient): string {
  return patient.床號 || '';
}

export function getRootBed(patient: Patient, beds?: Bed[]): Bed | undefined {
  if (!isTemporaryTransfer(patient)) {
    return beds?.find(b => b.id === patient.bed_id) || undefined;
  }
  return beds?.find(b => b.id === patient.original_bed_id) || undefined;
}

export function getRootBedNumber(patient: Patient, beds?: Bed[]): string {
  if (patient.original_bed_number) return patient.original_bed_number;
  if (beds && beds.length > 0) {
    const root = getRootBed(patient, beds);
    return root?.bed_number || patient.床號 || '';
  }
  return patient.床號 || '';
}

export function getPrintBedNumber(patient: { original_bed_number?: string | null; 床號?: string | null; [key: string]: any }): string {
  return patient.original_bed_number || patient.床號 || '';
}

export async function enrichPatientsWithOriginalBedNumber<T extends { original_bed_id?: string | null; 床號?: string | null }>(
  patients: T[]
): Promise<(T & { original_bed_number?: string })[]> {
  if (patients.length === 0) return patients as (T & { original_bed_number?: string })[];
  const beds = await getBeds();
  const bedMap = new Map(beds.map(b => [b.id, b.bed_number]));
  return patients.map(p => ({
    ...p,
    original_bed_number: p.original_bed_id ? bedMap.get(p.original_bed_id) || p.床號 : p.床號,
  })) as (T & { original_bed_number?: string })[];
}

export function getRootBedId(patient: Patient): string | undefined {
  if (!isTemporaryTransfer(patient)) return patient.bed_id;
  return patient.original_bed_id;
}

export interface BedTransferActor {
  user_id?: string;
  username?: string;
  name?: string;
  role?: string;
  department?: string;
}

export function buildActorForLog(
  user: any,
  userProfile: any
): BedTransferLogEntry['actor_user_id'] extends string ? BedTransferActor : BedTransferActor {
  return {
    user_id: user?.id,
    username: userProfile?.username || user?.email,
    name: userProfile?.display_name || user?.user_metadata?.display_name || user?.email,
    role: userProfile?.role,
    department: userProfile?.department,
  };
}

export function bedTransferActorToLogFields(actor: BedTransferActor): Pick<BedTransferLogEntry, 'actor_user_id' | 'actor_username' | 'actor_name' | 'actor_role' | 'actor_department'> {
  return {
    actor_user_id: actor.user_id || null,
    actor_username: actor.username || null,
    actor_name: actor.name || null,
    actor_role: actor.role || null,
    actor_department: actor.department || null,
  };
}
