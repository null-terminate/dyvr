const { v4: uuidv4 } = require('uuid');
const fs = require('fs');
const path = require('path');
const DataPersistence = require('./DataPersistence');

/**
 * ProjectManager handles project CRUD operations with SQLite database integration.
 * Provides methods for creating, reading, updating, and deleting projects,
 * as well as managing source folders with foreign key relationships.
 */
class ProjectManager {
  constructor() {
    this.dataPersistence = new DataPersistence();
    this.isInitialized = false;
  }

  /**
   * Initialize the project manager
   * Sets up database connection and ensures schema exists
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      await this.dataPersistence.initialize();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize ProjectManager: ${error.message}`);
    }
  }

  /**
   * Create a new project
   * @param {string} name - Project name
   * @param {string} workingDirectory - Working directory path
   * @returns {Promise<Object>} Created project object
   */
  async createProject(name, workingDirectory) {
    this._validateInitialized();
    this._validateProjectName(name);
    this._validateWorkingDirectory(workingDirectory);

    try {
      // Check if project name already exists
      const nameExists = await this.dataPersistence.projectNameExists(name);
      if (nameExists) {
        throw new Error(`Project name "${name}" already exists. Please choose a different name.`);
      }

      // Validate working directory path
      const resolvedPath = path.resolve(workingDirectory);
      
      // Create working directory if it doesn't exist
      if (!fs.existsSync(resolvedPath)) {
        try {
          fs.mkdirSync(resolvedPath, { recursive: true });
        } catch (fsError) {
          throw new Error(`Failed to create working directory: ${fsError.message}`);
        }
      }

      // Verify directory is accessible
      try {
        fs.accessSync(resolvedPath, fs.constants.R_OK | fs.constants.W_OK);
      } catch (accessError) {
        throw new Error(`Working directory is not accessible: ${accessError.message}`);
      }

      // Create project object
      const project = {
        id: uuidv4(),
        name: name.trim(),
        workingDirectory: resolvedPath,
        createdDate: new Date(),
        lastModified: new Date()
      };

      // Save to database
      const savedProject = await this.dataPersistence.saveProject(project);
      return savedProject;
    } catch (error) {
      if (error.message.includes('already exists') || error.message.includes('Failed to create') || error.message.includes('not accessible')) {
        throw error;
      }
      throw new Error(`Failed to create project: ${error.message}`);
    }
  }

  /**
   * Get a project by ID
   * @param {string} projectId - Project ID
   * @returns {Promise<Object|null>} Project object or null if not found
   */
  async getProject(projectId) {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      return await this.dataPersistence.loadProject(projectId);
    } catch (error) {
      throw new Error(`Failed to get project: ${error.message}`);
    }
  }

  /**
   * Get all projects
   * @returns {Promise<Array>} Array of project objects
   */
  async getAllProjects() {
    this._validateInitialized();

    try {
      return await this.dataPersistence.loadAllProjects();
    } catch (error) {
      throw new Error(`Failed to get projects: ${error.message}`);
    }
  }

  /**
   * Update a project
   * @param {string} projectId - Project ID to update
   * @param {Object} updates - Updates to apply
   * @param {string} [updates.name] - New project name
   * @param {string} [updates.workingDirectory] - New working directory
   * @returns {Promise<Object>} Updated project object
   */
  async updateProject(projectId, updates) {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }
    
    if (!updates || typeof updates !== 'object') {
      throw new Error('Updates must be an object');
    }

    try {
      // Load existing project
      const existingProject = await this.dataPersistence.loadProject(projectId);
      if (!existingProject) {
        throw new Error(`Project with ID "${projectId}" not found`);
      }

      // Validate and prepare updates
      const updatedProject = { ...existingProject };

      if (updates.name !== undefined) {
        this._validateProjectName(updates.name);
        
        // Check if new name conflicts with existing projects (excluding current project)
        const nameExists = await this.dataPersistence.projectNameExists(updates.name, projectId);
        if (nameExists) {
          throw new Error(`Project name "${updates.name}" already exists. Please choose a different name.`);
        }
        
        updatedProject.name = updates.name.trim();
      }

      if (updates.workingDirectory !== undefined) {
        this._validateWorkingDirectory(updates.workingDirectory);
        
        const resolvedPath = path.resolve(updates.workingDirectory);
        
        // Create working directory if it doesn't exist
        if (!fs.existsSync(resolvedPath)) {
          try {
            fs.mkdirSync(resolvedPath, { recursive: true });
          } catch (fsError) {
            throw new Error(`Failed to create working directory: ${fsError.message}`);
          }
        }

        // Verify directory is accessible
        try {
          fs.accessSync(resolvedPath, fs.constants.R_OK | fs.constants.W_OK);
        } catch (accessError) {
          throw new Error(`Working directory is not accessible: ${accessError.message}`);
        }
        
        updatedProject.workingDirectory = resolvedPath;
      }

      // Save updated project
      const savedProject = await this.dataPersistence.saveProject(updatedProject);
      return savedProject;
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('already exists') || 
          error.message.includes('Failed to create') || error.message.includes('not accessible')) {
        throw error;
      }
      throw new Error(`Failed to update project: ${error.message}`);
    }
  }

  /**
   * Delete a project and all associated data
   * @param {string} projectId - Project ID to delete
   * @returns {Promise<boolean>} True if project was deleted
   */
  async deleteProject(projectId) {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      // Verify project exists
      const existingProject = await this.dataPersistence.loadProject(projectId);
      if (!existingProject) {
        return false;
      }

      // Delete project (cascade will handle source folders and views)
      const deleted = await this.dataPersistence.deleteProject(projectId);
      return deleted;
    } catch (error) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  }

  /**
   * Add a source folder to a project
   * @param {string} projectId - Project ID
   * @param {string} folderPath - Path to source folder
   * @returns {Promise<Object>} Created source folder object
   */
  async addSourceFolder(projectId, folderPath) {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }
    
    if (!folderPath || typeof folderPath !== 'string') {
      throw new Error('Folder path must be a non-empty string');
    }

    try {
      // Verify project exists
      const project = await this.dataPersistence.loadProject(projectId);
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
        throw new Error(`Folder is not accessible: ${accessError.message}`);
      }

      // Check if folder is already added to this project
      const existingFolders = await this.dataPersistence.loadSourceFoldersForProject(projectId);
      const isDuplicate = existingFolders.some(folder => 
        path.resolve(folder.path) === resolvedPath
      );
      
      if (isDuplicate) {
        throw new Error(`Folder "${resolvedPath}" is already added to this project`);
      }

      // Create source folder object
      const sourceFolder = {
        id: uuidv4(),
        projectId: projectId,
        path: resolvedPath,
        addedDate: new Date()
      };

      // Save to database
      const savedFolder = await this.dataPersistence.saveSourceFolder(sourceFolder);
      return savedFolder;
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('does not exist') || 
          error.message.includes('not a directory') || error.message.includes('not accessible') ||
          error.message.includes('already added')) {
        throw error;
      }
      throw new Error(`Failed to add source folder: ${error.message}`);
    }
  }

  /**
   * Remove a source folder from a project
   * @param {string} projectId - Project ID
   * @param {string} sourceFolderId - Source folder ID to remove
   * @returns {Promise<boolean>} True if source folder was removed
   */
  async removeSourceFolder(projectId, sourceFolderId) {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }
    
    if (!sourceFolderId || typeof sourceFolderId !== 'string') {
      throw new Error('Source folder ID must be a non-empty string');
    }

    try {
      // Verify project exists
      const project = await this.dataPersistence.loadProject(projectId);
      if (!project) {
        throw new Error(`Project with ID "${projectId}" not found`);
      }

      // Verify source folder exists and belongs to project
      const sourceFolder = await this.dataPersistence.loadSourceFolder(sourceFolderId);
      if (!sourceFolder) {
        return false;
      }

      if (sourceFolder.projectId !== projectId) {
        throw new Error(`Source folder does not belong to project "${projectId}"`);
      }

      // Delete source folder
      const deleted = await this.dataPersistence.deleteSourceFolder(sourceFolderId);
      return deleted;
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('does not belong')) {
        throw error;
      }
      throw new Error(`Failed to remove source folder: ${error.message}`);
    }
  }

  /**
   * Get all source folders for a project
   * @param {string} projectId - Project ID
   * @returns {Promise<Array>} Array of source folder objects
   */
  async getSourceFolders(projectId) {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      return await this.dataPersistence.loadSourceFoldersForProject(projectId);
    } catch (error) {
      throw new Error(`Failed to get source folders: ${error.message}`);
    }
  }

  /**
   * Get a complete project with all associated data
   * @param {string} projectId - Project ID
   * @returns {Promise<Object|null>} Complete project object with source folders
   */
  async getCompleteProject(projectId) {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      const project = await this.dataPersistence.loadProject(projectId);
      if (!project) {
        return null;
      }

      const sourceFolders = await this.dataPersistence.loadSourceFoldersForProject(projectId);
      const views = await this.dataPersistence.loadViewsForProject(projectId);

      return {
        ...project,
        sourceFolders,
        views
      };
    } catch (error) {
      throw new Error(`Failed to get complete project: ${error.message}`);
    }
  }

  /**
   * Check if a project name is available
   * @param {string} projectName - Project name to check
   * @param {string} [excludeProjectId] - Project ID to exclude from check
   * @returns {Promise<boolean>} True if name is available
   */
  async isProjectNameAvailable(projectName, excludeProjectId = null) {
    this._validateInitialized();
    this._validateProjectName(projectName);

    try {
      const exists = await this.dataPersistence.projectNameExists(projectName, excludeProjectId);
      return !exists;
    } catch (error) {
      throw new Error(`Failed to check project name availability: ${error.message}`);
    }
  }

  /**
   * Close the project manager and cleanup resources
   * @returns {Promise<void>}
   */
  async close() {
    if (this.dataPersistence) {
      await this.dataPersistence.close();
    }
    this.isInitialized = false;
  }

  /**
   * Validate that the project manager is initialized
   * @private
   */
  _validateInitialized() {
    if (!this.isInitialized) {
      throw new Error('ProjectManager not initialized. Call initialize() first.');
    }
  }

  /**
   * Validate project name
   * @param {string} name - Project name to validate
   * @private
   */
  _validateProjectName(name) {
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
   * @param {string} workingDirectory - Working directory path to validate
   * @private
   */
  _validateWorkingDirectory(workingDirectory) {
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
      throw new Error(`Invalid working directory path: ${pathError.message}`);
    }
  }
}

module.exports = ProjectManager;