# Requirements Document

## Introduction

This document outlines the requirements for a project management Electron desktop application that enables users to create and manage projects with associated working directories and source data folders. The application provides a centralized way to organize project-related information and maintain references to external data sources, making it easier for users to manage multiple projects and their associated resources.

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

1. WHEN the user selects a project and clicks "Add Source Data Folder" THEN the system SHALL display a folder selection dialog
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

**User Story:** As a user, I want to create views within my projects, so that I can analyze and query the data in my source folders.

#### Acceptance Criteria

1. WHEN the user selects a project and clicks "Create View" THEN the system SHALL display a view creation form
2. WHEN the user provides a view name THEN the system SHALL create a new view for the selected project
3. WHEN a view is created THEN the system SHALL add it to the project's views list
4. WHEN the user opens a view THEN the system SHALL display the view interface for data querying
5. IF the user provides an invalid view name (empty or duplicate) THEN the system SHALL display an error message and prevent view creation

### Requirement 8

**User Story:** As a user, I want to scan JSON files in my project's source data folders, so that I can see all available data for querying.

#### Acceptance Criteria

1. WHEN a view is opened THEN the system SHALL scan all JSON files in the project's source data folders
2. WHEN JSON files are scanned THEN the system SHALL parse each file as an array of JSON objects with flat properties
3. WHEN JSON files are parsed THEN the system SHALL combine all data into a unified dataset for the view
4. IF a JSON file contains invalid JSON THEN the system SHALL log an error and skip that file
5. IF a JSON file contains nested objects THEN the system SHALL flatten the properties or skip complex nested structures
6. WHEN scanning is complete THEN the system SHALL display the total number of records found

### Requirement 9

**User Story:** As a user, I want to view JSON data in a tabular format, so that I can easily browse and understand the data structure.

#### Acceptance Criteria

1. WHEN JSON data is loaded in a view THEN the system SHALL display the data in a table format
2. WHEN the table is displayed THEN the system SHALL show column headers for all unique properties found in the JSON objects
3. WHEN the table is displayed THEN the system SHALL show each JSON object as a row with property values in corresponding columns
4. WHEN a property is missing from a JSON object THEN the system SHALL display an empty cell for that property
5. WHEN the table contains many rows THEN the system SHALL provide pagination or scrolling to navigate through the data
6. WHEN column headers are clicked THEN the system SHALL sort the data by that column

### Requirement 10

**User Story:** As a user, I want to create queries to filter and search the JSON data, so that I can find specific information within my datasets.

#### Acceptance Criteria

1. WHEN a view is open THEN the system SHALL provide a query interface for filtering data
2. WHEN the user creates a query THEN the system SHALL allow filtering by any property found in the JSON objects
3. WHEN the user applies a query THEN the system SHALL filter the displayed table to show only matching records
4. WHEN a query is applied THEN the system SHALL update the record count to reflect filtered results
5. WHEN the user clears a query THEN the system SHALL restore the full dataset view
6. WHEN the user creates a query THEN the system SHALL support basic comparison operations (equals, contains, greater than, less than)

### Requirement 11

**User Story:** As a user, I want to manage multiple views within a project, so that I can create different perspectives on my data.

#### Acceptance Criteria

1. WHEN a project is selected THEN the system SHALL display a list of all views for that project
2. WHEN the user clicks on a view name THEN the system SHALL open that view
3. WHEN the user deletes a view THEN the system SHALL prompt for confirmation and remove the view if confirmed
4. WHEN multiple views exist THEN the system SHALL allow opening one view at a time initially
5. IF no views exist for a project THEN the system SHALL display a message prompting the user to create a view

### Requirement 12

**User Story:** As a user, I want the application to persist my projects, views, and their configurations, so that my work is saved between application sessions.

#### Acceptance Criteria

1. WHEN the application starts THEN the system SHALL load all previously created projects and their views
2. WHEN a project, view, or configuration is created, modified, or deleted THEN the system SHALL automatically save the changes
3. WHEN the application is closed and reopened THEN the system SHALL restore all projects with their working directories, source data folders, and views
4. IF the application data becomes corrupted THEN the system SHALL display an error message and attempt to recover or reset to a clean state
5. WHEN project data is saved THEN the system SHALL store it in a format that persists across application restarts