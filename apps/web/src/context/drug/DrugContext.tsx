import { createContext, useContext, useState, useCallback, ReactNode } from 'react';
import * as db from '../../lib/database';

interface DrugContextType {
  drugDatabase: any[];
  addDrug: (drug: Omit<any, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateDrug: (drug: any) => Promise<void>;
  deleteDrug: (id: string) => Promise<void>;
  refreshDrugData: () => Promise<void>;
}

const DrugContext = createContext<DrugContextType | undefined>(undefined);

export const useDrug = () => {
  const context = useContext(DrugContext);
  if (!context) {
    throw new Error('useDrug must be used within a DrugProvider');
  }
  return context;
};

export const useDrugData = () => {
  const { drugDatabase } = useDrug();
  return { drugDatabase };
};

interface DrugProviderProps {
  children: ReactNode;
}

export const DrugProvider = ({ children }: DrugProviderProps) => {
  const [drugDatabase, setDrugDatabase] = useState<any[]>([]);

  const refreshDrugData = useCallback(async () => {
    try {
      const data = await db.getDrugDatabase();
      setDrugDatabase(data);
    } catch (error) {
      console.error('Error refreshing drug database:', error);
      setDrugDatabase([]);
    }
  }, []);

  const addDrug = async (drug: Omit<any, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await db.createDrug(drug);
      await refreshDrugData();
    } catch (error) {
      console.error('Error adding drug:', error);
      throw error;
    }
  };

  const updateDrug = async (drug: any) => {
    try {
      await db.updateDrug(drug);
      await refreshDrugData();
    } catch (error) {
      console.error('Error updating drug:', error);
      throw error;
    }
  };

  const deleteDrug = async (id: string) => {
    try {
      await db.deleteDrug(id);
      await refreshDrugData();
    } catch (error) {
      console.error('Error deleting drug:', error);
      throw error;
    }
  };

  const value: DrugContextType = {
    drugDatabase,
    addDrug,
    updateDrug,
    deleteDrug,
    refreshDrugData,
  };

  return (
    <DrugContext.Provider value={value}>
      {children}
    </DrugContext.Provider>
  );
};
