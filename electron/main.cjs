const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('node:path');
const { exec } = require('node:child_process');

const isDev = !app.isPackaged;

function createWindow() {
  const win = new BrowserWindow({
    width: 1400,
    height: 900,
    minWidth: 700,
    minHeight: 500,
    title: 'Local JSON Editor',
    webPreferences: {
      contextIsolation: true,
      nodeIntegration: false,
      preload: path.join(__dirname, 'preload.cjs'),
    },
  });

  if (isDev) {
    win.loadURL('http://localhost:5173');
  } else {
    win.loadFile(path.join(__dirname, '..', 'dist', 'index.html'));
  }
}

ipcMain.handle('curl:run', (_event, command) => {
  return new Promise((resolve) => {
    const trimmed = typeof command === 'string' ? command.trim() : '';

    if (!/^curl\b/i.test(trimmed)) {
      resolve({ ok: false, error: 'Command must start with "curl".' });
      return;
    }

    exec(
      trimmed,
      { timeout: 30_000, maxBuffer: 20 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error && error.killed) {
          resolve({ ok: false, error: 'Command timed out after 30s.' });
          return;
        }
        resolve({
          ok: true,
          exitCode: error ? (error.code ?? 1) : 0,
          stdout,
          stderr,
        });
      },
    );
  });
});

app.whenReady().then(() => {
  createWindow();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) createWindow();
  });
});

app.on('window-all-closed', () => {
  if (process.platform !== 'darwin') app.quit();
});
