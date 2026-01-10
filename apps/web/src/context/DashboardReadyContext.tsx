import React, { createContext, useContext, useState, useCallback } from 'react';

interface DashboardReadyContextType {
  isDashboardReady: boolean;
  setDashboardReady: (ready: boolean) => void;
  resetDashboardReady: () => void;
}

const DashboardReadyContext = createContext<DashboardReadyContextType | undefined>(undefined);

export const DashboardReadyProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [isDashboardReady, setIsDashboardReady] = useState(false);

  const setDashboardReady = useCallback((ready: boolean) => {
    setIsDashboardReady(ready);
  }, []);

  const resetDashboardReady = useCallback(() => {
    setIsDashboardReady(false);
  }, []);

  return (
    <DashboardReadyContext.Provider value={{ isDashboardReady, setDashboardReady, resetDashboardReady }}>
      {children}
    </DashboardReadyContext.Provider>
  );
};

export const useDashboardReady = () => {
  const context = useContext(DashboardReadyContext);
  if (context === undefined) {
    throw new Error('useDashboardReady must be used within a DashboardReadyProvider');
  }
  return context;
};
