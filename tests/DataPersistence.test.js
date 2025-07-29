// Mock sqlite3 before any imports
jest.mock('sqlite3', () => ({
  verbose: jest.fn(() => ({
    Database: jest.fn()
  }))
}));

// Mock electron app
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/test-app-data')
  }
}));

// Mock fs
jest.mock('fs');

// Mock DatabaseManager
jest.mock('../src/main/DatabaseManager');

const DataPersistence = require('../src/main/DataPersistence');
const DatabaseManager = require('../src/main/DatabaseManager');
const fs = require('fs');
const path = require('path');
const { app } = require('electron');

describe('DataPersistence', () => {
  let dataPersistence;
  let mockDatabaseManager;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup DatabaseManager mock
    mockDatabaseManager = {
      initializeDatabase: jest.fn().mockResolvedValue(),
      validateSchema: jest.fn().mockResolvedValue(true),
      initializeSchema: jest.fn().mockResolvedValue(),
      executeQuery: jest.fn(),
      executeNonQuery: jest.fn(),
      closeDatabase: jest.fn().mockResolvedValue(),
      getDatabasePath: jest.fn().mockReturnValue('/tmp/test-app-data/project-manager.db')
    };
    
    DatabaseManager.mockImplementation(() => mockDatabaseManager);
    
    // Setup fs mock
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockImplementation(() => {});
    
    dataPersistence = new DataPersistence();
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      await dataPersistence.initialize();
      
      expect(mockDatabaseManager.initializeDatabase).toHaveBeenCalled();
      expect(mockDatabaseManager.validateSchema).toHaveBeenCalled();
      expect(dataPersistence.isInitialized).toBe(true);
    });

    test('should create schema if validation fails', async () => {
      mockDatabaseManager.validateSchema.mockResolvedValue(false);
      
      await dataPersistence.initialize();
      
      expect(mockDatabaseManager.initializeSchema).toHaveBeenCalled();
    });

    test('should throw error if initialization fails', async () => {
      mockDatabaseManager.initializeDatabase.mockRejectedValue(new Error('DB error'));
      
      await expect(dataPersistence.initialize()).rejects.toThrow('Failed to initialize data persistence: DB error');
    });

    test('should create data directory if it does not exist', async () => {
      fs.existsSync.mockReturnValue(false);
      
      await dataPersistence.ensureDataDirectory();
      
      expect(fs.mkdirSync).toHaveBeenCalledWith('/tmp/test-app-data', { recursive: true });
    });
  });

  describe('project operations', () => {
    beforeEach(async () => {
      await dataPersistence.initialize();
    });

    describe('saveProject', () => {
      test('should save new project successfully', async () => {
        const project = {
          id: 'proj-1',
          name: 'Test Project',
          workingDirectory: '/path/to/project'
        };

        mockDatabaseManager.executeQuery.mockResolvedValue([]); // No existing project
        mockDatabaseManager.executeNonQuery.mockResolvedValue({ lastID: 1, changes: 1 });
        mockDatabaseManager.executeQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{
          id: 'proj-1',
          name: 'Test Project',
          working_directory: '/path/to/project',
          created_date: '2023-01-01T00:00:00.000Z',
          last_modified: '2023-01-01T00:00:00.000Z'
        }]);

        const result = await dataPersistence.saveProject(project);

        expect(mockDatabaseManager.executeNonQuery).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO projects'),
          expect.arrayContaining(['proj-1', 'Test Project', '/path/to/project'])
        );
        expect(result.id).toBe('proj-1');
        expect(result.name).toBe('Test Project');
      });

      test('should update existing project', async () => {
        const project = {
          id: 'proj-1',
          name: 'Updated Project',
          workingDirectory: '/path/to/updated'
        };

        // Mock existing project found
        mockDatabaseManager.executeQuery.mockResolvedValueOnce([{
          id: 'proj-1',
          name: 'Old Project',
          working_directory: '/path/to/old',
          created_date: '2023-01-01T00:00:00.000Z',
          last_modified: '2023-01-01T00:00:00.000Z'
        }]).mockResolvedValueOnce([{
          id: 'proj-1',
          name: 'Updated Project',
          working_directory: '/path/to/updated',
          created_date: '2023-01-01T00:00:00.000Z',
          last_modified: '2023-01-01T00:00:00.000Z'
        }]);

        mockDatabaseManager.executeNonQuery.mockResolvedValue({ changes: 1 });

        const result = await dataPersistence.saveProject(project);

        expect(mockDatabaseManager.executeNonQuery).toHaveBeenCalledWith(
          expect.stringContaining('UPDATE projects SET'),
          expect.arrayContaining(['Updated Project', '/path/to/updated'])
        );
        expect(result.name).toBe('Updated Project');
      });

      test('should validate project object', async () => {
        await expect(dataPersistence.saveProject(null)).rejects.toThrow('Project must be an object');
        await expect(dataPersistence.saveProject({})).rejects.toThrow('Project ID must be a non-empty string');
        await expect(dataPersistence.saveProject({ id: 'test' })).rejects.toThrow('Project name must be a non-empty string');
        await expect(dataPersistence.saveProject({ id: 'test', name: 'Test' })).rejects.toThrow('Project working directory must be a non-empty string');
      });
    });

    describe('loadProject', () => {
      test('should load project successfully', async () => {
        const mockProject = {
          id: 'proj-1',
          name: 'Test Project',
          working_directory: '/path/to/project',
          created_date: '2023-01-01T00:00:00.000Z',
          last_modified: '2023-01-01T00:00:00.000Z'
        };

        mockDatabaseManager.executeQuery.mockResolvedValue([mockProject]);

        const result = await dataPersistence.loadProject('proj-1');

        expect(mockDatabaseManager.executeQuery).toHaveBeenCalledWith(
          'SELECT * FROM projects WHERE id = ?',
          ['proj-1']
        );
        expect(result.id).toBe('proj-1');
        expect(result.name).toBe('Test Project');
        expect(result.workingDirectory).toBe('/path/to/project');
        expect(result.createdDate).toBeInstanceOf(Date);
      });

      test('should return null if project not found', async () => {
        mockDatabaseManager.executeQuery.mockResolvedValue([]);

        const result = await dataPersistence.loadProject('nonexistent');

        expect(result).toBeNull();
      });

      test('should validate project ID', async () => {
        await expect(dataPersistence.loadProject('')).rejects.toThrow('Project ID must be a non-empty string');
        await expect(dataPersistence.loadProject(null)).rejects.toThrow('Project ID must be a non-empty string');
      });
    });

    describe('loadAllProjects', () => {
      test('should load all projects successfully', async () => {
        const mockProjects = [
          {
            id: 'proj-1',
            name: 'Project 1',
            working_directory: '/path/1',
            created_date: '2023-01-01T00:00:00.000Z',
            last_modified: '2023-01-01T00:00:00.000Z'
          },
          {
            id: 'proj-2',
            name: 'Project 2',
            working_directory: '/path/2',
            created_date: '2023-01-02T00:00:00.000Z',
            last_modified: '2023-01-02T00:00:00.000Z'
          }
        ];

        mockDatabaseManager.executeQuery.mockResolvedValue(mockProjects);

        const result = await dataPersistence.loadAllProjects();

        expect(mockDatabaseManager.executeQuery).toHaveBeenCalledWith(
          'SELECT * FROM projects ORDER BY last_modified DESC'
        );
        expect(result).toHaveLength(2);
        expect(result[0].id).toBe('proj-1');
        expect(result[1].id).toBe('proj-2');
      });
    });

    describe('deleteProject', () => {
      test('should delete project successfully', async () => {
        mockDatabaseManager.executeNonQuery.mockResolvedValue({ changes: 1 });

        const result = await dataPersistence.deleteProject('proj-1');

        expect(mockDatabaseManager.executeNonQuery).toHaveBeenCalledWith(
          'DELETE FROM projects WHERE id = ?',
          ['proj-1']
        );
        expect(result).toBe(true);
      });

      test('should return false if project not found', async () => {
        mockDatabaseManager.executeNonQuery.mockResolvedValue({ changes: 0 });

        const result = await dataPersistence.deleteProject('nonexistent');

        expect(result).toBe(false);
      });
    });

    describe('projectNameExists', () => {
      test('should return true if project name exists', async () => {
        mockDatabaseManager.executeQuery.mockResolvedValue([{ count: 1 }]);

        const result = await dataPersistence.projectNameExists('Existing Project');

        expect(result).toBe(true);
        expect(mockDatabaseManager.executeQuery).toHaveBeenCalledWith(
          'SELECT COUNT(*) as count FROM projects WHERE LOWER(name) = LOWER(?)',
          ['Existing Project']
        );
      });

      test('should return false if project name does not exist', async () => {
        mockDatabaseManager.executeQuery.mockResolvedValue([{ count: 0 }]);

        const result = await dataPersistence.projectNameExists('New Project');

        expect(result).toBe(false);
      });

      test('should exclude specific project ID when checking', async () => {
        mockDatabaseManager.executeQuery.mockResolvedValue([{ count: 0 }]);

        await dataPersistence.projectNameExists('Project Name', 'proj-1');

        expect(mockDatabaseManager.executeQuery).toHaveBeenCalledWith(
          'SELECT COUNT(*) as count FROM projects WHERE LOWER(name) = LOWER(?) AND id != ?',
          ['Project Name', 'proj-1']
        );
      });
    });
  });

  describe('source folder operations', () => {
    beforeEach(async () => {
      await dataPersistence.initialize();
    });

    describe('saveSourceFolder', () => {
      test('should save new source folder successfully', async () => {
        const sourceFolder = {
          id: 'folder-1',
          projectId: 'proj-1',
          path: '/path/to/source'
        };

        mockDatabaseManager.executeQuery.mockResolvedValue([]); // No existing folder
        mockDatabaseManager.executeNonQuery.mockResolvedValue({ lastID: 1, changes: 1 });
        mockDatabaseManager.executeQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{
          id: 'folder-1',
          project_id: 'proj-1',
          path: '/path/to/source',
          added_date: '2023-01-01T00:00:00.000Z'
        }]);

        const result = await dataPersistence.saveSourceFolder(sourceFolder);

        expect(mockDatabaseManager.executeNonQuery).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO source_folders'),
          expect.arrayContaining(['folder-1', 'proj-1', '/path/to/source'])
        );
        expect(result.id).toBe('folder-1');
        expect(result.projectId).toBe('proj-1');
      });

      test('should validate source folder object', async () => {
        await expect(dataPersistence.saveSourceFolder(null)).rejects.toThrow('Source folder must be an object');
        await expect(dataPersistence.saveSourceFolder({})).rejects.toThrow('Source folder ID must be a non-empty string');
        await expect(dataPersistence.saveSourceFolder({ id: 'test' })).rejects.toThrow('Source folder project ID must be a non-empty string');
        await expect(dataPersistence.saveSourceFolder({ id: 'test', projectId: 'proj' })).rejects.toThrow('Source folder path must be a non-empty string');
      });
    });

    describe('loadSourceFoldersForProject', () => {
      test('should load source folders for project successfully', async () => {
        const mockFolders = [
          {
            id: 'folder-1',
            project_id: 'proj-1',
            path: '/path/1',
            added_date: '2023-01-01T00:00:00.000Z'
          },
          {
            id: 'folder-2',
            project_id: 'proj-1',
            path: '/path/2',
            added_date: '2023-01-02T00:00:00.000Z'
          }
        ];

        mockDatabaseManager.executeQuery.mockResolvedValue(mockFolders);

        const result = await dataPersistence.loadSourceFoldersForProject('proj-1');

        expect(mockDatabaseManager.executeQuery).toHaveBeenCalledWith(
          'SELECT * FROM source_folders WHERE project_id = ? ORDER BY added_date ASC',
          ['proj-1']
        );
        expect(result).toHaveLength(2);
        expect(result[0].projectId).toBe('proj-1');
        expect(result[1].projectId).toBe('proj-1');
      });
    });
  });

  describe('view operations', () => {
    beforeEach(async () => {
      await dataPersistence.initialize();
    });

    describe('saveView', () => {
      test('should save new view successfully', async () => {
        const view = {
          id: 'view-1',
          projectId: 'proj-1',
          name: 'Test View',
          lastQuery: { filters: [] }
        };

        mockDatabaseManager.executeQuery.mockResolvedValue([]); // No existing view
        mockDatabaseManager.executeNonQuery.mockResolvedValue({ lastID: 1, changes: 1 });
        mockDatabaseManager.executeQuery.mockResolvedValueOnce([]).mockResolvedValueOnce([{
          id: 'view-1',
          project_id: 'proj-1',
          name: 'Test View',
          created_date: '2023-01-01T00:00:00.000Z',
          last_modified: '2023-01-01T00:00:00.000Z',
          last_query: '{"filters":[]}'
        }]);

        const result = await dataPersistence.saveView(view);

        expect(mockDatabaseManager.executeNonQuery).toHaveBeenCalledWith(
          expect.stringContaining('INSERT INTO views'),
          expect.arrayContaining(['view-1', 'proj-1', 'Test View'])
        );
        expect(result.id).toBe('view-1');
        expect(result.name).toBe('Test View');
        expect(result.lastQuery).toEqual({ filters: [] });
      });

      test('should validate view object', async () => {
        await expect(dataPersistence.saveView(null)).rejects.toThrow('View must be an object');
        await expect(dataPersistence.saveView({})).rejects.toThrow('View ID must be a non-empty string');
        await expect(dataPersistence.saveView({ id: 'test' })).rejects.toThrow('View project ID must be a non-empty string');
        await expect(dataPersistence.saveView({ id: 'test', projectId: 'proj' })).rejects.toThrow('View name must be a non-empty string');
      });
    });

    describe('viewNameExistsInProject', () => {
      test('should return true if view name exists in project', async () => {
        mockDatabaseManager.executeQuery.mockResolvedValue([{ count: 1 }]);

        const result = await dataPersistence.viewNameExistsInProject('proj-1', 'Existing View');

        expect(result).toBe(true);
        expect(mockDatabaseManager.executeQuery).toHaveBeenCalledWith(
          'SELECT COUNT(*) as count FROM views WHERE project_id = ? AND LOWER(name) = LOWER(?)',
          ['proj-1', 'Existing View']
        );
      });

      test('should return false if view name does not exist in project', async () => {
        mockDatabaseManager.executeQuery.mockResolvedValue([{ count: 0 }]);

        const result = await dataPersistence.viewNameExistsInProject('proj-1', 'New View');

        expect(result).toBe(false);
      });
    });
  });

  describe('error handling', () => {
    test('should throw error when not initialized', async () => {
      const uninitializedPersistence = new DataPersistence();
      
      await expect(uninitializedPersistence.loadAllProjects()).rejects.toThrow('DataPersistence not initialized');
    });

    test('should handle database errors gracefully', async () => {
      await dataPersistence.initialize();
      mockDatabaseManager.executeQuery.mockRejectedValue(new Error('Database error'));

      await expect(dataPersistence.loadAllProjects()).rejects.toThrow('Failed to load projects: Database error');
    });
  });

  describe('cleanup', () => {
    test('should close database connection', async () => {
      await dataPersistence.initialize();
      await dataPersistence.close();

      expect(mockDatabaseManager.closeDatabase).toHaveBeenCalled();
      expect(dataPersistence.isInitialized).toBe(false);
    });
  });
});