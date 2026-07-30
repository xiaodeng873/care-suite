import React from 'react';
import type { Patient, Bed } from '../lib/database';
import { usePatients } from '../context/PatientContext';
import { isTemporaryTransfer, getRootBedNumber } from '../utils/bedTransferUtils';

interface BedNumberImprintProps {
  patient: Patient;
  beds?: Bed[];
  size?: 'sm' | 'md' | 'lg';
  className?: string;
}

const sizeClasses = {
  sm: {
    main: 'text-xs',
    imprint: 'text-[10px]',
  },
  md: {
    main: 'text-sm',
    imprint: 'text-xs',
  },
  lg: {
    main: 'text-base',
    imprint: 'text-sm',
  },
};

const BedNumberImprint: React.FC<BedNumberImprintProps> = ({
  patient,
  beds: bedsProp,
  size = 'md',
  className = '',
}) => {
  const { beds: contextBeds } = usePatients();
  const beds = bedsProp ?? contextBeds ?? [];
  const currentBedNumber = patient.床號 || '—';

  const temporary = isTemporaryTransfer(patient) && beds.length > 0;
  const rootNumber = temporary ? getRootBedNumber(patient, beds) : '';

  return (
    <span className={`inline-flex flex-col leading-tight ${className}`}>
      <span className={sizeClasses[size].main}>{currentBedNumber}</span>
      {temporary && rootNumber && (
        <span className={`${sizeClasses[size].imprint} text-gray-500`}>
          原{rootNumber}
        </span>
      )}
    </span>
  );
};

export default BedNumberImprint;
