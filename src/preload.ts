import { contextBridge, ipcRenderer } from 'electron';

// Expose protected methods that allow the renderer process to use
// the ipcRenderer without exposing the entire object
contextBridge.exposeInMainWorld(
  'api', {
    // Project operations
    loadProjects: () => {
      ipcRenderer.send('load-projects');
    },
    onProjectsLoaded: (callback: (projects: any[]) => void) => {
      ipcRenderer.on('projects-loaded', (_event, projects) => {
        callback(projects);
      });
    },
    getProject: (projectId: string) => {
      return ipcRenderer.invoke('get-project', projectId);
    },
    createProject: (name: string, workingDirectory: string) => {
      ipcRenderer.send('create-project', { name, workingDirectory });
    },
    onProjectCreated: (callback: (project: any) => void) => {
      ipcRenderer.on('project-created', (_event, project) => callback(project));
    },
  deleteProject: (projectId: string) => {
    ipcRenderer.send('delete-project', projectId);
  },
  onProjectDeleted: (callback: (projectId: string) => void) => {
    ipcRenderer.on('project-deleted', (_event, projectId) => callback(projectId));
  },
  selectFolder: (callback: (selectedPath: string | null) => void) => {
    ipcRenderer.send('select-folder');
    ipcRenderer.once('folder-selected', (_event, path) => callback(path));
  },

    // Source folder operations
    addSourceFolder: (projectId: string, folderPath: string) => {
      ipcRenderer.send('add-source-folder', { projectId, folderPath });
    },
    onSourceFolderAdded: (callback: (data: { projectId: string, folder: any }) => void) => {
      ipcRenderer.on('source-folder-added', (_event, data) => callback(data));
    },
    removeSourceFolder: (projectId: string, folderId: string) => {
      ipcRenderer.send('remove-source-folder', { projectId, folderId });
    },
    onSourceFolderRemoved: (callback: (data: { projectId: string, folderId: string }) => void) => {
      ipcRenderer.on('source-folder-removed', (_event, data) => callback(data));
    },
    openFolder: (folderPath: string) => {
      ipcRenderer.send('open-folder', folderPath);
    },
    scanSourceDirectories: (projectId: string) => {
      ipcRenderer.send('scan-source-directories', projectId);
    },
    onScanProgress: (callback: (progress: { projectId: string, current: number, total: number, message: string }) => void) => {
      ipcRenderer.on('scan-progress', (_event, progress) => callback(progress));
    },
    onScanComplete: (callback: (result: { projectId: string, processedFiles: number, extractedObjects: number }) => void) => {
      ipcRenderer.on('scan-complete', (_event, result) => callback(result));
    },

    // View operations
    createView: (projectId: string, viewName: string) => {
      ipcRenderer.send('create-view', { projectId, viewName });
    },
    onViewCreated: (callback: (view: any) => void) => {
      ipcRenderer.on('view-created', (_event, view) => callback(view));
    },
    deleteView: (projectId: string, viewId: string) => {
      ipcRenderer.send('delete-view', { projectId, viewId });
    },
    onViewDeleted: (callback: (data: { projectId: string, viewId: string }) => void) => {
      ipcRenderer.on('view-deleted', (_event, data) => callback(data));
    },
    getViews: (projectId: string) => {
      ipcRenderer.send('get-views', projectId);
    },
    onViewsLoaded: (callback: (views: any[]) => void) => {
      ipcRenderer.on('views-loaded', (_event, views) => callback(views));
    },

    // Data operations
    scanData: (projectId: string, viewId: string) => {
      ipcRenderer.send('scan-data', { projectId, viewId });
    },
    onDataScanProgress: (callback: (progress: { current: number, total: number, message: string }) => void) => {
      ipcRenderer.on('data-scan-progress', (_event, progress) => callback(progress));
    },
    onDataScanned: (callback: (results: any) => void) => {
      ipcRenderer.on('data-scanned', (_event, results) => callback(results));
    },
    executeQuery: (projectId: string, query: any) => {
      ipcRenderer.send('execute-query', { projectId, query });
    },
    onQueryResults: (callback: (results: any) => void) => {
      ipcRenderer.on('query-results', (_event, results) => callback(results));
    },
    getViewSchema: (projectId: string, viewId: string) => {
      ipcRenderer.send('get-view-schema', { projectId, viewId });
    },
    onViewSchemaLoaded: (callback: (data: { projectId: string, viewId: string, schema: any }) => void) => {
      ipcRenderer.on('view-schema-loaded', (_event, data) => callback(data));
    },
    checkViewData: (projectId: string, viewId: string) => {
      ipcRenderer.send('check-view-data', { projectId, viewId });
    },
    onViewDataStatus: (callback: (data: { projectId: string, viewId: string, hasData: boolean }) => void) => {
      ipcRenderer.on('view-data-status', (_event, data) => callback(data));
    },

    // Error handling
    onError: (callback: (error: { message: string, details?: string }) => void) => {
      ipcRenderer.on('error', (_event, error) => callback(error));
    },

    // Remove event listeners
    removeAllListeners: (channel: string) => {
      ipcRenderer.removeAllListeners(channel);
    }
  }
);
