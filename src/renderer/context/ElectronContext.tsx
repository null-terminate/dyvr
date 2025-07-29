import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { ElectronAPI } from '../types/electronTypes';

// Create a context for the Electron API
const ElectronContext = createContext<ElectronAPI | undefined>(undefined);

interface ElectronProviderProps {
  children: ReactNode;
}

export const ElectronProvider: React.FC<ElectronProviderProps> = ({ children }) => {
  const [api, setApi] = useState<Window['api'] | undefined>(undefined);

  useEffect(() => {
    // Check if window.api is available (it should be in Electron environment)
    if (window.api) {
      setApi(window.api);
    } else {
      console.warn('Electron API not available. Running in browser environment?');
    }
  }, []);

  return (
    <ElectronContext.Provider value={api}>
      {children}
    </ElectronContext.Provider>
  );
};

// Custom hook to use the Electron API
export const useElectron = () => {
  const context = useContext(ElectronContext);
  
  if (context === undefined) {
    throw new Error('useElectron must be used within an ElectronProvider');
  }
  
  return context;
};

// Hook for handling errors from the Electron API
export const useElectronErrors = () => {
  const api = useElectron();
  const [error, setError] = useState<{ message: string; details?: string } | null>(null);

  useEffect(() => {
    if (!api) return;

    const handleError = (err: { message: string; details?: string }) => {
      setError(err);
      console.error('Electron API Error:', err);
    };

    api.onError(handleError);

    return () => {
      api.removeAllListeners('error');
    };
  }, [api]);

  const clearError = () => setError(null);

  return { error, clearError };
};
