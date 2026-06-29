import React, { useState } from 'react';
import { X, Stethoscope, Calendar, User, FileText } from 'lucide-react';
import { usePatients, type PatientTubeCareRecord } from '../context/PatientContext';
import PatientAutocomplete from './PatientAutocomplete';
import { calculateTubeCareNextDueDate } from '../utils/taskScheduler';

interface TubeCareModalProps {
  record?: PatientTubeCareRecord;
  onClose: () => void;
  onUpdate?: () => void;
  renewFrom?: PatientTubeCareRecord | null;
  defaultCareType?: PatientTubeCareRecord['care_type'];
}

const CARE_TYPES: PatientTubeCareRecord['care_type'][] = ['尿導管更換', '鼻胃飼管更換', '氧氣喉管清洗/更換', '造口袋更換'];
const TUBE_MATERIALS = ['Latex', 'Silicon'];
const TUBE_SIZES = ['Fr. 8', 'Fr. 10', 'Fr. 12', 'Fr. 14', 'Fr. 16', 'Fr. 18'];
const OXYGEN_ACTIONS: PatientTubeCareRecord['oxygen_action'][] = ['清洗', '更換'];
// 氧氣喉管預設間隔：清洗 每天一次(1 天)、更換 每 7 天一次
const OXYGEN_DEFAULT_WASH_CYCLE = 1;
const OXYGEN_DEFAULT_REPLACE_CYCLE = 7;
// 造口袋預設更換間隔
const STOMA_DEFAULT_CYCLE = 7;

const getHongKongDate = () => {
  const now = new Date();
  const hongKongTime = new Date(now.getTime() + 8 * 60 * 60 * 1000);
  return hongKongTime.toISOString().split('T')[0];
};

const TubeCareModal: React.FC<TubeCareModalProps> = ({ record, onClose, onUpdate, renewFrom, defaultCareType }) => {
  const { patients, addPatientTubeCareRecord, updatePatientTubeCareRecord } = usePatients();

  const seed = record ?? renewFrom ?? undefined;

  const [formData, setFormData] = useState({
    patient_id: (record?.patient_id ?? renewFrom?.patient_id ?? '') as string | number,
    care_type: (record?.care_type ?? defaultCareType ?? seed?.care_type ?? '尿導管更換') as PatientTubeCareRecord['care_type'],
    execution_date: record?.execution_date ?? getHongKongDate(),
    next_due_date: record?.next_due_date ?? '',
    tube_material: record?.tube_material ?? renewFrom?.tube_material ?? '',
    tube_size: record?.tube_size ?? renewFrom?.tube_size ?? '',
    oxygen_action: (record?.oxygen_action ?? renewFrom?.oxygen_action ?? '清洗') as PatientTubeCareRecord['oxygen_action'],
    cycle_days: (record?.cycle_days ?? renewFrom?.cycle_days ?? STOMA_DEFAULT_CYCLE) as number,
    wash_cycle_days: (record?.wash_cycle_days ?? renewFrom?.wash_cycle_days ?? OXYGEN_DEFAULT_WASH_CYCLE) as number,
    replace_cycle_days: (record?.replace_cycle_days ?? renewFrom?.replace_cycle_days ?? OXYGEN_DEFAULT_REPLACE_CYCLE) as number,
    notes: record?.notes ?? '',
  });

  const isOxygen = formData.care_type === '氧氣喉管清洗/更換';
  const isStoma = formData.care_type === '造口袋更換';

  // 自動計算下次到期日
  React.useEffect(() => {
    const calculated = calculateTubeCareNextDueDate({
      care_type: formData.care_type,
      execution_date: formData.execution_date,
      tube_material: formData.tube_material || null,
      cycle_days: isStoma ? formData.cycle_days : null,
      oxygen_action: isOxygen ? formData.oxygen_action : null,
      wash_cycle_days: isOxygen ? formData.wash_cycle_days : null,
      replace_cycle_days: isOxygen ? formData.replace_cycle_days : null,
    });
    if (calculated) {
      setFormData(prev => ({ ...prev, next_due_date: calculated }));
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formData.care_type, formData.execution_date, formData.tube_material, formData.cycle_days, formData.oxygen_action, formData.wash_cycle_days, formData.replace_cycle_days]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!formData.patient_id) {
      alert('請選擇院友');
      return;
    }
    if (!formData.execution_date) {
      alert('請選擇執行日期');
      return;
    }
    if (!isOxygen && !isStoma && !formData.tube_material) {
      alert('請選擇喉管類型');
      return;
    }

    try {
      const isTube = !isOxygen && !isStoma;
      const data = {
        patient_id: parseInt(String(formData.patient_id), 10),
        care_type: formData.care_type,
        execution_date: formData.execution_date,
        next_due_date: formData.next_due_date || null,
        tube_material: isTube ? formData.tube_material || null : null,
        tube_size: isTube ? formData.tube_size || null : null,
        oxygen_action: isOxygen ? formData.oxygen_action : null,
        cycle_days: isStoma ? formData.cycle_days : null,
        wash_cycle_days: isOxygen ? formData.wash_cycle_days : null,
        replace_cycle_days: isOxygen ? formData.replace_cycle_days : null,
        notes: formData.notes || null,
      } as Omit<PatientTubeCareRecord, 'id' | 'created_at' | 'updated_at'>;

      if (record) {
        await updatePatientTubeCareRecord({ id: record.id, ...data } as PatientTubeCareRecord);
      } else {
        await addPatientTubeCareRecord(data);
      }
      onUpdate?.();
      onClose();
    } catch (error) {
      console.error('儲存喉管護理記錄失敗:', error);
      alert('儲存喉管護理記錄失敗，請重試');
    }
  };

  const isLocked = !!record || !!renewFrom;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-teal-100">
                <Stethoscope className="h-6 w-6 text-teal-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">
                {record ? '編輯喉管護理記錄' : renewFrom ? '新增記錄（續期）' : '新增喉管護理記錄'}
              </h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {/* 院友 */}
          <div>
            <label className="form-label">
              <User className="h-4 w-4 inline mr-1" />
              院友 *
            </label>
            {isLocked ? (
              <div className="form-input bg-gray-100 cursor-not-allowed">
                {(() => {
                  const pid = record?.patient_id ?? renewFrom?.patient_id;
                  const p = patients.find(pt => pt.院友id === Number(pid));
                  return p ? `${p.床號} - ${p.中文姓名}` : '未知院友';
                })()}
              </div>
            ) : (
              <PatientAutocomplete
                value={formData.patient_id}
                onChange={(patientId) => setFormData(prev => ({ ...prev, patient_id: patientId }))}
                placeholder="搜尋院友..."
                showResidencyFilter={true}
                defaultResidencyStatus="在住"
              />
            )}
          </div>

          {/* 護理類型 */}
          <div>
            <label className="form-label">護理類型 *</label>
            <select
              value={formData.care_type}
              onChange={(e) => setFormData(prev => ({ ...prev, care_type: e.target.value as PatientTubeCareRecord['care_type'] }))}
              className="form-input"
              disabled={!!record}
            >
              {CARE_TYPES.map(t => <option key={t} value={t}>{t}</option>)}
            </select>
          </div>

          {/* 執行日期 */}
          <div>
            <label className="form-label">
              <Calendar className="h-4 w-4 inline mr-1" />
              執行日期 *
            </label>
            <input
              type="date"
              value={formData.execution_date}
              onChange={(e) => setFormData(prev => ({ ...prev, execution_date: e.target.value }))}
              className="form-input"
              required
            />
          </div>

          {/* 尿導管 / 鼻胃飼管設定 */}
          {!isOxygen && !isStoma && (
            <div className="space-y-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <h4 className="text-sm font-medium text-blue-900">喉管設定</h4>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">喉管類型 *</label>
                  <select
                    value={formData.tube_material}
                    onChange={(e) => setFormData(prev => ({ ...prev, tube_material: e.target.value }))}
                    className="form-input"
                    required
                  >
                    <option value="">請選擇</option>
                    {TUBE_MATERIALS.map(m => <option key={m} value={m}>{m}</option>)}
                  </select>
                </div>
                <div>
                  <label className="form-label">管徑</label>
                  <select
                    value={formData.tube_size}
                    onChange={(e) => setFormData(prev => ({ ...prev, tube_size: e.target.value }))}
                    className="form-input"
                  >
                    <option value="">請選擇</option>
                    {TUBE_SIZES.map(s => <option key={s} value={s}>{s}</option>)}
                  </select>
                </div>
              </div>
              <ul className="text-xs text-blue-700 space-y-1">
                <li>• <strong>Latex：</strong>每 2 週更換一次（執行日 + 14 天）</li>
                <li>• <strong>Silicon：</strong>每 4 週更換一次（執行日 + 28 天）</li>
              </ul>
            </div>
          )}

          {/* 氧氣喉管設定 */}
          {isOxygen && (
            <div className="space-y-4 p-4 bg-teal-50 border border-teal-200 rounded-lg">
              <h4 className="text-sm font-medium text-teal-900">氧氣喉管設定（清洗與更換為一套）</h4>
              <div>
                <label className="form-label">今次動作 *</label>
                <select
                  value={formData.oxygen_action as string}
                  onChange={(e) => setFormData(prev => ({ ...prev, oxygen_action: e.target.value as PatientTubeCareRecord['oxygen_action'] }))}
                  className="form-input"
                >
                  {OXYGEN_ACTIONS.map(a => <option key={a} value={a as string}>{a}</option>)}
                </select>
                <p className="text-xs text-teal-700 mt-1">記錄今天實際做了「清洗」還是「更換」。</p>
              </div>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="form-label">清洗間隔（天）*</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.wash_cycle_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, wash_cycle_days: parseInt(e.target.value, 10) || 1 }))}
                    className="form-input"
                    required
                  />
                </div>
                <div>
                  <label className="form-label">更換間隔（天）*</label>
                  <input
                    type="number"
                    min={1}
                    value={formData.replace_cycle_days}
                    onChange={(e) => setFormData(prev => ({ ...prev, replace_cycle_days: parseInt(e.target.value, 10) || 1 }))}
                    className="form-input"
                    required
                  />
                </div>
              </div>
              <p className="text-xs text-teal-700">
                預設：清洗每 1 天、更換每 7 天，可自由調整。下次到期 = 執行日 + 對應動作間隔；更換時清洗計時會一併歸零。
              </p>
            </div>
          )}

          {/* 造口袋設定 */}
          {isStoma && (
            <div className="space-y-4 p-4 bg-purple-50 border border-purple-200 rounded-lg">
              <h4 className="text-sm font-medium text-purple-900">造口袋設定</h4>
              <div>
                <label className="form-label">更換間隔（天）*</label>
                <input
                  type="number"
                  min={1}
                  value={formData.cycle_days}
                  onChange={(e) => setFormData(prev => ({ ...prev, cycle_days: parseInt(e.target.value, 10) || 1 }))}
                  className="form-input"
                  required
                />
              </div>
              <p className="text-xs text-purple-700">預設每 7 天更換一次，可自由調整。下次到期 = 執行日 + 間隔天數。</p>
            </div>
          )}

          {/* 下次到期日 */}
          <div>
            <label className="form-label">
              <Calendar className="h-4 w-4 inline mr-1" />
              下次到期日
            </label>
            <input
              type="date"
              value={formData.next_due_date}
              onChange={(e) => setFormData(prev => ({ ...prev, next_due_date: e.target.value }))}
              className="form-input"
            />
            <p className="text-xs text-gray-500 mt-1">依設定自動計算，亦可手動調整。</p>
          </div>

          {/* 備註 */}
          <div>
            <label className="form-label">
              <FileText className="h-4 w-4 inline mr-1" />
              備註
            </label>
            <textarea
              value={formData.notes}
              onChange={(e) => setFormData(prev => ({ ...prev, notes: e.target.value }))}
              className="form-input"
              rows={2}
            />
          </div>

          <div className="flex justify-end gap-3 pt-2">
            <button type="button" onClick={onClose} className="btn-secondary">取消</button>
            <button type="submit" className="btn-primary">{record ? '儲存' : '新增'}</button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default TubeCareModal;
