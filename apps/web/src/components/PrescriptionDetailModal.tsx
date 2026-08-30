import React, { useMemo } from 'react';
import { X, Pill, User, Calendar, Clock, AlertTriangle, Stethoscope, FlaskConical, Beaker, CheckCircle, Ban } from 'lucide-react';
import type { Patient, MedicationPrescription } from '../lib/database';
import { formatDisplayDate, calculateAge } from '../utils/dateFormat';
import BedNumberImprint from './BedNumberImprint';

interface PrescriptionDetailModalProps {
  prescription: MedicationPrescription;
  patient: Patient | undefined;
  onClose: () => void;
}

type PrescriptionStatus = 'active' | 'pending_change' | 'inactive';

const getStatusColor = (status: PrescriptionStatus) => {
  switch (status) {
    case 'active': return 'bg-green-100 text-green-800 border-green-200';
    case 'pending_change': return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'inactive': return 'bg-gray-100 text-gray-800 border-gray-200';
    default: return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

const getStatusLabel = (status: PrescriptionStatus) => {
  switch (status) {
    case 'active': return '在服處方';
    case 'pending_change': return '待變更處方';
    case 'inactive': return '停用處方';
    default: return status;
  }
};

const getFrequencyDescription = (prescription: MedicationPrescription) => {
  const { frequency_type, frequency_value, specific_weekdays, is_odd_even_day, medication_time_slots, daily_frequency } = prescription;

  const getFrequencyAbbreviation = (count: number): string => {
    switch (count) {
      case 1: return 'QD';
      case 2: return 'BD';
      case 3: return 'TDS';
      case 4: return 'QID';
      default: return `${count}次/日`;
    }
  };

  const timeSlotsCount = medication_time_slots?.length || 0;
  const perDay = daily_frequency || timeSlotsCount || frequency_value || 1;

  switch (frequency_type) {
    case 'daily':
      return getFrequencyAbbreviation(perDay);
    case 'every_x_days':
      return `隔${frequency_value}日${perDay}次`;
    case 'every_x_weeks':
      return `隔${frequency_value}星期${perDay}次`;
    case 'every_x_months':
      return `隔${frequency_value}月${perDay}次`;
    case 'weekly_days': {
      const dayNames = ['週一', '週二', '週三', '週四', '週五', '週六', '週日'];
      const days = specific_weekdays?.map((day: number) => dayNames[day === 7 ? 0 : day]).join('、') || '';
      return `逢${days}${perDay}次`;
    }
    case 'odd_even_days':
      return is_odd_even_day === 'odd' ? `單日${perDay}次` : is_odd_even_day === 'even' ? `雙日${perDay}次` : `單雙日${perDay}次`;
    case 'hourly':
      return `每${frequency_value}小時1次`;
    case 'each_time':
      return '每次服';
    default:
      return getFrequencyAbbreviation(perDay);
  }
};

const operatorLabels: Record<string, string> = {
  gt: '大於',
  lt: '小於',
  gte: '大於或等於',
  lte: '小於或等於',
};

const actionLabels: Record<string, string> = {
  block_dispensing: '停服',
  warning_only: '警告',
};

const preparationLabels: Record<string, string> = {
  immediate: '即時備藥',
  advanced: '提前備藥',
  custom: '自理',
};

const PrescriptionDetailModal: React.FC<PrescriptionDetailModalProps> = ({ prescription, patient, onClose }) => {
  const age = useMemo(() => calculateAge(patient?.出生日期), [patient?.出生日期]);
  const status = (prescription.status || 'active') as PrescriptionStatus;
  const frequencyDesc = useMemo(() => getFrequencyDescription(prescription), [prescription]);
  const hasInspectionRules = Array.isArray(prescription.inspection_rules) && prescription.inspection_rules.length > 0;

  const infoRow = (icon: React.ReactNode, label: string, value: React.ReactNode, fullWidth = false) => (
    <div className={`flex items-start gap-3 ${fullWidth ? 'md:col-span-2' : ''}`}>
      <div className="mt-0.5 text-gray-400 flex-shrink-0">{icon}</div>
      <div className="flex-1 min-w-0">
        <div className="text-xs text-gray-500">{label}</div>
        <div className="text-sm font-medium text-gray-900 break-words">{value || '-'}</div>
      </div>
    </div>
  );

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50" onClick={onClose}>
      <div className="bg-white rounded-lg max-w-3xl w-full max-h-[90vh] overflow-y-auto" onClick={(e) => e.stopPropagation()}>
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4">
          <div className="flex items-center justify-between gap-3">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-lg bg-blue-100">
                <Pill className="h-6 w-6 text-blue-600" />
              </div>
              <h2 className="text-xl font-semibold text-gray-900">處方詳情</h2>
            </div>
            <button onClick={onClose} className="text-gray-400 hover:text-gray-600">
              <X className="h-6 w-6" />
            </button>
          </div>
        </div>

        <div className="p-6 space-y-6">
          {/* 院友資訊 */}
          <div className="bg-gray-50 rounded-lg p-4">
            <div className="flex items-start gap-4">
              <div className="w-16 h-16 bg-blue-100 rounded-full overflow-hidden flex items-center justify-center flex-shrink-0">
                {patient?.院友相片 ? (
                  <img src={patient.院友相片} alt={patient.中文姓名} className="w-full h-full object-cover" />
                ) : (
                  <User className="h-8 w-8 text-blue-600" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex flex-wrap items-center gap-2 mb-1">
                  <h3 className="text-lg font-bold text-gray-900">
                    {patient ? `${patient.中文姓氏}${patient.中文名字}` : '未知院友'}
                  </h3>
                  {patient && <BedNumberImprint patient={patient} size="sm" className="text-sm text-gray-600" />}
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  {patient?.床號 && <span>床號：<span className="font-medium text-gray-900">{patient.床號}</span></span>}
                  {patient?.性別 && (
                    <span className="ml-3">性別：<span className="font-medium text-gray-900">{patient.性別}</span></span>
                  )}
                  {age !== null && age !== undefined && (
                    <span className="ml-3">年齡：<span className="font-medium text-gray-900">{age}歲</span></span>
                  )}
                </div>
              </div>
            </div>
          </div>

          {/* 藥物與狀態 */}
          <div className="bg-blue-50 rounded-lg p-4">
            <div className="flex flex-wrap items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-white">
                <Pill className="h-5 w-5 text-blue-600" />
              </div>
              <div className="flex-1 min-w-0">
                <h3 className="text-lg font-bold text-gray-900 break-words">{prescription.medication_name}</h3>
                {prescription.dosage_form && <p className="text-sm text-gray-600">{prescription.dosage_form}</p>}
              </div>
              <span className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium border ${getStatusColor(status)}`}>
                {status === 'active' ? <CheckCircle className="h-4 w-4 mr-1.5" /> : status === 'inactive' ? <Ban className="h-4 w-4 mr-1.5" /> : <AlertTriangle className="h-4 w-4 mr-1.5" />}
                {getStatusLabel(status)}
              </span>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {infoRow(<Calendar className="h-4 w-4" />, '處方日期', formatDisplayDate(prescription.prescription_date))}
              {infoRow(<Calendar className="h-4 w-4" />, '長期 / 短期', prescription.end_date ? '短期' : '長期')}
              {infoRow(<Calendar className="h-4 w-4" />, '開始日期', formatDisplayDate(prescription.start_date))}
              {infoRow(<Calendar className="h-4 w-4" />, '結束日期', prescription.end_date ? formatDisplayDate(prescription.end_date) : '無')}
              {prescription.start_time && infoRow(<Clock className="h-4 w-4" />, '開始時間', prescription.start_time)}
              {prescription.end_time && infoRow(<Clock className="h-4 w-4" />, '結束時間', prescription.end_time)}
              {infoRow(<Stethoscope className="h-4 w-4" />, '服用途徑', prescription.administration_route)}
              {infoRow(<Beaker className="h-4 w-4" />, '劑量 / 單位', `${prescription.dosage_amount || ''} ${prescription.dosage_unit || ''}`.trim() || '-')}
              {infoRow(<Clock className="h-4 w-4" />, '頻次', frequencyDesc)}
              {infoRow(<Clock className="h-4 w-4" />, '服用時段', prescription.meal_timing)}
              {infoRow(<FlaskConical className="h-4 w-4" />, '備藥方式', prescription.preparation_method ? preparationLabels[prescription.preparation_method] : '-')}
              {infoRow(<CheckCircle className="h-4 w-4" />, '需要時 (PRN)', prescription.is_prn ? '是' : '否')}
            </div>
          </div>

          {/* 服用時間點 */}
          {prescription.medication_time_slots && prescription.medication_time_slots.length > 0 && (
            <div className="bg-yellow-50 rounded-lg p-4">
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <Clock className="h-5 w-5 text-yellow-600" />
                服用時間點
              </h3>
              <div className="flex flex-wrap gap-2">
                {prescription.medication_time_slots.map((time) => (
                  <span key={time} className="px-3 py-1 bg-white border border-yellow-300 rounded-lg text-sm font-medium text-gray-900">
                    {time}
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* 檢測項 */}
          {hasInspectionRules && (
            <div className="bg-orange-50 rounded-lg p-4">
              <h3 className="text-base font-semibold text-gray-900 mb-3 flex items-center gap-2">
                <AlertTriangle className="h-5 w-5 text-orange-600" />
                檢測項設定
              </h3>
              <div className="space-y-2">
                {prescription.inspection_rules!.map((rule, index) => (
                  <div key={index} className="bg-white border border-orange-200 rounded-lg p-3 flex flex-wrap items-center gap-2 text-sm">
                    <span className="font-medium text-gray-900">{rule.vital_sign_type}</span>
                    <span className="text-gray-500">{operatorLabels[rule.condition_operator] || rule.condition_operator}</span>
                    <span className="font-medium text-gray-900">{rule.condition_value}</span>
                    <span className="text-gray-500">→</span>
                    <span className="font-medium text-orange-700">{actionLabels[rule.action_if_met || 'block_dispensing'] || rule.action_if_met}</span>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* 備註 */}
          {prescription.notes && (
            <div className="bg-gray-50 rounded-lg p-4">
              <h3 className="text-base font-semibold text-gray-900 mb-2">注意事項</h3>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{prescription.notes}</p>
            </div>
          )}

          <div className="flex justify-end pt-2">
            <button
              onClick={onClose}
              className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg text-sm font-medium"
            >
              關閉
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PrescriptionDetailModal;
