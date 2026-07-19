import React, { useState, useEffect, useRef } from 'react';
import { createPortal } from 'react-dom';
import { User, Calendar, CreditCard, Phone } from 'lucide-react';
import { getFormattedEnglishName } from '../utils/nameFormatter';
import { getPatientContacts } from '../lib/database';

interface PatientTooltipProps {
  patient: {
    院友id?: number;
    中文姓氏: string;
    中文名字: string;
    英文姓名?: string;
    英文姓氏?: string;
    英文名字?: string;
    身份證號碼: string;
    出生日期?: string;
    床號: string;
  };
  children: React.ReactNode;
}

const PatientTooltip: React.FC<PatientTooltipProps> = ({ patient, children }) => {
  const [showTooltip, setShowTooltip] = useState(false);
  const [position, setPosition] = useState({ top: 0, left: 0 });
  const [firstContact, setFirstContact] = useState<any>(null);
  const triggerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const fetchFirstContact = async () => {
      if (patient.院友id && showTooltip) {
        try {
          const contacts = await getPatientContacts(patient.院友id);
          if (contacts && contacts.length > 0) {
            setFirstContact(contacts[0]);
          }
        } catch (error) {
          console.error('Error fetching first contact:', error);
        }
      }
    };
    fetchFirstContact();
  }, [patient.院友id, showTooltip]);

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

  const handleMouseEnter = () => {
    if (triggerRef.current) {
      const rect = triggerRef.current.getBoundingClientRect();
      setPosition({
        top: rect.top - 8,
        left: rect.left + rect.width / 2 - 128,
      });
    }
    setShowTooltip(true);
  };

  const tooltipContent = (
    <div 
      className="fixed z-[99999] w-64 bg-white border border-gray-200 rounded-lg shadow-lg p-3"
      style={{ top: position.top, left: position.left, transform: 'translateY(-100%)' }}
    >
      {/* 小箭頭 */}
      <div className="absolute top-full left-1/2 transform -translate-x-1/2 w-0 h-0 border-l-4 border-r-4 border-t-4 border-l-transparent border-r-transparent border-t-gray-200"></div>
      
      <div className="space-y-1.5 text-sm text-gray-700">
        <div className="flex flex-wrap items-center gap-2">
          <User className="h-4 w-4 text-blue-600 flex-shrink-0" />
          <span className="text-gray-500 flex-shrink-0">中文姓名：</span>
          <span className="font-medium text-gray-900">{patient.中文姓氏}{patient.中文名字}</span>
        </div>

        {(patient.英文姓氏 || patient.英文名字 || patient.英文姓名) && (
          <div className="flex flex-wrap items-center gap-2">
            <span className="w-4 flex-shrink-0"></span>
            <span className="text-gray-500 flex-shrink-0">英文姓名：</span>
            <span className="text-gray-800">
              {patient.英文姓氏 || patient.英文名字
                ? getFormattedEnglishName(patient.英文姓氏, patient.英文名字)
                : patient.英文姓名}
            </span>
          </div>
        )}

        <div className="flex flex-wrap items-center gap-2">
          <CreditCard className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <span className="text-gray-500 flex-shrink-0">身份證號碼：</span>
          <span className="text-gray-900">{patient.身份證號碼}</span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <Calendar className="h-4 w-4 text-gray-500 flex-shrink-0" />
          <span className="text-gray-500 flex-shrink-0">出生日期：</span>
          <span className="text-gray-900">
            {patient.出生日期
              ? new Date(patient.出生日期).toLocaleDateString('zh-TW')
              : '未知'}
          </span>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="w-4 flex-shrink-0"></span>
          <span className="text-gray-500 flex-shrink-0">年齡：</span>
          <span className="text-gray-900">
            {patient.出生日期 ? `${calculateAge(patient.出生日期)}歲` : '未知'}
          </span>
        </div>

        {firstContact && (
          <>
            <div className="border-t border-gray-200 my-2"></div>
            <div className="flex flex-wrap items-center gap-2">
              <Phone className="h-4 w-4 text-green-600 flex-shrink-0" />
              <span className="text-gray-500 flex-shrink-0">第一聯絡人姓名：</span>
              <span className="font-medium text-gray-900">
                {firstContact.聯絡人姓名}
                {firstContact.關係 && <span className="text-gray-500 ml-1">({firstContact.關係})</span>}
              </span>
            </div>
            {firstContact.聯絡電話 && (
              <div className="flex flex-wrap items-center gap-2">
                <span className="w-4 flex-shrink-0"></span>
                <span className="text-gray-500 flex-shrink-0">手提電話：</span>
                <span className="text-gray-900">{firstContact.聯絡電話}</span>
              </div>
            )}
          </>
        )}
      </div>
    </div>
  );

  return (
    <div 
      ref={triggerRef}
      className="inline-block"
      onMouseEnter={handleMouseEnter}
      onMouseLeave={() => setShowTooltip(false)}
    >
      {children}
      {showTooltip && createPortal(tooltipContent, document.body)}
    </div>
  );
};

export default PatientTooltip;