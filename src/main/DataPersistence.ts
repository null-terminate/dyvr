import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { v4 as uuidv4 } from 'uuid';
import { Project } from '../types';
import { DigrConfigManager } from './DigrConfigManager';

/**
 * DataPersistence handles project data operations by directly using the digr.config file
 * as the single source of truth for project existence.
 */
export class DataPersistence {
  private isInitialized: boolean = false;
  private digrConfigManager: DigrConfigManager;
  private projectCache: Map<string, Project> = new Map();

  /**
   * Creates a new DataPersistence instance
   * @param configPath Optional custom path for the config file (used for testing)
   */
  constructor(configPath?: string) {
    this.digrConfigManager = new DigrConfigManager(configPath);
  }

  /**
   * Initialize the data persistence layer
   */
  async initialize(): Promise<void> {
    try {
      await this.digrConfigManager.initialize();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize data persistence: ${(error as Error).message}`);
    }
  }

  /**
   * Load projects directly from digr.config
   */
  async loadProjectRegistry(): Promise<Project[]> {
    this._validateInitialized();

    try {
      console.log(`DataPersistence: Loading projects from digr.config`);
      const config = await this.digrConfigManager.getConfig();
      console.log(`DataPersistence: Found ${config.projects.length} projects in digr.config`);
      
      const projects: Project[] = [];
      
      for (const configProject of config.projects) {
        const projectPath = configProject.path;
        console.log(`DataPersistence: Processing project with path "${projectPath}"`);
        
        // Check if the project path exists
        if (!fs.existsSync(projectPath)) {
          console.warn(`DataPersistence: Project path "${projectPath}" does not exist, but will still load it`);
        } else {
          console.log(`DataPersistence: Project path "${projectPath}" exists`);
          
          // Check if the project path has a .digr subfolder
          const digrFolderPath = path.join(projectPath, '.digr');
          if (!fs.existsSync(digrFolderPath)) {
            console.warn(`DataPersistence: Project path "${projectPath}" does not have a .digr subfolder`);
          } else {
            console.log(`DataPersistence: Project path "${projectPath}" has a .digr subfolder`);
          }
        }
        
        // Check if we have this project in cache
        const cachedProject = Array.from(this.projectCache.values())
          .find(p => path.resolve(p.workingDirectory) === path.resolve(projectPath));
        
        if (cachedProject) {
          console.log(`DataPersistence: Found project "${cachedProject.name}" (${cachedProject.id}) in cache`);
          projects.push(cachedProject);
        } else {
          // Create a new project object
          const projectName = path.basename(projectPath);
          console.log(`DataPersistence: Creating new project object for "${projectName}" at "${projectPath}"`);
          
          const project: Project = {
            id: uuidv4(),
            name: projectName,
            workingDirectory: projectPath,
            sourceFolders: [],
            createdDate: new Date(),
            lastModified: new Date()
          };
          
          console.log(`DataPersistence: Created project with ID "${project.id}"`);
          
          // Add to cache
          this.projectCache.set(project.id, project);
          projects.push(project);
        }
      }
      
      console.log(`DataPersistence: Returning ${projects.length} projects`);
      return projects;
    } catch (error) {
      console.error('Failed to load projects from digr.config:', error);
      return [];
    }
  }

  /**
   * Add a project to digr.config
   */
  async addProjectToRegistry(project: Project): Promise<void> {
    this._validateInitialized();
    this._validateProject(project);

    try {
      // Add to digr.config
      await this.digrConfigManager.addProject(project.workingDirectory);
      
      // Update cache
      this.projectCache.set(project.id, {
        ...project,
        lastModified: new Date()
      });
    } catch (error) {
      throw new Error(`Failed to add project: ${(error as Error).message}`);
    }
  }

  /**
   * Remove a project from digr.config
   */
  async removeProjectFromRegistry(projectId: string): Promise<void> {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      // Get project from cache
      const project = this.projectCache.get(projectId);
      if (!project) {
        // Try to find it in the loaded projects
        const projects = await this.loadProjectRegistry();
        const foundProject = projects.find(p => p.id === projectId);
        if (!foundProject) {
          throw new Error(`Project with ID ${projectId} not found`);
        }
        
        // Remove from digr.config
        await this.digrConfigManager.removeProject(foundProject.workingDirectory);
      } else {
        // Remove from digr.config
        await this.digrConfigManager.removeProject(project.workingDirectory);
        
        // Remove from cache
        this.projectCache.delete(projectId);
      }
    } catch (error) {
      throw new Error(`Failed to remove project: ${(error as Error).message}`);
    }
  }

  /**
   * Update a project
   */
  async updateProjectInRegistry(projectId: string, updates: Partial<Project>): Promise<void> {
    this._validateInitialized();
    
    if (!projectId || typeof projectId !== 'string') {
      throw new Error('Project ID must be a non-empty string');
    }

    try {
      // Get project from cache
      let project = this.projectCache.get(projectId);
      
      if (!project) {
        // Try to find it in the loaded projects
        const projects = await this.loadProjectRegistry();
        project = projects.find(p => p.id === projectId);
        
        if (!project) {
          throw new Error(`Project with ID ${projectId} not found`);
        }
      }
      
      // If working directory changed, update digr.config
      if (updates.workingDirectory && updates.workingDirectory !== project.workingDirectory) {
        await this.digrConfigManager.removeProject(project.workingDirectory);
        await this.digrConfigManager.addProject(updates.workingDirectory);
      }
      
      // Update cache
      const updatedProject = {
        ...project,
        name: updates.name || project.name,
        workingDirectory: updates.workingDirectory || project.workingDirectory,
        sourceFolders: updates.sourceFolders || project.sourceFolders,
        lastModified: new Date()
      };
      
      this.projectCache.set(projectId, updatedProject);
    } catch (error) {
      throw new Error(`Failed to update project: ${(error as Error).message}`);
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
  
  /**
   * Reset the project cache and config (for testing purposes)
   */
  async resetCache(): Promise<void> {
    this.projectCache.clear();
    await this.digrConfigManager.resetConfig();
  }
}
