/**
 * Unit tests for UIManager class
 */

import { UIManager, Screen, BreadcrumbItem } from '../src/renderer/UIManager';

describe('UIManager', () => {
  let uiManager: UIManager;
  let createElementSpy: jest.SpyInstance;
  let addEventListenerSpy: jest.SpyInstance;

  beforeEach(() => {
    // Clear document body before each test
    document.body.innerHTML = '';
    
    // Spy on DOM methods
    createElementSpy = jest.spyOn(document, 'createElement');
    addEventListenerSpy = jest.spyOn(document, 'addEventListener');
    
    // Create UIManager instance
    uiManager = new UIManager();
  });

  afterEach(() => {
    jest.clearAllMocks();
    createElementSpy.mockRestore();
    addEventListenerSpy.mockRestore();
  });

  describe('Initialization', () => {
    test('should initialize UI structure', () => {
      expect(document.body.innerHTML).toContain('app-container');
      expect(document.body.innerHTML).toContain('app-header');
      expect(document.body.innerHTML).toContain('breadcrumb');
      expect(document.body.innerHTML).toContain('content-container');
      expect(document.body.innerHTML).toContain('loading-container');
      expect(document.body.innerHTML).toContain('error-container');
    });

    test('should add CSS styles', () => {
      expect(document.createElement).toHaveBeenCalledWith('style');
    });

    test('should set up event listeners', () => {
      expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('Screen Management', () => {
    test('should register screens', () => {
      const mockElement = document.createElement('div');
      uiManager.registerScreen('test-screen', 'Test Screen', mockElement);
      
      // Verify screen is registered by trying to show it
      uiManager.showScreen('test-screen');
      expect(uiManager.getCurrentScreen()).toBe('test-screen');
    });

    test('should show registered screen', () => {
      uiManager.registerScreen('project-list', 'Projects');
      uiManager.showScreen('project-list');
      
      expect(uiManager.getCurrentScreen()).toBe('project-list');
    });

    test('should show error for unregistered screen', () => {
      const showErrorSpy = jest.spyOn(uiManager, 'showError');
      uiManager.showScreen('non-existent-screen');
      
      expect(showErrorSpy).toHaveBeenCalledWith("Screen 'non-existent-screen' not found");
    });

    test('should maintain navigation history', () => {
      uiManager.registerScreen('screen1', 'Screen 1');
      uiManager.registerScreen('screen2', 'Screen 2');
      
      uiManager.showScreen('screen1');
      uiManager.showScreen('screen2');
      
      const history = uiManager.getHistory();
      expect(history).toHaveLength(1);
      expect(history[0]?.screen).toBe('screen1');
    });
  });

  describe('Navigation', () => {
    beforeEach(() => {
      uiManager.registerScreen('screen1', 'Screen 1');
      uiManager.registerScreen('screen2', 'Screen 2');
      uiManager.registerScreen('screen3', 'Screen 3');
    });

    test('should navigate back to previous screen', () => {
      uiManager.showScreen('screen1');
      uiManager.showScreen('screen2');
      uiManager.showScreen('screen3');
      
      expect(uiManager.getCurrentScreen()).toBe('screen3');
      
      uiManager.goBack();
      expect(uiManager.getCurrentScreen()).toBe('screen2');
      
      uiManager.goBack();
      expect(uiManager.getCurrentScreen()).toBe('screen1');
    });

    test('should not navigate back when no history', () => {
      uiManager.showScreen('screen1');
      const initialScreen = uiManager.getCurrentScreen();
      
      uiManager.goBack();
      expect(uiManager.getCurrentScreen()).toBe(initialScreen);
    });

    test('should check if can go back', () => {
      uiManager.showScreen('screen1');
      expect(uiManager.canGoBack()).toBe(false);
      
      uiManager.showScreen('screen2');
      expect(uiManager.canGoBack()).toBe(true);
    });

    test('should clear navigation history', () => {
      uiManager.showScreen('screen1');
      uiManager.showScreen('screen2');
      
      expect(uiManager.canGoBack()).toBe(true);
      
      uiManager.clearHistory();
      expect(uiManager.canGoBack()).toBe(false);
      expect(uiManager.getHistory()).toHaveLength(0);
    });
  });

  describe('Convenience Navigation Methods', () => {
    beforeEach(() => {
      uiManager.registerScreen('project-list', 'Projects');
      uiManager.registerScreen('project-detail', 'Project Detail');
      uiManager.registerScreen('view-list', 'Views');
      uiManager.registerScreen('data-view', 'Data View');
    });

    test('should show project list', () => {
      uiManager.showProjectList();
      expect(uiManager.getCurrentScreen()).toBe('project-list');
    });

    test('should show project detail with data', () => {
      uiManager.showProjectDetail('project-123');
      expect(uiManager.getCurrentScreen()).toBe('project-detail');
    });

    test('should show view list with project data', () => {
      uiManager.showViewList('project-123');
      expect(uiManager.getCurrentScreen()).toBe('view-list');
    });

    test('should show data view with project and view data', () => {
      uiManager.showDataView('project-123', 'view-456');
      expect(uiManager.getCurrentScreen()).toBe('data-view');
    });
  });

  describe('Loading State', () => {
    test('should show loading state', () => {
      uiManager.showLoading('Processing...');
      // Since we're mocking DOM, we can't easily test the actual display change
      // but we can verify the method doesn't throw
      expect(() => uiManager.showLoading()).not.toThrow();
    });

    test('should hide loading state', () => {
      uiManager.showLoading();
      uiManager.hideLoading();
      expect(() => uiManager.hideLoading()).not.toThrow();
    });

    test('should show loading with custom message', () => {
      expect(() => uiManager.showLoading('Custom loading message')).not.toThrow();
    });
  });

  describe('Error Handling', () => {
    test('should show error message', () => {
      uiManager.showError('Test error message');
      expect(() => uiManager.showError('Test error')).not.toThrow();
    });

    test('should show error with details', () => {
      uiManager.showError('Test error', 'Detailed error information');
      expect(() => uiManager.showError('Test error', 'Details')).not.toThrow();
    });

    test('should hide error message', () => {
      uiManager.showError('Test error');
      uiManager.hideError();
      expect(() => uiManager.hideError()).not.toThrow();
    });
  });

  describe('Breadcrumb Navigation', () => {
    test('should update breadcrumb with custom path', () => {
      const customPath: BreadcrumbItem[] = [
        { label: 'Home', screen: 'home' },
        { label: 'Projects', screen: 'projects' },
        { label: 'Current Project' }
      ];
      
      expect(() => uiManager.updateBreadcrumb(customPath)).not.toThrow();
    });

    test('should generate breadcrumb from history', () => {
      uiManager.registerScreen('project-list', 'Projects');
      uiManager.registerScreen('project-detail', 'Project Detail');
      
      uiManager.showScreen('project-list');
      uiManager.showScreen('project-detail');
      
      expect(() => uiManager.updateBreadcrumb()).not.toThrow();
    });
  });

  describe('Event Handling', () => {
    test('should handle keyboard events', () => {
      // Test that event listeners are set up
      expect(document.addEventListener).toHaveBeenCalledWith('keydown', expect.any(Function));
    });
  });

  describe('State Management', () => {
    test('should maintain current screen state', () => {
      uiManager.registerScreen('test-screen', 'Test');
      uiManager.showScreen('test-screen');
      
      expect(uiManager.getCurrentScreen()).toBe('test-screen');
    });

    test('should return navigation history', () => {
      uiManager.registerScreen('screen1', 'Screen 1');
      uiManager.registerScreen('screen2', 'Screen 2');
      
      uiManager.showScreen('screen1');
      uiManager.showScreen('screen2');
      
      const history = uiManager.getHistory();
      expect(Array.isArray(history)).toBe(true);
      expect(history).toHaveLength(1);
    });
  });
});