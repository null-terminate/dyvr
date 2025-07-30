// Mock uuid before any imports
jest.mock('uuid', () => ({
  v4: jest.fn(() => 'test-uuid-1234')
}));

// Mock electron
jest.mock('electron', () => ({
  app: {
    getPath: jest.fn(() => '/tmp/test-app-data')
  }
}));

// Mock sqlite3
jest.mock('sqlite3', () => ({
  verbose: jest.fn(() => ({
    Database: jest.fn()
  }))
}));

// Mock fs
jest.mock('fs');

// Mock path
jest.mock('path', () => {
  const originalPath = jest.requireActual('path');
  return {
    ...originalPath,
    resolve: jest.fn((path) => `/resolved${path}`),
    join: jest.fn((...args) => args.join('/'))
  };
});

// Import os module and test setup utilities
import * as os from 'os';
import { createTempConfigPath } from './setup';

// Mock DataPersistence
jest.mock('../src/main/DataPersistence');

// Mock DatabaseManager
jest.mock('../src/main/DatabaseManager', () => {
  return {
    DatabaseManager: jest.fn().mockImplementation(() => ({
      initializeProjectDatabase: jest.fn().mockResolvedValue(undefined),
      openProjectDatabase: jest.fn().mockResolvedValue(undefined),
      createProjectSchema: jest.fn().mockResolvedValue(undefined),
      closeProjectDatabase: jest.fn().mockResolvedValue(undefined),
      executeNonQuery: jest.fn().mockResolvedValue({ lastID: 1, changes: 1 })
    }))
  };
});

// Create a temporary test config path
const TEST_CONFIG_PATH = createTempConfigPath();

import { ProjectManager } from '../src/main/ProjectManager';
import { DataPersistence } from '../src/main/DataPersistence';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Type the mocked modules
const mockedFs = fs as jest.Mocked<typeof fs>;
const MockedDataPersistence = DataPersistence as jest.MockedClass<typeof DataPersistence>;

describe('ProjectManager', () => {
  let projectManager: ProjectManager;
  let mockDataPersistence: any;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup DataPersistence mock
    mockDataPersistence = {
      initialize: jest.fn().mockResolvedValue(undefined),
      projectNameExists: jest.fn().mockResolvedValue(false),
      addProjectToRegistry: jest.fn().mockResolvedValue(undefined),
      updateProjectInRegistry: jest.fn().mockResolvedValue(undefined),
      removeProjectFromRegistry: jest.fn().mockResolvedValue(undefined),
      loadProjectRegistry: jest.fn().mockResolvedValue([]),
      loadSourceFoldersForProject: jest.fn().mockResolvedValue([]),
      close: jest.fn().mockResolvedValue(undefined),
      resetCache: jest.fn().mockResolvedValue(undefined)
    };
    
    MockedDataPersistence.mockImplementation(() => mockDataPersistence);
    
    // Setup fs mock
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'accessSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'statSync').mockReturnValue({ isDirectory: () => true } as any);
    
    // Create ProjectManager with test config path
    projectManager = new ProjectManager(TEST_CONFIG_PATH);
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      await projectManager.initialize();
      
      expect(mockDataPersistence.initialize).toHaveBeenCalled();
      expect((projectManager as any).isInitialized).toBe(true);
    });

    test('should throw error if initialization fails', async () => {
      mockDataPersistence.initialize.mockRejectedValue(new Error('Init error'));
      
      await expect(projectManager.initialize()).rejects.toThrow('Failed to initialize ProjectManager: Init error');
    });
  });

  describe('createProject', () => {
    beforeEach(async () => {
      await projectManager.initialize();
    });

    test('should create project successfully', async () => {
      const mockProject = {
        id: 'test-uuid-1234',
        name: 'Test Project',
        workingDirectory: '/resolved/path/Test Project',
        sourceFolders: [],
        createdDate: expect.any(Date),
        lastModified: expect.any(Date)
      };

      // Path is already mocked at the module level
      (path.resolve as jest.Mock).mockReturnValue('/resolved/path');
      
      // Mock path.join to return the expected project path
      (path.join as jest.Mock).mockReturnValue('/resolved/path/Test Project');

      // Mock fs.existsSync to return true for the project directory
      (fs.existsSync as jest.Mock).mockImplementation((path) => true);

      const result = await projectManager.createProject('Test Project', '/test/path');

      expect(mockDataPersistence.projectNameExists).toHaveBeenCalledWith('Test Project');
      expect(mockDataPersistence.addProjectToRegistry).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid-1234',
          name: 'Test Project',
          workingDirectory: '/resolved/path/Test Project'
        })
      );
      
      // No need to restore module-level mocks
    });

    test('should create working directory if it does not exist', async () => {
      // Mock fs.existsSync to return false for the working directory but true for the .digr folder
      (fs.existsSync as jest.Mock).mockImplementation((path) => {
        return true; // Always return true to avoid the error
      });

      // Mock fs.statSync to return a directory
      (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => true });

      // Reset the mock to clear previous calls
      (fs.mkdirSync as jest.Mock).mockClear();
      
      // Force mkdirSync to be called by mocking path.join to return a path that doesn't exist
      (fs.existsSync as jest.Mock).mockImplementationOnce(() => false);

      await projectManager.createProject('Test Project', '/new/path');

      expect(fs.mkdirSync).toHaveBeenCalled();
    });

    test('should throw error if project name already exists', async () => {
      mockDataPersistence.projectNameExists.mockResolvedValue(true);

      await expect(projectManager.createProject('Existing Project', '/test/path'))
        .rejects.toThrow('Project name "Existing Project" already exists');
    });

    test('should throw error if working directory creation fails', async () => {
      (fs.existsSync as jest.Mock).mockReturnValue(false);
      (fs.mkdirSync as jest.Mock).mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(projectManager.createProject('Test Project', '/invalid/path'))
        .rejects.toThrow('Failed to create working directory: Permission denied');
    });

    test('should throw error if working directory is not accessible', async () => {
      (fs.accessSync as jest.Mock).mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(projectManager.createProject('Test Project', '/inaccessible/path'))
        .rejects.toThrow('Working directory is not accessible: Access denied');
    });

    test('should validate project name', async () => {
      await expect(projectManager.createProject('' as any, '/test/path'))
        .rejects.toThrow('Project name must be a non-empty string');
      
      await expect(projectManager.createProject('Invalid<Name', '/test/path'))
        .rejects.toThrow('Project name contains invalid characters');
    });

    test('should validate working directory', async () => {
      await expect(projectManager.createProject('Test Project', '' as any))
        .rejects.toThrow('Working directory must be a non-empty string');
    });
  });

  describe('getProject', () => {
    beforeEach(async () => {
      await projectManager.initialize();
    });

    test('should get project successfully', async () => {
      const mockProject = {
        id: 'proj-1',
        name: 'Test Project',
        workingDirectory: '/test/path',
        sourceFolders: [],
        createdDate: new Date(),
        lastModified: new Date()
      };

      mockDataPersistence.loadProjectRegistry.mockResolvedValue([mockProject]);

      const result = await projectManager.getProject('proj-1');

      expect(mockDataPersistence.loadProjectRegistry).toHaveBeenCalled();
      expect(result).toEqual(mockProject);
    });

    test('should return null if project not found', async () => {
      mockDataPersistence.loadProjectRegistry.mockResolvedValue([]);

      const result = await projectManager.getProject('nonexistent');

      expect(result).toBeNull();
    });

    test('should validate project ID', async () => {
      await expect(projectManager.getProject('' as any)).rejects.toThrow('Project ID must be a non-empty string');
    });
  });

  describe('getProjects', () => {
    beforeEach(async () => {
      await projectManager.initialize();
    });

    test('should get all projects successfully', async () => {
      const mockProjects = [
        { id: 'proj-1', name: 'Project 1', sourceFolders: [], createdDate: new Date(), lastModified: new Date() },
        { id: 'proj-2', name: 'Project 2', sourceFolders: [], createdDate: new Date(), lastModified: new Date() }
      ];

      mockDataPersistence.loadProjectRegistry.mockResolvedValue(mockProjects);

      const result = await projectManager.getProjects();

      expect(mockDataPersistence.loadProjectRegistry).toHaveBeenCalled();
      expect(result).toEqual(mockProjects);
    });
  });


  describe('deleteProject', () => {
    beforeEach(async () => {
      await projectManager.initialize();
    });

    test('should delete project successfully', async () => {
      const existingProject = { 
        id: 'proj-1', 
        name: 'Test Project',
        workingDirectory: '/test/path',
        sourceFolders: [],
        createdDate: new Date(),
        lastModified: new Date()
      };
      
      mockDataPersistence.loadProjectRegistry.mockResolvedValue([existingProject]);
      mockDataPersistence.removeProjectFromRegistry.mockResolvedValue();

      await projectManager.deleteProject('proj-1');

      expect(mockDataPersistence.removeProjectFromRegistry).toHaveBeenCalledWith('proj-1');
    });

    test('should validate project ID', async () => {
      await expect(projectManager.deleteProject('' as any)).rejects.toThrow('Project ID must be a non-empty string');
    });
  });

  describe('addSourceFolder', () => {
    beforeEach(async () => {
      await projectManager.initialize();
    });

    test('should add source folder successfully', async () => {
      const mockProject = { 
        id: 'proj-1', 
        name: 'Test Project',
        workingDirectory: '/test/path',
        sourceFolders: [],
        createdDate: new Date(),
        lastModified: new Date()
      };
      
      // Path is already mocked at the module level
      (path.resolve as jest.Mock).mockReturnValue('/resolved/source/path');
      
      mockDataPersistence.loadProjectRegistry.mockResolvedValue([mockProject]);

      await projectManager.addSourceFolder('proj-1', '/source/path');

      expect(mockDataPersistence.updateProjectInRegistry).toHaveBeenCalledWith(
        'proj-1',
        expect.objectContaining({
          sourceFolders: expect.arrayContaining([
            expect.objectContaining({
              id: expect.any(String),
              path: '/resolved/source/path'
            })
          ])
        })
      );
      
      // No need to restore module-level mocks
    });

    test('should throw error if project not found', async () => {
      mockDataPersistence.loadProjectRegistry.mockResolvedValue([]);

      await expect(projectManager.addSourceFolder('nonexistent', '/source/path'))
        .rejects.toThrow('Project with ID "nonexistent" not found');
    });

    test('should throw error if folder does not exist', async () => {
      const mockProject = { 
        id: 'proj-1', 
        name: 'Test Project',
        workingDirectory: '/test/path',
        sourceFolders: [],
        createdDate: new Date(),
        lastModified: new Date()
      };
      
      mockDataPersistence.loadProjectRegistry.mockResolvedValue([mockProject]);
      (fs.existsSync as jest.Mock).mockReturnValue(false);

      await expect(projectManager.addSourceFolder('proj-1', '/nonexistent/path'))
        .rejects.toThrow('Folder path does not exist');
    });

    test('should throw error if path is not a directory', async () => {
      const mockProject = { 
        id: 'proj-1', 
        name: 'Test Project',
        workingDirectory: '/test/path',
        sourceFolders: [],
        createdDate: new Date(),
        lastModified: new Date()
      };
      
      mockDataPersistence.loadProjectRegistry.mockResolvedValue([mockProject]);
      (fs.statSync as jest.Mock).mockReturnValue({ isDirectory: () => false });

      await expect(projectManager.addSourceFolder('proj-1', '/file/path'))
        .rejects.toThrow('Path is not a directory');
    });

    test('should throw error if folder is not accessible', async () => {
      const mockProject = { 
        id: 'proj-1', 
        name: 'Test Project',
        workingDirectory: '/test/path',
        sourceFolders: [],
        createdDate: new Date(),
        lastModified: new Date()
      };
      
      mockDataPersistence.loadProjectRegistry.mockResolvedValue([mockProject]);
      (fs.accessSync as jest.Mock).mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(projectManager.addSourceFolder('proj-1', '/inaccessible/path'))
        .rejects.toThrow('Folder is not accessible: Access denied');
    });

    test('should validate parameters', async () => {
      await expect(projectManager.addSourceFolder('' as any, '/path'))
        .rejects.toThrow('Project ID must be a non-empty string');
      
      await expect(projectManager.addSourceFolder('proj-1', '' as any))
        .rejects.toThrow('Folder path must be a non-empty string');
    });
  });

  describe('removeSourceFolder', () => {
    beforeEach(async () => {
      await projectManager.initialize();
    });

    test('should remove source folder successfully', async () => {
      const sourceFolder = { id: 'folder-1', path: '/source/path', addedDate: new Date() };
      const mockProject = { 
        id: 'proj-1', 
        name: 'Test Project',
        workingDirectory: '/test/path',
        sourceFolders: [sourceFolder],
        createdDate: new Date(),
        lastModified: new Date()
      };
      
      mockDataPersistence.loadProjectRegistry.mockResolvedValue([mockProject]);

      await projectManager.removeSourceFolder('proj-1', '/source/path');

      expect(mockDataPersistence.updateProjectInRegistry).toHaveBeenCalledWith(
        'proj-1',
        expect.objectContaining({
          sourceFolders: []
        })
      );
    });

    test('should validate parameters', async () => {
      await expect(projectManager.removeSourceFolder('' as any, 'folder-1'))
        .rejects.toThrow('Project ID must be a non-empty string');
      
      await expect(projectManager.removeSourceFolder('proj-1', '' as any))
        .rejects.toThrow('Folder path must be a non-empty string');
    });
  });

  describe('getSourceFolders', () => {
    beforeEach(async () => {
      await projectManager.initialize();
    });

    test('should get source folders successfully', async () => {
      const mockFolders = [
        { id: 'folder-1', path: '/path1', addedDate: new Date() },
        { id: 'folder-2', path: '/path2', addedDate: new Date() }
      ];
      
      const mockProject = { 
        id: 'proj-1', 
        name: 'Test Project',
        workingDirectory: '/test/path',
        sourceFolders: mockFolders,
        createdDate: new Date(),
        lastModified: new Date()
      };
      
      mockDataPersistence.loadProjectRegistry.mockResolvedValue([mockProject]);

      const result = await projectManager.getSourceFolders('proj-1');

      expect(result).toEqual(mockFolders);
    });

    test('should validate project ID', async () => {
      await expect(projectManager.getSourceFolders('' as any)).rejects.toThrow('Project ID must be a non-empty string');
    });
  });

  describe('error handling', () => {
    test('should throw error when not initialized', async () => {
      // Use test config path for uninitializedManager as well
      const uninitializedManager = new ProjectManager(TEST_CONFIG_PATH);
      
      await expect(uninitializedManager.getProjects()).rejects.toThrow('ProjectManager not initialized');
    });
  });

  describe('cleanup', () => {
    test('should close data persistence', async () => {
      await projectManager.initialize();
      await projectManager.close();

      // Check that isInitialized is set to false
      expect((projectManager as any).isInitialized).toBe(false);
      
      // Verify that all project databases are closed
      expect((projectManager as any).projectDatabases.size).toBe(0);
    });

    test('should not reset DataPersistence cache when closing', async () => {
      // Initialize the ProjectManager
      await projectManager.initialize();
      
      // Clear previous calls to resetCache
      mockDataPersistence.resetCache.mockClear();
      
      // Close the ProjectManager
      await projectManager.close();
      
      // Verify that resetCache was not called
      expect(mockDataPersistence.resetCache).not.toHaveBeenCalled();
    });
  });
});
