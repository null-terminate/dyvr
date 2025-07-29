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

// Mock API for browser environment
const createMockAPI = (): ElectronAPI => {
  return {
    // Project operations
    loadProjects: () => {
      console.log('Mock: loadProjects called');
    },
    onProjectsLoaded: (callback) => {
      console.log('Mock: onProjectsLoaded registered');
      // Simulate loading projects after a delay
      setTimeout(() => {
        callback([
          { 
            id: '1', 
            name: 'Project Alpha', 
            path: '/Users/user/Documents/Projects/Alpha',
            workingDirectory: '/Users/user/Documents/Projects/Alpha',
            sourceFolders: [],
            created: new Date(2025, 5, 10),
            lastOpened: new Date(2025, 6, 25)
          },
          { 
            id: '2', 
            name: 'Project Beta', 
            path: '/Users/user/Documents/Projects/Beta',
            workingDirectory: '/Users/user/Documents/Projects/Beta',
            sourceFolders: [],
            created: new Date(2025, 4, 15),
            lastOpened: new Date(2025, 6, 20)
          }
        ]);
      }, 500);
    },
    createProject: () => {
      console.log('Mock: createProject called');
    },
    onProjectCreated: () => {
      console.log('Mock: onProjectCreated registered');
    },
    deleteProject: () => {
      console.log('Mock: deleteProject called');
    },
    onProjectDeleted: () => {
      console.log('Mock: onProjectDeleted registered');
    },

    // Source folder operations
    addSourceFolder: () => {
      console.log('Mock: addSourceFolder called');
    },
    onSourceFolderAdded: () => {
      console.log('Mock: onSourceFolderAdded registered');
    },
    removeSourceFolder: () => {
      console.log('Mock: removeSourceFolder called');
    },
    onSourceFolderRemoved: () => {
      console.log('Mock: onSourceFolderRemoved registered');
    },
    openFolder: () => {
      console.log('Mock: openFolder called');
    },

    // View operations
    createView: () => {
      console.log('Mock: createView called');
    },
    onViewCreated: () => {
      console.log('Mock: onViewCreated registered');
    },
    deleteView: () => {
      console.log('Mock: deleteView called');
    },
    onViewDeleted: () => {
      console.log('Mock: onViewDeleted registered');
    },
    getViews: () => {
      console.log('Mock: getViews called');
    },
    onViewsLoaded: () => {
      console.log('Mock: onViewsLoaded registered');
    },

    // Data operations
    scanData: () => {
      console.log('Mock: scanData called');
    },
    onScanProgress: () => {
      console.log('Mock: onScanProgress registered');
    },
    onDataScanned: () => {
      console.log('Mock: onDataScanned registered');
    },
    executeQuery: () => {
      console.log('Mock: executeQuery called');
    },
    onQueryResults: () => {
      console.log('Mock: onQueryResults registered');
    },
    getViewSchema: () => {
      console.log('Mock: getViewSchema called');
    },
    onViewSchemaLoaded: () => {
      console.log('Mock: onViewSchemaLoaded registered');
    },
    checkViewData: () => {
      console.log('Mock: checkViewData called');
    },
    onViewDataStatus: () => {
      console.log('Mock: onViewDataStatus registered');
    },

    // Error handling
    onError: () => {
      console.log('Mock: onError registered');
    },

    // Remove event listeners
    removeAllListeners: () => {
      console.log('Mock: removeAllListeners called');
    }
  };
};

// Custom hook to use the Electron API
export const useElectron = () => {
  const context = useContext(ElectronContext);
  
  if (context === undefined) {
    console.warn('Electron API not available. Using mock API instead.');
    return createMockAPI();
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
