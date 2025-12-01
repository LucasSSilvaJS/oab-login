# Gerenciamento OAB - Ionic + Electron

Aplicação Ionic Angular integrada ao Electron para gerenciamento de sessões da OAB com controle de tempo e monitoramento em tempo real.

## Para acessar o sistema, use as credenciais:
- **Nº da OAB**: 10021
- **Código de segurança**: 123
- **Id do administrador**: 1
- **Id do computador**: 600

[LINK PARA FAZER O DOWNLOAD DO INSTALADOR](https://drive.google.com/file/d/1L0Y7GEAQVe9q_mDudeLTTCQLnLaYF7ID/view?usp=sharing)

## Sobre o Projeto

Sistema de autenticação e gerenciamento de sessões para advogados da OAB, desenvolvido com:
- **Frontend**: Ionic 8 + Angular 20
- **Desktop**: Electron 33
- **Backend**: API REST em `https://backend-oab.onrender.com`

## Credenciais de Login

- **Nº da OAB**: número de registro OAB (apenas números)
- **Código de segurança**: código de acesso do advogado

O sistema autentica via API REST e gerencia sessões com controle de tempo automático.

## Funcionalidades Principais

### Autenticação e Sessão
- Tela de login responsiva com formulário reativo e validações
- Autenticação via API REST (`/api/v1/auth/login/advogado`)
- Criação automática de sessão na API ao fazer login
- Gerenciamento de token JWT e informações do usuário

### Interface de Sessão
- Janela dedicada (frameless) para a sessão ativa
- Exibição de nome do advogado, número OAB e timer regressivo
- Contador regressivo com notificações aos 5, 3 e 1 minutos restantes
- Encerramento automático da sessão quando o timer chega a zero
- Botão "Encerrar sessão" para logout manual

### Sistema Tray (Bandeja)
- Botão "✕" minimiza a janela para a bandeja do sistema sem encerrar a sessão
- Menu do tray permite:
  - Reabrir a janela de sessão
  - Encerrar sessão
  - Encerrar aplicativo

### Modo Quiosque
- Janela principal em modo fullscreen/kiosk
- Proteção de saída com senha de administrador (UAC)
- Auto-start configurado via `electron-auto-launch`
- Impede minimizar, redimensionar ou perder foco

### Monitoramento
- Interceptor HTTP para detectar sessões inativas no backend
- Logout automático quando o backend encerra a sessão
- Sincronização de estado entre frontend e backend

## Pré-requisitos

- **Node.js**: versão LTS (recomendado 18.x ou superior)
- **npm**: incluído com Node.js
- **Ionic CLI**: opcional para comandos utilitários

```bash
npm i -g @ionic/cli
```

## Instalação

```bash
# Clone ou baixe o repositório
cd oab-login

# Instale as dependências
npm install
```

## Execução

### Desenvolvimento Web (para testes)

```bash
npm start
# ou
ionic serve
```

Acesse `http://localhost:8100`. Use `ionic serve --no-open` caso não queira abrir o navegador automaticamente.

### Aplicação Desktop (Windows)

```bash
# Opcional: definir senha de administrador para proteção de saída
setx ADMIN_PASSWORD "sua-senha-forte"

# Executar em modo desenvolvimento
npm run desktop
# ou
npm run dev
```

**Comportamento:**
- Abre o Electron em modo quiosque com tela de login
- Após autenticação bem-sucedida, a janela principal é escondida e uma janela de sessão (frameless) é criada
- O botão "Encerrar sessão" faz logout imediato e retorna à tela de login
- O botão "✕" move a janela para a bandeja sem encerrar o timer
- O auto-start é habilitado na primeira execução (`electron-auto-launch`)

### Build de Produção

```bash
# Build do Angular para produção
npm run build:prod

# Gerar instalador Windows
npm run dist:win
```

O instalador será gerado em `dist/` com o nome `Gerenciamento-OAB-Setup-0.0.1.exe`, seguindo as configurações do `electron-builder` em `package.json`.

## Estrutura do Projeto

```
oab-login/
├── src/
│   ├── app/
│   │   ├── core/                    # Módulo core com serviços globais
│   │   ├── features/
│   │   │   └── auth/
│   │   │       ├── pages/
│   │   │       │   ├── login/       # Tela de login
│   │   │       │   └── exit-confirm/# Tela de confirmação de saída
│   │   │       ├── services/
│   │   │       │   └── auth.service.ts  # Serviço de autenticação
│   │   │       └── guards/
│   │   │           └── auth.guard.ts    # Guard para proteger rotas
│   │   ├── home/                     # Módulo Home (página de sessão)
│   │   │   └── home.page.*           # Página com timer e controles
│   │   ├── shared/
│   │   │   ├── components/
│   │   │   │   ├── session-overlay/     # Overlay flutuante (se aplicável)
│   │   │   │   ├── loading-overlay/     # Overlay de carregamento
│   │   │   │   ├── admin-password-popup/# Popup de senha admin
│   │   │   │   └── session-config-popup/# Popup de configuração
│   │   │   ├── services/
│   │   │   │   ├── api.service.ts           # Serviço de comunicação com API
│   │   │   │   ├── session-timer.service.ts  # Controle do timer regressivo
│   │   │   │   ├── session-monitor.service.ts# Monitoramento de sessão
│   │   │   │   ├── notification.service.ts  # Notificações do sistema
│   │   │   │   └── exit-flow.service.ts     # Fluxo de saída
│   │   │   └── interceptors/
│   │   │       └── auth.interceptor.ts      # Interceptor HTTP para autenticação
│   │   └── app-routing.module.ts     # Rotas principais (hash routing)
│   ├── assets/
│   │   └── oab-logo.png              # Logo da OAB
│   └── environments/
│       ├── environment.ts            # Configurações de desenvolvimento
│       └── environment.prod.ts      # Configurações de produção
├── electron/
│   ├── main.js                       # Processo principal Electron
│   ├── preload.js                    # Script de preload (ponte IPC)
│   ├── password.html                 # HTML para popup de senha
│   └── resources/
│       └── icon.png                  # Ícone do aplicativo
├── package.json
├── angular.json
├── ionic.config.json
├── FLUXO_TELAS.md                    # Documentação do fluxo de telas
└── CORRECOES_BUILD.md                # Documentação sobre correções de build
```

## Arquivos-Chave

### Rotas e Navegação
- `src/app/app-routing.module.ts`: Rotas principais usando hash routing (`#/auth`, `#/home`)
- `src/app/features/auth/auth-routing.module.ts`: Rotas do módulo de autenticação
- `src/app/home/home-routing.module.ts`: Rotas do módulo home

### Serviços
- `src/app/features/auth/services/auth.service.ts`: Autenticação e gerenciamento de sessão
- `src/app/shared/services/api.service.ts`: Comunicação com a API REST
- `src/app/shared/services/session-timer.service.ts`: Controle do timer regressivo
- `src/app/shared/services/session-monitor.service.ts`: Monitoramento de estado da sessão

### Electron
- `electron/main.js`: Lógica do processo principal (janelas, tray, auto-start, IPC)
- `electron/preload.js`: Ponte de comunicação IPC entre renderer e main process

### Componentes
- `src/app/home/home.page.*`: Página principal da sessão com timer e botões
- `src/app/features/auth/pages/login/login.page.*`: Tela de login

## Configuração da API

A URL da API é configurada em `src/environments/environment.ts`:

```typescript
export const environment = {
  production: false,
  apiUrl: 'https://backend-oab.onrender.com'
};
```

**Endpoints utilizados:**
- `POST /api/v1/auth/login/advogado` - Autenticação
- `GET /api/v1/usuarios-advogados/:id` - Informações do usuário
- `POST /api/v1/sessoes` - Criar sessão
- `PUT /api/v1/sessoes/:id` - Atualizar sessão
- `POST /api/v1/sessoes/:id/finalizar` - Finalizar sessão

## Scripts Disponíveis

```bash
# Desenvolvimento
npm start              # Servidor web Angular (localhost:8100)
npm run dev            # Electron + Ionic em modo desenvolvimento
npm run desktop        # Alias para npm run dev

# Build
npm run build          # Build de desenvolvimento
npm run build:prod     # Build de produção

# Electron
npm run electron       # Executar Electron (requer build prévio)
npm run electron:build # Build + Electron

# Distribuição
npm run pack           # Build + empacotar (sem instalador)
npm run pack:win       # Build + empacotar Windows (sem instalador)
npm run dist           # Build + gerar instalador (todas as plataformas)
npm run dist:win       # Build + gerar instalador Windows (.exe)

# Testes e Qualidade
npm test               # Executar testes unitários
npm run lint           # Verificar código com ESLint
```

## Variáveis de Ambiente

### ADMIN_PASSWORD
Senha de administrador para proteção de saída do modo quiosque.

```bash
# Windows (PowerShell)
setx ADMIN_PASSWORD "sua-senha-forte"

# Windows (CMD)
setx ADMIN_PASSWORD "sua-senha-forte"
```

**Nota**: A senha padrão em desenvolvimento é `admin123` (definida em `electron/main.js`).

## Personalização

### Logo
Substitua `src/assets/oab-logo.png` pela logo da instituição.

### Cores e Estilos
Personalize os estilos em:
- `src/app/home/home.page.scss`
- `src/app/features/auth/pages/login/login.page.scss`
- `src/app/shared/components/session-overlay/session-overlay.component.scss`

### Auto-start
Para desabilitar o auto-start em desenvolvimento, comente ou ajuste a configuração `AutoLaunch` em `electron/main.js`.

### Nome do Produto
O nome do produto pode ser alterado em `package.json`:
```json
{
  "build": {
    "productName": "Gerenciamento OAB"
  }
}
```

## Documentação Adicional

- **FLUXO_TELAS.md**: Documentação detalhada do fluxo de navegação e telas
- **CORRECOES_BUILD.md**: Documentação sobre correções implementadas para build de produção

## Troubleshooting

### Porta 8100 ocupada
```bash
ionic serve --port 8101
```

### Dependências quebradas
```bash
# Windows
rmdir /s /q node_modules
del package-lock.json
npm install

# Linux/Mac
rm -rf node_modules package-lock.json
npm install
```

### Tray não aparece
O sistema tray funciona apenas no Electron. Em ambiente browser, o botão "✕" fecha a aba normalmente.

### Auto-start não desejado em desenvolvimento
Comente ou ajuste o trecho `AutoLaunch` do `electron/main.js`:
```javascript
// autoLauncher.enable();
```

### Flash da tela de login na build de produção
Este problema foi corrigido (ver `CORRECOES_BUILD.md`). Se ainda ocorrer, verifique se:
1. O hash `#/home` está sendo definido antes do Angular inicializar
2. A janela de sessão está sendo criada com `show: false` inicialmente

### Erro de conexão com API
Verifique:
1. A URL da API em `src/environments/environment.ts`
2. Se o backend está acessível
3. Se há problemas de CORS (o backend deve permitir requisições do frontend)

## Tecnologias Utilizadas

- **Ionic 8**: Framework UI para aplicações mobile/desktop
- **Angular 20**: Framework web
- **Electron 33**: Framework para aplicações desktop
- **RxJS 7.8**: Programação reativa
- **TypeScript 5.8**: Linguagem de programação
- **electron-builder 25**: Empacotamento e distribuição
- **electron-auto-launch 5**: Auto-start no Windows

## Licença

Livre para uso interno e fins educativos.
