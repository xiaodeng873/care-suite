import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as db from '../../lib/database';
import { useAuth } from '../AuthContext';

// Types
interface IncidentContextType {
  // State
  incidentReports: db.IncidentReport[];
  
  // CRUD operations
  addIncidentReport: (report: Omit<db.IncidentReport, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateIncidentReport: (report: db.IncidentReport) => Promise<void>;
  deleteIncidentReport: (id: string) => Promise<void>;
  
  // Refresh
  refreshIncidentData: () => Promise<void>;
}

interface IncidentProviderProps {
  children: ReactNode;
}

const IncidentContext = createContext<IncidentContextType | undefined>(undefined);

export const IncidentProvider: React.FC<IncidentProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  // State
  const [incidentReports, setIncidentReports] = useState<db.IncidentReport[]>([]);

  // Refresh incident data
  const refreshIncidentData = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const data = await db.getIncidentReports();
      setIncidentReports(data || []);
    } catch (error) {
      console.error('刷新事故報告數據失敗:', error);
    }
  }, [isAuthenticated]);

  // CRUD operations
  const addIncidentReport = async (report: Omit<db.IncidentReport, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await db.createIncidentReport(report);
      await refreshIncidentData();
    } catch (error) {
      console.error('Error adding incident report:', error);
      throw error;
    }
  };

  const updateIncidentReport = async (report: db.IncidentReport) => {
    try {
      await db.updateIncidentReport(report);
      await refreshIncidentData();
    } catch (error) {
      console.error('Error updating incident report:', error);
      throw error;
    }
  };

  const deleteIncidentReport = async (id: string) => {
    try {
      await db.deleteIncidentReport(id);
      await refreshIncidentData();
    } catch (error) {
      console.error('Error deleting incident report:', error);
      throw error;
    }
  };

  useEffect(() => {
    refreshIncidentData();
  }, [refreshIncidentData]);

  const value: IncidentContextType = {
    incidentReports,
    addIncidentReport,
    updateIncidentReport,
    deleteIncidentReport,
    refreshIncidentData,
  };

  return (
    <IncidentContext.Provider value={value}>
      {children}
    </IncidentContext.Provider>
  );
};

// Hook to use Incident context
export const useIncident = (): IncidentContextType => {
  const context = useContext(IncidentContext);
  if (context === undefined) {
    throw new Error('useIncident must be used within an IncidentProvider');
  }
  return context;
};

// Data-only hook
export const useIncidentData = () => {
  const { incidentReports } = useIncident();
  return { incidentReports };
};
