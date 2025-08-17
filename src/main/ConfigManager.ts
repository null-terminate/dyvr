import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import { Config, CONFIG_FOLDER, CONFIG_FILENAME } from '../types';

/**
 * ConfigManager handles reading and writing the config file
 * in the config folder in the user's home directory.
 */
export class ConfigManager {
  private configPath: string;
  private isInitialized: boolean = false;

  /**
   * Creates a new ConfigManager instance
   * @param configPath Optional custom path for the config file (used for testing)
   */
  constructor(configPath?: string) {
    if (configPath) {
      this.configPath = configPath;
    } else {
      const homeDir = os.homedir();
      const configDir = path.join(homeDir, CONFIG_FOLDER);
      this.configPath = path.join(configDir, CONFIG_FILENAME);
    }
  }

  /**
   * Initialize the ConfigManager
   * Ensures the config directory and config file exist
   */
  async initialize(): Promise<void> {
    try {
      await this.ensureGlobalConfigDirectory();
      await this.ensureConfigFile();
      this.isInitialized = true;
    } catch (error) {
      throw new Error(`Failed to initialize ConfigManager: ${(error as Error).message}`);
    }
  }

  /**
   * Get the config file content
   */
  async getConfig(): Promise<Config> {
    this._validateInitialized();

    try {
      const data = await fs.promises.readFile(this.configPath, 'utf8');
      
      try {
        return JSON.parse(data) as Config;
      } catch (error) {
        console.warn(`Invalid JSON in ${CONFIG_FILENAME}: ${(error as Error).message}`);
        return { projects: [], settings: { fontFamily: 'Roboto Mono' } };
      }
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
        return { projects: [], settings: { fontFamily: 'Roboto Mono' } };
      }
      throw new Error(`Failed to read ${CONFIG_FILENAME}: ${(error as Error).message}`);
    }
  }

  /**
   * Save the config file content
   */
  async saveConfig(config: Config): Promise<void> {
    this._validateInitialized();

    try {
      await fs.promises.writeFile(
        this.configPath,
        JSON.stringify(config, null, 2),
        'utf8'
      );
    } catch (error) {
      throw new Error(`Failed to save ${CONFIG_FILENAME}: ${(error as Error).message}`);
    }
  }

  /**
   * Add a project to the config file
   */
  async addProject(path: string): Promise<void> {
    this._validateInitialized();

    try {
      // Verify the path exists
      if (!fs.existsSync(path)) {
        console.warn(`ConfigManager: Path "${path}" does not exist, but adding to config anyway`);
      }
      
      const config = await this.getConfig();
      
      // Check if project already exists
      const existingIndex = config.projects.findIndex((p: { path: string }) => p.path === path);
      
      if (existingIndex >= 0) {
        // Update existing project
        config.projects[existingIndex] = { path };
      } else {
        // Add new project
        config.projects.push({ path });
      }

      await this.saveConfig(config);
    } catch (error) {
      throw new Error(`Failed to add project to ${CONFIG_FILENAME}: ${(error as Error).message}`);
    }
  }

  /**
   * Remove a project from the config file
   */
  async removeProject(path: string): Promise<void> {
    this._validateInitialized();

    try {
      const config = await this.getConfig();
      config.projects = config.projects.filter((p: { path: string }) => p.path !== path);
      await this.saveConfig(config);
    } catch (error) {
      throw new Error(`Failed to remove project from ${CONFIG_FILENAME}: ${(error as Error).message}`);
    }
  }

  /**
   * Ensure the config directory exists in the user's home directory
   */
  private async ensureGlobalConfigDirectory(): Promise<void> {
    try {
      const configDir = path.dirname(this.configPath);
      
      if (!fs.existsSync(configDir)) {
        await fs.promises.mkdir(configDir, { recursive: true });
      }
    } catch (error) {
      throw new Error(`Failed to create ${CONFIG_FOLDER} directory: ${(error as Error).message}`);
    }
  }

  /**
   * Ensure the config file exists
   */
  private async ensureConfigFile(): Promise<void> {
    try {
      if (!fs.existsSync(this.configPath)) {
        const defaultConfig: Config = { 
          projects: [],
          settings: {
            fontFamily: 'Roboto Mono'
          }
        };
        await fs.promises.writeFile(
          this.configPath,
          JSON.stringify(defaultConfig, null, 2),
          'utf8'
        );
      }
    } catch (error) {
      throw new Error(`Failed to create ${CONFIG_FILENAME} file: ${(error as Error).message}`);
    }
  }

  /**
   * Validate that the ConfigManager is initialized
   */
  private _validateInitialized(): void {
    if (!this.isInitialized) {
      throw new Error('ConfigManager not initialized. Call initialize() first.');
    }
  }
  
  /**
   * Reset the config file to an empty state (for testing purposes)
   */
  async resetConfig(): Promise<void> {
    this._validateInitialized();
    
    try {
      const emptyConfig: Config = { 
        projects: [],
        settings: {
          fontFamily: 'Roboto Mono'
        }
      };
      await this.saveConfig(emptyConfig);
    } catch (error) {
      throw new Error(`Failed to reset ${CONFIG_FILENAME}: ${(error as Error).message}`);
    }
  }

  /**
   * Get the font family preference
   */
  async getFontFamily(): Promise<'Roboto Mono' | 'Courier New'> {
    this._validateInitialized();

    try {
      const config = await this.getConfig();
      return config.settings?.fontFamily || 'Roboto Mono';
    } catch (error) {
      console.warn(`Failed to get font family preference: ${(error as Error).message}`);
      return 'Roboto Mono'; // Default to Roboto Mono if there's an error
    }
  }

  /**
   * Set the font family preference
   */
  async setFontFamily(fontFamily: 'Roboto Mono' | 'Courier New'): Promise<void> {
    this._validateInitialized();

    try {
      const config = await this.getConfig();
      
      if (!config.settings) {
        config.settings = {};
      }
      
      config.settings.fontFamily = fontFamily;
      await this.saveConfig(config);
    } catch (error) {
      throw new Error(`Failed to set font family preference: ${(error as Error).message}`);
    }
  }
}
