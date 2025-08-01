import { JSONScanner } from '../src/main/JSONScanner';
import { DatabaseManager } from '../src/main/DatabaseManager';
import { ScanColumn, ScanResults } from '../src/types';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

describe('JSONScanner', () => {
  let scanner: JSONScanner;
  let tempDir: string;

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
      expect(scanner.getLastScanResults()).toBeNull();
      expect(scanner.getErrors()).toEqual([]);
    });
  });

  describe('scanSourceFolders', () => {
    test('should throw error for invalid source folders parameter', async () => {
      await expect(scanner.scanSourceFolders(undefined as any)).rejects.toThrow('Source folders array is required and must not be empty');
      await expect(scanner.scanSourceFolders(null as any)).rejects.toThrow('Source folders array is required and must not be empty');
      await expect(scanner.scanSourceFolders([])).rejects.toThrow('Source folders array is required and must not be empty');
      await expect(scanner.scanSourceFolders('not-an-array' as any)).rejects.toThrow('Source folders array is required and must not be empty');
    });

    test('should handle non-existent source folders gracefully', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent');
      const sourceFolder = { id: 'test-id', path: nonExistentPath, addedDate: new Date() };
      const result = await scanner.scanSourceFolders([sourceFolder]);

      expect(result.totalFiles).toBe(0);
      expect(result.processedFiles).toBe(0);
      expect(result.totalRecords).toBe(0);
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]?.file).toBe(nonExistentPath);
      expect(result.errors[0]?.error).toBe('Source folder does not exist');
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

      const sourceFolder = { id: 'test-id', path: tempDir, addedDate: new Date() };
      const result = await scanner.scanSourceFolders([sourceFolder]);

      expect(result.totalFiles).toBe(2);
      expect(result.processedFiles).toBe(2);
      expect(result.totalRecords).toBe(3);
      expect(result.errors).toHaveLength(0);
      expect(result.columns).toBeDefined();
      expect(result.totalRecords).toBe(3);
    });

    test('should handle nested directories', async () => {
      // Create nested directory structure
      const subDir = path.join(tempDir, 'subdir');
      fs.mkdirSync(subDir);

      const testData = [{ id: 1, name: 'Test' }];
      const filePath = path.join(subDir, 'nested.json');
      fs.writeFileSync(filePath, JSON.stringify(testData));

      const sourceFolder = { id: 'test-id', path: tempDir, addedDate: new Date() };
      const result = await scanner.scanSourceFolders([sourceFolder]);

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

      const sourceFolder = { id: 'test-id', path: tempDir, addedDate: new Date() };
      const result = await scanner.scanSourceFolders([sourceFolder]);

      expect(result.totalFiles).toBe(0);
      expect(result.totalRecords).toBe(0);
    });
  });

  describe('parseFile', () => {
    test('should parse valid JSON array', async () => {
      const testData = [{ id: 1, name: 'Test' }];
      const filePath = path.join(tempDir, 'test.json');
      fs.writeFileSync(filePath, JSON.stringify(testData));

      const result = await scanner.parseFile(filePath);

      expect(result).toEqual(testData);
    });

    test('should wrap single object in array', async () => {
      const testData = { id: 1, name: 'Test' };
      const filePath = path.join(tempDir, 'test.json');
      fs.writeFileSync(filePath, JSON.stringify(testData));

      const result = await scanner.parseFile(filePath);

      expect(result).toEqual([testData]);
    });

    test('should throw error for non-existent file', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent.json');
      
      await expect(scanner.parseFile(nonExistentPath)).rejects.toThrow('File does not exist');
    });

    test('should throw error for empty file', async () => {
      const filePath = path.join(tempDir, 'empty.json');
      fs.writeFileSync(filePath, '');

      await expect(scanner.parseFile(filePath)).rejects.toThrow('File is empty');
    });

    test('should throw error for invalid JSON', async () => {
      const filePath = path.join(tempDir, 'invalid.json');
      fs.writeFileSync(filePath, '{ invalid json }');

      await expect(scanner.parseFile(filePath)).rejects.toThrow('Invalid JSON format');
    });

    test('should throw error for non-object JSON content', async () => {
      const filePath = path.join(tempDir, 'primitive.json');
      fs.writeFileSync(filePath, '"just a string"');

      await expect(scanner.parseFile(filePath)).rejects.toThrow('JSON content must be an object or array of objects');
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

      const result = await scanner.parseFile(filePath);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, name: 'Valid' });
      expect(result[1]).toEqual({ id: 2, name: 'Also Valid' });
    });

    test('should throw error for unsupported file extension', async () => {
      const filePath = path.join(tempDir, 'test.txt');
      fs.writeFileSync(filePath, 'Not a JSON or JSONL file');

      await expect(scanner.parseFile(filePath)).rejects.toThrow('Unsupported file extension: .txt');
    });
  });

  describe('JSONL file handling', () => {
    test('should parse valid JSONL file', async () => {
      // Create a JSONL file with one object per line
      const lines = [
        JSON.stringify({ id: 1, name: 'John' }),
        JSON.stringify({ id: 2, name: 'Jane' }),
        JSON.stringify({ id: 3, name: 'Bob' })
      ];
      const filePath = path.join(tempDir, 'test.jsonl');
      fs.writeFileSync(filePath, lines.join('\n'));

      const result = await scanner.parseFile(filePath);

      expect(result).toHaveLength(3);
      expect(result[0]).toEqual({ id: 1, name: 'John' });
      expect(result[1]).toEqual({ id: 2, name: 'Jane' });
      expect(result[2]).toEqual({ id: 3, name: 'Bob' });
    });

    test('should skip invalid lines in JSONL file', async () => {
      // Create a JSONL file with some invalid lines
      const lines = [
        JSON.stringify({ id: 1, name: 'John' }),
        'invalid json',
        JSON.stringify({ id: 3, name: 'Bob' })
      ];
      const filePath = path.join(tempDir, 'test.jsonl');
      fs.writeFileSync(filePath, lines.join('\n'));

      const result = await scanner.parseFile(filePath);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, name: 'John' });
      expect(result[1]).toEqual({ id: 3, name: 'Bob' });
    });

    test('should handle empty lines in JSONL file', async () => {
      // Create a JSONL file with empty lines
      const lines = [
        JSON.stringify({ id: 1, name: 'John' }),
        '',
        JSON.stringify({ id: 3, name: 'Bob' })
      ];
      const filePath = path.join(tempDir, 'test.jsonl');
      fs.writeFileSync(filePath, lines.join('\n'));

      const result = await scanner.parseFile(filePath);

      expect(result).toHaveLength(2);
      expect(result[0]).toEqual({ id: 1, name: 'John' });
      expect(result[1]).toEqual({ id: 3, name: 'Bob' });
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

      // Use a private method accessor for testing
      const result = (scanner as any).flattenObject(nested);

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

      const result = (scanner as any).flattenObject(obj);

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

      const result = (scanner as any).flattenObject(obj);

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

      const result = (scanner as any).flattenObject(deepNested, '', 1);

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
      expect(idColumn?.type).toBe('INTEGER');
      expect(idColumn?.nullable).toBe(false);

      const nameColumn = result.find(col => col.name === 'name');
      expect(nameColumn?.type).toBe('TEXT');
      expect(nameColumn?.nullable).toBe(false);

      const ageColumn = result.find(col => col.name === 'age');
      expect(ageColumn?.type).toBe('INTEGER');
      expect(ageColumn?.nullable).toBe(true); // Bob doesn't have age

      const scoreColumn = result.find(col => col.name === 'score');
      expect(scoreColumn?.type).toBe('REAL');
      expect(scoreColumn?.nullable).toBe(true); // Only Bob has score
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
      expect((scanner as any).inferDataType(null)).toBe('null');
      expect((scanner as any).inferDataType(undefined)).toBe('null');
      expect((scanner as any).inferDataType(true)).toBe('boolean');
      expect((scanner as any).inferDataType(false)).toBe('boolean');
      expect((scanner as any).inferDataType(42)).toBe('integer');
      expect((scanner as any).inferDataType(3.14)).toBe('real');
      expect((scanner as any).inferDataType('hello')).toBe('text');
      expect((scanner as any).inferDataType('123')).toBe('integer_string');
      expect((scanner as any).inferDataType('3.14')).toBe('real_string');
      expect((scanner as any).inferDataType('true')).toBe('boolean_string');
      expect((scanner as any).inferDataType('false')).toBe('boolean_string');
    });
  });

  describe('determineSQLType', () => {
    test('should determine correct SQL types', () => {
      expect((scanner as any).determineSQLType(new Set(['integer']))).toBe('INTEGER');
      expect((scanner as any).determineSQLType(new Set(['integer', 'integer_string']))).toBe('INTEGER');
      expect((scanner as any).determineSQLType(new Set(['real']))).toBe('REAL');
      expect((scanner as any).determineSQLType(new Set(['integer', 'real']))).toBe('REAL');
      expect((scanner as any).determineSQLType(new Set(['boolean']))).toBe('INTEGER');
      expect((scanner as any).determineSQLType(new Set(['text']))).toBe('TEXT');
      expect((scanner as any).determineSQLType(new Set(['integer', 'text']))).toBe('TEXT');
      expect((scanner as any).determineSQLType(new Set(['null']))).toBe('TEXT');
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
      expect(scanner.getUniqueColumns(null as any)).toEqual([]);
    });
  });

  describe('utility methods', () => {
    test('getLastScanResults should return scan results', async () => {
      expect(scanner.getLastScanResults()).toBeNull();

      // Create a test file and scan
      const testData = [{ id: 1, name: 'Test' }];
      const filePath = path.join(tempDir, 'test.json');
      fs.writeFileSync(filePath, JSON.stringify(testData));

      const sourceFolder = { id: 'test-id', path: tempDir, addedDate: new Date() };
      await scanner.scanSourceFolders([sourceFolder]);
      const results = scanner.getLastScanResults();

      expect(results).toBeDefined();
      expect(results?.totalFiles).toBe(1);
    });

    test('clearResults should clear scan results and errors', async () => {
      // Create a test file and scan
      const testData = [{ id: 1, name: 'Test' }];
      const filePath = path.join(tempDir, 'test.json');
      fs.writeFileSync(filePath, JSON.stringify(testData));

      const sourceFolder = { id: 'test-id', path: tempDir, addedDate: new Date() };
      await scanner.scanSourceFolders([sourceFolder]);
      expect(scanner.getLastScanResults()).toBeDefined();

      scanner.clearResults();
      expect(scanner.getLastScanResults()).toBeNull();
      expect(scanner.getErrors()).toEqual([]);
    });

    test('getErrors should return errors', async () => {
      const nonExistentPath = path.join(tempDir, 'non-existent');
      const sourceFolder = { id: 'test-id', path: nonExistentPath, addedDate: new Date() };
      await scanner.scanSourceFolders([sourceFolder]);

      const errors = scanner.getErrors();
      expect(errors).toHaveLength(1);
      expect(errors[0]?.file).toBe(nonExistentPath);
    });

    test('hasErrors should return true when there are errors', async () => {
      expect(scanner.hasErrors()).toBe(false);

      const nonExistentPath = path.join(tempDir, 'non-existent');
      const sourceFolder = { id: 'test-id', path: nonExistentPath, addedDate: new Date() };
      await scanner.scanSourceFolders([sourceFolder]);

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

      const sourceFolder = { id: 'test-id', path: tempDir, addedDate: new Date() };
      const result = await scanner.scanSourceFolders([sourceFolder]);

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

      const sourceFolder = { id: 'test-id', path: tempDir, addedDate: new Date() };
      const result = await scanner.scanSourceFolders([sourceFolder]);

      expect(result.totalFiles).toBe(3); // Only JSON files counted
      expect(result.processedFiles).toBe(1); // Only valid file processed
      expect(result.totalRecords).toBe(1);
      expect(result.errors).toHaveLength(2); // Invalid and empty files
    });
  });
});
