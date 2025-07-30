import { DataPersistence } from '../src/main/DataPersistence';
import { Project } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { createTempConfigPath } from './setup';

// Mock fs module
jest.mock('fs', () => ({
  existsSync: jest.fn(),
  mkdirSync: jest.fn(),
  readFileSync: jest.fn(),
  writeFileSync: jest.fn(),
  promises: {
    mkdir: jest.fn().mockResolvedValue(undefined),
    readFile: jest.fn().mockResolvedValue('{"projects":[]}'),
    writeFile: jest.fn().mockResolvedValue(undefined)
  }
}));

// Mock DigrConfigManager
jest.mock('../src/main/DigrConfigManager', () => {
  return {
    DigrConfigManager: jest.fn().mockImplementation(() => {
      return {
        initialize: jest.fn().mockResolvedValue(undefined),
        getConfig: jest.fn().mockResolvedValue({ projects: [] }),
        addProject: jest.fn().mockResolvedValue(undefined),
        removeProject: jest.fn().mockResolvedValue(undefined),
        saveConfig: jest.fn().mockResolvedValue(undefined)
      };
    })
  };
});

// Create a temporary test config path
const TEST_CONFIG_PATH = createTempConfigPath();

// Mock uuid
jest.mock('uuid', () => ({
  v4: jest.fn().mockReturnValue('mock-uuid')
}));

const mockFs = fs as jest.Mocked<typeof fs>;

describe('DataPersistence', () => {
  let dataPersistence: DataPersistence;
  let testDataDir: string;

  beforeEach(() => {
    jest.clearAllMocks();
    
    // Setup fs mock
    jest.spyOn(fs, 'existsSync').mockReturnValue(true);
    jest.spyOn(fs, 'mkdirSync').mockImplementation(() => undefined);
    jest.spyOn(fs, 'readFileSync').mockReturnValue('{"projects":[]}');
    jest.spyOn(fs, 'writeFileSync').mockImplementation(() => {});
    jest.spyOn(fs.promises, 'mkdir').mockResolvedValue(undefined);
    jest.spyOn(fs.promises, 'readFile').mockResolvedValue('{"projects":[]}');
    jest.spyOn(fs.promises, 'writeFile').mockResolvedValue(undefined);
    
    // Create DataPersistence with test config path
    dataPersistence = new DataPersistence(TEST_CONFIG_PATH);
    testDataDir = '/tmp/test-app-data';
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      await dataPersistence.initialize();
      
      expect((dataPersistence as any).isInitialized).toBe(true);
    });

    // Skip these tests since we're now using DigrConfigManager for initialization
    test.skip('should create data directory if it does not exist', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      
      await dataPersistence.initialize();
      
      expect(mockFs.mkdirSync).toHaveBeenCalledWith(testDataDir, { recursive: true });
    });

    test.skip('should throw error if initialization fails', async () => {
      jest.spyOn(fs, 'existsSync').mockReturnValue(false);
      jest.spyOn(fs.promises, 'mkdir').mockRejectedValue(new Error('Permission denied'));
      
      await expect(dataPersistence.initialize()).rejects.toThrow('Failed to initialize data persistence');
    });
  });

  describe('project registry operations', () => {
    beforeEach(async () => {
      await dataPersistence.initialize();
    });

    describe('loadProjectRegistry', () => {
      test('should load project registry successfully', async () => {
        // Mock DigrConfigManager.getConfig to return a project
        const mockProjects = [
          {
            path: '/path/to/project'
          }
        ];
        
        // Mock the DigrConfigManager.getConfig method
        (dataPersistence as any).digrConfigManager.getConfig.mockResolvedValue({ projects: mockProjects });
        
        // Mock uuid to return a consistent ID
        jest.spyOn(require('uuid'), 'v4').mockReturnValue('proj-1');

        const result = await dataPersistence.loadProjectRegistry();

        expect(result).toHaveLength(1);
        expect(result[0]?.id).toBe('proj-1');
        expect(result[0]?.name).toBe('project'); // Name is derived from path basename
        expect(result[0]?.workingDirectory).toBe('/path/to/project');
        expect(result[0]?.sourceFolders).toHaveLength(0);
        expect(result[0]?.createdDate).toBeInstanceOf(Date);
        expect(result[0]?.lastModified).toBeInstanceOf(Date);
      });

      test('should return empty array if registry file does not exist', async () => {
        jest.spyOn(fs, 'existsSync').mockReturnValue(false);

        const result = await dataPersistence.loadProjectRegistry();

        expect(result).toEqual([]);
      });

      test('should handle invalid JSON gracefully', async () => {
        jest.spyOn(fs, 'readFileSync').mockReturnValue('invalid json');
        jest.spyOn(fs.promises, 'readFile').mockResolvedValue('invalid json');

        const result = await dataPersistence.loadProjectRegistry();

        expect(result).toEqual([]);
      });
    });

    // No longer testing saveProjectRegistry as it's been removed

    describe('addProjectToRegistry', () => {
      test('should add project to registry successfully', async () => {
        const project: Project = {
          id: 'proj-1',
          name: 'Test Project',
          workingDirectory: '/path/to/project',
          sourceFolders: [],
          createdDate: new Date('2023-01-01'),
          lastModified: new Date('2023-01-01')
        };

        await dataPersistence.addProjectToRegistry(project);

        // Verify that digrConfigManager.addProject was called
        expect((dataPersistence as any).digrConfigManager.addProject).toHaveBeenCalledWith(project.workingDirectory);
        
        // Verify that the project was added to the cache
        expect((dataPersistence as any).projectCache.get('proj-1')).toBeDefined();
      });

      test('should validate project object', async () => {
        await expect(dataPersistence.addProjectToRegistry(null as any)).rejects.toThrow('Project must be an object');
        await expect(dataPersistence.addProjectToRegistry({} as any)).rejects.toThrow('Project ID must be a non-empty string');
      });
    });

    describe('removeProjectFromRegistry', () => {
      test('should remove project from registry successfully', async () => {
        // Set up the cache with a project
        const project = {
          id: 'proj-1',
          name: 'Test Project',
          workingDirectory: '/path/to/project',
          sourceFolders: [],
          createdDate: new Date('2023-01-01'),
          lastModified: new Date('2023-01-01')
        };
        (dataPersistence as any).projectCache.set('proj-1', project);
        
        await dataPersistence.removeProjectFromRegistry('proj-1');
        
        // Verify that digrConfigManager.removeProject was called
        expect((dataPersistence as any).digrConfigManager.removeProject).toHaveBeenCalledWith('/path/to/project');
        
        // Verify that the project was removed from the cache
        expect((dataPersistence as any).projectCache.has('proj-1')).toBe(false);
      });

      test('should not throw if project not found', async () => {
        // Mock loadProjectRegistry to return a project
        jest.spyOn(dataPersistence, 'loadProjectRegistry').mockResolvedValue([{
          id: 'proj-1',
          name: 'Test Project',
          workingDirectory: '/path/to/project',
          sourceFolders: [],
          createdDate: new Date('2023-01-01'),
          lastModified: new Date('2023-01-01')
        }]);
        
        await expect(dataPersistence.removeProjectFromRegistry('proj-1')).resolves.not.toThrow();
        expect((dataPersistence as any).digrConfigManager.removeProject).toHaveBeenCalled();
      });

      test('should validate project ID', async () => {
        await expect(dataPersistence.removeProjectFromRegistry('')).rejects.toThrow('Project ID must be a non-empty string');
        await expect(dataPersistence.removeProjectFromRegistry(null as any)).rejects.toThrow('Project ID must be a non-empty string');
      });
    });
  });

  describe('error handling', () => {
    test('should throw error when not initialized', async () => {
      // Use test config path for uninitializedPersistence as well
      const uninitializedPersistence = new DataPersistence(TEST_CONFIG_PATH);
      
      await expect(uninitializedPersistence.loadProjectRegistry()).rejects.toThrow('DataPersistence not initialized');
    });

    test('should handle file system errors gracefully', async () => {
      await dataPersistence.initialize();
      // Mock existsSync to return true so we attempt to read the file
      jest.spyOn(fs, 'existsSync').mockReturnValue(true);
      
      // Mock readFileSync to throw an error with code ENOENT
      jest.spyOn(fs, 'readFileSync').mockImplementation(() => {
        const error = new Error('File system error') as NodeJS.ErrnoException;
        error.code = 'ENOENT';
        throw error;
      });
      
      // Mock promises.readFile to reject with the same error
      const fsError = new Error('File system error') as NodeJS.ErrnoException;
      fsError.code = 'ENOENT';
      jest.spyOn(fs.promises, 'readFile').mockRejectedValue(fsError);

      const result = await dataPersistence.loadProjectRegistry();
      expect(result).toEqual([]);
    });
  });

  describe('additional functionality', () => {
    test('should check if project name exists', async () => {
      await dataPersistence.initialize();
      
      // Mock loadProjectRegistry to return a project
      jest.spyOn(dataPersistence, 'loadProjectRegistry').mockResolvedValue([
        {
          id: 'proj-1',
          name: 'Test Project',
          workingDirectory: '/path/to/project',
          sourceFolders: [],
          createdDate: new Date('2023-01-01'),
          lastModified: new Date('2023-01-01')
        }
      ]);
      
      const exists = await dataPersistence.projectNameExists('Test Project');
      expect(exists).toBe(true);
      
      const notExists = await dataPersistence.projectNameExists('Non-existent Project');
      expect(notExists).toBe(false);
      
      // Test with exclude project ID
      const existsButExcluded = await dataPersistence.projectNameExists('Test Project', 'proj-1');
      expect(existsButExcluded).toBe(false);
    });
    
    test('should update project in registry', async () => {
      await dataPersistence.initialize();
      
      // Set up the cache with a project
      const project = {
        id: 'proj-1',
        name: 'Test Project',
        workingDirectory: '/path/to/project',
        sourceFolders: [],
        createdDate: new Date('2023-01-01'),
        lastModified: new Date('2023-01-01')
      };
      (dataPersistence as any).projectCache.set('proj-1', project);
      
      await dataPersistence.updateProjectInRegistry('proj-1', { name: 'Updated Project' });
      
      // Verify that the project was updated in the cache
      const updatedProject = (dataPersistence as any).projectCache.get('proj-1');
      expect(updatedProject.name).toBe('Updated Project');
    });
    
    test('should throw when updating non-existent project', async () => {
      await dataPersistence.initialize();
      
      // Mock loadProjectRegistry to return empty array
      jest.spyOn(dataPersistence, 'loadProjectRegistry').mockResolvedValue([]);
      
      await expect(dataPersistence.updateProjectInRegistry('non-existent', { name: 'Updated Project' }))
        .rejects.toThrow('Project with ID non-existent not found');
    });
  });
});
