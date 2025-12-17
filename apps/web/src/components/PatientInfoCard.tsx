import React from 'react';
import { User, AlertTriangle } from 'lucide-react';
import type { Patient } from '../lib/database';
import { supabase } from '../lib/supabase';

interface PatientInfoCardProps {
  patient: Patient | null;
  onToggleCrushMedication?: (patientId: number, needsCrushing: boolean) => void;
  onOptimisticUpdate?: (patientId: number, needsCrushing: boolean) => void;
}

const PatientInfoCard: React.FC<PatientInfoCardProps> = ({ patient, onToggleCrushMedication, onOptimisticUpdate }) => {
  if (!patient) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 flex items-center justify-center text-gray-500">
        <User className="w-5 h-5 mr-2" />
        <span>請選擇院友</span>
      </div>
    );
  }

  const handleCrushToggle = async (e: React.MouseEvent) => {
    e.preventDefault();
    e.stopPropagation();

    const newValue = !patient.needs_medication_crushing;

    // 樂觀更新 UI
    if (onOptimisticUpdate) {
      onOptimisticUpdate(patient.院友id, newValue);
    }

    try {
      const { error } = await supabase
        .from('院友主表')
        .update({ needs_medication_crushing: newValue })
        .eq('院友id', patient.院友id);

      if (error) {
        console.error('Supabase 更新錯誤:', error);
        throw error;
      }

      // 資料庫更新成功，刷新數據確保一致性
      if (onToggleCrushMedication) {
        onToggleCrushMedication(patient.院友id, newValue);
      }
    } catch (error) {
      console.error('❌ 更新碎藥狀態失敗:', error);
      alert('更新失敗，請稍後再試');

      // 更新失敗，回滾 UI（再次刷新數據）
      if (onToggleCrushMedication) {
        onToggleCrushMedication(patient.院友id, !newValue);
      }
    }
  };

  // 計算年齡
  const calculateAge = (birthDate: string | undefined): string => {
    if (!birthDate) return '未知';
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    return `${age}歲`;
  };

  // 格式化藥物敏感數據
  const formatAllergies = (): string => {
    if (!patient.藥物敏感 || patient.藥物敏感.length === 0) {
      return '無記錄';
    }
    return patient.藥物敏感.join('、');
  };

  // 格式化不良藥物反應數據
  const formatAdverseReactions = (): string => {
    if (!patient.不良藥物反應 || patient.不良藥物反應.length === 0) {
      return '無記錄';
    }
    return patient.不良藥物反應.join('、');
  };

  const hasAlertInfo = (patient.藥物敏感 && patient.藥物敏感.length > 0) ||
                       (patient.不良藥物反應 && patient.不良藥物反應.length > 0);

  return (
    <div className="bg-white border border-gray-200 rounded-lg p-4">
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* 左側：院友個人資訊 */}
        <div className="space-y-3">
          {/* 基本資訊行 */}
          <div className="flex items-start space-x-3">
            {/* 相片 */}
            <div className="flex-shrink-0">
              {patient.院友相片 ? (
                <img
                  src={patient.院友相片}
                  alt={patient.中文姓名}
                  className="w-16 h-16 rounded-lg object-cover border-2 border-gray-200"
                />
              ) : (
                <div className="w-16 h-16 rounded-lg bg-gray-100 border-2 border-gray-200 flex items-center justify-center">
                  <User className="w-8 h-8 text-gray-400" />
                </div>
              )}
            </div>

            {/* 基本資訊 */}
            <div className="flex-1 min-w-0 text-sm">
              <div className="flex flex-wrap items-center gap-x-3 gap-y-1">
                    <span className="font-medium text-blue-600">床號: {patient.床號}</span>
                <span className="font-bold text-gray-900 text-base">{patient.中文姓名}</span>
                {patient.英文姓名 && (
                  <span className="text-gray-600">{patient.英文姓名}</span>
                )}
                <span className="text-gray-600">
                  {patient.性別} | {calculateAge(patient.出生日期)}
                </span>
              </div>

              <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-gray-600">
                {patient.出生日期 && (
                  <span>生日: {patient.出生日期}</span>
                )}
                {patient.身份證號碼 && (
                  <span>身份證: {patient.身份證號碼}</span>
                )}
            
              </div>
            </div>
          </div>

          {/* 碎藥需求 Toggle - 靠左對齊 */}
          <div className="flex items-center space-x-3 pt-2 border-t border-gray-200">
            <span className="text-sm font-medium text-gray-700">特殊需求: 碎藥</span>
            <button
              onClick={handleCrushToggle}
              className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                patient.needs_medication_crushing ? 'bg-green-600' : 'bg-gray-300'
              }`}
              aria-label="碎藥需求開關"
            >
              <span
                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                  patient.needs_medication_crushing ? 'translate-x-6' : 'translate-x-1'
                }`}
              />
            </button>
            {patient.needs_medication_crushing && (
              <span className="text-sm font-medium text-green-700">✓ 已啟用</span>
            )}
          </div>
        </div>

        {/* 右側：藥物安全資訊 */}
        <div className="space-y-3">
          <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-3 h-full">
            <div className="flex items-center space-x-2 mb-2">
              <AlertTriangle className="w-5 h-5 text-yellow-600 flex-shrink-0" />
              <p className="text-sm font-semibold text-yellow-900">藥物安全資訊</p>
            </div>

            <div className="space-y-3">
              {/* 藥物敏感 */}
              <div>
                <span className="text-sm font-medium text-yellow-800">藥物敏感:</span>
                {(!patient.藥物敏感 || patient.藥物敏感.length === 0) ? (
                  <span className="text-sm text-gray-500 ml-2">無記錄</span>
                ) : (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {patient.藥物敏感.map((allergy: string, index: number) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-orange-100 text-orange-800 border border-orange-200"
                      >
                        <AlertTriangle className="h-3 w-3 mr-1" />
                        {allergy}
                      </span>
                    ))}
                  </div>
                )}
              </div>

              {/* 不良藥物反應 */}
              <div>
                <span className="text-sm font-medium text-yellow-800">不良反應:</span>
                {(!patient.不良藥物反應 || patient.不良藥物反應.length === 0) ? (
                  <span className="text-sm text-gray-500 ml-2">無記錄</span>
                ) : (
                  <div className="flex flex-wrap gap-1 mt-1">
                    {patient.不良藥物反應.map((reaction: string, index: number) => (
                      <span
                        key={index}
                        className="inline-flex items-center px-2 py-1 rounded-full text-xs bg-red-100 text-red-800 border border-red-200"
                      >
                        {reaction}
                      </span>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default PatientInfoCard;
