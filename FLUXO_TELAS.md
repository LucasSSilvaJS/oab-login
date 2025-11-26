# Fluxo de Telas - Gerenciamento OAB

## Mapeamento de Rotas

### Rotas Principais (App Routing)
- `/` → Redireciona para `/auth` (hash routing: `#/auth`)
- `/auth` → Carrega módulo Auth (lazy loading)
- `/home` → Carrega módulo Home (lazy loading), protegido por AuthGuard

### Rotas do Módulo Auth
- `/auth` → Redireciona para `/auth/login`
- `/auth/login` → Tela de Login (LoginPage)
- `/auth/exit` → Tela de Confirmação de Saída (ExitConfirmPage)

### Rotas do Módulo Home
- `/home` → Página Home (HomePage), protegida por AuthGuard

## Fluxo Completo

### 1. Inicialização da Aplicação
```
App inicia → Carrega AppRoutingModule
→ Redireciona '/' para '/auth'
→ Carrega AuthModule (lazy)
→ Redireciona '/auth' para '/auth/login'
→ Exibe LoginPage
```

### 2. Login Bem-Sucedido
```
Usuário preenche credenciais → Submit()
→ AuthService.login()
  ├─ Autentica via API (POST /api/v1/auth/login)
  ├─ Cria sessão via API (POST /api/v1/sessoes)
  ├─ Salva token e userInfo no localStorage
  ├─ Inicia SessionTimerService
  └─ Retorna sucesso
→ LoginPage recebe sucesso
→ Chama electronAPI.startSessionWindow()
→ Electron fecha janela principal e cria janela de sessão
→ Janela de sessão carrega index.html
→ Angular Router navega para #/home
→ AuthGuard verifica token (permitido)
→ HomePage é exibida
→ window.__START_SESSION__() inicia o timer
```

### 3. Sessão Ativa
```
HomePage exibe:
  - Nome do usuário
  - Número OAB
  - Timer regressivo
  - Botão "Encerrar sessão"
  - Botão "✕" (minimizar para tray)
  
SessionTimerService:
  - Conta regressivamente
  - Notifica quando faltam 5, 3 e 1 minutos
  - Quando chega a 0, emite sessionExpired$
  - AuthService se inscreve e faz logout automático
```

### 4. Encerramento de Sessão

#### 4.1. Manual (Botão "Encerrar sessão")
```
Usuário clica → HomePage.endSession()
→ AuthService.logout()
  ├─ Finaliza sessão na API (POST /finalizar ou PUT)
  ├─ Para SessionTimerService
  ├─ Remove dados do localStorage (token, userInfo, sessaoId)
  └─ Navega para /auth/login
→ electronAPI.endSession()
→ Electron fecha janela de sessão e recria janela principal
```

#### 4.2. Automático (Timer expira)
```
Timer chega a 0 → SessionTimerService.sessionExpired$.next()
→ AuthService.subscribeToSessionExpiration() captura
→ AuthService.logout() (mesmo fluxo acima)
```

#### 4.3. Backend encerra sessão
```
Qualquer requisição HTTP retorna 401 com "Sessão não ativa"
→ AuthInterceptor captura
→ Remove token do localStorage
→ AuthService.forceLogoutOnSessionInactive()
  ├─ Para SessionTimerService
  ├─ Remove todos os dados
  ├─ Mostra notificação
  └─ Navega para /auth/login
```

### 5. Sair do Aplicativo
```
Usuário clica no "✕" da janela principal (login)
→ Electron intercepta evento 'close'
→ Solicita senha de administrador (UAC)
→ Se correto, fecha aplicativo
```

## Proteções e Guards

### AuthGuard
- **Rota protegida**: `/home`
- **Verificação**: Verifica se existe token no localStorage
- **Ação se não autenticado**: Redireciona para `/auth/login`

### Janela Principal (Login)
- **Modo**: Fullscreen, kiosk mode
- **Proteção de fechamento**: Solicita senha de administrador
- **Impede**: Minimizar, perder foco, sair sem senha

### Janela de Sessão
- **Modo**: Frameless, transparente, pequena (460x320)
- **Botão "✕"**: Minimiza para tray (não encerra sessão)
- **Botão "Encerrar sessão"**: Encerra sessão e volta ao login

## Pontos de Atenção

1. **Hash Routing**: Todas as rotas usam hash (`#/auth/login`, `#/home`)
2. **LocalStorage compartilhado**: Entre janelas do Electron
3. **Timer independente**: Continua contando mesmo se janela for minimizada
4. **Sessão na API**: Criada antes de completar login (segurança)
5. **Fallbacks**: Navegação tem fallback para window.location.hash se router falhar

