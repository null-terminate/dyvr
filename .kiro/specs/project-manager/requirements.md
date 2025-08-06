# Requirements Document

## Introduction

This document outlines the requirements for DYVR, an Electron desktop application that enables users to create and manage projects with associated working directories and source data folders. The application provides a centralized way to organize project-related information, scan JSON data from external sources, and query that data, making it easier for users to manage multiple projects and their associated resources.

## Requirements

### Requirement 1

**User Story:** As a user, I want to create new projects, so that I can organize my work into distinct, manageable units.

#### Acceptance Criteria

1. WHEN the user clicks a "Create Project" button THEN the system SHALL display a project creation form
2. WHEN the user provides a project name and selects a working directory THEN the system SHALL create a new project with the specified details
3. WHEN a project is created THEN the system SHALL create the working directory if it doesn't exist
4. WHEN a project is created THEN the system SHALL add the project to the project list
5. IF the user provides an invalid project name (empty or contains invalid characters) THEN the system SHALL display an error message and prevent project creation
6. IF the selected working directory is not accessible THEN the system SHALL display an error message and prevent project creation

### Requirement 2

**User Story:** As a user, I want to view all my projects in a list, so that I can easily access and manage them.

#### Acceptance Criteria

1. WHEN the application starts THEN the system SHALL display a list of all existing projects
2. WHEN a project is created THEN the system SHALL immediately add it to the visible project list
3. WHEN a project is deleted THEN the system SHALL immediately remove it from the visible project list
4. WHEN the user clicks on a project in the list THEN the system SHALL display the project details
5. IF no projects exist THEN the system SHALL display a message indicating no projects are available

### Requirement 3

**User Story:** As a user, I want to delete projects I no longer need, so that I can keep my workspace organized.

#### Acceptance Criteria

1. WHEN the user selects a project and clicks a "Delete Project" button THEN the system SHALL prompt for confirmation
2. WHEN the user confirms project deletion THEN the system SHALL remove the project from the system
3. WHEN a project is deleted THEN the system SHALL remove it from the project list
4. IF the user cancels the deletion confirmation THEN the system SHALL not delete the project
5. WHEN a project is deleted THEN the system SHALL preserve the working directory and its contents

### Requirement 4

**User Story:** As a user, I want to add source data folders to my projects, so that I can reference external data sources relevant to each project.

#### Acceptance Criteria

1. WHEN the user selects a project and clicks "Add Source Directory" THEN the system SHALL display a folder selection dialog
2. WHEN the user selects a valid folder THEN the system SHALL add the folder path to the project's source data folders list
3. WHEN a source data folder is added THEN the system SHALL display it in the project's source data folders list
4. IF the user selects an invalid or inaccessible folder THEN the system SHALL display an error message and not add the folder
5. IF the user selects a folder that is already added to the project THEN the system SHALL display a warning and not add the duplicate

### Requirement 5

**User Story:** As a user, I want to remove source data folders from my projects, so that I can maintain only relevant data references.

#### Acceptance Criteria

1. WHEN the user selects a source data folder and clicks "Remove" THEN the system SHALL prompt for confirmation
2. WHEN the user confirms removal THEN the system SHALL remove the folder reference from the project
3. WHEN a source data folder is removed THEN the system SHALL update the displayed list immediately
4. IF the user cancels the removal confirmation THEN the system SHALL not remove the folder reference
5. WHEN a source data folder is removed THEN the system SHALL only remove the reference, not delete the actual folder

### Requirement 6

**User Story:** As a user, I want to view the details of each project including its working directory and source data folders, so that I can understand the project's configuration.

#### Acceptance Criteria

1. WHEN the user selects a project THEN the system SHALL display the project name, working directory path, and list of source data folders
2. WHEN the project details are displayed THEN the system SHALL show the full path for the working directory
3. WHEN the project details are displayed THEN the system SHALL show the full paths for all source data folders
4. WHEN the user clicks on a working directory path THEN the system SHALL open the directory in the system file explorer
5. WHEN the user clicks on a source data folder path THEN the system SHALL open the folder in the system file explorer

### Requirement 7

**User Story:** As a user, I want to scan JSON files in my project's source data folders, so that I can see all available data for querying.

#### Acceptance Criteria

1. WHEN the user clicks "Scan" on a project with source data folders THEN the system SHALL scan all JSON files in the project's source data folders
2. WHEN JSON files are scanned THEN the system SHALL parse each file as an array of JSON objects with flat properties
3. WHEN JSON files are parsed THEN the system SHALL combine all data into a unified dataset for the project
4. IF a JSON file contains invalid JSON THEN the system SHALL log an error and skip that file
5. IF a JSON file contains nested objects THEN the system SHALL flatten the properties or skip complex nested structures
6. WHEN scanning is in progress THEN the system SHALL display a progress bar showing the current status
7. WHEN scanning is complete THEN the system SHALL display the total number of files processed and records found

### Requirement 8

**User Story:** As a user, I want to execute SQL queries against the scanned JSON data in a dedicated Query tab, so that I can analyze and extract specific information while maintaining context of the current project.

#### Acceptance Criteria

1. WHEN the user selects a project and clicks on the Query tab THEN the system SHALL display a SQL query interface
2. WHEN the user enters a SQL query and clicks "Execute" THEN the system SHALL execute the query against the scanned data
3. WHEN a query is executed THEN the system SHALL display the results in a tabular format
4. WHEN query results are displayed THEN the system SHALL show column headers and data rows
5. WHEN query results contain many rows THEN the system SHALL provide pagination controls
6. IF a query contains syntax errors THEN the system SHALL display an error message with details
7. WHEN the user presses Ctrl+Enter or Cmd+Enter THEN the system SHALL execute the current query
8. WHEN the user switches between tabs in the project detail view THEN the system SHALL preserve the query and results in the Query tab

### Requirement 9

**User Story:** As a user, I want to navigate through large query result sets, so that I can effectively analyze large amounts of data.

#### Acceptance Criteria

1. WHEN query results are displayed THEN the system SHALL show the total number of records found
2. WHEN query results exceed the page size THEN the system SHALL display pagination controls
3. WHEN the user changes the page THEN the system SHALL update the display to show the selected page of results
4. WHEN the user changes the rows per page setting THEN the system SHALL adjust the pagination accordingly
5. WHEN navigating between pages THEN the system SHALL maintain the current query and other display settings

### Requirement 10

**User Story:** As a user, I want the application to persist my projects and their configurations, so that my work is saved between application sessions.

#### Acceptance Criteria

1. WHEN the application starts THEN the system SHALL load all previously created projects
2. WHEN a project, or its configuration is created, modified, or deleted THEN the system SHALL automatically save the changes
3. WHEN the application is closed and reopened THEN the system SHALL restore all projects with their working directories and source data folders
4. IF the application data becomes corrupted THEN the system SHALL display an error message and attempt to recover
5. WHEN project data is saved THEN the system SHALL store it in a format that persists across application restarts

### Requirement 11

**User Story:** As a user, I want to see the progress of long-running operations like scanning, so that I know the system is working and how much longer to wait.

#### Acceptance Criteria

1. WHEN a scan operation is initiated THEN the system SHALL display a progress indicator
2. WHEN a scan is in progress THEN the system SHALL update the progress indicator to show the current status
3. WHEN a scan is in progress THEN the system SHALL display a message indicating what is currently being processed
4. WHEN a scan completes THEN the system SHALL display a success message with summary information
5. IF a scan encounters errors THEN the system SHALL display error information while continuing with the rest of the scan

### Requirement 12

**User Story:** As a user, I want to work with different types of JSON file formats, so that I can analyze data from various sources.

#### Acceptance Criteria

1. WHEN scanning source folders THEN the system SHALL support standard JSON files (.json extension)
2. WHEN scanning source folders THEN the system SHALL support JSON Lines files (.jsonl extension)
3. WHEN scanning source folders THEN the system SHALL support DynamoDB JSON export files (.jsonddb extension)
4. WHEN parsing JSON files THEN the system SHALL handle both single objects and arrays of objects
5. WHEN parsing JSON Lines files THEN the system SHALL treat each line as a separate JSON object
6. WHEN parsing DynamoDB JSON files THEN the system SHALL convert DynamoDB-specific type annotations to standard JSON

### Requirement 13

**User Story:** As a user, I want to navigate between different aspects of my project through a tabbed interface, so that I can efficiently manage project details, source files, and data queries.

#### Acceptance Criteria

1. WHEN the user opens a project THEN the system SHALL display a tabbed interface with at least "Details", "Files", and "Query" tabs
2. WHEN the user clicks on the "Details" tab THEN the system SHALL display the project's basic information and configuration
3. WHEN the user clicks on the "Files" tab THEN the system SHALL display the project's source data folders and scanning options
4. WHEN the user clicks on the "Query" tab THEN the system SHALL display the SQL query interface for the project
5. WHEN the user switches between tabs THEN the system SHALL preserve the state and content of each tab
6. WHEN the user performs actions in one tab THEN the system SHALL update relevant information in other tabs as needed
