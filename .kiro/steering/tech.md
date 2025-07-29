# Technology Stack

## Core Technologies
- **Electron**: v28.0.0 - Desktop application framework
- **Node.js**: CommonJS modules for main process
- **HTML5/CSS3**: Frontend rendering
- **JavaScript**: ES5/CommonJS syntax

## Build System
- **electron-builder**: v24.9.1 - Application packaging and distribution
- **npm**: Package management and script execution

## Common Commands

### Development
```bash
npm start          # Launch app in development mode
npm run dev        # Launch app with --dev flag
```

### Building & Distribution
```bash
npm run build      # Build for all configured platforms
npm run build:mac  # Build macOS installer (DMG)
npm run build:app  # Build macOS app bundle only
npm run dist       # Build without publishing
```

## Architecture Notes
- Uses `nodeIntegration: true` and `contextIsolation: false` (legacy security model)
- Single HTML file with inline CSS
- No frontend framework - vanilla HTML/CSS/JS
- CommonJS module system in main process