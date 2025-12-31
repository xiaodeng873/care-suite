import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import * as db from '../../lib/database';
import { useAuth } from '../AuthContext';

interface ServiceReasonContextType {
  serviceReasons: db.ServiceReason[];
  refreshServiceReasonData: () => Promise<void>;
}

const ServiceReasonContext = createContext<ServiceReasonContextType | undefined>(undefined);

export const useServiceReason = () => {
  const context = useContext(ServiceReasonContext);
  if (!context) {
    throw new Error('useServiceReason must be used within a ServiceReasonProvider');
  }
  return context;
};

export const useServiceReasonData = () => {
  const { serviceReasons } = useServiceReason();
  return { serviceReasons };
};

interface ServiceReasonProviderProps {
  children: ReactNode;
}

export const ServiceReasonProvider = ({ children }: ServiceReasonProviderProps) => {
  const { user } = useAuth();
  const [serviceReasons, setServiceReasons] = useState<db.ServiceReason[]>([]);

  const refreshServiceReasonData = useCallback(async () => {
    if (!user) return;
    try {
      const data = await db.getReasons();
      setServiceReasons(data);
    } catch (error) {
      console.error('Error refreshing service reasons:', error);
      setServiceReasons([]);
    }
  }, [user]);

  useEffect(() => {
    refreshServiceReasonData();
  }, [refreshServiceReasonData]);

  const value: ServiceReasonContextType = {
    serviceReasons,
    refreshServiceReasonData,
  };

  return (
    <ServiceReasonContext.Provider value={value}>
      {children}
    </ServiceReasonContext.Provider>
  );
};
