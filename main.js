const { app, BrowserWindow, Menu, dialog, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');

let mainWindow;
let isQuitting = false;

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 800,
    minHeight: 600,
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    },
    icon: path.join(__dirname, 'assets', 'icon.png')
  });

  mainWindow.loadFile('index.html');

  // Handle close event with unsaved changes check
  mainWindow.on('close', async (e) => {
    if (isQuitting) return;
    
    e.preventDefault();
    
    // Ask renderer for dirty status
    mainWindow.webContents.send('check-dirty');
  });

  const menuTemplate = [
    {
      label: 'File',
      submenu: [
        {
          label: 'New',
          accelerator: 'CmdOrCtrl+N',
          click: () => mainWindow.webContents.send('menu-new')
        },
        {
          label: 'Open...',
          accelerator: 'CmdOrCtrl+O',
          click: async () => {
            const result = await dialog.showOpenDialog(mainWindow, {
              properties: ['openFile'],
              filters: [
                { name: 'Images', extensions: ['png', 'jpg', 'jpeg', 'gif', 'bmp', 'webp'] }
              ]
            });
            if (!result.canceled && result.filePaths.length > 0) {
              const filePath = result.filePaths[0];
              const imageData = fs.readFileSync(filePath);
              const base64 = imageData.toString('base64');
              const ext = path.extname(filePath).slice(1).toLowerCase();
              const mimeType = ext === 'jpg' ? 'jpeg' : ext;
              mainWindow.webContents.send('file-opened', `data:image/${mimeType};base64,${base64}`, filePath);
            }
          }
        },
        {
          label: 'Save',
          accelerator: 'CmdOrCtrl+S',
          click: () => mainWindow.webContents.send('menu-save')
        },
        {
          label: 'Save As...',
          accelerator: 'CmdOrCtrl+Shift+S',
          click: () => mainWindow.webContents.send('menu-save-as')
        },
        { type: 'separator' },
        {
          label: 'Exit',
          accelerator: 'Alt+F4',
          click: () => app.quit()
        }
      ]
    },
    {
      label: 'Edit',
      submenu: [
        {
          label: 'Undo',
          accelerator: 'CmdOrCtrl+Z',
          click: () => mainWindow.webContents.send('menu-undo')
        },
        {
          label: 'Redo',
          accelerator: 'CmdOrCtrl+Y',
          click: () => mainWindow.webContents.send('menu-redo')
        },
        { type: 'separator' },
        {
          label: 'Cut',
          accelerator: 'CmdOrCtrl+X',
          click: () => mainWindow.webContents.send('menu-cut')
        },
        {
          label: 'Copy',
          accelerator: 'CmdOrCtrl+C',
          click: () => mainWindow.webContents.send('menu-copy')
        },
        {
          label: 'Paste',
          accelerator: 'CmdOrCtrl+V',
          click: () => mainWindow.webContents.send('menu-paste')
        },
        { type: 'separator' },
        {
          label: 'Select All',
          accelerator: 'CmdOrCtrl+A',
          click: () => mainWindow.webContents.send('menu-select-all')
        },
        {
          label: 'Clear Selection',
          accelerator: 'Escape',
          click: () => mainWindow.webContents.send('menu-clear-selection')
        }
      ]
    },
    {
      label: 'Image',
      submenu: [
        {
          label: 'Resize Canvas...',
          click: () => mainWindow.webContents.send('menu-resize')
        },
        {
          label: 'Scale Image...',
          click: () => mainWindow.webContents.send('menu-scale')
        },
        {
          label: 'Crop to Selection',
          click: () => mainWindow.webContents.send('menu-crop')
        },
        { type: 'separator' },
        {
          label: 'Flip Horizontal',
          click: () => mainWindow.webContents.send('menu-flip-horizontal')
        },
        {
          label: 'Flip Vertical',
          click: () => mainWindow.webContents.send('menu-flip-vertical')
        },
        { type: 'separator' },
        {
          label: 'Rotate 90° Clockwise',
          click: () => mainWindow.webContents.send('menu-rotate-cw')
        },
        {
          label: 'Rotate 90° Counter-Clockwise',
          click: () => mainWindow.webContents.send('menu-rotate-ccw')
        }
      ]
    },
    {
      label: 'View',
      submenu: [
        {
          label: 'Zoom In',
          accelerator: 'CmdOrCtrl+Plus',
          click: () => mainWindow.webContents.send('menu-zoom-in')
        },
        {
          label: 'Zoom Out',
          accelerator: 'CmdOrCtrl+-',
          click: () => mainWindow.webContents.send('menu-zoom-out')
        },
        {
          label: 'Reset Zoom',
          accelerator: 'CmdOrCtrl+0',
          click: () => mainWindow.webContents.send('menu-zoom-reset')
        },
        { type: 'separator' },
        {
          label: 'Toggle Grid',
          click: () => mainWindow.webContents.send('menu-toggle-grid')
        }
      ]
    },
    {
      label: 'Help',
      submenu: [
        {
          label: 'About',
          click: () => {
            dialog.showMessageBox(mainWindow, {
              type: 'info',
              title: 'About Simba Paint',
              message: 'Simba Paint v1.0.0',
              detail: 'A Paint-like image viewer and editor built with Electron.'
            });
          }
        },
        {
          label: 'Toggle Developer Tools',
          accelerator: 'F12',
          click: () => mainWindow.webContents.toggleDevTools()
        }
      ]
    }
  ];

  const menu = Menu.buildFromTemplate(menuTemplate);
  Menu.setApplicationMenu(menu);
}

app.whenReady().then(createWindow);

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

ipcMain.handle('save-file', async (event, { dataUrl, filePath }) => {
  try {
    let savePath = filePath;
    if (!savePath) {
      const result = await dialog.showSaveDialog(mainWindow, {
        filters: [
          { name: 'PNG Image', extensions: ['png'] },
          { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
          { name: 'BMP Image', extensions: ['bmp'] }
        ]
      });
      if (result.canceled) return { success: false };
      savePath = result.filePath;
    }

    const base64Data = dataUrl.replace(/^data:image\/\w+;base64,/, '');
    const buffer = Buffer.from(base64Data, 'base64');
    fs.writeFileSync(savePath, buffer);
    return { success: true, filePath: savePath };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

// Handle dirty status response from renderer
ipcMain.on('dirty-status', async (event, isDirty) => {
  if (!isDirty) {
    // No unsaved changes, close immediately
    isQuitting = true;
    mainWindow.close();
    return;
  }
  
  // Show save dialog
  const result = await dialog.showMessageBox(mainWindow, {
    type: 'question',
    buttons: ['Save', 'Don\'t Save', 'Cancel'],
    defaultId: 0,
    cancelId: 2,
    title: 'Unsaved Changes',
    message: 'Do you want to save changes before closing?',
    detail: 'Your changes will be lost if you don\'t save them.'
  });
  
  if (result.response === 0) {
    // Save - trigger save and wait for completion via 'save-complete' message
    mainWindow.webContents.send('save-and-close');
  } else if (result.response === 1) {
    // Don't Save - close without saving
    isQuitting = true;
    mainWindow.close();
  }
  // Cancel (response === 2) - do nothing, stay open
});

// Handle save completion from renderer
ipcMain.on('save-complete', (event, success) => {
  // Close regardless of save success (user already chose to save)
  isQuitting = true;
  mainWindow.close();
});

ipcMain.handle('show-save-dialog', async () => {
  const result = await dialog.showSaveDialog(mainWindow, {
    filters: [
      { name: 'PNG Image', extensions: ['png'] },
      { name: 'JPEG Image', extensions: ['jpg', 'jpeg'] },
      { name: 'BMP Image', extensions: ['bmp'] }
    ]
  });
  return result;
});
