import * as fs from 'fs';
import * as path from 'path';
import { SourceFolder, ScanResults, ScanColumn, ScanError, ColumnSchema } from '../types';
import { DatabaseManager } from './DatabaseManager';

interface BatchInsertResult {
  insertedCount: number;
  errors: BatchError[];
}

interface BatchError {
  recordIndex?: number;
  error: string;
  record?: any;
  batch?: number;
  recordRange?: string;
  statementCount?: number;
}

interface PopulationOptions {
  batchSize?: number;
  progressCallback?: (progress: PopulationProgress) => void;
}

interface PopulationProgress {
  currentBatch: number;
  totalBatches: number;
  processedRecords: number;
  totalRecords: number;
  insertedRecords: number;
  errors: number;
}

interface PopulationResults {
  totalRecords: number;
  insertedRecords: number;
  batchCount: number;
  errors: BatchError[];
}

interface ScanAndPopulateOptions {
  batchSize?: number;
  progressCallback?: (progress: ScanAndPopulateProgress) => void;
}

interface ScanAndPopulateProgress {
  phase: 'scanning' | 'table_creation' | 'population' | 'completed';
  message: string;
  totalRecords?: number;
  currentBatch?: number;
  totalBatches?: number;
  processedRecords?: number;
  insertedRecords?: number;
  errors?: number;
  scanResults?: ScanResults;
  populationResults?: PopulationResults;
}

interface ScanAndPopulateResult {
  scanResults: ScanResults;
  tableCreated: boolean;
  populationResults: PopulationResults;
}

interface ColumnStats {
  name: string;
  types: Set<string>;
  nullCount: number;
  totalCount: number;
  sampleValues: any[];
}

/**
 * JSONScanner handles scanning and parsing JSON files from source data folders,
 * analyzing their schema, and preparing data for database insertion.
 */
export class FileScanner {
  private scanResults: ScanResults | null = null;
  private errors: ScanError[] = [];

  /**
   * Scan all JSON and JSONL files in the provided source data folders
   */
  async scanSourceFolders(sourceFolders: SourceFolder[]): Promise<ScanResults> {
    if (!sourceFolders || !Array.isArray(sourceFolders) || sourceFolders.length === 0) {
      throw new Error('Source folders array is required and must not be empty');
    }

    this.errors = [];
    const allJsonFiles: string[] = [];
    const allJsonData: any[] = [];

    // Recursively find all JSON files in source folders
    for (const sourceFolder of sourceFolders) {
      try {
        if (!fs.existsSync(sourceFolder.path)) {
          this.errors.push({
            file: sourceFolder.path,
            error: 'Source folder does not exist'
          });
          continue;
        }

        const jsonFiles = await this.findJsonFiles(sourceFolder.path);
        allJsonFiles.push(...jsonFiles);
      } catch (error) {
        this.errors.push({
          file: sourceFolder.path,
          error: `Failed to scan folder: ${(error as Error).message}`
        });
      }
    }

    // Parse all found JSON files
    for (const filePath of allJsonFiles) {
      try {
        const jsonData = await this.parseFile(filePath);
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
          error: (error as Error).message
        });
      }
    }

    // Analyze schema from all collected data
    const schema = this.analyzeSchema(allJsonData);

    // Calculate processed files correctly - count files that were successfully parsed
    const fileErrors = this.errors.filter(error => !error.file.endsWith('/') && !error.error.includes('Source folder'));
    const processedFiles = Math.max(0, allJsonFiles.length - fileErrors.length);

    this.scanResults = {
      viewId: '', // Will be set by caller
      totalFiles: allJsonFiles.length,
      processedFiles: processedFiles,
      totalRecords: allJsonData.length,
      columns: schema,
      errors: [...this.errors],
      scanDate: new Date()
    };

    return this.scanResults;
  }

  /**
   * Recursively find all JSON and JSONL files in a directory
   */
  async findJsonFiles(dirPath: string): Promise<string[]> {
    const jsonFiles: string[] = [];

    const scanDirectory = async (currentPath: string): Promise<void> => {
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
          } else if (stats.isFile()) {
            const ext = path.extname(item).toLowerCase();
            if (ext === '.json' || ext === '.jsonl' || ext === '.jsonddb') {
              jsonFiles.push(itemPath);
            }
          }
        }
      } catch (error) {
        this.errors.push({
          file: currentPath,
          error: `Failed to read directory: ${(error as Error).message}`
        });
      }
    };

    await scanDirectory(dirPath);
    return jsonFiles;
  }

  /**
   * Parse a file and return its contents as an array
   * Supports different file formats based on extension
   */
  async parseFile(filePath: string): Promise<any[]> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File does not exist');
      }

      // Extract file extension
      const extension = path.extname(filePath).toLowerCase();
      
      // Use switch statement to delegate to the appropriate parser based on extension
      switch (extension) {
        case '.jsonl':
          return this.parseJsonLFile(filePath);
        case '.json':
          return this.parseJsonFile(filePath);
        case '.jsonddb':
          return this.parseDynamoDBJsonFile(filePath);
        default:
          throw new Error(`Unsupported file extension: ${extension}`);
      }
    } catch (error) {
      throw new Error(`Failed to parse file ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Parse a JSON file and return its contents as an array
   */
  private async parseJsonFile(filePath: string): Promise<any[]> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File does not exist');
      }

      // No need to check file extension here as parseFile already handles routing

      const fileContent = fs.readFileSync(filePath, 'utf8');

      if (!fileContent.trim()) {
        throw new Error('File is empty');
      }

      let parsedData: any;
      try {
        parsedData = JSON.parse(fileContent);
      } catch (parseError) {
        throw new Error(`Invalid JSON format: ${(parseError as Error).message}`);
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
      const validObjects: any[] = [];
      for (let i = 0; i < parsedData.length; i++) {
        const item = parsedData[i];
        if (typeof item === 'object' && item !== null && !Array.isArray(item)) {
          // Flatten nested objects to some degree
          const flattenedItem = this.flattenObject(item);
          validObjects.push(flattenedItem);
        } else {
          // Skip non-object items but don't fail the entire file
          // Only log warning in non-test environments
          if (process.env['NODE_ENV'] !== 'test') {
            console.warn(`Skipping non-object item at index ${i} in file ${filePath}`);
          }
        }
      }

      return validObjects;
    } catch (error) {
      throw new Error(`Failed to parse JSON file ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Parse a JSONL file and return its contents as an array
   * Each line in a JSONL file is a separate JSON object
   */
  private async parseJsonLFile(filePath: string): Promise<any[]> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File does not exist');
      }

      const readline = require('readline');
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      const validObjects: any[] = [];
      let lineNumber = 0;

      for await (const line of rl) {
        lineNumber++;
        
        // Skip empty lines
        if (!line.trim()) continue;
        
        try {
          // Parse each line as a separate JSON object
          const parsedData = JSON.parse(line);
          
          if (typeof parsedData === 'object' && parsedData !== null && !Array.isArray(parsedData)) {
            // Flatten nested objects to some degree
            const flattenedItem = this.flattenObject(parsedData);
            validObjects.push(flattenedItem);
          } else {
            // Skip non-object items but don't fail the entire file
            // Only log warning in non-test environments
            if (process.env['NODE_ENV'] !== 'test') {
              console.warn(`Skipping non-object item at line ${lineNumber} in file ${filePath}`);
            }
          }
        } catch (parseError) {
          // Log the error but continue processing other lines
          if (process.env['NODE_ENV'] !== 'test') {
            console.warn(`Error parsing line ${lineNumber} in JSONL file ${filePath}: ${(parseError as Error).message}`);
          }
        }
      }

      if (validObjects.length === 0) {
        throw new Error('No valid JSON objects found in JSONL file');
      }

      return validObjects;
    } catch (error) {
      throw new Error(`Failed to parse JSONL file ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Parse a DynamoDB JSON file and return its contents as an array
   * Each line in a DynamoDB JSON file is a separate JSON object with DynamoDB type annotations
   */
  private async parseDynamoDBJsonFile(filePath: string): Promise<any[]> {
    try {
      if (!fs.existsSync(filePath)) {
        throw new Error('File does not exist');
      }

      const readline = require('readline');
      const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
      const rl = readline.createInterface({
        input: fileStream,
        crlfDelay: Infinity
      });

      const validObjects: any[] = [];
      let lineNumber = 0;

      for await (const line of rl) {
        lineNumber++;
        
        // Skip empty lines
        if (!line.trim()) continue;
        
        try {
          // Parse each line as a separate DynamoDB JSON object
          const dynamoDBJson = JSON.parse(line);
          
          // Check if this is a valid DynamoDB item format
          if (typeof dynamoDBJson === 'object' && dynamoDBJson !== null) {
            let standardItem: any;
            
            // Handle the common DynamoDB export format where items are wrapped in an "Item" field
            if (dynamoDBJson.hasOwnProperty('Item')) {
              standardItem = this.convertDynamoDBToStandardJson(dynamoDBJson.Item);
            } else {
              // Try to convert directly if not in the "Item" wrapper format
              standardItem = this.convertDynamoDBToStandardJson(dynamoDBJson);
            }
            
            // Flatten nested objects to some degree
            const flattenedItem = this.flattenObject(standardItem);
            validObjects.push(flattenedItem);
          } else {
            // Skip non-object items but don't fail the entire file
            // Only log warning in non-test environments
            if (process.env['NODE_ENV'] !== 'test') {
              console.warn(`Skipping non-object item at line ${lineNumber} in file ${filePath}`);
            }
          }
        } catch (parseError) {
          // Log the error but continue processing other lines
          if (process.env['NODE_ENV'] !== 'test') {
            console.warn(`Error parsing line ${lineNumber} in DynamoDB JSON file ${filePath}: ${(parseError as Error).message}`);
          }
        }
      }

      if (validObjects.length === 0) {
        throw new Error('No valid JSON objects found in DynamoDB JSON file');
      }

      return validObjects;
    } catch (error) {
      throw new Error(`Failed to parse DynamoDB JSON file ${filePath}: ${(error as Error).message}`);
    }
  }

  /**
   * Convert a DynamoDB formatted item to standard JSON format
   * 
   * @param dynamoDBItem Item in DynamoDB JSON format
   * @returns Item in standard JSON format
   */
  private convertDynamoDBToStandardJson(dynamoDBItem: any): any {
    if (!dynamoDBItem || typeof dynamoDBItem !== 'object') {
      return dynamoDBItem;
    }

    const result: any = {};
    
    for (const key in dynamoDBItem) {
      if (dynamoDBItem.hasOwnProperty(key)) {
        const value = dynamoDBItem[key];
        
        // Handle different DynamoDB types
        if (value.hasOwnProperty('S')) {  // String type
          result[key] = value.S;
        } else if (value.hasOwnProperty('N')) {  // Number type
          // Convert to float or int as appropriate
          const numStr = value.N;
          result[key] = numStr.includes('.') ? parseFloat(numStr) : parseInt(numStr, 10);
        } else if (value.hasOwnProperty('BOOL')) {  // Boolean type
          result[key] = value.BOOL;
        } else if (value.hasOwnProperty('NULL')) {  // Null type
          result[key] = null;
        } else if (value.hasOwnProperty('L')) {  // List type
          result[key] = [];
          for (const item of value.L) {
            if (typeof item === 'object') {
              if (item.hasOwnProperty('S')) {
                result[key].push(item.S);
              } else if (item.hasOwnProperty('N')) {
                const numStr = item.N;
                result[key].push(numStr.includes('.') ? parseFloat(numStr) : parseInt(numStr, 10));
              } else if (item.hasOwnProperty('BOOL')) {
                result[key].push(item.BOOL);
              } else if (item.hasOwnProperty('M')) {
                result[key].push(this.convertDynamoDBToStandardJson(item.M));
              } else {
                // For other types or complex nested structures
                result[key].push(item);
              }
            } else {
              result[key].push(item);
            }
          }
        } else if (value.hasOwnProperty('M')) {  // Map type
          result[key] = this.convertDynamoDBToStandardJson(value.M);
        } else if (value.hasOwnProperty('SS')) {  // String Set type
          result[key] = Array.from(value.SS);
        } else if (value.hasOwnProperty('NS')) {  // Number Set type
          result[key] = value.NS.map((n: string) => n.includes('.') ? parseFloat(n) : parseInt(n, 10));
        } else if (value.hasOwnProperty('BS')) {  // Binary Set type
          result[key] = Array.from(value.BS);
        } else {
          // For any unhandled types, keep as is
          result[key] = value;
        }
      }
    }
    
    return result;
  }

  /**
   * Flatten nested objects to a reasonable depth
   */
  private flattenObject(obj: any, prefix: string = '', maxDepth: number = 2, currentDepth: number = 0): any {
    const flattened: any = {};

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
   */
  analyzeSchema(jsonDataArray: any[]): ScanColumn[] {
    if (!jsonDataArray || jsonDataArray.length === 0) {
      return [];
    }

    const columnStats: { [key: string]: ColumnStats } = {};

    // First pass: collect all unique column names
    const allColumns = new Set<string>();
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
        const stats = columnStats[columnName]!;
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
   */
  private inferDataType(value: any): string {
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
   */
  private determineSQLType(types: Set<string>): 'TEXT' | 'INTEGER' | 'REAL' {
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
   */
  getUniqueColumns(combinedData: any[]): string[] {
    if (!combinedData || combinedData.length === 0) {
      return [];
    }

    const columnSet = new Set<string>();
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
   */
  getLastScanResults(): ScanResults | null {
    return this.scanResults;
  }

  /**
   * Clear scan results and errors
   */
  clearResults(): void {
    this.scanResults = null;
    this.errors = [];
  }

  /**
   * Get scan errors
   */
  getErrors(): ScanError[] {
    return [...this.errors];
  }

  /**
   * Check if the last scan had any errors
   */
  hasErrors(): boolean {
    return this.errors.length > 0;
  }

  /**
   * Create a data table for a view using the DatabaseManager
   */
  async createDataTable(databaseManager: DatabaseManager, viewId: string, columns: ScanColumn[]): Promise<void> {
    if (!databaseManager || !viewId || !columns) {
      throw new Error('DatabaseManager, viewId, and columns are required');
    }

    if (!databaseManager.isConnected()) {
      throw new Error('DatabaseManager must be connected before creating data table');
    }

    // Convert ScanColumn to ColumnSchema
    const columnSchema: ColumnSchema[] = columns.map(col => ({
      columnName: col.name,
      dataType: col.type,
      nullable: col.nullable
    }));

    await databaseManager.createDataTable(viewId, columnSchema);
  }

  /**
   * Populate a data table with JSON data using batch insertion for performance
   */
  async populateDataTable(
    databaseManager: DatabaseManager, 
    viewId: string, 
    records: any[], 
    options: PopulationOptions = {}
  ): Promise<PopulationResults> {
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

    const insertErrors: BatchError[] = [];
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
          const progress: PopulationProgress = {
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
          error: (error as Error).message,
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
   */
  private async insertBatch(
    databaseManager: DatabaseManager, 
    tableName: string, 
    columnNames: string[], 
    batch: any[]
  ): Promise<BatchInsertResult> {
    const statements: { sql: string; params: any[] }[] = [];
    const batchErrors: BatchError[] = [];
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
          error: (error as Error).message,
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
          error: `Batch transaction failed: ${(error as Error).message}`,
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
   */
  async scanAndPopulate(
    sourceFolders: SourceFolder[], 
    databaseManager: DatabaseManager, 
    viewId: string, 
    options: ScanAndPopulateOptions = {}
  ): Promise<ScanAndPopulateResult> {
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
        message: 'Starting JSON and JSONL file scan...'
      });
    }

    // First, count total files to provide better progress reporting
    let totalFiles = 0;
    for (const folder of sourceFolders) {
      if (!folder || !folder.path) continue;
      
      try {
        if (folder.path) {
          const jsonFiles = await this.findJsonFiles(folder.path as string);
          totalFiles += jsonFiles.length;
          
          // Report progress after counting files in each folder
          if (progressCallback) {
            progressCallback({
              phase: 'scanning',
              message: `Found ${totalFiles} JSON/JSONL files to process`,
              totalRecords: totalFiles
            });
          }
        }
      } catch (error) {
        console.warn(`Error counting files in ${folder.path || 'unknown path'}:`, error);
      }
    }

    // If no files found, return early
    if (totalFiles === 0) {
      if (progressCallback) {
        progressCallback({
          phase: 'completed',
          message: 'No JSON or JSONL files found',
          totalRecords: 0
        });
      }
      
      return {
        scanResults: {
          viewId,
          totalFiles: 0,
          processedFiles: 0,
          totalRecords: 0,
          columns: [],
          errors: [],
          scanDate: new Date()
        },
        tableCreated: false,
        populationResults: {
          totalRecords: 0,
          insertedRecords: 0,
          batchCount: 0,
          errors: []
        }
      };
    }

    // Process files with regular progress updates
    let processedFiles = 0;
    let allJsonData: any[] = [];
    const errors: ScanError[] = [];

    // Process each source folder
    for (let i = 0; i < sourceFolders.length; i++) {
      const folder = sourceFolders[i];
      
      if (!folder || !folder.path) {
        console.warn(`Skipping undefined folder at index ${i}`);
        continue;
      }
      
      // Report progress for each folder
      if (progressCallback) {
        progressCallback({
          phase: 'scanning',
          message: `Scanning folder: ${folder.path || 'unknown path'}`,
          processedRecords: processedFiles,
          totalRecords: totalFiles
        });
      }

      try {
        if (!folder.path || !fs.existsSync(folder.path)) {
          errors.push({
            file: folder.path || 'unknown path',
            error: 'Source folder does not exist or path is undefined'
          });
          continue;
        }

        // Find all JSON and JSONL files in the folder
        const jsonFiles = await this.findJsonFiles(folder.path as string);
        
        // Process each file
        for (let j = 0; j < jsonFiles.length; j++) {
          const filePath = jsonFiles[j];
          
          // Report progress every few files to avoid flooding
          if (progressCallback && (j % 5 === 0 || j === jsonFiles.length - 1)) {
            const folderName = folder.path ? path.basename(folder.path) : 'unknown folder';
            const fileName = path.basename(filePath as string);
            progressCallback({
              phase: 'scanning',
              message: `Processing file ${j + 1}/${jsonFiles.length} in ${folderName}: ${fileName}`,
              processedRecords: processedFiles,
              totalRecords: totalFiles
            });
          }
          
          try {
            const jsonData = await this.parseFile(filePath as string);
            if (jsonData && Array.isArray(jsonData) && jsonData.length > 0) {
              // Add source file information to each record
              const dataWithSource = jsonData.map(record => ({
                ...record,
                _source_file: filePath
              }));
              allJsonData.push(...dataWithSource);
            }
            processedFiles++;
            
            // Yield to the event loop to prevent UI freezing
            await new Promise(resolve => setTimeout(resolve, 0));
          } catch (error) {
            errors.push({
              file: filePath || 'unknown file',
              error: (error as Error).message
            });
            processedFiles++;
          }
        }
      } catch (error) {
        errors.push({
          file: folder.path || 'unknown path',
          error: `Failed to scan folder: ${(error as Error).message}`
        });
      }
    }

    // Analyze schema from all collected data
    if (progressCallback) {
      progressCallback({
        phase: 'scanning',
        message: `Analyzing schema for ${allJsonData.length} records...`,
        processedRecords: processedFiles,
        totalRecords: totalFiles
      });
    }
    
    const schema = this.analyzeSchema(allJsonData);
    
    // Create scan results
    const scanResults: ScanResults = {
      viewId,
      totalFiles,
      processedFiles,
      totalRecords: allJsonData.length,
      columns: schema,
      errors: [...errors],
      scanDate: new Date()
    };

    if (scanResults.totalRecords === 0) {
      if (progressCallback) {
        progressCallback({
          phase: 'completed',
          message: 'Scan completed. No valid records found.',
          scanResults
        });
      }
      
      return {
        scanResults,
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
        message: 'Creating data table...',
        scanResults
      });
    }

    // Create data table with discovered schema
    await this.createDataTable(databaseManager, viewId, scanResults.columns);

    // Report data population start
    if (progressCallback) {
      progressCallback({
        phase: 'population',
        message: 'Populating data table...',
        totalRecords: scanResults.totalRecords,
        scanResults
      });
    }

    // Populate the data table with the collected data
    const populationOptions = {
      batchSize: options.batchSize || 1000,
      progressCallback: (progress: PopulationProgress) => {
        if (progressCallback) {
          progressCallback({
            phase: 'population',
            message: `Inserting records (batch ${progress.currentBatch}/${progress.totalBatches})...`,
            currentBatch: progress.currentBatch,
            totalBatches: progress.totalBatches,
            processedRecords: progress.processedRecords,
            totalRecords: progress.totalRecords,
            insertedRecords: progress.insertedRecords,
            errors: progress.errors,
            scanResults
          });
        }
      }
    };

    const populationResults = await this.populateDataTable(
      databaseManager,
      viewId,
      allJsonData,
      populationOptions
    );

    // Report completion
    if (progressCallback) {
      progressCallback({
        phase: 'completed',
        message: `Scan and population completed. Processed ${processedFiles} files and inserted ${populationResults.insertedRecords} records.`,
        scanResults,
        populationResults
      });
    }

    return {
      scanResults,
      tableCreated: true,
      populationResults
    };
  }
}

/**
 * Process a JSON file line by line and extract objects
 * Uses optimized streaming to handle large files (up to 1GB) efficiently
 */
async function processJsonFile(filePath: string): Promise<any[]> {
  const extractedObjects: any[] = [];
  
  try {
    // Create a read stream for the file
    const fileStream = fs.createReadStream(filePath, { encoding: 'utf8' });
    
    // Create interface for reading line by line
    const readline = require('readline');
    const rl = readline.createInterface({
      input: fileStream,
      crlfDelay: Infinity
    });
    
    // Track parsing state
    let insideRootArray = false;
    let insideObject = false;
    let objectDepth = 0;
    let currentObject = '';
    let insideString = false;
    let escapeNext = false;
    
    // Process the file line by line
    for await (const line of rl) {
      // Skip empty lines
      if (!line.trim()) continue;
      
      // Process each character in the line
      for (let i = 0; i < line.length; i++) {
        const char = line[i];
        
        // Always add the current character to the object string if we're inside an object
        if (insideObject) {
          currentObject += char;
        }
        
        // Handle escape sequences
        if (escapeNext) {
          escapeNext = false;
          continue;
        }
        
        // Check for escape character
        if (char === '\\') {
          escapeNext = true;
          continue;
        }
        
        // Handle string boundaries
        if (char === '"' && insideObject) {
          insideString = !insideString;
        }
        
        // Skip processing special characters if inside a string
        if (insideString) {
          continue;
        }
        
        // Check for root array start
        if (!insideRootArray && char === '[') {
          insideRootArray = true;
          continue;
        }
        
        // Check for root array end
        if (insideRootArray && !insideObject && char === ']') {
          insideRootArray = false;
          continue;
        }
        
        // Skip whitespace between objects in the root array
        if (insideRootArray && !insideObject && /\s|,/.test(char)) {
          continue;
        }
        
        // Start of a new object in the root array
        if (insideRootArray && !insideObject && char === '{') {
          insideObject = true;
          objectDepth = 1;
          currentObject = '{';
          continue;
        }
        
        // Inside an object, track object depth (but only if not inside a string)
        if (insideObject) {
          if (char === '{') {
            objectDepth++;
          } else if (char === '}') {
            objectDepth--;
            
            // If we've closed the root object, process it
            if (objectDepth === 0) {
              insideObject = false;
              insideString = false; // Reset string state
              
              try {
                const obj = JSON.parse(currentObject);
                if (typeof obj === 'object' && obj !== null) {
                  const extractedObj: any = {};
                  
                  // Extract only first-level properties
                  for (const [key, value] of Object.entries(obj)) {
                    // Store only primitive values or stringified complex values
                    if (value === null) {
                      extractedObj[key] = null;
                    } else if (typeof value !== 'object') {
                      extractedObj[key] = value;
                    } else {
                      extractedObj[key] = JSON.stringify(value);
                    }
                  }
                  
                  extractedObjects.push(extractedObj);
                }
              } catch (parseError) {
                console.log(`Error parsing object: ${currentObject}`);
              }
              
              currentObject = '';
            }
          }
        }
      }
    }
  } catch (fileError) {
    console.warn(`Error reading file ${filePath}:`, fileError);
  }
  
  return extractedObjects;
}