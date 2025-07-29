/**
 * Jest setup file for DOM testing
 */

// Mock Electron APIs that might be used in renderer process
Object.defineProperty(window, 'require', {
  value: jest.fn(),
  writable: true
});

// Mock common DOM APIs that might not be fully implemented in jsdom
Object.defineProperty(window, 'getComputedStyle', {
  value: () => ({
    getPropertyValue: () => '',
  }),
});

// Mock scrollTo method
Object.defineProperty(window, 'scrollTo', {
  value: jest.fn(),
  writable: true
});

// Mock ResizeObserver
global.ResizeObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Mock IntersectionObserver
global.IntersectionObserver = jest.fn().mockImplementation(() => ({
  observe: jest.fn(),
  unobserve: jest.fn(),
  disconnect: jest.fn(),
}));

// Ensure document.body exists
beforeEach(() => {
  document.body.innerHTML = '';
});