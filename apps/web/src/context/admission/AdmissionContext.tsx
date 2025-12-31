import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as db from '../../lib/database';
import { useAuth } from '../AuthContext';

// Types
interface AdmissionContextType {
  // State
  patientAdmissionRecords: db.PatientAdmissionRecord[];
  hospitalEpisodes: any[];
  
  // CRUD operations
  addPatientAdmissionRecord: (record: Omit<db.PatientAdmissionRecord, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePatientAdmissionRecord: (record: db.PatientAdmissionRecord) => Promise<void>;
  deletePatientAdmissionRecord: (id: string) => Promise<void>;
  addHospitalEpisode: (episodeData: any) => Promise<void>;
  updateHospitalEpisode: (episodeData: any) => Promise<void>;
  deleteHospitalEpisode: (id: string) => Promise<void>;
  recordPatientAdmissionEvent: (eventData: {
    patient_id: number;
    event_type: db.AdmissionEventType;
    event_date: string;
    hospital_name?: string;
    hospital_ward?: string;
    hospital_bed_number?: string;
    remarks?: string;
  }) => Promise<void>;
  
  // Refresh
  refreshAdmissionData: () => Promise<void>;
}

interface AdmissionProviderProps {
  children: ReactNode;
}

const AdmissionContext = createContext<AdmissionContextType | undefined>(undefined);

export const AdmissionProvider: React.FC<AdmissionProviderProps> = ({ children }) => {
  const { user } = useAuth();
  
  // State
  const [patientAdmissionRecords, setPatientAdmissionRecords] = useState<db.PatientAdmissionRecord[]>([]);
  const [hospitalEpisodes, setHospitalEpisodes] = useState<any[]>([]);

  // Refresh admission data
  const refreshAdmissionData = useCallback(async () => {
    if (!user) return;
    try {
      const [admissionRecordsData, hospitalEpisodesData] = await Promise.all([
        db.getPatientAdmissionRecords(),
        db.getHospitalEpisodes()
      ]);
      setPatientAdmissionRecords(admissionRecordsData || []);
      setHospitalEpisodes(hospitalEpisodesData);
    } catch (error) {
      console.error('刷新入院數據失敗:', error);
    }
  }, [user]);

  // CRUD operations
  const addPatientAdmissionRecord = async (record: Omit<db.PatientAdmissionRecord, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await db.createPatientAdmissionRecord(record);
      await refreshAdmissionData();
    } catch (error) {
      console.error('Error adding patient admission record:', error);
      throw error;
    }
  };

  const updatePatientAdmissionRecord = async (record: db.PatientAdmissionRecord) => {
    try {
      await db.updatePatientAdmissionRecord(record);
      await refreshAdmissionData();
    } catch (error) {
      console.error('Error updating patient admission record:', error);
      throw error;
    }
  };

  const deletePatientAdmissionRecord = async (id: string) => {
    try {
      await db.deletePatientAdmissionRecord(id);
      await refreshAdmissionData();
    } catch (error) {
      console.error('Error deleting patient admission record:', error);
      throw error;
    }
  };

  const addHospitalEpisode = async (episodeData: any) => {
    try {
      await db.createHospitalEpisode(episodeData);
      await refreshAdmissionData();
    } catch (error) {
      console.error('Error adding hospital episode:', error);
      throw error;
    }
  };

  const updateHospitalEpisode = async (episodeData: any) => {
    try {
      await db.updateHospitalEpisode(episodeData);
      await refreshAdmissionData();
    } catch (error) {
      console.error('Error updating hospital episode:', error);
      throw error;
    }
  };

  const deleteHospitalEpisode = async (id: string) => {
    try {
      await db.deleteHospitalEpisode(id);
      await refreshAdmissionData();
    } catch (error) {
      console.error('Error deleting hospital episode:', error);
      throw error;
    }
  };

  const recordPatientAdmissionEvent = async (eventData: any) => {
    try {
      await db.recordPatientAdmissionEvent(eventData);
      await refreshAdmissionData();
    } catch (error) {
      console.error('Error recording patient admission event:', error);
      throw error;
    }
  };

  useEffect(() => {
    refreshAdmissionData();
  }, [refreshAdmissionData]);

  const value: AdmissionContextType = {
    patientAdmissionRecords,
    hospitalEpisodes,
    addPatientAdmissionRecord,
    updatePatientAdmissionRecord,
    deletePatientAdmissionRecord,
    addHospitalEpisode,
    updateHospitalEpisode,
    deleteHospitalEpisode,
    recordPatientAdmissionEvent,
    refreshAdmissionData,
  };

  return (
    <AdmissionContext.Provider value={value}>
      {children}
    </AdmissionContext.Provider>
  );
};

// Hook to use Admission context
export const useAdmission = (): AdmissionContextType => {
  const context = useContext(AdmissionContext);
  if (context === undefined) {
    throw new Error('useAdmission must be used within an AdmissionProvider');
  }
  return context;
};

// Data-only hook
export const useAdmissionData = () => {
  const { patientAdmissionRecords, hospitalEpisodes } = useAdmission();
  return { patientAdmissionRecords, hospitalEpisodes };
};
