# OAB Login - Ionic Angular

Aplicação Ionic Angular com tela de login modularizada, utilizando formulário reativo, guarda de rota e serviço de autenticação (mock).

## Pré-requisitos

- Node.js LTS instalado
- npm (vem com o Node.js)
- Ionic CLI (opcional, mas recomendado)

```bash
npm i -g @ionic/cli
```

## Como executar

1) Instale as dependências:

```bash
cd oab-login
npm install
```

2) Rode o app no navegador (dev server com live reload):

```bash
ionic serve
```

3) Acesse `http://localhost:8100` no seu navegador.

> Dica: use `ionic serve --no-open` para não abrir o navegador automaticamente.

## Executar em modo Desktop (Windows)

O projeto inclui Electron para abrir em tela cheia e exigir senha de administrador ao fechar.

```bash
# senha padrão pode ser alterada (recomendado)
setx ADMIN_PASSWORD "sua-senha-forte"

npm run desktop
```

- Abre a janela em tela cheia e sem menu.
- Ao tentar fechar, aparecerá um modal solicitando a senha de administrador.
- Para gerar instalador do Windows (após `npm run build`):

```bash
npm run build
npm run desktop:win
```

> O instalador será gerado na pasta `dist`.

## Estrutura principal

```
src/
  app/
    core/                # Serviços centrais (singleton) e providers globais
    shared/              # Módulo compartilhado (Forms, IonicModule, etc.)
    features/
      auth/              # Módulo de autenticação (lazy)
        pages/login/     # Tela de Login (HTML/SCSS/TS)
        services/        # AuthService (mock)
        guards/          # AuthGuard (protege rotas)
    home/                # Módulo/página Home (protegido pelo AuthGuard)
  assets/
    oab-logo.png         # Logo exibido na área direita do cartão
```

Arquivos-chave:
- `src/app/app-routing.module.ts`: rotas raiz (lazy para `auth`)
- `src/app/features/auth/pages/login/login.page.ts`: formulário reativo e submit
- `src/app/features/auth/services/auth.service.ts`: login mock e estado de sessão
- `src/app/features/auth/guards/auth.guard.ts`: redireciona não autenticados para `/auth/login`

## Variáveis/Ajustes usuais

- Substitua a logo em `src/assets/oab-logo.png` pela sua imagem.
- Ajuste o layout da tela em `login.page.scss`.
- Integre sua API real no `AuthService` (atualmente mock).
- Centralização: a tela de login usa um wrapper `.center` com `min-height: 100vh` e `place-items: center` para centralizar em qualquer plataforma (web/Electron).

Exemplo de integração (esboço):
```ts
// dentro de AuthService.login
// const res = await this.http.post<LoginResponse>(`${environment.api}/auth/login`, { oabNumber, securityCode }).toPromise();
// localStorage.setItem(this.tokenKey, res.token);
```

## Scripts úteis

```bash
npm start          # alias para 'ionic serve' (adicione se preferir)
ionic serve        # dev server com live reload
ionic build        # build web (gera pasta www/)
npm run desktop    # abre Electron em fullscreen (Windows)
npm run desktop:win# gera instalador Windows
```

## Executar em Android/iOS (Capacitor)

1) Gere o build web:
```bash
ionic build
```

2) Adicione a plataforma desejada (faça uma vez):
```bash
npx cap add android
npx cap add ios
```

3) Sincronize e abra o projeto nativo:
```bash
npx cap sync
npx cap open android   # ou 'npx cap open ios' em macOS
```

> Recompile (`ionic build` + `npx cap sync`) sempre que alterar o código web.

## Lint/format (opcional)

Se desejar padronização adicional, instale ferramentas como ESLint/Prettier e crie scripts:
```bash
npm run lint
npm run format
```

## Troubleshooting

- Porta ocupada: use `ionic serve --port 8101`.
- Cache quebrado: `rm -rf node_modules package-lock.json && npm i`.
- Logo não aparece: confira o caminho `src/assets/oab-logo.png` e refaça o build se necessário.

## Licença

Livre para uso educativo e como base de projetos internos.


