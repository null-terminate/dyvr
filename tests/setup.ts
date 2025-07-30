/**
 * Common test setup file for abstracting away the actual ~/.digr/digr.config usage
 * This file provides utility functions for creating temporary config paths for tests
 */

import * as path from 'path';
import * as os from 'os';
import * as fs from 'fs';

/**
 * Creates a temporary directory for test files
 * @returns Path to the temporary directory
 */
export function createTempTestDir(): string {
  return fs.mkdtempSync(path.join(os.tmpdir(), 'digr-test-'));
}

/**
 * Creates a temporary config file path for tests
 * @param testDir Optional test directory to use (will create one if not provided)
 * @returns Path to the temporary config file
 */
export function createTempConfigPath(testDir?: string): string {
  const dir = testDir || createTempTestDir();
  return path.join(dir, 'digr-test-config.json');
}

/**
 * Cleans up a temporary test directory
 * @param testDir Path to the temporary directory to clean up
 */
export function cleanupTempDir(testDir: string): void {
  if (fs.existsSync(testDir)) {
    fs.rmSync(testDir, { recursive: true, force: true });
  }
}
