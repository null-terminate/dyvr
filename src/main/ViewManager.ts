import { v4 as uuidv4 } from 'uuid';
import { View, QueryModel } from '../types';
import { DatabaseManager } from './DatabaseManager';

interface ViewUpdateData {
  name?: string;
  lastQuery?: QueryModel | null;
}

/**
 * ViewManager handles view CRUD operations with per-project database integration.
 * Each project maintains its own SQLite database with views stored in the project's config folder.
 * This provides project-level data isolation and portability.
 */
export class ViewManager {
  private projectDatabases: Map<string, DatabaseManager> = new Map();
  private isInitialized: boolean = false;

  /**
   * Initialize the view manager
   */
  async initialize(): Promise<void> {
    try {
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize ViewManager: ${(error as Error).message}`);
    }
  }

  /**
   * Get or create a DatabaseManager instance for a project
   */
  private async _getProjectDatabase(projectWorkingDirectory: string): Promise<DatabaseManager> {
    if (!projectWorkingDirectory || typeof projectWorkingDirectory !== 'string') {
      throw new Error('Project working directory must be a non-empty string');
    }

    // Check if we already have a database manager for this project
    if (this.projectDatabases.has(projectWorkingDirectory)) {
      const dbManager = this.projectDatabases.get(projectWorkingDirectory)!;
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
   */
  async createView(projectWorkingDirectory: string, viewName: string): Promise<View> {
    return this.createViewInProject(projectWorkingDirectory, viewName);
  }

  /**
   * Create a new view within a project using working directory
   */
  async createViewInProject(projectWorkingDirectory: string, viewName: string): Promise<View> {
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
      const view: View = {
        id: uuidv4(),
        projectId: '', // Would be set by caller
        name: viewName.trim(),
        createdDate: new Date(),
        lastModified: new Date(),
        tableSchema: []
      };

      // Save to project database
      await dbManager.executeNonQuery(
        `INSERT INTO views (id, name, created_date, last_modified, last_query) 
         VALUES (?, ?, ?, ?, ?)`,
        [view.id, view.name, view.createdDate.toISOString(), 
         view.lastModified.toISOString(), null]
      );

      return view;
    } catch (error) {
      if ((error as Error).message.includes('already exists')) {
        throw error;
      }
      throw new Error(`Failed to create view: ${(error as Error).message}`);
    }
  }

  /**
   * Get a view by ID from a project
   */
  async getView(projectWorkingDirectory: string, viewId: string): Promise<View | null> {
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
        projectId: '', // Would need to be determined from context
        name: view.name,
        createdDate: new Date(view.created_date),
        lastModified: new Date(view.last_modified),
        lastQuery: view.last_query ? JSON.parse(view.last_query) : undefined,
        tableSchema: [] // Would be populated from data table schema
      };
    } catch (error) {
      throw new Error(`Failed to get view: ${(error as Error).message}`);
    }
  }

  /**
   * Get all views for a project
   */
  async getViews(projectId: string): Promise<View[]> {
    this._validateInitialized();
    // This method signature matches the design, but needs project working directory
    throw new Error('getViews method needs to be implemented with project working directory lookup');
  }

  /**
   * Get all views for a project using working directory
   */
  async getViewsForProject(projectWorkingDirectory: string): Promise<View[]> {
    this._validateInitialized();

    try {
      const dbManager = await this._getProjectDatabase(projectWorkingDirectory);

      const results = await dbManager.executeQuery(
        'SELECT * FROM views ORDER BY last_modified DESC'
      );

      return results.map(view => ({
        id: view.id,
        projectId: '', // Would need to be determined from context
        name: view.name,
        createdDate: new Date(view.created_date),
        lastModified: new Date(view.last_modified),
        lastQuery: view.last_query ? JSON.parse(view.last_query) : undefined,
        tableSchema: [] // Would be populated from data table schema
      }));
    } catch (error) {
      throw new Error(`Failed to get views for project: ${(error as Error).message}`);
    }
  }

  /**
   * Update a view
   */
  async updateView(projectWorkingDirectory: string, viewId: string, updates: ViewUpdateData): Promise<View> {
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
        if (updates.lastQuery === null) {
          updatedView.lastQuery = undefined;
        } else {
          updatedView.lastQuery = updates.lastQuery;
        }
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
      if ((error as Error).message.includes('not found') || (error as Error).message.includes('already exists')) {
        throw error;
      }
      throw new Error(`Failed to update view: ${(error as Error).message}`);
    }
  }

  /**
   * Delete a view and its associated data table
   */
  async deleteView(projectWorkingDirectory: string, viewId: string): Promise<boolean> {
    return this.deleteViewInProject(projectWorkingDirectory, viewId);
  }

  /**
   * Delete a view and its associated data table using working directory
   */
  async deleteViewInProject(projectWorkingDirectory: string, viewId: string): Promise<boolean> {
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
      const hasDataTable = await dbManager.dataTableExists(viewId);
      if (hasDataTable) {
        try {
          await dbManager.dropDataTable(viewId);
        } catch (error) {
          // Only log warning in non-test environments
          if (process.env['NODE_ENV'] !== 'test') {
            console.warn(`Warning: Could not drop data table for view ${viewId}: ${(error as Error).message}`);
          }
        }
      }

      // Delete view record
      const result = await dbManager.executeNonQuery(
        'DELETE FROM views WHERE id = ?',
        [viewId]
      );

      return result.changes > 0;
    } catch (error) {
      throw new Error(`Failed to delete view: ${(error as Error).message}`);
    }
  }

  /**
   * Check if a view name exists within a project
   */
  async viewNameExists(projectWorkingDirectory: string, viewName: string, excludeViewId?: string): Promise<boolean> {
    this._validateInitialized();
    this._validateViewName(viewName);

    try {
      const dbManager = await this._getProjectDatabase(projectWorkingDirectory);

      let query = 'SELECT COUNT(*) as count FROM views WHERE LOWER(name) = LOWER(?)';
      let params: any[] = [viewName.trim()];

      if (excludeViewId) {
        query += ' AND id != ?';
        params.push(excludeViewId);
      }

      const results = await dbManager.executeQuery(query, params);
      return results[0].count > 0;
    } catch (error) {
      throw new Error(`Failed to check view name existence: ${(error as Error).message}`);
    }
  }

  /**
   * Check if a view name is available within a project
   */
  async isViewNameAvailable(projectWorkingDirectory: string, viewName: string, excludeViewId?: string): Promise<boolean> {
    this._validateInitialized();
    this._validateViewName(viewName);

    try {
      const exists = await this.viewNameExists(projectWorkingDirectory, viewName, excludeViewId);
      return !exists;
    } catch (error) {
      throw new Error(`Failed to check view name availability: ${(error as Error).message}`);
    }
  }

  /**
   * Get the data table schema for a view
   */
  async getViewDataSchema(projectWorkingDirectory: string, viewId: string): Promise<any[]> {
    this._validateInitialized();
    
    if (!viewId || typeof viewId !== 'string') {
      throw new Error('View ID must be a non-empty string');
    }

    try {
      const dbManager = await this._getProjectDatabase(projectWorkingDirectory);
      return await dbManager.getDataTableSchema(viewId);
    } catch (error) {
      throw new Error(`Failed to get view data schema: ${(error as Error).message}`);
    }
  }

  /**
   * Check if a view has an associated data table
   */
  async viewHasDataTable(projectWorkingDirectory: string, viewId: string): Promise<boolean> {
    this._validateInitialized();
    
    if (!viewId || typeof viewId !== 'string') {
      throw new Error('View ID must be a non-empty string');
    }

    try {
      const dbManager = await this._getProjectDatabase(projectWorkingDirectory);
      return await dbManager.dataTableExists(viewId);
    } catch (error) {
      throw new Error(`Failed to check if view has data table: ${(error as Error).message}`);
    }
  }

  /**
   * Save views (placeholder for interface compatibility)
   */
  async saveViews(): Promise<void> {
    this._validateInitialized();
    // Views are automatically saved to per-project databases, no global save needed
  }

  /**
   * Load views (placeholder for interface compatibility)
   */
  async loadViews(): Promise<void> {
    this._validateInitialized();
    // Views are loaded on-demand from per-project databases, no global load needed
  }

  /**
   * Close database connections for a specific project
   */
  async closeProjectDatabase(projectWorkingDirectory: string): Promise<void> {
    if (!projectWorkingDirectory || typeof projectWorkingDirectory !== 'string') {
      return;
    }

    try {
      if (this.projectDatabases.has(projectWorkingDirectory)) {
        const dbManager = this.projectDatabases.get(projectWorkingDirectory)!;
        await dbManager.closeProjectDatabase();
        this.projectDatabases.delete(projectWorkingDirectory);
      }
    } catch (error) {
      console.warn(`Warning: Failed to close project database for ${projectWorkingDirectory}: ${(error as Error).message}`);
    }
  }

  /**
   * Close all database connections and cleanup resources
   */
  async close(): Promise<void> {
    try {
      // Close all cached database connections
      const closePromises: Promise<void>[] = [];
      for (const [projectDir, dbManager] of this.projectDatabases) {
        closePromises.push(
          dbManager.closeProjectDatabase().catch(error => 
            console.warn(`Warning: Failed to close database for ${projectDir}: ${(error as Error).message}`)
          )
        );
      }
      
      await Promise.all(closePromises);
      this.projectDatabases.clear();
      this.isInitialized = false;
    } catch (error) {
      console.warn(`Warning: Error during ViewManager cleanup: ${(error as Error).message}`);
      this.isInitialized = false;
    }
  }

  /**
   * Validate that the view manager is initialized
   */
  private _validateInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('ViewManager not initialized. Call initialize() first.');
    }
  }

  /**
   * Validate view name
   */
  private _validateViewName(name: string): void {
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
