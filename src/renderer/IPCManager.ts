/**
 * IPCManager handles IPC communication between renderer and main process
 */

export interface IPCResponse<T = any> {
  success: boolean;
  data?: T;
  error?: string;
  details?: string;
}

export interface IPCRequest {
  id: string;
  event: string;
  data?: any;
  timestamp: number;
}

export interface IPCTimeout {
  timeout?: number; // milliseconds
  retries?: number;
}

export class IPCManager {
  private pendingRequests: Map<string, {
    resolve: (value: any) => void;
    reject: (reason: any) => void;
    timeout: NodeJS.Timeout;
    retries: number;
  }> = new Map();

  private requestCounter = 0;
  private defaultTimeout = 30000; // 30 seconds
  private defaultRetries = 3;
  private isElectronEnvironment = false;

  constructor() {
    this.initializeIPC();
  }

  /**
   * Initialize IPC communication
   */
  private initializeIPC(): void {
    // Check if we're in an Electron environment
    this.isElectronEnvironment = typeof window !== 'undefined' && 
                                 typeof (window as any).require === 'function';

    if (this.isElectronEnvironment) {
      try {
        const { ipcRenderer } = (window as any).require('electron');
        
        // Set up response handler
        ipcRenderer.on('ipc-response', (event: any, response: IPCResponse & { requestId: string }) => {
          this.handleIPCResponse(response);
        });

        // Set up error handler
        ipcRenderer.on('ipc-error', (event: any, error: { requestId: string; error: string; details?: string }) => {
          this.handleIPCError(error);
        });

      } catch (error) {
        console.warn('Failed to initialize IPC:', error);
        this.isElectronEnvironment = false;
      }
    }
  }

  /**
   * Send an IPC message and return a promise
   */
  public async sendMessage<T = any>(
    event: string, 
    data?: any, 
    options: IPCTimeout = {}
  ): Promise<T> {
    if (!this.isElectronEnvironment) {
      throw new Error('IPC communication is not available outside of Electron environment');
    }

    const requestId = this.generateRequestId();
    const timeout = options.timeout || this.defaultTimeout;
    const maxRetries = options.retries !== undefined ? options.retries : this.defaultRetries;

    return this.sendWithRetry<T>(event, data, requestId, timeout, maxRetries, 0);
  }

  /**
   * Send message with retry logic
   */
  private async sendWithRetry<T>(
    event: string,
    data: any,
    requestId: string,
    timeout: number,
    maxRetries: number,
    currentRetry: number
  ): Promise<T> {
    return new Promise<T>((resolve, reject) => {
      // Set up timeout
      const timeoutHandle = setTimeout(() => {
        this.pendingRequests.delete(requestId);
        
        if (currentRetry < maxRetries) {
          // Retry the request
          this.sendWithRetry<T>(event, data, requestId, timeout, maxRetries, currentRetry + 1)
            .then(resolve)
            .catch(reject);
        } else {
          reject(new Error(`IPC request timeout after ${timeout}ms (${maxRetries + 1} attempts)`));
        }
      }, timeout);

      // Store the request
      this.pendingRequests.set(requestId, {
        resolve,
        reject,
        timeout: timeoutHandle,
        retries: currentRetry
      });

      try {
        const { ipcRenderer } = (window as any).require('electron');
        const request: IPCRequest = {
          id: requestId,
          event,
          data,
          timestamp: Date.now()
        };

        ipcRenderer.send('ipc-request', request);
      } catch (error) {
        clearTimeout(timeoutHandle);
        this.pendingRequests.delete(requestId);
        reject(new Error(`Failed to send IPC message: ${error}`));
      }
    });
  }

  /**
   * Handle IPC response from main process
   */
  private handleIPCResponse(response: IPCResponse & { requestId: string }): void {
    const pending = this.pendingRequests.get(response.requestId);
    if (!pending) {
      console.warn('Received response for unknown request:', response.requestId);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(response.requestId);

    if (response.success) {
      pending.resolve(response.data);
    } else {
      const error = new Error(response.error || 'Unknown IPC error');
      (error as any).details = response.details;
      pending.reject(error);
    }
  }

  /**
   * Handle IPC error from main process
   */
  private handleIPCError(error: { requestId: string; error: string; details?: string }): void {
    const pending = this.pendingRequests.get(error.requestId);
    if (!pending) {
      console.warn('Received error for unknown request:', error.requestId);
      return;
    }

    clearTimeout(pending.timeout);
    this.pendingRequests.delete(error.requestId);

    const errorObj = new Error(error.error);
    (errorObj as any).details = error.details;
    pending.reject(errorObj);
  }

  /**
   * Generate unique request ID
   */
  private generateRequestId(): string {
    return `ipc-${Date.now()}-${++this.requestCounter}`;
  }

  /**
   * Set default timeout for all requests
   */
  public setDefaultTimeout(timeout: number): void {
    this.defaultTimeout = timeout;
  }

  /**
   * Set default number of retries for all requests
   */
  public setDefaultRetries(retries: number): void {
    this.defaultRetries = retries;
  }

  /**
   * Get the number of pending requests
   */
  public getPendingRequestCount(): number {
    return this.pendingRequests.size;
  }

  /**
   * Cancel all pending requests
   */
  public cancelAllRequests(): void {
    for (const [requestId, pending] of this.pendingRequests) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Request cancelled'));
    }
    this.pendingRequests.clear();
  }

  /**
   * Cancel a specific request
   */
  public cancelRequest(requestId: string): boolean {
    const pending = this.pendingRequests.get(requestId);
    if (pending) {
      clearTimeout(pending.timeout);
      pending.reject(new Error('Request cancelled'));
      this.pendingRequests.delete(requestId);
      return true;
    }
    return false;
  }

  /**
   * Check if IPC is available
   */
  public isIPCAvailable(): boolean {
    return this.isElectronEnvironment;
  }

  // Convenience methods for common IPC operations

  /**
   * Load all projects
   */
  public async loadProjects(): Promise<any[]> {
    return this.sendMessage('load-projects');
  }

  /**
   * Create a new project
   */
  public async createProject(name: string, workingDirectory: string): Promise<any> {
    return this.sendMessage('create-project', { name, workingDirectory });
  }

  /**
   * Delete a project
   */
  public async deleteProject(projectId: string): Promise<void> {
    return this.sendMessage('delete-project', { projectId });
  }

  /**
   * Add source folder to project
   */
  public async addSourceFolder(projectId: string, folderPath: string): Promise<void> {
    return this.sendMessage('add-source-folder', { projectId, folderPath });
  }

  /**
   * Remove source folder from project
   */
  public async removeSourceFolder(projectId: string, folderPath: string): Promise<void> {
    return this.sendMessage('remove-source-folder', { projectId, folderPath });
  }

  /**
   * Create a new view
   */
  public async createView(projectId: string, viewName: string): Promise<any> {
    return this.sendMessage('create-view', { projectId, viewName });
  }

  /**
   * Delete a view
   */
  public async deleteView(projectId: string, viewId: string): Promise<void> {
    return this.sendMessage('delete-view', { projectId, viewId });
  }

  /**
   * Scan data for a view
   */
  public async scanData(projectId: string, viewId: string): Promise<any> {
    return this.sendMessage('scan-data', { projectId, viewId });
  }

  /**
   * Execute a query
   */
  public async executeQuery(projectId: string, viewId: string, query: any): Promise<any> {
    return this.sendMessage('execute-query', { projectId, viewId, query });
  }

  /**
   * Open folder in system explorer
   */
  public async openFolder(folderPath: string): Promise<void> {
    return this.sendMessage('open-folder', { folderPath });
  }

  /**
   * Get project details
   */
  public async getProject(projectId: string): Promise<any> {
    return this.sendMessage('get-project', { projectId });
  }

  /**
   * Get views for a project
   */
  public async getViews(projectId: string): Promise<any[]> {
    return this.sendMessage('get-views', { projectId });
  }

  /**
   * Get view details
   */
  public async getView(projectId: string, viewId: string): Promise<any> {
    return this.sendMessage('get-view', { projectId, viewId });
  }

  /**
   * Update project details
   */
  public async updateProject(projectId: string, updates: any): Promise<any> {
    return this.sendMessage('update-project', { projectId, updates });
  }

  /**
   * Get source folders for a project
   */
  public async getSourceFolders(projectId: string): Promise<any[]> {
    return this.sendMessage('get-source-folders', { projectId });
  }
}