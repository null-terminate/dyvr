# Project Structure

## Root Directory Layout
```
├── main.ts              # Electron main process entry point
├── main.d.ts           # TypeScript declaration file for main.ts
├── tsconfig.json       # TypeScript configuration
├── webpack.config.js   # Webpack configuration
├── package.json        # Project configuration and dependencies
├── package-lock.json   # Dependency lock file
├── README.md           # Project documentation
├── build/              # Build output directory (generated)
├── node_modules/       # Dependencies (generated)
├── src/                # Source code directory
│   ├── preload.ts      # Preload script for Electron
│   ├── assets/         # Application assets (images, icons)
│   ├── main/           # Main process TypeScript files
│   │   ├── DatabaseManager.ts    # SQLite database operations
│   │   ├── DigrConfigManager.ts  # Global configuration management
│   │   ├── JSONScanner.ts        # JSON file scanning and parsing
│   │   ├── ProjectManager.ts     # Project management operations
│   │   └── ViewManager.ts        # View management operations
│   ├── renderer/       # Renderer process TypeScript files
│   │   ├── index.html  # HTML template for renderer
│   │   ├── index.tsx   # React entry point
│   │   ├── components/ # React components
│   │   ├── context/    # React context providers
│   │   ├── pages/      # React page components
│   │   ├── styles/     # CSS styles
│   │   └── types/      # TypeScript type definitions
│   └── types/          # Shared TypeScript type definitions
├── tests/              # Test files
├── .kiro/              # Kiro AI assistant configuration
└── .vscode/            # VS Code workspace settings
```

## File Conventions

### Main Process
- **main.ts**: Entry point for Electron main process
  - Window creation and lifecycle management
  - App event handling (ready, window-all-closed, activate)
  - IPC event handlers setup
  - Uses TypeScript with ES modules

### Renderer Process
- **src/renderer/index.tsx**: React entry point
  - React component rendering
  - React Router setup
  - Context providers initialization
- **src/renderer/index.html**: HTML template
  - React root element
  - External CSS stylesheet links
  - Meta tags and viewport configuration

### React Components
- **src/renderer/components/**: Reusable UI components
  - Functional components with TypeScript interfaces
  - Props typing with TypeScript interfaces
  - React hooks for state management
- **src/renderer/pages/**: Page-level components
  - Route-specific components
  - Business logic and data fetching
  - IPC communication with main process

### TypeScript Types
- **src/renderer/types/**: Renderer-specific type definitions
  - Interface definitions for component props
  - Type definitions for IPC communication
- **src/types/**: Shared type definitions
  - Type definitions for shared data models
  - Type declarations for non-TypeScript modules

### Configuration
- **tsconfig.json**: TypeScript compiler configuration
  - Strict type checking enabled
  - ES module output
  - Source map generation
- **webpack.config.js**: Webpack bundling configuration
  - Main and renderer process bundling
  - Development and production modes
  - Asset handling and optimization
- **package.json**: Project configuration
  - Build scripts for development and distribution
  - Dependencies and dev dependencies
  - Electron-builder configuration

## Development Patterns
- TypeScript for type safety throughout the application
- React functional components with hooks for UI
- Main process modules for core functionality
- IPC communication between main and renderer processes
- SQLite for local data storage with per-project databases
- CSS modules for component-scoped styling
- React Router for navigation
- Context API for state management
