// Export types for the Electron API

export interface ProjectSummary {
  id: string;
  name: string;
  lastOpened: Date;
}

export interface Project {
  id: string;
  name: string;
  path: string;
  workingDirectory: string;
  sourceFolders: SourceFolder[];
  created: Date;
  lastOpened: Date;
}

export interface SourceFolder {
  id: string;
  path: string;
}

export interface View {
  id: string;
  name: string;
  projectId: string;
  created: Date;
}

export interface ScanProgress {
  current: number;
  total: number;
  message: string;
}

export interface ScanResults {
  viewId: string;
  processedFiles: number;
  totalRecords: number;
  columns: ColumnDefinition[];
}

export interface ColumnDefinition {
  name: string;
  type: string;
  path: string;
}

export interface QueryModel {
  viewId: string;
  columns: string[];
  filters: FilterCondition[];
  sort: SortDefinition[];
  limit?: number;
  offset?: number;
}

export interface FilterCondition {
  column: string;
  operator: string;
  value: any;
}

export interface SortDefinition {
  column: string;
  direction: 'asc' | 'desc';
}

export interface QueryResult {
  data: any[];
  totalCount: number;
  columns: ColumnDefinition[];
}

export interface ElectronAPI {
  // Project operations
  loadProjects: () => void;
  onProjectsLoaded: (callback: (projects: Project[]) => void) => void;
  createProject: (name: string, workingDirectory: string) => void;
  onProjectCreated: (callback: (project: Project) => void) => void;
  deleteProject: (projectId: string) => void;
  onProjectDeleted: (callback: (projectId: string) => void) => void;

  // Source folder operations
  addSourceFolder: (projectId: string, folderPath: string) => void;
  onSourceFolderAdded: (callback: (data: { projectId: string, folder: SourceFolder }) => void) => void;
  removeSourceFolder: (projectId: string, folderId: string) => void;
  onSourceFolderRemoved: (callback: (data: { projectId: string, folderId: string }) => void) => void;
  openFolder: (folderPath: string) => void;

  // View operations
  createView: (projectId: string, viewName: string) => void;
  onViewCreated: (callback: (view: View) => void) => void;
  deleteView: (projectId: string, viewId: string) => void;
  onViewDeleted: (callback: (data: { projectId: string, viewId: string }) => void) => void;
  getViews: (projectId: string) => void;
  onViewsLoaded: (callback: (views: View[]) => void) => void;

  // Data operations
  scanData: (projectId: string, viewId: string) => void;
  onScanProgress: (callback: (progress: ScanProgress) => void) => void;
  onDataScanned: (callback: (results: ScanResults) => void) => void;
  executeQuery: (projectId: string, query: QueryModel) => void;
  onQueryResults: (callback: (results: QueryResult) => void) => void;
  getViewSchema: (projectId: string, viewId: string) => void;
  onViewSchemaLoaded: (callback: (data: { projectId: string, viewId: string, schema: ColumnDefinition[] }) => void) => void;
  checkViewData: (projectId: string, viewId: string) => void;
  onViewDataStatus: (callback: (data: { projectId: string, viewId: string, hasData: boolean }) => void) => void;

  // Error handling
  onError: (callback: (error: { message: string, details?: string }) => void) => void;

  // Remove event listeners
  removeAllListeners: (channel: string) => void;
}
