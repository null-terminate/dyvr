import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DatabaseManager } from '../src/main/DatabaseManager';

describe('DatabaseManager', () => {
  let dbManager: DatabaseManager;
  let testWorkingDirectory: string;
  let testDbPath: string;

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
    it('should initialize with correct working directory', () => {
      expect(dbManager.isConnected()).toBe(false);
    });

    it('should accept working directory parameter', () => {
      const customDir = '/custom/path';
      const customManager = new DatabaseManager(customDir);
      expect(customManager.getDatabasePath()).toBe(path.join(customDir, '.digr', 'project.db'));
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
      const managerWithoutDir = new DatabaseManager('');
      expect(() => managerWithoutDir.getDatabasePath()).toThrow('Working directory is required');
    });
  });

  describe('ensureDigrFolder', () => {
    it('should create .digr folder if it does not exist', () => {
      const digrPath = path.join(testWorkingDirectory, '.digr');
      expect(fs.existsSync(digrPath)).toBe(false);
      
      const result = dbManager.ensureProjectFolder(testWorkingDirectory);
      
      expect(result).toBe(true);
      expect(fs.existsSync(digrPath)).toBe(true);
      expect(fs.statSync(digrPath).isDirectory()).toBe(true);
    });

    it('should return true if .digr folder already exists', () => {
      const digrPath = path.join(testWorkingDirectory, '.digr');
      fs.mkdirSync(digrPath);
      
      const result = dbManager.ensureProjectFolder(testWorkingDirectory);
      
      expect(result).toBe(true);
      expect(fs.existsSync(digrPath)).toBe(true);
    });
  });

  describe('initializeProjectDatabase', () => {
    it('should successfully initialize project database', async () => {
      const projectId = 'test-project-123';
      const projectName = 'Test Project';
      
      await dbManager.initializeProjectDatabase(projectId, projectName, testWorkingDirectory);
      
      expect(dbManager.isConnected()).toBe(true);
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
      
      expect(dbManager.isConnected()).toBe(true);
    });

    it('should require working directory', async () => {
      await expect(dbManager.openProjectDatabase(''))
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
    });

    it('should handle closing when database is not initialized', async () => {
      await expect(dbManager.closeProjectDatabase()).resolves.toBeUndefined();
      expect(dbManager.isConnected()).toBe(false);
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
      const uninitializedManager = new DatabaseManager('');
      
      await expect(uninitializedManager.executeQuery('SELECT 1')).rejects.toThrow('Database not initialized');
    });

    it('should handle SQL errors', async () => {
      await expect(dbManager.executeQuery('INVALID SQL')).rejects.toThrow('Query execution failed');
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
        { columnName: 'name', dataType: 'TEXT' as const, nullable: true },
        { columnName: 'age', dataType: 'INTEGER' as const, nullable: false },
        { columnName: 'score', dataType: 'REAL' as const, nullable: true }
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

    it('should throw error for invalid parameters', async () => {
      await expect(dbManager.createDataTable('', [])).rejects.toThrow('Invalid parameters');
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
      const columns = [{ columnName: 'test_col', dataType: 'TEXT' as const, nullable: true }];
      
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
    });
  });
});