import { supabase } from '../lib/supabase';
import { getSupabaseUrl } from '../config/supabase.config';

/**
 * 圖片壓縮：長邊縮到 maxDim，輸出 JPEG Blob
 * source 可以是 File 或 data URL string
 */
export async function compressToJpegBlob(
  source: File | string,
  maxDim: number,
  quality?: number,
): Promise<Blob> {
  const dataUrl = typeof source === 'string'
    ? source
    : await new Promise<string>((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result as string);
        reader.onerror = () => reject(new Error('檔案讀取失敗'));
        reader.readAsDataURL(source);
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

  let width = img.width;
  let height = img.height;
  if (width >= height && width > maxDim) {
    height = (height * maxDim) / width;
    width = maxDim;
  } else if (height > width && height > maxDim) {
    width = (width * maxDim) / height;
    height = maxDim;
  }
  canvas.width = width;
  canvas.height = height;
  ctx.drawImage(img, 0, 0, width, height);

  return await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob(
      blob => (blob ? resolve(blob) : reject(new Error('圖片壓縮失敗'))),
      'image/jpeg',
      quality ?? 0.85,
    );
  });
}

/**
 * 上傳圖片到 Storage bucket：uuid 檔名，回傳 public URL（無 cache buster）
 * pathPrefix（可選）：object path 前綴，例如 `${patientId}/`
 */
export async function uploadImage(
  bucket: string,
  blob: Blob,
  ext: string = 'jpg',
  pathPrefix?: string,
): Promise<string> {
  const path = `${pathPrefix ?? ''}${crypto.randomUUID()}.${ext}`;

  const { error: uploadError } = await supabase.storage
    .from(bucket)
    .upload(path, blob, {
      cacheControl: '3600',
      upsert: false,
      contentType: 'image/jpeg',
    });

  if (uploadError) {
    throw new Error(`上傳失敗：${uploadError.message}`);
  }

  const { data } = supabase.storage.from(bucket).getPublicUrl(path);
  if (!data?.publicUrl) {
    throw new Error('無法取得圖片公開連結');
  }
  return data.publicUrl;
}

/**
 * 由 public URL 拆返 object path 刪除；失敗只 console.error 唔 throw
 * public URL 格式：{supabaseUrl}/storage/v1/object/public/{bucket}/{path}
 */
export async function deleteImageByUrl(bucket: string, url: string): Promise<void> {
  try {
    if (!isStorageUrl(url)) return;
    const prefix = `${getSupabaseUrl()}/storage/v1/object/public/${bucket}/`;
    const cleanUrl = url.split('?')[0];
    if (!cleanUrl.startsWith(prefix)) return;
    const path = decodeURIComponent(cleanUrl.slice(prefix.length));
    if (!path) return;
    const { error } = await supabase.storage.from(bucket).remove([path]);
    if (error) console.error('刪除圖片失敗:', error.message);
  } catch (e) {
    console.error('刪除圖片失敗:', e);
  }
}

/** 分辨 Storage URL（http(s):// 開頭）vs base64 data URL / 空值（過渡期兩者並存） */
export function isStorageUrl(v?: string | null): boolean {
  return !!v && /^https?:\/\//.test(v);
}

function triggerAnchorDownload(href: string, filename: string): void {
  const a = document.createElement('a');
  a.href = href;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

/**
 * 下載圖片：http(s) URL → fetch 成 blob 經 objectURL 觸發 <a download>（跨域 Storage URL 都下到）；
 * fetch 失敗 fallback 直接開新 tab；base64 data URI → 直接 <a download>。
 * 失敗只 console.warn 唔 throw。
 */
export async function downloadImage(src: string, filename: string): Promise<void> {
  try {
    if (isStorageUrl(src)) {
      try {
        const res = await fetch(src);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const objectUrl = URL.createObjectURL(blob);
        triggerAnchorDownload(objectUrl, filename);
        // 延遲 revoke，等瀏覽器完成讀取 objectURL
        setTimeout(() => URL.revokeObjectURL(objectUrl), 10000);
      } catch (e) {
        console.warn('下載圖片失敗，改為新分頁開啟:', e);
        window.open(src, '_blank');
      }
      return;
    }
    triggerAnchorDownload(src, filename);
  } catch (e) {
    console.warn('下載圖片失敗:', e);
  }
}
