const fs = require('fs');
const path = require('path');

/**
 * JSONScanner handles scanning and parsing JSON files from source data folders,
 * analyzing their schema, and preparing data for database insertion.
 */
class JSONScanner {
  constructor() {
    this.scanResults = null;
    this.errors = [];
  }

  /**
   * Scan all JSON files in the provided source data folders
   * @param {Array<string>} sourceFolders - Array of folder paths to scan
   * @returns {Promise<Object>} Scan results with files, records, and schema information
   */
  async scanSourceFolders(sourceFolders) {
    if (!sourceFolders || !Array.isArray(sourceFolders) || sourceFolders.length === 0) {
      throw new Error('Source folders array is required and must not be empty');
    }

    this.errors = [];
    const allJsonFiles = [];
    const allJsonData = [];

    // Recursively find all JSON files in source folders
    for (const folderPath of sourceFolders) {
      try {
        if (!fs.existsSync(folderPath)) {
          this.errors.push({
            file: folderPath,
            error: 'Source folder does not exist'
          });
          continue;
        }

        const jsonFiles = await this.findJsonFiles(folderPath);
        allJsonFiles.push(...jsonFiles);
      } catch (error) {
        this.errors.push({
          file: folderPath,
          error: `Failed to scan folder: ${error.message}`
        });
      }
    }

    // Parse all found JSON files
    for (const filePath of allJsonFiles) {
      try {
        const jsonData = await this.parseJSONFile(filePath);
        if (jsonData && Array.isArray(jsonData) && jsonData.length > 0) {
          // Add source file information to each record
          const dataWithSource = jsonData.map(record => ({
            ...record,
            _source_file: filePath
          }));
          allJsonData.push(...dataWithSource);
        }
      } catch (error) {
        this.errors.push({
          file: filePath,
          error: error.message
        });
      }
    }

    // Analyze schema from all collected data
    const schema = this.analyzeSchema(allJsonData);

    // Calculate processed files correctly - count files that were successfully parsed
    const fileErrors = this.errors.filter(error => !error.file.endsWith('/') && !error.error.includes('Source folder'));
    const processedFiles = Math.max(0, allJsonFiles.length - fileErrors.length);

    this.scanResults = {
      totalFiles: allJsonFiles.length,
      processedFiles: processedFiles,
      totalRecords: allJsonData.length,
      columns: schema,
      data: allJsonData,
      errors: [...this.errors],
      scanDate: new Date()
    };

    return this.scanResults;
  }

  /**
   * Recursively find all JSON files in a directory
   * @param {string} dirPath - Directory path to search
   * @returns {Promise<Array<string>>} Array of JSON file paths
   */
  async findJsonFiles(dirPath) {
    const jsonFiles = [];

    const scanDirectory = async (currentPath) => {
      try {
        const items = fs.readdirSync(currentPath);

        for (const item of items) {
          const itemPath = path.join(currentPath, item);
          const stats = fs.statSync(itemPath);

          if (stats.isDirectory()) {
            // Skip hidden directories and common non-data directories
            if (!item.startsWith('.') &&
              !['node_modules', 'dist', 'build', 'target'].includes(item.toLowerCase())) {
              await scanDirectory(itemPath);
            }
          } else if (stats.isFile() && path.extname(item).toLowerCase() === '.json') {
            jsonFiles.push(itemPath);
          }
        }
      } catch (error) {
        this.errors.push({
          file: currentPath,
          error: `Failed to read directory: ${error.message}`
        });
      }
    };

    await scanDirectory(dirPath);
    return jsonFiles;
  }

  /**
   * Parse a JSON file and return its contents as an array
   * @param {string} filePath - Path to the JSON file
   * @returns {Promise<Array>} Array of JSON objects
   */
  async parseJSONFile(filePath) {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File does not exist');
      }

      const fileContent = fs.readFileSync(filePath, 'utf8');

      if (!fileContent.trim()) {
        throw new Error('File is empty');
      }

      let parsedData;
      try {
        parsedData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error(`Invalid JSON format: ${parseError.message}`);
      }

      // Ensure data is in array format
      if (!Array.isArray(parsedData)) {
        if (typeof parsedData === 'object' && parsedData !== null) {
          // If it's a single object, wrap it in an array
          parsedData = [parsedData];
        } else {
          throw new Error('JSON content must be an object or array of objects');
        }
      }

      // Validate that all items in the array are objects
      const validObjects = [];
      for (let i = 0; i < parsedData.length; i++) {
        const item = parsedData[i];
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          // Flatten nested objects to some degree
          const flattenedItem = this.flattenObject(item);
          validObjects.push(flattenedItem);
        } else {
          // Skip non-object items but don't fail the entire file
          console.warn(`Skipping non-object item at index ${i} in file ${filePath}`);
        }
      }

      return validObjects;
    } catch (error) {
      throw new Error(`Failed to parse JSON file ${filePath}: ${error.message}`);
    }
  }

  /**
   * Flatten nested objects to a reasonable depth
   * @param {Object} obj - Object to flatten
   * @param {string} prefix - Prefix for nested keys
   * @param {number} maxDepth - Maximum depth to flatten (default: 2)
   * @param {number} currentDepth - Current depth (internal use)
   * @returns {Object} Flattened object
   */
  flattenObject(obj, prefix = '', maxDepth = 2, currentDepth = 0) {
    const flattened = {};

    for (const key in obj) {
      if (obj.hasOwnProperty(key)) {
        const value = obj[key];
        const newKey = prefix ? `${prefix}_${key}` : key;

        if (value === null || value === undefined) {
          flattened[newKey] = null;
        } else if (Array.isArray(value)) {
          // Convert arrays to JSON strings for storage
          flattened[newKey] = JSON.stringify(value);
        } else if (typeof value === 'object' && currentDepth < maxDepth) {
          // Recursively flatten nested objects up to maxDepth
          const nestedFlattened = this.flattenObject(value, newKey, maxDepth, currentDepth + 1);
          Object.assign(flattened, nestedFlattened);
        } else if (typeof value === 'object') {
          // Convert deep nested objects to JSON strings
          flattened[newKey] = JSON.stringify(value);
        } else {
          flattened[newKey] = value;
        }
      }
    }

    return flattened;
  }

  /**
   * Analyze the schema of JSON data to determine column types and structure
   * @param {Array<Object>} jsonDataArray - Array of JSON objects to analyze
   * @returns {Array<Object>} Array of column definitions with types
   */
  analyzeSchema(jsonDataArray) {
    if (!jsonDataArray || jsonDataArray.length === 0) {
      return [];
    }

    const columnStats = {};
    const totalRecords = jsonDataArray.length;

    // First pass: collect all unique column names
    const allColumns = new Set();
    jsonDataArray.forEach(record => {
      Object.keys(record).forEach(key => {
        if (!key.startsWith('_')) {
          allColumns.add(key);
        }
      });
    });

    // Initialize stats for all columns
    allColumns.forEach(columnName => {
      columnStats[columnName] = {
        name: columnName,
        types: new Set(),
        nullCount: 0,
        totalCount: 0,
        sampleValues: []
      };
    });

    // Second pass: collect statistics about each column
    jsonDataArray.forEach(record => {
      allColumns.forEach(columnName => {
        const stats = columnStats[columnName];
        stats.totalCount++;

        if (record.hasOwnProperty(columnName)) {
          const value = record[columnName];

          if (value === null || value === undefined) {
            stats.nullCount++;
            stats.types.add('null');
          } else {
            const valueType = this.inferDataType(value);
            stats.types.add(valueType);

            // Collect sample values (up to 5)
            if (stats.sampleValues.length < 5) {
              stats.sampleValues.push(value);
            }
          }
        } else {
          // Column is missing from this record, count as null
          stats.nullCount++;
          stats.types.add('null');
        }
      });
    });

    // Convert statistics to column definitions
    const columns = Object.values(columnStats).map(stats => {
      const sqlType = this.determineSQLType(stats.types);
      const nullable = stats.nullCount > 0;

      return {
        name: stats.name,
        type: sqlType,
        nullable: nullable,
        sampleValues: stats.sampleValues
      };
    });

    // Sort columns alphabetically for consistency
    columns.sort((a, b) => a.name.localeCompare(b.name));

    return columns;
  }

  /**
   * Infer the data type of a value
   * @param {any} value - Value to analyze
   * @returns {string} Inferred type
   */
  inferDataType(value) {
    if (value === null || value === undefined) {
      return 'null';
    }

    if (typeof value === 'boolean') {
      return 'boolean';
    }

    if (typeof value === 'number') {
      return Number.isInteger(value) ? 'integer' : 'real';
    }

    if (typeof value === 'string') {
      // Check if string represents a number
      if (/^\d+$/.test(value)) {
        return 'integer_string';
      }
      if (/^\d*\.\d+$/.test(value)) {
        return 'real_string';
      }
      // Check if string represents a boolean
      if (value.toLowerCase() === 'true' || value.toLowerCase() === 'false') {
        return 'boolean_string';
      }
      return 'text';
    }

    // For objects and arrays that were converted to JSON strings
    return 'text';
  }

  /**
   * Determine the appropriate SQLite data type based on observed types
   * @param {Set<string>} types - Set of observed types
   * @returns {string} SQLite data type
   */
  determineSQLType(types) {
    const typeArray = Array.from(types).filter(type => type !== 'null');

    if (typeArray.length === 0) {
      return 'TEXT';
    }

    // If all values are integers
    if (typeArray.every(type => type === 'integer' || type === 'integer_string')) {
      return 'INTEGER';
    }

    // If all values are numbers (integer or real)
    if (typeArray.every(type =>
      type === 'integer' || type === 'real' ||
      type === 'integer_string' || type === 'real_string'
    )) {
      return 'REAL';
    }

    // If all values are booleans
    if (typeArray.every(type => type === 'boolean' || type === 'boolean_string')) {
      return 'INTEGER'; // SQLite stores booleans as integers
    }

    // Default to TEXT for mixed types or text
    return 'TEXT';
  }

  /**
   * Get unique column names from combined data
   * @param {Array<Object>} combinedData - Array of all JSON objects
   * @returns {Array<string>} Array of unique column names
   */
  getUniqueColumns(combinedData) {
    if (!combinedData || combinedData.length === 0) {
      return [];
    }

    const columnSet = new Set();
    combinedData.forEach(record => {
      Object.keys(record).forEach(key => {
        // Skip internal fields
        if (!key.startsWith('_')) {
          columnSet.add(key);
        }
      });
    });

    return Array.from(columnSet).sort();
  }

  /**
   * Get the last scan results
   * @returns {Object|null} Last scan results or null if no scan performed
   */
  getLastScanResults() {
    return this.scanResults;
  }

  /**
   * Clear scan results and errors
   */
  clearResults() {
    this.scanResults = null;
    this.errors = [];
  }

  /**
   * Get scan errors
   * @returns {Array<Object>} Array of error objects
   */
  getErrors() {
    return [...this.errors];
  }

  /**
   * Check if the last scan had any errors
   * @returns {boolean} True if there were errors
   */
  hasErrors() {
    return this.errors.length > 0;
  }

  /**
   * Create a data table for a view using the DatabaseManager
   * @param {Object} databaseManager - DatabaseManager instance
   * @param {string} viewId - View ID for the table
   * @param {Array<Object>} columns - Column definitions from schema analysis
   * @returns {Promise<void>}
   */
  async createDataTable(databaseManager, viewId, columns) {
    if (!databaseManager || !viewId || !columns) {
      throw new Error('DatabaseManager, viewId, and columns are required');
    }

    if (!databaseManager.isConnected()) {
      throw new Error('DatabaseManager must be connected before creating data table');
    }

    await databaseManager.createDataTable(viewId, columns);
  }

  /**
   * Populate a data table with JSON data using batch insertion for performance
   * @param {Object} databaseManager - DatabaseManager instance
   * @param {string} viewId - View ID for the table
   * @param {Array<Object>} records - Array of JSON records to insert
   * @param {Object} options - Options for batch insertion
   * @param {number} options.batchSize - Number of records per batch (default: 1000)
   * @param {Function} options.progressCallback - Callback for progress updates
   * @returns {Promise<Object>} Result with insertion statistics
   */
  async populateDataTable(databaseManager, viewId, records, options = {}) {
    if (!databaseManager || !viewId || !records) {
      throw new Error('DatabaseManager, viewId, and records are required');
    }

    if (!databaseManager.isConnected()) {
      throw new Error('DatabaseManager must be connected before populating data table');
    }

    if (!Array.isArray(records) || records.length === 0) {
      return {
        totalRecords: 0,
        insertedRecords: 0,
        batchCount: 0,
        errors: []
      };
    }

    const {
      batchSize = 1000,
      progressCallback = null
    } = options;

    const sanitizedViewId = viewId.replace(/[^a-zA-Z0-9_]/g, '_');
    const tableName = `data_view_${sanitizedViewId}`;

    // Get table schema to determine columns
    const tableSchema = await databaseManager.getDataTableSchema(viewId);
    const columnNames = tableSchema.map(col => col.name);

    if (columnNames.length === 0) {
      throw new Error('Data table schema is empty. Ensure table is created first.');
    }

    const insertErrors = [];
    let insertedRecords = 0;
    let batchCount = 0;

    // Process records in batches
    for (let i = 0; i < records.length; i += batchSize) {
      const batch = records.slice(i, i + batchSize);
      batchCount++;

      try {
        const batchResult = await this.insertBatch(
          databaseManager,
          tableName,
          columnNames,
          batch
        );
        insertedRecords += batchResult.insertedCount;

        if (batchResult.errors.length > 0) {
          insertErrors.push(...batchResult.errors);
        }

        // Report progress if callback provided
        if (progressCallback && typeof progressCallback === 'function') {
          const progress = {
            currentBatch: batchCount,
            totalBatches: Math.ceil(records.length / batchSize),
            processedRecords: Math.min(i + batchSize, records.length),
            totalRecords: records.length,
            insertedRecords: insertedRecords,
            errors: insertErrors.length
          };
          progressCallback(progress);
        }
      } catch (error) {
        insertErrors.push({
          batch: batchCount,
          error: error.message,
          recordRange: `${i}-${Math.min(i + batchSize - 1, records.length - 1)}`
        });
      }
    }

    return {
      totalRecords: records.length,
      insertedRecords: insertedRecords,
      batchCount: batchCount,
      errors: insertErrors
    };
  }

  /**
   * Insert a batch of records into the data table
   * @param {Object} databaseManager - DatabaseManager instance
   * @param {string} tableName - Name of the data table
   * @param {Array<string>} columnNames - Array of column names
   * @param {Array<Object>} batch - Batch of records to insert
   * @returns {Promise<Object>} Batch insertion result
   */
  async insertBatch(databaseManager, tableName, columnNames, batch) {
    const statements = [];
    const batchErrors = [];
    let insertedCount = 0;

    // Prepare SQL statement
    const placeholders = columnNames.map(() => '?').join(', ');
    const columnList = columnNames.join(', ');
    const insertSQL = `INSERT INTO ${tableName} (_source_file, _scan_date, ${columnList}) VALUES (?, CURRENT_TIMESTAMP, ${placeholders})`;

    // Prepare batch statements
    batch.forEach((record, index) => {
      try {
        const values = [record._source_file || 'unknown'];

        // Extract values for each column, using null for missing properties
        columnNames.forEach(columnName => {
          const value = record.hasOwnProperty(columnName) ? record[columnName] : null;
          values.push(value);
        });

        statements.push({
          sql: insertSQL,
          params: values
        });
      } catch (error) {
        batchErrors.push({
          recordIndex: index,
          error: error.message,
          record: record
        });
      }
    });

    // Execute batch transaction
    if (statements.length > 0) {
      try {
        const results = await databaseManager.executeTransaction(statements);
        insertedCount = results.length;
      } catch (error) {
        batchErrors.push({
          error: `Batch transaction failed: ${error.message}`,
          statementCount: statements.length
        });
      }
    }

    return {
      insertedCount: insertedCount,
      errors: batchErrors
    };
  }

  /**
   * Scan source folders and populate data table in one operation
   * @param {Array<string>} sourceFolders - Array of folder paths to scan
   * @param {Object} databaseManager - DatabaseManager instance
   * @param {string} viewId - View ID for the table
   * @param {Object} options - Options for scanning and insertion
   * @param {number} options.batchSize - Number of records per batch (default: 1000)
   * @param {Function} options.progressCallback - Callback for progress updates
   * @returns {Promise<Object>} Complete operation result
   */
  async scanAndPopulate(sourceFolders, databaseManager, viewId, options = {}) {
    if (!sourceFolders || !databaseManager || !viewId) {
      throw new Error('Source folders, DatabaseManager, and viewId are required');
    }

    const {
      progressCallback = null
    } = options;

    // Report scan start
    if (progressCallback) {
      progressCallback({
        phase: 'scanning',
        message: 'Starting JSON file scan...'
      });
    }

    // Scan source folders
    const scanResults = await this.scanSourceFolders(sourceFolders);

    if (scanResults.totalRecords === 0) {
      return {
        scanResults: scanResults,
        tableCreated: false,
        populationResults: {
          totalRecords: 0,
          insertedRecords: 0,
          batchCount: 0,
          errors: []
        }
      };
    }

    // Report table creation
    if (progressCallback) {
      progressCallback({
        phase: 'table_creation',
        message: 'Creating data table...'
      });
    }

    // Create data table with discovered schema
    await this.createDataTable(databaseManager, viewId, scanResults.columns);

    // Report data population start
    if (progressCallback) {
      progressCallback({
        phase: 'population',
        message: 'Populating data table...',
        totalRecords: scanResults.totalRecords
      });
    }

    // Populate data table
    const populationResults = await this.populateDataTable(
      databaseManager,
      viewId,
      scanResults.data,
      {
        ...options,
        progressCallback: (progress) => {
          if (progressCallback) {
            progressCallback({
              phase: 'population',
              ...progress
            });
          }
        }
      }
    );

    // Report completion
    if (progressCallback) {
      progressCallback({
        phase: 'completed',
        message: 'Scan and population completed',
        scanResults: scanResults,
        populationResults: populationResults
      });
    }

    return {
      scanResults: scanResults,
      tableCreated: true,
      populationResults: populationResults
    };
  }
}

module.exports = JSONScanner;