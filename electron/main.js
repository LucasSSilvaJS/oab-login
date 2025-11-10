const { app, BrowserWindow, dialog, ipcMain } = require('electron');
const path = require('path');

// Senha de administrador (troque para valor seguro via variável de ambiente)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

let mainWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    fullscreen: true,
    kiosk: true,
    alwaysOnTop: true,
    minimizable: false,
    maximizable: false,
    resizable: false,
    movable: false,
    skipTaskbar: true,
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
    },
  });

  const startUrl =
    process.env.ELECTRON_START_URL || 'http://localhost:8100';
  mainWindow.loadURL(startUrl);

  // Intercepta tentativas de fechar a janela
  mainWindow.on('close', async (e) => {
    e.preventDefault();
    const elevated = await requestWindowsAdminConsent();
    if (elevated) {
      mainWindow.removeAllListeners('close');
      app.exit(0);
    }
  });

  // Mantém o foco na janela principal para evitar o usuário acessar o sistema
  mainWindow.on('blur', () => {
    if (!mainWindow.isDestroyed()) mainWindow.focus();
  });

  // Impede minimizar por atalho ou API
  mainWindow.on('minimize', (e) => {
    e.preventDefault();
    if (mainWindow.isMinimized()) {
      mainWindow.restore();
    }
    mainWindow.focus();
  });
}

// Pergunta ao renderer para abrir o popup e validar a senha; retorna booleano
function verifyWithRenderer() {
  if (!mainWindow) return Promise.resolve(false);
  return mainWindow.webContents.executeJavaScript('window.__REQUEST_ADMIN_PASSWORD__?.()');
}

// Solicita consentimento de administrador do Windows via UAC; true se aprovado
const sudo = require('sudo-prompt');
function requestWindowsAdminConsent() {
  return new Promise((resolve) => {
    // Executa um comando inofensivo apenas para acionar o UAC nativo do Windows,
    // sem abrir janela de console.
    const options = { name: 'OAB Login' };
    const command = 'powershell -NoProfile -WindowStyle Hidden -Command exit 0';
    sudo.exec(command, options, (error) => {
      resolve(!error);
    });
  });
}

app.whenReady().then(createMainWindow);

app.on('window-all-closed', () => {
  // Em Windows, manter app ativo até confirmação (não sair automaticamente)
});

// Verificação de senha feita pelo renderer via IPC
ipcMain.handle('verify-admin-password', async (_event, password) => {
  const ok = password === ADMIN_PASSWORD;
  if (!ok) {
    dialog.showErrorBox('Senha inválida', 'A senha de administrador está incorreta.');
  }
  return ok;
});

ipcMain.on('exit-app', () => app.exit(0));


