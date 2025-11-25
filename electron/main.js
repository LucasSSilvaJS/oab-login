const { app, BrowserWindow, dialog, ipcMain, Tray, Menu, nativeImage } = require('electron');
const path = require('path');
const AutoLaunch = require('electron-auto-launch');

// Senha de administrador (troque para valor seguro via variável de ambiente)
const ADMIN_PASSWORD = process.env.ADMIN_PASSWORD || 'admin123';

let mainWindow;
let sessionWindow;
let tray;
let autoLauncher;

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
    if (mainWindow && !mainWindow.isDestroyed()) mainWindow.focus();
  });

  // Impede minimizar por atalho ou API
  mainWindow.on('minimize', (e) => {
    try {
      e.preventDefault();
      if (mainWindow && !mainWindow.isDestroyed()) {
        if (mainWindow.isMinimized()) {
          mainWindow.restore();
        }
        mainWindow.focus();
      }
    } catch (_) {}
  });
}

function createSessionWindow() {
  sessionWindow = new BrowserWindow({
    width: 460,
    height: 320,
    resizable: false,
    movable: true,
    minimizable: false,
    maximizable: false,
    frame: false,
    transparent: true,
    hasShadow: false,
    backgroundColor: '#00000000',
    autoHideMenuBar: true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
    },
  });
  const startUrl = process.env.ELECTRON_START_URL || 'http://localhost:8100';
  // Abre a página da sessão (/home) onde o overlay ficará disponível
  const sessionUrl = `${startUrl.replace(/\/$/, '')}/home`;
  sessionWindow.loadURL(sessionUrl);

  // Quando a janela estiver pronta, peça ao renderer para iniciar a sessão (timer e overlay)
  sessionWindow.webContents.on('did-finish-load', () => {
    sessionWindow.webContents.executeJavaScript('window.__START_SESSION__?.()');
  });

  // Fechar apenas esconde (segue em segundo plano)
  sessionWindow.on('close', (e) => {
    if (sessionWindow) {
      e.preventDefault();
      sessionWindow.hide();
      createTray();
    }
  });

  sessionWindow.on('show', () => {});
}

function createTray() {
  if (tray) return;
  const iconPath = path.join(__dirname, '../src/assets/oab-logo.png');
  let trayIcon;
  try {
    trayIcon = nativeImage.createFromPath(iconPath).resize({ width: 24, height: 24 });
  } catch {
    trayIcon = undefined;
  }
  tray = new Tray(trayIcon ?? iconPath);
  tray.setToolTip('Gerenciamento OAB - Clique para reabrir');
  const contextMenu = Menu.buildFromTemplate([
    {
      label: 'Encerrar sessão',
      click: () => {
        ipcMain.emit('end-session');
      },
    },
  ]);
  tray.setContextMenu(contextMenu);
  tray.on('click', () => {
    if (sessionWindow) {
      sessionWindow.show();
      sessionWindow.focus();
    }
  });
}

function destroyTray() {
  if (tray) {
    tray.destroy();
    tray = null;
  }
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
    const options = { name: 'Gerenciamento OAB' };
    const command = 'powershell -NoProfile -WindowStyle Hidden -Command exit 0';
    sudo.exec(command, options, (error) => {
      resolve(!error);
    });
  });
}

app.whenReady().then(async () => {
  if (app.isPackaged) {
    autoLauncher = new AutoLaunch({
      name: 'Gerenciamento OAB',
      path: process.execPath,
    });
    try {
      const isEnabled = await autoLauncher.isEnabled();
      if (!isEnabled) {
        await autoLauncher.enable();
      }
    } catch (err) {
      console.error('Falha ao configurar auto-start:', err);
    }
  } else {
    console.info('Auto-start ignorado em modo desenvolvimento.');
  }
  createMainWindow();
});

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

// Solicita consentimento de administrador do Windows via UAC
ipcMain.handle('request-windows-admin-consent', async () => {
  return await requestWindowsAdminConsent();
});

ipcMain.on('exit-app', () => app.exit(0));

// Abre janela de sessão e fecha a principal (login)
ipcMain.on('start-session-window', () => {
  if (mainWindow && !mainWindow.isDestroyed()) {
    // Remove todos os listeners para evitar handlers usando a janela após fechar
    mainWindow.removeAllListeners();
    mainWindow.close();
    mainWindow = null;
  }
  if (!sessionWindow) createSessionWindow();
  else sessionWindow.show();
  destroyTray();
});

// Encerrar sessão: fecha janela de sessão e volta ao login
ipcMain.on('end-session', () => {
  if (sessionWindow) {
    sessionWindow.removeAllListeners('close');
    sessionWindow.destroy();
    sessionWindow = null;
  }
  destroyTray();
  if (!mainWindow) createMainWindow();
  else mainWindow.show();
});

ipcMain.on('hide-to-tray', () => {
  if (sessionWindow) {
    sessionWindow.hide();
    createTray();
  }
});


