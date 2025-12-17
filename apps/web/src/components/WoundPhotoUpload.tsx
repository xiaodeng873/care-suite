import React, { useState, useRef } from 'react';
import { Camera, Upload, Trash2, Eye, X, Plus } from 'lucide-react';

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
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);

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
      // Convert to base64
      const reader = new FileReader();
      reader.onload = (e) => {
        const base64String = e.target?.result as string;
        const newPhoto: WoundPhoto = {
          id: Date.now().toString(),
          base64: base64String,
          filename: file.name,
          uploadDate: new Date().toISOString(),
          description: ''
        };
        
        onPhotosChange([...photos, newPhoto]);
        setIsUploading(false);
      };
      reader.readAsDataURL(file);
    } catch (error) {
      console.error('上傳相片失敗:', error);
      alert('上傳相片失敗，請重試');
      setIsUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handleFileUpload(e.target.files[0]);
    }
  };

  const startCamera = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment' } // Use back camera on mobile
      });
      
      if (videoRef.current) {
        videoRef.current.srcObject = stream;
        setShowCamera(true);
      }
    } catch (error) {
      console.error('無法開啟攝影機:', error);
      alert('無法開啟攝影機，請檢查權限設定');
    }
  };

  const capturePhoto = () => {
    if (videoRef.current && canvasRef.current) {
      const canvas = canvasRef.current;
      const video = videoRef.current;
      
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.drawImage(video, 0, 0);
        
        canvas.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `wound-photo-${Date.now()}.jpg`, { type: 'image/jpeg' });
            handleFileUpload(file);
          }
        }, 'image/jpeg', 0.8);
      }
      
      // Stop camera
      stopCamera();
    }
  };

  const stopCamera = () => {
    if (videoRef.current) {
      const stream = videoRef.current.srcObject as MediaStream;
      if (stream) {
        stream.getTracks().forEach(track => track.stop());
      }
      setShowCamera(false);
    }
  };

  const removePhoto = (photoId: string) => {
    onPhotosChange(photos.filter(photo => photo.id !== photoId));
  };

  const updatePhotoDescription = (photoId: string, description: string) => {
    onPhotosChange(photos.map(photo => 
      photo.id === photoId ? { ...photo, description } : photo
    ));
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h4 className="text-sm font-medium text-gray-700">
          傷口相片 ({photos.length}/{maxPhotos})
        </h4>
        
        {photos.length < maxPhotos && (
          <div className="flex space-x-2">
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
              onClick={startCamera}
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

      {/* Camera view */}
      {showCamera && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-md w-full">
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-lg font-semibold text-gray-900">拍攝傷口相片</h3>
              <button
                onClick={stopCamera}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
            
            <video
              ref={videoRef}
              autoPlay
              playsInline
              className="w-full rounded-lg mb-4"
            />
            
            <div className="flex justify-center space-x-3">
              <button
                onClick={capturePhoto}
                className="btn-primary flex items-center space-x-2"
              >
                <Camera className="h-4 w-4" />
                <span>拍照</span>
              </button>
              <button
                onClick={stopCamera}
                className="btn-secondary"
              >
                取消
              </button>
            </div>
          </div>
        </div>
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
                <input
                  type="text"
                  value={photo.description || ''}
                  onChange={(e) => updatePhotoDescription(photo.id, e.target.value)}
                  placeholder="相片描述..."
                  className="w-full text-xs border border-gray-300 rounded px-2 py-1 focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
                
                <div className="flex justify-between items-center">
                  <span className="text-xs text-gray-500">
                    {new Date(photo.uploadDate).toLocaleDateString('zh-TW')}
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
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 max-w-2xl w-full max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-4">
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
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">相片描述</label>
                  <input
                    type="text"
                    value={previewPhoto.description || ''}
                    onChange={(e) => updatePhotoDescription(previewPhoto.id, e.target.value)}
                    placeholder="輸入相片描述..."
                    className="form-input w-full"
                  />
                </div>
                
                <div className="text-sm text-gray-600">
                  <p><strong>檔案名稱：</strong>{previewPhoto.filename}</p>
                  <p><strong>上傳時間：</strong>{new Date(previewPhoto.uploadDate).toLocaleString('zh-TW')}</p>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Hidden canvas for camera capture */}
      <canvas ref={canvasRef} className="hidden" />
    </div>
  );
};

export default WoundPhotoUpload;