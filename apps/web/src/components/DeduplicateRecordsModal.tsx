import React, { useState } from 'react';
import { X, AlertTriangle, User, Calendar, Clock, Activity, Droplets, Scale, Trash2 } from 'lucide-react';
import { usePatients, DuplicateRecordGroup, HealthRecord, Patient } from '../context/PatientContext';

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

  const formatRecordValues = (record: HealthRecord) => {
    const values: string[] = [];
    if (record.血壓收縮壓 && record.血壓舒張壓) {
      values.push(`血壓: ${record.血壓收縮壓}/${record.血壓舒張壓} mmHg`);
    }
    if (record.脈搏) values.push(`脈搏: ${record.脈搏} /min`);
    if (record.體溫) values.push(`體溫: ${record.體溫}°C`);
    if (record.呼吸頻率) values.push(`呼吸: ${record.呼吸頻率} /min`);
    if (record.血含氧量) values.push(`血氧: ${record.血含氧量}%`);
    if (record.血糖值) values.push(`血糖: ${record.血糖值} mmol/L`);
    if (record.體重) values.push(`體重: ${record.體重} kg`);
    return values;
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
      // 收集所有要删除的记录ID
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
      alert('删除重复记录失败，请重试');
    } finally {
      setIsDeleting(false);
    }
  };

  const totalDuplicates = duplicateGroups.reduce((sum, group) => sum + group.duplicateRecords.length, 0);
  const selectedDuplicates = duplicateGroups
    .filter(group => selectedGroups.has(group.key))
    .reduce((sum, group) => sum + group.duplicateRecords.length, 0);

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-6xl w-full max-h-[90vh] flex flex-col">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 rounded-t-lg z-10">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-3">
              <div className="p-2 bg-yellow-100 rounded-lg">
                <AlertTriangle className="h-6 w-6 text-yellow-600" />
              </div>
              <div>
                <h2 className="text-xl font-bold text-gray-900">去重确认</h2>
                <p className="text-sm text-gray-600 mt-1">
                  发现 {duplicateGroups.length} 组重复记录，共 {totalDuplicates} 条重复数据
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
          <div className="mb-4 flex items-center justify-between bg-blue-50 p-4 rounded-lg">
            <div className="flex items-center space-x-2">
              <AlertTriangle className="h-5 w-5 text-blue-600" />
              <div>
                <p className="text-sm font-medium text-blue-900">
                  以下记录将被移至回收筒（可恢复）
                </p>
                <p className="text-xs text-blue-700 mt-1">
                  每组中创建时间最早的记录将被保留，其余记录将被删除
                </p>
              </div>
            </div>
            <div className="flex space-x-2">
              <button
                onClick={selectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                全选
              </button>
              <span className="text-gray-300">|</span>
              <button
                onClick={deselectAll}
                className="text-sm text-blue-600 hover:text-blue-700 font-medium"
              >
                取消全选
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
                      <div className="flex items-start space-x-3 flex-1">
                        <input
                          type="checkbox"
                          checked={isSelected}
                          onChange={() => toggleGroup(group.key)}
                          onClick={(e) => e.stopPropagation()}
                          className="mt-1 h-5 w-5 text-blue-600 focus:ring-blue-500 border-gray-300 rounded"
                        />
                        <div className="flex-1">
                          <div className="flex items-center space-x-3 mb-2">
                            <div className="flex items-center space-x-2">
                              <User className="h-4 w-4 text-gray-400" />
                              <span className="font-medium text-gray-900">{patientName}</span>
                              <span className="text-sm text-gray-500">({bedNumber})</span>
                            </div>
                            <div className="flex items-center space-x-2">
                              <Calendar className="h-4 w-4 text-gray-400" />
                              <span className="text-sm text-gray-600">
                                {new Date(group.keepRecord.記錄日期).toLocaleDateString('zh-TW')}
                              </span>
                            </div>
                            <div className="flex items-center space-x-2">
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
                            {group.duplicateRecords.length} 条重复
                          </div>
                        </div>
                      </div>
                    </div>
                  </div>

                  {isSelected && (
                    <div className="bg-gray-50 px-4 py-3 border-t border-gray-200">
                      <div className="space-y-2">
                        <div className="flex items-center space-x-2 text-sm">
                          <div className="w-24 text-green-700 font-medium">✓ 保留:</div>
                          <div className="text-gray-600">
                            记录 #{group.keepRecord.記錄id} (创建于{' '}
                            {group.keepRecord.created_at
                              ? new Date(group.keepRecord.created_at).toLocaleString('zh-TW')
                              : '未知时间'}
                            )
                          </div>
                        </div>
                        {group.duplicateRecords.map((record) => (
                          <div key={record.記錄id} className="flex items-center space-x-2 text-sm">
                            <div className="w-24 text-red-700 font-medium flex items-center">
                              <Trash2 className="h-3 w-3 mr-1" />
                              删除:
                            </div>
                            <div className="text-gray-600">
                              记录 #{record.記錄id} (创建于{' '}
                              {record.created_at
                                ? new Date(record.created_at).toLocaleString('zh-TW')
                                : '未知时间'}
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
          <div className="flex items-center justify-between">
            <div className="text-sm text-gray-600">
              已选择 <span className="font-medium text-gray-900">{selectedDuplicates}</span> 条重复记录将被删除
            </div>
            <div className="flex space-x-3">
              <button
                onClick={onClose}
                className="btn-secondary"
                disabled={isDeleting}
              >
                取消
              </button>
              <button
                onClick={handleConfirm}
                className="btn-primary flex items-center space-x-2"
                disabled={isDeleting || selectedDuplicates === 0}
              >
                {isDeleting ? (
                  <>
                    <div className="animate-spin rounded-full h-4 w-4 border-b-2 border-white"></div>
                    <span>删除中...</span>
                  </>
                ) : (
                  <>
                    <Trash2 className="h-4 w-4" />
                    <span>确认删除 ({selectedDuplicates})</span>
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
