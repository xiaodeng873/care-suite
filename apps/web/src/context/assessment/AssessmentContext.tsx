import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as db from '../../lib/database';
import { useAuth } from '../AuthContext';

// Types
interface AssessmentContextType {
  // State
  healthAssessments: db.HealthAssessment[];
  patientRestraintAssessments: db.PatientRestraintAssessment[];
  annualHealthCheckups: any[];
  
  // Health Assessment CRUD
  addHealthAssessment: (assessment: Omit<db.HealthAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>) => Promise<void>;
  updateHealthAssessment: (assessment: db.HealthAssessment) => Promise<void>;
  deleteHealthAssessment: (id: string) => Promise<void>;
  
  // Patient Restraint Assessment CRUD
  addPatientRestraintAssessment: (assessment: Omit<db.PatientRestraintAssessment, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updatePatientRestraintAssessment: (assessment: db.PatientRestraintAssessment) => Promise<void>;
  deletePatientRestraintAssessment: (id: string) => Promise<void>;
  
  // Annual Health Checkup CRUD
  addAnnualHealthCheckup: (checkup: any) => Promise<void>;
  updateAnnualHealthCheckup: (checkup: any) => Promise<void>;
  deleteAnnualHealthCheckup: (id: string) => Promise<void>;
  
  // Refresh
  refreshAssessmentData: () => Promise<void>;
}

interface AssessmentProviderProps {
  children: ReactNode;
}

const AssessmentContext = createContext<AssessmentContextType | undefined>(undefined);

export const AssessmentProvider: React.FC<AssessmentProviderProps> = ({ children }) => {
  const { authReady, isAuthenticated } = useAuth();
  
  // State
  const [healthAssessments, setHealthAssessments] = useState<db.HealthAssessment[]>([]);
  const [patientRestraintAssessments, setPatientRestraintAssessments] = useState<db.PatientRestraintAssessment[]>([]);
  const [annualHealthCheckups, setAnnualHealthCheckups] = useState<any[]>([]);

  // Refresh assessment data
  const refreshAssessmentData = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const [
        healthAssessmentsData,
        patientRestraintAssessmentsData,
        annualHealthCheckupsData
      ] = await Promise.all([
        db.getHealthAssessments(),
        db.getRestraintAssessments(),
        db.getAnnualHealthCheckups()
      ]);
      
      setHealthAssessments(healthAssessmentsData);
      setPatientRestraintAssessments(patientRestraintAssessmentsData);
      setAnnualHealthCheckups(annualHealthCheckupsData || []);
    } catch (error) {
      console.error('刷新評估數據失敗:', error);
    }
  }, [isAuthenticated]);

  // Health Assessment CRUD
  const addHealthAssessment = async (assessment: Omit<db.HealthAssessment, 'id' | 'created_at' | 'updated_at' | 'status' | 'archived_at'>) => {
    try {
      await db.createHealthAssessment(assessment);
      await refreshAssessmentData();
    } catch (error) {
      console.error('Error adding health assessment:', error);
      throw error;
    }
  };

  const updateHealthAssessment = async (assessment: db.HealthAssessment) => {
    try {
      await db.updateHealthAssessment(assessment);
      await refreshAssessmentData();
    } catch (error) {
      console.error('Error updating health assessment:', error);
      throw error;
    }
  };

  const deleteHealthAssessment = async (id: string) => {
    try {
      await db.deleteHealthAssessment(id);
      await refreshAssessmentData();
    } catch (error) {
      console.error('Error deleting health assessment:', error);
      throw error;
    }
  };

  // Patient Restraint Assessment CRUD
  const addPatientRestraintAssessment = async (assessment: Omit<db.PatientRestraintAssessment, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await db.createRestraintAssessment(assessment);
      await refreshAssessmentData();
    } catch (error) {
      console.error('Error adding patient restraint assessment:', error);
      throw error;
    }
  };

  const updatePatientRestraintAssessment = async (assessment: db.PatientRestraintAssessment) => {
    try {
      await db.updateRestraintAssessment(assessment);
      await refreshAssessmentData();
    } catch (error) {
      console.error('Error updating patient restraint assessment:', error);
      throw error;
    }
  };

  const deletePatientRestraintAssessment = async (id: string) => {
    try {
      await db.deleteRestraintAssessment(id);
      await refreshAssessmentData();
    } catch (error) {
      console.error('Error deleting patient restraint assessment:', error);
      throw error;
    }
  };

  // Annual Health Checkup CRUD
  const addAnnualHealthCheckup = async (checkup: any) => {
    try {
      await db.createAnnualHealthCheckup(checkup);
      await refreshAssessmentData();
    } catch (error) {
      console.error('Error adding annual health checkup:', error);
      throw error;
    }
  };

  const updateAnnualHealthCheckup = async (checkup: any) => {
    try {
      console.log('Context更新checkup數據:', {
        has_serious_illness: checkup.has_serious_illness,
        has_allergy: checkup.has_allergy,
        has_infectious_disease: checkup.has_infectious_disease,
        needs_followup_treatment: checkup.needs_followup_treatment,
        has_swallowing_difficulty: checkup.has_swallowing_difficulty,
        has_special_diet: checkup.has_special_diet
      });
      await db.updateAnnualHealthCheckup(checkup);
      await refreshAssessmentData();
    } catch (error) {
      console.error('Error updating annual health checkup:', error);
      throw error;
    }
  };

  const deleteAnnualHealthCheckup = async (id: string) => {
    try {
      await db.deleteAnnualHealthCheckup(id);
      await refreshAssessmentData();
    } catch (error) {
      console.error('Error deleting annual health checkup:', error);
      throw error;
    }
  };

  useEffect(() => {
    refreshAssessmentData();
  }, [refreshAssessmentData]);

  const value: AssessmentContextType = {
    // State
    healthAssessments,
    patientRestraintAssessments,
    annualHealthCheckups,
    // Health Assessment CRUD
    addHealthAssessment,
    updateHealthAssessment,
    deleteHealthAssessment,
    // Patient Restraint Assessment CRUD
    addPatientRestraintAssessment,
    updatePatientRestraintAssessment,
    deletePatientRestraintAssessment,
    // Annual Health Checkup CRUD
    addAnnualHealthCheckup,
    updateAnnualHealthCheckup,
    deleteAnnualHealthCheckup,
    // Refresh
    refreshAssessmentData,
  };

  return (
    <AssessmentContext.Provider value={value}>
      {children}
    </AssessmentContext.Provider>
  );
};

// Hook to use Assessment context
export const useAssessment = (): AssessmentContextType => {
  const context = useContext(AssessmentContext);
  if (context === undefined) {
    throw new Error('useAssessment must be used within an AssessmentProvider');
  }
  return context;
};

// Data-only hook (for components that only need read access)
export const useAssessmentData = () => {
  const { 
    healthAssessments, 
    patientRestraintAssessments, 
    annualHealthCheckups 
  } = useAssessment();
  return { healthAssessments, patientRestraintAssessments, annualHealthCheckups };
};
