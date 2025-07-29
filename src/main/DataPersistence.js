const path = require('path');
const fs = require('fs');
const { app } = require('electron');
const DatabaseManager = require('./DatabaseManager');

/**
 * DataPersistence handles saving and loading application metadata including
 * projects, source folders, and views. It manages database path configuration
 * and provides data validation and error handling for persistence operations.
 */
class DataPersistence {
  constructor() {
    this.databaseManager = new DatabaseManager();
    this.isInitialized = false;
  }

  /**
   * Initialize the data persistence layer
   * Sets up database connection and ensures schema exists
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      await this.ensureDataDirectory();
      await this.databaseManager.initializeDatabase();
      
      // Check if schema exists and is valid
      const isSchemaValid = await this.databaseManager.validateSchema();
      if (!isSchemaValid) {
        await this.databaseManager.initializeSchema();
      }
      
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize data persistence: ${error.message}`);
    }
  }

  /**
   * Ensure the data directory exists
   * Creates the directory structure if it doesn't exist
   * @returns {Promise<void>}
   */
  async ensureDataDirectory() {
    try {
      const dataDir = this.getDataDirectoryPath();
      if (!fs.existsSync(dataDir)) {
        fs.mkdirSync(dataDir, { recursive: true });
      }
    } catch (error) {
      throw new Error(`Failed to create data directory: ${error.message}`);
    }
  }

  /**
   * Get the path to the application data directory
   * @returns {string} Data directory path
   */
  getDataDirectoryPath() {
    return app.getPath('userData');
  }

  /**
   * Get the path to the database file
   * @returns {string} Database file path
   */
  getDatabasePath() {
    return this.databaseManager.getDatabasePath();
  }

  /**
   * Save a project to the database
   * @param {Object} project - Project object to save
   * @param {string} project.id - Unique project identifier
   * @param {string} project.name - Project name
   * @param {string} project.workingDirectory - Working directory path
   * @returns {Promise<Object>} Saved project object
   */
  async saveProject(project) {
    this._validateInitialized();
    this._validateProject(project);

    try {
      const now = new Date().toISOString();
      const projectData = {
        id: project.id,
        name: project.name.trim(),
        working_directory: project.workingDirectory,
        created_date: project.createdDate || now,
        last_modified: now
      };

      // Check if project already exists
      const existingProject = await this.loadProject(project.id);
      
      if (existingProject) {
        // Update existing project
        await this.databaseManager.executeNonQuery(
          `UPDATE projects SET 
           name = ?, 
           working_directory = ?, 
           last_modified = ? 
           WHERE id = ?`,
          [projectData.name, projectData.working_directory, projectData.last_modified, projectData.id]
        );
      } else {
        // Insert new project
        await this.databaseManager.executeNonQuery(
          `INSERT INTO projects (id, name, working_directory, created_date, last_modified) 
           VALUES (?, ?, ?, ?, ?)`,
          [projectData.id, projectData.name, projectData.working_directory, 
           projectData.created_date, projectData.last_modified]
        );
      }

      return await this.loadProject(project.id);
    } catch (error) {
      throw new Error(`Failed to save project: ${error.message}`);
    }
  }

  /**
   * Load a project from the database by ID
   * @param {string} projectId - Project ID to load
   * @returns {Promise<Object|null>} Project object or null if not found
   */
  async loadProject(projectId) {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      const results = await this.databaseManager.executeQuery(
        'SELECT * FROM projects WHERE id = ?',
        [projectId]
      );

      if (results.length === 0) {
        return null;
      }

      const project = results[0];
      return {
        id: project.id,
        name: project.name,
        workingDirectory: project.working_directory,
        createdDate: new Date(project.created_date),
        lastModified: new Date(project.last_modified)
      };
    } catch (error) {
      throw new Error(`Failed to load project: ${error.message}`);
    }
  }

  /**
   * Load all projects from the database
   * @returns {Promise<Array>} Array of project objects
   */
  async loadAllProjects() {
    this._validateInitialized();

    try {
      const results = await this.databaseManager.executeQuery(
        'SELECT * FROM projects ORDER BY last_modified DESC'
      );

      return results.map(project => ({
        id: project.id,
        name: project.name,
        workingDirectory: project.working_directory,
        createdDate: new Date(project.created_date),
        lastModified: new Date(project.last_modified)
      }));
    } catch (error) {
      throw new Error(`Failed to load projects: ${error.message}`);
    }
  }

  /**
   * Delete a project from the database
   * @param {string} projectId - Project ID to delete
   * @returns {Promise<boolean>} True if project was deleted
   */
  async deleteProject(projectId) {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      const result = await this.databaseManager.executeNonQuery(
        'DELETE FROM projects WHERE id = ?',
        [projectId]
      );

      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete project: ${error.message}`);
    }
  }

  /**
   * Save a source folder to the database
   * @param {Object} sourceFolder - Source folder object to save
   * @param {string} sourceFolder.id - Unique source folder identifier
   * @param {string} sourceFolder.projectId - Parent project ID
   * @param {string} sourceFolder.path - Folder path
   * @returns {Promise<Object>} Saved source folder object
   */
  async saveSourceFolder(sourceFolder) {
    this._validateInitialized();
    this._validateSourceFolder(sourceFolder);

    try {
      const now = new Date().toISOString();
      const sourceFolderData = {
        id: sourceFolder.id,
        project_id: sourceFolder.projectId,
        path: sourceFolder.path,
        added_date: sourceFolder.addedDate || now
      };

      // Check if source folder already exists
      const existingFolder = await this.loadSourceFolder(sourceFolder.id);
      
      if (existingFolder) {
        // Update existing source folder
        await this.databaseManager.executeNonQuery(
          `UPDATE source_folders SET 
           project_id = ?, 
           path = ? 
           WHERE id = ?`,
          [sourceFolderData.project_id, sourceFolderData.path, sourceFolderData.id]
        );
      } else {
        // Insert new source folder
        await this.databaseManager.executeNonQuery(
          `INSERT INTO source_folders (id, project_id, path, added_date) 
           VALUES (?, ?, ?, ?)`,
          [sourceFolderData.id, sourceFolderData.project_id, 
           sourceFolderData.path, sourceFolderData.added_date]
        );
      }

      return await this.loadSourceFolder(sourceFolder.id);
    } catch (error) {
      throw new Error(`Failed to save source folder: ${error.message}`);
    }
  }

  /**
   * Load a source folder from the database by ID
   * @param {string} sourceFolderId - Source folder ID to load
   * @returns {Promise<Object|null>} Source folder object or null if not found
   */
  async loadSourceFolder(sourceFolderId) {
    this._validateInitialized();
    
    if (!sourceFolderId || typeof sourceFolderId !== 'string') {
      throw new Error('Source folder ID must be a non-empty string');
    }

    try {
      const results = await this.databaseManager.executeQuery(
        'SELECT * FROM source_folders WHERE id = ?',
        [sourceFolderId]
      );

      if (results.length === 0) {
        return null;
      }

      const folder = results[0];
      return {
        id: folder.id,
        projectId: folder.project_id,
        path: folder.path,
        addedDate: new Date(folder.added_date)
      };
    } catch (error) {
      throw new Error(`Failed to load source folder: ${error.message}`);
    }
  }

  /**
   * Load all source folders for a project
   * @param {string} projectId - Project ID to load source folders for
   * @returns {Promise<Array>} Array of source folder objects
   */
  async loadSourceFoldersForProject(projectId) {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      const results = await this.databaseManager.executeQuery(
        'SELECT * FROM source_folders WHERE project_id = ? ORDER BY added_date ASC',
        [projectId]
      );

      return results.map(folder => ({
        id: folder.id,
        projectId: folder.project_id,
        path: folder.path,
        addedDate: new Date(folder.added_date)
      }));
    } catch (error) {
      throw new Error(`Failed to load source folders for project: ${error.message}`);
    }
  }

  /**
   * Delete a source folder from the database
   * @param {string} sourceFolderId - Source folder ID to delete
   * @returns {Promise<boolean>} True if source folder was deleted
   */
  async deleteSourceFolder(sourceFolderId) {
    this._validateInitialized();
    
    if (!sourceFolderId || typeof sourceFolderId !== 'string') {
      throw new Error('Source folder ID must be a non-empty string');
    }

    try {
      const result = await this.databaseManager.executeNonQuery(
        'DELETE FROM source_folders WHERE id = ?',
        [sourceFolderId]
      );

      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete source folder: ${error.message}`);
    }
  }

  /**
   * Save a view to the database
   * @param {Object} view - View object to save
   * @param {string} view.id - Unique view identifier
   * @param {string} view.projectId - Parent project ID
   * @param {string} view.name - View name
   * @param {Object} [view.lastQuery] - Last applied query (optional)
   * @returns {Promise<Object>} Saved view object
   */
  async saveView(view) {
    this._validateInitialized();
    this._validateView(view);

    try {
      const now = new Date().toISOString();
      const viewData = {
        id: view.id,
        project_id: view.projectId,
        name: view.name.trim(),
        created_date: view.createdDate || now,
        last_modified: now,
        last_query: view.lastQuery ? JSON.stringify(view.lastQuery) : null
      };

      // Check if view already exists
      const existingView = await this.loadView(view.id);
      
      if (existingView) {
        // Update existing view
        await this.databaseManager.executeNonQuery(
          `UPDATE views SET 
           project_id = ?, 
           name = ?, 
           last_modified = ?,
           last_query = ?
           WHERE id = ?`,
          [viewData.project_id, viewData.name, viewData.last_modified, 
           viewData.last_query, viewData.id]
        );
      } else {
        // Insert new view
        await this.databaseManager.executeNonQuery(
          `INSERT INTO views (id, project_id, name, created_date, last_modified, last_query) 
           VALUES (?, ?, ?, ?, ?, ?)`,
          [viewData.id, viewData.project_id, viewData.name, 
           viewData.created_date, viewData.last_modified, viewData.last_query]
        );
      }

      return await this.loadView(view.id);
    } catch (error) {
      throw new Error(`Failed to save view: ${error.message}`);
    }
  }

  /**
   * Load a view from the database by ID
   * @param {string} viewId - View ID to load
   * @returns {Promise<Object|null>} View object or null if not found
   */
  async loadView(viewId) {
    this._validateInitialized();
    
    if (!viewId || typeof viewId !== 'string') {
      throw new Error('View ID must be a non-empty string');
    }

    try {
      const results = await this.databaseManager.executeQuery(
        'SELECT * FROM views WHERE id = ?',
        [viewId]
      );

      if (results.length === 0) {
        return null;
      }

      const view = results[0];
      return {
        id: view.id,
        projectId: view.project_id,
        name: view.name,
        createdDate: new Date(view.created_date),
        lastModified: new Date(view.last_modified),
        lastQuery: view.last_query ? JSON.parse(view.last_query) : null
      };
    } catch (error) {
      throw new Error(`Failed to load view: ${error.message}`);
    }
  }

  /**
   * Load all views for a project
   * @param {string} projectId - Project ID to load views for
   * @returns {Promise<Array>} Array of view objects
   */
  async loadViewsForProject(projectId) {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      const results = await this.databaseManager.executeQuery(
        'SELECT * FROM views WHERE project_id = ? ORDER BY last_modified DESC',
        [projectId]
      );

      return results.map(view => ({
        id: view.id,
        projectId: view.project_id,
        name: view.name,
        createdDate: new Date(view.created_date),
        lastModified: new Date(view.last_modified),
        lastQuery: view.last_query ? JSON.parse(view.last_query) : null
      }));
    } catch (error) {
      throw new Error(`Failed to load views for project: ${error.message}`);
    }
  }

  /**
   * Delete a view from the database
   * @param {string} viewId - View ID to delete
   * @returns {Promise<boolean>} True if view was deleted
   */
  async deleteView(viewId) {
    this._validateInitialized();
    
    if (!viewId || typeof viewId !== 'string') {
      throw new Error('View ID must be a non-empty string');
    }

    try {
      const result = await this.databaseManager.executeNonQuery(
        'DELETE FROM views WHERE id = ?',
        [viewId]
      );

      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete view: ${error.message}`);
    }
  }

  /**
   * Check if a project name already exists (case-insensitive)
   * @param {string} projectName - Project name to check
   * @param {string} [excludeProjectId] - Project ID to exclude from check (for updates)
   * @returns {Promise<boolean>} True if name exists
   */
  async projectNameExists(projectName, excludeProjectId = null) {
    this._validateInitialized();
    
    if (!projectName || typeof projectName !== 'string') {
      throw new Error('Project name must be a non-empty string');
    }

    try {
      let query = 'SELECT COUNT(*) as count FROM projects WHERE LOWER(name) = LOWER(?)';
      let params = [projectName.trim()];

      if (excludeProjectId) {
        query += ' AND id != ?';
        params.push(excludeProjectId);
      }

      const results = await this.databaseManager.executeQuery(query, params);
      return results[0].count > 0;
    } catch (error) {
      throw new Error(`Failed to check project name existence: ${error.message}`);
    }
  }

  /**
   * Check if a view name already exists within a project (case-insensitive)
   * @param {string} projectId - Project ID to check within
   * @param {string} viewName - View name to check
   * @param {string} [excludeViewId] - View ID to exclude from check (for updates)
   * @returns {Promise<boolean>} True if name exists
   */
  async viewNameExistsInProject(projectId, viewName, excludeViewId = null) {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }
    if (!viewName || typeof viewName !== 'string') {
      throw new Error('View name must be a non-empty string');
    }

    try {
      let query = 'SELECT COUNT(*) as count FROM views WHERE project_id = ? AND LOWER(name) = LOWER(?)';
      let params = [projectId, viewName.trim()];

      if (excludeViewId) {
        query += ' AND id != ?';
        params.push(excludeViewId);
      }

      const results = await this.databaseManager.executeQuery(query, params);
      return results[0].count > 0;
    } catch (error) {
      throw new Error(`Failed to check view name existence: ${error.message}`);
    }
  }

  /**
   * Close the database connection
   * @returns {Promise<void>}
   */
  async close() {
    if (this.databaseManager) {
      await this.databaseManager.closeDatabase();
    }
    this.isInitialized = false;
  }

  /**
   * Validate that the persistence layer is initialized
   * @private
   */
  _validateInitialized() {
    if (!this.isInitialized) {
      throw new Error('DataPersistence not initialized. Call initialize() first.');
    }
  }

  /**
   * Validate project object structure
   * @param {Object} project - Project object to validate
   * @private
   */
  _validateProject(project) {
    if (!project || typeof project !== 'object') {
      throw new Error('Project must be an object');
    }
    if (!project.id || typeof project.id !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }
    if (!project.name || typeof project.name !== 'string' || project.name.trim().length === 0) {
      throw new Error('Project name must be a non-empty string');
    }
    if (!project.workingDirectory || typeof project.workingDirectory !== 'string') {
      throw new Error('Project working directory must be a non-empty string');
    }
  }

  /**
   * Validate source folder object structure
   * @param {Object} sourceFolder - Source folder object to validate
   * @private
   */
  _validateSourceFolder(sourceFolder) {
    if (!sourceFolder || typeof sourceFolder !== 'object') {
      throw new Error('Source folder must be an object');
    }
    if (!sourceFolder.id || typeof sourceFolder.id !== 'string') {
      throw new Error('Source folder ID must be a non-empty string');
    }
    if (!sourceFolder.projectId || typeof sourceFolder.projectId !== 'string') {
      throw new Error('Source folder project ID must be a non-empty string');
    }
    if (!sourceFolder.path || typeof sourceFolder.path !== 'string') {
      throw new Error('Source folder path must be a non-empty string');
    }
  }

  /**
   * Validate view object structure
   * @param {Object} view - View object to validate
   * @private
   */
  _validateView(view) {
    if (!view || typeof view !== 'object') {
      throw new Error('View must be an object');
    }
    if (!view.id || typeof view.id !== 'string') {
      throw new Error('View ID must be a non-empty string');
    }
    if (!view.projectId || typeof view.projectId !== 'string') {
      throw new Error('View project ID must be a non-empty string');
    }
    if (!view.name || typeof view.name !== 'string' || view.name.trim().length === 0) {
      throw new Error('View name must be a non-empty string');
    }
  }
}

module.exports = DataPersistence;