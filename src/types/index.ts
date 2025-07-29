// Core data model interfaces for the project management application

export interface SourceFolder {
  id: string;
  path: string;
  addedDate: Date;
}

export interface Project {
  id: string;           // Unique identifier
  name: string;         // User-provided name
  workingDirectory: string;  // Full path to working directory
  sourceFolders: SourceFolder[];  // Array of source data folder paths
  createdDate: Date;
  lastModified: Date;
}

export interface ColumnSchema {
  columnName: string;
  dataType: 'TEXT' | 'INTEGER' | 'REAL';
  nullable: boolean;
}

export interface View {
  id: string;           // Unique identifier
  projectId: string;    // Parent project ID
  name: string;         // User-provided name
  createdDate: Date;
  lastModified: Date;
  lastQuery?: QueryModel | undefined;    // Last applied query (optional)
  tableSchema: ColumnSchema[];  // Schema of the data table
}

export interface ScanError {
  file: string;
  error: string;
}

export interface ScanColumn {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'REAL';
  nullable: boolean;
  sampleValues: any[];  // Sample values for type inference
}

export interface ScanResults {
  viewId: string;       // Target view ID
  totalFiles: number;   // Total JSON files found
  processedFiles: number; // Successfully processed files
  totalRecords: number; // Total records inserted
  columns: ScanColumn[];  // Discovered column schema
  errors: ScanError[];  // Processing errors
  scanDate: Date;
}

export type QueryOperator = 'equals' | 'contains' | 'greater' | 'less' | 'like';

export interface QueryFilter {
  column: string;       // Column name to filter on
  operator: QueryOperator;  // Filter operator
  value: any;          // Filter value
  dataType: 'TEXT' | 'INTEGER' | 'REAL';  // Data type for proper SQL generation
}

export interface QueryModel {
  viewId: string;       // Target view ID
  filters: QueryFilter[];
  sortBy?: string;      // Column name to sort by
  sortDirection?: 'ASC' | 'DESC';  // Sort direction
  limit?: number;       // Result limit for pagination
  offset?: number;      // Result offset for pagination
}

export interface QueryResult {
  data: any[];          // Query result rows
  totalCount: number;   // Total count without pagination
  columns: string[];    // Column names in result
}

// IPC Event types for communication between main and renderer processes
export interface IPCEvents {
  // Main → Renderer Events
  'projects-loaded': Project[];
  'project-created': Project;
  'project-deleted': string; // projectId
  'source-folder-added': { projectId: string; folder: SourceFolder };
  'source-folder-removed': { projectId: string; folderId: string };
  'view-created': View;
  'view-deleted': { projectId: string; viewId: string };
  'data-scanned': ScanResults;
  'query-results': QueryResult;
  'scan-progress': { current: number; total: number; message: string };
  'error': { message: string; details?: any };

  // Renderer → Main Events
  'load-projects': void;
  'create-project': { name: string; workingDirectory: string };
  'delete-project': string; // projectId
  'add-source-folder': { projectId: string; folderPath: string };
  'remove-source-folder': { projectId: string; folderId: string };
  'create-view': { projectId: string; viewName: string };
  'delete-view': { projectId: string; viewId: string };
  'scan-data': { projectId: string; viewId: string };
  'execute-query': { projectId: string; query: QueryModel };
  'open-folder': string; // folderPath
}