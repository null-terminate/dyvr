# Project Structure

## Root Directory Layout
```
├── main.js              # Electron main process entry point
├── index.html           # Application UI (renderer process)
├── package.json         # Project configuration and dependencies
├── package-lock.json    # Dependency lock file
├── dist/               # Build output directory (generated)
├── node_modules/       # Dependencies (generated)
├── .kiro/              # Kiro AI assistant configuration
└── .vscode/            # VS Code workspace settings
```

## File Conventions

### Main Process
- **main.js**: Entry point for Electron main process
  - Window creation and lifecycle management
  - App event handling (ready, window-all-closed, activate)
  - Uses CommonJS require() syntax

### Renderer Process
- **index.html**: Single-page application UI
  - Inline CSS for styling (no external stylesheets)
  - Minimal HTML structure with semantic containers
  - System font stack for native appearance

### Configuration
- **package.json**: Contains electron-builder configuration
  - Build scripts for development and distribution
  - macOS-specific DMG packaging settings
  - App metadata (name, version, description)

## Development Patterns
- Keep UI simple with inline styles for small projects
- Use semantic HTML structure with meaningful class names
- Follow Electron's main/renderer process separation
- Build artifacts go to `dist/` directory