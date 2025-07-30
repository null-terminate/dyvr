import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { DigrConfig } from '../types';

/**
 * DigrConfigManager handles reading and writing the digr.config file
 * in the .digr folder in the user's home directory.
 */
export class DigrConfigManager {
  private configPath: string;
  private isInitialized: boolean = false;

  /**
   * Creates a new DigrConfigManager instance
   * @param configPath Optional custom path for the config file (used for testing)
   */
  constructor(configPath?: string) {
    if (configPath) {
      this.configPath = configPath;
    } else {
      const homeDir = os.homedir();
      const digrDir = path.join(homeDir, '.digr');
      this.configPath = path.join(digrDir, 'digr.config');
    }
  }

  /**
   * Initialize the DigrConfigManager
   * Ensures the .digr directory and digr.config file exist
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureDigrDirectory();
      await this.ensureConfigFile();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize DigrConfigManager: ${(error as Error).message}`);
    }
  }

  /**
   * Get the digr.config file content
   */
  async getConfig(): Promise<DigrConfig> {
    this._validateInitialized();

    try {
      const data = await fs.promises.readFile(this.configPath, 'utf8');
      
      try {
        return JSON.parse(data) as DigrConfig;
      } catch (error) {
        console.warn(`Invalid JSON in digr.config: ${(error as Error).message}`);
        return { projects: [] };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { projects: [] };
      }
      throw new Error(`Failed to read digr.config: ${(error as Error).message}`);
    }
  }

  /**
   * Save the digr.config file content
   */
  async saveConfig(config: DigrConfig): Promise<void> {
    this._validateInitialized();

    try {
      await fs.promises.writeFile(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf8'
      );
    } catch (error) {
      throw new Error(`Failed to save digr.config: ${(error as Error).message}`);
    }
  }

  /**
   * Add a project to the digr.config file
   */
  async addProject(path: string): Promise<void> {
    this._validateInitialized();

    try {
      console.log(`DigrConfigManager: Adding project with path "${path}" to digr.config`);
      
      // Verify the path exists
      if (!fs.existsSync(path)) {
        console.warn(`DigrConfigManager: Path "${path}" does not exist, but adding to config anyway`);
      } else {
        console.log(`DigrConfigManager: Path "${path}" exists`);
      }
      
      const config = await this.getConfig();
      console.log(`DigrConfigManager: Current config has ${config.projects.length} projects`);
      
      // Check if project already exists
      const existingIndex = config.projects.findIndex((p: { path: string }) => p.path === path);
      
      if (existingIndex >= 0) {
        // Update existing project
        console.log(`DigrConfigManager: Project with path "${path}" already exists at index ${existingIndex}, updating`);
        config.projects[existingIndex] = { path };
      } else {
        // Add new project
        console.log(`DigrConfigManager: Adding new project with path "${path}"`);
        config.projects.push({ path });
      }

      console.log(`DigrConfigManager: Saving config with ${config.projects.length} projects`);
      await this.saveConfig(config);
      console.log(`DigrConfigManager: Config saved successfully`);
    } catch (error) {
      console.error(`DigrConfigManager: Failed to add project to digr.config: ${(error as Error).message}`);
      throw new Error(`Failed to add project to digr.config: ${(error as Error).message}`);
    }
  }

  /**
   * Remove a project from the digr.config file
   */
  async removeProject(path: string): Promise<void> {
    this._validateInitialized();

    try {
      const config = await this.getConfig();
      config.projects = config.projects.filter((p: { path: string }) => p.path !== path);
      await this.saveConfig(config);
    } catch (error) {
      throw new Error(`Failed to remove project from digr.config: ${(error as Error).message}`);
    }
  }

  /**
   * Ensure the .digr directory exists in the user's home directory
   */
  private async ensureDigrDirectory(): Promise<void> {
    try {
      const digrDir = path.dirname(this.configPath);
      
      if (!fs.existsSync(digrDir)) {
        await fs.promises.mkdir(digrDir, { recursive: true });
      }
    } catch (error) {
      throw new Error(`Failed to create .digr directory: ${(error as Error).message}`);
    }
  }

  /**
   * Ensure the digr.config file exists
   */
  private async ensureConfigFile(): Promise<void> {
    try {
      if (!fs.existsSync(this.configPath)) {
        const defaultConfig: DigrConfig = { projects: [] };
        await fs.promises.writeFile(
          this.configPath,
          JSON.stringify(defaultConfig, null, 2),
          'utf8'
        );
      }
    } catch (error) {
      throw new Error(`Failed to create digr.config file: ${(error as Error).message}`);
    }
  }

  /**
   * Validate that the DigrConfigManager is initialized
   */
  private _validateInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('DigrConfigManager not initialized. Call initialize() first.');
    }
  }
  
  /**
   * Reset the config file to an empty state (for testing purposes)
   */
  async resetConfig(): Promise<void> {
    this._validateInitialized();
    
    try {
      const emptyConfig: DigrConfig = { projects: [] };
      await this.saveConfig(emptyConfig);
    } catch (error) {
      throw new Error(`Failed to reset digr.config: ${(error as Error).message}`);
    }
  }
}
