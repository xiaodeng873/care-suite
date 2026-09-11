import { supabase } from '../context/AuthContext';

const AVATAR_BUCKET = 'avatars';
const MAX_SIZE_MB = 10;
const ALLOWED_TYPES = ['image/png', 'image/jpeg', 'image/webp'];

export interface AvatarUploadResult {
  url: string;
  path: string;
}

export interface AvatarUploadError {
  message: string;
}

export function validateAvatarFile(file: File): AvatarUploadError | null {
  if (!ALLOWED_TYPES.includes(file.type)) {
    return { message: '只支援 PNG、JPEG、WEBP 格式' };
  }
  if (file.size > MAX_SIZE_MB * 1024 * 1024) {
    return { message: `檔案大小不可超過 ${MAX_SIZE_MB}MB` };
  }
  return null;
}

/** 頭像壓縮：最闊 400px、JPEG 0.85（頭像只係細圖顯示，冇必要存原圖） */
async function compressAvatar(file: File): Promise<Blob> {
  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result as string);
    reader.onerror = () => reject(new Error('檔案讀取失敗'));
    reader.readAsDataURL(file);
  });
  const img = await new Promise<HTMLImageElement>((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error('圖片載入失敗'));
    image.src = dataUrl;
  });
  const canvas = document.createElement('canvas');
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('無法獲取 Canvas 上下文');
  const maxWidth = 400;
  let width = img.width;
  let height = img.height;
  if (width > maxWidth) {
    height = height * maxWidth / width;
    width = maxWidth;
  }
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);
  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(blob => (blob ? resolve(blob) : reject(new Error('圖片壓縮失敗'))), 'image/jpeg', 0.85);
  });
}

export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<AvatarUploadResult> {
  const validation = validateAvatarFile(file);
  if (validation) throw new Error(validation.message);

  // 上傳前一律壓縮做 JPEG
  const compressed = await compressAvatar(file);
  const path = `${userId}.jpg`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, compressed, {
      cacheControl: '3600',
      upsert: true,
      contentType: 'image/jpeg',
    });

  if (uploadError) {
    throw new Error(`上傳失敗：${uploadError.message}`);
  }

  const { data } = supabase.storage.from(AVATAR_BUCKET).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error('無法取得圖片公開連結');
  }

  // 加入時間戳避免快取
  const url = `${data.publicUrl}?t=${Date.now()}`;
  return { url, path };
}

export function getAvatarUrl(avatarUrl: string | null | undefined): string | null {
  if (!avatarUrl) return null;
  return avatarUrl;
}
