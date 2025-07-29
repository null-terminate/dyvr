const { v4: uuidv4 } = require('uuid');
const DatabaseManager = require('./DatabaseManager');

/**
 * ViewManager handles view CRUD operations with per-project database integration.
 * Each project maintains its own SQLite database with views stored in the project's .digr folder.
 * This provides project-level data isolation and portability.
 */
class ViewManager {
  constructor() {
    this.projectDatabases = new Map(); // Cache of DatabaseManager instances by project working directory
    this.isInitialized = false;
  }

  /**
   * Initialize the view manager
   * @returns {Promise<void>}
   */
  async initialize() {
    try {
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize ViewManager: ${error.message}`);
    }
  }

  /**
   * Get or create a DatabaseManager instance for a project
   * @param {string} projectWorkingDirectory - Project's working directory
   * @returns {Promise<DatabaseManager>} DatabaseManager instance
   * @private
   */
  async _getProjectDatabase(projectWorkingDirectory) {
    if (!projectWorkingDirectory || typeof projectWorkingDirectory !== 'string') {
      throw new Error('Project working directory must be a non-empty string');
    }

    // Check if we already have a database manager for this project
    if (this.projectDatabases.has(projectWorkingDirectory)) {
      const dbManager = this.projectDatabases.get(projectWorkingDirectory);
      if (dbManager.isConnected()) {
        return dbManager;
      }
    }

    // Create new database manager and open the project database
    const dbManager = new DatabaseManager(projectWorkingDirectory);
    await dbManager.openProjectDatabase(projectWorkingDirectory);
    
    // Cache the database manager
    this.projectDatabases.set(projectWorkingDirectory, dbManager);
    
    return dbManager;
  }

  /**
   * Create a new view within a project
   * @param {string} projectWorkingDirectory - Project's working directory
   * @param {string} viewName - Name for the new view
   * @returns {Promise<Object>} Created view object
   */
  async createView(projectWorkingDirectory, viewName) {
    this._validateInitialized();
    this._validateViewName(viewName);

    try {
      const dbManager = await this._getProjectDatabase(projectWorkingDirectory);

      // Check if view name already exists in this project
      const nameExists = await this.viewNameExists(projectWorkingDirectory, viewName);
      if (nameExists) {
        throw new Error(`View name "${viewName}" already exists in this project. Please choose a different name.`);
      }

      // Create view object
      const view = {
        id: uuidv4(),
        name: viewName.trim(),
        createdDate: new Date(),
        lastModified: new Date(),
        lastQuery: null
      };

      // Save to project database
      await dbManager.executeNonQuery(
        `INSERT INTO views (id, name, created_date, last_modified, last_query) 
         VALUES (?, ?, ?, ?, ?)`,
        [view.id, view.name, view.createdDate.toISOString(), 
         view.lastModified.toISOString(), view.lastQuery]
      );

      return view;
    } catch (error) {
      if (error.message.includes('already exists')) {
        throw error;
      }
      throw new Error(`Failed to create view: ${error.message}`);
    }
  }

  /**
   * Get a view by ID from a project
   * @param {string} projectWorkingDirectory - Project's working directory
   * @param {string} viewId - View ID to retrieve
   * @returns {Promise<Object|null>} View object or null if not found
   */
  async getView(projectWorkingDirectory, viewId) {
    this._validateInitialized();
    
    if (!viewId || typeof viewId !== 'string') {
      throw new Error('View ID must be a non-empty string');
    }

    try {
      const dbManager = await this._getProjectDatabase(projectWorkingDirectory);

      const results = await dbManager.executeQuery(
        'SELECT * FROM views WHERE id = ?',
        [viewId]
      );

      if (results.length === 0) {
        return null;
      }

      const view = results[0];
      return {
        id: view.id,
        name: view.name,
        createdDate: new Date(view.created_date),
        lastModified: new Date(view.last_modified),
        lastQuery: view.last_query ? JSON.parse(view.last_query) : null
      };
    } catch (error) {
      throw new Error(`Failed to get view: ${error.message}`);
    }
  }

  /**
   * Get all views for a project
   * @param {string} projectWorkingDirectory - Project's working directory
   * @returns {Promise<Array>} Array of view objects
   */
  async getViewsForProject(projectWorkingDirectory) {
    this._validateInitialized();

    try {
      const dbManager = await this._getProjectDatabase(projectWorkingDirectory);

      const results = await dbManager.executeQuery(
        'SELECT * FROM views ORDER BY last_modified DESC'
      );

      return results.map(view => ({
        id: view.id,
        name: view.name,
        createdDate: new Date(view.created_date),
        lastModified: new Date(view.last_modified),
        lastQuery: view.last_query ? JSON.parse(view.last_query) : null
      }));
    } catch (error) {
      throw new Error(`Failed to get views for project: ${error.message}`);
    }
  }

  /**
   * Update a view
   * @param {string} projectWorkingDirectory - Project's working directory
   * @param {string} viewId - View ID to update
   * @param {Object} updates - Updates to apply
   * @param {string} [updates.name] - New view name
   * @param {Object} [updates.lastQuery] - Last applied query
   * @returns {Promise<Object>} Updated view object
   */
  async updateView(projectWorkingDirectory, viewId, updates) {
    this._validateInitialized();
    
    if (!viewId || typeof viewId !== 'string') {
      throw new Error('View ID must be a non-empty string');
    }
    
    if (!updates || typeof updates !== 'object') {
      throw new Error('Updates must be an object');
    }

    try {
      const dbManager = await this._getProjectDatabase(projectWorkingDirectory);

      // Load existing view
      const existingView = await this.getView(projectWorkingDirectory, viewId);
      if (!existingView) {
        throw new Error(`View with ID "${viewId}" not found`);
      }

      // Validate and prepare updates
      const updatedView = { ...existingView };

      if (updates.name !== undefined) {
        this._validateViewName(updates.name);
        
        // Check if new name conflicts with existing views (excluding current view)
        const nameExists = await this.viewNameExists(projectWorkingDirectory, updates.name, viewId);
        if (nameExists) {
          throw new Error(`View name "${updates.name}" already exists in this project. Please choose a different name.`);
        }
        
        updatedView.name = updates.name.trim();
      }

      if (updates.lastQuery !== undefined) {
        updatedView.lastQuery = updates.lastQuery;
      }

      updatedView.lastModified = new Date();

      // Save updated view
      await dbManager.executeNonQuery(
        `UPDATE views SET 
         name = ?, 
         last_modified = ?,
         last_query = ?
         WHERE id = ?`,
        [updatedView.name, updatedView.lastModified.toISOString(), 
         updatedView.lastQuery ? JSON.stringify(updatedView.lastQuery) : null, viewId]
      );

      return updatedView;
    } catch (error) {
      if (error.message.includes('not found') || error.message.includes('already exists')) {
        throw error;
      }
      throw new Error(`Failed to update view: ${error.message}`);
    }
  }

  /**
   * Delete a view and its associated data table
   * @param {string} projectWorkingDirectory - Project's working directory
   * @param {string} viewId - View ID to delete
   * @returns {Promise<boolean>} True if view was deleted
   */
  async deleteView(projectWorkingDirectory, viewId) {
    this._validateInitialized();
    
    if (!viewId || typeof viewId !== 'string') {
      throw new Error('View ID must be a non-empty string');
    }

    try {
      const dbManager = await this._getProjectDatabase(projectWorkingDirectory);

      // Verify view exists
      const existingView = await this.getView(projectWorkingDirectory, viewId);
      if (!existingView) {
        return false;
      }

      // Delete associated data table first (if it exists)
      try {
        await dbManager.dropDataTable(viewId);
      } catch (error) {
        // Ignore errors if data table doesn't exist
        console.warn(`Warning: Could not drop data table for view ${viewId}: ${error.message}`);
      }

      // Delete view record
      const result = await dbManager.executeNonQuery(
        'DELETE FROM views WHERE id = ?',
        [viewId]
      );

      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete view: ${error.message}`);
    }
  }

  /**
   * Check if a view name exists within a project
   * @param {string} projectWorkingDirectory - Project's working directory
   * @param {string} viewName - View name to check
   * @param {string} [excludeViewId] - View ID to exclude from check (for updates)
   * @returns {Promise<boolean>} True if name exists
   */
  async viewNameExists(projectWorkingDirectory, viewName, excludeViewId = null) {
    this._validateInitialized();
    this._validateViewName(viewName);

    try {
      const dbManager = await this._getProjectDatabase(projectWorkingDirectory);

      let query = 'SELECT COUNT(*) as count FROM views WHERE LOWER(name) = LOWER(?)';
      let params = [viewName.trim()];

      if (excludeViewId) {
        query += ' AND id != ?';
        params.push(excludeViewId);
      }

      const results = await dbManager.executeQuery(query, params);
      return results[0].count > 0;
    } catch (error) {
      throw new Error(`Failed to check view name existence: ${error.message}`);
    }
  }

  /**
   * Check if a view name is available within a project
   * @param {string} projectWorkingDirectory - Project's working directory
   * @param {string} viewName - View name to check
   * @param {string} [excludeViewId] - View ID to exclude from check
   * @returns {Promise<boolean>} True if name is available
   */
  async isViewNameAvailable(projectWorkingDirectory, viewName, excludeViewId = null) {
    this._validateInitialized();
    this._validateViewName(viewName);

    try {
      const exists = await this.viewNameExists(projectWorkingDirectory, viewName, excludeViewId);
      return !exists;
    } catch (error) {
      throw new Error(`Failed to check view name availability: ${error.message}`);
    }
  }

  /**
   * Get the data table schema for a view
   * @param {string} projectWorkingDirectory - Project's working directory
   * @param {string} viewId - View ID
   * @returns {Promise<Array>} Array of column information
   */
  async getViewDataSchema(projectWorkingDirectory, viewId) {
    this._validateInitialized();
    
    if (!viewId || typeof viewId !== 'string') {
      throw new Error('View ID must be a non-empty string');
    }

    try {
      const dbManager = await this._getProjectDatabase(projectWorkingDirectory);
      return await dbManager.getDataTableSchema(viewId);
    } catch (error) {
      throw new Error(`Failed to get view data schema: ${error.message}`);
    }
  }

  /**
   * Check if a view has an associated data table
   * @param {string} projectWorkingDirectory - Project's working directory
   * @param {string} viewId - View ID
   * @returns {Promise<boolean>} True if data table exists
   */
  async viewHasDataTable(projectWorkingDirectory, viewId) {
    this._validateInitialized();
    
    if (!viewId || typeof viewId !== 'string') {
      throw new Error('View ID must be a non-empty string');
    }

    try {
      const dbManager = await this._getProjectDatabase(projectWorkingDirectory);
      return await dbManager.dataTableExists(viewId);
    } catch (error) {
      throw new Error(`Failed to check if view has data table: ${error.message}`);
    }
  }

  /**
   * Close database connections for a specific project
   * @param {string} projectWorkingDirectory - Project's working directory
   * @returns {Promise<void>}
   */
  async closeProjectDatabase(projectWorkingDirectory) {
    if (!projectWorkingDirectory || typeof projectWorkingDirectory !== 'string') {
      return;
    }

    try {
      if (this.projectDatabases.has(projectWorkingDirectory)) {
        const dbManager = this.projectDatabases.get(projectWorkingDirectory);
        await dbManager.closeProjectDatabase();
        this.projectDatabases.delete(projectWorkingDirectory);
      }
    } catch (error) {
      console.warn(`Warning: Failed to close project database for ${projectWorkingDirectory}: ${error.message}`);
    }
  }

  /**
   * Close all database connections and cleanup resources
   * @returns {Promise<void>}
   */
  async close() {
    try {
      // Close all cached database connections
      const closePromises = [];
      for (const [projectDir, dbManager] of this.projectDatabases) {
        closePromises.push(
          dbManager.closeProjectDatabase().catch(error => 
            console.warn(`Warning: Failed to close database for ${projectDir}: ${error.message}`)
          )
        );
      }
      
      await Promise.all(closePromises);
      this.projectDatabases.clear();
      this.isInitialized = false;
    } catch (error) {
      console.warn(`Warning: Error during ViewManager cleanup: ${error.message}`);
      this.isInitialized = false;
    }
  }

  /**
   * Validate that the view manager is initialized
   * @private
   */
  _validateInitialized() {
    if (!this.isInitialized) {
      throw new Error('ViewManager not initialized. Call initialize() first.');
    }
  }

  /**
   * Validate view name
   * @param {string} name - View name to validate
   * @private
   */
  _validateViewName(name) {
    if (name === null || name === undefined || typeof name !== 'string') {
      throw new Error('View name must be a non-empty string');
    }
    
    const trimmedName = name.trim();
    if (trimmedName.length === 0) {
      throw new Error('View name cannot be empty or only whitespace');
    }
    
    if (trimmedName.length > 255) {
      throw new Error('View name cannot exceed 255 characters');
    }
    
    // Check for invalid characters that might cause issues with databases or file systems
    const invalidChars = /[<>:"/\\|?*\x00-\x1f]/;
    if (invalidChars.test(trimmedName)) {
      throw new Error('View name contains invalid characters');
    }
  }
}

module.exports = ViewManager;