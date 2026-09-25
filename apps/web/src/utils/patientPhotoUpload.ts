import { uploadImage, deleteImageByUrl, isStorageUrl } from './storageUpload';

export const PATIENT_PHOTOS_BUCKET = 'patient-photos';
export const PRESCRIPTION_IMAGES_BUCKET = 'prescription-images';

export type PatientPhotoKind = 'photo' | 'hd' | 'idcard';

/**
 * 上傳院友相片到 patient-photos bucket
 * object path：`${patientId}/${kind}-${uuid}.jpg`（patientId 只做前綴分類，檔名仍係 uuid）
 */
export async function uploadPatientPhoto(
  patientId: number,
  kind: PatientPhotoKind,
  blob: Blob,
): Promise<string> {
  return uploadImage(PATIENT_PHOTOS_BUCKET, blob, 'jpg', `${patientId}/${kind}-`);
}

/** 刪除院友相片：非 Storage URL（base64 / 空值）直接略過 */
export async function deletePatientPhotoByUrl(url: string): Promise<void> {
  if (!isStorageUrl(url)) return;
  await deleteImageByUrl(PATIENT_PHOTOS_BUCKET, url);
}
