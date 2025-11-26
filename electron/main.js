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

  // Carrega a aplicação de forma diferente em desenvolvimento vs produção
  if (process.env.ELECTRON_START_URL) {
    // Modo desenvolvimento com servidor HTTP explícito
    mainWindow.loadURL(process.env.ELECTRON_START_URL);
  } else if (app.isPackaged) {
    // Modo produção - carrega do arquivo local
    // No electron-builder, os arquivos estão em resources/app/
    // __dirname aponta para resources/app/electron, então www/ está em ../www/
    mainWindow.loadFile(path.join(__dirname, '../www/index.html'));
  } else {
    // Modo desenvolvimento local - usa servidor HTTP
    mainWindow.loadURL('http://localhost:8100');
  }

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
    show: false, // CRÍTICO: Cria escondida para evitar flash visual na produção
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      backgroundThrottling: false,
      nodeIntegration: false,
      contextIsolation: true,
    },
  });
  // Função auxiliar para aguardar o Angular estar pronto (otimizada para velocidade)
  function waitForAngularReady(maxAttempts = 20, intervalMs = 50) {
    return new Promise((resolve) => {
      let attempts = 0;
      
      const checkReady = () => {
        attempts++;
        
        sessionWindow.webContents.executeJavaScript(`
          (function() {
            // Verifica se o Angular está pronto
            const appRoot = document.querySelector('app-root');
            if (!appRoot) return false;
            
            // Verifica se há conteúdo renderizado (Angular já inicializou)
            const hasContent = appRoot.children.length > 0 || 
                              appRoot.innerHTML.trim().length > 0;
            
            // Verifica se o router está disponível
            return hasContent && typeof window !== 'undefined' && window.location;
          })();
        `).then((isReady) => {
          if (isReady || attempts >= maxAttempts) {
            resolve(isReady);
          } else {
            setTimeout(checkReady, intervalMs);
          }
        }).catch(() => {
          // Em caso de erro, resolve após menos tentativas
          if (attempts >= Math.min(maxAttempts, 5)) {
            resolve(false);
          } else {
            setTimeout(checkReady, intervalMs);
          }
        });
      };
      
      // Inicia verificação imediatamente (sem delay inicial)
      checkReady();
    });
  }

  // Função centralizada para inicializar a janela de sessão após carregar (otimizada)
  async function initializeSessionWindow() {
    console.log('🚀 Inicializando janela de sessão...');
    
    // Fecha a janela principal IMEDIATAMENTE (sem aguardar nada)
    // Isso deixa a transição mais rápida e suave
    if (mainWindow && !mainWindow.isDestroyed()) {
      console.log('📴 Fechando janela principal...');
      mainWindow.removeAllListeners('close');
      mainWindow.removeAllListeners('blur');
      mainWindow.removeAllListeners('minimize');
      mainWindow.close();
      mainWindow = null;
    }
    
    // Mostra a janela de sessão IMEDIATAMENTE (pode carregar enquanto é exibida)
    if (sessionWindow && !sessionWindow.isDestroyed() && !sessionWindow.isVisible()) {
      sessionWindow.center();
      sessionWindow.show();
      sessionWindow.focus();
      console.log('✅ Janela de sessão exibida (carregando em segundo plano)');
    }
    
    // Aguarda o Angular estar pronto (paralelo à exibição da janela)
    const isAngularReady = await waitForAngularReady();
    console.log('✅ Angular pronto:', isAngularReady);
    
    // Navega para #/home (em produção, pode estar em #/auth inicialmente)
    const currentHash = await sessionWindow.webContents.executeJavaScript('window.location.hash').catch(() => '');
    console.log('📍 Hash atual:', currentHash);
    
    if (currentHash !== '#/home') {
      console.log('🔄 Navegando para #/home...');
      await sessionWindow.webContents.executeJavaScript(`
        (function() {
          window.location.hash = '#/home';
          return true;
        })();
      `);
      
      // Aguarda a navegação ser processada pelo Router (delay reduzido)
      await new Promise(resolve => setTimeout(resolve, 150));
    }
    
    // Inicia a sessão no renderer
    try {
      await sessionWindow.webContents.executeJavaScript('window.__START_SESSION__?.()');
      console.log('✅ Sessão iniciada no renderer');
    } catch (err) {
      console.error('❌ Erro ao iniciar sessão:', err);
      // Continua mesmo se houver erro (pode ser que o timer já esteja ativo)
    }
  }

  // Carrega a aplicação de forma diferente em desenvolvimento vs produção
  if (process.env.ELECTRON_START_URL) {
    // Modo desenvolvimento com servidor HTTP explícito
    const sessionUrl = `${process.env.ELECTRON_START_URL.replace(/\/$/, '')}/#/home`;
    sessionWindow.loadURL(sessionUrl);
    
    // Em desenvolvimento, usa lógica mais simples
    sessionWindow.webContents.once('did-finish-load', () => {
      // Inicia imediatamente (sem delay)
      initializeSessionWindow();
    });
  } else if (app.isPackaged) {
    // Modo produção - carrega do arquivo local
    const indexPath = path.join(__dirname, '../www/index.html');
    
    // Configura listeners ANTES de carregar o arquivo
    // Define o hash o mais cedo possível para evitar que Angular vá para rota padrão
    sessionWindow.webContents.once('dom-ready', () => {
      console.log('📄 DOM pronto, definindo hash inicial...');
      // Tenta definir o hash antes do Angular inicializar completamente
      sessionWindow.webContents.executeJavaScript(`
        (function() {
          try {
            // Define hash imediatamente se estiver vazio ou na rota padrão
            const currentHash = window.location.hash;
            if (!currentHash || currentHash === '#' || currentHash === '#/' || currentHash === '#/auth' || currentHash === '#/auth/login') {
              window.location.hash = '#/home';
              console.log('✅ Hash #/home definido antes do Angular inicializar');
            }
          } catch (e) {
            console.warn('Erro ao definir hash:', e);
          }
        })();
      `).catch(err => console.warn('⚠️ Erro ao definir hash inicial:', err));
    });
    
    // Carrega o arquivo
    sessionWindow.loadFile(indexPath);
    
    // Aguarda carregar completamente e inicializa
    sessionWindow.webContents.once('did-finish-load', () => {
      console.log('📄 HTML carregado completamente, aguardando Angular inicializar...');
      initializeSessionWindow();
    });
  } else {
    // Modo desenvolvimento local - usa servidor HTTP com hash
    sessionWindow.loadURL('http://localhost:8100/#/home');
    
    sessionWindow.webContents.once('did-finish-load', () => {
      // Inicia imediatamente (sem delay)
      initializeSessionWindow();
    });
  }

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
  // Caminho do ícone muda entre desenvolvimento e produção
  let iconPath;
  if (app.isPackaged) {
    // Em produção, os assets estão em www/assets
    iconPath = path.join(__dirname, '../www/assets/oab-logo.png');
  } else {
    // Em desenvolvimento, os assets estão em src/assets
    iconPath = path.join(__dirname, '../src/assets/oab-logo.png');
  }
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
  console.log('🪟 Iniciando criação da janela de sessão...');
  
  // Esconde a janela principal IMEDIATAMENTE para evitar flash visual
  // Remove TODOS os listeners ANTES para evitar que handlers sejam acionados
  if (mainWindow && !mainWindow.isDestroyed()) {
    console.log('🙈 Escondendo janela principal (login)...');
    mainWindow.removeAllListeners('close'); // Remove o handler que pede senha
    mainWindow.removeAllListeners('blur');
    mainWindow.removeAllListeners('minimize');
    mainWindow.hide(); // Esconde imediatamente (a janela será fechada dentro de initializeSessionWindow)
  }
  
  // Cria a janela de sessão se não existir
  if (!sessionWindow) {
    console.log('🆕 Criando nova janela de sessão (será mostrada quando estiver pronta)...');
    createSessionWindow();
    // A janela será mostrada automaticamente quando estiver pronta (dentro de initializeSessionWindow)
  } else {
    console.log('👁️ Janela de sessão já existe, apenas mostrando...');
    // Se já existe, apenas mostra e garante que está na rota correta
    // Fecha a janela principal definitivamente
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.removeAllListeners('close');
      mainWindow.close();
      mainWindow = null;
    }
    // Depois mostra a janela de sessão
    setTimeout(() => {
      if (sessionWindow && !sessionWindow.isDestroyed()) {
        sessionWindow.center();
        sessionWindow.show();
        sessionWindow.focus();
      }
      // Força navegação para /home se necessário
      sessionWindow.webContents.executeJavaScript(`
        if (window.location.hash !== '#/home') {
          window.location.hash = '#/home';
        }
      `);
    }, 50);
  }
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


