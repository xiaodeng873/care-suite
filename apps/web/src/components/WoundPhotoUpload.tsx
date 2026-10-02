import React, { useState, useRef } from 'react';
import { Camera, Upload, Trash2, Eye, X, Plus, Download } from 'lucide-react';
import { formatDisplayDate , formatDisplayDateTime } from '../utils/dateFormat';
import { compressToJpegBlob, uploadImage, deleteImageByUrl, isStorageUrl } from '../utils/storageUpload';
import { PATIENT_PHOTOS_BUCKET } from '../utils/patientPhotoUpload';
import CameraCaptureModal from './CameraCaptureModal';

interface WoundPhoto {
  id: string;
  base64: string;
  filename: string;
  uploadDate: string;
  description?: string;
}

interface WoundPhotoUploadProps {
  photos: WoundPhoto[];
  onPhotosChange: (photos: WoundPhoto[]) => void;
  maxPhotos?: number;
}

const WoundPhotoUpload: React.FC<WoundPhotoUploadProps> = ({
  photos,
  onPhotosChange,
  maxPhotos = 5
}) => {
  const [isUploading, setIsUploading] = useState(false);
  const [showCamera, setShowCamera] = useState(false);
  const [previewPhoto, setPreviewPhoto] = useState<WoundPhoto | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // 壓縮後直接上傳 Storage，base64 欄位存 public URL（渲染位 <img src> 照舊）
  const uploadOne = async (file: File): Promise<WoundPhoto> => {
    const blob = await compressToJpegBlob(file, 1536, 0.9);
    const publicUrl = await uploadImage(PATIENT_PHOTOS_BUCKET, blob, 'jpg', 'wound/');

    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
      base64: publicUrl,
      filename: file.name,
      uploadDate: new Date().toISOString(),
      description: ''
    };
  };

  const handleFileUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('請選擇圖片檔案');
      return;
    }

    if (file.size > 10 * 1024 * 1024) { // 10MB limit
      alert('圖片大小不能超過 10MB');
      return;
    }

    if (photos.length >= maxPhotos) {
      alert(`最多只能上傳 ${maxPhotos} 張相片`);
      return;
    }

    setIsUploading(true);

    try {
      const newPhoto = await uploadOne(file);
      onPhotosChange([...photos, newPhoto]);
    } catch (error) {
      console.error('上傳相片失敗:', error);
      alert('上傳相片失敗，請重試');
    } finally {
      setIsUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  // 連拍相機一次回傳多張，尊重 maxPhotos 上限（超出截斷並提示）
  const handleCameraConfirm = async (files: File[]) => {
    setShowCamera(false);
    const slots = maxPhotos - photos.length;
    if (slots <= 0) {
      alert(`最多只能上傳 ${maxPhotos} 張相片`);
      return;
    }
    const selected = files.slice(0, slots);

    setIsUploading(true);
    try {
      const newPhotos: WoundPhoto[] = [];
      for (const file of selected) {
        newPhotos.push(await uploadOne(file));
      }
      onPhotosChange([...photos, ...newPhotos]);
      if (files.length > slots) {
        alert(`最多只能上傳 ${maxPhotos} 張相片，已加入 ${selected.length} 張，其餘 ${files.length - slots} 張已略過`);
      }
    } catch (error) {
      console.error('上傳相片失敗:', error);
      alert('上傳相片失敗，請重試');
    } finally {
      setIsUploading(false);
    }
  };

  const removePhoto = async (photoId: string) => {
    const target = photos.find(photo => photo.id === photoId);
    if (target && isStorageUrl(target.base64)) {
      await deleteImageByUrl(PATIENT_PHOTOS_BUCKET, target.base64);
    }
    onPhotosChange(photos.filter(photo => photo.id !== photoId));
  };

  const downloadPhoto = async (photo: WoundPhoto) => {
    const safeDate = photo.uploadDate.replace(/[:.]/g, '-');
    const filename = `傷口相-${safeDate}.jpg`;
    if (isStorageUrl(photo.base64)) {
      try {
        const res = await fetch(photo.base64);
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        const blob = await res.blob();
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
      } catch {
        window.open(photo.base64, '_blank');
      }
    } else {
      const a = document.createElement('a');
      a.href = photo.base64;
      a.download = filename;
      a.click();
    }
  };

  return (
    <div className="space-y-4">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <h4 className="text-sm font-medium text-gray-700">
          傷口相片 ({photos.length}/{maxPhotos})
        </h4>

        {photos.length < maxPhotos && (
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => fileInputRef.current?.click()}
              disabled={isUploading}
              className="btn-secondary text-sm flex items-center space-x-1"
            >
              <Upload className="h-4 w-4" />
              <span>上傳相片</span>
            </button>

            <button
              type="button"
              onClick={() => setShowCamera(true)}
              disabled={isUploading}
              className="btn-secondary text-sm flex items-center space-x-1"
            >
              <Camera className="h-4 w-4" />
              <span>拍攝相片</span>
            </button>
          </div>
        )}
      </div>

      {/* File input */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/*"
        onChange={handleFileInput}
        className="hidden"
        disabled={isUploading}
      />

      {/* 連拍相機 */}
      {showCamera && (
        <CameraCaptureModal
          onConfirm={handleCameraConfirm}
          onCancel={() => setShowCamera(false)}
          onFallback={() => {
            setShowCamera(false);
            fileInputRef.current?.click();
          }}
        />
      )}

      {/* Photo grid */}
      {photos.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
          {photos.map((photo) => (
            <div key={photo.id} className="relative border rounded-lg overflow-hidden bg-gray-50">
              <div className="aspect-square">
                <img
                  src={photo.base64}
                  alt={photo.description || '傷口相片'}
                  className="w-full h-full object-cover cursor-pointer hover:opacity-90 transition-opacity"
                  onClick={() => setPreviewPhoto(photo)}
                />
              </div>

              <div className="p-2 space-y-2">
                <div className="flex flex-col sm:flex-row sm:justify-between gap-2 items-center">
                  <span className="text-xs text-gray-500">
                    {formatDisplayDate(photo.uploadDate)}
                  </span>

                  <div className="flex space-x-1">
                    <button
                      type="button"
                      onClick={() => setPreviewPhoto(photo)}
                      className="text-blue-600 hover:text-blue-800 p-1"
                      title="預覽"
                    >
                      <Eye className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => downloadPhoto(photo)}
                      className="text-green-600 hover:text-green-800 p-1"
                      title="下載"
                    >
                      <Download className="h-3 w-3" />
                    </button>
                    <button
                      type="button"
                      onClick={() => removePhoto(photo.id)}
                      className="text-red-600 hover:text-red-800 p-1"
                      title="刪除"
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Upload placeholder */}
      {photos.length === 0 && (
        <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 text-center">
          <Camera className="h-12 w-12 mx-auto mb-4 text-gray-400" />
          <p className="text-sm text-gray-600 mb-2">尚未上傳傷口相片</p>
          <p className="text-xs text-gray-500">點擊上方按鈕上傳或拍攝傷口相片</p>
        </div>
      )}

      {/* Loading indicator */}
      {isUploading && (
        <div className="flex items-center justify-center py-4">
          <div className="animate-spin rounded-full h-6 w-6 border-b-2 border-blue-600 mr-2"></div>
          <span className="text-sm text-gray-600">上傳中...</span>
        </div>
      )}

      {/* Photo preview modal */}
      {previewPhoto && (
        <div
          className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50"
          onClick={(e) => {
            if (e.target === e.currentTarget) setPreviewPhoto(null);
          }}
        >
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-4">
              <h3 className="text-lg font-semibold text-gray-900">傷口相片預覽</h3>
              <button
                onClick={() => setPreviewPhoto(null)}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>

            <div className="space-y-4">
              <img
                src={previewPhoto.base64}
                alt={previewPhoto.description || '傷口相片'}
                className="w-full rounded-lg"
              />

              <div className="space-y-2">
                <div className="text-sm text-gray-600">
                  <p><strong>檔案名稱：</strong>{previewPhoto.filename}</p>
                  <p><strong>上傳時間：</strong>{formatDisplayDateTime(previewPhoto.uploadDate)}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default WoundPhotoUpload;
