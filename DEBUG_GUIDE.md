# Debugging the Main Process in Electron

This guide explains how to debug the main process (backend) of your Electron application.

## Setup (Already Completed)

1. A debug script has been added to your `package.json`:
   ```json
   "dev:debug": "concurrently \"npm run build:main:watch\" \"npm run dev:renderer\" \"electron --inspect=9229 . --dev\""
   ```

2. VSCode launch configurations have been added in `.vscode/launch.json`:
   ```json
   {
     "version": "0.2.0",
     "configurations": [
       {
         "name": "Debug Main Process",
         "type": "node",
         "request": "attach",
         "port": 9229,
         "skipFiles": [
           "<node_internals>/**"
         ],
         "outFiles": [
           "${workspaceFolder}/dist/**/*.js"
         ],
         "sourceMaps": true,
         "timeout": 30000,
         "restart": true
       },
       {
         "name": "Debug Main Process (with Break)",
         "type": "node",
         "request": "launch",
         "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron",
         "windows": {
           "runtimeExecutable": "${workspaceFolder}/node_modules/.bin/electron.cmd"
         },
         "args": [".", "--dev"],
         "outputCapture": "std",
         "sourceMaps": true,
         "outFiles": [
           "${workspaceFolder}/dist/**/*.js"
         ],
         "skipFiles": [
           "<node_internals>/**"
         ]
       }
     ]
   }
   ```

## How to Debug the Main Process

### Method 1: Attach to Running Process

1. Start your application in debug mode:
   ```bash
   npm run dev:debug
   ```

2. In VSCode, go to the "Run and Debug" view (Ctrl+Shift+D or Cmd+Shift+D on Mac)

3. Select "Debug Main Process" from the dropdown menu

4. Click the green play button or press F5 to attach the debugger

5. Now you can:
   - Set breakpoints in your main process files (e.g., `src/main/ProjectManager.ts`)
   - Inspect variables
   - Use the debug console
   - Step through code

### Method 2: Launch with Debugger (Breaks on Start)

1. In VSCode, go to the "Run and Debug" view

2. Select "Debug Main Process (with Break)" from the dropdown menu

3. Click the green play button or press F5 to launch the application with the debugger attached

4. The application will start and the debugger will be attached from the beginning

### Method 3: Debug Directly in Electron DevTools

Yes, you can debug the main process directly from the Electron app's DevTools:

1. Modify your main.ts file to enable remote debugging for the main process:

   ```typescript
   // Add this near the top of main.ts
   app.commandLine.appendSwitch('remote-debugging-port', '9222');
   ```

2. Start your application with the debug flag:
   ```bash
   npm run dev:debug
   ```

3. In your Electron app, open the DevTools for the renderer process (Ctrl+Shift+I or Cmd+Option+I on Mac)

4. In the DevTools window, click on the three dots menu (⋮) in the top right corner

5. Select "More tools" > "Remote devices"

6. In the Remote Devices tab, enable "Discover network targets" and click "Configure..."

7. Add "localhost:9222" to the list of targets and click "Done"

8. You should now see "Electron Main Process" in the list of remote targets

9. Click "inspect" to open a new DevTools window connected to the main process

10. You can now debug the main process directly from this DevTools window

## Debugging Tips

### Setting Breakpoints

1. Open any main process file (e.g., `src/main/ProjectManager.ts`)
2. Click in the gutter (the space to the left of the line numbers) to set a breakpoint
3. When execution reaches that line, the debugger will pause

### Using Console Logs

You can add `console.log()` statements in your main process code:

```typescript
console.log('Debug info:', someVariable);
```

These logs will appear in:
- The VSCode Debug Console when running with the debugger
- The Electron main process console (which you can see in the terminal where you ran the app)

### Inspecting IPC Communication

To debug IPC communication between the main and renderer processes:

1. Add logs before sending IPC messages:
   ```typescript
   console.log('Sending IPC message:', data);
   ipcMain.send('channel-name', data);
   ```

2. Add logs in IPC handlers:
   ```typescript
   ipcMain.on('channel-name', (event, data) => {
     console.log('Received IPC message:', data);
     // Handler code
   });
   ```

### Using the Chrome DevTools for the Main Process

When running with `--inspect`, you can also connect Chrome DevTools:

1. Open Chrome
2. Navigate to `chrome://inspect`
3. Click on "Open dedicated DevTools for Node"
4. In the Connection tab, make sure the target port (9229) is in the list
5. You should see your Electron main process in the Devices > Remote Target section
6. Click "inspect" to open DevTools connected to your main process

## Debugging Specific Components

### ProjectManager

To debug the `ProjectManager` class:

1. Open `src/main/ProjectManager.ts`
2. Set breakpoints in methods you want to debug (e.g., `createProject`, `getProjects`)
3. Trigger these methods by performing the corresponding actions in the UI

### DatabaseManager

To debug database operations:

1. Open `src/main/DatabaseManager.ts`
2. Set breakpoints in database methods
3. Watch SQL queries and results during execution

### IPC Communication

To debug IPC communication:

1. Open `main.ts`
2. Find the IPC handlers (look for `ipcMain.on(...)` calls)
3. Set breakpoints inside these handlers
4. Trigger the corresponding actions from the renderer

## Troubleshooting

### Debugger Not Connecting

If the debugger doesn't connect:

1. Make sure you're running the app with `npm run dev:debug`
2. Check that port 9229 is not being used by another process
3. Try restarting VSCode
4. Check the terminal for any error messages

### Breakpoints Not Hitting

If breakpoints are not being hit:

1. Make sure source maps are working correctly
2. Check that you're setting breakpoints in the correct files
3. Verify that the code you're trying to debug is actually being executed
4. Try setting a breakpoint in a location you're certain will be executed (e.g., app startup code)

### TypeScript Files Not Matching Compiled JavaScript

If you're having issues with source maps:

1. Make sure your TypeScript files are being compiled correctly
2. Check that source maps are being generated
3. Try rebuilding the project with `npm run build`
