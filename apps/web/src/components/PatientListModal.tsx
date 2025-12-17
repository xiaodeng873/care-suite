import React, { useEffect } from 'react';
import { X, Users, User } from 'lucide-react';

interface PatientListModalProps {
  isOpen: boolean;
  onClose: () => void;
  title: string;
  patientNames: string[];
}

const PatientListModal: React.FC<PatientListModalProps> = ({
  isOpen,
  onClose,
  title,
  patientNames,
}) => {
  useEffect(() => {
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        onClose();
      }
    };

    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-lg shadow-xl max-w-2xl w-full max-h-[80vh] flex flex-col"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="bg-blue-50 px-6 py-4 border-b-2 border-blue-200 rounded-t-lg flex items-center justify-between">
          <div className="flex items-center space-x-3">
            <Users className="h-6 w-6 text-blue-600" />
            <div>
              <h3 className="text-lg font-semibold text-gray-900">{title}</h3>
              <p className="text-sm text-gray-600">共 {patientNames.length} 位院友</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-500 hover:text-gray-700 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-6">
          {patientNames.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-12 text-gray-400">
              <Users className="h-16 w-16 mb-3" />
              <p className="text-lg">暫無院友</p>
            </div>
          ) : (
            <ul className="space-y-2">
              {patientNames.map((name, idx) => (
                <li
                  key={idx}
                  className="flex items-center space-x-3 p-3 bg-gray-50 rounded-lg hover:bg-gray-100 transition-colors"
                >
                  <span className="flex-shrink-0 w-8 h-8 bg-blue-100 text-blue-600 rounded-full flex items-center justify-center text-sm font-semibold">
                    {idx + 1}
                  </span>
                  <User className="h-5 w-5 text-gray-400 flex-shrink-0" />
                  <span className="text-gray-800 font-medium">{name}</span>
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="px-6 py-4 bg-gray-50 border-t border-gray-200 rounded-b-lg flex justify-end">
          <button
            onClick={onClose}
            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors font-medium"
          >
            關閉
          </button>
        </div>
      </div>
    </div>
  );
};

export default PatientListModal;
