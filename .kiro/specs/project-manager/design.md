# Design Document

## Overview

This design document outlines the architecture for DYVR, a TypeScript React-based Electron desktop application that enables users to create and manage projects with associated working directories and source data folders. The application provides functionality for scanning JSON data files from these folders and executing SQL queries against the data.

The application is designed as a single-window desktop application with multiple screens for project management, source folder management, and data querying. Each project maintains its own local SQLite database within a `.digr` folder in the project's working directory, providing project-level data isolation and portability. Additionally, a global configuration file tracks all projects across the system.

**Technology Stack**: 
- **TypeScript**: Used throughout the entire application (both main and renderer processes) for enhanced type safety, better IDE support, and improved maintainability
- **React**: Powers the user interface components in the renderer process
- **Electron**: Provides the cross-platform desktop framework with its main/renderer process architecture
- **SQLite**: Used for local data storage, with a distributed database approach where each project maintains its own database file

## Architecture

### Process Architecture

The application follows Electron's standard two-process architecture:

**Main Process**
- Application lifecycle management
- Window creation and management
- File system operations (project creation, JSON scanning, .digr folder management)
- SQLite database management and operations (per-project databases)
- Application metadata persistence (global registry and per-project data)
- IPC communication with renderer process

**Renderer Process**
- User interface rendering using React
- User interaction handling
- Data visualization (tables, forms)
- Query interface for data filtering
- Communication with main process via IPC

### Application States

The application has several primary screens/states:

1. **Project List Screen** - Shows all projects, allows creation/deletion
2. **Project Detail Screen** - Shows project info with tabbed interface:
   - **Details Tab** - Basic project information
   - **Files Tab** - Source folder management and scanning
   - **Query Tab** - SQL query interface for data analysis
3. **Settings Screen** - Application configuration

### Data Flow

```
User Action → Renderer Process → IPC → Main Process → File System/SQLite Database
                     ↓
File System/SQLite Database → Main Process → IPC → Renderer Process → UI Update
```

**Data Scanning Flow:**
```
JSON Files → JSONScanner → Schema Analysis → DatabaseManager → SQLite Table Creation → Data Population
```

**Query Flow:**
```
User SQL Query → Main Process → DatabaseManager → SQLite Execution → Results → Renderer Process → Table Display
```

## Components and Interfaces

### Main Process Components

#### ProjectManager
Handles project CRUD operations and persistence across global registry and per-project databases. Uses a distributed approach where project metadata is stored in a global registry, while project-specific data is stored in per-project .digr databases.

```typescript
class ProjectManager {
  initialize(): Promise<void>
  loadProjectRegistry(): Promise<Project[]>
  addProjectToRegistry(project: Project): Promise<void>
  removeProjectFromRegistry(projectId: string): Promise<void>
  updateProjectInRegistry(projectId: string, updates: Partial<Project>): Promise<Project>
  projectNameExists(projectName: string, excludeProjectId?: string): Promise<boolean>
  createProject(name: string, workingDirectory: string): Promise<Project>
  getProject(projectId: string): Promise<Project | null>
  getProjects(): Promise<Project[]>
  deleteProject(projectId: string): Promise<void>
  saveProjectJson(project: Project): Promise<void>
  loadProjectJson(projectWorkingDirectory: string): Promise<Partial<Project> | null>
  addSourceFolder(projectId: string, folderPath: string): Promise<void>
  removeSourceFolder(projectId: string, folderPath: string): Promise<void>
  getSourceFolders(projectId: string): Promise<SourceFolder[]>
  loadProjects(): Promise<void>
  openProjectDatabase(projectId: string): Promise<DatabaseManager>
  closeProjectDatabase(projectId: string): Promise<void>
  ensureProjectDigrFolder(workingDirectory: string): Promise<void>
  ensureProjectDatabase(projectId: string, project: Project): Promise<void>
  close(): Promise<void>
}
```

#### DigrConfigManager
Handles reading and writing the digr.config file in the .digr folder in the user's home directory, which serves as the global registry of projects.

```typescript
class DigrConfigManager {
  initialize(): Promise<void>
  getConfig(): Promise<DigrConfig>
  saveConfig(config: DigrConfig): Promise<void>
  addProject(path: string): Promise<void>
  removeProject(path: string): Promise<void>
  ensureDigrDirectory(): Promise<void>
  ensureConfigFile(): Promise<void>
  resetConfig(): Promise<void>
}
```

#### ViewManager
Handles view CRUD operations with per-project database integration. Each project maintains its own SQLite database with views stored in the project's .digr folder.

```typescript
class ViewManager {
  initialize(): Promise<void>
  createView(projectWorkingDirectory: string, viewName: string): Promise<View>
  createViewInProject(projectWorkingDirectory: string, viewName: string): Promise<View>
  getView(projectWorkingDirectory: string, viewId: string): Promise<View | null>
  getViews(projectId: string): Promise<View[]>
  getViewsForProject(projectWorkingDirectory: string): Promise<View[]>
  updateView(projectWorkingDirectory: string, viewId: string, updates: ViewUpdateData): Promise<View>
  deleteView(projectWorkingDirectory: string, viewId: string): Promise<boolean>
  deleteViewInProject(projectWorkingDirectory: string, viewId: string): Promise<boolean>
  viewNameExists(projectWorkingDirectory: string, viewName: string, excludeViewId?: string): Promise<boolean>
  isViewNameAvailable(projectWorkingDirectory: string, viewName: string, excludeViewId?: string): Promise<boolean>
  getViewDataSchema(projectWorkingDirectory: string, viewId: string): Promise<any[]>
  viewHasDataTable(projectWorkingDirectory: string, viewId: string): Promise<boolean>
  saveViews(): Promise<void>
  loadViews(): Promise<void>
  closeProjectDatabase(projectWorkingDirectory: string): Promise<void>
  close(): Promise<void>
}
```

#### JSONScanner
Handles scanning and parsing JSON files from source data folders, analyzing their schema, and preparing data for database insertion.

```typescript
class JSONScanner {
  scanSourceFolders(sourceFolders: SourceFolder[]): Promise<ScanResults>
  findJsonFiles(dirPath: string): Promise<string[]>
  parseFile(filePath: string): Promise<any[]>
  parseJsonFile(filePath: string): Promise<any[]>
  parseJsonLFile(filePath: string): Promise<any[]>
  parseDynamoDBJsonFile(filePath: string): Promise<any[]>
  convertDynamoDBToStandardJson(dynamoDBItem: any): any
  flattenObject(obj: any, prefix?: string, maxDepth?: number, currentDepth?: number): any
  analyzeSchema(jsonDataArray: any[]): ScanColumn[]
  inferDataType(value: any): string
  determineSQLType(types: Set<string>): 'TEXT' | 'INTEGER' | 'REAL'
  getUniqueColumns(combinedData: any[]): string[]
  getLastScanResults(): ScanResults | null
  clearResults(): void
  getErrors(): ScanError[]
  hasErrors(): boolean
  createDataTable(databaseManager: DatabaseManager, viewId: string, columns: ScanColumn[]): Promise<void>
  populateDataTable(databaseManager: DatabaseManager, viewId: string, records: any[], options?: PopulationOptions): Promise<PopulationResults>
  scanAndPopulate(sourceFolders: SourceFolder[], databaseManager: DatabaseManager, viewId: string, options?: ScanAndPopulateOptions): Promise<ScanAndPopulateResult>
}
```

#### DatabaseManager
Handles SQLite database operations for individual project databases. Each project maintains its own SQLite database file located at {workingDirectory}/.digr/project.db.

```typescript
class DatabaseManager {
  initializeProjectDatabase(projectId: string, projectName: string, workingDirectory: string): Promise<void>
  openProjectDatabase(projectWorkingDirectory: string): Promise<void>
  closeProjectDatabase(): Promise<void>
  createProjectSchema(projectId: string, projectName: string, workingDirectory: string): Promise<void>
  migrateSchema(): Promise<void>
  getSchemaVersion(): Promise<number>
  setSchemaVersion(version: number): Promise<void>
  getDatabasePath(workingDirectory?: string): string
  ensureDigrFolder(workingDirectory: string): boolean
  executeQuery(sql: string, params?: any[]): Promise<any[]>
  executeNonQuery(sql: string, params?: any[]): Promise<DatabaseResult>
  executeTransaction(statements: TransactionStatement[]): Promise<DatabaseResult[]>
  isConnected(): boolean
  initializeSchema(): Promise<void>
  validateSchema(): Promise<boolean>
  createDataTable(viewId: string, columns: ColumnSchema[]): Promise<void>
  dropDataTable(viewId: string): Promise<void>
  getDataTableSchema(viewId: string): Promise<any[]>
  dataTableExists(viewId: string): Promise<boolean>
  executeSqlQuery(sql: string, params?: any[], page?: number, pageSize?: number): Promise<{ columns: string[], rows: any[][], totalRows: number }>
  closeDatabase(): Promise<void>
}
```

### Renderer Process Components

The renderer process is implemented using TypeScript and React, with all components defined as TypeScript React functional components.

#### App
The main React component that sets up the routing and overall application structure.

```typescript
const App: React.FC = () => {
  // Renders Header, Sidebar, content area with routes, and Footer
}
```

#### Header
Renders the application header with navigation controls.

```typescript
const Header: React.FC = () => {
  // Renders application header
}
```

#### Sidebar
Renders the application sidebar with navigation links.

```typescript
const Sidebar: React.FC = () => {
  // Renders sidebar navigation
}
```

#### Footer
Renders the application footer.

```typescript
const Footer: React.FC = () => {
  // Renders application footer
}
```

#### Dashboard
Renders the application dashboard.

```typescript
const Dashboard: React.FC = () => {
  // Renders dashboard content
}
```

#### ProjectList
Renders the list of projects and handles project creation and deletion.

```typescript
const ProjectList: React.FC = () => {
  // State management for projects, loading state, and dialogs
  // Handles project creation and deletion
  // Renders project list table
}
```

#### ProjectDetail
Renders the details of a project with a tabbed interface for details, files, and query.

```typescript
const ProjectDetail: React.FC = () => {
  // State management for project, loading state, active tab
  // Handles source folder management and scanning
  // Renders tabbed interface with details, files, and query tabs
}
```

#### Query
Renders the SQL query interface and results.

```typescript
const Query: React.FC<QueryProps> = ({ projectId }) => {
  // State management for SQL query, execution state, results
  // Handles query execution and pagination
  // Renders query interface and results table
}
```

#### Settings
Renders the application settings.

```typescript
const Settings: React.FC = () => {
  // Renders settings interface
}
```

#### CreateProjectDialog
Dialog for creating a new project.

```typescript
const CreateProjectDialog: React.FC<CreateProjectDialogProps> = ({ isOpen, onClose, onSubmit }) => {
  // State management for project name and working directory
  // Handles form submission
  // Renders dialog with form fields
}
```

#### RemoveProjectDialog
Dialog for confirming project deletion.

```typescript
const RemoveProjectDialog: React.FC<RemoveProjectDialogProps> = ({ isOpen, projectName, onClose, onConfirm }) => {
  // Renders confirmation dialog
}
```

#### AddSourceDirectoryModal
Modal for adding a source directory to a project.

```typescript
const AddSourceDirectoryModal: React.FC<AddSourceDirectoryModalProps> = ({ isOpen, onClose, onSubmit }) => {
  // State management for folder path
  // Handles form submission
  // Renders modal with form field
}
```

#### MainProcessContext
Context provider for accessing main process functionality from React components.

```typescript
const MainProcessContext = React.createContext<MainProcessAPI | null>(null);

const MainProcessProvider: React.FC<MainProcessProviderProps> = ({ children }) => {
  // Provides main process API to child components
}

const useMainProcess = () => {
  // Hook for accessing main process API
}
```

### IPC Communication Interface

#### Main → Renderer Events
- `projects-loaded` - Send project list to renderer
- `project-created` - Confirm project creation
- `project-deleted` - Confirm project deletion
- `source-folder-added` - Confirm folder addition
- `source-folder-removed` - Confirm folder removal
- `view-created` - Confirm view creation
- `view-deleted` - Confirm view deletion
- `scan-started` - Notify scan start
- `scan-progress` - Send scanning progress updates
- `scan-complete` - Send scan completion notification
- `sql-query-results` - Send SQL query results to renderer
- `error` - Send error messages to renderer

#### Renderer → Main Events
- `load-projects` - Request project list
- `create-project` - Request project creation
- `delete-project` - Request project deletion
- `get-project` - Request specific project details
- `add-source-folder` - Request folder addition
- `remove-source-folder` - Request folder removal
- `create-view` - Request view creation
- `delete-view` - Request view deletion
- `scan-source-directories` - Request JSON data scanning
- `execute-sql-query` - Request SQL query execution
- `open-folder` - Request to open folder in system explorer

## Data Models

### SQLite Database Schema

The application uses a distributed database approach where each project maintains its own SQLite database file located at `{workingDirectory}/.digr/project.db`. This provides project-level data isolation and portability.

#### Global Configuration
A lightweight JSON file stores the global project registry at the user's home directory:
```json
{
  "projects": [
    {
      "path": "/path/to/project"
    }
  ]
}
```

#### Per-Project Database Schema
Each project's `.digr/project.db` contains:

```sql
-- Project metadata table (single row per database)
CREATE TABLE project_info (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  working_directory TEXT NOT NULL,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_modified DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Source folders table
CREATE TABLE source_folders (
  id TEXT PRIMARY KEY,
  path TEXT NOT NULL,
  added_date DATETIME DEFAULT CURRENT_TIMESTAMP
);

-- Views table
CREATE TABLE views (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL,
  created_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_modified DATETIME DEFAULT CURRENT_TIMESTAMP,
  last_query TEXT -- JSON string of last applied query
);
```

#### Dynamic Data Tables
For each view, a dynamic table is created to store the scanned JSON data:
```sql
-- Dynamic table per view (table name: data_view_{viewId})
CREATE TABLE data_view_{viewId} (
  _id INTEGER PRIMARY KEY AUTOINCREMENT,
  _source_file TEXT NOT NULL,
  _scan_date DATETIME DEFAULT CURRENT_TIMESTAMP,
  -- Dynamic columns based on JSON schema analysis
  column1 TEXT,
  column2 INTEGER,
  column3 REAL,
  -- ... additional columns as discovered
);
```

#### Per-Project JSON Configuration
Each project also maintains a `project.json` file in its `.digr` folder:
```json
{
  "id": "uuid",
  "name": "Project Name",
  "sourceFolders": [
    {
      "id": "uuid",
      "path": "/path/to/source/folder",
      "addedDate": "2024-01-01T00:00:00Z"
    }
  ],
  "createdDate": "2024-01-01T00:00:00Z",
  "lastModified": "2024-01-01T00:00:00Z",
  "scanStatus": {
    "isScanning": false,
    "progress": {
      "current": 0,
      "total": 0,
      "message": ""
    },
    "lastScanResult": {
      "processedFiles": 0,
      "extractedObjects": 0,
      "completedDate": "2024-01-01T00:00:00Z"
    }
  }
}
```

### Application Data Models (TypeScript Interfaces)

```typescript
// Digr config interface for storing project paths in the user's home directory
interface DigrConfig {
  projects: {
    path: string;
  }[];
}

interface SourceFolder {
  id: string;
  path: string;
  addedDate: Date;
}

interface ScanStatus {
  isScanning: boolean;  // Whether a scan is currently in progress
  progress?: {          // Current progress of the scan (if in progress)
    current: number;
    total: number;
    message: string;
  } | undefined;
  lastScanResult?: {    // Results of the last completed scan
    processedFiles: number;
    extractedObjects: number;
    completedDate: Date;
  } | undefined;
}

interface Project {
  id: string;           // Unique identifier
  name: string;         // User-provided name
  workingDirectory: string;  // Full path to working directory
  sourceFolders: SourceFolder[];  // Array of source data folder paths
  createdDate: Date;
  lastModified: Date;
  scanStatus?: ScanStatus | undefined;  // Current scan status and progress
}

interface ColumnSchema {
  columnName: string;
  dataType: 'TEXT' | 'INTEGER' | 'REAL';
  nullable: boolean;
}

interface View {
  id: string;           // Unique identifier
  projectId: string;    // Parent project ID
  name: string;         // User-provided name
  createdDate: Date;
  lastModified: Date;
  lastQuery?: QueryModel | undefined;    // Last applied query (optional)
  tableSchema: ColumnSchema[];  // Schema of the data table
}

interface ScanError {
  file: string;
  error: string;
}

interface ScanColumn {
  name: string;
  type: 'TEXT' | 'INTEGER' | 'REAL';
  nullable: boolean;
  sampleValues: any[];  // Sample values for type inference
}

interface ScanResults {
  viewId: string;       // Target view ID
  totalFiles: number;   // Total JSON files found
  processedFiles: number; // Successfully processed files
  totalRecords: number; // Total records inserted
  columns: ScanColumn[];  // Discovered column schema
  errors: ScanError[];  // Processing errors
  scanDate: Date;
}

type QueryOperator = 'equals' | 'contains' | 'greater' | 'less' | 'like';

interface QueryFilter {
  column: string;       // Column name to filter on
  operator: QueryOperator;  // Filter operator
  value: any;          // Filter value
  dataType: 'TEXT' | 'INTEGER' | 'REAL';  // Data type for proper SQL generation
}

interface QueryModel {
  viewId: string;       // Target view ID
  filters: QueryFilter[];
  sortBy?: string;      // Column name to sort by
  sortDirection?: 'ASC' | 'DESC';  // Sort direction
  limit?: number;       // Result limit for pagination
  offset?: number;      // Result offset for pagination
}

interface QueryResult {
  data: any[];          // Query result rows
  totalCount: number;   // Total count without pagination
  columns: string[];    // Column names in result
}
```

## Error Handling

### File System Errors
- **Invalid working directory**: Display error message, prevent project creation
- **Inaccessible source folder**: Display warning, skip folder during scanning
- **JSON parsing errors**: Log error, skip invalid files, show warning to user
- **Permission errors**: Display error message with suggested solutions

### Data Validation Errors
- **Empty project name**: Show validation error, prevent submission
- **Duplicate project name**: Show warning, prevent project creation
- **Invalid characters in project name**: Show validation error, prevent submission
- **Invalid query parameters**: Show validation error, highlight problematic fields

### Database Errors
- **Database initialization failure**: Display error message, prevent operation
- **Query execution errors**: Display error message with details, maintain previous state
- **Schema validation errors**: Attempt schema migration, display error if unsuccessful

### Application State Errors
- **Project not found**: Display error message, redirect to project list
- **View not found**: Display error message, redirect to project detail
- **IPC communication failure**: Show error message, attempt to restart communication

### Error Recovery Strategies
- Graceful degradation for non-critical features
- Automatic retry for transient errors
- User-friendly error messages with actionable suggestions
- Fallback to previous working state when possible

## Testing Strategy

### Unit Testing
- **Main Process Components**: Test ProjectManager, ViewManager, JSONScanner, and DatabaseManager classes
- **Data Models**: Validate model creation, serialization, and validation
- **Query Logic**: Test SQL query execution and result handling
- **File Operations**: Mock file system operations and test error handling

### Integration Testing
- **IPC Communication**: Test message passing between main and renderer processes
- **File System Integration**: Test actual file operations with temporary directories
- **JSON Parsing**: Test with various JSON file formats and edge cases
- **Data Persistence**: Test save/load cycles with different data states

### End-to-End Testing
- **Project Lifecycle**: Create, modify, and delete projects
- **Source Folder Management**: Add and remove source folders
- **Data Scanning**: Scan JSON files and verify results
- **Query Execution**: Execute SQL queries and verify results
- **User Workflows**: Complete user journeys from project creation to data analysis

### Performance Testing
- **Large Dataset Handling**: Test with large JSON files and many records
- **Memory Usage**: Monitor memory consumption during data scanning and rendering
- **UI Responsiveness**: Ensure UI remains responsive during long operations
- **File System Performance**: Test scanning performance with many files

### Manual Testing
- **User Experience**: Validate intuitive navigation and clear error messages
- **Cross-Platform**: Test on different operating systems (macOS, Windows, Linux)
- **Accessibility**: Ensure keyboard navigation and screen reader compatibility
- **Visual Design**: Verify consistent styling and responsive layout
