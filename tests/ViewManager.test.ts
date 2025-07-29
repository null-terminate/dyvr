import { ViewManager } from '../src/main/ViewManager';
import { DatabaseManager } from '../src/main/DatabaseManager';
import * as fs from 'fs';
import * as path from 'path';
import { v4 as uuidv4 } from 'uuid';

// Mock the DatabaseManager
jest.mock('../src/main/DatabaseManager');

describe('ViewManager', () => {
  let viewManager: ViewManager;
  let mockDbManager: any;
  let testProjectDir: string;

  beforeEach(() => {
    // Reset all mocks
    jest.clearAllMocks();
    
    // Create a fresh ViewManager instance
    viewManager = new ViewManager();
    
    // Create mock DatabaseManager instance
    mockDbManager = {
      isConnected: jest.fn().mockReturnValue(true),
      openProjectDatabase: jest.fn().mockResolvedValue(undefined),
      closeProjectDatabase: jest.fn().mockResolvedValue(undefined),
      executeQuery: jest.fn(),
      executeNonQuery: jest.fn(),
      dropDataTable: jest.fn().mockResolvedValue(undefined),
      getDataTableSchema: jest.fn().mockResolvedValue([]),
      dataTableExists: jest.fn().mockResolvedValue(false)
    };
    
    // Mock DatabaseManager constructor
    (DatabaseManager as jest.MockedClass<typeof DatabaseManager>).mockImplementation(() => mockDbManager as any);
    
    testProjectDir = '/test/project/dir';
  });

  afterEach(async () => {
    if (viewManager) {
      await viewManager.close();
    }
  });

  describe('initialization', () => {
    test('should initialize successfully', async () => {
      await viewManager.initialize();
      expect((viewManager as any).isInitialized).toBe(true);
    });

    test('should throw error when not initialized', async () => {
      await expect(viewManager.createView(testProjectDir, 'Test View'))
        .rejects.toThrow('ViewManager not initialized');
    });
  });

  describe('createView', () => {
    beforeEach(async () => {
      await viewManager.initialize();
    });

    test('should create a new view successfully', async () => {
      const viewName = 'Test View';
      
      // Mock database responses
      mockDbManager.executeQuery.mockResolvedValueOnce([{ count: 0 }]); // viewNameExists check
      mockDbManager.executeNonQuery.mockResolvedValueOnce({ lastID: 1, changes: 1 });

      const result = await viewManager.createView(testProjectDir, viewName);

      expect(result).toMatchObject({
        id: expect.any(String),
        name: viewName,
        createdDate: expect.any(Date),
        lastModified: expect.any(Date)
      });

      expect(mockDbManager.executeNonQuery).toHaveBeenCalledWith(
        expect.stringContaining('INSERT INTO views'),
        expect.arrayContaining([result.id, viewName, expect.any(String), expect.any(String), null])
      );
    });

    test('should throw error for duplicate view name', async () => {
      const viewName = 'Duplicate View';
      
      // Mock that view name already exists
      mockDbManager.executeQuery.mockResolvedValueOnce([{ count: 1 }]);

      await expect(viewManager.createView(testProjectDir, viewName))
        .rejects.toThrow('View name "Duplicate View" already exists');
    });

    test('should validate view name', async () => {
      // Mock the database calls for validation tests
      mockDbManager.executeQuery.mockResolvedValue([{ count: 0 }]);

      await expect(viewManager.createView(testProjectDir, ''))
        .rejects.toThrow('View name cannot be empty or only whitespace');

      await expect(viewManager.createView(testProjectDir, null as any))
        .rejects.toThrow('View name must be a non-empty string');

      await expect(viewManager.createView(testProjectDir, 'a'.repeat(256)))
        .rejects.toThrow('View name cannot exceed 255 characters');

      await expect(viewManager.createView(testProjectDir, 'invalid<name'))
        .rejects.toThrow('View name contains invalid characters');
    });

    test('should validate project working directory', async () => {
      await expect(viewManager.createView('', 'Test View'))
        .rejects.toThrow('Project working directory must be a non-empty string');

      await expect(viewManager.createView(null as any, 'Test View'))
        .rejects.toThrow('Project working directory must be a non-empty string');
    });
  });

  describe('getView', () => {
    beforeEach(async () => {
      await viewManager.initialize();
    });

    test('should retrieve an existing view', async () => {
      const viewId = uuidv4();
      const mockViewData = {
        id: viewId,
        name: 'Test View',
        created_date: '2024-01-01T00:00:00.000Z',
        last_modified: '2024-01-01T00:00:00.000Z',
        last_query: null
      };

      mockDbManager.executeQuery.mockResolvedValueOnce([mockViewData]);

      const result = await viewManager.getView(testProjectDir, viewId);

      expect(result).toMatchObject({
        id: viewId,
        name: 'Test View',
        createdDate: expect.any(Date),
        lastModified: expect.any(Date)
      });

      expect(mockDbManager.executeQuery).toHaveBeenCalledWith(
        'SELECT * FROM views WHERE id = ?',
        [viewId]
      );
    });

    test('should return null for non-existent view', async () => {
      const viewId = uuidv4();
      mockDbManager.executeQuery.mockResolvedValueOnce([]);

      const result = await viewManager.getView(testProjectDir, viewId);

      expect(result).toBeNull();
    });

    test('should parse lastQuery JSON', async () => {
      const viewId = uuidv4();
      const lastQuery = { viewId: viewId, filters: [], sortBy: 'name' };
      const mockViewData = {
        id: viewId,
        name: 'Test View',
        created_date: '2024-01-01T00:00:00.000Z',
        last_modified: '2024-01-01T00:00:00.000Z',
        last_query: JSON.stringify(lastQuery)
      };

      mockDbManager.executeQuery.mockResolvedValueOnce([mockViewData]);

      const result = await viewManager.getView(testProjectDir, viewId);

      expect(result).not.toBeNull();
      expect(result!.lastQuery).toEqual(lastQuery);
    });

    test('should validate view ID', async () => {
      await expect(viewManager.getView(testProjectDir, ''))
        .rejects.toThrow('View ID must be a non-empty string');

      await expect(viewManager.getView(testProjectDir, null as any))
        .rejects.toThrow('View ID must be a non-empty string');
    });
  });

  describe('getViewsForProject', () => {
    beforeEach(async () => {
      await viewManager.initialize();
    });

    test('should retrieve all views for a project', async () => {
      const mockViewsData = [
        {
          id: uuidv4(),
          name: 'View 1',
          created_date: '2024-01-01T00:00:00.000Z',
          last_modified: '2024-01-02T00:00:00.000Z',
          last_query: null
        },
        {
          id: uuidv4(),
          name: 'View 2',
          created_date: '2024-01-01T00:00:00.000Z',
          last_modified: '2024-01-01T00:00:00.000Z',
          last_query: JSON.stringify({ filters: [] })
        }
      ];

      mockDbManager.executeQuery.mockResolvedValueOnce(mockViewsData);

      const result = await viewManager.getViewsForProject(testProjectDir);

      expect(result).toHaveLength(2);
      expect(result.length).toBeGreaterThan(0);
      if (result[0]) {
        expect(result[0]).toMatchObject({
          id: mockViewsData[0]?.id || '',
          name: 'View 1',
          lastQuery: undefined
        });
      }
      if (result[1]) {
        expect(result[1]).toMatchObject({
          id: mockViewsData[1]?.id || '',
          name: 'View 2',
          lastQuery: { filters: [] }
        });
      }

      expect(mockDbManager.executeQuery).toHaveBeenCalledWith(
        'SELECT * FROM views ORDER BY last_modified DESC'
      );
    });

    test('should return empty array when no views exist', async () => {
      mockDbManager.executeQuery.mockResolvedValueOnce([]);

      const result = await viewManager.getViewsForProject(testProjectDir);

      expect(result).toEqual([]);
    });
  });

  describe('updateView', () => {
    beforeEach(async () => {
      await viewManager.initialize();
    });

    test('should update view name successfully', async () => {
      const viewId = uuidv4();
      const existingView = {
        id: viewId,
        name: 'Old Name',
        created_date: '2024-01-01T00:00:00.000Z',
        last_modified: '2024-01-01T00:00:00.000Z',
        last_query: null
      };

      // Mock getView call
      mockDbManager.executeQuery.mockResolvedValueOnce([existingView]);
      // Mock viewNameExists check (should return false for new name)
      mockDbManager.executeQuery.mockResolvedValueOnce([{ count: 0 }]);
      // Mock update query
      mockDbManager.executeNonQuery.mockResolvedValueOnce({ changes: 1 });

      const updates = { name: 'New Name' };
      const result = await viewManager.updateView(testProjectDir, viewId, updates);

      expect(result.name).toBe('New Name');
      expect(result.lastModified).toBeInstanceOf(Date);

      expect(mockDbManager.executeNonQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE views SET'),
        expect.arrayContaining(['New Name', expect.any(String), null, viewId])
      );
    });

    test('should update lastQuery successfully', async () => {
      const viewId = uuidv4();
      const existingView = {
        id: viewId,
        name: 'Test View',
        created_date: '2024-01-01T00:00:00.000Z',
        last_modified: '2024-01-01T00:00:00.000Z',
        last_query: null
      };

      const newQuery = { 
        viewId: viewId, 
        filters: [{ column: 'name', operator: 'equals' as const, value: 'test', dataType: 'TEXT' as const }] 
      };

      // Mock getView call
      mockDbManager.executeQuery.mockResolvedValueOnce([existingView]);
      // Mock update query
      mockDbManager.executeNonQuery.mockResolvedValueOnce({ changes: 1 });

      const updates = { lastQuery: newQuery };
      const result = await viewManager.updateView(testProjectDir, viewId, updates);

      expect(result.lastQuery).toEqual(newQuery);

      expect(mockDbManager.executeNonQuery).toHaveBeenCalledWith(
        expect.stringContaining('UPDATE views SET'),
        expect.arrayContaining(['Test View', expect.any(String), JSON.stringify(newQuery), viewId])
      );
    });

    test('should throw error for non-existent view', async () => {
      const viewId = uuidv4();
      mockDbManager.executeQuery.mockResolvedValueOnce([]); // getView returns null

      await expect(viewManager.updateView(testProjectDir, viewId, { name: 'New Name' }))
        .rejects.toThrow(`View with ID "${viewId}" not found`);
    });

    test('should throw error for duplicate view name', async () => {
      const viewId = uuidv4();
      const existingView = {
        id: viewId,
        name: 'Old Name',
        created_date: '2024-01-01T00:00:00.000Z',
        last_modified: '2024-01-01T00:00:00.000Z',
        last_query: null
      };

      // Mock getView call
      mockDbManager.executeQuery.mockResolvedValueOnce([existingView]);
      // Mock viewNameExists check (should return true for duplicate name)
      mockDbManager.executeQuery.mockResolvedValueOnce([{ count: 1 }]);

      await expect(viewManager.updateView(testProjectDir, viewId, { name: 'Duplicate Name' }))
        .rejects.toThrow('View name "Duplicate Name" already exists');
    });

    test('should validate parameters', async () => {
      const viewId = uuidv4();

      await expect(viewManager.updateView(testProjectDir, '', { name: 'New Name' }))
        .rejects.toThrow('View ID must be a non-empty string');

      await expect(viewManager.updateView(testProjectDir, viewId, null as any))
        .rejects.toThrow('Updates must be an object');
    });
  });

  describe('deleteView', () => {
    beforeEach(async () => {
      await viewManager.initialize();
    });

    test('should delete view and associated data table successfully', async () => {
      const viewId = uuidv4();
      const existingView = {
        id: viewId,
        name: 'Test View',
        created_date: '2024-01-01T00:00:00.000Z',
        last_modified: '2024-01-01T00:00:00.000Z',
        last_query: null
      };

      // Mock getView call
      mockDbManager.executeQuery.mockResolvedValueOnce([existingView]);
      // Mock dataTableExists to return true for this test
      mockDbManager.dataTableExists.mockResolvedValueOnce(true);
      // Mock delete query
      mockDbManager.executeNonQuery.mockResolvedValueOnce({ changes: 1 });

      const result = await viewManager.deleteView(testProjectDir, viewId);

      expect(result).toBe(true);
      expect(mockDbManager.dropDataTable).toHaveBeenCalledWith(viewId);
      expect(mockDbManager.executeNonQuery).toHaveBeenCalledWith(
        'DELETE FROM views WHERE id = ?',
        [viewId]
      );
    });

    test('should return false for non-existent view', async () => {
      const viewId = uuidv4();
      mockDbManager.executeQuery.mockResolvedValueOnce([]); // getView returns null

      const result = await viewManager.deleteView(testProjectDir, viewId);

      expect(result).toBe(false);
      expect(mockDbManager.dropDataTable).not.toHaveBeenCalled();
      expect(mockDbManager.executeNonQuery).not.toHaveBeenCalled();
    });

    test('should handle data table drop errors gracefully', async () => {
      const viewId = uuidv4();
      const existingView = {
        id: viewId,
        name: 'Test View',
        created_date: '2024-01-01T00:00:00.000Z',
        last_modified: '2024-01-01T00:00:00.000Z',
        last_query: null
      };

      // Mock getView call
      mockDbManager.executeQuery.mockResolvedValueOnce([existingView]);
      // Mock dropDataTable to throw error
      mockDbManager.dropDataTable.mockRejectedValueOnce(new Error('Table does not exist'));
      // Mock delete query
      mockDbManager.executeNonQuery.mockResolvedValueOnce({ changes: 1 });

      // Should still succeed despite data table error
      const result = await viewManager.deleteView(testProjectDir, viewId);

      expect(result).toBe(true);
      expect(mockDbManager.executeNonQuery).toHaveBeenCalledWith(
        'DELETE FROM views WHERE id = ?',
        [viewId]
      );
    });

    test('should validate view ID', async () => {
      await expect(viewManager.deleteView(testProjectDir, ''))
        .rejects.toThrow('View ID must be a non-empty string');

      await expect(viewManager.deleteView(testProjectDir, null as any))
        .rejects.toThrow('View ID must be a non-empty string');
    });
  });

  describe('viewNameExists', () => {
    beforeEach(async () => {
      await viewManager.initialize();
    });

    test('should return true when view name exists', async () => {
      mockDbManager.executeQuery.mockResolvedValueOnce([{ count: 1 }]);

      const result = await viewManager.viewNameExists(testProjectDir, 'Existing View');

      expect(result).toBe(true);
      expect(mockDbManager.executeQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM views WHERE LOWER(name) = LOWER(?)',
        ['Existing View']
      );
    });

    test('should return false when view name does not exist', async () => {
      mockDbManager.executeQuery.mockResolvedValueOnce([{ count: 0 }]);

      const result = await viewManager.viewNameExists(testProjectDir, 'Non-existent View');

      expect(result).toBe(false);
    });

    test('should exclude specified view ID from check', async () => {
      const excludeViewId = uuidv4();
      mockDbManager.executeQuery.mockResolvedValueOnce([{ count: 0 }]);

      const result = await viewManager.viewNameExists(testProjectDir, 'Test View', excludeViewId);

      expect(result).toBe(false);
      expect(mockDbManager.executeQuery).toHaveBeenCalledWith(
        'SELECT COUNT(*) as count FROM views WHERE LOWER(name) = LOWER(?) AND id != ?',
        ['Test View', excludeViewId]
      );
    });
  });

  describe('isViewNameAvailable', () => {
    beforeEach(async () => {
      await viewManager.initialize();
    });

    test('should return true when view name is available', async () => {
      mockDbManager.executeQuery.mockResolvedValueOnce([{ count: 0 }]);

      const result = await viewManager.isViewNameAvailable(testProjectDir, 'Available Name');

      expect(result).toBe(true);
    });

    test('should return false when view name is not available', async () => {
      mockDbManager.executeQuery.mockResolvedValueOnce([{ count: 1 }]);

      const result = await viewManager.isViewNameAvailable(testProjectDir, 'Taken Name');

      expect(result).toBe(false);
    });
  });

  describe('getViewDataSchema', () => {
    beforeEach(async () => {
      await viewManager.initialize();
    });

    test('should return data table schema', async () => {
      const viewId = uuidv4();
      const mockSchema = [
        { name: 'column1', type: 'TEXT' },
        { name: 'column2', type: 'INTEGER' }
      ];

      mockDbManager.getDataTableSchema.mockResolvedValueOnce(mockSchema);

      const result = await viewManager.getViewDataSchema(testProjectDir, viewId);

      expect(result).toEqual(mockSchema);
      expect(mockDbManager.getDataTableSchema).toHaveBeenCalledWith(viewId);
    });

    test('should validate view ID', async () => {
      await expect(viewManager.getViewDataSchema(testProjectDir, ''))
        .rejects.toThrow('View ID must be a non-empty string');
    });
  });

  describe('viewHasDataTable', () => {
    beforeEach(async () => {
      await viewManager.initialize();
    });

    test('should return true when data table exists', async () => {
      const viewId = uuidv4();
      mockDbManager.dataTableExists.mockResolvedValueOnce(true);

      const result = await viewManager.viewHasDataTable(testProjectDir, viewId);

      expect(result).toBe(true);
      expect(mockDbManager.dataTableExists).toHaveBeenCalledWith(viewId);
    });

    test('should return false when data table does not exist', async () => {
      const viewId = uuidv4();
      mockDbManager.dataTableExists.mockResolvedValueOnce(false);

      const result = await viewManager.viewHasDataTable(testProjectDir, viewId);

      expect(result).toBe(false);
    });

    test('should validate view ID', async () => {
      await expect(viewManager.viewHasDataTable(testProjectDir, ''))
        .rejects.toThrow('View ID must be a non-empty string');
    });
  });

  describe('database management', () => {
    beforeEach(async () => {
      await viewManager.initialize();
    });

    test('should cache database managers per project', async () => {
      const projectDir1 = '/project1';
      const projectDir2 = '/project2';

      // Create views in different projects
      mockDbManager.executeQuery.mockResolvedValue([{ count: 0 }]); // viewNameExists
      mockDbManager.executeNonQuery.mockResolvedValue({ changes: 1 });

      await viewManager.createView(projectDir1, 'View 1');
      await viewManager.createView(projectDir2, 'View 2');

      // Should have created two DatabaseManager instances
      expect(DatabaseManager).toHaveBeenCalledTimes(2);
      expect(DatabaseManager).toHaveBeenCalledWith(projectDir1);
      expect(DatabaseManager).toHaveBeenCalledWith(projectDir2);
    });

    test('should reuse cached database managers', async () => {
      mockDbManager.executeQuery.mockResolvedValue([{ count: 0 }]); // viewNameExists
      mockDbManager.executeNonQuery.mockResolvedValue({ changes: 1 });

      // Create two views in the same project
      await viewManager.createView(testProjectDir, 'View 1');
      await viewManager.createView(testProjectDir, 'View 2');

      // Should have created only one DatabaseManager instance
      expect(DatabaseManager).toHaveBeenCalledTimes(1);
      expect(mockDbManager.openProjectDatabase).toHaveBeenCalledTimes(1);
    });

    test('should close project database', async () => {
      // Create a view to establish database connection
      mockDbManager.executeQuery.mockResolvedValue([{ count: 0 }]);
      mockDbManager.executeNonQuery.mockResolvedValue({ changes: 1 });
      await viewManager.createView(testProjectDir, 'Test View');

      await viewManager.closeProjectDatabase(testProjectDir);

      expect(mockDbManager.closeProjectDatabase).toHaveBeenCalled();
    });

    test('should close all databases on close', async () => {
      const projectDir1 = '/project1';
      const projectDir2 = '/project2';

      // Create views in different projects
      mockDbManager.executeQuery.mockResolvedValue([{ count: 0 }]);
      mockDbManager.executeNonQuery.mockResolvedValue({ changes: 1 });

      await viewManager.createView(projectDir1, 'View 1');
      await viewManager.createView(projectDir2, 'View 2');

      await viewManager.close();

      expect(mockDbManager.closeProjectDatabase).toHaveBeenCalledTimes(2);
      expect((viewManager as any).isInitialized).toBe(false);
    });
  });

  describe('error handling', () => {
    beforeEach(async () => {
      await viewManager.initialize();
    });

    test('should handle database connection errors', async () => {
      mockDbManager.openProjectDatabase.mockRejectedValueOnce(new Error('Connection failed'));

      await expect(viewManager.createView(testProjectDir, 'Test View'))
        .rejects.toThrow('Failed to create view: Connection failed');
    });

    test('should handle database query errors', async () => {
      mockDbManager.executeQuery.mockRejectedValueOnce(new Error('Query failed'));

      await expect(viewManager.getView(testProjectDir, uuidv4()))
        .rejects.toThrow('Failed to get view: Query failed');
    });

    test('should handle database update errors', async () => {
      const viewId = uuidv4();
      const existingView = {
        id: viewId,
        name: 'Test View',
        created_date: '2024-01-01T00:00:00.000Z',
        last_modified: '2024-01-01T00:00:00.000Z',
        last_query: null
      };

      mockDbManager.executeQuery.mockResolvedValueOnce([existingView]); // getView
      mockDbManager.executeQuery.mockResolvedValueOnce([{ count: 0 }]); // viewNameExists
      mockDbManager.executeNonQuery.mockRejectedValueOnce(new Error('Update failed'));

      await expect(viewManager.updateView(testProjectDir, viewId, { name: 'New Name' }))
        .rejects.toThrow('Failed to update view: Update failed');
    });
  });
});
