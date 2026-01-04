import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as db from '../../lib/database';
import { useAuth } from '../AuthContext';

// Types
interface MealContextType {
  // State
  mealGuidances: db.MealGuidance[];
  
  // CRUD operations
  addMealGuidance: (guidance: Omit<db.MealGuidance, 'id' | 'created_at' | 'updated_at'>) => Promise<void>;
  updateMealGuidance: (guidance: db.MealGuidance) => Promise<void>;
  deleteMealGuidance: (id: string) => Promise<void>;
  
  // Refresh
  refreshMealData: () => Promise<void>;
}

interface MealProviderProps {
  children: ReactNode;
}

const MealContext = createContext<MealContextType | undefined>(undefined);

export const MealProvider: React.FC<MealProviderProps> = ({ children }) => {
  const { isAuthenticated } = useAuth();
  
  // State
  const [mealGuidances, setMealGuidances] = useState<db.MealGuidance[]>([]);

  // Refresh meal data
  const refreshMealData = useCallback(async () => {
    if (!isAuthenticated()) return;
    try {
      const data = await db.getMealGuidances();
      setMealGuidances(data);
    } catch (error) {
      console.error('刷新餐飲指導數據失敗:', error);
    }
  }, [isAuthenticated]);

  // CRUD operations
  const addMealGuidance = async (guidance: Omit<db.MealGuidance, 'id' | 'created_at' | 'updated_at'>) => {
    try {
      await db.createMealGuidance(guidance);
      await refreshMealData();
    } catch (error) {
      console.error('Error adding meal guidance:', error);
      throw error;
    }
  };

  const updateMealGuidance = async (guidance: db.MealGuidance) => {
    try {
      await db.updateMealGuidance(guidance);
      await refreshMealData();
    } catch (error) {
      console.error('Error updating meal guidance:', error);
      throw error;
    }
  };

  const deleteMealGuidance = async (id: string) => {
    try {
      await db.deleteMealGuidance(id);
      await refreshMealData();
    } catch (error) {
      console.error('Error deleting meal guidance:', error);
      throw error;
    }
  };

  useEffect(() => {
    refreshMealData();
  }, [refreshMealData]);

  const value: MealContextType = {
    mealGuidances,
    addMealGuidance,
    updateMealGuidance,
    deleteMealGuidance,
    refreshMealData,
  };

  return (
    <MealContext.Provider value={value}>
      {children}
    </MealContext.Provider>
  );
};

// Hook to use Meal context
export const useMeal = (): MealContextType => {
  const context = useContext(MealContext);
  if (context === undefined) {
    throw new Error('useMeal must be used within a MealProvider');
  }
  return context;
};

// Data-only hook
export const useMealData = () => {
  const { mealGuidances } = useMeal();
  return { mealGuidances };
};
