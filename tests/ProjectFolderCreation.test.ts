import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { ProjectManager } from '../src/main/ProjectManager';

describe('Project Folder Creation', () => {
  let projectManager: ProjectManager;
  let tempDir: string;

  beforeEach(async () => {
    // Create a temporary directory for testing
    tempDir = path.join(os.tmpdir(), `digr-test-${Date.now()}`);
    fs.mkdirSync(tempDir, { recursive: true });
    
    // Initialize ProjectManager with a test config path
    const testConfigPath = path.join(tempDir, 'digr.config');
    projectManager = new ProjectManager(testConfigPath);
    await projectManager.initialize();
  });

  afterEach(async () => {
    // Clean up
    await projectManager.close();
    
    // Remove the temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  test('should create a project folder with the project name in the parent path', async () => {
    // Test data
    const projectName = 'TestProject';
    const parentPath = tempDir;
    
    // Create the project
    const project = await projectManager.createProject(projectName, parentPath);
    
    // Expected project path
    const expectedProjectPath = path.join(parentPath, projectName);
    
    // Verify the project folder was created
    expect(fs.existsSync(expectedProjectPath)).toBe(true);
    expect(fs.statSync(expectedProjectPath).isDirectory()).toBe(true);
    
    // Verify the .digr subfolder was created
    const digrFolderPath = path.join(expectedProjectPath, '.digr');
    expect(fs.existsSync(digrFolderPath)).toBe(true);
    expect(fs.statSync(digrFolderPath).isDirectory()).toBe(true);
    
    // Verify the project object has the correct working directory
    expect(project.workingDirectory).toBe(expectedProjectPath);
  });

  test('should handle project names with spaces', async () => {
    // Test data
    const projectName = 'Test Project With Spaces';
    const parentPath = tempDir;
    
    // Create the project
    const project = await projectManager.createProject(projectName, parentPath);
    
    // Expected project path
    const expectedProjectPath = path.join(parentPath, projectName);
    
    // Verify the project folder was created
    expect(fs.existsSync(expectedProjectPath)).toBe(true);
    expect(fs.statSync(expectedProjectPath).isDirectory()).toBe(true);
    
    // Verify the project object has the correct working directory
    expect(project.workingDirectory).toBe(expectedProjectPath);
  });

  test('should handle project names with trailing spaces', async () => {
    // Test data
    const projectName = 'TestProject  '; // Note the trailing spaces
    const parentPath = tempDir;
    
    // Create the project
    const project = await projectManager.createProject(projectName, parentPath);
    
    // Expected project path (with trimmed name)
    const expectedProjectPath = path.join(parentPath, projectName.trim());
    
    // Verify the project folder was created
    expect(fs.existsSync(expectedProjectPath)).toBe(true);
    expect(fs.statSync(expectedProjectPath).isDirectory()).toBe(true);
    
    // Verify the project object has the correct working directory
    expect(project.workingDirectory).toBe(expectedProjectPath);
  });
});
