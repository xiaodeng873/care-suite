import { supabase } from '../context/AuthContext';

const AVATAR_BUCKET = 'avatars';
const MAX_SIZE_MB = 2;
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

export async function uploadAvatar(
  userId: string,
  file: File,
): Promise<AvatarUploadResult> {
  const validation = validateAvatarFile(file);
  if (validation) throw new Error(validation.message);

  const ext = file.type === 'image/png' ? 'png' : file.type === 'image/webp' ? 'webp' : 'jpg';
  const path = `${userId}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(AVATAR_BUCKET)
    .upload(path, file, {
      cacheControl: '3600',
      upsert: true,
      contentType: file.type,
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
