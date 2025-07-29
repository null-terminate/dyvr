# Project Manager

A desktop application built with Electron and React for managing projects with source data folders.

## Features

- Create and manage projects
- Add source folders to projects
- Create views for data visualization
- Scan JSON data from source folders
- Query and filter data

## Tech Stack

- **Electron**: Cross-platform desktop application framework
- **React**: UI library for building user interfaces
- **TypeScript**: Type-safe JavaScript
- **React Router**: Navigation for React applications
- **SQLite**: Local database for storing project data
- **Webpack**: Module bundler for the renderer process

## Project Structure

```
project-manager/
├── dist/                  # Compiled output
├── src/
│   ├── main/              # Electron main process code
│   │   ├── DatabaseManager.ts
│   │   ├── DataPersistence.ts
│   │   ├── JSONScanner.ts
│   │   ├── ProjectManager.ts
│   │   └── ViewManager.ts
│   ├── renderer/          # React renderer process code
│   │   ├── components/    # React components
│   │   ├── context/       # React context providers
│   │   ├── pages/         # React pages
│   │   ├── styles/        # CSS styles
│   │   ├── types/         # TypeScript type definitions
│   │   ├── index.html     # HTML template
│   │   └── index.tsx      # React entry point
│   ├── types/             # Shared type definitions
│   └── preload.ts         # Preload script for IPC communication
├── tests/                 # Test files
├── main.ts                # Electron main process entry point
├── package.json           # Project dependencies and scripts
├── tsconfig.json          # TypeScript configuration
└── webpack.config.js      # Webpack configuration
```

## Development

### Prerequisites

- Node.js (v18 or higher)
- npm (v9 or higher)

### Installation

```bash
# Clone the repository
git clone https://github.com/yourusername/project-manager.git
cd project-manager

# Install dependencies
npm install
```

### Development Scripts

```bash
# Build the application
npm run build

# Run the application
npm start

# Development mode with hot reloading
npm run dev

# Run webpack dev server for renderer only
npm run dev:renderer

# Run tests
npm test

# Watch mode for tests
npm run test:watch

# Clean build output
npm run clean
```

### Building for Production

```bash
# Build for production
npm run package

# Build for macOS
npm run package:mac

# Build directory only (for testing)
npm run package:dir

# Create distribution packages
npm run dist
```

## IPC Communication

The application uses Electron's IPC (Inter-Process Communication) system to communicate between the main process and the renderer process. The preload script exposes a safe API to the renderer process, which is then used by the React components.

## License

MIT
