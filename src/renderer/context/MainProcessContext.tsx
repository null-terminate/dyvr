import React, { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { MainProcessAPI } from '../types/mainProcessTypes';

// Create a context for the Main Process API
const MainProcessContext = createContext<MainProcessAPI | undefined>(undefined);

interface MainProcessProviderProps {
  children: ReactNode;
}

export const MainProcessProvider: React.FC<MainProcessProviderProps> = ({ children }) => {
  const [api, setApi] = useState<Window['api'] | undefined>(undefined);

  useEffect(() => {
    // Check if window.api is available (it should be in Electron environment)
    if (window.api) {
      setApi(window.api);
    } else {
      console.warn('Main Process API not available. Running in browser environment?');
    }
  }, []);

  return (
    <MainProcessContext.Provider value={api}>
      {children}
    </MainProcessContext.Provider>
  );
};


// Custom hook to use the Main Process API
export const useMainProcess = () => {
  const context = useContext(MainProcessContext);
  if (context === undefined) {
    // Return undefined instead of mock API
    return undefined;
  }
  return context;
};

// Hook for handling errors from the Main Process API
export const useMainProcessErrors = () => {
  const api = useMainProcess();
  const [error, setError] = useState<{ message: string; details?: string } | null>(null);

  useEffect(() => {
    if (!api) return;

    const handleError = (err: { message: string; details?: string }) => {
      setError(err);
    };

    api.onError(handleError);

    return () => {
      api.removeAllListeners('error');
    };
  }, [api]);

  const clearError = () => setError(null);

  return { error, clearError };
};
