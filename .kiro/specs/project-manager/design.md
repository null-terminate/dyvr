# Design Document

## Overview

This design document outlines the architecture for a project management Electron desktop application that enables users to create and manage projects with associated working directories, source data folders, and data views. The application follows Electron's main/renderer process architecture and provides a tabular interface for querying JSON data files.

The application is designed as a single-window desktop application with multiple screens for project management, view creation, and data analysis. Each project maintains its own local SQLite database within a `.digr` folder in the project's working directory, providing project-level data isolation and portability.

**Technology Stack**: The application is built using TypeScript for enhanced type safety, better IDE support, and improved maintainability. All main process and renderer process code uses TypeScript with strict type checking enabled.

## Architecture

### Process Architecture

The application follows Electron's standard two-process architecture:

**Main Process (`main.js`)**
- Application lifecycle management
- Window creation and management
- File system operations (project creation, JSON scanning, .digr folder management)
- SQLite database management and operations (per-project databases)
- Application metadata persistence to project-local .digr folders
- IPC communication with renderer process

**Renderer Process (`index.html` + associated scripts)**
- User interface rendering
- User interaction handling
- Data visualization (tables, forms)
- Query interface for data filtering
- Communication with main process via IPC

### Application States

The application has four primary states/screens:

1. **Project List Screen** - Shows all projects, allows creation/deletion
2. **Project Detail Screen** - Shows project info, source folders, and views
3. **View List Screen** - Shows views for a project, allows view management
4. **Data View Screen** - Shows tabular data with query interface

### Data Flow

```
User Action → Renderer Process → IPC → Main Process → SQLite Database
                     ↓
SQLite Database → Main Process → IPC → Renderer Process → UI Update
```

**Data Scanning Flow:**
```
JSON Files → JSONScanner → Schema Analysis → DatabaseManager → SQLite Table Creation → Data Population
```

**Query Flow:**
```
User Query → QueryBuilder → SQL Generation → DatabaseManager → SQLite Execution → Results → TableRenderer
```

## Components and Interfaces

### Main Process Components

#### ProjectManager
Handles project CRUD operations and persistence across global registry and per-project databases.

```typescript
class ProjectManager {
  createProject(name: string, workingDirectory: string): Promise<Project>
  deleteProject(projectId: string): Promise<void>
  getProjects(): Promise<Project[]>
  getProject(projectId: string): Promise<Project | null>
  addSourceFolder(projectId: string, folderPath: string): Promise<void>
  removeSourceFolder(projectId: string, folderPath: string): Promise<void>
  getSourceFolders(projectId: string): Promise<SourceFolder[]>
  loadProjects(): Promise<void>
  openProjectDatabase(projectId: string): Promise<DatabaseManager>
  closeProjectDatabase(projectId: string): Promise<void>
  ensureProjectDigrFolder(workingDirectory: string): Promise<void>
}
```

#### ViewManager
Manages views within projects.

```typescript
class ViewManager {
  createView(projectId: string, viewName: string): Promise<View>
  deleteView(projectId: string, viewId: string): Promise<void>
  getViews(projectId: string): Promise<View[]>
  saveViews(): Promise<void>
  loadViews(): Promise<void>
}
```

#### JSONScanner
Scans and parses JSON files from source data folders, analyzes schema, and populates SQLite database.

```typescript
class JSONScanner {
  scanSourceFolders(sourceFolders: SourceFolder[]): Promise<ScanResults>
  parseJSONFile(filePath: string): Promise<any[]>
  analyzeSchema(jsonDataArrays: any[][]): ColumnSchema[]
  createDataTable(viewId: string, columns: ColumnSchema[]): Promise<void>
  populateDataTable(viewId: string, records: any[]): Promise<void>
  getUniqueColumns(combinedData: any[]): string[]
}
```

#### DatabaseManager
Manages SQLite database operations for individual project databases.

```typescript
class DatabaseManager {
  constructor(projectWorkingDirectory: string)
  initializeProjectDatabase(projectId: string, projectName: string, workingDirectory: string): Promise<void>
  openProjectDatabase(projectWorkingDirectory: string): Promise<void>
  closeProjectDatabase(): Promise<void>
  createDataTable(viewId: string, columns: ColumnSchema[]): Promise<void>
  insertRecords(viewId: string, records: any[]): Promise<void>
  executeQuery(viewId: string, sqlQuery: string): Promise<QueryResult>
  dropDataTable(viewId: string): Promise<void>
  getTableSchema(viewId: string): Promise<ColumnSchema[]>
  ensureDigrFolder(workingDirectory: string): Promise<void>
  getDatabasePath(workingDirectory: string): string
}
```

#### DataPersistence
Handles saving/loading global application metadata and manages project registry.

```typescript
class DataPersistence {
  saveProjectRegistry(projects: Project[]): Promise<void>
  loadProjectRegistry(): Promise<Project[]>
  getProjectRegistryPath(): string
  ensureApplicationDataDirectory(): Promise<void>
  addProjectToRegistry(project: Project): Promise<void>
  removeProjectFromRegistry(projectId: string): Promise<void>
  updateProjectInRegistry(projectId: string, updates: Partial<Project>): Promise<void>
}
```

### Renderer Process Components

#### UIManager
Manages screen transitions and UI state.

```typescript
class UIManager {
  showProjectList(): void
  showProjectDetail(projectId: string): void
  showViewList(projectId: string): void
  showDataView(projectId: string, viewId: string): void
  updateBreadcrumb(path: string[]): void
}
```

#### TableRenderer
Renders JSON data in tabular format with sorting.

```typescript
class TableRenderer {
  renderTable(data: any[], properties: string[]): void
  sortByColumn(columnName: string, direction: 'ASC' | 'DESC'): void
  updatePagination(currentPage: number, totalPages: number): void
  handleCellClick(row: number, column: string): void
}
```

#### QueryBuilder
Provides interface for building SQL queries from user input.

```typescript
class QueryBuilder {
  buildSQLQuery(filters: QueryFilter[], sortBy?: string, sortDirection?: 'ASC' | 'DESC'): string
  generateWhereClause(filters: QueryFilter[]): string
  generateOrderByClause(sortBy: string, sortDirection: 'ASC' | 'DESC'): string
  validateQuery(query: QueryModel): boolean
  getSupportedOperators(): QueryOperator[]
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
- `data-scanned` - Send scan results and table schema to renderer
- `query-results` - Send SQL query results to renderer
- `scan-progress` - Send scanning progress updates
- `error` - Send error messages to renderer

#### Renderer → Main Events
- `load-projects` - Request project list
- `create-project` - Request project creation
- `delete-project` - Request project deletion
- `add-source-folder` - Request folder addition
- `remove-source-folder` - Request folder removal
- `create-view` - Request view creation
- `delete-view` - Request view deletion
- `scan-data` - Request JSON data scanning for a view
- `execute-query` - Request SQL query execution
- `open-folder` - Request to open folder in system explorer

## Data Models

### SQLite Database Schema

The application uses a distributed database approach where each project maintains its own SQLite database file located at `{workingDirectory}/.digr/project.db`. This provides project-level data isolation and portability.

#### Global Application Data
A lightweight JSON file stores the global project registry at the application level:
```json
{
  "projects": [
    {
      "id": "uuid",
      "name": "Project Name",
      "workingDirectory": "/path/to/project",
      "createdDate": "2024-01-01T00:00:00Z",
      "lastModified": "2024-01-01T00:00:00Z"
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

### Application Data Models (TypeScript Interfaces)

```typescript
interface SourceFolder {
  id: string;
  path: string;
  addedDate: Date;
}

interface Project {
  id: string;           // Unique identifier
  name: string;         // User-provided name
  workingDirectory: string;  // Full path to working directory
  sourceFolders: SourceFolder[];  // Array of source data folder paths
  createdDate: Date;
  lastModified: Date;
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
  lastQuery?: QueryModel;    // Last applied query (optional)
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
- **Duplicate project name**: Show warning, allow with confirmation
- **Invalid query parameters**: Show validation error, highlight problematic fields
- **Missing required data**: Show informative error messages

### Application State Errors
- **Corrupted data file**: Attempt recovery, fallback to empty state with user notification
- **IPC communication failure**: Show error message, attempt to restart communication
- **Memory limitations**: Implement pagination, show warning for large datasets

### Error Recovery Strategies
- Graceful degradation for non-critical features
- Automatic retry for transient errors
- User-friendly error messages with actionable suggestions
- Fallback to previous working state when possible

## Testing Strategy

### Unit Testing
- **Main Process Components**: Test ProjectManager, ViewManager, JSONScanner, and DataPersistence classes
- **Data Models**: Validate model creation, serialization, and validation
- **Query Logic**: Test query building and filtering functionality
- **File Operations**: Mock file system operations and test error handling

### Integration Testing
- **IPC Communication**: Test message passing between main and renderer processes
- **File System Integration**: Test actual file operations with temporary directories
- **JSON Parsing**: Test with various JSON file formats and edge cases
- **Data Persistence**: Test save/load cycles with different data states

### End-to-End Testing
- **Project Lifecycle**: Create, modify, and delete projects
- **View Management**: Create views, scan data, apply queries
- **User Workflows**: Complete user journeys from project creation to data analysis
- **Error Scenarios**: Test application behavior under various error conditions

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