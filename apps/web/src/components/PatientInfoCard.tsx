import React, { useState } from 'react';
import { User, AlertTriangle, ChevronDown, ChevronUp } from 'lucide-react';
import type { Patient } from '../lib/database';
import { supabase } from '../lib/supabase';

interface PatientInfoCardProps {
  patient: Patient | null;
  onToggleCrushMedication?: (patientId: number, needsCrushing: boolean) => void;
  onOptimisticUpdate?: (patientId: number, needsCrushing: boolean) => void;
  defaultExpanded?: boolean; // 預設是否展開
}

const PatientInfoCard: React.FC<PatientInfoCardProps> = ({ 
  patient, 
  onToggleCrushMedication, 
  onOptimisticUpdate,
  defaultExpanded = true
}) => {
  const [isExpanded, setIsExpanded] = useState(defaultExpanded);

  if (!patient) {
    return (
      <div className="bg-gray-50 border border-gray-200 rounded-lg p-3 flex items-center justify-center text-gray-500">
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
    <div className="bg-white border border-gray-200 rounded-lg">
      {/* 摺疊標題列 */}
      <div 
        className="flex items-center justify-between px-3 py-2 cursor-pointer hover:bg-gray-50 transition-colors"
        onClick={() => setIsExpanded(!isExpanded)}
      >
        <div className="flex items-center space-x-3 min-w-0 flex-1">
          {/* 相片 */}
          <div className="flex-shrink-0">
            {patient.院友相片 ? (
              <img
                src={patient.院友相片}
                alt={patient.中文姓名}
                className="w-10 h-10 rounded-lg object-cover border border-gray-200"
              />
            ) : (
              <div className="w-10 h-10 rounded-lg bg-gray-100 border border-gray-200 flex items-center justify-center">
                <User className="w-5 h-5 text-gray-400" />
              </div>
            )}
          </div>
          
          {/* 基本資訊 - 單行顯示 */}
          <div className="flex items-center gap-3 flex-wrap min-w-0">
            <span className="font-medium text-blue-600 whitespace-nowrap">床號: {patient.床號}</span>
            <span className="font-bold text-gray-900">{patient.中文姓名}</span>
            {patient.英文姓名 && (
              <span className="text-gray-500 text-sm">{patient.英文姓名}</span>
            )}
            <span className="text-gray-600 text-sm">{patient.性別} | {calculateAge(patient.出生日期)}</span>
            
            {/* 碎藥需求開關 */}
            <div className="flex items-center space-x-2" onClick={(e) => e.stopPropagation()}>
              <span className="text-sm text-gray-600">碎藥:</span>
              <button
                onClick={handleCrushToggle}
                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-1 ${
                  patient.needs_medication_crushing ? 'bg-green-600' : 'bg-gray-300'
                }`}
                aria-label="碎藥需求開關"
              >
                <span
                  className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${
                    patient.needs_medication_crushing ? 'translate-x-5' : 'translate-x-0.5'
                  }`}
                />
              </button>
            </div>
            
            {/* 警示標誌 */}
            {hasAlertInfo && (
              <div className="flex items-center text-yellow-600">
                <AlertTriangle className="w-4 h-4" />
              </div>
            )}
          </div>
        </div>
        
        {/* 摺疊按鈕 */}
        <button className="p-1 text-gray-500 hover:text-gray-700 flex-shrink-0">
          {isExpanded ? <ChevronUp className="w-5 h-5" /> : <ChevronDown className="w-5 h-5" />}
        </button>
      </div>

      {/* 展開內容 - 藥物安全資訊 */}
      {isExpanded && hasAlertInfo && (
        <div className="px-3 pb-3 pt-1 border-t border-gray-100">
          <div className="flex flex-wrap gap-4">
            {/* 藥物敏感 */}
            {patient.藥物敏感 && patient.藥物敏感.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-yellow-800 whitespace-nowrap">藥物敏感:</span>
                <div className="flex flex-wrap gap-1">
                  {patient.藥物敏感.map((allergy: string, index: number) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-orange-100 text-orange-800 border border-orange-200"
                    >
                      <AlertTriangle className="h-3 w-3 mr-1" />
                      {allergy}
                    </span>
                  ))}
                </div>
              </div>
            )}

            {/* 不良藥物反應 */}
            {patient.不良藥物反應 && patient.不良藥物反應.length > 0 && (
              <div className="flex items-start gap-2">
                <span className="text-sm font-medium text-yellow-800 whitespace-nowrap">不良反應:</span>
                <div className="flex flex-wrap gap-1">
                  {patient.不良藥物反應.map((reaction: string, index: number) => (
                    <span
                      key={index}
                      className="inline-flex items-center px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-800 border border-red-200"
                    >
                      {reaction}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      )}

      {/* 展開內容 - 無警示資訊時顯示提示 */}
      {isExpanded && !hasAlertInfo && (
        <div className="px-3 pb-2 pt-1 border-t border-gray-100">
          <p className="text-sm text-gray-500">暫無藥物敏感或不良反應記錄</p>
        </div>
      )}
    </div>
  );
};

export default PatientInfoCard;
