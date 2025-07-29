const fs = require('fs');
const path = require('path');
const os = require('os');

const DatabaseManager = require('../src/main/DatabaseManager');

describe('DatabaseManager', () => {
  let dbManager;
  let testWorkingDirectory;
  let testDbPath;

  beforeEach(async () => {
    // Create a temporary working directory for testing
    testWorkingDirectory = path.join(os.tmpdir(), 'test-project-' + Date.now());
    fs.mkdirSync(testWorkingDirectory, { recursive: true });
    
    dbManager = new DatabaseManager(testWorkingDirectory);
    testDbPath = dbManager.getDatabasePath(testWorkingDirectory);
    
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    // Clean up .digr directory
    const digrDir = path.join(testWorkingDirectory, '.digr');
    if (fs.existsSync(digrDir)) {
      fs.rmSync(digrDir, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    if (dbManager && dbManager.isConnected()) {
      await dbManager.closeProjectDatabase();
    }
    
    // Clean up test working directory
    if (fs.existsSync(testWorkingDirectory)) {
      fs.rmSync(testWorkingDirectory, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should initialize with null database and not initialized', () => {
      expect(dbManager.db).toBeNull();
      expect(dbManager.isInitialized).toBe(false);
      expect(dbManager.projectWorkingDirectory).toBe(testWorkingDirectory);
    });

    it('should accept working directory parameter', () => {
      const customDir = '/custom/path';
      const customManager = new DatabaseManager(customDir);
      expect(customManager.projectWorkingDirectory).toBe(customDir);
    });
  });

  describe('getDatabasePath', () => {
    it('should return correct database path for project', () => {
      const expectedPath = path.join(testWorkingDirectory, '.digr', 'project.db');
      expect(dbManager.getDatabasePath(testWorkingDirectory)).toBe(expectedPath);
    });

    it('should use instance working directory when no parameter provided', () => {
      const expectedPath = path.join(testWorkingDirectory, '.digr', 'project.db');
      expect(dbManager.getDatabasePath()).toBe(expectedPath);
    });

    it('should throw error when no working directory available', () => {
      const managerWithoutDir = new DatabaseManager();
      expect(() => managerWithoutDir.getDatabasePath()).toThrow('Working directory is required');
    });
  });

  describe('ensureDigrFolder', () => {
    it('should create .digr folder if it does not exist', () => {
      const digrPath = path.join(testWorkingDirectory, '.digr');
      expect(fs.existsSync(digrPath)).toBe(false);
      
      const result = dbManager.ensureDigrFolder(testWorkingDirectory);
      
      expect(result).toBe(true);
      expect(fs.existsSync(digrPath)).toBe(true);
      expect(fs.statSync(digrPath).isDirectory()).toBe(true);
    });

    it('should return true if .digr folder already exists', () => {
      const digrPath = path.join(testWorkingDirectory, '.digr');
      fs.mkdirSync(digrPath);
      
      const result = dbManager.ensureDigrFolder(testWorkingDirectory);
      
      expect(result).toBe(true);
      expect(fs.existsSync(digrPath)).toBe(true);
    });

    it('should handle errors gracefully', () => {
      // Mock fs.mkdirSync to throw an error
      const originalMkdirSync = fs.mkdirSync;
      const originalExistsSync = fs.existsSync;
      
      fs.existsSync = jest.fn(() => false);
      fs.mkdirSync = jest.fn(() => {
        throw new Error('Permission denied');
      });

      const result = dbManager.ensureDigrFolder(testWorkingDirectory);
      
      expect(result).toBe(false);
      
      // Restore original functions
      fs.mkdirSync = originalMkdirSync;
      fs.existsSync = originalExistsSync;
    });
  });

  describe('initializeProjectDatabase', () => {
    it('should successfully initialize project database', async () => {
      const projectId = 'test-project-123';
      const projectName = 'Test Project';
      
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
      
      expect(dbManager.isInitialized).toBe(true);
      expect(dbManager.db).not.toBeNull();
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should create .digr directory if it does not exist', async () => {
      const projectId = 'test-project-456';
      const projectName = 'Test Project';
      const digrDir = path.join(testWorkingDirectory, '.digr');
      
      expect(fs.existsSync(digrDir)).toBe(false);
      
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
      
      expect(fs.existsSync(digrDir)).toBe(true);
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should require project ID, name, and working directory', async () => {
      await expect(dbManager.initializeProjectDatabase('', 'Test', testWorkingDirectory))
        .rejects.toThrow('Project ID, name, and working directory are required');
      
      await expect(dbManager.initializeProjectDatabase('test', '', testWorkingDirectory))
        .rejects.toThrow('Project ID, name, and working directory are required');
      
      await expect(dbManager.initializeProjectDatabase('test', 'Test', ''))
        .rejects.toThrow('Project ID, name, and working directory are required');
    });

    it('should handle .digr folder creation errors', async () => {
      const projectId = 'test-project-error';
      const projectName = 'Test Project';
      
      // Mock ensureDigrFolder to return false
      const originalEnsureDigrFolder = dbManager.ensureDigrFolder;
      dbManager.ensureDigrFolder = jest.fn(() => false);

      await expect(dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory))
        .rejects.toThrow('Failed to create .digr folder');
      
      // Restore original function
      dbManager.ensureDigrFolder = originalEnsureDigrFolder;
    });
  });

  describe('openProjectDatabase', () => {
    it('should successfully open existing project database', async () => {
      // First create a database
      const projectId = 'test-project-open';
      const projectName = 'Test Project';
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
      await dbManager.closeProjectDatabase();
      
      // Now open it
      await dbManager.openProjectDatabase(testWorkingDirectory);
      
      expect(dbManager.isInitialized).toBe(true);
      expect(dbManager.db).not.toBeNull();
    });

    it('should require working directory', async () => {
      await expect(dbManager.openProjectDatabase(''))
        .rejects.toThrow('Project working directory is required');
      
      await expect(dbManager.openProjectDatabase(null))
        .rejects.toThrow('Project working directory is required');
    });

    it('should fail if database does not exist', async () => {
      const nonExistentDir = path.join(os.tmpdir(), 'non-existent-project');
      
      await expect(dbManager.openProjectDatabase(nonExistentDir))
        .rejects.toThrow('Project database does not exist');
    });
  });

  describe('closeProjectDatabase', () => {
    it('should close project database connection successfully', async () => {
      const projectId = 'test-project-close';
      const projectName = 'Test Project';
      
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
      expect(dbManager.isConnected()).toBe(true);
      
      await dbManager.closeProjectDatabase();
      
      expect(dbManager.isConnected()).toBe(false);
      expect(dbManager.db).toBeNull();
      expect(dbManager.isInitialized).toBe(false);
      expect(dbManager.databasePath).toBeNull();
    });

    it('should handle closing when database is not initialized', async () => {
      await expect(dbManager.closeProjectDatabase()).resolves.toBeUndefined();
      expect(dbManager.isInitialized).toBe(false);
      expect(dbManager.databasePath).toBeNull();
    });
  });

  describe('isConnected', () => {
    it('should return false when not initialized', () => {
      expect(dbManager.isConnected()).toBe(false);
    });

    it('should return true when initialized', async () => {
      const projectId = 'test-project-connected';
      const projectName = 'Test Project';
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
      expect(dbManager.isConnected()).toBe(true);
    });
  });

  describe('executeQuery', () => {
    beforeEach(async () => {
      const projectId = 'test-project-query';
      const projectName = 'Test Project';
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
    });

    it('should execute SELECT query successfully', async () => {
      // Create a test table and insert data
      await dbManager.executeNonQuery('CREATE TABLE test (id INTEGER, name TEXT)');
      await dbManager.executeNonQuery('INSERT INTO test (id, name) VALUES (?, ?)', [1, 'Test']);
      
      const results = await dbManager.executeQuery('SELECT * FROM test');
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ id: 1, name: 'Test' });
    });

    it('should execute query with parameters', async () => {
      await dbManager.executeNonQuery('CREATE TABLE test (id INTEGER, name TEXT)');
      await dbManager.executeNonQuery('INSERT INTO test (id, name) VALUES (?, ?)', [1, 'Test1']);
      await dbManager.executeNonQuery('INSERT INTO test (id, name) VALUES (?, ?)', [2, 'Test2']);
      
      const results = await dbManager.executeQuery('SELECT * FROM test WHERE id = ?', [1]);
      
      expect(results).toHaveLength(1);
      expect(results[0]).toEqual({ id: 1, name: 'Test1' });
    });

    it('should reject when database not initialized', async () => {
      const uninitializedManager = new DatabaseManager();
      
      await expect(uninitializedManager.executeQuery('SELECT 1')).rejects.toThrow('Database not initialized');
    });

    it('should handle SQL errors', async () => {
      await expect(dbManager.executeQuery('INVALID SQL')).rejects.toThrow('Query execution failed');
    });
  });

  describe('executeNonQuery', () => {
    beforeEach(async () => {
      const projectId = 'test-project-nonquery';
      const projectName = 'Test Project';
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
    });

    it('should execute INSERT query successfully', async () => {
      await dbManager.executeNonQuery('CREATE TABLE test (id INTEGER, name TEXT)');
      
      const result = await dbManager.executeNonQuery('INSERT INTO test (id, name) VALUES (?, ?)', [1, 'Test']);
      
      expect(result.lastID).toBe(1);
      expect(result.changes).toBe(1);
    });

    it('should execute UPDATE query successfully', async () => {
      await dbManager.executeNonQuery('CREATE TABLE test (id INTEGER, name TEXT)');
      await dbManager.executeNonQuery('INSERT INTO test (id, name) VALUES (?, ?)', [1, 'Test']);
      
      const result = await dbManager.executeNonQuery('UPDATE test SET name = ? WHERE id = ?', ['Updated', 1]);
      
      expect(result.changes).toBe(1);
    });

    it('should execute DELETE query successfully', async () => {
      await dbManager.executeNonQuery('CREATE TABLE test (id INTEGER, name TEXT)');
      await dbManager.executeNonQuery('INSERT INTO test (id, name) VALUES (?, ?)', [1, 'Test']);
      
      const result = await dbManager.executeNonQuery('DELETE FROM test WHERE id = ?', [1]);
      
      expect(result.changes).toBe(1);
    });

    it('should reject when database not initialized', async () => {
      const uninitializedManager = new DatabaseManager();
      
      await expect(uninitializedManager.executeNonQuery('CREATE TABLE test (id INTEGER)')).rejects.toThrow('Database not initialized');
    });

    it('should handle SQL errors', async () => {
      await expect(dbManager.executeNonQuery('INVALID SQL')).rejects.toThrow('Non-query execution failed');
    });
  });

  describe('executeTransaction', () => {
    beforeEach(async () => {
      const projectId = 'test-project-transaction';
      const projectName = 'Test Project';
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
      await dbManager.executeNonQuery('CREATE TABLE test (id INTEGER, name TEXT)');
    });

    it('should execute multiple statements in transaction successfully', async () => {
      const statements = [
        { sql: 'INSERT INTO test (id, name) VALUES (?, ?)', params: [1, 'Test1'] },
        { sql: 'INSERT INTO test (id, name) VALUES (?, ?)', params: [2, 'Test2'] },
        { sql: 'INSERT INTO test (id, name) VALUES (?, ?)', params: [3, 'Test3'] }
      ];
      
      const results = await dbManager.executeTransaction(statements);
      
      expect(results).toHaveLength(3);
      expect(results[0].changes).toBe(1);
      expect(results[1].changes).toBe(1);
      expect(results[2].changes).toBe(1);
      
      // Verify all records were inserted
      const allRecords = await dbManager.executeQuery('SELECT * FROM test');
      expect(allRecords).toHaveLength(3);
    });

    it('should handle empty transaction', async () => {
      const results = await dbManager.executeTransaction([]);
      expect(results).toEqual([]);
    });

    it('should rollback transaction on error', async () => {
      const statements = [
        { sql: 'INSERT INTO test (id, name) VALUES (?, ?)', params: [1, 'Test1'] },
        { sql: 'INVALID SQL', params: [] },
        { sql: 'INSERT INTO test (id, name) VALUES (?, ?)', params: [3, 'Test3'] }
      ];
      
      await expect(dbManager.executeTransaction(statements)).rejects.toThrow('Transaction failed at statement 1');
      
      // Verify no records were inserted due to rollback
      const allRecords = await dbManager.executeQuery('SELECT * FROM test');
      expect(allRecords).toHaveLength(0);
    });

    it('should reject when database not initialized', async () => {
      const uninitializedManager = new DatabaseManager();
      const statements = [{ sql: 'SELECT 1', params: [] }];
      
      await expect(uninitializedManager.executeTransaction(statements)).rejects.toThrow('Database not initialized');
    });
  });

  describe('initializeSchema', () => {
    beforeEach(async () => {
      const projectId = 'test-project-schema';
      const projectName = 'Test Project';
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
    });

    it('should create all required tables', async () => {
      await dbManager.initializeSchema();
      
      // Check that all tables exist
      const tables = await dbManager.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );
      
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('project_info');
      expect(tableNames).toContain('source_folders');
      expect(tableNames).toContain('views');
    });

    it('should create project_info table with correct structure', async () => {
      await dbManager.initializeSchema();
      
      const columns = await dbManager.executeQuery("PRAGMA table_info(project_info)");
      const columnNames = columns.map(col => col.name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('working_directory');
      expect(columnNames).toContain('created_date');
      expect(columnNames).toContain('last_modified');
    });

    it('should create source_folders table with correct structure', async () => {
      await dbManager.initializeSchema();
      
      const columns = await dbManager.executeQuery("PRAGMA table_info(source_folders)");
      const columnNames = columns.map(col => col.name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('path');
      expect(columnNames).toContain('added_date');
      expect(columnNames).not.toContain('project_id'); // No project_id in per-project database
    });

    it('should create views table with correct structure', async () => {
      await dbManager.initializeSchema();
      
      const columns = await dbManager.executeQuery("PRAGMA table_info(views)");
      const columnNames = columns.map(col => col.name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('created_date');
      expect(columnNames).toContain('last_modified');
      expect(columnNames).toContain('last_query');
      expect(columnNames).not.toContain('project_id'); // No project_id in per-project database
    });

    it('should be idempotent (safe to run multiple times)', async () => {
      await dbManager.initializeSchema();
      await dbManager.initializeSchema(); // Run again
      
      const tables = await dbManager.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );
      
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('project_info');
      expect(tableNames).toContain('source_folders');
      expect(tableNames).toContain('views');
    });
  });

  describe('validateSchema', () => {
    beforeEach(async () => {
      const projectId = 'test-project-validate';
      const projectName = 'Test Project';
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
    });

    it('should return false when schema is not initialized', async () => {
      const isValid = await dbManager.validateSchema();
      expect(isValid).toBe(false);
    });

    it('should return true when schema is properly initialized', async () => {
      await dbManager.initializeSchema();
      const isValid = await dbManager.validateSchema();
      expect(isValid).toBe(true);
    });

    it('should return false when a required table is missing', async () => {
      await dbManager.initializeSchema();
      
      // Drop one table to simulate missing table
      await dbManager.executeNonQuery('DROP TABLE project_info');
      
      const isValid = await dbManager.validateSchema();
      expect(isValid).toBe(false);
    });

    it('should return false when a required column is missing', async () => {
      // Create incomplete schema
      await dbManager.executeNonQuery(`CREATE TABLE project_info (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      )`);
      await dbManager.executeNonQuery(`CREATE TABLE source_folders (
        id TEXT PRIMARY KEY,
        path TEXT NOT NULL,
        added_date DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      await dbManager.executeNonQuery(`CREATE TABLE views (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL,
        created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
        last_query TEXT
      )`);
      
      const isValid = await dbManager.validateSchema();
      expect(isValid).toBe(false);
    });
  });

  describe('createDataTable', () => {
    beforeEach(async () => {
      const projectId = 'test-project-datatable';
      const projectName = 'Test Project';
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
    });

    it('should create data table with specified columns', async () => {
      const viewId = 'test-view-123';
      const columns = [
        { name: 'name', type: 'TEXT' },
        { name: 'age', type: 'INTEGER' },
        { name: 'score', type: 'REAL' }
      ];
      
      await dbManager.createDataTable(viewId, columns);
      
      const tableExists = await dbManager.dataTableExists(viewId);
      expect(tableExists).toBe(true);
      
      const schema = await dbManager.getDataTableSchema(viewId);
      const columnNames = schema.map(col => col.name);
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('age');
      expect(columnNames).toContain('score');
    });

    it('should sanitize column names', async () => {
      const viewId = 'test-view-456';
      const columns = [
        { name: 'user-name', type: 'TEXT' },
        { name: 'email@domain', type: 'TEXT' },
        { name: 'score%', type: 'REAL' }
      ];
      
      await dbManager.createDataTable(viewId, columns);
      
      const schema = await dbManager.getDataTableSchema(viewId);
      const columnNames = schema.map(col => col.name);
      expect(columnNames).toContain('user_name');
      expect(columnNames).toContain('email_domain');
      expect(columnNames).toContain('score_');
    });

    it('should validate column types', async () => {
      const viewId = 'test-view-789';
      const columns = [
        { name: 'valid_text', type: 'TEXT' },
        { name: 'valid_int', type: 'INTEGER' },
        { name: 'valid_real', type: 'REAL' },
        { name: 'invalid_type', type: 'INVALID' }
      ];
      
      await dbManager.createDataTable(viewId, columns);
      
      const schema = await dbManager.getDataTableSchema(viewId);
      const invalidColumn = schema.find(col => col.name === 'invalid_type');
      expect(invalidColumn.type).toBe('TEXT'); // Should default to TEXT
    });

    it('should throw error for invalid parameters', async () => {
      await expect(dbManager.createDataTable('', [])).rejects.toThrow('Invalid parameters');
      await expect(dbManager.createDataTable('test', null)).rejects.toThrow('Invalid parameters');
      await expect(dbManager.createDataTable(null, [{ name: 'test', type: 'TEXT' }])).rejects.toThrow('Invalid parameters');
    });

    it('should throw error for invalid column definitions', async () => {
      const viewId = 'test-view-error';
      const invalidColumns = [
        { name: '', type: 'TEXT' }, // Empty name
        { name: 'valid', type: '' }  // Empty type
      ];
      
      await expect(dbManager.createDataTable(viewId, invalidColumns)).rejects.toThrow('Column must have name and type');
    });
  });

  describe('dropDataTable', () => {
    beforeEach(async () => {
      const projectId = 'test-project-drop';
      const projectName = 'Test Project';
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
    });

    it('should drop existing data table', async () => {
      const viewId = 'test-view-drop';
      const columns = [{ name: 'test_col', type: 'TEXT' }];
      
      await dbManager.createDataTable(viewId, columns);
      expect(await dbManager.dataTableExists(viewId)).toBe(true);
      
      await dbManager.dropDataTable(viewId);
      expect(await dbManager.dataTableExists(viewId)).toBe(false);
    });

    it('should handle dropping non-existent table', async () => {
      const viewId = 'non-existent-view';
      
      await expect(dbManager.dropDataTable(viewId)).resolves.toBeUndefined();
    });

    it('should throw error for invalid view ID', async () => {
      await expect(dbManager.dropDataTable('')).rejects.toThrow('View ID is required');
      await expect(dbManager.dropDataTable(null)).rejects.toThrow('View ID is required');
    });
  });

  describe('getDataTableSchema', () => {
    beforeEach(async () => {
      const projectId = 'test-project-schema';
      const projectName = 'Test Project';
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
    });

    it('should return schema for existing table', async () => {
      const viewId = 'test-view-schema';
      const columns = [
        { name: 'name', type: 'TEXT' },
        { name: 'age', type: 'INTEGER' }
      ];
      
      await dbManager.createDataTable(viewId, columns);
      
      const schema = await dbManager.getDataTableSchema(viewId);
      expect(schema).toHaveLength(2);
      expect(schema.map(col => col.name)).toEqual(['name', 'age']);
    });

    it('should return empty array for non-existent table', async () => {
      const viewId = 'non-existent-view';
      
      const schema = await dbManager.getDataTableSchema(viewId);
      expect(schema).toEqual([]);
    });

    it('should filter out internal columns', async () => {
      const viewId = 'test-view-internal';
      const columns = [{ name: 'user_data', type: 'TEXT' }];
      
      await dbManager.createDataTable(viewId, columns);
      
      const schema = await dbManager.getDataTableSchema(viewId);
      const columnNames = schema.map(col => col.name);
      
      // Should not include internal columns (_id, _source_file, _scan_date)
      expect(columnNames).not.toContain('_id');
      expect(columnNames).not.toContain('_source_file');
      expect(columnNames).not.toContain('_scan_date');
      expect(columnNames).toContain('user_data');
    });

    it('should throw error for invalid view ID', async () => {
      await expect(dbManager.getDataTableSchema('')).rejects.toThrow('View ID is required');
      await expect(dbManager.getDataTableSchema(null)).rejects.toThrow('View ID is required');
    });
  });

  describe('dataTableExists', () => {
    beforeEach(async () => {
      const projectId = 'test-project-exists';
      const projectName = 'Test Project';
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
    });

    it('should return true for existing table', async () => {
      const viewId = 'test-view-exists';
      const columns = [{ name: 'test_col', type: 'TEXT' }];
      
      await dbManager.createDataTable(viewId, columns);
      
      const exists = await dbManager.dataTableExists(viewId);
      expect(exists).toBe(true);
    });

    it('should return false for non-existent table', async () => {
      const viewId = 'non-existent-view';
      
      const exists = await dbManager.dataTableExists(viewId);
      expect(exists).toBe(false);
    });

    it('should return false for invalid view ID', async () => {
      expect(await dbManager.dataTableExists('')).toBe(false);
      expect(await dbManager.dataTableExists(null)).toBe(false);
    });
  });

  describe('createProjectSchema', () => {
    beforeEach(async () => {
      const projectId = 'test-project-create-schema';
      const projectName = 'Test Project';
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
    });

    it('should create schema and insert project info', async () => {
      const projectId = 'test-project-123';
      const projectName = 'Test Project Schema';
      const workingDir = testWorkingDirectory;

      await dbManager.createProjectSchema(projectId, projectName, workingDir);

      // Verify schema was created
      const isValid = await dbManager.validateSchema();
      expect(isValid).toBe(true);

      // Verify project info was inserted
      const projectInfo = await dbManager.executeQuery('SELECT * FROM project_info WHERE id = ?', [projectId]);
      expect(projectInfo).toHaveLength(1);
      expect(projectInfo[0].id).toBe(projectId);
      expect(projectInfo[0].name).toBe(projectName);
      expect(projectInfo[0].working_directory).toBe(workingDir);
    });

    it('should throw error when database not initialized', async () => {
      const uninitializedManager = new DatabaseManager(testWorkingDirectory);
      
      await expect(uninitializedManager.createProjectSchema('test', 'Test', testWorkingDirectory))
        .rejects.toThrow('Database must be initialized before creating schema');
    });
  });

  describe('migrateSchema', () => {
    beforeEach(async () => {
      const projectId = 'test-project-migrate';
      const projectName = 'Test Project';
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
    });

    it('should migrate schema when valid', async () => {
      // First create a valid schema
      await dbManager.initializeSchema();
      
      // Migration should succeed without errors
      await expect(dbManager.migrateSchema()).resolves.toBeUndefined();
    });

    it('should recreate schema when invalid', async () => {
      // Create an incomplete schema
      await dbManager.executeNonQuery('CREATE TABLE project_info (id TEXT PRIMARY KEY)');
      
      // Migration should fix the schema
      await dbManager.migrateSchema();
      
      const isValid = await dbManager.validateSchema();
      expect(isValid).toBe(true);
    });

    it('should throw error when database not initialized', async () => {
      const uninitializedManager = new DatabaseManager(testWorkingDirectory);
      
      await expect(uninitializedManager.migrateSchema())
        .rejects.toThrow('Database must be initialized before migrating schema');
    });
  });

  describe('getSchemaVersion', () => {
    beforeEach(async () => {
      const projectId = 'test-project-version';
      const projectName = 'Test Project';
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
    });

    it('should return version 1 when no schema_version table exists', async () => {
      const version = await dbManager.getSchemaVersion();
      expect(version).toBe(1);
    });

    it('should return correct version when schema_version table exists', async () => {
      // Set a version first
      await dbManager.setSchemaVersion(2);
      
      const version = await dbManager.getSchemaVersion();
      expect(version).toBe(2);
    });

    it('should handle database errors gracefully', async () => {
      // Close the database to simulate an error
      await dbManager.closeProjectDatabase();
      
      const version = await dbManager.getSchemaVersion();
      expect(version).toBe(1); // Should default to 1 on error
    });
  });

  describe('setSchemaVersion', () => {
    beforeEach(async () => {
      const projectId = 'test-project-set-version';
      const projectName = 'Test Project';
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
    });

    it('should create schema_version table and set version', async () => {
      await dbManager.setSchemaVersion(2);
      
      // Verify the table was created
      const tables = await dbManager.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' AND name='schema_version'"
      );
      expect(tables).toHaveLength(1);
      
      // Verify the version was set
      const version = await dbManager.getSchemaVersion();
      expect(version).toBe(2);
    });

    it('should insert multiple versions', async () => {
      await dbManager.setSchemaVersion(1);
      await dbManager.setSchemaVersion(2);
      await dbManager.setSchemaVersion(3);
      
      const version = await dbManager.getSchemaVersion();
      expect(version).toBe(3); // Should return the latest version
      
      // Verify all versions were inserted
      const allVersions = await dbManager.executeQuery('SELECT version FROM schema_version ORDER BY version');
      expect(allVersions).toHaveLength(3);
      expect(allVersions.map(v => v.version)).toEqual([1, 2, 3]);
    });

    it('should throw error when database not initialized', async () => {
      const uninitializedManager = new DatabaseManager(testWorkingDirectory);
      
      await expect(uninitializedManager.setSchemaVersion(2))
        .rejects.toThrow('Database must be initialized before setting schema version');
    });
  });

  describe('closeDatabase', () => {
    it('should close database connection successfully', async () => {
      const projectId = 'test-project-close-db';
      const projectName = 'Test Project';
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
      expect(dbManager.isConnected()).toBe(true);
      
      await dbManager.closeProjectDatabase();
      
      expect(dbManager.isConnected()).toBe(false);
      expect(dbManager.db).toBeNull();
      expect(dbManager.isInitialized).toBe(false);
    });

    it('should handle closing when database is not initialized', async () => {
      await expect(dbManager.closeProjectDatabase()).resolves.toBeUndefined();
    });
  });
});