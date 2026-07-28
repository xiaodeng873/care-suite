import React, { useState } from 'react';
import { X, AlertTriangle, User, Calendar, Clock, Activity, Droplets, Scale, Trash2 } from 'lucide-react';
import { usePatients, DuplicateRecordGroup, HealthRecord, Patient } from '../context/PatientContext';
import { formatDisplayDate , formatDisplayDateTime } from '../utils/dateFormat';


interface DeduplicateRecordsModalProps {
  duplicateGroups: DuplicateRecordGroup[];
  onClose: () => void;
  onConfirm: (recordIds: number[]) => Promise<void>;
  patients: Patient[];
}

const DeduplicateRecordsModal: React.FC<DeduplicateRecordsModalProps> = ({
  duplicateGroups,
  onClose,
  onConfirm,
  patients
}) => {
  const [isDeleting, setIsDeleting] = useState(false);
  const [selectedGroups, setSelectedGroups] = useState<Set<string>>(
    new Set(duplicateGroups.map(g => g.key))
  );

  const getPatientName = (patientId: number) => {
    const patient = patients.find(p => p.院友id === patientId);
    return patient ? `${patient.中文姓氏}${patient.中文名字}` : '未知';
  };

  const getPatientBedNumber = (patientId: number) => {
    const patient = patients.find(p => p.院友id === patientId);
    return patient?.床號 || '-';
  };

  const formatRecordValues = (record: HealthRecord): string[] => {
    if (record.監測類型 === '血壓') return [`血壓: ${record.數值}/${record.數值_副} mmHg`];
    if (record.監測類型 === '脈搏') return [`脈搏: ${record.數值} /min`];
    if (record.監測類型 === '體溫') return [`體溫: ${record.數值}°C`];
    if (record.監測類型 === '呼吸') return [`呼吸: ${record.數值} /min`];
    if (record.監測類型 === '血含氧量') return [`血氧: ${record.數值}%`];
    if (record.監測類型 === '血糖值') return [`血糖: ${record.數值} mmol/L`];
    if (record.監測類型 === '體重') return [`體重: ${record.數值} kg`];
    return [`${record.監測類型}: ${record.數值}`];
  };

  const toggleGroup = (groupKey: string) => {
    const newSelected = new Set(selectedGroups);
    if (newSelected.has(groupKey)) {
      newSelected.delete(groupKey);
    } else {
      newSelected.add(groupKey);
    }
    setSelectedGroups(newSelected);
  };

  const selectAll = () => {
    setSelectedGroups(new Set(duplicateGroups.map(g => g.key)));
  };

  const deselectAll = () => {
    setSelectedGroups(new Set());
  };

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      // 收集所有要刪除的記錄ID
      const recordIds: number[] = [];
      duplicateGroups.forEach(group => {
        if (selectedGroups.has(group.key)) {
          group.duplicateRecords.forEach(record => {
            recordIds.push(record.記錄id);
          });
        }
      });

      await onConfirm(recordIds);
      onClose();
    } catch (error) {
      console.error('Error deleting duplicate records:', error);
      alert('刪除重複記錄失敗，請重試');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.duplicateRecords.length, 0);
  const selectedDuplicates = duplicateGroups
    .filter(group => selectedGroups.has(group.key))
    .reduce((sum, group) => sum + group.duplicateRecords.length, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" onClick={onClose}>
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg z-10">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="flex flex-wrap items-center gap-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">去重確認</h2>
                <p className="text-sm text-gray-600 mt-1">
                  發現 {duplicateGroups.length} 組重複記錄，共 {totalDuplicates} 筆重複數據
                </p>
              </div>
            </div>
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
              disabled={isDeleting}
            >
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-4">
          <div className="mb-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3 bg-blue-50 p-4 rounded-lg">
            <div className="flex flex-wrap items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  以下記錄將被移至回收筒（可恢復）
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  每組中建立時間最早的記錄將被保留，其餘記錄將被刪除
                </p>
              </div>
            </div>
            <div className="flex flex-wrap gap-2">
              <button
                onClick={selectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                全選
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={deselectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                取消全選
              </button>
            </div>
          </div>

          <div className="space-y-4">
            {duplicateGroups.map((group) => {
              const isSelected = selectedGroups.has(group.key);
              const patientName = getPatientName(group.keepRecord.院友id);
              const bedNumber = getPatientBedNumber(group.keepRecord.院友id);

              return (
                <div
                  key={group.key}
                  className={`border rounded-lg overflow-hidden ${
                    isSelected ? 'border-blue-300 bg-blue-50' : 'border-gray-200'
                  }`}
                >
                  <div
                    className="p-4 cursor-pointer hover:bg-gray-50"
                    onClick={() => toggleGroup(group.key)}
                  >
                    <div className="flex items-start justify-between">
                      <div className="flex items-start gap-3 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleGroup(group.key)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <div className="flex flex-wrap items-center gap-3 mb-2">
                            <div className="flex flex-wrap items-center gap-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span className="font-medium text-gray-900">{patientName}</span>
                              <span className="text-sm text-gray-500">({bedNumber})</span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {formatDisplayDate(group.keepRecord.記錄日期)}
                              </span>
                            </div>
                            <div className="flex flex-wrap items-center gap-2">
                              <Clock className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {group.keepRecord.記錄時間}
                              </span>
                            </div>
                          </div>
                          <div className="flex flex-wrap gap-2">
                            {formatRecordValues(group.keepRecord).map((value, idx) => (
                              <span
                                key={idx}
                                className="text-xs bg-gray-100 text-gray-700 px-2 py-1 rounded"
                              >
                                {value}
                              </span>
                            ))}
                          </div>
                        </div>
                        <div className="text-right">
                          <div className="inline-flex items-center px-2 py-1 bg-yellow-100 text-yellow-800 text-xs font-medium rounded">
                            {group.duplicateRecords.length} 筆重複
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                      <div className="space-y-2">
                        <div className="flex flex-wrap items-center gap-2 text-sm">
                          <div className="w-24 text-green-700 font-medium">✓ 保留:</div>
                          <div className="text-gray-600">
                            記錄 #{group.keepRecord.記錄id} (建立於{' '}
                            {group.keepRecord.created_at
                              ? formatDisplayDateTime(group.keepRecord.created_at)
                              : '未知時間'}
                            )
                          </div>
                        </div>
                        {group.duplicateRecords.map((record) => (
                          <div key={record.記錄id} className="flex flex-wrap items-center gap-2 text-sm">
                            <div className="w-24 text-red-700 font-medium flex items-center">
                              <Trash2 className="h-3 w-3 mr-1" />
                              刪除:
                            </div>
                            <div className="text-gray-600">
                              記錄 #{record.記錄id} (建立於{' '}
                              {record.created_at
                                ? formatDisplayDateTime(record.created_at)
                                : '未知時間'}
                              )
                            </div>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>

        <div className="sticky bottom-0 bg-white border-t border-gray-200 px-6 py-4 rounded-b-lg">
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
            <div className="text-sm text-gray-600">
              已選擇 <span className="font-medium text-gray-900">{selectedDuplicates}</span> 筆重複記錄將被刪除
            </div>
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <button
                onClick={onClose}
                className="btn-secondary"
                disabled={isDeleting}
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                className="btn-primary flex flex-wrap items-center gap-2"
                disabled={isDeleting || selectedDuplicates === 0}
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>刪除中...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>確認刪除 ({selectedDuplicates})</span>
                  </>
                )}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default DeduplicateRecordsModal;
