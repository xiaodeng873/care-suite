import React, { useState } from 'react';
import { X, User, Upload, Camera, Trash2, LogOut, LogIn, Calendar } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { formatEnglishGivenName, formatEnglishSurname } from '../utils/nameFormatter';
import SimpleStationBedSelector from './SimpleStationBedSelector';
import OCRIDCardBlock from './OCRIDCardBlock';

interface PatientModalProps {
  patient?: any;
  onClose: () => void;
}

const PatientModal: React.FC<PatientModalProps> = ({ patient, onClose }) => {
  const { addPatient, updatePatient, stations, beds } = usePatients();

  // 獲取當天日期作為預設入住日期
  const getTodayDate = () => new Date().toISOString().split('T')[0];

  const [formData, setFormData] = useState({
    床號: patient?.床號 || '',
    station_id: patient?.station_id || '',
    bed_id: patient?.bed_id || '',
    在住狀態: patient?.在住狀態 || '待入住',
    中文姓氏: patient?.中文姓氏 || '',
    中文名字: patient?.中文名字 || '',
    英文姓氏: patient?.英文姓氏 || '',
    英文名字: patient?.英文名字 || '',
    性別: patient?.性別 || '男',
    身份證號碼: patient?.身份證號碼 || '',
    藥物敏感: patient?.藥物敏感 || [],
    不良藥物反應: patient?.不良藥物反應 || [],
    感染控制: patient?.感染控制 || [],
    出生日期: patient?.出生日期 || '',
    院友相片: patient?.院友相片 || '',
    入住日期: patient?.入住日期 || getTodayDate(), // 新增時預設為當天
    退住日期: patient?.退住日期 || '',
    護理等級: patient?.護理等級 || '',
    入住類型: patient?.入住類型 || '',
    社會福利: patient?.社會福利 || { type: '', subtype: '' },
    discharge_reason: patient?.discharge_reason || '',
    death_date: patient?.death_date || '',
    transfer_facility_name: patient?.transfer_facility_name || '',
  });
  const [photoPreview, setPhotoPreview] = useState<string | null>(patient?.院友相片 || null);
  const [isUploading, setIsUploading] = useState(false);
  const [newAllergy, setNewAllergy] = useState('');
  const [newAdverseReaction, setNewAdverseReaction] = useState('');
  const [newInfectionControl, setNewInfectionControl] = useState('');
  const [socialWelfareType, setSocialWelfareType] = useState(
    patient?.社會福利?.type || ''
  );
  const [socialWelfareSubtype, setSocialWelfareSubtype] = useState(
    patient?.社會福利?.subtype || ''
  );
  const [showDischargeModal, setShowDischargeModal] = useState(false);
  const [dischargeDate, setDischargeDate] = useState('');
  const [ocrError, setOcrError] = useState<string>('');


  const handleOCRComplete = (extractedData: any) => {
    setOcrError('');

    const updates: any = {};

    // 處理中文姓名
    if (extractedData.中文姓名) {
      const fullName = String(extractedData.中文姓名).trim();
      if (fullName.length >= 2) {
        // 如果是4個字，前2個字為姓氏
        if (fullName.length === 4) {
          updates.中文姓氏 = fullName.substring(0, 2);
          updates.中文名字 = fullName.substring(2);
        } else {
          // 其他情況，第1個字為姓氏
          updates.中文姓氏 = fullName.charAt(0);
          updates.中文名字 = fullName.substring(1);
        }
      }
    }

    // 處理英文姓名
    if (extractedData.英文姓名) {
      const englishName = String(extractedData.英文姓名).trim();

      // 檢查是否包含逗號（SURNAME, Given names 格式）
      if (englishName.includes(',')) {
        const parts = englishName.split(',').map(p => p.trim());
        if (parts.length >= 2) {
          updates.英文姓氏 = formatEnglishSurname(parts[0]);
          updates.英文名字 = formatEnglishGivenName(parts[1]);
        } else if (parts.length === 1) {
          updates.英文姓氏 = formatEnglishSurname(parts[0]);
        }
      } else {
        // 沒有逗號，按空格分割
        const nameParts = englishName.split(/\s+/);
        if (nameParts.length >= 2) {
          updates.英文姓氏 = formatEnglishSurname(nameParts[0]);
          updates.英文名字 = formatEnglishGivenName(nameParts.slice(1).join(' '));
        } else if (nameParts.length === 1) {
          updates.英文姓氏 = formatEnglishSurname(nameParts[0]);
        }
      }
    }

    // 處理身份證號碼
    if (extractedData.身份證號碼) {
      updates.身份證號碼 = String(extractedData.身份證號碼).trim();
    }

    // 處理出生日期
    if (extractedData.出生日期) {
      updates.出生日期 = String(extractedData.出生日期).trim();
    }

    // 處理性別
    if (extractedData.性別) {
      const gender = String(extractedData.性別).trim();
      // 確保性別值為 "男" 或 "女"
      if (gender === '男' || gender === '女') {
        updates.性別 = gender;
      }
    }

    setFormData(prev => ({
      ...prev,
      ...updates
    }));
  };

  const handleOCRError = (error: string) => {
    setOcrError(error);
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLSelectElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    let updatedValue = value;

    // 格式化英文姓氏和名字
    if (name === '英文姓氏') {
      updatedValue = formatEnglishSurname(value);
    } else if (name === '英文名字') {
      updatedValue = formatEnglishGivenName(value);
    }
    setFormData(prev => ({
      ...prev,
      [name]: updatedValue
    }));
  };

  const addAllergy = () => {
    if (newAllergy.trim()) {
      setFormData(prev => ({
        ...prev,
        藥物敏感: [...prev.藥物敏感, newAllergy.trim()]
      }));
      setNewAllergy('');
    }
  };

  const removeAllergy = (index: number) => {
    setFormData(prev => ({
      ...prev,
      藥物敏感: prev.藥物敏感.filter((_, i) => i !== index)
    }));
  };

  const addAdverseReaction = () => {
    if (newAdverseReaction.trim()) {
      setFormData(prev => ({
        ...prev,
        不良藥物反應: [...prev.不良藥物反應, newAdverseReaction.trim()]
      }));
      setNewAdverseReaction('');
    }
  };

  const removeAdverseReaction = (index: number) => {
    setFormData(prev => ({
      ...prev,
      不良藥物反應: prev.不良藥物反應.filter((_, i) => i !== index)
    }));
  };

  const addInfectionControl = () => {
    if (newInfectionControl.trim()) {
      setFormData(prev => ({
        ...prev,
        感染控制: [...prev.感染控制, newInfectionControl.trim()]
      }));
      setNewInfectionControl('');
    }
  };

  const removeInfectionControl = (index: number) => {
    setFormData(prev => ({
      ...prev,
      感染控制: prev.感染控制.filter((_, i) => i !== index)
    }));
  };

  const handleSocialWelfareChange = (type: string, subtype: string = '') => {
    setSocialWelfareType(type);
    setSocialWelfareSubtype(subtype);
    setFormData(prev => ({
      ...prev,
      社會福利: { type, subtype }
    }));
  };

  const compressImage = (file: File): Promise<string> => {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = (e) => {
        const img = new Image();
        img.onload = () => {
          const canvas = document.createElement('canvas');
          const ctx = canvas.getContext('2d');

          if (!ctx) {
            reject(new Error('無法獲取 Canvas 上下文'));
            return;
          }

          // 設定目標寬度，保持比例
          const maxWidth = 400;
          let width = img.width;
          let height = img.height;

          if (width > maxWidth) {
            height = (height * maxWidth) / width;
            width = maxWidth;
          }

          canvas.width = width;
          canvas.height = height;

          // 繪製圖片
          ctx.drawImage(img, 0, 0, width, height);

          // 轉換為 JPEG base64，品質 0.85
          const compressedBase64 = canvas.toDataURL('image/jpeg', 0.85);
          resolve(compressedBase64);
        };
        img.onerror = () => reject(new Error('圖片載入失敗'));
        img.src = e.target?.result as string;
      };
      reader.onerror = () => reject(new Error('檔案讀取失敗'));
      reader.readAsDataURL(file);
    });
  };

  const handlePhotoUpload = async (file: File) => {
    if (!file.type.startsWith('image/')) {
      alert('請選擇圖片文件');
      return;
    }

    if (file.size > 5 * 1024 * 1024) { // 5MB limit
      alert('圖片大小不能超過 5MB');
      return;
    }

    setIsUploading(true);

    try {
      // 壓縮圖片
      const compressedBase64 = await compressImage(file);
      setPhotoPreview(compressedBase64);
      setFormData(prev => ({
        ...prev,
        院友相片: compressedBase64
      }));
      setIsUploading(false);
    } catch (error) {
      console.error('上傳照片失敗:', error);
      alert('上傳照片失敗，請重試');
      setIsUploading(false);
    }
  };

  const handleFileInput = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      handlePhotoUpload(e.target.files[0]);
    }
  };

  const handleRemovePhoto = () => {
    setPhotoPreview(null);
    setFormData(prev => ({
      ...prev,
      院友相片: ''
    }));
  };

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      
      // Create a simple camera capture modal
      const video = document.createElement('video');
      video.srcObject = stream;
      video.autoplay = true;
      
      const modal = document.createElement('div');
      modal.className = 'fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50';
      modal.innerHTML = `
        <div class="bg-white rounded-lg p-6 max-w-md w-full">
          <div class="flex items-center justify-between mb-4">
            <h3 class="text-lg font-semibold">拍攝院友照片</h3>
            <button id="close-camera" class="text-gray-400 hover:text-gray-600">
              <svg class="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
          <div class="space-y-4">
            <div id="video-container" class="w-full h-64 bg-gray-100 rounded-lg overflow-hidden"></div>
            <div class="flex space-x-3">
              <button id="capture-btn" class="btn-primary flex-1">拍照</button>
              <button id="cancel-btn" class="btn-secondary flex-1">取消</button>
            </div>
          </div>
        </div>
      `;
      
      document.body.appendChild(modal);
      document.getElementById('video-container')?.appendChild(video);
      
      const closeCamera = () => {
        stream.getTracks().forEach(track => track.stop());
        document.body.removeChild(modal);
      };
      
      document.getElementById('close-camera')?.addEventListener('click', closeCamera);
      document.getElementById('cancel-btn')?.addEventListener('click', closeCamera);
      
      document.getElementById('capture-btn')?.addEventListener('click', () => {
        const canvas = document.createElement('canvas');
        canvas.width = video.videoWidth;
        canvas.height = video.videoHeight;
        
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(video, 0, 0);
          const dataURL = canvas.toDataURL('image/jpeg', 0.8);
          
          setPhotoPreview(dataURL);
          setFormData(prev => ({
            ...prev,
            院友相片: dataURL
          }));
        }
        
        closeCamera();
      });
      
    } catch (error) {
      console.error('無法開啟攝影機:', error);
      alert('無法開啟攝影機，請檢查權限設定');
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    // 驗證必填欄位
    if (!formData.中文姓氏 || !formData.中文名字) {
      alert('請填寫中文姓名');
      return;
    }

    // Create a copy of formData to ensure we work with the latest state
    let finalFormData = { ...formData };

    // 如果選擇了床位，確保床號與床位同步
    if (finalFormData.bed_id) {
      const selectedBed = beds.find(b => b.id === finalFormData.bed_id);
      if (selectedBed) {
        finalFormData.床號 = selectedBed.bed_number;
      }
    }

    // 新增院友時，如果沒有選擇床位，設為待入住
    if (!patient && (!finalFormData.station_id || !finalFormData.bed_id)) {
      finalFormData = {
        ...finalFormData,
        在住狀態: '待入住',
        station_id: '',
        bed_id: '',
        床號: '待分配'
      };
    }

    // 合併中文姓名和英文姓名
    const 中文姓名 = (finalFormData.中文姓氏 + finalFormData.中文名字).trim();
    const 英文姓名 = finalFormData.英文姓氏 && finalFormData.英文名字
      ? `${finalFormData.英文姓氏.trim()} ${finalFormData.英文名字.trim()}`
      : finalFormData.英文姓氏 || finalFormData.英文名字 || '';

    // Convert empty string date values to null for proper database handling
    const sanitizedFormData = {
      在住狀態: finalFormData.在住狀態,
      ...finalFormData,
      中文姓名,
      英文姓名: 英文姓名 || null,
      出生日期: finalFormData.出生日期 || null,
      入住日期: finalFormData.入住日期 || null,
      退住日期: finalFormData.退住日期 || null,
      護理等級: finalFormData.護理等級 || null,
      入住類型: finalFormData.入住類型 || null,
      station_id: finalFormData.station_id || null,
      bed_id: finalFormData.bed_id || null
    };

    if (patient) {
      updatePatient({
        院友id: patient.院友id,
        ...sanitizedFormData
      });
    } else {
      addPatient(sanitizedFormData);
    }

    onClose();
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900">
              {patient ? '編輯院友' : '新增院友'}
            </h2>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600"
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* OCR 身份證識別區塊 */}
          <OCRIDCardBlock
            onOCRComplete={handleOCRComplete}
            onOCRError={handleOCRError}
          />

          {ocrError && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-3 flex items-start space-x-2">
              <div className="text-red-600 text-sm">{ocrError}</div>
            </div>
          )}

          {/* 站點和床位選擇 - 編輯時顯示資訊，新增時可選擇 */}
          {patient ? (
            <div>
              <label className="form-label">目前床位</label>
              <div className="p-3 bg-gray-50 border border-gray-200 rounded-lg">
                {formData.station_id && formData.bed_id ? (
                  <div className="flex items-center space-x-2">
                    <span className="text-sm text-gray-700">
                      {stations.find(s => s.id === formData.station_id)?.name} - {formData.床號}
                    </span>
                  </div>
                ) : (
                  <span className="text-sm text-gray-500">未指派床位</span>
                )}
                <p className="text-xs text-gray-500 mt-1">
                  如需調度床位，請前往「床位管理」頁面進行管理
                </p>
              </div>
            </div>
          ) : (
            <div>
              <label className="form-label">站點和床位 (可選)</label>
              <SimpleStationBedSelector
                selectedStationId={formData.station_id}
                selectedBedId={formData.bed_id}
                onSelectionChange={(stationId, bedId, bedNumber) => {
                  setFormData(prev => ({
                    ...prev,
                    station_id: stationId,
                    bed_id: bedId,
                    床號: bedNumber,
                    在住狀態: (stationId && bedId) ? '在住' : '待入住'
                  }));
                }}
              />
              <p className="text-xs text-gray-500 mt-1">
                如不選擇床位，院友狀態將設為「待入住」，可稍後在床位管理頁面指派
              </p>
            </div>
          )}

          {/* Photo Upload Section */}
          <div>
            <label className="form-label">院友照片</label>
            <div className="flex items-center space-x-4">
              <div className="w-24 h-24 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center">
                {photoPreview ? (
                  <img 
                    src={photoPreview} 
                    alt="院友照片" 
                    className="w-full h-full object-cover"
                  />
                ) : (
                  <User className="h-12 w-12 text-gray-400" />
                )}
              </div>
              <div className="flex flex-col space-y-2">
                <label className="btn-secondary cursor-pointer flex items-center space-x-2">
                  <Upload className="h-4 w-4" />
                  <span>上傳照片</span>
                  <input
                    type="file"
                    accept="image/*"
                    onChange={handleFileInput}
                    className="hidden"
                    disabled={isUploading}
                  />
                </label>
                <button
                  type="button"
                  onClick={handleCameraCapture}
                  className="btn-secondary flex items-center space-x-2"
                >
                  <Camera className="h-4 w-4" />
                  <span>拍攝照片</span>
                </button>
                {photoPreview && (
                  <button
                    type="button"
                    onClick={handleRemovePhoto}
                    className="btn-danger flex items-center space-x-2"
                  >
                    <Trash2 className="h-4 w-4" />
                    <span>移除照片</span>
                  </button>
                )}
              </div>
            </div>
            {isUploading && (
              <p className="text-sm text-blue-600 mt-2">上傳中...</p>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">性別</label>
              <select
                name="性別"
                value={formData.性別}
                onChange={handleChange}
                className="form-input"
                required
              >
                <option value="男">男</option>
                <option value="女">女</option>
              </select>
            </div>

            <div>
              <label className="form-label">入住日期</label>
              <input
                type="date"
                name="入住日期"
                value={formData.入住日期}
                onChange={handleChange}
                className="form-input"
              />
            </div>
          </div>

          {formData.在住狀態 === '已退住' && (
            <div className="space-y-4">
              <div>
                <label className="form-label">退住日期</label>
                <input
                  type="date"
                  name="退住日期"
                  value={formData.退住日期}
                  onChange={handleChange}
                  className="form-input"
                  disabled
                />
              </div>

              <div>
                <label className="form-label">退住原因</label>
                <select
                  name="discharge_reason"
                  value={formData.discharge_reason}
                  onChange={handleChange}
                  className="form-input"
                >
                  <option value="">請選擇</option>
                  <option value="死亡">死亡</option>
                  <option value="回家">回家</option>
                  <option value="留醫">留醫</option>
                  <option value="轉往其他機構">轉往其他機構</option>
                </select>
              </div>

              {formData.discharge_reason === '死亡' && (
                <div>
                  <label className="form-label">死亡日期</label>
                  <input
                    type="date"
                    name="death_date"
                    value={formData.death_date}
                    onChange={handleChange}
                    className="form-input"
                  />
                </div>
              )}

              {formData.discharge_reason === '轉往其他機構' && (
                <div>
                  <label className="form-label">轉往機構名稱</label>
                  <input
                    type="text"
                    name="transfer_facility_name"
                    value={formData.transfer_facility_name}
                    onChange={handleChange}
                    className="form-input"
                    placeholder="請輸入機構名稱"
                  />
                </div>
              )}
            </div>
          )}

          <div>
            <label className="form-label">在住狀態</label>
            <div>
              <div className="flex items-center justify-between">
                <span className={`inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium ${
                  formData.在住狀態 === '在住' ? 'bg-green-100 text-green-800' :
                  formData.在住狀態 === '待入住' ? 'bg-yellow-100 text-yellow-800' :
                  'bg-gray-100 text-gray-800'
                }`}>
                  {formData.在住狀態 || '在住'}
                </span>
                {formData.在住狀態 === '在住' && (
                  <button
                    type="button"
                    onClick={() => setShowDischargeModal(true)}
                    className="btn-danger text-sm flex items-center space-x-1"
                  >
                    <LogOut className="h-4 w-4" />
                    <span>退住</span>
                  </button>
                )}
                {formData.在住狀態 === '待入住' && (
                  <span className="text-xs text-gray-500">
                    請前往「床位管理」頁面指派床位
                  </span>
                )}
                {formData.在住狀態 === '已退住' && (
                  <button
                    type="button"
                    onClick={async () => {
                      if (confirm('確定要取消退住嗎？院友將返回「待入住」狀態。')) {
                        try {
                          const updatedPatient = {
                            ...patient,
                            退住日期: null,
                            在住狀態: '待入住',
                            station_id: null,
                            bed_id: null,
                            床號: '待分配',
                            discharge_reason: null,
                            death_date: null,
                            transfer_facility_name: null
                          };
                          await updatePatient(updatedPatient);
                          onClose();
                        } catch (error) {
                          console.error('取消退住失敗:', error);
                          alert('取消退住失敗，請重試');
                        }
                      }
                    }}
                    className="btn-secondary text-sm flex items-center space-x-1"
                  >
                    <LogIn className="h-4 w-4" />
                    <span>取消退住</span>
                  </button>
                )}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="form-label">護理等級</label>
              <select
                name="護理等級"
                value={formData.護理等級}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">請選擇</option>
                <option value="全護理">全護理</option>
                <option value="半護理">半護理</option>
                <option value="自理">自理</option>
              </select>
            </div>

            <div>
              <label className="form-label">入住類型</label>
              <select
                name="入住類型"
                value={formData.入住類型}
                onChange={handleChange}
                className="form-input"
              >
                <option value="">請選擇</option>
                <option value="私位">私位</option>
                <option value="買位">買位</option>
                <option value="院舍卷">院舍卷</option>
                <option value="暫住">暫住</option>
              </select>
            </div>

            <div>
              <label className="form-label">社會福利</label>
              <select
                value={socialWelfareType}
                onChange={(e) => handleSocialWelfareChange(e.target.value)}
                className="form-input"
              >
                <option value="">請選擇社會福利</option>
                <option value="綜合社會保障援助">綜合社會保障援助</option>
                <option value="公共福利金計劃">公共福利金計劃</option>
              </select>
              
              {socialWelfareType === '公共福利金計劃' && (
                <div className="mt-2">
                  <select
                    value={socialWelfareSubtype}
                    onChange={(e) => handleSocialWelfareChange(socialWelfareType, e.target.value)}
                    className="form-input"
                  >
                    <option value="">選擇項目</option>
                    <option value="長者生活津貼">長者生活津貼</option>
                    <option value="普通傷殘津貼">普通傷殘津貼</option>
                    <option value="高額傷殘津貼">高額傷殘津貼</option>
                  </select>
                </div>
              )}
              
              {(socialWelfareType || socialWelfareSubtype) && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-3 mt-2">
                  <p className="text-sm text-blue-800">
                    <strong>已選擇：</strong>
                    {socialWelfareType}
                    {socialWelfareSubtype && ` - ${socialWelfareSubtype}`}
                  </p>
                </div>
              )}
            </div>
          </div>

          <div>
            <label className="form-label">中文姓名 *</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                name="中文姓氏"
                value={formData.中文姓氏}
                onChange={handleChange}
                className="form-input"
                placeholder="姓氏"
                required
              />
              <input
                type="text"
                name="中文名字"
                value={formData.中文名字}
                onChange={handleChange}
                className="form-input"
                placeholder="名字"
                required
              />
            </div>
          </div>

          <div>
            <label className="form-label">英文姓名</label>
            <div className="grid grid-cols-2 gap-2">
              <input
                type="text"
                name="英文姓氏"
                value={formData.英文姓氏}
                onChange={handleChange}
                className="form-input"
                placeholder="Surname "
              />
              <input
                type="text"
                name="英文名字"
                value={formData.英文名字}
                onChange={handleChange}
                className="form-input"
                placeholder="Given Name"
              />
            </div>
            <p className="text-xs text-gray-500 mt-1">英文姓氏將自動轉為大寫，英文名字每個單字首字母自動大寫。</p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="form-label">身份證號碼</label>
              <input
                type="text"
                name="身份證號碼"
                value={formData.身份證號碼}
                onChange={handleChange}
                className="form-input"
                required
              />
            </div>

            <div>
              <label className="form-label">出生日期</label>
              <div className="space-y-2">
                <div className="flex items-center space-x-4">
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="birthDateType"
                      value="full"
                      checked={!formData.出生日期?.endsWith('-01-01')}
                      onChange={() => {
                        // 如果當前是年份格式，轉換為完整日期格式
                        if (formData.出生日期?.endsWith('-01-01')) {
                          const year = formData.出生日期.split('-')[0];
                          const today = new Date();
                          const currentMonth = (today.getMonth() + 1).toString().padStart(2, '0');
                          const currentDay = today.getDate().toString().padStart(2, '0');
                          setFormData(prev => ({ 
                            ...prev, 
                            出生日期: `${year}-${currentMonth}-${currentDay}` 
                          }));
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">完整日期</span>
                  </label>
                  <label className="flex items-center space-x-2">
                    <input
                      type="radio"
                      name="birthDateType"
                      value="yearOnly"
                      checked={formData.出生日期?.endsWith('-01-01')}
                      onChange={() => {
                        // 轉換為年份格式
                        if (formData.出生日期) {
                          const year = formData.出生日期.split('-')[0];
                          setFormData(prev => ({ ...prev, 出生日期: `${year}-01-01` }));
                        } else {
                          // 如果沒有日期，設為當前年份
                          const currentYear = new Date().getFullYear();
                          setFormData(prev => ({ ...prev, 出生日期: `${currentYear}-01-01` }));
                        }
                      }}
                      className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300"
                    />
                    <span className="text-sm text-gray-700">僅年份</span>
                  </label>
                </div>
                
                {formData.出生日期?.endsWith('-01-01') ? (
                  <div>
                    <input
                      type="number"
                      value={formData.出生日期 ? formData.出生日期.split('-')[0] : ''}
                      onChange={(e) => {
                        const year = e.target.value;
                        setFormData(prev => ({ 
                          ...prev, 
                          出生日期: year ? `${year}-01-01` : '' 
                        }));
                      }}
                      className="form-input"
                      placeholder="例如：1950"
                      min="1900"
                      max={new Date().getFullYear()}
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      僅輸入出生年份，系統會自動設為該年1月1日
                    </p>
                  </div>
                ) : (
                  <div>
                    <input
                      type="date"
                      name="出生日期"
                      value={formData.出生日期}
                      onChange={handleChange}
                      className="form-input"
                      required
                    />
                    <p className="text-xs text-gray-500 mt-1">
                      輸入完整的出生年月日
                    </p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="form-label">藥物敏感</label>
            <div className="space-y-2">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newAllergy}
                  onChange={(e) => setNewAllergy(e.target.value)}
                  className="form-input flex-1"
                  placeholder="輸入藥物敏感項目"
                  onKeyPress={(e) => e.key === 'Enter' && addAllergy()}
                />
                <button
                  type="button"
                  onClick={addAllergy}
                  className="btn-secondary"
                >
                  新增
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.藥物敏感.map((allergy, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-orange-100 text-orange-800"
                  >
                    {allergy}
                    <button
                      type="button"
                      onClick={() => removeAllergy(index)}
                      className="ml-2 text-orange-600 hover:text-orange-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {formData.藥物敏感.length === 0 && (
                  <span className="text-sm text-gray-500">無藥物敏感</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="form-label">不良藥物反應</label>
            <div className="space-y-2">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newAdverseReaction}
                  onChange={(e) => setNewAdverseReaction(e.target.value)}
                  className="form-input flex-1"
                  placeholder="輸入不良藥物反應項目"
                  onKeyPress={(e) => e.key === 'Enter' && addAdverseReaction()}
                />
                <button
                  type="button"
                  onClick={addAdverseReaction}
                  className="btn-secondary"
                >
                  新增
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.不良藥物反應.map((reaction, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-red-100 text-red-800"
                  >
                    {reaction}
                    <button
                      type="button"
                      onClick={() => removeAdverseReaction(index)}
                      className="ml-2 text-red-600 hover:text-red-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {formData.不良藥物反應.length === 0 && (
                  <span className="text-sm text-gray-500">無不良藥物反應</span>
                )}
              </div>
            </div>
          </div>

          <div>
            <label className="form-label">感染控制</label>
            <div className="space-y-2">
              <div className="flex space-x-2">
                <input
                  type="text"
                  value={newInfectionControl}
                  onChange={(e) => setNewInfectionControl(e.target.value)}
                  className="form-input flex-1"
                  placeholder="輸入感染控制項目"
                  onKeyPress={(e) => e.key === 'Enter' && addInfectionControl()}
                />
                <button
                  type="button"
                  onClick={addInfectionControl}
                  className="btn-secondary"
                >
                  新增
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                {formData.感染控制.map((control, index) => (
                  <span
                    key={index}
                    className="inline-flex items-center px-3 py-1 rounded-full text-sm bg-purple-100 text-purple-800"
                  >
                    {control}
                    <button
                      type="button"
                      onClick={() => removeInfectionControl(index)}
                      className="ml-2 text-purple-600 hover:text-purple-800"
                    >
                      ×
                    </button>
                  </span>
                ))}
                {formData.感染控制.length === 0 && (
                  <span className="text-sm text-gray-500">無感染控制項目</span>
                )}
              </div>
            </div>
          </div>

          <div className="flex space-x-3 pt-4">
            <button
              type="submit"
              className="btn-primary flex-1"
            >
              {patient ? '更新院友' : '新增院友'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="btn-secondary flex-1"
            >
              取消
            </button>
          </div>
        </form>

        {/* 退住確認模態框 */}
        {showDischargeModal && (
          <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
            <div className="bg-white rounded-lg max-w-md w-full p-6">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center space-x-3">
                  <div className="p-2 rounded-lg bg-orange-100">
                    <LogOut className="h-6 w-6 text-orange-600" />
                  </div>
                  <h3 className="text-xl font-semibold text-gray-900">確認退住</h3>
                </div>
                <button
                  onClick={() => setShowDischargeModal(false)}
                  className="text-gray-400 hover:text-gray-600"
                >
                  <X className="h-6 w-6" />
                </button>
              </div>

              <div className="mb-4 p-4 bg-gray-50 rounded-lg">
                <p className="text-sm text-gray-700">
                  確定要將 <strong>{formData.中文姓氏}{formData.中文名字}</strong> (床號: {formData.床號}) 設為退住狀態嗎？
                </p>
              </div>

              <div className="mb-4">
                <label className="form-label">
                  <Calendar className="h-4 w-4 inline mr-1" />
                  退住日期 *
                </label>
                <input
                  type="date"
                  value={dischargeDate}
                  onChange={(e) => setDischargeDate(e.target.value)}
                  className="form-input"
                  required
                />
              </div>

              <div className="bg-orange-50 border border-orange-200 rounded-lg p-3 mb-4">
                <p className="text-sm text-orange-800">
                  <strong>注意：</strong>退住後，此院友的狀態將變更為「已退住」，相關的任務和記錄將不會在預設檢視中顯示。
                </p>
              </div>

              <div className="flex space-x-3">
                <button
                  onClick={() => {
                    if (!dischargeDate) {
                      alert('請選擇退住日期');
                      return;
                    }
                    if (!dischargeDate) {
                      alert('請選擇退住日期');
                      return;
                    }
                    setFormData(prev => ({
                      ...prev,
                      退住日期: dischargeDate,
                      在住狀態: '已退住',
                      station_id: '',
                      bed_id: '',
                      床號: ''
                    }));
                    setShowDischargeModal(false);
                    setDischargeDate('');
                  }}
                  className="btn-danger flex-1"
                >
                  確認退住
                </button>
                <button
                  onClick={() => {
                    setShowDischargeModal(false);
                    setDischargeDate('');
                  }}
                  className="btn-secondary flex-1"
                >
                  取消
                </button>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

export default PatientModal;