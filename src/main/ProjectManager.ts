import { v4 as uuidv4 } from 'uuid';
import * as fs from 'fs';
import * as path from 'path';
import { Project, SourceFolder } from '../types';
import { DataPersistence } from './DataPersistence';
import { DatabaseManager } from './DatabaseManager';

/**
 * ProjectManager handles project CRUD operations and persistence across global registry and per-project databases.
 * Uses a distributed approach where project metadata is stored in a global registry,
 * while project-specific data is stored in per-project .digr databases.
 */
export class ProjectManager {
  private dataPersistence: DataPersistence;
  private isInitialized: boolean = false;
  private projectDatabases: Map<string, DatabaseManager> = new Map();

  constructor() {
    this.dataPersistence = new DataPersistence();
  }

  /**
   * Initialize the project manager
   * Sets up the global registry and ensures it exists
   */
  async initialize(): Promise<void> {
    try {
      await this.dataPersistence.initialize();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize ProjectManager: ${(error as Error).message}`);
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
      console.log(`Creating project: ${name} at ${workingDirectory}`);
      
      // Check if project name already exists
      const nameExists = await this.dataPersistence.projectNameExists(name);
      if (nameExists) {
        console.log(`Project name "${name}" already exists`);
        throw new Error(`Project name "${name}" already exists. Please choose a different name.`);
      }

      // Validate parent directory path
      const resolvedParentPath = path.resolve(workingDirectory);
      
      // Create parent directory if it doesn't exist
      if (!fs.existsSync(resolvedParentPath)) {
        try {
          fs.mkdirSync(resolvedParentPath, { recursive: true });
        } catch (fsError) {
          throw new Error(`Failed to create parent directory: ${(fsError as Error).message}`);
        }
      }

      // Verify parent directory is accessible
      try {
        fs.accessSync(resolvedParentPath, fs.constants.R_OK | fs.constants.W_OK);
      } catch (accessError) {
        throw new Error(`Parent directory is not accessible: ${(accessError as Error).message}`);
      }
      
      // Create project subfolder with the project name
      const projectFolderName = name.trim().replace(/[<>:"/\\|?*\x00-\x1f]/g, '_');
      const projectPath = path.join(resolvedParentPath, projectFolderName);
      
      // Check if project folder already exists
      if (fs.existsSync(projectPath)) {
        console.log(`Project folder "${projectPath}" already exists`);
        throw new Error(`Project folder "${projectFolderName}" already exists in the selected directory. Please choose a different name or location.`);
      }
      
      // Create project folder
      try {
        fs.mkdirSync(projectPath, { recursive: true });
      } catch (fsError) {
        throw new Error(`Failed to create project folder: ${(fsError as Error).message}`);
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
      console.log(`Ensuring .digr folder exists at ${projectPath}`);
      await this.ensureProjectDigrFolder(projectPath);
      console.log(`Creating database manager for ${projectPath}`);
      const dbManager = new DatabaseManager(projectPath);
      console.log(`Initializing project database for ${project.id}`);
      await dbManager.initializeProjectDatabase(project.id, project.name, projectPath);
      console.log(`Creating project schema for ${project.id}`);
      await dbManager.createProjectSchema(project.id, project.name, projectPath);
      console.log(`Closing project database for ${project.id}`);
      await dbManager.closeProjectDatabase();

      // Add to global registry
      console.log(`Adding project ${project.id} to registry`);
      await this.dataPersistence.addProjectToRegistry(project);
      
      console.log(`Project ${project.id} created successfully`);
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
      const projects = await this.dataPersistence.loadProjectRegistry();
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
      return await this.dataPersistence.loadProjectRegistry();
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
      await this.dataPersistence.removeProjectFromRegistry(projectId);
      
      // Note: We preserve the .digr folder and its contents as per requirements
    } catch (error) {
      throw new Error(`Failed to delete project: ${(error as Error).message}`);
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

      await this.dataPersistence.updateProjectInRegistry(projectId, updatedProject);

      // Also add to per-project database
      const dbManager = await this.openProjectDatabase(projectId);
      await dbManager.executeNonQuery(
        'INSERT INTO source_folders (id, path, added_date) VALUES (?, ?, ?)',
        [sourceFolder.id, sourceFolder.path, sourceFolder.addedDate.toISOString()]
      );
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

      await this.dataPersistence.updateProjectInRegistry(projectId, updatedProject);

      // Also remove from per-project database
      const dbManager = await this.openProjectDatabase(projectId);
      await dbManager.executeNonQuery(
        'DELETE FROM source_folders WHERE id = ?',
        [folderToRemove.id]
      );
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
}
