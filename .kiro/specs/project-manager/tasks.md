# Implementation Plan

- [x] 1. Set up project structure and core dependencies
  - Install SQLite3 dependency for Node.js (`npm install sqlite3`)
  - Create directory structure for main process modules (`src/main/`)
  - Create directory structure for renderer process modules (`src/renderer/`)
  - Update package.json with new entry points and build configuration
  - _Requirements: 7.1, 12.1_

- [x] 2. Implement SQLite database foundation
  - [x] 2.1 Create DatabaseManager class for per-project SQLite operations
    - Implement per-project database initialization and connection management
    - Create methods for opening, closing, and executing SQL queries on project databases
    - Add error handling for database connection issues and .digr folder creation
    - Write unit tests for database connection and basic operations
    - _Requirements: 12.1, 12.4_

  - [x] 2.2 Implement per-project database schema creation
    - Create SQL scripts for project_info, source_folders, and views tables in each project's database
    - Implement schema migration and initialization in DatabaseManager for project databases
    - Add methods for creating and validating per-project database schema
    - Write unit tests for schema creation and validation in .digr folders
    - _Requirements: 1.2, 4.2, 7.2, 12.1_

- [x] 3. Implement core data persistence layer
  - [x] 3.1 Create DataPersistence class for global project registry management
    - Implement methods to save/load global project registry using JSON file
    - Create application data directory management using userData folder
    - Add data validation and error handling for registry operations
    - Write unit tests for global registry persistence operations
    - _Requirements: 12.2, 12.3, 12.5_

  - [x] 3.2 Implement ProjectManager class with distributed database integration
    - Create project CRUD operations using per-project .digr databases
    - Implement source folder management within individual project databases
    - Add project validation, duplicate name handling, and .digr folder creation
    - Write unit tests for distributed project management operations
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 3.1, 3.2, 4.1, 4.4, 5.1_

- [ ] 4. Implement view management system
  - [x] 4.1 Enhance DatabaseManager for dynamic table operations
    - Extend existing dynamic table creation methods for view data
    - Add data insertion methods for populating view tables with JSON data
    - Implement query execution methods for view data tables
    - Write unit tests for enhanced dynamic table operations
    - _Requirements: 8.2, 8.3, 9.1, 9.2_

  - [ ] 4.2 Create ViewManager class with per-project database integration
    - Create ViewManager class that uses per-project DatabaseManager for view CRUD operations
    - Add view name validation and duplicate checking within individual project databases
    - Implement view deletion with associated data table cleanup in project's .digr database
    - Write unit tests for ViewManager operations with distributed databases
    - _Requirements: 7.1, 7.2, 11.1, 11.3, 11.4_

- [ ] 5. Implement JSON scanning and schema analysis
  - [ ] 5.1 Create JSONScanner class for file processing
    - Implement recursive file scanning in source data folders
    - Add JSON file parsing with error handling for invalid files
    - Create schema analysis to determine column types and structure
    - Write unit tests for JSON scanning and parsing
    - _Requirements: 8.1, 8.2, 8.4, 8.5_

  - [ ] 5.2 Implement data population and batch insertion
    - Create methods to populate dynamic tables with JSON data in project's .digr database
    - Implement batch insertion for performance with large datasets in per-project databases
    - Add progress tracking and error reporting for scan operations
    - Write unit tests for data population and error handling with distributed databases
    - _Requirements: 8.2, 8.3, 8.6, 9.3_

- [ ] 6. Implement query system and SQL generation
  - [ ] 6.1 Create QueryBuilder class for SQL generation
    - Implement filter-to-SQL conversion for different operators
    - Add support for sorting, pagination, and complex WHERE clauses
    - Create query validation and SQL injection prevention
    - Write unit tests for SQL query generation and validation
    - _Requirements: 10.1, 10.2, 10.3, 10.6_

  - [ ] 6.2 Integrate query execution with DatabaseManager
    - Add methods to execute generated SQL queries safely
    - Implement result formatting and pagination support
    - Create query result caching for performance optimization
    - Write unit tests for query execution and result handling
    - _Requirements: 10.3, 10.4, 10.5_

- [ ] 7. Implement main process integration and IPC setup
  - [ ] 7.1 Update main.js with application managers and IPC handlers
    - Initialize ProjectManager, ViewManager, and other core services in main process
    - Implement IPC event handlers for project CRUD operations
    - Add source folder management IPC handlers
    - Create error handling and response formatting for IPC
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 3.1, 3.2, 4.1, 4.4, 5.1_

  - [ ] 7.2 Create IPC event handlers for view and data operations
    - Implement handlers for view management operations
    - Add data scanning and query execution IPC handlers
    - Create progress reporting for long-running operations
    - Write integration tests for view and data IPC communication
    - _Requirements: 7.1, 7.2, 8.1, 8.6, 10.1, 10.3, 11.1, 11.3_

- [ ] 8. Implement basic renderer process UI framework
  - [ ] 8.1 Create UIManager class for screen navigation
    - Implement screen state management and navigation
    - Create breadcrumb navigation and back button functionality
    - Add loading states and error message display
    - Write unit tests for UI state management
    - _Requirements: 2.1, 2.2, 6.1, 6.2, 11.1_

  - [ ] 8.2 Create IPC communication layer for renderer
    - Implement IPC event sending and response handling
    - Add promise-based wrappers for async IPC operations
    - Create error handling and timeout management for IPC calls
    - Write unit tests for renderer IPC communication
    - _Requirements: 12.1, 12.2, 12.3_

- [ ] 9. Implement project management UI screens
  - [ ] 9.1 Create project list screen with CRUD operations
    - Build HTML structure and CSS styling for project list
    - Implement project creation form with validation
    - Add project deletion with confirmation dialog
    - Create project selection and navigation to detail screen
    - _Requirements: 1.1, 1.2, 1.4, 1.5, 1.6, 2.1, 2.2, 2.4, 3.1, 3.3_

  - [ ] 9.2 Create project detail screen with source folder management
    - Build HTML structure for project details and source folder list
    - Implement source folder addition with folder picker dialog
    - Add source folder removal with confirmation
    - Create navigation to working directory and source folders
    - _Requirements: 4.1, 4.2, 4.4, 4.5, 5.1, 5.4, 6.1, 6.3, 6.4, 6.5_

- [ ] 10. Implement view management UI screens
  - [ ] 10.1 Create view list screen for project views
    - Build HTML structure and styling for view list
    - Implement view creation form with validation
    - Add view deletion with confirmation dialog
    - Create view selection and navigation to data view screen
    - _Requirements: 7.1, 7.2, 11.1, 11.2, 11.3, 11.5_

  - [ ] 10.2 Create data scanning progress interface
    - Build progress indicator UI for JSON file scanning
    - Implement real-time progress updates via IPC
    - Add scan results summary and error reporting
    - Create cancel functionality for long-running scans
    - _Requirements: 8.1, 8.6_

- [ ] 11. Implement data view and query interface
  - [ ] 11.1 Create TableRenderer class for data display
    - Build dynamic HTML table generation from query results
    - Implement column sorting with visual indicators
    - Add pagination controls and navigation
    - Create responsive table design with horizontal scrolling
    - _Requirements: 9.1, 9.2, 9.3, 9.6_

  - [ ] 11.2 Create QueryBuilder UI for filtering data
    - Build filter interface with dynamic column selection
    - Implement operator selection (equals, contains, greater, less)
    - Add filter value input with data type validation
    - Create query preview and validation feedback
    - _Requirements: 10.1, 10.2, 10.6_

- [ ] 12. Implement advanced query features and optimization
  - [ ] 12.1 Add query execution and result display
    - Integrate QueryBuilder with TableRenderer for filtered results
    - Implement query result caching and performance optimization
    - Add query history and saved query functionality
    - Create export functionality for query results
    - _Requirements: 10.3, 10.4, 10.5_

  - [ ] 12.2 Add data type inference and column management
    - Implement automatic data type detection during scanning
    - Add column type display and manual type override options
    - Create column visibility controls and custom column ordering
    - Add search functionality within table data
    - _Requirements: 8.2, 8.5, 9.2, 9.4_

- [ ] 13. Implement error handling and user feedback
  - [ ] 13.1 Create comprehensive error handling system
    - Implement user-friendly error messages for all operations
    - Add error recovery mechanisms and retry functionality
    - Create error logging and debugging information display
    - Add validation feedback for all user inputs
    - _Requirements: 1.5, 1.6, 4.4, 8.4, 12.4_

  - [ ] 13.2 Add application state persistence and recovery
    - Implement automatic saving of application state
    - Add recovery mechanisms for corrupted data
    - Create backup and restore functionality for project data
    - Add application settings and preferences management
    - _Requirements: 12.1, 12.2, 12.3, 12.4, 12.5_

- [ ] 14. Final integration and testing
  - [ ] 14.1 Integrate all components and test complete workflows
    - Test complete user workflows from project creation to data querying
    - Verify all IPC communication and error handling
    - Test with various JSON file formats and edge cases
    - Perform performance testing with large datasets
    - _Requirements: All requirements_

  - [ ] 14.2 Polish UI/UX and add final features
    - Implement consistent styling and responsive design
    - Add keyboard shortcuts and accessibility features
    - Create application help documentation and tooltips
    - Add final performance optimizations and code cleanup
    - _Requirements: 2.5, 6.4, 6.5, 9.5_