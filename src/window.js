const { BrowserWindow, ipcMain } = require("electron");

const path = require("path");

let mainWindow;

export function createWindow() {
  // Create the browser window.
  mainWindow = new BrowserWindow({
    width: 550,
    height: 600,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
    autoHideMenuBar: true,
    alwaysOnTop: false,
  });

  // and load the index.html of the app.
  if (MAIN_WINDOW_VITE_DEV_SERVER_URL) {
    mainWindow.loadURL(MAIN_WINDOW_VITE_DEV_SERVER_URL);
  } else {
    mainWindow.loadFile(path.join(__dirname, `../renderer/${MAIN_WINDOW_VITE_NAME}/index.html`));
  }
  
  // Open the DevTools.
  // mainWindow.webContents.openDevTools();

  ipcMain.on("set-window", (_event, alwaysOnTopState) => {
    mainWindow.setAlwaysOnTop(alwaysOnTopState, 'screen');
  })

  return mainWindow;
}

export function getWindow() {
  return mainWindow; 
}

// module.exports = { createWindow, getWindow }