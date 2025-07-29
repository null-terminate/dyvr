import { ProjectManager } from '../src/main/ProjectManager';
import { ViewManager } from '../src/main/ViewManager';
import { JSONScanner } from '../src/main/JSONScanner';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('Main Process Integration', () => {
  let projectManager: ProjectManager;
  let viewManager: ViewManager;
  let jsonScanner: JSONScanner;
  let testDir: string;

  beforeEach(async () => {
    // Create temporary directory for tests
    testDir = fs.mkdtempSync(path.join(os.tmpdir(), 'project-manager-test-'));

    // Clean up any existing test data directory
    const testDataDir = path.join(process.cwd(), 'test-data');
    if (fs.existsSync(testDataDir)) {
      fs.rmSync(testDataDir, { recursive: true, force: true });
    }

    // Initialize managers
    projectManager = new ProjectManager();
    await projectManager.initialize();

    viewManager = new ViewManager();
    await viewManager.initialize();

    jsonScanner = new JSONScanner();
  });

  afterEach(async () => {
    // Cleanup managers
    if (projectManager) {
      await projectManager.close();
    }
    if (viewManager) {
      await viewManager.close();
    }

    // Cleanup test directory
    if (fs.existsSync(testDir)) {
      fs.rmSync(testDir, { recursive: true, force: true });
    }
  });

  describe('Project CRUD Operations', () => {
    test('should create, retrieve, and delete project', async () => {
      const projectName = 'Test Project';
      const workingDir = path.join(testDir, 'test-project');

      // Create project
      const project = await projectManager.createProject(projectName, workingDir);
      expect(project).toBeDefined();
      expect(project.name).toBe(projectName);
      expect(project.workingDirectory).toBe(path.resolve(workingDir));
      expect(fs.existsSync(workingDir)).toBe(true);
      expect(fs.existsSync(path.join(workingDir, '.digr'))).toBe(true);

      // Retrieve project
      const retrievedProject = await projectManager.getProject(project.id);
      expect(retrievedProject).toBeDefined();
      expect(retrievedProject!.id).toBe(project.id);
      expect(retrievedProject!.name).toBe(projectName);

      // Get all projects
      const allProjects = await projectManager.getProjects();
      expect(allProjects).toHaveLength(1);
      expect(allProjects[0]!.id).toBe(project.id);
      expect(allProjects[0]!.name).toBe(project.name);

      // Delete project
      await projectManager.deleteProject(project.id);
      const deletedProject = await projectManager.getProject(project.id);
      expect(deletedProject).toBeNull();
    });

    test('should handle project creation errors', async () => {
      // Test empty project name
      await expect(projectManager.createProject('', testDir))
        .rejects.toThrow('Project name must be a non-empty string');

      // Test duplicate project name
      const projectName = 'Duplicate Project';
      const workingDir1 = path.join(testDir, 'project1');
      const workingDir2 = path.join(testDir, 'project2');

      await projectManager.createProject(projectName, workingDir1);
      await expect(projectManager.createProject(projectName, workingDir2))
        .rejects.toThrow('already exists');
    });
  });

  describe('Source Folder Management', () => {
    let project: any;

    beforeEach(async () => {
      const projectName = 'Test Project';
      const workingDir = path.join(testDir, 'test-project');
      project = await projectManager.createProject(projectName, workingDir);
    });

    test('should add and remove source folders', async () => {
      const sourceDir = path.join(testDir, 'source-data');
      fs.mkdirSync(sourceDir, { recursive: true });

      // Add source folder
      await projectManager.addSourceFolder(project.id, sourceDir);

      const updatedProject = await projectManager.getProject(project.id);
      expect(updatedProject!.sourceFolders).toHaveLength(1);
      expect(updatedProject!.sourceFolders[0]!.path).toBe(path.resolve(sourceDir));

      // Remove source folder
      await projectManager.removeSourceFolder(project.id, sourceDir);

      const finalProject = await projectManager.getProject(project.id);
      expect(finalProject!.sourceFolders).toHaveLength(0);
    });

    test('should handle source folder errors', async () => {
      const nonExistentDir = path.join(testDir, 'non-existent');

      // Test adding non-existent folder
      await expect(projectManager.addSourceFolder(project.id, nonExistentDir))
        .rejects.toThrow('does not exist');

      // Test removing non-added folder
      const sourceDir = path.join(testDir, 'source-data');
      fs.mkdirSync(sourceDir, { recursive: true });

      await expect(projectManager.removeSourceFolder(project.id, sourceDir))
        .rejects.toThrow('not added to this project');
    });
  });

  describe('View Management Integration', () => {
    let project: any;

    beforeEach(async () => {
      const projectName = 'Test Project';
      const workingDir = path.join(testDir, 'test-project');
      project = await projectManager.createProject(projectName, workingDir);
    });

    test('should create and delete views', async () => {
      const viewName = 'Test View';

      // Create view
      const view = await viewManager.createViewInProject(project.workingDirectory, viewName);
      expect(view).toBeDefined();
      expect(view.name).toBe(viewName);

      // Get views for project
      const views = await viewManager.getViewsForProject(project.workingDirectory);
      expect(views).toHaveLength(1);
      expect(views[0]!.id).toBe(view.id);

      // Delete view
      const deleted = await viewManager.deleteViewInProject(project.workingDirectory, view.id);
      expect(deleted).toBe(true);

      // Verify view is deleted
      const remainingViews = await viewManager.getViewsForProject(project.workingDirectory);
      expect(remainingViews).toHaveLength(0);
    });

    test('should handle view name conflicts', async () => {
      const viewName = 'Duplicate View';

      // Create first view
      await viewManager.createViewInProject(project.workingDirectory, viewName);

      // Try to create duplicate view
      await expect(viewManager.createViewInProject(project.workingDirectory, viewName))
        .rejects.toThrow('already exists');
    });
  });

  describe('JSON Scanning Integration', () => {
    let project: any;
    let sourceDir: string;

    beforeEach(async () => {
      const projectName = 'Test Project';
      const workingDir = path.join(testDir, 'test-project');
      project = await projectManager.createProject(projectName, workingDir);

      // Create source directory with test JSON files
      sourceDir = path.join(testDir, 'source-data');
      fs.mkdirSync(sourceDir, { recursive: true });

      // Create test JSON files
      const testData1 = [
        { id: 1, name: 'John', age: 30, active: true },
        { id: 2, name: 'Jane', age: 25, active: false }
      ];
      const testData2 = [
        { id: 3, name: 'Bob', age: 35, score: 95.5 },
        { id: 4, name: 'Alice', age: 28, score: 87.2 }
      ];

      fs.writeFileSync(path.join(sourceDir, 'users1.json'), JSON.stringify(testData1, null, 2));
      fs.writeFileSync(path.join(sourceDir, 'users2.json'), JSON.stringify(testData2, null, 2));

      // Add source folder to project
      await projectManager.addSourceFolder(project.id, sourceDir);
    });

    test('should scan JSON files and analyze schema', async () => {
      const updatedProject = await projectManager.getProject(project.id);
      const scanResults = await jsonScanner.scanSourceFolders(updatedProject!.sourceFolders);

      expect(scanResults).toBeDefined();
      expect(scanResults.totalFiles).toBe(2);
      expect(scanResults.processedFiles).toBe(2);
      expect(scanResults.totalRecords).toBe(4);
      expect(scanResults.errors).toHaveLength(0);

      // Check discovered columns
      const columnNames = scanResults.columns.map(col => col.name);
      expect(columnNames).toContain('id');
      expect(columnNames).toContain('name');
      expect(columnNames).toContain('age');

      // Check column types
      const idColumn = scanResults.columns.find(col => col.name === 'id');
      const nameColumn = scanResults.columns.find(col => col.name === 'name');
      const ageColumn = scanResults.columns.find(col => col.name === 'age');

      expect(idColumn?.type).toBe('INTEGER');
      expect(nameColumn?.type).toBe('TEXT');
      expect(ageColumn?.type).toBe('INTEGER');
    });

    test('should handle invalid JSON files', async () => {
      // Create invalid JSON file
      fs.writeFileSync(path.join(sourceDir, 'invalid.json'), '{ invalid json }');

      const updatedProject = await projectManager.getProject(project.id);
      const scanResults = await jsonScanner.scanSourceFolders(updatedProject!.sourceFolders);

      expect(scanResults.errors.length).toBeGreaterThan(0);
      expect(scanResults.errors.some(error => error.file.includes('invalid.json'))).toBe(true);
    });

    test('should create data table with scanned schema', async () => {
      const updatedProject = await projectManager.getProject(project.id);
      const scanResults = await jsonScanner.scanSourceFolders(updatedProject!.sourceFolders);

      // Create view for testing
      const view = await viewManager.createViewInProject(project.workingDirectory, 'Test View');

      // Get database manager
      const dbManager = await projectManager.openProjectDatabase(project.id);

      // Create data table
      await jsonScanner.createDataTable(dbManager, view.id, scanResults.columns);

      // Verify table was created
      const hasDataTable = await viewManager.viewHasDataTable(project.workingDirectory, view.id);
      expect(hasDataTable).toBe(true);

      // Get table schema
      const schema = await viewManager.getViewDataSchema(project.workingDirectory, view.id);
      expect(schema.length).toBeGreaterThan(0);
    });
  });

  describe('Error Handling and Response Formatting', () => {
    test('should handle manager initialization errors', async () => {
      // Test with invalid state
      const invalidProjectManager = new ProjectManager();

      await expect(invalidProjectManager.getProjects())
        .rejects.toThrow('not initialized');
    });

    test('should handle database connection errors', async () => {
      const project = await projectManager.createProject('Test Project', path.join(testDir, 'test-project'));

      // Try to access non-existent view
      await expect(viewManager.getView(project.workingDirectory, 'non-existent-id'))
        .resolves.toBeNull();
    });

    test('should validate input parameters', async () => {
      // Test empty project ID
      await expect(projectManager.getProject(''))
        .rejects.toThrow('must be a non-empty string');

      // Test invalid view name
      await expect(viewManager.createViewInProject(path.join(testDir, 'test'), ''))
        .rejects.toThrow('cannot be empty');
    });
  });

  describe('Resource Cleanup', () => {
    test('should properly close database connections', async () => {
      const project = await projectManager.createProject('Test Project', path.join(testDir, 'test-project'));

      // Open database connection
      const dbManager = await projectManager.openProjectDatabase(project.id);
      expect(dbManager.isConnected()).toBe(true);

      // Close connection
      await projectManager.closeProjectDatabase(project.id);

      // Verify cleanup
      await projectManager.close();
      await viewManager.close();
    });

    test('should handle cleanup errors gracefully', async () => {
      // This should not throw even if managers are already closed
      await expect(projectManager.close()).resolves.not.toThrow();
      await expect(viewManager.close()).resolves.not.toThrow();
    });
  });
});