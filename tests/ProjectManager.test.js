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

// Mock DataPersistence
jest.mock('../src/main/DataPersistence');

const ProjectManager = require('../src/main/ProjectManager');
const DataPersistence = require('../src/main/DataPersistence');
const fs = require('fs');
const path = require('path');
const { v4: uuidv4 } = require('uuid');

describe('ProjectManager', () => {
  let projectManager;
  let mockDataPersistence;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup DataPersistence mock
    mockDataPersistence = {
      initialize: jest.fn().mockResolvedValue(),
      projectNameExists: jest.fn().mockResolvedValue(false),
      saveProject: jest.fn(),
      loadProject: jest.fn(),
      loadAllProjects: jest.fn(),
      deleteProject: jest.fn(),
      saveSourceFolder: jest.fn(),
      loadSourceFolder: jest.fn(),
      loadSourceFoldersForProject: jest.fn(),
      deleteSourceFolder: jest.fn(),
      loadViewsForProject: jest.fn(),
      close: jest.fn().mockResolvedValue()
    };
    
    DataPersistence.mockImplementation(() => mockDataPersistence);
    
    // Setup fs mock
    fs.existsSync.mockReturnValue(true);
    fs.mkdirSync.mockImplementation(() => {});
    fs.accessSync.mockImplementation(() => {});
    fs.statSync.mockReturnValue({ isDirectory: () => true });
    
    projectManager = new ProjectManager();
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      await projectManager.initialize();
      
      expect(mockDataPersistence.initialize).toHaveBeenCalled();
      expect(projectManager.isInitialized).toBe(true);
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
        workingDirectory: '/resolved/path',
        createdDate: expect.any(Date),
        lastModified: expect.any(Date)
      };

      mockDataPersistence.saveProject.mockResolvedValue(mockProject);

      const result = await projectManager.createProject('Test Project', '/test/path');

      expect(mockDataPersistence.projectNameExists).toHaveBeenCalledWith('Test Project');
      expect(mockDataPersistence.saveProject).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid-1234',
          name: 'Test Project',
          workingDirectory: expect.any(String)
        })
      );
      expect(result).toEqual(mockProject);
    });

    test('should create working directory if it does not exist', async () => {
      fs.existsSync.mockReturnValue(false);
      mockDataPersistence.saveProject.mockResolvedValue({});

      await projectManager.createProject('Test Project', '/new/path');

      expect(fs.mkdirSync).toHaveBeenCalledWith(expect.any(String), { recursive: true });
    });

    test('should throw error if project name already exists', async () => {
      mockDataPersistence.projectNameExists.mockResolvedValue(true);

      await expect(projectManager.createProject('Existing Project', '/test/path'))
        .rejects.toThrow('Project name "Existing Project" already exists');
    });

    test('should throw error if working directory creation fails', async () => {
      fs.existsSync.mockReturnValue(false);
      fs.mkdirSync.mockImplementation(() => {
        throw new Error('Permission denied');
      });

      await expect(projectManager.createProject('Test Project', '/invalid/path'))
        .rejects.toThrow('Failed to create working directory: Permission denied');
    });

    test('should throw error if working directory is not accessible', async () => {
      fs.accessSync.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(projectManager.createProject('Test Project', '/inaccessible/path'))
        .rejects.toThrow('Working directory is not accessible: Access denied');
    });

    test('should validate project name', async () => {
      await expect(projectManager.createProject('', '/test/path'))
        .rejects.toThrow('Project name must be a non-empty string');
      
      await expect(projectManager.createProject(null, '/test/path'))
        .rejects.toThrow('Project name must be a non-empty string');
      
      await expect(projectManager.createProject('Invalid<Name', '/test/path'))
        .rejects.toThrow('Project name contains invalid characters');
    });

    test('should validate working directory', async () => {
      await expect(projectManager.createProject('Test Project', ''))
        .rejects.toThrow('Working directory must be a non-empty string');
      
      await expect(projectManager.createProject('Test Project', null))
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
        createdDate: new Date(),
        lastModified: new Date()
      };

      mockDataPersistence.loadProject.mockResolvedValue(mockProject);

      const result = await projectManager.getProject('proj-1');

      expect(mockDataPersistence.loadProject).toHaveBeenCalledWith('proj-1');
      expect(result).toEqual(mockProject);
    });

    test('should return null if project not found', async () => {
      mockDataPersistence.loadProject.mockResolvedValue(null);

      const result = await projectManager.getProject('nonexistent');

      expect(result).toBeNull();
    });

    test('should validate project ID', async () => {
      await expect(projectManager.getProject('')).rejects.toThrow('Project ID must be a non-empty string');
      await expect(projectManager.getProject(null)).rejects.toThrow('Project ID must be a non-empty string');
    });
  });

  describe('getAllProjects', () => {
    beforeEach(async () => {
      await projectManager.initialize();
    });

    test('should get all projects successfully', async () => {
      const mockProjects = [
        { id: 'proj-1', name: 'Project 1' },
        { id: 'proj-2', name: 'Project 2' }
      ];

      mockDataPersistence.loadAllProjects.mockResolvedValue(mockProjects);

      const result = await projectManager.getAllProjects();

      expect(mockDataPersistence.loadAllProjects).toHaveBeenCalled();
      expect(result).toEqual(mockProjects);
    });
  });

  describe('updateProject', () => {
    beforeEach(async () => {
      await projectManager.initialize();
    });

    test('should update project name successfully', async () => {
      const existingProject = {
        id: 'proj-1',
        name: 'Old Name',
        workingDirectory: '/test/path',
        createdDate: new Date(),
        lastModified: new Date()
      };

      const updatedProject = {
        ...existingProject,
        name: 'New Name'
      };

      mockDataPersistence.loadProject.mockResolvedValue(existingProject);
      mockDataPersistence.saveProject.mockResolvedValue(updatedProject);

      const result = await projectManager.updateProject('proj-1', { name: 'New Name' });

      expect(mockDataPersistence.projectNameExists).toHaveBeenCalledWith('New Name', 'proj-1');
      expect(mockDataPersistence.saveProject).toHaveBeenCalledWith(
        expect.objectContaining({ name: 'New Name' })
      );
      expect(result).toEqual(updatedProject);
    });

    test('should update working directory successfully', async () => {
      const existingProject = {
        id: 'proj-1',
        name: 'Test Project',
        workingDirectory: '/old/path',
        createdDate: new Date(),
        lastModified: new Date()
      };

      mockDataPersistence.loadProject.mockResolvedValue(existingProject);
      mockDataPersistence.saveProject.mockResolvedValue(existingProject);

      await projectManager.updateProject('proj-1', { workingDirectory: '/new/path' });

      expect(mockDataPersistence.saveProject).toHaveBeenCalledWith(
        expect.objectContaining({ workingDirectory: expect.any(String) })
      );
    });

    test('should throw error if project not found', async () => {
      mockDataPersistence.loadProject.mockResolvedValue(null);

      await expect(projectManager.updateProject('nonexistent', { name: 'New Name' }))
        .rejects.toThrow('Project with ID "nonexistent" not found');
    });

    test('should throw error if new name already exists', async () => {
      const existingProject = { id: 'proj-1', name: 'Old Name' };
      mockDataPersistence.loadProject.mockResolvedValue(existingProject);
      mockDataPersistence.projectNameExists.mockResolvedValue(true);

      await expect(projectManager.updateProject('proj-1', { name: 'Existing Name' }))
        .rejects.toThrow('Project name "Existing Name" already exists');
    });

    test('should validate parameters', async () => {
      await expect(projectManager.updateProject('', {}))
        .rejects.toThrow('Project ID must be a non-empty string');
      
      await expect(projectManager.updateProject('proj-1', null))
        .rejects.toThrow('Updates must be an object');
    });
  });

  describe('deleteProject', () => {
    beforeEach(async () => {
      await projectManager.initialize();
    });

    test('should delete project successfully', async () => {
      const existingProject = { id: 'proj-1', name: 'Test Project' };
      mockDataPersistence.loadProject.mockResolvedValue(existingProject);
      mockDataPersistence.deleteProject.mockResolvedValue(true);

      const result = await projectManager.deleteProject('proj-1');

      expect(mockDataPersistence.deleteProject).toHaveBeenCalledWith('proj-1');
      expect(result).toBe(true);
    });

    test('should return false if project not found', async () => {
      mockDataPersistence.loadProject.mockResolvedValue(null);

      const result = await projectManager.deleteProject('nonexistent');

      expect(result).toBe(false);
    });

    test('should validate project ID', async () => {
      await expect(projectManager.deleteProject('')).rejects.toThrow('Project ID must be a non-empty string');
    });
  });

  describe('addSourceFolder', () => {
    beforeEach(async () => {
      await projectManager.initialize();
    });

    test('should add source folder successfully', async () => {
      const mockProject = { id: 'proj-1', name: 'Test Project' };
      const mockSourceFolder = {
        id: 'test-uuid-1234',
        projectId: 'proj-1',
        path: '/resolved/source/path',
        addedDate: expect.any(Date)
      };

      mockDataPersistence.loadProject.mockResolvedValue(mockProject);
      mockDataPersistence.loadSourceFoldersForProject.mockResolvedValue([]);
      mockDataPersistence.saveSourceFolder.mockResolvedValue(mockSourceFolder);

      const result = await projectManager.addSourceFolder('proj-1', '/source/path');

      expect(mockDataPersistence.saveSourceFolder).toHaveBeenCalledWith(
        expect.objectContaining({
          id: 'test-uuid-1234',
          projectId: 'proj-1',
          path: expect.any(String)
        })
      );
      expect(result).toEqual(mockSourceFolder);
    });

    test('should throw error if project not found', async () => {
      mockDataPersistence.loadProject.mockResolvedValue(null);

      await expect(projectManager.addSourceFolder('nonexistent', '/source/path'))
        .rejects.toThrow('Project with ID "nonexistent" not found');
    });

    test('should throw error if folder does not exist', async () => {
      const mockProject = { id: 'proj-1', name: 'Test Project' };
      mockDataPersistence.loadProject.mockResolvedValue(mockProject);
      fs.existsSync.mockReturnValue(false);

      await expect(projectManager.addSourceFolder('proj-1', '/nonexistent/path'))
        .rejects.toThrow('Folder path does not exist');
    });

    test('should throw error if path is not a directory', async () => {
      const mockProject = { id: 'proj-1', name: 'Test Project' };
      mockDataPersistence.loadProject.mockResolvedValue(mockProject);
      fs.statSync.mockReturnValue({ isDirectory: () => false });

      await expect(projectManager.addSourceFolder('proj-1', '/file/path'))
        .rejects.toThrow('Path is not a directory');
    });

    test('should throw error if folder is not accessible', async () => {
      const mockProject = { id: 'proj-1', name: 'Test Project' };
      mockDataPersistence.loadProject.mockResolvedValue(mockProject);
      fs.accessSync.mockImplementation(() => {
        throw new Error('Access denied');
      });

      await expect(projectManager.addSourceFolder('proj-1', '/inaccessible/path'))
        .rejects.toThrow('Folder is not accessible: Access denied');
    });

    test('should throw error if folder already added', async () => {
      const mockProject = { id: 'proj-1', name: 'Test Project' };
      // Mock path.resolve to return the same path for both calls
      const originalResolve = path.resolve;
      jest.spyOn(path, 'resolve').mockReturnValue('/resolved/source/path');
      
      const existingFolders = [{ path: '/resolved/source/path' }];
      
      mockDataPersistence.loadProject.mockResolvedValue(mockProject);
      mockDataPersistence.loadSourceFoldersForProject.mockResolvedValue(existingFolders);

      await expect(projectManager.addSourceFolder('proj-1', '/source/path'))
        .rejects.toThrow('already added to this project');
        
      // Restore original path.resolve
      path.resolve.mockRestore();
    });

    test('should validate parameters', async () => {
      await expect(projectManager.addSourceFolder('', '/path'))
        .rejects.toThrow('Project ID must be a non-empty string');
      
      await expect(projectManager.addSourceFolder('proj-1', ''))
        .rejects.toThrow('Folder path must be a non-empty string');
    });
  });

  describe('removeSourceFolder', () => {
    beforeEach(async () => {
      await projectManager.initialize();
    });

    test('should remove source folder successfully', async () => {
      const mockProject = { id: 'proj-1', name: 'Test Project' };
      const mockSourceFolder = { id: 'folder-1', projectId: 'proj-1', path: '/source/path' };

      mockDataPersistence.loadProject.mockResolvedValue(mockProject);
      mockDataPersistence.loadSourceFolder.mockResolvedValue(mockSourceFolder);
      mockDataPersistence.deleteSourceFolder.mockResolvedValue(true);

      const result = await projectManager.removeSourceFolder('proj-1', 'folder-1');

      expect(mockDataPersistence.deleteSourceFolder).toHaveBeenCalledWith('folder-1');
      expect(result).toBe(true);
    });

    test('should return false if source folder not found', async () => {
      const mockProject = { id: 'proj-1', name: 'Test Project' };
      mockDataPersistence.loadProject.mockResolvedValue(mockProject);
      mockDataPersistence.loadSourceFolder.mockResolvedValue(null);

      const result = await projectManager.removeSourceFolder('proj-1', 'nonexistent');

      expect(result).toBe(false);
    });

    test('should throw error if source folder does not belong to project', async () => {
      const mockProject = { id: 'proj-1', name: 'Test Project' };
      const mockSourceFolder = { id: 'folder-1', projectId: 'other-proj', path: '/source/path' };

      mockDataPersistence.loadProject.mockResolvedValue(mockProject);
      mockDataPersistence.loadSourceFolder.mockResolvedValue(mockSourceFolder);

      await expect(projectManager.removeSourceFolder('proj-1', 'folder-1'))
        .rejects.toThrow('Source folder does not belong to project "proj-1"');
    });

    test('should validate parameters', async () => {
      await expect(projectManager.removeSourceFolder('', 'folder-1'))
        .rejects.toThrow('Project ID must be a non-empty string');
      
      await expect(projectManager.removeSourceFolder('proj-1', ''))
        .rejects.toThrow('Source folder ID must be a non-empty string');
    });
  });

  describe('getSourceFolders', () => {
    beforeEach(async () => {
      await projectManager.initialize();
    });

    test('should get source folders successfully', async () => {
      const mockFolders = [
        { id: 'folder-1', projectId: 'proj-1', path: '/path1' },
        { id: 'folder-2', projectId: 'proj-1', path: '/path2' }
      ];

      mockDataPersistence.loadSourceFoldersForProject.mockResolvedValue(mockFolders);

      const result = await projectManager.getSourceFolders('proj-1');

      expect(mockDataPersistence.loadSourceFoldersForProject).toHaveBeenCalledWith('proj-1');
      expect(result).toEqual(mockFolders);
    });

    test('should validate project ID', async () => {
      await expect(projectManager.getSourceFolders('')).rejects.toThrow('Project ID must be a non-empty string');
    });
  });

  describe('getCompleteProject', () => {
    beforeEach(async () => {
      await projectManager.initialize();
    });

    test('should get complete project successfully', async () => {
      const mockProject = { id: 'proj-1', name: 'Test Project' };
      const mockSourceFolders = [{ id: 'folder-1', path: '/path1' }];
      const mockViews = [{ id: 'view-1', name: 'View 1' }];

      mockDataPersistence.loadProject.mockResolvedValue(mockProject);
      mockDataPersistence.loadSourceFoldersForProject.mockResolvedValue(mockSourceFolders);
      mockDataPersistence.loadViewsForProject.mockResolvedValue(mockViews);

      const result = await projectManager.getCompleteProject('proj-1');

      expect(result).toEqual({
        ...mockProject,
        sourceFolders: mockSourceFolders,
        views: mockViews
      });
    });

    test('should return null if project not found', async () => {
      mockDataPersistence.loadProject.mockResolvedValue(null);

      const result = await projectManager.getCompleteProject('nonexistent');

      expect(result).toBeNull();
    });
  });

  describe('isProjectNameAvailable', () => {
    beforeEach(async () => {
      await projectManager.initialize();
    });

    test('should return true if name is available', async () => {
      mockDataPersistence.projectNameExists.mockResolvedValue(false);

      const result = await projectManager.isProjectNameAvailable('Available Name');

      expect(result).toBe(true);
    });

    test('should return false if name is not available', async () => {
      mockDataPersistence.projectNameExists.mockResolvedValue(true);

      const result = await projectManager.isProjectNameAvailable('Taken Name');

      expect(result).toBe(false);
    });
  });

  describe('error handling', () => {
    test('should throw error when not initialized', async () => {
      const uninitializedManager = new ProjectManager();
      
      await expect(uninitializedManager.getAllProjects()).rejects.toThrow('ProjectManager not initialized');
    });
  });

  describe('cleanup', () => {
    test('should close data persistence', async () => {
      await projectManager.initialize();
      await projectManager.close();

      expect(mockDataPersistence.close).toHaveBeenCalled();
      expect(projectManager.isInitialized).toBe(false);
    });
  });
});