import { app, BrowserWindow, ipcMain, shell, nativeImage, dialog } from 'electron';
import * as path from 'path';
import * as fs from 'fs';
import { ProjectManager } from './src/main/ProjectManager';
import { ViewManager } from './src/main/ViewManager';
import { JSONScanner } from './src/main/JSONScanner';
import { ConfigManager } from './src/main/ConfigManager';
import { Project, View, ScanResults, QueryModel, QueryResult, PROJECT_FOLDER, CONFIG_FILENAME } from './src/types';

// Enable remote debugging for the main process
app.commandLine.appendSwitch('remote-debugging-port', '9222');

// Application managers
let projectManager: ProjectManager;
let viewManager: ViewManager;
let jsonScanner: JSONScanner;
let configManager: ConfigManager;
let mainWindow: BrowserWindow | null = null;

function createWindow(): void {
  console.log('Creating main window...');
  
  // Determine the correct path to the icon
  const iconPath = path.resolve(__dirname, 'src/assets/Scuba.png');
  console.log('Icon path:', iconPath);
  
  // Create a native image from the icon path
  const icon = nativeImage.createFromPath(iconPath);
  if (!icon.isEmpty()) {
    if (process.platform === 'darwin') {
      app.dock.setIcon(icon);
    }
  }
  
  mainWindow = new BrowserWindow({
    width: 1200,
    height: 800,
    icon: iconPath,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'src', 'preload.js')
    }
  });

  console.log('Setting up window load event listeners...');
  
  // Listen for window ready-to-show event
  mainWindow.once('ready-to-show', () => {
    console.log('Main window is ready to show');
  });
  
  // Listen for did-finish-load event
  mainWindow.webContents.on('did-finish-load', () => {
    console.log('Main window finished loading content');
  });
  
  // Listen for dom-ready event
  mainWindow.webContents.on('dom-ready', () => {
    console.log('DOM is ready in the main window');
  });

  // Always load from the dist directory for now
  console.log('Loading from dist directory...');
  mainWindow.loadFile(path.join(__dirname, 'index.html'));
  // mainWindow.webContents.openDevTools();

  // Initialize application managers
  initializeManagers();
  
  // Log that IPC handlers are set up
  console.log('IPC handlers are set up and ready to receive events from renderer');
}

/**
 * Initialize all application managers
 */
async function initializeManagers(): Promise<void> {
  try {
    // Initialize ConfigManager first
    configManager = new ConfigManager();
    await configManager.initialize();
    
    // Initialize ProjectManager
    projectManager = new ProjectManager();
    await projectManager.initialize();

    // Initialize ViewManager
    viewManager = new ViewManager();
    await viewManager.initialize();

    // Initialize JSONScanner
    jsonScanner = new JSONScanner();

    // Load projects from config file
    await loadProjectsFromDigrConfig();

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
   * Initialize project databases for projects in config file
   */
async function loadProjectsFromDigrConfig(): Promise<void> {
  try {
    // Projects are now loaded directly from digr.config via DataPersistence
    // We just need to ensure project databases are initialized
    const projects = await projectManager.getProjects();
    console.log(`Loaded ${projects.length} projects from ${CONFIG_FILENAME}`);
    
    // Initialize project databases
    for (const project of projects) {
      try {
        const projectPath = project.workingDirectory;
        
        // Ensure the directory exists
        if (!fs.existsSync(projectPath)) {
          fs.mkdirSync(projectPath, { recursive: true });
        }
        
        // Ensure project folder exists
        await projectManager.ensureProjectDigrFolder(projectPath);
        
        console.log(`Initialized project database for: ${project.name} at ${projectPath}`);
      } catch (error) {
        console.warn(`Failed to initialize project database: ${(error as Error).message}`);
      }
    }
  } catch (error) {
    console.error(`Failed to load projects from ${CONFIG_FILENAME}:`, error);
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
    console.log(`Sending response to renderer: ${event}`, JSON.stringify(data).substring(0, 200) + (JSON.stringify(data).length > 200 ? '...' : ''));
    mainWindow.webContents.send(event, data);
  } else {
    console.warn(`Cannot send response: mainWindow is null. Event: ${event}`);
  }
}

// IPC Event Handlers for Project CRUD Operations

/**
 * Load all projects
 */
ipcMain.on('load-projects', async () => {
  try {
    console.log('Received load-projects request from renderer');
    const projects = await projectManager.getProjects();
    console.log('Sending projects to renderer:', JSON.stringify(projects));
    
    // Add more detailed logging
    console.log(`Number of projects being sent: ${projects.length}`);
    projects.forEach((project, index) => {
      console.log(`Project ${index + 1}: ID=${project.id}, Name=${project.name}, Path=${project.workingDirectory}`);
    });
    
    // Check if mainWindow exists
    if (!mainWindow) {
      console.error('Cannot send projects: mainWindow is null');
    } else {
      console.log('mainWindow exists, sending projects-loaded event');
    }
    
    sendResponse('projects-loaded', projects);
  } catch (error) {
    console.error('Failed to load projects:', error);
    sendError('Failed to load projects', (error as Error).message);
  }
});

/**
 * Get a single project by ID
 */
ipcMain.handle('get-project', async (event, projectId: string) => {
  try {
    console.log(`Received get-project request for ID: ${projectId}`);
    if (!projectId) {
      throw new Error('Project ID is required');
    }
    
    const project = await projectManager.getProject(projectId);
    if (!project) {
      throw new Error(`Project with ID "${projectId}" not found`);
    }
    
    console.log(`Returning project: ID=${project.id}, Name=${project.name}, Path=${project.workingDirectory}`);
    return project;
  } catch (error) {
    console.error(`Failed to get project ${projectId}:`, error);
    throw error;
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

    console.log(`Main process: Creating project with name "${data.name}" in directory "${data.workingDirectory}"`);
    const project = await projectManager.createProject(data.name, data.workingDirectory);
    console.log(`Main process: Project created successfully with ID "${project.id}" at path "${project.workingDirectory}"`);
    
    // Also add to config file - use the project's actual working directory (which includes the project name subfolder)
    console.log(`Main process: Adding project to ${CONFIG_FILENAME} with path "${project.workingDirectory}"`);
    await configManager.addProject(project.workingDirectory);
    console.log(`Main process: Project added to ${CONFIG_FILENAME} successfully`);
    
    // Make sure the project is properly added to the registry before sending the event
    const updatedProject = await projectManager.getProject(project.id);
    console.log(`Main process: Sending project-created event with project:`, JSON.stringify(updatedProject));
    
    sendResponse('project-created', updatedProject || project);
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

    // Get project before deleting to get the name
    const project = await projectManager.getProject(projectId);
    if (!project) {
      throw new Error(`Project with ID "${projectId}" not found`);
    }

    await projectManager.deleteProject(projectId);
    
    // Also remove from config file
    await configManager.removeProject(project.workingDirectory);
    
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

/**
 * Scan source directories for JSON and JSONL files and extract data
 * This is an asynchronous operation that runs in the background
 * and sends progress updates to the renderer process
 */
ipcMain.on('scan-source-directories', async (event, projectId: string) => {
  try {
    if (!projectId) {
      throw new Error('Project ID is required');
    }

    // Get project to access source folders
    const project = await projectManager.getProject(projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    if (!project.sourceFolders || project.sourceFolders.length === 0) {
      throw new Error('No source folders configured for this project');
    }

    // Get database manager for the project
    const dbManager = await projectManager.openProjectDatabase(projectId);

    // Update project with initial scan status
    await projectManager.updateProjectInRegistry(projectId, {
      scanStatus: {
        isScanning: true,
        progress: {
          current: 0,
          total: 100,
          message: 'Starting JSON/JSONL file scan...'
        }
      }
    });

    // Send initial progress update
    sendResponse('scan-progress', { 
      projectId,
      current: 0, 
      total: 100, 
      message: 'Starting JSON/JSONL file scan...' 
    });

    // Send scan started event
    sendResponse('scan-started', { 
      projectId,
      message: 'Scan started in background. Progress will be reported in the Files tab.' 
    });

    // Create a set to track processed columns
    const processedColumns = new Set<string>();
    
    // Drop the existing data table if it exists and create a new one
    const tableName = 'data'; // For project-wide scanning, use the 'data' table
    await dbManager.executeNonQuery(`DROP TABLE IF EXISTS ${tableName}`);
    await dbManager.executeNonQuery(`
      CREATE TABLE IF NOT EXISTS ${tableName} (
        id INTEGER PRIMARY KEY AUTOINCREMENT,
        _source_file TEXT,
        _scan_date TIMESTAMP DEFAULT CURRENT_TIMESTAMP
      )
    `);

    let totalFiles = 0;
    let processedFiles = 0;
    let extractedObjects = 0;
    const errors: any[] = [];

    // First, count total files to provide better progress reporting
    for (const folder of project.sourceFolders) {
      if (!folder || !folder.path) continue;
      
      try {
        const jsonFiles = await jsonScanner.findJsonFiles(folder.path);
        totalFiles += jsonFiles.length;
      } catch (error) {
        console.warn(`Error counting files in ${folder.path || 'unknown path'}:`, error);
      }
    }

    // Process each source folder
    for (const folder of project.sourceFolders) {
      if (!folder || !folder.path) continue;
      
      try {
        if (!fs.existsSync(folder.path)) {
          errors.push({
            file: folder.path,
            error: 'Source folder does not exist'
          });
          continue;
        }

        // Find all JSON and JSONL files in the folder
        const jsonFiles = await jsonScanner.findJsonFiles(folder.path);
        
        // Process each file
        for (let i = 0; i < jsonFiles.length; i++) {
          const filePath = jsonFiles[i];
          
          // Send progress update
          sendResponse('scan-progress', { 
            projectId,
            current: processedFiles, 
            total: totalFiles, 
            message: `Processing file ${processedFiles + 1}/${totalFiles}: ${filePath ? path.basename(filePath) : 'unknown file'}` 
          });
          
          // Update project status periodically (not on every file to reduce DB writes)
          await projectManager.updateProjectInRegistry(projectId, {
            scanStatus: {
              isScanning: true,
              progress: {
                current: processedFiles,
                total: totalFiles,
                message: `Processing file ${processedFiles + 1}/${totalFiles}: ${filePath ? path.basename(filePath) : 'unknown file'}`
              }
            }
          }).catch(error => {
            console.error('Failed to update project scan status:', error);
          });
          
          try {
            if (filePath) {
              // Parse the file
              const jsonData = await jsonScanner.parseFile(filePath);
              
              // Define chunk size
              const CHUNK_SIZE = 50;
              
              // Process objects in chunks
              for (let i = 0; i < jsonData.length; i += CHUNK_SIZE) {
                // Get current chunk of objects
                const chunk = jsonData.slice(i, i + CHUNK_SIZE);
                
                // First pass: determine all necessary columns in this chunk
                const newColumns = new Set<string>();
                for (const obj of chunk) {
                  for (const key of Object.keys(obj)) {
                    if (!key.startsWith('_') && !processedColumns.has(key)) {
                      newColumns.add(key);
                    }
                  }
                }
                
                // Add all new columns to the database at once
                for (const key of newColumns) {
                  try {
                    await dbManager.executeNonQuery(`ALTER TABLE ${tableName} ADD COLUMN "${key}" TEXT`);
                    processedColumns.add(key);
                  } catch (columnError) {
                    // Column might already exist, ignore the error
                    console.warn(`Column "${key}" might already exist:`, columnError);
                    processedColumns.add(key);
                  }
                }
                
                // Second pass: prepare true bulk insert for all objects in the chunk
                const validObjects = chunk.filter(obj => Object.keys(obj).length > 0);
                
                if (validObjects.length > 0) {
                  // Get all columns across all objects in this chunk
                  const allColumns = new Set<string>();
                  for (const obj of validObjects) {
                    for (const key of Object.keys(obj)) {
                      if (!key.startsWith('_')) {
                        allColumns.add(key);
                      }
                    }
                  }
                  
                  // Convert to array and sort for consistent order
                  const columnArray = Array.from(allColumns).sort();
                  
                  // Create column string for SQL query
                  const columnString = columnArray.map(col => `"${col}"`).join(', ');
                  
                  // Build the multi-row VALUES part of the query and parameter array
                  let valuesSql = '';
                  const allParams: any[] = [];
                  
                  validObjects.forEach((obj, index) => {
                    // Add comma if not the first item
                    if (index > 0) {
                      valuesSql += ', ';
                    }
                    
                    // Add source file parameter
                    allParams.push(filePath);
                    
                    // Create placeholders for this row and add values to params array
                    valuesSql += '(?';  // Start with source file placeholder
                    
                    // Add placeholders and values for each column
                    columnArray.forEach(col => {
                      valuesSql += ', ?';
                      // Add the value or null if it doesn't exist
                      allParams.push(obj[col] !== undefined ? obj[col] : null);
                    });
                    
                    valuesSql += ')';
                  });
                  
                  // Execute the bulk insert
                  await dbManager.executeNonQuery(
                    `INSERT INTO ${tableName} (_source_file, ${columnString}) VALUES ${valuesSql}`,
                    allParams
                  );
                  
                  // Update the count of extracted objects
                  extractedObjects += validObjects.length;
                }
              }
            }
            
            processedFiles++;
            
            // Yield to the event loop to prevent UI freezing
            await new Promise(resolve => setTimeout(resolve, 0));
          } catch (fileError) {
            errors.push({
              file: filePath,
              error: (fileError as Error).message
            });
            processedFiles++;
          }
        }
      } catch (folderError) {
        errors.push({
          file: folder.path,
          error: `Failed to scan folder: ${(folderError as Error).message}`
        });
      }
    }

    // Get the schema of the created table
    const tableSchema = await dbManager.getDataTableSchema('default');
    
    // Create scan results
    const scanResults: ScanResults = {
      viewId: 'default',
      totalFiles,
      processedFiles,
      totalRecords: extractedObjects,
      columns: tableSchema.map(col => ({
        name: col.columnName,
        type: col.dataType,
        nullable: col.nullable,
        sampleValues: []
      })),
      errors,
      scanDate: new Date()
    };

    // Update project with final status
    await projectManager.updateProjectInRegistry(projectId, {
      scanStatus: {
        isScanning: false,
        progress: {
          current: totalFiles,
          total: totalFiles,
          message: `Scan completed. Processed ${processedFiles} files and extracted ${extractedObjects} objects.`
        },
        lastScanResult: {
          processedFiles,
          extractedObjects,
          completedDate: new Date()
        }
      }
    });

    // Send progress update - completed
    sendResponse('scan-progress', { 
      projectId,
      current: 100, 
      total: 100, 
      message: `Scan completed. Processed ${processedFiles} files and extracted ${extractedObjects} objects.` 
    });

    // Send scan complete event
    sendResponse('scan-complete', { 
      projectId, 
      processedFiles, 
      extractedObjects 
    });

  } catch (error) {
    console.error('Failed to scan source directories:', error);
    
    // Update project with error status
    try {
      await projectManager.updateProjectInRegistry(projectId, {
        scanStatus: {
          isScanning: false,
          progress: undefined,
          lastScanResult: {
            processedFiles: 0,
            extractedObjects: 0,
            completedDate: new Date()
          }
        }
      });
    } catch (updateError) {
      console.error('Failed to update project scan status:', updateError);
    }
    
    sendError('Failed to scan source directories', (error as Error).message);
  }
});

// The findJsonFiles, processJsonFile, and processJsonlFile functions have been removed
// as we now use the JSONScanner class methods instead

/**
 * Select a folder using the system dialog
 */
ipcMain.on('select-folder', async (event) => {
  try {
    if (!mainWindow) {
      throw new Error('Main window is not available');
    }

    const result = await dialog.showOpenDialog(mainWindow, {
      properties: ['openDirectory', 'createDirectory']
    });

    if (result.canceled) {
      mainWindow.webContents.send('folder-selected', null);
    } else {
      mainWindow.webContents.send('folder-selected', result.filePaths[0]);
    }
  } catch (error) {
    console.error('Failed to select folder:', error);
    sendError('Failed to select folder', (error as Error).message);
    if (mainWindow) {
      mainWindow.webContents.send('folder-selected', null);
    }
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

// The scan-data handler has been removed as it's not being used anywhere in the codebase
// All scanning is now handled by the scan-source-directories handler

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
 * Execute a raw SQL query on the project database
 */
ipcMain.on('execute-sql-query', async (event, data: { projectId: string; sql: string; params?: any[]; page?: number; pageSize?: number }) => {
  try {
    if (!data || !data.projectId || !data.sql) {
      throw new Error('Project ID and SQL query are required');
    }

    // Get project
    const project = await projectManager.getProject(data.projectId);
    if (!project) {
      throw new Error('Project not found');
    }

    // Get database manager for the project
    const dbManager = await projectManager.openProjectDatabase(data.projectId);

    // Execute the SQL query
    const result = await dbManager.executeSqlQuery(
      data.sql, 
      data.params || [], 
      data.page || 1, 
      data.pageSize || 10
    );

    // Convert the result to the expected format
    const queryResult: QueryResult = {
      data: result.rows,
      totalCount: result.totalRows,
      columns: result.columns
    };

    sendResponse('sql-query-results', queryResult);

  } catch (error) {
    console.error('Failed to execute SQL query:', error);
    
    // Extract more detailed error information
    let errorDetails = (error as Error).message;
    
    // Check if the error has a cause or stack that might provide more context
    if ((error as any).cause) {
      errorDetails += `\n\nCause: ${(error as any).cause}`;
    }
    
    // Include the SQL query in the error details to help with debugging
    // But sanitize it first to remove any sensitive information
    const sanitizedSql = data.sql
      .replace(/password\s*=\s*['"].*?['"]/gi, "password='***'")
      .replace(/secret\s*=\s*['"].*?['"]/gi, "secret='***'");
    
    errorDetails += `\n\nQuery: ${sanitizedSql}`;
    
    // Send the enhanced error details to the renderer
    sendError('Failed to execute SQL query', errorDetails);
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

// Set the application icon as early as possible
if (process.platform === 'darwin') {
  app.whenReady().then(() => {
    const iconPath = path.resolve(__dirname, 'src/assets/Scuba.png');
    const icon = nativeImage.createFromPath(iconPath);
    if (!icon.isEmpty()) {
      app.dock.setIcon(icon);
    }
    createWindow();
  });
} else {
  app.whenReady().then(createWindow);
}

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
    // No need to close digrConfigManager as it doesn't maintain any open resources
  } catch (error) {
    console.error('Error during app quit cleanup:', error);
  }
});
