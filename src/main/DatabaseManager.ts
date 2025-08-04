import * as sqlite3 from 'sqlite3';
import * as path from 'path';
import * as fs from 'fs';
import { ColumnSchema } from '../types';

interface DatabaseResult {
  lastID: number;
  changes: number;
}

interface TransactionStatement {
  sql: string;
  params?: any[];
}

/**
 * DatabaseManager handles SQLite database operations for individual project databases.
 * Each project maintains its own SQLite database file located at {workingDirectory}/.digr/project.db
 * This provides project-level data isolation and portability.
 */
export class DatabaseManager {
  private projectWorkingDirectory: string;
  private db: sqlite3.Database | null = null;
  private isInitialized: boolean = false;
  private databasePath: string | null = null;

  constructor(projectWorkingDirectory: string) {
    this.projectWorkingDirectory = projectWorkingDirectory;
  }

  /**
   * Initialize the per-project database connection and create the database file if it doesn't exist
   * Creates the .digr folder in the project's working directory if it doesn't exist
   */
  async initializeProjectDatabase(projectId: string, projectName: string, workingDirectory: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (!projectId || !projectName || !workingDirectory) {
          console.error('DatabaseManager: Missing required parameters');
          reject(new Error('Project ID, name, and working directory are required'));
          return;
        }

        this.projectWorkingDirectory = workingDirectory;
        const dbPath = this.getDatabasePath(workingDirectory);
        this.databasePath = dbPath;

        // Ensure the .digr directory exists
        const digrDir = this.ensureDigrFolder(workingDirectory);
        if (!digrDir) {
          console.error(`DatabaseManager: Failed to create .digr folder at ${workingDirectory}`);
          reject(new Error('Failed to create .digr folder'));
          return;
        }

        this.db = new sqlite3.Database(dbPath, (err) => {
          if (err) {
            console.error(`DatabaseManager: Failed to initialize database: ${err.message}`);
            reject(new Error(`Failed to initialize project database: ${err.message}`));
            return;
          }

          this.isInitialized = true;
          resolve();
        });
      } catch (error) {
        console.error(`DatabaseManager: Initialization error: ${(error as Error).message}`);
        reject(new Error(`Project database initialization error: ${(error as Error).message}`));
      }
    });
  }

  /**
   * Open an existing per-project database connection
   */
  async openProjectDatabase(projectWorkingDirectory: string): Promise<void> {
    return new Promise((resolve, reject) => {
      try {
        if (!projectWorkingDirectory) {
          reject(new Error('Project working directory is required'));
          return;
        }

        this.projectWorkingDirectory = projectWorkingDirectory;
        const dbPath = this.getDatabasePath(projectWorkingDirectory);
        this.databasePath = dbPath;

        // Check if database file exists
        if (!fs.existsSync(dbPath)) {
          reject(new Error(`Project database does not exist at: ${dbPath}`));
          return;
        }

        this.db = new sqlite3.Database(dbPath, (err) => {
          if (err) {
            reject(new Error(`Failed to open project database: ${err.message}`));
            return;
          }

          this.isInitialized = true;
          resolve();
        });
      } catch (error) {
        reject(new Error(`Project database open error: ${(error as Error).message}`));
      }
    });
  }

  /**
   * Close the current project database connection
   */
  async closeProjectDatabase(): Promise<void> {
    return new Promise((resolve, reject) => {
      if (!this.db) {
        this.isInitialized = false;
        this.databasePath = null;
        resolve();
        return;
      }

      this.db.close((err) => {
        if (err) {
          reject(new Error(`Failed to close project database: ${err.message}`));
          return;
        }

        this.db = null;
        this.isInitialized = false;
        this.databasePath = null;
        resolve();
      });
    });
  }

  /**
   * Create and initialize the complete per-project database schema
   * This method combines schema creation and initial project data insertion
   */
  async createProjectSchema(projectId: string, projectName: string, workingDirectory: string): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Database must be initialized before creating schema');
    }

    // Create the schema tables
    await this.initializeSchema();

    // Insert the project information into the project_info table
    await this.executeNonQuery(
      'INSERT INTO project_info (id, name, working_directory) VALUES (?, ?, ?)',
      [projectId, projectName, workingDirectory]
    );
  }

  /**
   * Migrate the database schema to the latest version
   * This method handles schema updates and migrations for existing databases
   */
  async migrateSchema(): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Database must be initialized before migrating schema');
    }

    // Check current schema version (if we had versioning)
    // For now, we'll just ensure all required tables exist with correct structure
    const isValid = await this.validateSchema();
    
    if (!isValid) {
      // If schema is invalid, drop existing tables and recreate them
      try {
        // Drop existing tables if they exist (in reverse dependency order)
        await this.executeNonQuery('DROP TABLE IF EXISTS views');
        await this.executeNonQuery('DROP TABLE IF EXISTS source_folders');
        await this.executeNonQuery('DROP TABLE IF EXISTS project_info');
      } catch (error) {
        // Ignore errors when dropping tables that might not exist
      }
      
      // Recreate the schema
      await this.initializeSchema();
    }

    // Future migrations would go here
    // Example: ALTER TABLE statements for schema changes
  }

  /**
   * Get the current schema version of the database
   */
  async getSchemaVersion(): Promise<number> {
    try {
      // Check if we have a schema_version table (for future use)
      const result = await this.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
      );

      if (result.length === 0) {
        // No version table exists, assume version 1 (initial schema)
        return 1;
      }

      // Get the current version from the schema_version table
      const versionResult = await this.executeQuery('SELECT version FROM schema_version ORDER BY version DESC LIMIT 1');
      return versionResult.length > 0 ? versionResult[0].version : 1;
    } catch (error) {
      // If there's any error, assume version 1
      return 1;
    }
  }

  /**
   * Set the schema version in the database
   */
  async setSchemaVersion(version: number): Promise<void> {
    if (!this.isInitialized) {
      throw new Error('Database must be initialized before setting schema version');
    }

    // Create schema_version table if it doesn't exist
    await this.executeNonQuery(`
      CREATE TABLE IF NOT EXISTS schema_version (
        version INTEGER PRIMARY KEY,
        applied_date DATETIME DEFAULT CURRENT_TIMESTAMP
      )
    `);

    // Insert the new version
    await this.executeNonQuery(
      'INSERT INTO schema_version (version) VALUES (?)',
      [version]
    );
  }

  /**
   * Get the path where the project database file should be stored
   */
  getDatabasePath(workingDirectory?: string): string {
    if (!workingDirectory) {
      workingDirectory = this.projectWorkingDirectory;
    }
    
    if (!workingDirectory) {
      throw new Error('Working directory is required');
    }

    return path.join(workingDirectory, '.digr', 'project.db');
  }

  /**
   * Ensure the .digr folder exists in the project's working directory
   */
  ensureDigrFolder(workingDirectory: string): boolean {
    try {
      const digrPath = path.join(workingDirectory, '.digr');
      
      if (!fs.existsSync(digrPath)) {
        fs.mkdirSync(digrPath, { recursive: true });
      }

      // Verify the folder was created and is accessible
      const exists = fs.existsSync(digrPath);
      const isDir = exists && fs.statSync(digrPath).isDirectory();
      return exists && isDir;
    } catch (error) {
      console.error(`DatabaseManager: Failed to create .digr folder: ${(error as Error).message}`);
      return false;
    }
  }

  /**
   * Execute a SQL query with optional parameters
   */
  async executeQuery(sql: string, params: any[] = []): Promise<any[]> {
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
   */
  async executeNonQuery(sql: string, params: any[] = []): Promise<DatabaseResult> {
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
   */
  async executeTransaction(statements: TransactionStatement[]): Promise<DatabaseResult[]> {
    return new Promise((resolve, reject) => {
      if (!this.isInitialized || !this.db) {
        reject(new Error('Database not initialized'));
        return;
      }

      const db = this.db; // Capture reference to avoid context issues

      db.serialize(() => {
        db.run('BEGIN TRANSACTION');

        const results: DatabaseResult[] = [];
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
   */
  isConnected(): boolean {
    return this.isInitialized && this.db !== null;
  }

  /**
   * Initialize the per-project database schema
   * Creates the project_info, source_folders, and views tables for this specific project
   */
  private async initializeSchema(): Promise<void> {
    const schemaStatements: TransactionStatement[] = [
      {
        sql: `CREATE TABLE IF NOT EXISTS project_info (
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
          path TEXT NOT NULL,
          added_date DATETIME DEFAULT CURRENT_TIMESTAMP
        )`
      },
      {
        sql: `CREATE TABLE IF NOT EXISTS views (
          id TEXT PRIMARY KEY,
          name TEXT NOT NULL,
          created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
          last_query TEXT
        )`
      }
    ];

    await this.executeTransaction(schemaStatements);
  }

  /**
   * Validate that the per-project database schema exists and is correct
   */
  private async validateSchema(): Promise<boolean> {
    try {
      const requiredTables = ['project_info', 'source_folders', 'views'];

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
      const projectInfoColumns = await this.executeQuery("PRAGMA table_info(project_info)");
      const expectedProjectInfoColumns = ['id', 'name', 'working_directory', 'created_date', 'last_modified'];
      const actualProjectInfoColumns = projectInfoColumns.map(col => col.name);

      for (const expectedCol of expectedProjectInfoColumns) {
        if (!actualProjectInfoColumns.includes(expectedCol)) {
          return false;
        }
      }

      const sourceFoldersColumns = await this.executeQuery("PRAGMA table_info(source_folders)");
      const expectedSourceFoldersColumns = ['id', 'path', 'added_date'];
      const actualSourceFoldersColumns = sourceFoldersColumns.map(col => col.name);

      for (const expectedCol of expectedSourceFoldersColumns) {
        if (!actualSourceFoldersColumns.includes(expectedCol)) {
          return false;
        }
      }

      const viewsColumns = await this.executeQuery("PRAGMA table_info(views)");
      const expectedViewsColumns = ['id', 'name', 'created_date', 'last_modified', 'last_query'];
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
   */
  async createDataTable(viewId: string, columns: ColumnSchema[]): Promise<void> {
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
      if (!col.columnName || !col.dataType) {
        throw new Error('Column must have name and type');
      }

      // Sanitize column name to prevent SQL injection
      const sanitizedName = col.columnName.replace(/[^a-zA-Z0-9_]/g, '_');
      const validType = ['TEXT', 'INTEGER', 'REAL'].includes(col.dataType.toUpperCase()) ? col.dataType.toUpperCase() : 'TEXT';

      columnDefs.push(`${sanitizedName} ${validType}`);
    });

    const createTableSQL = `CREATE TABLE IF NOT EXISTS ${tableName} (${columnDefs.join(', ')})`;

    await this.executeNonQuery(createTableSQL);
  }

  /**
   * Drop a dynamic data table for a view
   */
  async dropDataTable(viewId: string): Promise<void> {
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
   */
  async getDataTableSchema(viewId: string): Promise<any[]> {
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
      if ((error as Error).message.includes('no such table')) {
        return [];
      }
      throw error;
    }
  }

  /**
   * Check if a data table exists for a view
   */
  async dataTableExists(viewId: string): Promise<boolean> {
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
   * Execute a SQL query and return paginated results
   * @param sql The SQL query to execute
   * @param params Optional parameters for the query
   * @param page Page number (1-based)
   * @param pageSize Number of records per page
   * @returns Object containing columns, rows, and total count
   */
  async executeSqlQuery(
    sql: string, 
    params: any[] = [], 
    page: number = 1, 
    pageSize: number = 10
  ): Promise<{ columns: string[], rows: any[][], totalRows: number }> {
    if (!this.isInitialized || !this.db) {
      throw new Error('Database not initialized');
    }

    try {
      // Validate and sanitize inputs
      if (page < 1) page = 1;
      if (pageSize < 1) pageSize = 10;
      if (pageSize > 100) pageSize = 100; // Limit max page size

      // Prepare the SQL query
      let sanitizedSql = sql.trim();
      
      // Check if the query is a SELECT statement
      if (!sanitizedSql.toLowerCase().startsWith('select')) {
        throw new Error('Only SELECT queries are allowed');
      }

      // Get total count for pagination
      // Extract the FROM clause and any WHERE conditions
      const lowerSql = sanitizedSql.toLowerCase();
      let fromIndex = lowerSql.indexOf(' from ');
      if (fromIndex === -1) {
        throw new Error('Invalid SQL query: Missing FROM clause');
      }

      const fromClause = sanitizedSql.substring(fromIndex);
      
      // Find where the ORDER BY, LIMIT, etc. clauses start
      let orderByIndex = lowerSql.indexOf(' order by ');
      let limitIndex = lowerSql.indexOf(' limit ');
      let groupByIndex = lowerSql.indexOf(' group by ');
      
      // Find the earliest clause after FROM
      let endIndex = sanitizedSql.length;
      if (orderByIndex > fromIndex && (orderByIndex < endIndex)) endIndex = orderByIndex;
      if (limitIndex > fromIndex && (limitIndex < endIndex)) endIndex = limitIndex;
      if (groupByIndex > fromIndex && (groupByIndex < endIndex)) endIndex = groupByIndex;
      
      const whereClause = sanitizedSql.substring(fromIndex, endIndex);
      
      // Create count query
      const countSql = `SELECT COUNT(*) as total ${whereClause}`;
      
      // Execute count query
      const countResult = await this.executeQuery(countSql, params);
      const totalRows = countResult[0]?.total || 0;
      
      // Add pagination to the original query
      const offset = (page - 1) * pageSize;
      const paginatedSql = `${sanitizedSql} LIMIT ${pageSize} OFFSET ${offset}`;
      
      // Execute the paginated query
      return new Promise((resolve, reject) => {
        this.db!.all(paginatedSql, params, (err, rows) => {
          if (err) {
            // Create a more detailed error message
            const errorMessage = `Query execution failed: ${err.message}`;
            console.error(errorMessage);
            
            // Include the SQL that failed in the error
            const error = new Error(errorMessage);
            (error as any).sqlQuery = paginatedSql;
            (error as any).params = params;
            (error as any).sqliteError = err;
            
            reject(error);
            return;
          }
          
          // If no rows, return empty result with column names
          if (!rows || rows.length === 0) {
            resolve({
              columns: [],
              rows: [],
              totalRows
            });
            return;
          }
          
          // Extract column names from the first row
          const firstRow = rows[0] as Record<string, any>;
          const columns = Object.keys(firstRow);
          
          // Convert rows to arrays for more efficient transfer
          const rowsArray = rows.map(row => columns.map(col => (row as Record<string, any>)[col]));
          
          resolve({
            columns,
            rows: rowsArray,
            totalRows
          });
        });
      });
    } catch (error) {
      // Create a more detailed error message
      let errorMessage = `SQL query execution failed: ${(error as Error).message}`;
      
      // Add query information to the error
      const enhancedError = new Error(errorMessage);
      (enhancedError as any).sqlQuery = sql;
      (enhancedError as any).params = params;
      (enhancedError as any).originalError = error;
      
      // If the error already has SQL information, preserve it
      if ((error as any).sqlQuery) {
        (enhancedError as any).sqlQuery = (error as any).sqlQuery;
      }
      
      // Add pagination information
      (enhancedError as any).pagination = { page, pageSize };
      
      console.error('Enhanced SQL error:', {
        message: errorMessage,
        query: sql,
        pagination: { page, pageSize }
      });
      
      throw enhancedError;
    }
  }

  /**
   * Close the database connection
   */
  async closeDatabase(): Promise<void> {
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
