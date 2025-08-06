# Product Overview

DYVR (pronounced 'diver') is a JSON data exploration and analysis desktop application built with Electron. It allows users to organize projects, scan JSON data sources, and query the data using SQL. Each project maintains its own SQLite database with imported data, enabling powerful data analysis capabilities.

## Key Features
- Cross-platform desktop application (macOS, Windows, Linux)
- Project creation and management with dedicated working directories
- Source data folder management (add/remove folders per project)
- JSON, JSONL, and DynamoDB JSON file scanning and schema analysis
- Automatic SQLite database creation with optimized schema
- SQL query interface with pagination and result visualization
- Native window management via Electron
- Distributable as standalone desktop app

## Core Functionality
- **Projects**: Create, manage, and organize multiple data exploration projects
- **Working Directories**: Each project has a dedicated working directory containing a SQLite database and project configuration
- **Source Data Management**: Add and remove source data folders containing JSON files for scanning and analysis
- **Data Scanning**: Automatically scan and analyze JSON data files to extract schema information
- **Schema Analysis**: Intelligently determine data types and structure from JSON files
- **Data Import**: Import JSON data into SQLite tables with appropriate column types
- **SQL Querying**: Run SQL queries against imported data with a user-friendly interface
- **Results Visualization**: View query results in a paginated table format

## Technical Features
- **JSON Processing**: Support for standard JSON, JSONL (line-delimited), and DynamoDB JSON formats
- **Schema Detection**: Automatic detection of data types and structures from JSON files
- **Database Management**: Per-project SQLite databases for data isolation and portability
- **Query Execution**: SQL query execution with pagination and error handling
- **Data Flattening**: Intelligent flattening of nested JSON structures for relational storage
- **Batch Processing**: Efficient batch processing of large datasets with progress reporting

## Target Platforms
- Primary: macOS (with both Intel x64 and Apple Silicon arm64 support)
- Secondary: Windows and Linux (via Electron's cross-platform capabilities)
