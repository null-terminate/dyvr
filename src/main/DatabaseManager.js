const sqlite3 = require('sqlite3').verbose();
const path = require('path');
const fs = require('fs');
const { app } = require('electron');

/**
 * DatabaseManager handles SQLite database operations for the project manager application.
 * Provides methods for database initialization, connection management, and query execution.
 */
class DatabaseManager {
  constructor() {
    this.db = null;
    this.isInitialized = false;
  }

  /**
   * Initialize the database connection and create the database file if it doesn't exist
   * @returns {Promise<void>}
   */
  async initializeDatabase() {
    return new Promise((resolve, reject) => {
      try {
        const dbPath = this.getDatabasePath();

        // Ensure the data directory exists
        const dataDir = path.dirname(dbPath);
        if (!fs.existsSync(dataDir)) {
          fs.mkdirSync(dataDir, { recursive: true });
        }

        this.db = new sqlite3.Database(dbPath, (err) => {
          if (err) {
            reject(new Error(`Failed to initialize database: ${err.message}`));
            return;
          }

          this.isInitialized = true;
          resolve();
        });
      } catch (error) {
        reject(new Error(`Database initialization error: ${error.message}`));
      }
    });
  }

  /**
   * Get the path where the database file should be stored
   * @returns {string} Database file path
   */
  getDatabasePath() {
    const userDataPath = app.getPath('userData');
    return path.join(userDataPath, 'project-manager.db');
  }

  /**
   * Execute a SQL query with optional parameters
   * @param {string} sql - SQL query string
   * @param {Array} params - Query parameters (optional)
   * @returns {Promise<any>} Query results
   */
  async executeQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.isInitialized || !this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.all(sql, params, (err, rows) => {
        if (err) {
          reject(new Error(`Query execution failed: ${err.message}`));
          return;
        }
        resolve(rows);
      });
    });
  }

  /**
   * Execute a SQL query that doesn't return results (INSERT, UPDATE, DELETE)
   * @param {string} sql - SQL query string
   * @param {Array} params - Query parameters (optional)
   * @returns {Promise<object>} Result with lastID and changes count
   */
  async executeNonQuery(sql, params = []) {
    return new Promise((resolve, reject) => {
      if (!this.isInitialized || !this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      this.db.run(sql, params, function (err) {
        if (err) {
          reject(new Error(`Non-query execution failed: ${err.message}`));
          return;
        }
        resolve({
          lastID: this.lastID,
          changes: this.changes
        });
      });
    });
  }

  /**
   * Execute multiple SQL statements in a transaction
   * @param {Array<{sql: string, params: Array}>} statements - Array of SQL statements with parameters
   * @returns {Promise<Array>} Array of results for each statement
   */
  async executeTransaction(statements) {
    return new Promise((resolve, reject) => {
      if (!this.isInitialized || !this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const db = this.db; // Capture reference to avoid context issues

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const results = [];
        let completed = 0;
        let hasError = false;

        if (statements.length === 0) {
          db.run('COMMIT');
          resolve([]);
          return;
        }

        statements.forEach((statement, index) => {
          if (hasError) return;

          db.run(statement.sql, statement.params || [], function (err) {
            if (err && !hasError) {
              hasError = true;
              db.run('ROLLBACK');
              reject(new Error(`Transaction failed at statement ${index}: ${err.message}`));
              return;
            }

            if (!hasError) {
              results[index] = {
                lastID: this.lastID,
                changes: this.changes
              };
              completed++;

              if (completed === statements.length) {
                db.run('COMMIT', (commitErr) => {
                  if (commitErr) {
                    reject(new Error(`Transaction commit failed: ${commitErr.message}`));
                    return;
                  }
                  resolve(results);
                });
              }
            }
          });
        });
      });
    });
  }

  /**
   * Check if the database connection is active
   * @returns {boolean} True if database is initialized and connected
   */
  isConnected() {
    return this.isInitialized && this.db !== null;
  }

  /**
   * Initialize the application metadata schema
   * Creates the projects, source_folders, and views tables
   * @returns {Promise<void>}
   */
  async initializeSchema() {
    const schemaStatements = [
      {
        sql: `CREATE TABLE IF NOT EXISTS projects (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          working_directory TEXT NOT NULL,
          created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_modified DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS source_folders (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          path TEXT NOT NULL,
          added_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )`
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS views (
          id TEXT PRIMARY KEY,
          project_id TEXT NOT NULL,
          name TEXT NOT NULL,
          created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_query TEXT,
          FOREIGN KEY (project_id) REFERENCES projects(id) ON DELETE CASCADE
        )`
      }
    ];

    await this.executeTransaction(schemaStatements);
  }

  /**
   * Validate that the database schema exists and is correct
   * @returns {Promise<boolean>} True if schema is valid
   */
  async validateSchema() {
    try {
      const requiredTables = ['projects', 'source_folders', 'views'];

      for (const tableName of requiredTables) {
        const result = await this.executeQuery(
          "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
          [tableName]
        );

        if (result.length === 0) {
          return false;
        }
      }

      // Validate table structures
      const projectsColumns = await this.executeQuery("PRAGMA table_info(projects)");
      const expectedProjectsColumns = ['id', 'name', 'working_directory', 'created_date', 'last_modified'];
      const actualProjectsColumns = projectsColumns.map(col => col.name);

      for (const expectedCol of expectedProjectsColumns) {
        if (!actualProjectsColumns.includes(expectedCol)) {
          return false;
        }
      }

      const sourceFoldersColumns = await this.executeQuery("PRAGMA table_info(source_folders)");
      const expectedSourceFoldersColumns = ['id', 'project_id', 'path', 'added_date'];
      const actualSourceFoldersColumns = sourceFoldersColumns.map(col => col.name);

      for (const expectedCol of expectedSourceFoldersColumns) {
        if (!actualSourceFoldersColumns.includes(expectedCol)) {
          return false;
        }
      }

      const viewsColumns = await this.executeQuery("PRAGMA table_info(views)");
      const expectedViewsColumns = ['id', 'project_id', 'name', 'created_date', 'last_modified', 'last_query'];
      const actualViewsColumns = viewsColumns.map(col => col.name);

      for (const expectedCol of expectedViewsColumns) {
        if (!actualViewsColumns.includes(expectedCol)) {
          return false;
        }
      }

      return true;
    } catch (error) {
      return false;
    }
  }

  /**
   * Create a dynamic data table for a view
   * @param {string} viewId - The view ID
   * @param {Array<{name: string, type: string}>} columns - Column definitions
   * @returns {Promise<void>}
   */
  async createDataTable(viewId, columns) {
    if (!viewId || !columns || columns.length === 0) {
      throw new Error('Invalid parameters for data table creation');
    }

    // Sanitize table name to prevent SQL injection and ensure valid SQLite identifier
    const sanitizedViewId = viewId.replace(/[^a-zA-Z0-9_]/g, '_');
    const tableName = `data_view_${sanitizedViewId}`;

    // Build column definitions
    const columnDefs = [
      '_id INTEGER PRIMARY KEY AUTOINCREMENT',
      '_source_file TEXT NOT NULL',
      '_scan_date DATETIME DEFAULT CURRENT_TIMESTAMP'
    ];

    columns.forEach(col => {
      if (!col.name || !col.type) {
        throw new Error('Column must have name and type');
      }

      // Sanitize column name to prevent SQL injection
      const sanitizedName = col.name.replace(/[^a-zA-Z0-9_]/g, '_');
      const validType = ['TEXT', 'INTEGER', 'REAL'].includes(col.type.toUpperCase()) ? col.type.toUpperCase() : 'TEXT';

      columnDefs.push(`${sanitizedName} ${validType}`);
    });

    const createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs.join(', ')})`;

    await this.executeNonQuery(createTableSQL);
  }

  /**
   * Drop a dynamic data table for a view
   * @param {string} viewId - The view ID
   * @returns {Promise<void>}
   */
  async dropDataTable(viewId) {
    if (!viewId) {
      throw new Error('View ID is required');
    }

    // Sanitize table name to prevent SQL injection and ensure valid SQLite identifier
    const sanitizedViewId = viewId.replace(/[^a-zA-Z0-9_]/g, '_');
    const tableName = `data_view_${sanitizedViewId}`;
    await this.executeNonQuery(`DROP TABLE IF EXISTS ${tableName}`);
  }

  /**
   * Get the schema information for a data table
   * @param {string} viewId - The view ID
   * @returns {Promise<Array>} Array of column information
   */
  async getDataTableSchema(viewId) {
    if (!viewId) {
      throw new Error('View ID is required');
    }

    // Sanitize table name to prevent SQL injection and ensure valid SQLite identifier
    const sanitizedViewId = viewId.replace(/[^a-zA-Z0-9_]/g, '_');
    const tableName = `data_view_${sanitizedViewId}`;

    try {
      const columns = await this.executeQuery(`PRAGMA table_info(${tableName})`);
      return columns.filter(col => !col.name.startsWith('_')); // Filter out internal columns
    } catch (error) {
      if (error.message.includes('no such table')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Check if a data table exists for a view
   * @param {string} viewId - The view ID
   * @returns {Promise<boolean>} True if table exists
   */
  async dataTableExists(viewId) {
    if (!viewId) {
      return false;
    }

    // Sanitize table name to prevent SQL injection and ensure valid SQLite identifier
    const sanitizedViewId = viewId.replace(/[^a-zA-Z0-9_]/g, '_');
    const tableName = `data_view_${sanitizedViewId}`;

    try {
      const result = await this.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name=?",
        [tableName]
      );
      return result.length > 0;
    } catch (error) {
      return false;
    }
  }

  /**
   * Close the database connection
   * @returns {Promise<void>}
   */
  async closeDatabase() {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          reject(new Error(`Failed to close database: ${err.message}`));
          return;
        }

        this.db = null;
        this.isInitialized = false;
        resolve();
      });
    });
  }
}

module.exports = DatabaseManager;