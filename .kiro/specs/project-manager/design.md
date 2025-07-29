# Design Document

## Overview

This design document outlines the architecture for a project management Electron desktop application that enables users to create and manage projects with associated working directories, source data folders, and data views. The application follows Electron's main/renderer process architecture and provides a tabular interface for querying JSON data files.

The application is designed as a single-window desktop application with multiple screens for project management, view creation, and data analysis. Each project maintains its own local SQLite database within a `.digr` folder in the project's working directory, providing project-level data isolation and portability.

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

```javascript
class ProjectManager {
  createProject(name, workingDirectory)
  deleteProject(projectId)
  getProjects()
  getProject(projectId)
  addSourceFolder(projectId, folderPath)
  removeSourceFolder(projectId, folderPath)
  getSourceFolders(projectId)
  loadProjects()
  openProjectDatabase(projectId)
  closeProjectDatabase(projectId)
  ensureProjectDigrFolder(workingDirectory)
}
```

#### ViewManager
Manages views within projects.

```javascript
class ViewManager {
  createView(projectId, viewName)
  deleteView(projectId, viewId)
  getViews(projectId)
  saveViews()
  loadViews()
}
```

#### JSONScanner
Scans and parses JSON files from source data folders, analyzes schema, and populates SQLite database.

```javascript
class JSONScanner {
  scanSourceFolders(sourceFolders)
  parseJSONFile(filePath)
  analyzeSchema(jsonDataArrays)
  createDataTable(viewId, columns)
  populateDataTable(viewId, records)
  getUniqueColumns(combinedData)
}
```

#### DatabaseManager
Manages SQLite database operations for individual project databases.

```javascript
class DatabaseManager {
  constructor(projectWorkingDirectory)
  initializeProjectDatabase(projectId, projectName, workingDirectory)
  openProjectDatabase(projectWorkingDirectory)
  closeProjectDatabase()
  createDataTable(viewId, columns)
  insertRecords(viewId, records)
  executeQuery(viewId, sqlQuery)
  dropDataTable(viewId)
  getTableSchema(viewId)
  ensureDigrFolder(workingDirectory)
  getDatabasePath(workingDirectory)
}
```

#### DataPersistence
Handles saving/loading global application metadata and manages project registry.

```javascript
class DataPersistence {
  saveProjectRegistry(projects)
  loadProjectRegistry()
  getProjectRegistryPath()
  ensureApplicationDataDirectory()
  addProjectToRegistry(project)
  removeProjectFromRegistry(projectId)
  updateProjectInRegistry(projectId, updates)
}
```

### Renderer Process Components

#### UIManager
Manages screen transitions and UI state.

```javascript
class UIManager {
  showProjectList()
  showProjectDetail(projectId)
  showViewList(projectId)
  showDataView(projectId, viewId)
  updateBreadcrumb(path)
}
```

#### TableRenderer
Renders JSON data in tabular format with sorting.

```javascript
class TableRenderer {
  renderTable(data, properties)
  sortByColumn(columnName, direction)
  updatePagination(currentPage, totalPages)
  handleCellClick(row, column)
}
```

#### QueryBuilder
Provides interface for building SQL queries from user input.

```javascript
class QueryBuilder {
  buildSQLQuery(filters, sortBy, sortDirection)
  generateWhereClause(filters)
  generateOrderByClause(sortBy, sortDirection)
  validateQuery(query)
  getSupportedOperators()
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

### Application Data Models (In-Memory)

### Project Model
```javascript
{
  id: string,           // Unique identifier
  name: string,         // User-provided name
  workingDirectory: string,  // Full path to working directory
  sourceFolders: [      // Array of source data folder paths
    {
      id: string,
      path: string,
      addedDate: Date
    }
  ],
  createdDate: Date,
  lastModified: Date
}
```

### View Model
```javascript
{
  id: string,           // Unique identifier
  projectId: string,    // Parent project ID
  name: string,         // User-provided name
  createdDate: Date,
  lastModified: Date,
  lastQuery: object,    // Last applied query (optional)
  tableSchema: [        // Schema of the data table
    {
      columnName: string,
      dataType: string,   // 'TEXT', 'INTEGER', 'REAL'
      nullable: boolean
    }
  ]
}
```

### Scan Results Model
```javascript
{
  viewId: string,       // Target view ID
  totalFiles: number,   // Total JSON files found
  processedFiles: number, // Successfully processed files
  totalRecords: number, // Total records inserted
  columns: [            // Discovered column schema
    {
      name: string,
      type: string,     // 'TEXT', 'INTEGER', 'REAL'
      nullable: boolean,
      sampleValues: [any] // Sample values for type inference
    }
  ],
  errors: [             // Processing errors
    {
      file: string,
      error: string
    }
  ],
  scanDate: Date
}
```

### Query Model
```javascript
{
  viewId: string,       // Target view ID
  filters: [
    {
      column: string,       // Column name to filter on
      operator: string,     // 'equals', 'contains', 'greater', 'less', 'like'
      value: any,          // Filter value
      dataType: string     // 'TEXT', 'INTEGER', 'REAL'
    }
  ],
  sortBy: string,         // Column name to sort by
  sortDirection: string,  // 'ASC' or 'DESC'
  limit: number,          // Result limit for pagination
  offset: number          // Result offset for pagination
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