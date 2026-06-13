import React, { useState, useRef, useEffect } from 'react';
import { X, Plus, Trash2, Upload, Download, Heart, Activity, Droplets, Scale, User, Calendar, Clock } from 'lucide-react';
import { usePatients } from '../context/PatientContext';
import { useAuth } from '../context/AuthContext';
import PatientAutocomplete from './PatientAutocomplete';
import { isInHospital } from '../utils/careRecordHelper';

// 香港時區輔助函數
const getHongKongDate = () => {
  const now = new Date();
  const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // GMT+8
  return hongKongTime.toISOString().split('T')[0];
};

const getHongKongTime = () => {
  const now = new Date();
  const hongKongTime = new Date(now.getTime() + (8 * 60 * 60 * 1000)); // GMT+8
  return hongKongTime.toISOString().split('T')[1].slice(0, 5);
};

interface BatchRecord {
  id: string;
  院友id: string;
  記錄日期: string;
  記錄時間: string;
  血壓收縮壓?: string;
  血壓舒張壓?: string;
  脈搏?: string;
  體溫?: string;
  血含氧量?: string;
  呼吸頻率?: string;
  血糖值?: string;
  體重?: string;
  備註?: string;
  記錄人員?: string;
  isAbsent?: boolean;
 absenceReason?: string;
 customAbsenceReason?: string;
}

interface BatchHealthRecordModalProps {
  onClose: () => void;
  recordType: '生命表徵' | '血糖控制' | '體重控制';
}

const BatchHealthRecordModal: React.FC<BatchHealthRecordModalProps> = ({ onClose, recordType }) => {
  const { patients, addHealthRecord, hospitalEpisodes, admissionRecords } = usePatients();
  const { displayName } = useAuth();
  const [autoSelectPrevious, setAutoSelectPrevious] = useState(false);
  const [autoSelectNextBed, setAutoSelectNextBed] = useState(false);

  // 檢查院友在指定日期時間是否入院中（包括住院和外出就醫）
  const checkPatientAbsent = (patientId: string, recordDate: string, recordTime: string): boolean => {
    if (!patientId || !recordDate || !recordTime) return false;
    const patient = patients.find(p => p.院友id.toString() === patientId.toString());
    if (!patient) return false;

    // 檢查是否在入院期間（使用 careRecordHelper 的 isInHospital 函數）
    const inHospital = isInHospital(patient, recordDate, recordTime, admissionRecords, hospitalEpisodes);

    return inHospital;
  };
  // 檢查當前是否在入院（含住院與外出就醫），用於 UI 禁用提示
  const checkPatientHospitalized = (patientId: string): boolean => {
    if (!patientId) return false;
    const patient = patients.find(p => p.院友id.toString() === patientId.toString());
    if (!patient) return false;
    if (patient.is_hospitalized) return true;

    const today = getHongKongDate();
    const nowTime = getHongKongTime();
    return isInHospital(patient, today, nowTime, admissionRecords, hospitalEpisodes);
  };
  
  const [records, setRecords] = useState<BatchRecord[]>([
    {
      id: Date.now().toString(),
      院友id: '',
      記錄日期: getHongKongDate(),
      記錄時間: recordType === '體重控制' ? '00:00' : getHongKongTime(),
      備註: '',
      記錄人員: displayName || '',
     isAbsent: false,
     absenceReason: '',
     customAbsenceReason: ''
    }
  ]);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadResults, setUploadResults] = useState<{ success: number; failed: number; errors: string[] } | null>(null);
  const recordsContainerRef = useRef<HTMLDivElement>(null);
  const recordRefs = useRef<Map<string, HTMLDivElement>>(new Map());

  // 按床號排序院友，確保正確排序
  const sortedPatients = [...patients].sort((a, b) => {
    return a.床號.localeCompare(b.床號, 'zh-Hant', { numeric: true });
  });

  // 滾動到最新記錄
  useEffect(() => {
    const newestRecordId = records[records.length - 1]?.id;
    const newestRecordElement = recordRefs.current.get(newestRecordId);
    if (newestRecordElement && recordsContainerRef.current) {
      const container = recordsContainerRef.current;
      const recordTop = newestRecordElement.getBoundingClientRect().top - container.getBoundingClientRect().top + container.scrollTop;
      container.scrollTo({
        top: recordTop,
        behavior: 'smooth'
      });
    }
  }, [records]);

  const getTypeIcon = (type: string) => {
    switch (type) {
      case '生命表徵': return <Activity className="h-5 w-5" />;
      case '血糖控制': return <Droplets className="h-5 w-5" />;
      case '體重控制': return <Scale className="h-5 w-5" />;
      default: return <Heart className="h-5 w-5" />;
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case '生命表徵': return 'text-blue-600';
      case '血糖控制': return 'text-red-600';
      case '體重控制': return 'text-green-600';
      default: return 'text-purple-600';
    }
  };

  const addRecord = () => {
    const lastRecord = records[records.length - 1];
    let newPatientId = '';
    let newRecordDate = getHongKongDate(); // 預設為當前日期
    let newRecordTime = recordType === '體重控制' ? '00:00' : getHongKongTime();
    let newRecorder = '';

    if (autoSelectPrevious && lastRecord?.院友id) {

      newPatientId = lastRecord.院友id;
      newRecordDate = lastRecord.記錄日期; // 複製上一筆的記錄日期
      newRecordTime = lastRecord.記錄時間 || newRecordTime;
      newRecorder = lastRecord.記錄人員 || '';
    } else if (autoSelectNextBed && sortedPatients.length > 0) {
      if (lastRecord?.院友id) {
        // 查找上一筆記錄的院友在 sortedPatients 中的索引
        const currentIndex = sortedPatients.findIndex(p => p.院友id.toString() === lastRecord.院友id);

        // 如果找到有效索引，選擇下一個院友（循環到第一個）
        if (currentIndex >= 0) {
          const nextIndex = (currentIndex + 1) % sortedPatients.length;
          newPatientId = sortedPatients[nextIndex].院友id.toString();
        } else {
          // 如果未找到（無效院友ID），選擇第一個院友
          newPatientId = sortedPatients[0].院友id.toString();
        }
      } else {
        // 如果上一筆記錄沒有院友ID，選擇第一個院友
        newPatientId = sortedPatients[0].院友id.toString();
      }
      newRecordDate = lastRecord?.記錄日期 || newRecordDate;
      newRecordTime = lastRecord?.記錄時間 || newRecordTime;
      newRecorder = lastRecord?.記錄人員 || '';
    }

    const newRecord: BatchRecord = {
      id: Date.now().toString(),
      院友id: newPatientId,
      記錄日期: newRecordDate,
      記錄時間: newRecordTime,
      備註: '',
      記錄人員: newRecorder,
      isAbsent: false
    };

    setRecords([...records, newRecord]);
  };

  const removeRecord = (id: string) => {
    if (records.length > 1) {
      setRecords(records.filter(record => record.id !== id));
      recordRefs.current.delete(id);
    }
  };

  const updateRecord = (id: string, field: string, value: string) => {
    // 當院友ID或日期時間改變時，檢查是否入院中並自動設定
    if (field === '院友id' || field === '記錄日期' || field === '記錄時間') {
      setRecords(records.map(record => {
        if (record.id === id) {
          const updatedRecord = { ...record, [field]: value };

          // 使用更新後的值檢查是否在入院期間
          const checkPatientId = field === '院友id' ? value : record.院友id;
          const checkDate = field === '記錄日期' ? value : record.記錄日期;
          const checkTime = field === '記錄時間' ? value : record.記錄時間;

          const isAbsent = checkPatientAbsent(checkPatientId, checkDate, checkTime);

          if (isAbsent) {
            // 院友在入院期間，自動設定為無法量度
            return {
              ...updatedRecord,
              isAbsent: true,
              absenceReason: '入院',
              備註: '無法量度原因: 入院',
              // 清空所有監測數值
              血壓收縮壓: '',
              血壓舒張壓: '',
              脈搏: '',
              體溫: '',
              血含氧量: '',
              呼吸頻率: '',
              血糖值: '',
              體重: ''
            };
          } else {
            // 院友不在入院期間，清除自動設定的入院狀態
            if (record.isAbsent && record.absenceReason === '入院') {
              updatedRecord.isAbsent = false;
              updatedRecord.absenceReason = '';
              updatedRecord.備註 = '';
            }
            return updatedRecord;
          }
        }
        return record;
      }));
      return;
    }
    
    if (field === 'isAbsent') {
      const isAbsent = value === 'true';
      setRecords(records.map(record => {
        if (record.id === id) {
          if (isAbsent) {
            // 勾選缺席：清空所有監測數值，設定備註為"缺席"
            return {
              ...record,
              isAbsent: true,
             absenceReason: '',
             customAbsenceReason: '',
              血壓收縮壓: '',
              血壓舒張壓: '',
              脈搏: '',
              體溫: '',
              血含氧量: '',
              呼吸頻率: '',
              血糖值: '',
              體重: '',
             備註: '無法量度'
            };
          } else {
            // 取消勾選缺席：清空備註
            return {
              ...record,
              isAbsent: false,
             absenceReason: '',
             customAbsenceReason: '',
              備註: ''
            };
          }
        }
        return record;
      }));
   } else if (field === 'absenceReason') {
     setRecords(records.map(record => {
       if (record.id === id) {
         if (value === '其他') {
           return {
             ...record,
             absenceReason: value,
             customAbsenceReason: '',
             備註: '無法量度原因: '
           };
         } else {
           return {
             ...record,
             absenceReason: value,
             customAbsenceReason: '',
             備註: value ? `無法量度原因: ${value}` : '無法量度'
           };
         }
       }
       return record;
     }));
   } else if (field === 'customAbsenceReason') {
     setRecords(records.map(record => {
       if (record.id === id && record.absenceReason === '其他') {
         return {
           ...record,
           customAbsenceReason: value,
           備註: value ? `無法量度原因: ${value}` : '無法量度原因: '
         };
       }
       return record;
     }));
    } else {
      setRecords(records.map(record =>
        record.id === id ? { ...record, [field]: value } : record
      ));
    }
  };

  const validateRecord = (record: BatchRecord): string[] => {
    const errors: string[] = [];

    if (!record.院友id) {
      errors.push('請選擇院友');
    }

    if (!record.記錄日期) {
      errors.push('請填寫記錄日期');
    }

    if (!record.記錄時間 && recordType !== '體重控制') {
      errors.push('請填寫記錄時間');
    }

    if (recordType === '生命表徵') {
      const hasVitalSign = record.isAbsent || record.血壓收縮壓 || record.血壓舒張壓 || record.脈搏 ||
        record.體溫 || record.血含氧量 || record.呼吸頻率;
      if (!hasVitalSign) {
        errors.push('至少需要填寫一項生命表徵數值');
      }
    } else if (recordType === '血糖控制') {
      if (!record.isAbsent && !record.血糖值) {
        errors.push('請填寫血糖值');
      }
    } else if (recordType === '體重控制') {
      if (!record.isAbsent && !record.體重) {
        errors.push('請填寫體重');
      }
    }

    return errors;
  };

  const handleBatchUpload = async () => {
    setIsUploading(true);
    setUploadResults(null);

    let successCount = 0;
    let failedCount = 0;
    const errors: string[] = [];

    try {
      for (let i = 0; i < records.length; i++) {
        const record = records[i];
        const recordErrors = validateRecord(record);

        if (recordErrors.length > 0) {
          failedCount++;
          errors.push(`第 ${i + 1} 筆記錄：${recordErrors.join(', ')}`);
          continue;
        }

        try {
          const recordData = {
            院友id: parseInt(record.院友id),
            記錄日期: record.記錄日期,
            記錄時間: recordType === '體重控制' ? '00:00' : record.記錄時間,
            記錄類型: recordType,
            血壓收縮壓: record.血壓收縮壓 ? parseInt(record.血壓收縮壓) : null,
            血壓舒張壓: record.血壓舒張壓 ? parseInt(record.血壓舒張壓) : null,
            脈搏: record.脈搏 ? parseInt(record.脈搏) : null,
            體溫: record.體溫 ? parseFloat(record.體溫) : null,
            血含氧量: record.血含氧量 ? parseInt(record.血含氧量) : null,
            呼吸頻率: record.呼吸頻率 ? parseInt(record.呼吸頻率) : null,
            血糖值: record.血糖值 ? parseFloat(record.血糖值) : null,
            體重: record.體重 ? parseFloat(record.體重) : null,
            備註: record.備註 || null,
            記錄人員: record.記錄人員 || null
          };

          await addHealthRecord(recordData);

          successCount++;
        } catch (error) {
          failedCount++;
          console.error(`第 ${i + 1} 筆記錄儲存失敗:`, error);
          errors.push(`第 ${i + 1} 筆記錄：儲存失敗 - ${error instanceof Error ? error.message : '未知錯誤'}`);
        }
      }

      setUploadResults({
        success: successCount,
        failed: failedCount,
        errors: errors
      });

      if (failedCount === 0) {
        setTimeout(() => {
          onClose();
        }, 3000);
      }

    } catch (error) {
      console.error('批量上傳失敗:', error);
      setUploadResults({
        success: successCount,
        failed: records.length - successCount,
        errors: ['批量上傳過程中發生錯誤，請重試']
      });
    } finally {
      setIsUploading(false);
    }
  };

  const downloadTemplate = () => {
    let headers: string[] = ['院友床號', '院友姓名', '記錄日期', '記錄時間'];

    if (recordType === '生命表徵') {
      headers = [...headers, '血壓收縮壓', '血壓舒張壓', '脈搏', '體溫', '血含氧量', '呼吸頻率'];
    } else if (recordType === '血糖控制') {
      headers = [...headers, '血糖值'];
    } else if (recordType === '體重控制') {
      headers = [...headers, '體重'];
    }

    headers = [...headers, '備註', '記錄人員'];

    const exampleData = patients.slice(0, 3).map(patient => {
      let row = [
        patient.床號,
        patient.中文姓名,
        new Date().toISOString().split('T')[0],
        '08:00'
      ];

      if (recordType === '生命表徵') {
        row = [...row, '120', '80', '72', '36.5', '98', '18'];
      } else if (recordType === '血糖控制') {
        row = [...row, '5.5'];
      } else if (recordType === '體重控制') {
        row = [...row, '65.0'];
      }

      row = [...row, '', ''];
      return row;
    });

    const csvContent = [
      `"${recordType}批量上傳範本"`,
      `"生成日期: ${new Date().toLocaleDateString('zh-TW')}"`,
      '',
      headers.map(h => `"${h}"`).join(','),
      ...exampleData.map(row => row.map(cell => `"${cell}"`).join(','))
    ].join('\n');

    const blob = new Blob(['\uFEFF' + csvContent], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${recordType}批量上傳範本.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };

  // 處理勾選框互斥邏輯
  const handleAutoSelectPrevious = (checked: boolean) => {
    setAutoSelectPrevious(checked);
    if (checked) {
      setAutoSelectNextBed(false);
    }
  };

  const handleAutoSelectNextBed = (checked: boolean) => {
    setAutoSelectNextBed(checked);
    if (checked) {
      setAutoSelectPrevious(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-6xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className={`p-2 rounded-lg ${getTypeColor(recordType)} bg-opacity-10`}>
                {getTypeIcon(recordType)}
              </div>
              <div>
                <h2 className="text-xl font-semibold text-gray-900">批量新增{recordType}記錄</h2>
                <p className="text-sm text-gray-600">一次新增多筆{recordType}記錄</p>
              </div>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={onClose}
                className="text-gray-400 hover:text-gray-600"
              >
                <X className="h-6 w-6" />
              </button>
            </div>
          </div>
        </div>

        <div className="p-6">
          {uploadResults && (
            <div className={`mb-6 p-4 rounded-lg border ${
              uploadResults.failed === 0
                ? 'bg-green-50 border-green-200'
                : 'bg-yellow-50 border-yellow-200'
            }`}>
              <div className="flex flex-wrap items-center gap-2 mb-2">
                {uploadResults.failed === 0 ? (
                  <div className="flex items-center text-green-800">
                    <Heart className="h-5 w-5 mr-2" />
                    <span className="font-medium">批量上傳完成！</span>
                  </div>
                ) : (
                  <div className="flex items-center text-yellow-800">
                    <Activity className="h-5 w-5 mr-2" />
                    <span className="font-medium">批量上傳部分完成</span>
                  </div>
                )}
              </div>
              <div className="text-sm">
                <p>成功：{uploadResults.success} 筆，失敗：{uploadResults.failed} 筆</p>
                {uploadResults.errors.length > 0 && (
                  <div className="mt-2">
                    <p className="font-medium">錯誤詳情：</p>
                    <ul className="list-disc list-inside space-y-1">
                      {uploadResults.errors.map((error, index) => (
                        <li key={index} className="text-red-600">{error}</li>
                      ))}
                    </ul>
                  </div>
                )}
              </div>
              {uploadResults.failed === 0 && (
                <p className="text-sm text-green-600 mt-2">視窗將在 3 秒後自動關閉...</p>
              )}
            </div>
          )}

          <div className="space-y-4">
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
              <h3 className="text-lg font-medium text-gray-900">
                記錄列表 ({records.length} 筆)
              </h3>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex flex-wrap items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoSelectPrevious}
                    onChange={(e) => handleAutoSelectPrevious(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">自動選擇上一筆院友</span>
                </label>
                <label className="flex flex-wrap items-center gap-2 text-sm">
                  <input
                    type="checkbox"
                    checked={autoSelectNextBed}
                    onChange={(e) => handleAutoSelectNextBed(e.target.checked)}
                    className="h-4 w-4 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                  />
                  <span className="text-gray-700">自動選擇下一位院友(按床號)</span>
                </label>
              </div>
            </div>

            <div ref={recordsContainerRef} className="space-y-3 max-h-[400px] overflow-y-auto">
              {records.map((record, index) => (
                <div
                  key={record.id}
                  ref={(el) => {
                    if (el) {
                      recordRefs.current.set(record.id, el);
                    } else {
                      recordRefs.current.delete(record.id);
                    }
                  }}
                  className="border rounded-lg p-4 bg-gray-50"
                >
                  <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 mb-3">
                    <h4 className="font-medium text-gray-900">第 {index + 1} 筆記錄</h4>
                    {records.length > 1 && (
                      <button
                        onClick={() => removeRecord(record.id)}
                        className="text-red-600 hover:text-red-700"
                        title="刪除此記錄"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                    <div>
                      <label className="form-label">
                        <User className="h-4 w-4 inline mr-1" />
                        院友 *
                      </label>
                      <PatientAutocomplete
                        value={record.院友id}
                        onChange={(patientId) => updateRecord(record.id, '院友id', patientId)}
                        placeholder="搜索院友..."
                      />
                      {/* 入院中院友提示 */}
                      {record.院友id && checkPatientHospitalized(record.院友id) && (
                        <div className="mt-1 p-2 bg-red-100 border border-red-300 rounded text-xs text-red-800">
                          <div className="flex items-center space-x-1">
                            <span>🏥</span>
                            <span>此院友入院中，已自動設定為無法量度</span>
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <label className="form-label">
                        <Calendar className="h-4 w-4 inline mr-1" />
                        記錄日期 *
                      </label>
                      <input
                        type="date"
                        value={record.記錄日期}
                        onChange={(e) => updateRecord(record.id, '記錄日期', e.target.value)}
                        className="form-input"
                        required
                      />
                    </div>

                    <div>
                      <label className="form-label">
                        <Clock className="h-4 w-4 inline mr-1" />
                        {recordType === '體重控制' ? '記錄時間' : '記錄時間 *'}
                      </label>
                      <input
                        type="time"
                        value={record.記錄時間}
                        onChange={(e) => updateRecord(record.id, '記錄時間', e.target.value)}
                        className="form-input"
                        required={recordType !== '體重控制'}
                        disabled={recordType === '體重控制'}
                      />
                      {recordType === '體重控制' && (
                        <p className="text-xs text-gray-500 mt-1">
                          體重記錄不需要具體時間
                        </p>
                      )}
                    </div>

                    <div>
                      <label className="form-label">記錄人員</label>
                      <input
                        type="text"
                        value={record.記錄人員}
                        onChange={(e) => updateRecord(record.id, '記錄人員', e.target.value)}
                        className="form-input"
                        placeholder="記錄人員姓名"
                      />
                    </div>
                  </div>

                  {/* 缺席選項 */}
                  <div className="col-span-full">
                    <div className={`flex flex-wrap items-center gap-3 p-3 rounded-lg border ${
                      record.院友id && checkPatientHospitalized(record.院友id)
                        ? 'bg-red-50 border-red-200' 
                        : 'bg-orange-50 border-orange-200'
                    }`}>
                      <input
                        type="checkbox"
                        checked={record.isAbsent || false}
                        onChange={(e) => updateRecord(record.id, 'isAbsent', e.target.checked.toString())}
                        className={`h-4 w-4 border-gray-300 rounded ${
                          record.院友id && checkPatientHospitalized(record.院友id)
                            ? 'text-red-600 focus:ring-red-500' 
                            : 'text-orange-600 focus:ring-orange-500'
                        }`}
                        disabled={record.院友id && checkPatientHospitalized(record.院友id)}
                      />
                      <label className={`text-sm font-medium ${
                        record.院友id && checkPatientHospitalized(record.院友id)
                          ? 'text-red-800' 
                          : 'text-orange-800'
                      }`}>
                        院友未能進行監測
                        {record.院友id && checkPatientHospitalized(record.院友id) && (
                          <span className="ml-2 text-red-600 font-bold">(院友入院中)</span>
                        )}
                      </label>
                     {record.isAbsent && (
                       <div className="flex flex-wrap items-center gap-2">
                         <label className={`text-sm ${
                           record.院友id && checkPatientHospitalized(record.院友id)
                             ? 'text-red-700' 
                             : 'text-orange-700'
                         }`}>原因:</label>
                         <select
                           value={record.absenceReason || ''}
                           onChange={(e) => updateRecord(record.id, 'absenceReason', e.target.value)}
                           className="form-input text-sm w-24"
                           required={record.isAbsent}
                           disabled={record.院友id && checkPatientHospitalized(record.院友id) && record.absenceReason === '入院'}
                         >
                           <option value="">請選擇</option>
                           <option value="入院">入院</option>
                           <option value="回家">回家</option>
                           <option value="拒絕">拒絕</option>
                           <option value="其他">其他</option>
                         </select>
                         {record.absenceReason === '其他' && (
                           <input
                             type="text"
                             value={record.customAbsenceReason || ''}
                             onChange={(e) => updateRecord(record.id, 'customAbsenceReason', e.target.value)}
                             className="form-input text-sm w-32 ml-2"
                             placeholder="請輸入原因..."
                             required
                           />
                         )}
                         {record.absenceReason === '其他' && (
                           <input
                             type="text"
                             value={record.customAbsenceReason || ''}
                             onChange={(e) => updateRecord(record.id, 'customAbsenceReason', e.target.value)}
                             className="form-input text-sm w-32"
                             placeholder="請輸入原因..."
                             required
                           />
                         )}
                       </div>
                     )}
                    </div>
                  </div>
                  {recordType === '生命表徵' && (
                    <div className="space-y-4 mt-4">
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="form-label">血壓 (mmHg)</label>
                          <div className="flex flex-wrap gap-2">
                            <input
                              type="text"
                              value={record.血壓收縮壓}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9]/g, '');
                                if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 300)) {
                                  updateRecord(record.id, '血壓收縮壓', value);
                                }
                              }}
                              className="form-input"
                              placeholder="120"
                              disabled={record.isAbsent}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              autoComplete="off"
                            />
                            <span className="flex items-center text-gray-500">/</span>
                            <input
                              type="text"
                              value={record.血壓舒張壓}
                              onChange={(e) => {
                                const value = e.target.value.replace(/[^0-9]/g, '');
                                if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 200)) {
                                  updateRecord(record.id, '血壓舒張壓', value);
                                }
                              }}
                              className="form-input"
                              placeholder="80"
                              disabled={record.isAbsent}
                              inputMode="numeric"
                              pattern="[0-9]*"
                              autoComplete="off"
                            />
                          </div>
                        </div>
                        <div>
                          <label className="form-label">脈搏 (每分鐘)</label>
                          <input
                            type="text"
                            value={record.脈搏}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 300)) {
                                updateRecord(record.id, '脈搏', value);
                              }
                            }}
                            className="form-input"
                            placeholder="72"
                            disabled={record.isAbsent}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="off"
                          />
                        </div>
                        <div>
                          <label className="form-label">體溫 (°C)</label>
                          <input
                            type="text"
                            value={record.體溫}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9.]/g, '');
                              if (value === '' || (parseFloat(value) >= 30 && parseFloat(value) <= 45) || value.endsWith('.')) {
                                updateRecord(record.id, '體溫', value);
                              }
                            }}
                            className="form-input"
                            placeholder="36.5"
                            disabled={record.isAbsent}
                            inputMode="decimal"
                            pattern="[0-9.]*"
                            autoComplete="off"
                          />
                        </div>
                      </div>

                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                        <div>
                          <label className="form-label">血含氧量 (%)</label>
                          <input
                            type="text"
                            value={record.血含氧量}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 100)) {
                                updateRecord(record.id, '血含氧量', value);
                              }
                            }}
                            className="form-input"
                            placeholder="98"
                            disabled={record.isAbsent}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="off"
                          />
                        </div>
                        <div>
                          <label className="form-label">呼吸頻率 (每分鐘)</label>
                          <input
                            type="text"
                            value={record.呼吸頻率}
                            onChange={(e) => {
                              const value = e.target.value.replace(/[^0-9]/g, '');
                              if (value === '' || (parseInt(value) >= 0 && parseInt(value) <= 100)) {
                                updateRecord(record.id, '呼吸頻率', value);
                              }
                            }}
                            className="form-input"
                            placeholder="18"
                            disabled={record.isAbsent}
                            inputMode="numeric"
                            pattern="[0-9]*"
                            autoComplete="off"
                          />
                        </div>
                        <div>
                          <label className="form-label">備註</label>
                          <textarea
                            value={record.備註}
                            onChange={(e) => updateRecord(record.id, '備註', e.target.value)}
                            className="form-input"
                            rows={1}
                            placeholder="其他備註資訊..."
                            disabled={record.isAbsent}
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {recordType === '血糖控制' && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                      <div>
                        <label className="form-label">血糖值 (mmol/L) *</label>
                        <input
                          type="text"
                          value={record.血糖值}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 50) || value.endsWith('.')) {
                              updateRecord(record.id, '血糖值', value);
                            }
                          }}
                          className="form-input"
                          placeholder="5.5"
                          required
                          disabled={record.isAbsent}
                          inputMode="decimal"
                          pattern="[0-9.]*"
                          autoComplete="off"
                        />
                      </div>
                      <div>
                        <label className="form-label">備註</label>
                        <textarea
                          value={record.備註}
                          onChange={(e) => updateRecord(record.id, '備註', e.target.value)}
                          className="form-input"
                          rows={1}
                          placeholder="血糖測試相關備註..."
                          disabled={record.isAbsent}
                        />
                      </div>
                    </div>
                  )}

                  {recordType === '體重控制' && (
                    <div className="grid grid-cols-1 gap-4 mt-4">
                      <div>
                        <label className="form-label">體重 (kg) *</label>
                        <input
                          type="text"
                          value={record.體重}
                          onChange={(e) => {
                            const value = e.target.value.replace(/[^0-9.]/g, '');
                            if (value === '' || (parseFloat(value) >= 0 && parseFloat(value) <= 300) || value.endsWith('.')) {
                              updateRecord(record.id, '體重', value);
                            }
                          }}
                          className="form-input"
                          placeholder="65.0"
                          required
                          disabled={record.isAbsent}
                          inputMode="decimal"
                          pattern="[0-9.]*"
                          autoComplete="off"
                        />
                      </div>
                    </div>
                  )}
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-col sm:flex-row gap-2 pt-6 border-t border-gray-200">
            <button
              onClick={handleBatchUpload}
              disabled={isUploading || records.length === 0}
              className="btn-primary flex-1 flex flex-wrap items-center justify-center gap-2"
            >
              {isUploading ? (
                <>
                  <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                  <span>上傳中...</span>
                </>
              ) : (
                <>
                  <Upload className="h-4 w-4" />
                  <span>一鍵上傳 ({records.length} 筆記錄)</span>
                </>
              )}
            </button>

            <button
              type="button"
              onClick={addRecord}
              className="btn-secondary flex-1 flex flex-wrap items-center justify-center gap-2"
              disabled={isUploading}
            >
              <Plus className="h-4 w-4" />
              <span>新增記錄</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}; 

export default BatchHealthRecordModal;