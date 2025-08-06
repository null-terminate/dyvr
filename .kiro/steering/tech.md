# Technology Stack

## Core Technologies
- **Electron**: v28.0.0 - Desktop application framework
- **TypeScript**: v5.0.0+ - Strongly typed JavaScript superset
- **React**: v18.0.0+ - UI library for component-based development
- **SQLite**: v3.0.0+ - Embedded database for local data storage
- **Node.js**: ES modules for main process with TypeScript

## Frontend Technologies
- **React Router**: v6.0.0+ - Client-side routing
- **CSS Modules**: Component-scoped styling
- **React Context API**: State management
- **TypeScript Interfaces**: Type definitions for components and data

## Backend Technologies
- **SQLite3**: Database for JSON data storage
- **Electron IPC**: Inter-process communication
- **File System API**: JSON file scanning and processing

## Build System
- **TypeScript Compiler**: Type checking and transpilation
- **Webpack**: Module bundling and asset processing
- **electron-builder**: Application packaging and distribution
- **npm**: Package management and script execution

## Common Commands

### Development
```bash
npm start          # Launch app in development mode
npm run dev        # Launch app with hot reloading
npm run build      # Build the application
npm run test       # Run tests
```

### Building & Distribution
```bash
npm run build      # Build for all configured platforms
npm run build:mac  # Build macOS installer
npm run build:win  # Build Windows installer
npm run build:linux # Build Linux package
npm run dist       # Build without publishing
```

## Architecture Notes
- TypeScript with strict type checking throughout the application
- React functional components with hooks for UI development
- Main process modules for core functionality (database, file system)
- IPC communication between main and renderer processes
- SQLite for local data storage with per-project databases
- Context API for state management in renderer process
- CSS modules for component-scoped styling
- React Router for navigation between screens
