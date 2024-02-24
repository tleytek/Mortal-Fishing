const { app, BrowserWindow, nativeTheme, ipcMain } = require('electron');
const path = require('path');
import { Fishing } from "./fishing.js";
import { createWindow } from "./window.js";
// const appWindow = require(path.join(__dirname, "./window.js"))
// Handle creating/removing shortcuts on Windows when installing/uninstalling.
if (require('electron-squirrel-startup')) {
  app.quit();
}

nativeTheme.themeSource = 'dark';

// This method will be called when Electron has finished
// initialization and is ready to create browser windows.
// Some APIs can only be used after this event occurs.
app.on('ready', createWindow);

// Quit when all windows are closed, except on macOS. There, it's common
// for applications and their menu bar to stay active until the user quits
// explicitly with Cmd + Q.
app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('activate', () => {
  // On OS X it's common to re-create a window in the app when the
  // dock icon is clicked and there are no other windows open.
  if (BrowserWindow.getAllWindows().length === 0) {
    createWindow();
  }
});

// In this file you can include the rest of your app's specific main process
// code. You can also put them in separate files and import them here

const fishing = new Fishing();

fishing.start();

ipcMain.on("set-hook", (_event, hook) => {
  fishing.hook = hook;
});

ipcMain.on("set-bait", (_event, bait) => {
  fishing.bait = bait;
});

ipcMain.on("set-record", (_event, record) => {
  fishing.record = record;
})

// After we send the caught fish, the FE gives us the time, and then we store all the data
ipcMain.on("catch-time", (_event, times) => {
  fishing.castHour = times.castHour;
  fishing.castMinute = times.castMinute;
  fishing.catchHour = times.catchHour;
  fishing.catchMinute = times.catchMinute;

  fishing.record && fishing.storeCatch();

  fishing.reset();
})