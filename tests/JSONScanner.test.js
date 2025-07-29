const JSONScanner = require('../src/main/JSONScanner');
const DatabaseManager = require('../src/main/DatabaseManager');
const fs = require('fs');
const path = require('path');
const os = require('os');

describe('JSONScanner', () => {
  let scanner;
  let tempDir;

  beforeEach(() => {
    scanner = new JSONScanner();
    // Create a temporary directory for test files
    tempDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonscanner-test-'));
  });

  afterEach(() => {
    // Clean up temporary directory
    if (fs.existsSync(tempDir)) {
      fs.rmSync(tempDir, { recursive: true, force: true });
    }
  });

  describe('constructor', () => {
    test('should initialize with null scan results and empty errors', () => {
      expect(scanner.scanResults).toBeNull();
      expect(scanner.errors).toEqual([]);
    });
  });

  describe('scanSourceFolders', () => {
    test('should throw error for invalid source folders parameter', async () => {
      await expect(scanner.scanSourceFolders()).rejects.toThrow('Source folders array is required and must not be empty');
      await expect(scanner.scanSourceFolders(null)).rejects.toThrow('Source folders array is required and must not be empty');
      await expect(scanner.scanSourceFolders([])).rejects.toThrow('Source folders array is required and must not be empty');
      await expect(scanner.scanSourceFolders('not-an-array')).rejects.toThrow('Source folders array is required and must not be empty');
    });

    test('should handle non-existent source folders gracefully', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent');
      const result = await scanner.scanSourceFolders([nonExistentPath]);

      expect(result.totalFiles).toBe(0);
      expect(result.processedFiles).toBe(0);
      expect(result.totalRecords).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0].file).toBe(nonExistentPath);
      expect(result.errors[0].error).toBe('Source folder does not exist');
    });

    test('should scan and parse valid JSON files', async () => {
      // Create test JSON files
      const testData1 = [
        { id: 1, name: 'John', age: 30 },
        { id: 2, name: 'Jane', age: 25 }
      ];
      const testData2 = [
        { id: 3, name: 'Bob', score: 95.5 }
      ];

      const file1Path = path.join(tempDir, 'data1.json');
      const file2Path = path.join(tempDir, 'data2.json');
      
      fs.writeFileSync(file1Path, JSON.stringify(testData1));
      fs.writeFileSync(file2Path, JSON.stringify(testData2));

      const result = await scanner.scanSourceFolders([tempDir]);

      expect(result.totalFiles).toBe(2);
      expect(result.processedFiles).toBe(2);
      expect(result.totalRecords).toBe(3);
      expect(result.errors).toHaveLength(0);
      expect(result.columns).toBeDefined();
      expect(result.data).toHaveLength(3);
    });

    test('should handle nested directories', async () => {
      // Create nested directory structure
      const subDir = path.join(tempDir, 'subdir');
      fs.mkdirSync(subDir);

      const testData = [{ id: 1, name: 'Test' }];
      const filePath = path.join(subDir, 'nested.json');
      fs.writeFileSync(filePath, JSON.stringify(testData));

      const result = await scanner.scanSourceFolders([tempDir]);

      expect(result.totalFiles).toBe(1);
      expect(result.totalRecords).toBe(1);
    });

    test('should skip hidden directories and common build directories', async () => {
      // Create directories that should be skipped
      const hiddenDir = path.join(tempDir, '.hidden');
      const nodeModulesDir = path.join(tempDir, 'node_modules');
      const distDir = path.join(tempDir, 'dist');
      
      fs.mkdirSync(hiddenDir);
      fs.mkdirSync(nodeModulesDir);
      fs.mkdirSync(distDir);

      // Add JSON files in these directories
      fs.writeFileSync(path.join(hiddenDir, 'hidden.json'), JSON.stringify([{ id: 1 }]));
      fs.writeFileSync(path.join(nodeModulesDir, 'module.json'), JSON.stringify([{ id: 2 }]));
      fs.writeFileSync(path.join(distDir, 'dist.json'), JSON.stringify([{ id: 3 }]));

      const result = await scanner.scanSourceFolders([tempDir]);

      expect(result.totalFiles).toBe(0);
      expect(result.totalRecords).toBe(0);
    });
  });

  describe('parseJSONFile', () => {
    test('should parse valid JSON array', async () => {
      const testData = [{ id: 1, name: 'Test' }];
      const filePath = path.join(tempDir, 'test.json');
      fs.writeFileSync(filePath, JSON.stringify(testData));

      const result = await scanner.parseJSONFile(filePath);

      expect(result).toEqual(testData);
    });

    test('should wrap single object in array', async () => {
      const testData = { id: 1, name: 'Test' };
      const filePath = path.join(tempDir, 'test.json');
      fs.writeFileSync(filePath, JSON.stringify(testData));

      const result = await scanner.parseJSONFile(filePath);

      expect(result).toEqual([testData]);
    });

    test('should throw error for non-existent file', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent.json');
      
      await expect(scanner.parseJSONFile(nonExistentPath)).rejects.toThrow('File does not exist');
    });

    test('should throw error for empty file', async () => {
      const filePath = path.join(tempDir, 'empty.json');
      fs.writeFileSync(filePath, '');

      await expect(scanner.parseJSONFile(filePath)).rejects.toThrow('File is empty');
    });

    test('should throw error for invalid JSON', async () => {
      const filePath = path.join(tempDir, 'invalid.json');
      fs.writeFileSync(filePath, '{ invalid json }');

      await expect(scanner.parseJSONFile(filePath)).rejects.toThrow('Invalid JSON format');
    });

    test('should throw error for non-object JSON content', async () => {
      const filePath = path.join(tempDir, 'primitive.json');
      fs.writeFileSync(filePath, '"just a string"');

      await expect(scanner.parseJSONFile(filePath)).rejects.toThrow('JSON content must be an object or array of objects');
    });

    test('should skip non-object items in array', async () => {
      const testData = [
        { id: 1, name: 'Valid' },
        'invalid string',
        42,
        { id: 2, name: 'Also Valid' }
      ];
      const filePath = path.join(tempDir, 'mixed.json');
      fs.writeFileSync(filePath, JSON.stringify(testData));

      const result = await scanner.parseJSONFile(filePath);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, name: 'Valid' });
      expect(result[1]).toEqual({ id: 2, name: 'Also Valid' });
    });
  });

  describe('flattenObject', () => {
    test('should flatten nested objects', () => {
      const nested = {
        id: 1,
        user: {
          name: 'John',
          profile: {
            age: 30,
            city: 'NYC'
          }
        }
      };

      const result = scanner.flattenObject(nested);

      expect(result).toEqual({
        id: 1,
        user_name: 'John',
        user_profile_age: 30,
        user_profile_city: 'NYC'
      });
    });

    test('should convert arrays to JSON strings', () => {
      const obj = {
        id: 1,
        tags: ['tag1', 'tag2'],
        numbers: [1, 2, 3]
      };

      const result = scanner.flattenObject(obj);

      expect(result).toEqual({
        id: 1,
        tags: '["tag1","tag2"]',
        numbers: '[1,2,3]'
      });
    });

    test('should handle null and undefined values', () => {
      const obj = {
        id: 1,
        nullValue: null,
        undefinedValue: undefined,
        emptyString: ''
      };

      const result = scanner.flattenObject(obj);

      expect(result).toEqual({
        id: 1,
        nullValue: null,
        undefinedValue: null,
        emptyString: ''
      });
    });

    test('should respect maxDepth parameter', () => {
      const deepNested = {
        level1: {
          level2: {
            level3: {
              level4: 'deep'
            }
          }
        }
      };

      const result = scanner.flattenObject(deepNested, '', 1);

      expect(result).toEqual({
        level1_level2: '{"level3":{"level4":"deep"}}'
      });
    });
  });

  describe('analyzeSchema', () => {
    test('should return empty array for empty data', () => {
      const result = scanner.analyzeSchema([]);
      expect(result).toEqual([]);
    });

    test('should analyze schema correctly', () => {
      const data = [
        { id: 1, name: 'John', age: 30, active: true },
        { id: 2, name: 'Jane', age: 25, active: false },
        { id: 3, name: 'Bob', score: 95.5 }
      ];

      const result = scanner.analyzeSchema(data);

      expect(result).toHaveLength(5);
      
      const idColumn = result.find(col => col.name === 'id');
      expect(idColumn.type).toBe('INTEGER');
      expect(idColumn.nullable).toBe(false);

      const nameColumn = result.find(col => col.name === 'name');
      expect(nameColumn.type).toBe('TEXT');
      expect(nameColumn.nullable).toBe(false);

      const ageColumn = result.find(col => col.name === 'age');
      expect(ageColumn.type).toBe('INTEGER');
      expect(ageColumn.nullable).toBe(true); // Bob doesn't have age

      const scoreColumn = result.find(col => col.name === 'score');
      expect(scoreColumn.type).toBe('REAL');
      expect(scoreColumn.nullable).toBe(true); // Only Bob has score
    });

    test('should skip internal fields starting with underscore', () => {
      const data = [
        { id: 1, name: 'John', _internal: 'skip' },
        { id: 2, name: 'Jane', _source_file: 'skip' }
      ];

      const result = scanner.analyzeSchema(data);

      expect(result).toHaveLength(2);
      expect(result.find(col => col.name === '_internal')).toBeUndefined();
      expect(result.find(col => col.name === '_source_file')).toBeUndefined();
    });
  });

  describe('inferDataType', () => {
    test('should infer correct data types', () => {
      expect(scanner.inferDataType(null)).toBe('null');
      expect(scanner.inferDataType(undefined)).toBe('null');
      expect(scanner.inferDataType(true)).toBe('boolean');
      expect(scanner.inferDataType(false)).toBe('boolean');
      expect(scanner.inferDataType(42)).toBe('integer');
      expect(scanner.inferDataType(3.14)).toBe('real');
      expect(scanner.inferDataType('hello')).toBe('text');
      expect(scanner.inferDataType('123')).toBe('integer_string');
      expect(scanner.inferDataType('3.14')).toBe('real_string');
      expect(scanner.inferDataType('true')).toBe('boolean_string');
      expect(scanner.inferDataType('false')).toBe('boolean_string');
    });
  });

  describe('determineSQLType', () => {
    test('should determine correct SQL types', () => {
      expect(scanner.determineSQLType(new Set(['integer']))).toBe('INTEGER');
      expect(scanner.determineSQLType(new Set(['integer', 'integer_string']))).toBe('INTEGER');
      expect(scanner.determineSQLType(new Set(['real']))).toBe('REAL');
      expect(scanner.determineSQLType(new Set(['integer', 'real']))).toBe('REAL');
      expect(scanner.determineSQLType(new Set(['boolean']))).toBe('INTEGER');
      expect(scanner.determineSQLType(new Set(['text']))).toBe('TEXT');
      expect(scanner.determineSQLType(new Set(['integer', 'text']))).toBe('TEXT');
      expect(scanner.determineSQLType(new Set(['null']))).toBe('TEXT');
    });
  });

  describe('getUniqueColumns', () => {
    test('should return unique column names', () => {
      const data = [
        { id: 1, name: 'John', age: 30 },
        { id: 2, name: 'Jane', city: 'NYC' },
        { score: 95, name: 'Bob' }
      ];

      const result = scanner.getUniqueColumns(data);

      expect(result).toEqual(['age', 'city', 'id', 'name', 'score']);
    });

    test('should skip internal fields', () => {
      const data = [
        { id: 1, name: 'John', _internal: 'skip' },
        { id: 2, name: 'Jane', _source_file: 'skip' }
      ];

      const result = scanner.getUniqueColumns(data);

      expect(result).toEqual(['id', 'name']);
    });

    test('should return empty array for empty data', () => {
      expect(scanner.getUniqueColumns([])).toEqual([]);
      expect(scanner.getUniqueColumns(null)).toEqual([]);
    });
  });

  describe('utility methods', () => {
    test('getLastScanResults should return scan results', async () => {
      expect(scanner.getLastScanResults()).toBeNull();

      // Create a test file and scan
      const testData = [{ id: 1, name: 'Test' }];
      const filePath = path.join(tempDir, 'test.json');
      fs.writeFileSync(filePath, JSON.stringify(testData));

      await scanner.scanSourceFolders([tempDir]);
      const results = scanner.getLastScanResults();

      expect(results).toBeDefined();
      expect(results.totalFiles).toBe(1);
    });

    test('clearResults should clear scan results and errors', async () => {
      // Create a test file and scan
      const testData = [{ id: 1, name: 'Test' }];
      const filePath = path.join(tempDir, 'test.json');
      fs.writeFileSync(filePath, JSON.stringify(testData));

      await scanner.scanSourceFolders([tempDir]);
      expect(scanner.getLastScanResults()).toBeDefined();

      scanner.clearResults();
      expect(scanner.getLastScanResults()).toBeNull();
      expect(scanner.getErrors()).toEqual([]);
    });

    test('getErrors should return errors', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent');
      await scanner.scanSourceFolders([nonExistentPath]);

      const errors = scanner.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0].file).toBe(nonExistentPath);
    });

    test('hasErrors should return true when there are errors', async () => {
      expect(scanner.hasErrors()).toBe(false);

      const nonExistentPath = path.join(tempDir, 'non-existent');
      await scanner.scanSourceFolders([nonExistentPath]);

      expect(scanner.hasErrors()).toBe(true);
    });
  });

  describe('integration tests', () => {
    test('should handle complex real-world JSON structure', async () => {
      const complexData = [
        {
          id: 1,
          user: {
            name: 'John Doe',
            email: 'john@example.com',
            preferences: {
              theme: 'dark',
              notifications: true
            }
          },
          orders: [
            { id: 'order1', amount: 99.99 },
            { id: 'order2', amount: 149.50 }
          ],
          metadata: {
            created: '2024-01-01T00:00:00Z',
            tags: ['premium', 'active']
          }
        }
      ];

      const filePath = path.join(tempDir, 'complex.json');
      fs.writeFileSync(filePath, JSON.stringify(complexData));

      const result = await scanner.scanSourceFolders([tempDir]);

      expect(result.totalFiles).toBe(1);
      expect(result.totalRecords).toBe(1);
      expect(result.errors).toHaveLength(0);
      
      // Check that nested objects were flattened
      const columns = result.columns.map(col => col.name);
      expect(columns).toContain('user_name');
      expect(columns).toContain('user_email');
      expect(columns).toContain('user_preferences_theme');
      expect(columns).toContain('orders'); // Array converted to JSON string
      expect(columns).toContain('metadata_created');
      expect(columns).toContain('metadata_tags'); // Array converted to JSON string
    });

    test('should handle mixed file types and errors gracefully', async () => {
      // Create valid JSON file
      const validData = [{ id: 1, name: 'Valid' }];
      fs.writeFileSync(path.join(tempDir, 'valid.json'), JSON.stringify(validData));

      // Create invalid JSON file
      fs.writeFileSync(path.join(tempDir, 'invalid.json'), '{ invalid json }');

      // Create non-JSON file (should be ignored)
      fs.writeFileSync(path.join(tempDir, 'text.txt'), 'This is not JSON');

      // Create empty JSON file
      fs.writeFileSync(path.join(tempDir, 'empty.json'), '');

      const result = await scanner.scanSourceFolders([tempDir]);

      expect(result.totalFiles).toBe(3); // Only JSON files counted
      expect(result.processedFiles).toBe(1); // Only valid file processed
      expect(result.totalRecords).toBe(1);
      expect(result.errors).toHaveLength(2); // Invalid and empty files
    });
  });

  describe('data population and batch insertion', () => {
    let dbManager;
    let testDbDir;

    beforeEach(async () => {
      // Create a temporary directory for test database
      testDbDir = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonscanner-db-test-'));
      dbManager = new DatabaseManager(testDbDir);
      await dbManager.initializeProjectDatabase('test-project', 'Test Project', testDbDir);
      await dbManager.createProjectSchema('test-project', 'Test Project', testDbDir);
    });

    afterEach(async () => {
      if (dbManager) {
        await dbManager.closeProjectDatabase();
      }
      if (fs.existsSync(testDbDir)) {
        fs.rmSync(testDbDir, { recursive: true, force: true });
      }
    });

    describe('createDataTable', () => {
      test('should create data table with provided columns', async () => {
        const columns = [
          { name: 'id', type: 'INTEGER' },
          { name: 'name', type: 'TEXT' },
          { name: 'score', type: 'REAL' }
        ];

        await scanner.createDataTable(dbManager, 'test-view', columns);

        const tableExists = await dbManager.dataTableExists('test-view');
        expect(tableExists).toBe(true);

        const schema = await dbManager.getDataTableSchema('test-view');
        expect(schema).toHaveLength(3);
        expect(schema.find(col => col.name === 'id')).toBeDefined();
        expect(schema.find(col => col.name === 'name')).toBeDefined();
        expect(schema.find(col => col.name === 'score')).toBeDefined();
      });

      test('should throw error for invalid parameters', async () => {
        await expect(scanner.createDataTable(null, 'test-view', [])).rejects.toThrow('DatabaseManager, viewId, and columns are required');
        await expect(scanner.createDataTable(dbManager, null, [])).rejects.toThrow('DatabaseManager, viewId, and columns are required');
        await expect(scanner.createDataTable(dbManager, 'test-view', null)).rejects.toThrow('DatabaseManager, viewId, and columns are required');
      });

      test('should throw error for disconnected database', async () => {
        await dbManager.closeProjectDatabase();
        const columns = [{ name: 'id', type: 'INTEGER' }];
        
        await expect(scanner.createDataTable(dbManager, 'test-view', columns)).rejects.toThrow('DatabaseManager must be connected before creating data table');
      });
    });

    describe('populateDataTable', () => {
      beforeEach(async () => {
        // Create a test table
        const columns = [
          { name: 'id', type: 'INTEGER' },
          { name: 'name', type: 'TEXT' },
          { name: 'age', type: 'INTEGER' }
        ];
        await scanner.createDataTable(dbManager, 'test-view', columns);
      });

      test('should populate table with records', async () => {
        const records = [
          { id: 1, name: 'John', age: 30, _source_file: 'test1.json' },
          { id: 2, name: 'Jane', age: 25, _source_file: 'test2.json' },
          { id: 3, name: 'Bob', age: 35, _source_file: 'test3.json' }
        ];

        const result = await scanner.populateDataTable(dbManager, 'test-view', records);

        expect(result.totalRecords).toBe(3);
        expect(result.insertedRecords).toBe(3);
        expect(result.batchCount).toBe(1);
        expect(result.errors).toHaveLength(0);

        // Verify data was inserted
        const data = await dbManager.executeQuery('SELECT * FROM data_view_test_view ORDER BY id');
        expect(data).toHaveLength(3);
        expect(data[0].name).toBe('John');
        expect(data[1].name).toBe('Jane');
        expect(data[2].name).toBe('Bob');
      });

      test('should handle empty records array', async () => {
        const result = await scanner.populateDataTable(dbManager, 'test-view', []);

        expect(result.totalRecords).toBe(0);
        expect(result.insertedRecords).toBe(0);
        expect(result.batchCount).toBe(0);
        expect(result.errors).toHaveLength(0);
      });

      test('should handle records with missing fields', async () => {
        const records = [
          { id: 1, name: 'John', _source_file: 'test1.json' }, // missing age
          { id: 2, age: 25, _source_file: 'test2.json' }, // missing name
          { name: 'Bob', age: 35, _source_file: 'test3.json' } // missing id
        ];

        const result = await scanner.populateDataTable(dbManager, 'test-view', records);

        expect(result.totalRecords).toBe(3);
        expect(result.insertedRecords).toBe(3);
        expect(result.errors).toHaveLength(0);

        // Verify data was inserted with null values for missing fields
        const data = await dbManager.executeQuery('SELECT * FROM data_view_test_view ORDER BY COALESCE(id, 999)');
        expect(data).toHaveLength(3);
        expect(data[0].age).toBeNull(); // John's missing age
        expect(data[1].name).toBeNull(); // Jane's missing name
        expect(data[2].id).toBeNull(); // Bob's missing id
      });

      test('should use batch processing for large datasets', async () => {
        const records = [];
        for (let i = 1; i <= 2500; i++) {
          records.push({
            id: i,
            name: `User${i}`,
            age: 20 + (i % 50),
            _source_file: `batch${Math.floor(i / 1000)}.json`
          });
        }

        const result = await scanner.populateDataTable(dbManager, 'test-view', records, {
          batchSize: 1000
        });

        expect(result.totalRecords).toBe(2500);
        expect(result.insertedRecords).toBe(2500);
        expect(result.batchCount).toBe(3); // 3 batches of 1000, 1000, 500
        expect(result.errors).toHaveLength(0);

        // Verify all data was inserted
        const count = await dbManager.executeQuery('SELECT COUNT(*) as count FROM data_view_test_view');
        expect(count[0].count).toBe(2500);
      });

      test('should report progress during batch processing', async () => {
        const records = [];
        for (let i = 1; i <= 150; i++) {
          records.push({
            id: i,
            name: `User${i}`,
            _source_file: 'test.json'
          });
        }

        const progressUpdates = [];
        const result = await scanner.populateDataTable(dbManager, 'test-view', records, {
          batchSize: 50,
          progressCallback: (progress) => {
            progressUpdates.push(progress);
          }
        });

        expect(result.totalRecords).toBe(150);
        expect(result.insertedRecords).toBe(150);
        expect(result.batchCount).toBe(3);
        expect(progressUpdates).toHaveLength(3);

        // Check progress updates
        expect(progressUpdates[0].currentBatch).toBe(1);
        expect(progressUpdates[0].totalBatches).toBe(3);
        expect(progressUpdates[0].processedRecords).toBe(50);
        expect(progressUpdates[2].currentBatch).toBe(3);
        expect(progressUpdates[2].processedRecords).toBe(150);
      });

      test('should throw error for invalid parameters', async () => {
        const records = [{ id: 1, name: 'Test' }];
        
        await expect(scanner.populateDataTable(null, 'test-view', records)).rejects.toThrow('DatabaseManager, viewId, and records are required');
        await expect(scanner.populateDataTable(dbManager, null, records)).rejects.toThrow('DatabaseManager, viewId, and records are required');
        await expect(scanner.populateDataTable(dbManager, 'test-view', null)).rejects.toThrow('DatabaseManager, viewId, and records are required');
      });

      test('should throw error for disconnected database', async () => {
        await dbManager.closeProjectDatabase();
        const records = [{ id: 1, name: 'Test' }];
        
        await expect(scanner.populateDataTable(dbManager, 'test-view', records)).rejects.toThrow('DatabaseManager must be connected before populating data table');
      });

      test('should throw error for non-existent table', async () => {
        const records = [{ id: 1, name: 'Test' }];
        
        await expect(scanner.populateDataTable(dbManager, 'non-existent-view', records)).rejects.toThrow('Data table schema is empty');
      });
    });

    describe('insertBatch', () => {
      beforeEach(async () => {
        const columns = [
          { name: 'id', type: 'INTEGER' },
          { name: 'name', type: 'TEXT' }
        ];
        await scanner.createDataTable(dbManager, 'test-view', columns);
      });

      test('should insert batch of records', async () => {
        const batch = [
          { id: 1, name: 'John', _source_file: 'test.json' },
          { id: 2, name: 'Jane', _source_file: 'test.json' }
        ];
        const columnNames = ['id', 'name'];

        const result = await scanner.insertBatch(dbManager, 'data_view_test_view', columnNames, batch);

        expect(result.insertedCount).toBe(2);
        expect(result.errors).toHaveLength(0);
      });

      test('should handle batch with errors gracefully', async () => {
        const batch = [
          { id: 1, name: 'John', _source_file: 'test.json' },
          null, // This will cause an error
          { id: 2, name: 'Jane', _source_file: 'test.json' }
        ];
        const columnNames = ['id', 'name'];

        const result = await scanner.insertBatch(dbManager, 'data_view_test_view', columnNames, batch);

        expect(result.insertedCount).toBe(2); // Two valid records
        expect(result.errors).toHaveLength(1); // One error for null record
      });
    });

    describe('scanAndPopulate', () => {
      test('should scan folders and populate table in one operation', async () => {
        // Create test JSON files
        const testData1 = [
          { id: 1, name: 'John', age: 30 },
          { id: 2, name: 'Jane', age: 25 }
        ];
        const testData2 = [
          { id: 3, name: 'Bob', score: 95.5 }
        ];

        const file1Path = path.join(tempDir, 'data1.json');
        const file2Path = path.join(tempDir, 'data2.json');
        
        fs.writeFileSync(file1Path, JSON.stringify(testData1));
        fs.writeFileSync(file2Path, JSON.stringify(testData2));

        const progressUpdates = [];
        const result = await scanner.scanAndPopulate([tempDir], dbManager, 'test-view', {
          progressCallback: (progress) => {
            progressUpdates.push(progress);
          }
        });

        expect(result.scanResults.totalFiles).toBe(2);
        expect(result.scanResults.totalRecords).toBe(3);
        expect(result.tableCreated).toBe(true);
        expect(result.populationResults.totalRecords).toBe(3);
        expect(result.populationResults.insertedRecords).toBe(3);

        // Check progress updates
        expect(progressUpdates.length).toBeGreaterThan(0);
        expect(progressUpdates.some(p => p.phase === 'scanning')).toBe(true);
        expect(progressUpdates.some(p => p.phase === 'table_creation')).toBe(true);
        expect(progressUpdates.some(p => p.phase === 'population')).toBe(true);
        expect(progressUpdates.some(p => p.phase === 'completed')).toBe(true);

        // Verify data was inserted
        const data = await dbManager.executeQuery('SELECT * FROM data_view_test_view ORDER BY id');
        expect(data).toHaveLength(3);
      });

      test('should handle empty scan results', async () => {
        const emptyDir = path.join(tempDir, 'empty');
        fs.mkdirSync(emptyDir);

        const result = await scanner.scanAndPopulate([emptyDir], dbManager, 'test-view');

        expect(result.scanResults.totalRecords).toBe(0);
        expect(result.tableCreated).toBe(false);
        expect(result.populationResults.totalRecords).toBe(0);
        expect(result.populationResults.insertedRecords).toBe(0);
      });

      test('should throw error for invalid parameters', async () => {
        await expect(scanner.scanAndPopulate(null, dbManager, 'test-view')).rejects.toThrow('Source folders, DatabaseManager, and viewId are required');
        await expect(scanner.scanAndPopulate([tempDir], null, 'test-view')).rejects.toThrow('Source folders, DatabaseManager, and viewId are required');
        await expect(scanner.scanAndPopulate([tempDir], dbManager, null)).rejects.toThrow('Source folders, DatabaseManager, and viewId are required');
      });
    });

    describe('integration with distributed databases', () => {
      test('should work with per-project database isolation', async () => {
        // Create another database manager for a different project
        const testDbDir2 = fs.mkdtempSync(path.join(os.tmpdir(), 'jsonscanner-db2-test-'));
        const dbManager2 = new DatabaseManager(testDbDir2);
        
        try {
          await dbManager2.initializeProjectDatabase('test-project-2', 'Test Project 2', testDbDir2);
          await dbManager2.createProjectSchema('test-project-2', 'Test Project 2', testDbDir2);

          // Create test data
          const testData = [{ id: 1, name: 'Test', project: 'Project1' }];
          const filePath = path.join(tempDir, 'test.json');
          fs.writeFileSync(filePath, JSON.stringify(testData));

          // Populate both databases
          await scanner.scanAndPopulate([tempDir], dbManager, 'view1');
          await scanner.scanAndPopulate([tempDir], dbManager2, 'view2');

          // Verify data isolation
          const data1 = await dbManager.executeQuery('SELECT * FROM data_view_view1');
          const data2 = await dbManager2.executeQuery('SELECT * FROM data_view_view2');

          expect(data1).toHaveLength(1);
          expect(data2).toHaveLength(1);
          expect(data1[0].name).toBe('Test');
          expect(data2[0].name).toBe('Test');

          // Verify databases are separate
          expect(dbManager.databasePath).not.toBe(dbManager2.databasePath);
        } finally {
          await dbManager2.closeProjectDatabase();
          if (fs.existsSync(testDbDir2)) {
            fs.rmSync(testDbDir2, { recursive: true, force: true });
          }
        }
      });

      test('should handle errors during population gracefully', async () => {
        // Create test data with some problematic records
        const testData = [
          { id: 1, name: 'Valid' },
          { id: 'invalid', name: 'Invalid ID' }, // This might cause issues depending on strict mode
          { id: 3, name: 'Also Valid' }
        ];
        const filePath = path.join(tempDir, 'mixed.json');
        fs.writeFileSync(filePath, JSON.stringify(testData));

        const result = await scanner.scanAndPopulate([tempDir], dbManager, 'test-view');

        expect(result.scanResults.totalRecords).toBe(3);
        expect(result.tableCreated).toBe(true);
        // Should still insert records even if some have type mismatches (SQLite is flexible)
        expect(result.populationResults.insertedRecords).toBeGreaterThan(0);
      });
    });
  });
});