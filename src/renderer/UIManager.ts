/**
 * UIManager handles screen navigation, state management, and UI updates for the renderer process
 */

export interface Screen {
  id: string;
  title: string;
  element?: HTMLElement | undefined;
}

export interface BreadcrumbItem {
  label: string;
  screen?: string;
  data?: any;
}

export interface LoadingState {
  isLoading: boolean;
  message?: string;
}

export interface ErrorState {
  hasError: boolean;
  message?: string;
  details?: string;
}

export class UIManager {
  private currentScreen: string | null = null;
  private screenHistory: Array<{ screen: string; data?: any }> = [];
  private screens: Map<string, Screen> = new Map();
  private breadcrumbContainer: HTMLElement | null = null;
  private contentContainer: HTMLElement | null = null;
  private loadingContainer: HTMLElement | null = null;
  private errorContainer: HTMLElement | null = null;
  private backButton: HTMLElement | null = null;

  constructor() {
    this.initializeUI();
    this.setupEventListeners();
  }

  /**
   * Initialize the basic UI structure
   */
  private initializeUI(): void {
    // Create main application structure
    document.body.innerHTML = `
      <div class="app-container">
        <header class="app-header">
          <div class="header-content">
            <button id="back-button" class="back-button" style="display: none;">
              ← Back
            </button>
            <nav class="breadcrumb" id="breadcrumb-nav"></nav>
          </div>
        </header>
        <main class="app-main">
          <div id="loading-container" class="loading-container" style="display: none;">
            <div class="loading-spinner"></div>
            <div class="loading-message">Loading...</div>
          </div>
          <div id="error-container" class="error-container" style="display: none;">
            <div class="error-icon">⚠️</div>
            <div class="error-message"></div>
            <div class="error-details"></div>
            <button class="error-dismiss">Dismiss</button>
          </div>
          <div id="content-container" class="content-container"></div>
        </main>
      </div>
    `;

    // Get references to key elements
    this.breadcrumbContainer = document.getElementById('breadcrumb-nav');
    this.contentContainer = document.getElementById('content-container');
    this.loadingContainer = document.getElementById('loading-container');
    this.errorContainer = document.getElementById('error-container');
    this.backButton = document.getElementById('back-button');

    this.addStyles();
  }

  /**
   * Add CSS styles for the UI components
   */
  private addStyles(): void {
    const style = document.createElement('style');
    style.textContent = `
      * {
        box-sizing: border-box;
      }

      body {
        font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
        margin: 0;
        padding: 0;
        background-color: #f5f5f5;
        color: #333;
      }

      .app-container {
        display: flex;
        flex-direction: column;
        height: 100vh;
      }

      .app-header {
        background-color: #fff;
        border-bottom: 1px solid #e0e0e0;
        padding: 12px 20px;
        box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      }

      .header-content {
        display: flex;
        align-items: center;
        gap: 16px;
      }

      .back-button {
        background: #007AFF;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
        transition: background-color 0.2s;
      }

      .back-button:hover {
        background: #0056CC;
      }

      .breadcrumb {
        display: flex;
        align-items: center;
        gap: 8px;
        font-size: 14px;
        color: #666;
      }

      .breadcrumb-item {
        cursor: pointer;
        color: #007AFF;
        text-decoration: none;
      }

      .breadcrumb-item:hover {
        text-decoration: underline;
      }

      .breadcrumb-item.current {
        color: #333;
        cursor: default;
        font-weight: 500;
      }

      .breadcrumb-separator {
        color: #999;
      }

      .app-main {
        flex: 1;
        position: relative;
        overflow: hidden;
      }

      .content-container {
        height: 100%;
        overflow: auto;
        padding: 20px;
      }

      .loading-container {
        position: absolute;
        top: 0;
        left: 0;
        right: 0;
        bottom: 0;
        background: rgba(255, 255, 255, 0.9);
        display: flex;
        flex-direction: column;
        align-items: center;
        justify-content: center;
        z-index: 1000;
      }

      .loading-spinner {
        width: 32px;
        height: 32px;
        border: 3px solid #f3f3f3;
        border-top: 3px solid #007AFF;
        border-radius: 50%;
        animation: spin 1s linear infinite;
        margin-bottom: 16px;
      }

      @keyframes spin {
        0% { transform: rotate(0deg); }
        100% { transform: rotate(360deg); }
      }

      .loading-message {
        font-size: 16px;
        color: #666;
      }

      .error-container {
        position: absolute;
        top: 20px;
        left: 20px;
        right: 20px;
        background: #fff;
        border: 1px solid #ff4444;
        border-radius: 8px;
        padding: 20px;
        box-shadow: 0 4px 12px rgba(0,0,0,0.15);
        z-index: 1001;
      }

      .error-icon {
        font-size: 24px;
        margin-bottom: 12px;
      }

      .error-message {
        font-size: 16px;
        font-weight: 500;
        color: #ff4444;
        margin-bottom: 8px;
      }

      .error-details {
        font-size: 14px;
        color: #666;
        margin-bottom: 16px;
        white-space: pre-wrap;
      }

      .error-dismiss {
        background: #ff4444;
        color: white;
        border: none;
        padding: 8px 16px;
        border-radius: 6px;
        cursor: pointer;
        font-size: 14px;
      }

      .error-dismiss:hover {
        background: #cc3333;
      }
    `;
    document.head.appendChild(style);
  }

  /**
   * Set up event listeners for UI interactions
   */
  private setupEventListeners(): void {
    // Back button click handler
    if (this.backButton) {
      this.backButton.addEventListener('click', () => {
        this.goBack();
      });
    }

    // Error dismiss handler
    const errorDismiss = document.querySelector('.error-dismiss');
    if (errorDismiss) {
      errorDismiss.addEventListener('click', () => {
        this.hideError();
      });
    }

    // Keyboard navigation
    document.addEventListener('keydown', (event) => {
      if (event.key === 'Escape') {
        this.hideError();
      }
      if (event.key === 'Backspace' && (event.metaKey || event.ctrlKey)) {
        this.goBack();
      }
    });
  }

  /**
   * Register a screen with the UI manager
   */
  public registerScreen(id: string, title: string, element?: HTMLElement): void {
    this.screens.set(id, { id, title, element: element || undefined });
  }

  /**
   * Navigate to a specific screen
   */
  public showScreen(screenId: string, data?: any): void {
    const screen = this.screens.get(screenId);
    if (!screen) {
      this.showError(`Screen '${screenId}' not found`);
      return;
    }

    // Add current screen to history if we're navigating from another screen
    if (this.currentScreen && this.currentScreen !== screenId) {
      this.screenHistory.push({ screen: this.currentScreen, data });
    }

    this.currentScreen = screenId;
    this.updateContent(screen, data);
    this.updateBreadcrumb();
    this.updateBackButton();
  }

  /**
   * Navigate back to the previous screen
   */
  public goBack(): void {
    if (this.screenHistory.length === 0) {
      return;
    }

    const previous = this.screenHistory.pop();
    if (previous) {
      this.currentScreen = previous.screen;
      const screen = this.screens.get(previous.screen);
      if (screen) {
        this.updateContent(screen, previous.data);
        this.updateBreadcrumb();
        this.updateBackButton();
      }
    }
  }

  /**
   * Show the project list screen
   */
  public showProjectList(): void {
    this.showScreen('project-list');
  }

  /**
   * Show the project detail screen
   */
  public showProjectDetail(projectId: string): void {
    this.showScreen('project-detail', { projectId });
  }

  /**
   * Show the view list screen
   */
  public showViewList(projectId: string): void {
    this.showScreen('view-list', { projectId });
  }

  /**
   * Show the data view screen
   */
  public showDataView(projectId: string, viewId: string): void {
    this.showScreen('data-view', { projectId, viewId });
  }

  /**
   * Update the breadcrumb navigation
   */
  public updateBreadcrumb(customPath?: BreadcrumbItem[]): void {
    if (!this.breadcrumbContainer) return;

    let breadcrumbItems: BreadcrumbItem[] = [];

    if (customPath) {
      breadcrumbItems = customPath;
    } else {
      // Generate breadcrumb based on current screen and history
      breadcrumbItems = this.generateBreadcrumbFromHistory();
    }

    this.breadcrumbContainer.innerHTML = '';

    breadcrumbItems.forEach((item, index) => {
      if (index > 0) {
        const separator = document.createElement('span');
        separator.className = 'breadcrumb-separator';
        separator.textContent = '>';
        this.breadcrumbContainer!.appendChild(separator);
      }

      const breadcrumbItem = document.createElement('span');
      breadcrumbItem.className = `breadcrumb-item ${index === breadcrumbItems.length - 1 ? 'current' : ''}`;
      breadcrumbItem.textContent = item.label;

      if (item.screen && index < breadcrumbItems.length - 1) {
        breadcrumbItem.addEventListener('click', () => {
          this.showScreen(item.screen!, item.data);
        });
      }

      this.breadcrumbContainer!.appendChild(breadcrumbItem);
    });
  }

  /**
   * Generate breadcrumb items from navigation history
   */
  private generateBreadcrumbFromHistory(): BreadcrumbItem[] {
    const items: BreadcrumbItem[] = [];

    // Always start with Projects
    items.push({ label: 'Projects', screen: 'project-list' });

    // Add current screen
    if (this.currentScreen) {
      const screen = this.screens.get(this.currentScreen);
      if (screen && this.currentScreen !== 'project-list') {
        items.push({ label: screen.title, screen: this.currentScreen });
      }
    }

    return items;
  }

  /**
   * Update the back button visibility
   */
  private updateBackButton(): void {
    if (!this.backButton) return;

    if (this.screenHistory.length > 0) {
      this.backButton.style.display = 'block';
    } else {
      this.backButton.style.display = 'none';
    }
  }

  /**
   * Update the main content area
   */
  private updateContent(screen: Screen, data?: any): void {
    if (!this.contentContainer) return;

    if (screen.element) {
      this.contentContainer.innerHTML = '';
      this.contentContainer.appendChild(screen.element);
    } else {
      // Default content for screens without custom elements
      this.contentContainer.innerHTML = `
        <div class="screen-placeholder">
          <h2>${screen.title}</h2>
          <p>Screen content will be implemented here.</p>
          ${data ? `<pre>${JSON.stringify(data, null, 2)}</pre>` : ''}
        </div>
      `;
    }
  }

  /**
   * Show loading state
   */
  public showLoading(message: string = 'Loading...'): void {
    if (!this.loadingContainer) return;

    const messageElement = this.loadingContainer.querySelector('.loading-message');
    if (messageElement) {
      messageElement.textContent = message;
    }

    this.loadingContainer.style.display = 'flex';
  }

  /**
   * Hide loading state
   */
  public hideLoading(): void {
    if (!this.loadingContainer) return;
    this.loadingContainer.style.display = 'none';
  }

  /**
   * Show error message
   */
  public showError(message: string, details?: string): void {
    if (!this.errorContainer) return;

    const messageElement = this.errorContainer.querySelector('.error-message');
    const detailsElement = this.errorContainer.querySelector('.error-details');

    if (messageElement) {
      messageElement.textContent = message;
    }

    if (detailsElement) {
      detailsElement.textContent = details || '';
      (detailsElement as HTMLElement).style.display = details ? 'block' : 'none';
    }

    this.errorContainer.style.display = 'block';
  }

  /**
   * Hide error message
   */
  public hideError(): void {
    if (!this.errorContainer) return;
    this.errorContainer.style.display = 'none';
  }

  /**
   * Get the current screen ID
   */
  public getCurrentScreen(): string | null {
    return this.currentScreen;
  }

  /**
   * Get the navigation history
   */
  public getHistory(): Array<{ screen: string; data?: any }> {
    return [...this.screenHistory];
  }

  /**
   * Clear navigation history
   */
  public clearHistory(): void {
    this.screenHistory = [];
    this.updateBackButton();
  }

  /**
   * Check if we can navigate back
   */
  public canGoBack(): boolean {
    return this.screenHistory.length > 0;
  }
}