import React, { useState } from 'react';
import { User, Calendar, CreditCard } from 'lucide-react';
import { getFormattedEnglishName } from '../utils/nameFormatter';

interface PatientTooltipProps {
  patient: {
    中文姓氏: string;
    中文名字: string;
    英文姓名?: string;
    英文姓氏?: string;
    英文名字?: string;
    身份證號碼: string;
    出生日期: string;
    床號: string;
  };
  children: React.ReactNode;
}

const PatientTooltip: React.FC<PatientTooltipProps> = ({ patient, children }) => {
  const [showTooltip, setShowTooltip] = useState(false);

  const calculateAge = (birthDate: string) => {
    const today = new Date();
    const birth = new Date(birthDate);
    let age = today.getFullYear() - birth.getFullYear();
    const monthDiff = today.getMonth() - birth.getMonth();
    
    if (monthDiff < 0 || (monthDiff === 0 && today.getDate() < birth.getDate())) {
      age--;
    }
    
    return age;
  };

  return (
    <div 
      className="relative inline-block"
      onMouseEnter={() => setShowTooltip(true)}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && (
        <div className="absolute z-50 bottom-full left-1/2 transform -translate-x-1/2 mb-2 w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3">
          {/* 小箭頭 */}
          <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-200"></div>
          
          <div className="space-y-2">
            <div className="flex items-center space-x-2">
              <User className="h-4 w-4 text-blue-600" />
              <div>
                <div className="font-medium text-gray-900">{patient.中文姓氏}{patient.中文名字}</div>
                {(patient.英文姓氏 || patient.英文名字) ? (
                  <div className="text-sm text-gray-600">{getFormattedEnglishName(patient.英文姓氏, patient.英文名字)}</div>
                ) : null}
                {patient.英文姓名 && !(patient.英文姓氏 || patient.英文名字) ? <div className="text-sm text-gray-600">{patient.英文姓名}</div> : null}
              </div>
            </div>
            
            <div className="flex items-center space-x-2">
              <CreditCard className="h-4 w-4 text-gray-500" />
              <div className="text-sm text-gray-700">{patient.身份證號碼}</div>
            </div>
            
            <div className="flex items-center space-x-2">
              <Calendar className="h-4 w-4 text-gray-500" />
              <div className="text-sm text-gray-700">
                {calculateAge(patient.出生日期)}歲 ({new Date(patient.出生日期).toLocaleDateString('zh-TW')})
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default PatientTooltip;