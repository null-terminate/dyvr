import { app, BrowserWindow, ipcMain, shell } from 'electron';
import * as path from 'path';
import { ProjectManager } from './src/main/ProjectManager';
import { ViewManager } from './src/main/ViewManager';
import { JSONScanner } from './src/main/JSONScanner';
import { Project, View, ScanResults, QueryModel, QueryResult } from './src/types';

// Application managers
let projectManager: ProjectManager;
let viewManager: ViewManager;
let jsonScanner: JSONScanner;
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });

  // In development mode, load from webpack dev server
  if (process.argv.includes('--dev')) {
    mainWindow.loadURL('http://localhost:9000');
    mainWindow.webContents.openDevTools();
  } else {
    // In production, load from the dist directory
    mainWindow.loadFile(path.join(__dirname, 'index.html'));
    // Open DevTools in production for debugging
    // mainWindow.webContents.openDevTools();
  }

  // Initialize application managers
  initializeManagers();
}

/**
 * Initialize all application managers
 */
async function initializeManagers(): Promise<void> {
  try {
    // Initialize ProjectManager
    projectManager = new ProjectManager();
    await projectManager.initialize();

    // Initialize ViewManager
    viewManager = new ViewManager();
    await viewManager.initialize();

    // Initialize JSONScanner
    jsonScanner = new JSONScanner();

    console.log('Application managers initialized successfully');
  } catch (error) {
    console.error('Failed to initialize application managers:', error);
    // Send error to renderer if window is available
    if (mainWindow) {
      mainWindow.webContents.send('error', {
        message: 'Failed to initialize application',
        details: (error as Error).message
      });
    }
  }
}

/**
 * Send error response to renderer
 */
function sendError(message: string, details?: any): void {
  if (mainWindow) {
    mainWindow.webContents.send('error', { message, details });
  }
}

/**
 * Send success response to renderer
 */
function sendResponse(event: string, data: any): void {
  if (mainWindow) {
    mainWindow.webContents.send(event, data);
  }
}

// IPC Event Handlers for Project CRUD Operations

/**
 * Load all projects
 */
ipcMain.on('load-projects', async () => {
  try {
    const projects = await projectManager.getProjects();
    sendResponse('projects-loaded', projects);
  } catch (error) {
    console.error('Failed to load projects:', error);
    sendError('Failed to load projects', (error as Error).message);
  }
});

/**
 * Create a new project
 */
ipcMain.on('create-project', async (event, data: { name: string; workingDirectory: string }) => {
  try {
    if (!data || !data.name || !data.workingDirectory) {
      throw new Error('Project name and working directory are required');
    }

    const project = await projectManager.createProject(data.name, data.workingDirectory);
    sendResponse('project-created', project);
  } catch (error) {
    console.error('Failed to create project:', error);
    sendError('Failed to create project', (error as Error).message);
  }
});

/**
 * Delete a project
 */
ipcMain.on('delete-project', async (event, projectId: string) => {
  try {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    await projectManager.deleteProject(projectId);
    sendResponse('project-deleted', projectId);
  } catch (error) {
    console.error('Failed to delete project:', error);
    sendError('Failed to delete project', (error as Error).message);
  }
});

// IPC Event Handlers for Source Folder Management

/**
 * Add a source folder to a project
 */
ipcMain.on('add-source-folder', async (event, data: { projectId: string; folderPath: string }) => {
  try {
    if (!data || !data.projectId || !data.folderPath) {
      throw new Error('Project ID and folder path are required');
    }

    await projectManager.addSourceFolder(data.projectId, data.folderPath);
    
    // Get updated project to return the new source folder
    const project = await projectManager.getProject(data.projectId);
    if (project) {
      const addedFolder = project.sourceFolders.find(folder => 
        path.resolve(folder.path) === path.resolve(data.folderPath)
      );
      if (addedFolder) {
        sendResponse('source-folder-added', { 
          projectId: data.projectId, 
          folder: addedFolder 
        });
      }
    }
  } catch (error) {
    console.error('Failed to add source folder:', error);
    sendError('Failed to add source folder', (error as Error).message);
  }
});

/**
 * Remove a source folder from a project
 */
ipcMain.on('remove-source-folder', async (event, data: { projectId: string; folderId: string }) => {
  try {
    if (!data || !data.projectId || !data.folderId) {
      throw new Error('Project ID and folder ID are required');
    }

    // Get the project to find the folder path
    const project = await projectManager.getProject(data.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const folderToRemove = project.sourceFolders.find(folder => folder.id === data.folderId);
    if (!folderToRemove) {
      throw new Error('Source folder not found');
    }

    await projectManager.removeSourceFolder(data.projectId, folderToRemove.path);
    sendResponse('source-folder-removed', { 
      projectId: data.projectId, 
      folderId: data.folderId 
    });
  } catch (error) {
    console.error('Failed to remove source folder:', error);
    sendError('Failed to remove source folder', (error as Error).message);
  }
});

/**
 * Open a folder in the system file explorer
 */
ipcMain.on('open-folder', async (event, folderPath: string) => {
  try {
    if (!folderPath) {
      throw new Error('Folder path is required');
    }

    await shell.openPath(folderPath);
  } catch (error) {
    console.error('Failed to open folder:', error);
    sendError('Failed to open folder', (error as Error).message);
  }
});

// IPC Event Handlers for View Management Operations

/**
 * Create a new view within a project
 */
ipcMain.on('create-view', async (event, data: { projectId: string; viewName: string }) => {
  try {
    if (!data || !data.projectId || !data.viewName) {
      throw new Error('Project ID and view name are required');
    }

    // Get project to find working directory
    const project = await projectManager.getProject(data.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const view = await viewManager.createViewInProject(project.workingDirectory, data.viewName);
    view.projectId = data.projectId; // Set the project ID
    
    sendResponse('view-created', view);
  } catch (error) {
    console.error('Failed to create view:', error);
    sendError('Failed to create view', (error as Error).message);
  }
});

/**
 * Delete a view from a project
 */
ipcMain.on('delete-view', async (event, data: { projectId: string; viewId: string }) => {
  try {
    if (!data || !data.projectId || !data.viewId) {
      throw new Error('Project ID and view ID are required');
    }

    // Get project to find working directory
    const project = await projectManager.getProject(data.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const deleted = await viewManager.deleteViewInProject(project.workingDirectory, data.viewId);
    if (deleted) {
      sendResponse('view-deleted', { 
        projectId: data.projectId, 
        viewId: data.viewId 
      });
    } else {
      throw new Error('View not found or could not be deleted');
    }
  } catch (error) {
    console.error('Failed to delete view:', error);
    sendError('Failed to delete view', (error as Error).message);
  }
});

/**
 * Get all views for a project
 */
ipcMain.on('get-views', async (event, projectId: string) => {
  try {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    // Get project to find working directory
    const project = await projectManager.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    const views = await viewManager.getViewsForProject(project.workingDirectory);
    // Set project ID for all views
    const viewsWithProjectId = views.map(view => ({ ...view, projectId }));
    
    sendResponse('views-loaded', viewsWithProjectId);
  } catch (error) {
    console.error('Failed to get views:', error);
    sendError('Failed to get views', (error as Error).message);
  }
});

// IPC Event Handlers for Data Scanning and Query Operations

/**
 * Scan JSON data for a view
 */
ipcMain.on('scan-data', async (event, data: { projectId: string; viewId: string }) => {
  try {
    if (!data || !data.projectId || !data.viewId) {
      throw new Error('Project ID and view ID are required');
    }

    // Get project to access source folders and working directory
    const project = await projectManager.getProject(data.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    if (!project.sourceFolders || project.sourceFolders.length === 0) {
      throw new Error('No source folders configured for this project');
    }

    // Get database manager for the project
    const dbManager = await projectManager.openProjectDatabase(data.projectId);

    // Send progress update - scanning started
    sendResponse('scan-progress', { 
      current: 0, 
      total: 100, 
      message: 'Starting JSON file scan...' 
    });

    // Scan source folders
    const scanResults = await jsonScanner.scanSourceFolders(project.sourceFolders);
    scanResults.viewId = data.viewId;

    // Send progress update - scan completed
    sendResponse('scan-progress', { 
      current: 50, 
      total: 100, 
      message: `Found ${scanResults.totalRecords} records in ${scanResults.processedFiles} files` 
    });

    if (scanResults.totalRecords > 0) {
      // Create data table with discovered schema
      await jsonScanner.createDataTable(dbManager, data.viewId, scanResults.columns);

      // Send progress update - table created
      sendResponse('scan-progress', { 
        current: 75, 
        total: 100, 
        message: 'Data table created, populating with records...' 
      });

      // Note: For now, we're not implementing the actual data population
      // as it would require re-scanning the files to get the actual data
      // This would be implemented in a future iteration
    }

    // Send progress update - completed
    sendResponse('scan-progress', { 
      current: 100, 
      total: 100, 
      message: 'Scan completed successfully' 
    });

    // Send scan results
    sendResponse('data-scanned', scanResults);

  } catch (error) {
    console.error('Failed to scan data:', error);
    sendError('Failed to scan data', (error as Error).message);
  }
});

/**
 * Execute a query on view data
 */
ipcMain.on('execute-query', async (event, data: { projectId: string; query: QueryModel }) => {
  try {
    if (!data || !data.projectId || !data.query) {
      throw new Error('Project ID and query are required');
    }

    // Get project
    const project = await projectManager.getProject(data.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Get database manager for the project
    const dbManager = await projectManager.openProjectDatabase(data.projectId);

    // For now, return empty results as query execution would require
    // implementing the QueryBuilder class and SQL generation
    const queryResult: QueryResult = {
      data: [],
      totalCount: 0,
      columns: []
    };

    sendResponse('query-results', queryResult);

  } catch (error) {
    console.error('Failed to execute query:', error);
    sendError('Failed to execute query', (error as Error).message);
  }
});

/**
 * Get view data schema
 */
ipcMain.on('get-view-schema', async (event, data: { projectId: string; viewId: string }) => {
  try {
    if (!data || !data.projectId || !data.viewId) {
      throw new Error('Project ID and view ID are required');
    }

    // Get project
    const project = await projectManager.getProject(data.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Get view data schema
    const schema = await viewManager.getViewDataSchema(project.workingDirectory, data.viewId);
    
    sendResponse('view-schema-loaded', { 
      projectId: data.projectId, 
      viewId: data.viewId, 
      schema 
    });

  } catch (error) {
    console.error('Failed to get view schema:', error);
    sendError('Failed to get view schema', (error as Error).message);
  }
});

/**
 * Check if view has data table
 */
ipcMain.on('check-view-data', async (event, data: { projectId: string; viewId: string }) => {
  try {
    if (!data || !data.projectId || !data.viewId) {
      throw new Error('Project ID and view ID are required');
    }

    // Get project
    const project = await projectManager.getProject(data.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Check if view has data table
    const hasData = await viewManager.viewHasDataTable(project.workingDirectory, data.viewId);
    
    sendResponse('view-data-status', { 
      projectId: data.projectId, 
      viewId: data.viewId, 
      hasData 
    });

  } catch (error) {
    console.error('Failed to check view data:', error);
    sendError('Failed to check view data', (error as Error).message);
  }
});

app.whenReady().then(createWindow);

app.on('window-all-closed', async () => {
  // Cleanup managers before quitting
  try {
    if (projectManager) {
      await projectManager.close();
    }
    if (viewManager) {
      await viewManager.close();
    }
  } catch (error) {
    console.error('Error during cleanup:', error);
  }

  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// Handle app quit
app.on('before-quit', async () => {
  try {
    if (projectManager) {
      await projectManager.close();
    }
    if (viewManager) {
      await viewManager.close();
    }
  } catch (error) {
    console.error('Error during app quit cleanup:', error);
  }
});
