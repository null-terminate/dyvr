import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { Project, SourceFolder, DigrConfig } from '../types';
import { DigrConfigManager } from './DigrConfigManager';
import { DatabaseManager } from './DatabaseManager';

/**
 * ProjectManager handles project CRUD operations and persistence across global registry and per-project databases.
 * Uses a distributed approach where project metadata is stored in a global registry,
 * while project-specific data is stored in per-project .digr databases.
 */
export class ProjectManager {
  private digrConfigManager: DigrConfigManager;
  private isInitialized: boolean = false;
  private projectDatabases: Map<string, DatabaseManager> = new Map();
  private projectCache: Map<string, Project> = new Map();

  /**
   * Creates a new ProjectManager instance
   * @param configPath Optional custom path for the config file (used for testing)
   */
  constructor(configPath?: string) {
    this.digrConfigManager = new DigrConfigManager(configPath);
  }

  /**
   * Initialize the project manager
   * Sets up the global registry and ensures it exists
   */
  async initialize(): Promise<void> {
    try {
      await this.digrConfigManager.initialize();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize ProjectManager: ${(error as Error).message}`);
    }
  }

  /**
   * Load projects from the global registry
   */
  async loadProjectRegistry(): Promise<Project[]> {
    this._validateInitialized();

    try {
      const config = await this.digrConfigManager.getConfig();
      
      const projects: Project[] = [];
      
      for (const configProject of config.projects) {
        const projectPath = configProject.path;
        
        // Check if the project path exists
        if (!fs.existsSync(projectPath)) {
          console.warn(`ProjectManager: Project path "${projectPath}" does not exist, but will still load it`);
        } else {
          
          // Check if the project path has a .digr subfolder
          const digrFolderPath = path.join(projectPath, '.digr');
          if (!fs.existsSync(digrFolderPath)) {
            console.warn(`ProjectManager: Project path "${projectPath}" does not have a .digr subfolder`);
          } else {
          }
        }
        
        // Check if we have this project in cache
        const cachedProject = Array.from(this.projectCache.values())
          .find(p => path.resolve(p.workingDirectory) === path.resolve(projectPath));
        
        if (cachedProject) {
          projects.push(cachedProject);
        } else {
          // Create a new project object
          const projectName = path.basename(projectPath);
          
          const project: Project = {
            id: uuidv4(),
            name: projectName,
            workingDirectory: projectPath,
            sourceFolders: [],
            createdDate: new Date(),
            lastModified: new Date()
          };
          
          // Try to load project data from project.json
          const projectData = await this.loadProjectJson(projectPath);
          if (projectData) {
            // Use data from project.json
            if (projectData.id) project.id = projectData.id;
            if (projectData.name) project.name = projectData.name;
            if (projectData.sourceFolders) project.sourceFolders = projectData.sourceFolders;
            if (projectData.createdDate) project.createdDate = new Date(projectData.createdDate);
            if (projectData.lastModified) project.lastModified = new Date(projectData.lastModified);
          }
          
          // Add to cache
          this.projectCache.set(project.id, project);
          projects.push(project);
        }
      }
      
      return projects;
    } catch (error) {
      console.error('Failed to load projects from digr.config:', error);
      return [];
    }
  }

  /**
   * Add a project to the global registry
   */
  async addProjectToRegistry(project: Project): Promise<void> {
    this._validateInitialized();
    this._validateProject(project);

    try {
      // Add to digr.config
      await this.digrConfigManager.addProject(project.workingDirectory);
      
      // Update cache
      this.projectCache.set(project.id, {
        ...project,
        lastModified: new Date()
      });
    } catch (error) {
      throw new Error(`Failed to add project: ${(error as Error).message}`);
    }
  }

  /**
   * Remove a project from the global registry
   */
  async removeProjectFromRegistry(projectId: string): Promise<void> {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      // Get project from cache
      const project = this.projectCache.get(projectId);
      if (!project) {
        // Try to find it in the loaded projects
        const projects = await this.loadProjectRegistry();
        const foundProject = projects.find(p => p.id === projectId);
        if (!foundProject) {
          throw new Error(`Project with ID ${projectId} not found`);
        }
        
        // Remove from digr.config
        await this.digrConfigManager.removeProject(foundProject.workingDirectory);
      } else {
        // Remove from digr.config
        await this.digrConfigManager.removeProject(project.workingDirectory);
        
        // Remove from cache
        this.projectCache.delete(projectId);
      }
    } catch (error) {
      throw new Error(`Failed to remove project: ${(error as Error).message}`);
    }
  }

  /**
   * Update a project in the global registry
   */
  async updateProjectInRegistry(projectId: string, updates: Partial<Project>): Promise<Project> {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      // Get project from cache
      let project = this.projectCache.get(projectId);
      
      if (!project) {
        // Try to find it in the loaded projects
        const projects = await this.loadProjectRegistry();
        project = projects.find(p => p.id === projectId);
        
        if (!project) {
          throw new Error(`Project with ID ${projectId} not found`);
        }
      }
      
      // If working directory changed, update digr.config
      if (updates.workingDirectory && updates.workingDirectory !== project.workingDirectory) {
        await this.digrConfigManager.removeProject(project.workingDirectory);
        await this.digrConfigManager.addProject(updates.workingDirectory);
      }
      
      // Update cache
      const updatedProject = {
        ...project,
        name: updates.name || project.name,
        workingDirectory: updates.workingDirectory || project.workingDirectory,
        sourceFolders: updates.sourceFolders || project.sourceFolders,
        lastModified: new Date()
      };
      
      // Update the cache with the updated project
      this.projectCache.set(projectId, updatedProject);
      
      // Return the updated project to ensure it's available immediately
      return updatedProject;
    } catch (error) {
      throw new Error(`Failed to update project: ${(error as Error).message}`);
    }
  }

  /**
   * Check if a project name already exists (case-insensitive)
   */
  async projectNameExists(projectName: string, excludeProjectId?: string): Promise<boolean> {
    this._validateInitialized();
    
    if (!projectName || typeof projectName !== 'string') {
      throw new Error('Project name must be a non-empty string');
    }

    try {
      const projects = await this.loadProjectRegistry();
      const normalizedName = projectName.trim().toLowerCase();
      
      return projects.some(project => 
        project.name.toLowerCase() === normalizedName && 
        project.id !== excludeProjectId
      );
    } catch (error) {
      throw new Error(`Failed to check project name existence: ${(error as Error).message}`);
    }
  }

  /**
   * Create a new project
   */
  async createProject(name: string, workingDirectory: string): Promise<Project> {
    this._validateInitialized();
    this._validateProjectName(name);
    this._validateWorkingDirectory(workingDirectory);

    try {
      
      // Check if project name already exists
      const nameExists = await this.projectNameExists(name);
      if (nameExists) {
        throw new Error(`Project name "${name}" already exists. Please choose a different name.`);
      }

      // Validate parent directory path
      const resolvedParentPath = path.resolve(workingDirectory);
      
      // Create parent directory if it doesn't exist
      if (!fs.existsSync(resolvedParentPath)) {
        try {
          fs.mkdirSync(resolvedParentPath, { recursive: true });
        } catch (fsError) {
          console.error(`Failed to create parent directory: ${(fsError as Error).message}`);
          throw new Error(`Failed to create working directory: ${(fsError as Error).message}`);
        }
      } else {
      }

      // Verify parent directory is accessible
      try {
        fs.accessSync(resolvedParentPath, fs.constants.R_OK | fs.constants.W_OK);
      } catch (accessError) {
        console.error(`Parent directory is not accessible: ${(accessError as Error).message}`);
        throw new Error(`Working directory is not accessible: ${(accessError as Error).message}`);
      }
      
      // Create a project folder with the project name in the parent path
      const trimmedName = name.trim();
      
      // Always create a project folder with the project name in the parent path
      const projectPath = path.join(resolvedParentPath, trimmedName);
      
      // Ensure the project path is different from the parent path
      if (projectPath === resolvedParentPath) {
        console.error(`Project path is the same as parent path: ${projectPath}`);
        throw new Error(`Project path must be different from parent path. Please check the project name and parent folder path.`);
      }
      
      // Create project directory if it doesn't exist
      if (!fs.existsSync(projectPath)) {
        try {
          fs.mkdirSync(projectPath, { recursive: true });
        } catch (fsError) {
          console.error(`Failed to create project directory: ${(fsError as Error).message}`);
          throw new Error(`Failed to create project directory: ${(fsError as Error).message}`);
        }
      } else {
      }
      
      // Verify project directory is accessible
      try {
        fs.accessSync(projectPath, fs.constants.R_OK | fs.constants.W_OK);
      } catch (accessError) {
        console.error(`Project directory is not accessible: ${(accessError as Error).message}`);
        throw new Error(`Project directory is not accessible: ${(accessError as Error).message}`);
      }
      
      // Create .digr subfolder in the project directory
      const digrFolderPath = path.join(projectPath, '.digr');
      if (!fs.existsSync(digrFolderPath)) {
        try {
          fs.mkdirSync(digrFolderPath, { recursive: true });
        } catch (fsError) {
          console.error(`Failed to create .digr subfolder: ${(fsError as Error).message}`);
          throw new Error(`Failed to create .digr subfolder: ${(fsError as Error).message}`);
        }
      } else {
      }

      // Create project object
      const project: Project = {
        id: uuidv4(),
        name: name.trim(),
        workingDirectory: projectPath,
        sourceFolders: [],
        createdDate: new Date(),
        lastModified: new Date()
      };

      // Create per-project database and initialize schema
      await this.ensureProjectDigrFolder(projectPath);
      const dbManager = new DatabaseManager(projectPath);
      await dbManager.initializeProjectDatabase(project.id, project.name, projectPath);
      await dbManager.createProjectSchema(project.id, project.name, projectPath);
      await dbManager.closeProjectDatabase();

      // Save to project.json file
      await this.saveProjectJson(project);

      // Add to global registry
      await this.addProjectToRegistry(project);
      
      return project;
    } catch (error) {
      if ((error as Error).message.includes('already exists') || 
          (error as Error).message.includes('Failed to create') || 
          (error as Error).message.includes('not accessible')) {
        throw error;
      }
      throw new Error(`Failed to create project: ${(error as Error).message}`);
    }
  }

  /**
   * Get a project by ID
   */
  async getProject(projectId: string): Promise<Project | null> {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      const projects = await this.loadProjectRegistry();
      return projects.find(p => p.id === projectId) || null;
    } catch (error) {
      throw new Error(`Failed to get project: ${(error as Error).message}`);
    }
  }

  /**
   * Get all projects
   */
  async getProjects(): Promise<Project[]> {
    this._validateInitialized();

    try {
      return await this.loadProjectRegistry();
    } catch (error) {
      throw new Error(`Failed to get projects: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a project and all associated data
   */
  async deleteProject(projectId: string): Promise<void> {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      // Verify project exists
      const project = await this.getProject(projectId);
      if (!project) {
        throw new Error(`Project with ID "${projectId}" not found`);
      }

      // Close project database if open
      if (this.projectDatabases.has(projectId)) {
        const dbManager = this.projectDatabases.get(projectId)!;
        await dbManager.closeProjectDatabase();
        this.projectDatabases.delete(projectId);
      }

      // Remove from global registry
      await this.removeProjectFromRegistry(projectId);
      
      // Note: We preserve the .digr folder and its contents as per requirements
    } catch (error) {
      throw new Error(`Failed to delete project: ${(error as Error).message}`);
    }
  }

  /**
   * Save project data to project.json file in the .digr folder
   */
  private async saveProjectJson(project: Project): Promise<void> {
    try {
      // Ensure .digr folder exists
      await this.ensureProjectDigrFolder(project.workingDirectory);
      
      // Create project.json file path
      const projectJsonPath = path.join(project.workingDirectory, '.digr', 'project.json');
      
      // Create project data to save
      const projectData = {
        id: project.id,
        name: project.name,
        sourceFolders: project.sourceFolders,
        createdDate: project.createdDate,
        lastModified: new Date()
      };
      
      // Write to project.json file
      fs.writeFileSync(projectJsonPath, JSON.stringify(projectData, null, 2));
    } catch (error) {
      console.error(`Failed to save project.json: ${(error as Error).message}`);
      throw new Error(`Failed to save project data: ${(error as Error).message}`);
    }
  }
  
  /**
   * Load project data from project.json file in the .digr folder
   */
  private async loadProjectJson(projectWorkingDirectory: string): Promise<Partial<Project> | null> {
    try {
      // Create project.json file path
      const projectJsonPath = path.join(projectWorkingDirectory, '.digr', 'project.json');
      
      // Check if project.json exists
      if (!fs.existsSync(projectJsonPath)) {
        return null;
      }
      
      // Read and parse project.json file
      const projectDataStr = fs.readFileSync(projectJsonPath, 'utf8');
      return JSON.parse(projectDataStr);
    } catch (error) {
      console.error(`Failed to load project.json: ${(error as Error).message}`);
      return null;
    }
  }

  /**
   * Add a source folder to a project
   */
  async addSourceFolder(projectId: string, folderPath: string): Promise<void> {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }
    
    if (!folderPath || typeof folderPath !== 'string') {
      throw new Error('Folder path must be a non-empty string');
    }

    try {
      // Verify project exists
      const project = await this.getProject(projectId);
      if (!project) {
        throw new Error(`Project with ID "${projectId}" not found`);
      }

      // Validate folder path
      const resolvedPath = path.resolve(folderPath);
      
      if (!fs.existsSync(resolvedPath)) {
        throw new Error(`Folder path does not exist: ${resolvedPath}`);
      }

      const stats = fs.statSync(resolvedPath);
      if (!stats.isDirectory()) {
        throw new Error(`Path is not a directory: ${resolvedPath}`);
      }

      // Verify folder is accessible
      try {
        fs.accessSync(resolvedPath, fs.constants.R_OK);
      } catch (accessError) {
        throw new Error(`Folder is not accessible: ${(accessError as Error).message}`);
      }

      // Check if folder is already added to this project
      const isDuplicate = project.sourceFolders.some(folder => 
        path.resolve(folder.path) === resolvedPath
      );
      
      if (isDuplicate) {
        throw new Error(`Folder "${resolvedPath}" is already added to this project`);
      }

      // Create source folder object
      const sourceFolder: SourceFolder = {
        id: uuidv4(),
        path: resolvedPath,
        addedDate: new Date()
      };

      // Add to project's source folders and update registry
      const updatedProject = {
        ...project,
        sourceFolders: [...project.sourceFolders, sourceFolder],
        lastModified: new Date()
      };

      const result = await this.updateProjectInRegistry(projectId, updatedProject);

      // Ensure project database exists
      await this.ensureProjectDatabase(projectId, project);
      
      // Add to per-project database
      const dbManager = await this.openProjectDatabase(projectId);
      
      // Ensure the source_folders table exists
      await dbManager.executeNonQuery(
        'CREATE TABLE IF NOT EXISTS source_folders (id TEXT PRIMARY KEY, path TEXT NOT NULL, added_date TEXT NOT NULL)'
      );
      
      // Insert the source folder
      await dbManager.executeNonQuery(
        'INSERT INTO source_folders (id, path, added_date) VALUES (?, ?, ?)',
        [sourceFolder.id, sourceFolder.path, sourceFolder.addedDate.toISOString()]
      );
      
      // Save to project.json file
      await this.saveProjectJson(updatedProject);
    } catch (error) {
      if ((error as Error).message.includes('not found') || 
          (error as Error).message.includes('does not exist') || 
          (error as Error).message.includes('not a directory') || 
          (error as Error).message.includes('not accessible') ||
          (error as Error).message.includes('already added')) {
        throw error;
      }
      throw new Error(`Failed to add source folder: ${(error as Error).message}`);
    }
  }

  /**
   * Remove a source folder from a project
   */
  async removeSourceFolder(projectId: string, folderPath: string): Promise<void> {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }
    
    if (!folderPath || typeof folderPath !== 'string') {
      throw new Error('Folder path must be a non-empty string');
    }

    try {
      // Verify project exists
      const project = await this.getProject(projectId);
      if (!project) {
        throw new Error(`Project with ID "${projectId}" not found`);
      }

      const resolvedPath = path.resolve(folderPath);

      // Find the source folder to remove
      const folderIndex = project.sourceFolders.findIndex(folder => 
        path.resolve(folder.path) === resolvedPath
      );

      if (folderIndex === -1) {
        throw new Error(`Folder "${resolvedPath}" is not added to this project`);
      }

      const folderToRemove = project.sourceFolders[folderIndex];
      if (!folderToRemove) {
        throw new Error(`Folder not found in project`);
      }

      // Remove from project's source folders and update registry
      const updatedSourceFolders = project.sourceFolders.filter((_, index) => index !== folderIndex);
      const updatedProject = {
        ...project,
        sourceFolders: updatedSourceFolders,
        lastModified: new Date()
      };

      const result = await this.updateProjectInRegistry(projectId, updatedProject);

      // Ensure project database exists
      await this.ensureProjectDatabase(projectId, project);
      
      // Remove from per-project database
      const dbManager = await this.openProjectDatabase(projectId);
      await dbManager.executeNonQuery(
        'DELETE FROM source_folders WHERE id = ?',
        [folderToRemove.id]
      );
      
      // Save to project.json file
      await this.saveProjectJson(updatedProject);
    } catch (error) {
      if ((error as Error).message.includes('not found') || 
          (error as Error).message.includes('not added')) {
        throw error;
      }
      throw new Error(`Failed to remove source folder: ${(error as Error).message}`);
    }
  }

  /**
   * Get all source folders for a project
   */
  async getSourceFolders(projectId: string): Promise<SourceFolder[]> {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      const project = await this.getProject(projectId);
      return project ? project.sourceFolders : [];
    } catch (error) {
      throw new Error(`Failed to get source folders: ${(error as Error).message}`);
    }
  }

  /**
   * Load projects from the global registry
   */
  async loadProjects(): Promise<void> {
    this._validateInitialized();
    // Projects are loaded on-demand from the registry, no need for explicit loading
  }

  /**
   * Open a project database connection
   */
  async openProjectDatabase(projectId: string): Promise<DatabaseManager> {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    // Return existing connection if available
    if (this.projectDatabases.has(projectId)) {
      return this.projectDatabases.get(projectId)!;
    }

    // Get project to find working directory
    const project = await this.getProject(projectId);
    if (!project) {
      throw new Error(`Project with ID "${projectId}" not found`);
    }

    // Create and open database connection
    const dbManager = new DatabaseManager(project.workingDirectory);
    await dbManager.openProjectDatabase(project.workingDirectory);
    
    // Cache the connection
    this.projectDatabases.set(projectId, dbManager);
    
    return dbManager;
  }

  /**
   * Close a project database connection
   */
  async closeProjectDatabase(projectId: string): Promise<void> {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    if (this.projectDatabases.has(projectId)) {
      const dbManager = this.projectDatabases.get(projectId)!;
      await dbManager.closeProjectDatabase();
      this.projectDatabases.delete(projectId);
    }
  }

  /**
   * Ensure the .digr folder exists in the project's working directory
   */
  async ensureProjectDigrFolder(workingDirectory: string): Promise<void> {
    if (!workingDirectory || typeof workingDirectory !== 'string') {
      throw new Error('Working directory is required');
    }

    try {
      const digrPath = path.join(workingDirectory, '.digr');
      
      if (!fs.existsSync(digrPath)) {
        fs.mkdirSync(digrPath, { recursive: true });
      }

      // Verify the folder was created and is accessible
      if (!fs.existsSync(digrPath) || !fs.statSync(digrPath).isDirectory()) {
        throw new Error('Failed to create or access .digr folder');
      }
    } catch (error) {
      throw new Error(`Failed to ensure .digr folder: ${(error as Error).message}`);
    }
  }

  /**
   * Ensure the project database exists and is initialized
   */
  async ensureProjectDatabase(projectId: string, project: Project): Promise<void> {
    try {
      // Check if the database file exists
      const dbPath = path.join(project.workingDirectory, '.digr', `${projectId}.db`);
      const dbExists = fs.existsSync(dbPath);
      
      if (!dbExists) {
        console.log(`Project database does not exist, creating it: ${dbPath}`);
        
        // Create the database and initialize schema
        await this.ensureProjectDigrFolder(project.workingDirectory);
        const dbManager = new DatabaseManager(project.workingDirectory);
        await dbManager.initializeProjectDatabase(project.id, project.name, project.workingDirectory);
        await dbManager.createProjectSchema(project.id, project.name, project.workingDirectory);
        await dbManager.closeProjectDatabase();
      }
    } catch (error) {
      console.error(`Failed to ensure project database: ${(error as Error).message}`);
      throw new Error(`Failed to ensure project database: ${(error as Error).message}`);
    }
  }

  /**
   * Close the project manager and cleanup resources
   */
  async close(): Promise<void> {
    // Close all open project databases
    for (const [projectId, dbManager] of this.projectDatabases) {
      try {
        await dbManager.closeProjectDatabase();
      } catch (error) {
        console.error(`Failed to close database for project ${projectId}:`, error);
      }
    }
    this.projectDatabases.clear();
    this.isInitialized = false;
    
    // Clear the project cache
    this.projectCache.clear();
  }

  /**
   * Validate that the project manager is initialized
   */
  private _validateInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('ProjectManager not initialized. Call initialize() first.');
    }
  }

  /**
   * Validate project name
   */
  private _validateProjectName(name: string): void {
    if (!name || typeof name !== 'string') {
      throw new Error('Project name must be a non-empty string');
    }
    
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      throw new Error('Project name cannot be empty or only whitespace');
    }
    
    if (trimmedName.length > 255) {
      throw new Error('Project name cannot exceed 255 characters');
    }
    
    // Check for invalid characters that might cause issues with file systems
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(trimmedName)) {
      throw new Error('Project name contains invalid characters');
    }
  }

  /**
   * Validate working directory path
   */
  private _validateWorkingDirectory(workingDirectory: string): void {
    if (!workingDirectory || typeof workingDirectory !== 'string') {
      throw new Error('Working directory must be a non-empty string');
    }
    
    const trimmedPath = workingDirectory.trim();
    if (trimmedPath.length === 0) {
      throw new Error('Working directory cannot be empty or only whitespace');
    }
    
    // Check if path is absolute or can be resolved
    try {
      path.resolve(trimmedPath);
    } catch (pathError) {
      throw new Error(`Invalid working directory path: ${(pathError as Error).message}`);
    }
  }

  /**
   * Validate project object structure
   */
  private _validateProject(project: Project): void {
    if (!project || typeof project !== 'object') {
      throw new Error('Project must be an object');
    }
    if (!project.id || typeof project.id !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }
    if (!project.name || typeof project.name !== 'string') {
      throw new Error('Project name must be a non-empty string');
    }
    if (!project.workingDirectory || typeof project.workingDirectory !== 'string') {
      throw new Error('Project working directory must be a non-empty string');
    }
  }
}
