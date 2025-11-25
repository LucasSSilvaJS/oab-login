# OAB Login - Ionic + Electron

Aplicação Ionic Angular integrada ao Electron que simula um ambiente de login da OAB com controle de tempo e monitoramento da sessão.

## Credenciais de Login

- Nº da OAB: número de registro OAB (apenas números)
- Código de segurança: código de acesso do advogado

O sistema autentica via API e inicia a sessão com controle de tempo.

## Destaques

- Tela de login responsiva com formulário reativo e feedbacks instantâneos.
- Overlay flutuante arrastável com número da OAB, nome e contador regressivo.
- Janela dedicada (frameless) para a sessão: mostra somente cartão com bem-vindo, número OAB, tempo e botões.
- Contador encerra sessão automaticamente e retorna ao login ao zerar.
- Botão “✕” envia a janela para a bandeja; ícone da bandeja permite reabrir ou encerrar.
- Autostart configurado via `electron-auto-launch`: após instalar, o app inicia junto com o Windows.
- Proteção de saída com senha (usando `sudo-prompt`) antes de fechar o aplicativo em modo quiosque.

## Pré-requisitos

- Node.js (versão LTS)
- npm
- Ionic CLI (opcional para comandos utilitários)

```bash
npm i -g @ionic/cli
```

## Instalação e execução

### Desenvolvimento Web (para testes)

```bash
cd oab-login
npm install
ionic serve
```

Acesse `http://localhost:8100`. Use `ionic serve --no-open` caso não queira abrir o navegador automaticamente.

### Aplicação Desktop Windows

```bash
# definir senha que será solicitada ao sair (opcional, mas recomendado)
setx ADMIN_PASSWORD "sua-senha-forte"

npm run desktop
```

- Abre o Electron em modo quiosque com tela de login.
- Após entrar (OAB 123 / código 123) a janela principal é fechada e uma janela de sessão (sem moldura) é aberta.
- O botão “Encerrar sessão” faz logout imediato. O botão “✕” move a janela para a bandeja sem encerrar o timer.
- Na bandeja, o menu permite reabrir a janela, encerrar a sessão ou encerrar o aplicativo.
- O auto-start é habilitado na primeira execução (`electron-auto-launch`). Ajuste em `electron/main.js` caso deseje desligar.
- Para gerar instalador Windows:

```bash
npm run build
npm run desktop:win
```

O instalador segue as definições de `electron-builder` em `package.json`.

## Estrutura do projeto

```
src/
  app/
    core/                 # Módulos e serviços globais
    shared/               # Módulo compartilhado + componentes (overlay, serviços)
    features/
      auth/
        pages/login/      # Tela de login e feedbacks
        services/         # AuthService mock + SessionTimerService
        guards/           # AuthGuard (protege /home)
    home/                 # Página de sessão (cartão com timer e botões)
  assets/
    oab-logo.png
electron/
  main.js                 # Lógica do processo principal (janelas, tray, auto-start)
  preload.js              # Ponte IPC (start/end/hide sessão)
```

Arquivos-chave:
- `src/app/app-routing.module.ts`: rotas raiz (`/auth` e `/home` protegida).
- `src/app/features/auth/services/auth.service.ts`: login mock, inicialização do timer.
- `src/app/shared/services/session-timer.service.ts`: controle do countdown.
- `src/app/home/home.page.*`: cartão minimalista com timer e ação de bandeja.
- `electron/main.js`: janelas Electron, tray, auto-launch e IPC.

## Variáveis/Ajustes recomendados

- Substitua a imagem `src/assets/oab-logo.png` pela logo da instituição.
- Personalize cores no `home.page.scss` e `session-overlay.component.scss`.
- Caso não queira auto-start em desenvolvimento, comente a configuração `AutoLaunch` no `main.js`.

## Scripts úteis

```bash
ionic serve          # dev server web
npm run desktop      # Electron + Ionic em modo desenvolvimento
npm run desktop:win  # gera instalador Windows via electron-builder
```


## Troubleshooting

- Porta 8100 ocupada: `ionic serve --port 8101`.
- Dependências quebradas: `rm -rf node_modules package-lock.json && npm install`.
- Tray não aparece no modo web: apenas no Electron; em ambiente browser o botão “✕” fecha a aba.
- Auto-start não desejado em dev: comente ou ajuste o trecho `AutoLaunch` do `main.js`.

## Licença

Livre para uso interno e fins educativos.
