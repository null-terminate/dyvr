const fs = require('fs');
const path = require('path');
const os = require('os');

// Mock electron app module
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/test-project-manager')
  }
}));

const DatabaseManager = require('../src/main/DatabaseManager');

describe('DatabaseManager', () => {
  let dbManager;
  let testDbPath;

  beforeEach(async () => {
    dbManager = new DatabaseManager();
    testDbPath = dbManager.getDatabasePath();
    
    // Clean up any existing test database
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    // Clean up test directory
    const testDir = path.dirname(testDbPath);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  afterEach(async () => {
    if (dbManager && dbManager.isConnected()) {
      await dbManager.closeDatabase();
    }
    
    // Clean up test database file
    if (fs.existsSync(testDbPath)) {
      fs.unlinkSync(testDbPath);
    }
    
    // Clean up test directory
    const testDir = path.dirname(testDbPath);
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    it('should initialize with null database and not initialized', () => {
      expect(dbManager.db).toBeNull();
      expect(dbManager.isInitialized).toBe(false);
    });
  });

  describe('getDatabasePath', () => {
    it('should return correct database path', () => {
      const expectedPath = '/tmp/test-project-manager/project-manager.db';
      expect(dbManager.getDatabasePath()).toBe(expectedPath);
    });
  });

  describe('initializeDatabase', () => {
    it('should successfully initialize database', async () => {
      await dbManager.initializeDatabase();
      
      expect(dbManager.isInitialized).toBe(true);
      expect(dbManager.db).not.toBeNull();
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should create data directory if it does not exist', async () => {
      const testDir = path.dirname(testDbPath);
      expect(fs.existsSync(testDir)).toBe(false);
      
      await dbManager.initializeDatabase();
      
      expect(fs.existsSync(testDir)).toBe(true);
      expect(fs.existsSync(testDbPath)).toBe(true);
    });

    it('should handle database initialization errors', async () => {
      // Mock fs.mkdirSync to throw an error
      const originalMkdirSync = fs.mkdirSync;
      fs.mkdirSync = jest.fn(() => {
        throw new Error('Permission denied');
      });

      await expect(dbManager.initializeDatabase()).rejects.toThrow('Database initialization error');
      
      // Restore original function
      fs.mkdirSync = originalMkdirSync;
    });
  });

  describe('isConnected', () => {
    it('should return false when not initialized', () => {
      expect(dbManager.isConnected()).toBe(false);
    });

    it('should return true when initialized', async () => {
      await dbManager.initializeDatabase();
      expect(dbManager.isConnected()).toBe(true);
    });
  });

  describe('executeQuery', () => {
    beforeEach(async () => {
      await dbManager.initializeDatabase();
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
      await dbManager.initializeDatabase();
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
      await dbManager.initializeDatabase();
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
      await dbManager.initializeDatabase();
    });

    it('should create all required tables', async () => {
      await dbManager.initializeSchema();
      
      // Check that all tables exist
      const tables = await dbManager.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );
      
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('projects');
      expect(tableNames).toContain('source_folders');
      expect(tableNames).toContain('views');
    });

    it('should create projects table with correct structure', async () => {
      await dbManager.initializeSchema();
      
      const columns = await dbManager.executeQuery("PRAGMA table_info(projects)");
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
      expect(columnNames).toContain('project_id');
      expect(columnNames).toContain('path');
      expect(columnNames).toContain('added_date');
    });

    it('should create views table with correct structure', async () => {
      await dbManager.initializeSchema();
      
      const columns = await dbManager.executeQuery("PRAGMA table_info(views)");
      const columnNames = columns.map(col => col.name);
      
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('project_id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('created_date');
      expect(columnNames).toContain('last_modified');
      expect(columnNames).toContain('last_query');
    });

    it('should be idempotent (safe to run multiple times)', async () => {
      await dbManager.initializeSchema();
      await dbManager.initializeSchema(); // Run again
      
      const tables = await dbManager.executeQuery(
        "SELECT name FROM sqlite_master WHERE type='table' ORDER BY name"
      );
      
      const tableNames = tables.map(t => t.name);
      expect(tableNames).toContain('projects');
      expect(tableNames).toContain('source_folders');
      expect(tableNames).toContain('views');
    });
  });

  describe('validateSchema', () => {
    beforeEach(async () => {
      await dbManager.initializeDatabase();
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
      await dbManager.executeNonQuery('DROP TABLE projects');
      
      const isValid = await dbManager.validateSchema();
      expect(isValid).toBe(false);
    });

    it('should return false when a required column is missing', async () => {
      // Create incomplete schema
      await dbManager.executeNonQuery(`CREATE TABLE projects (
        id TEXT PRIMARY KEY,
        name TEXT NOT NULL
      )`);
      await dbManager.executeNonQuery(`CREATE TABLE source_folders (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
        path TEXT NOT NULL,
        added_date DATETIME DEFAULT CURRENT_TIMESTAMP
      )`);
      await dbManager.executeNonQuery(`CREATE TABLE views (
        id TEXT PRIMARY KEY,
        project_id TEXT NOT NULL,
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
      await dbManager.initializeDatabase();
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
      await dbManager.initializeDatabase();
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
      await dbManager.initializeDatabase();
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
      await dbManager.initializeDatabase();
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

  describe('closeDatabase', () => {
    it('should close database connection successfully', async () => {
      await dbManager.initializeDatabase();
      expect(dbManager.isConnected()).toBe(true);
      
      await dbManager.closeDatabase();
      
      expect(dbManager.isConnected()).toBe(false);
      expect(dbManager.db).toBeNull();
      expect(dbManager.isInitialized).toBe(false);
    });

    it('should handle closing when database is not initialized', async () => {
      await expect(dbManager.closeDatabase()).resolves.toBeUndefined();
    });
  });
});