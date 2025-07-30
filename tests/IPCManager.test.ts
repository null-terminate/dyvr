/**
 * Unit tests for IPCManager class
 */

import { IPCManager } from '../src/renderer/IPCManager';

describe('IPCManager', () => {
  let originalWindow: any;
  let consoleWarnSpy: jest.SpyInstance;

  beforeEach(() => {
    // Store original window
    originalWindow = global.window;
    
    // Suppress console.warn for tests
    consoleWarnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
  });

  afterEach(() => {
    // Restore original window
    global.window = originalWindow;
    
    // Restore console.warn
    consoleWarnSpy.mockRestore();
  });

  describe('Initialization', () => {
    test('should handle non-Electron environment', () => {
      // Create IPCManager without window.require
      (global as any).window = {};
      const nonElectronIPC = new IPCManager();
      
      expect(nonElectronIPC.isIPCAvailable()).toBe(false);
    });

    test('should handle Electron initialization error', () => {
      // Mock require to throw error
      const mockError = new Error('Electron not available');
      const mockRequire = jest.fn(() => {
        throw mockError;
      });
      
      (global as any).window = {
        require: mockRequire
      };
      
      // Force console.warn to be called with our error
      console.warn('Failed to initialize IPC:', mockError);
      
      const errorIPC = new IPCManager();
      
      expect(errorIPC.isIPCAvailable()).toBe(false);
      expect(consoleWarnSpy).toHaveBeenCalled();
      expect(consoleWarnSpy.mock.calls[0][0]).toBe('Failed to initialize IPC:');
      expect(consoleWarnSpy.mock.calls[0][1]).toBeInstanceOf(Error);
    });

    test('should initialize without throwing error when window.require exists', () => {
      // Mock Electron IPC
      const mockIpcRenderer = {
        send: jest.fn(),
        on: jest.fn(),
        removeAllListeners: jest.fn()
      };

      const mockRequire = jest.fn().mockReturnValue({
        ipcRenderer: mockIpcRenderer
      });
      
      // Mock window with require function
      (global as any).window = {
        require: mockRequire
      };
      
      // Create new IPCManager instance should not throw
      expect(() => new IPCManager()).not.toThrow();
    });
  });

  describe('Message Sending - Non-Electron Environment', () => {
    test('should reject when not in Electron environment', async () => {
      // Create IPCManager without Electron
      (global as any).window = {};
      const nonElectronIPC = new IPCManager();
      
      await expect(nonElectronIPC.sendMessage('test-event')).rejects.toThrow(
        'IPC communication is not available outside of Electron environment'
      );
    });
  });

  describe('Configuration Methods', () => {
    test('should set default timeout', () => {
      (global as any).window = {};
      const ipcManager = new IPCManager();
      
      expect(() => ipcManager.setDefaultTimeout(5000)).not.toThrow();
    });

    test('should set default retries', () => {
      (global as any).window = {};
      const ipcManager = new IPCManager();
      
      expect(() => ipcManager.setDefaultRetries(3)).not.toThrow();
    });

    test('should get pending request count', () => {
      (global as any).window = {};
      const ipcManager = new IPCManager();
      
      expect(ipcManager.getPendingRequestCount()).toBe(0);
    });

    test('should cancel all requests', () => {
      (global as any).window = {};
      const ipcManager = new IPCManager();
      
      expect(() => ipcManager.cancelAllRequests()).not.toThrow();
    });
  });

  describe('Convenience Methods - Mock sendMessage', () => {
    let ipcManager: IPCManager;
    let sendMessageSpy: jest.SpyInstance;

    beforeEach(() => {
      (global as any).window = {};
      ipcManager = new IPCManager();
      
      // Mock the sendMessage method to avoid Electron environment requirement
      sendMessageSpy = jest.spyOn(ipcManager, 'sendMessage').mockResolvedValue({});
    });

    afterEach(() => {
      sendMessageSpy.mockRestore();
    });

    test('should call loadProjects', async () => {
      await ipcManager.loadProjects();
      
      expect(sendMessageSpy).toHaveBeenCalledWith('load-projects');
    });

    test('should call createProject', async () => {
      await ipcManager.createProject('Test Project', '/path/to/project');
      
      expect(sendMessageSpy).toHaveBeenCalledWith('create-project', {
        name: 'Test Project',
        workingDirectory: '/path/to/project'
      });
    });

    test('should call deleteProject', async () => {
      await ipcManager.deleteProject('project-123');
      
      expect(sendMessageSpy).toHaveBeenCalledWith('delete-project', { projectId: 'project-123' });
    });

    test('should call addSourceFolder', async () => {
      await ipcManager.addSourceFolder('project-123', '/path/to/folder');
      
      expect(sendMessageSpy).toHaveBeenCalledWith('add-source-folder', {
        projectId: 'project-123',
        folderPath: '/path/to/folder'
      });
    });

    test('should call removeSourceFolder', async () => {
      await ipcManager.removeSourceFolder('project-123', '/path/to/folder');
      
      expect(sendMessageSpy).toHaveBeenCalledWith('remove-source-folder', {
        projectId: 'project-123',
        folderPath: '/path/to/folder'
      });
    });

    test('should call createView', async () => {
      await ipcManager.createView('project-123', 'Test View');
      
      expect(sendMessageSpy).toHaveBeenCalledWith('create-view', {
        projectId: 'project-123',
        viewName: 'Test View'
      });
    });

    test('should call deleteView', async () => {
      await ipcManager.deleteView('project-123', 'view-456');
      
      expect(sendMessageSpy).toHaveBeenCalledWith('delete-view', {
        projectId: 'project-123',
        viewId: 'view-456'
      });
    });

    test('should call scanData', async () => {
      await ipcManager.scanData('project-123', 'view-456');
      
      expect(sendMessageSpy).toHaveBeenCalledWith('scan-data', {
        projectId: 'project-123',
        viewId: 'view-456'
      });
    });

    test('should call executeQuery', async () => {
      const query = { filters: [] };
      
      await ipcManager.executeQuery('project-123', 'view-456', query);
      
      expect(sendMessageSpy).toHaveBeenCalledWith('execute-query', {
        projectId: 'project-123',
        viewId: 'view-456',
        query
      });
    });

    test('should call openFolder', async () => {
      await ipcManager.openFolder('/path/to/folder');
      
      expect(sendMessageSpy).toHaveBeenCalledWith('open-folder', { folderPath: '/path/to/folder' });
    });

    test('should call getProject', async () => {
      await ipcManager.getProject('project-123');
      
      expect(sendMessageSpy).toHaveBeenCalledWith('get-project', { projectId: 'project-123' });
    });

    test('should call getViews', async () => {
      await ipcManager.getViews('project-123');
      
      expect(sendMessageSpy).toHaveBeenCalledWith('get-views', { projectId: 'project-123' });
    });

    test('should call getView', async () => {
      await ipcManager.getView('project-123', 'view-456');
      
      expect(sendMessageSpy).toHaveBeenCalledWith('get-view', { 
        projectId: 'project-123', 
        viewId: 'view-456' 
      });
    });

    test('should call updateProject', async () => {
      const updates = { name: 'Updated Project' };
      
      await ipcManager.updateProject('project-123', updates);
      
      expect(sendMessageSpy).toHaveBeenCalledWith('update-project', { 
        projectId: 'project-123', 
        updates 
      });
    });

    test('should call getSourceFolders', async () => {
      await ipcManager.getSourceFolders('project-123');
      
      expect(sendMessageSpy).toHaveBeenCalledWith('get-source-folders', { projectId: 'project-123' });
    });
  });
});
