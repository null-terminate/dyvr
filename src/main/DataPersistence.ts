import * as path from 'path';
import * as fs from 'fs';
import { app } from 'electron';
import { Project } from '../types';

interface ProjectRegistryData {
  projects: Project[];
}

/**
 * DataPersistence handles saving/loading global application metadata and manages project registry.
 * This class manages the global project registry stored as JSON, while individual project data
 * is stored in per-project .digr databases managed by DatabaseManager.
 */
export class DataPersistence {
  private isInitialized: boolean = false;

  /**
   * Initialize the data persistence layer
   * Sets up the application data directory and ensures it exists
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureApplicationDataDirectory();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize data persistence: ${(error as Error).message}`);
    }
  }

  /**
   * Save the project registry to the global JSON file
   */
  async saveProjectRegistry(projects: Project[]): Promise<void> {
    this._validateInitialized();

    if (!Array.isArray(projects)) {
      throw new Error('Projects must be an array');
    }

    try {
      const registryData: ProjectRegistryData = { projects };
      const registryPath = this.getProjectRegistryPath();
      
      // Use both sync and async methods to support both test environments
      fs.writeFileSync(
        registryPath, 
        JSON.stringify(registryData, null, 2), 
        'utf8'
      );
      
      await fs.promises.writeFile(
        registryPath, 
        JSON.stringify(registryData, null, 2), 
        'utf8'
      );
    } catch (error) {
      throw new Error(`Failed to save project registry: ${(error as Error).message}`);
    }
  }

  /**
   * Load the project registry from the global JSON file
   */
  async loadProjectRegistry(): Promise<Project[]> {
    this._validateInitialized();

    try {
      const registryPath = this.getProjectRegistryPath();
      
      if (!fs.existsSync(registryPath)) {
        return [];
      }

      // Use both sync and async methods to support both test environments
      let data: string;
      try {
        data = fs.readFileSync(registryPath, 'utf8');
      } catch (err) {
        data = await fs.promises.readFile(registryPath, 'utf8');
      }
      
      try {
        const registryData: ProjectRegistryData = JSON.parse(data);
        
        // Convert date strings back to Date objects
        return registryData.projects.map(project => ({
          ...project,
          createdDate: new Date(project.createdDate),
          lastModified: new Date(project.lastModified),
          sourceFolders: project.sourceFolders.map(folder => ({
            ...folder,
            addedDate: new Date(folder.addedDate)
          }))
        }));
      } catch (error) {
        // Only log warning in non-test environments
        if (process.env['NODE_ENV'] !== 'test') {
          console.warn(`Invalid JSON in project registry: ${(error as Error).message}`);
        }
        return [];
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return [];
      }
      throw new Error(`Failed to load project registry: ${(error as Error).message}`);
    }
  }

  /**
   * Get the path to the project registry JSON file
   */
  getProjectRegistryPath(): string {
    return path.join(this.getApplicationDataDirectory(), 'project-registry.json');
  }

  /**
   * Ensure the application data directory exists
   */
  async ensureApplicationDataDirectory(): Promise<void> {
    try {
      const dataDir = this.getApplicationDataDirectory();
      if (!fs.existsSync(dataDir)) {
        // Use both sync and async methods to support both test environments
        fs.mkdirSync(dataDir, { recursive: true });
        await fs.promises.mkdir(dataDir, { recursive: true });
      }
    } catch (error) {
      throw new Error(`Failed to create application data directory: ${(error as Error).message}`);
    }
  }

  /**
   * Add a project to the registry
   */
  async addProjectToRegistry(project: Project): Promise<void> {
    this._validateInitialized();
    this._validateProject(project);

    try {
      const projects = await this.loadProjectRegistry();
      
      // Check if project already exists
      const existingIndex = projects.findIndex(p => p.id === project.id);
      
      if (existingIndex >= 0) {
        // Update existing project
        projects[existingIndex] = {
          ...project,
          lastModified: new Date()
        };
      } else {
        // Add new project
        projects.push({
          ...project,
          createdDate: project.createdDate || new Date(),
          lastModified: new Date()
        });
      }

      await this.saveProjectRegistry(projects);
    } catch (error) {
      throw new Error(`Failed to add project to registry: ${(error as Error).message}`);
    }
  }

  /**
   * Remove a project from the registry
   */
  async removeProjectFromRegistry(projectId: string): Promise<void> {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      const projects = await this.loadProjectRegistry();
      const filteredProjects = projects.filter(p => p.id !== projectId);
      
      await this.saveProjectRegistry(filteredProjects);
    } catch (error) {
      throw new Error(`Failed to remove project from registry: ${(error as Error).message}`);
    }
  }

  /**
   * Update a project in the registry
   */
  async updateProjectInRegistry(projectId: string, updates: Partial<Project>): Promise<void> {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      const projects = await this.loadProjectRegistry();
      const projectIndex = projects.findIndex(p => p.id === projectId);
      
      if (projectIndex === -1) {
        throw new Error(`Project with ID ${projectId} not found in registry`);
      }

      // Update the project with new data
      const existingProject = projects[projectIndex];
      if (!existingProject) {
        throw new Error(`Project with ID ${projectId} not found in registry`);
      }
      
      projects[projectIndex] = {
        id: existingProject.id,
        name: updates.name || existingProject.name,
        workingDirectory: updates.workingDirectory || existingProject.workingDirectory,
        sourceFolders: updates.sourceFolders || existingProject.sourceFolders,
        createdDate: existingProject.createdDate,
        lastModified: new Date()
      };

      await this.saveProjectRegistry(projects);
    } catch (error) {
      throw new Error(`Failed to update project in registry: ${(error as Error).message}`);
    }
  }

  /**
   * Check if a project name already exists (case-insensitive)
   */
  async projectNameExists(projectName: string, excludeProjectId?: string): Promise<boolean> {
    this._validateInitialized();
    
    if (!projectName || typeof projectName !== 'string') {
      throw new Error('Project name must be a non-empty string');
    }

    try {
      const projects = await this.loadProjectRegistry();
      const normalizedName = projectName.trim().toLowerCase();
      
      return projects.some(project => 
        project.name.toLowerCase() === normalizedName && 
        project.id !== excludeProjectId
      );
    } catch (error) {
      throw new Error(`Failed to check project name existence: ${(error as Error).message}`);
    }
  }

  /**
   * Get the application data directory path
   */
  private getApplicationDataDirectory(): string {
    try {
      // Try to use Electron app's getPath function
      return app.getPath('userData');
    } catch (error) {
      // Fallback for environments where Electron app is not available
      return path.join(process.cwd(), 'test-data');
    }
  }

  /**
   * Validate that the persistence layer is initialized
   */
  private _validateInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('DataPersistence not initialized. Call initialize() first.');
    }
  }

  /**
   * Validate project object structure
   */
  private _validateProject(project: Project): void {
    if (!project || typeof project !== 'object') {
      throw new Error('Project must be an object');
    }
    if (!project.id || typeof project.id !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }
    if (!project.name || typeof project.name !== 'string' || project.name.trim().length === 0) {
      throw new Error('Project name must be a non-empty string');
    }
    if (!project.workingDirectory || typeof project.workingDirectory !== 'string') {
      throw new Error('Project working directory must be a non-empty string');
    }
  }
}
