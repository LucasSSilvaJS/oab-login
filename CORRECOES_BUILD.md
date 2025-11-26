# Correções para Build de Produção

## Problema Identificado

A build de produção não se comportava como o desenvolvimento (`npm run dev`):
- Flash visual da tela de login aparecendo antes da home
- Diferenças no timing de inicialização
- Janela de sessão pode aparecer antes de estar totalmente carregada

## Soluções Implementadas

### 1. Janela de Sessão Criada Escondida

**Antes:**
- Janela aparecia imediatamente ao ser criada

**Agora:**
- Janela criada com `show: false` 
- Só aparece quando tudo está pronto

### 2. Janela Principal Escondida Antes de Criar Sessão

**Antes:**
- Janela principal era fechada ao mesmo tempo que a sessão era criada

**Agora:**
- Janela principal é **escondida** imediatamente ao iniciar criação da sessão
- Remove listeners (evita pedir senha)
- Só é fechada definitivamente após a sessão estar totalmente pronta

### 3. Hash Definido Antes do Angular Inicializar

**Antes:**
- Arquivo carregava sem hash → Angular ia para `#/auth` → depois navegava para `#/home`

**Agora:**
- Evento `dom-ready` define hash `#/home` antes do Angular inicializar
- Evita o flash da tela de login

### 4. Verificação Robusta do Angular

**Antes:**
- Delays fixos que podem não ser suficientes em produção

**Agora:**
- Função `waitForAngularReady()` que verifica múltiplas vezes
- Até 50 tentativas (máximo 5 segundos)
- Verifica se conteúdo foi renderizado e router está disponível

### 5. Ordem de Operações Unificada

**Fluxo na Produção (igual ao Dev):**

```
1. Usuário faz login → sucesso
2. Handler IPC: esconde janela principal (instantâneo)
3. Cria janela de sessão (escondida, show: false)
4. Carrega index.html
5. dom-ready: define hash #/home (antes do Angular)
6. did-finish-load: inicia initializeSessionWindow()
7. waitForAngularReady(): verifica se Angular está pronto
8. Navega para #/home (se necessário)
9. Aguarda Router processar navegação
10. Inicia sessão no renderer (__START_SESSION__)
11. Fecha janela principal definitivamente
12. Mostra janela de sessão (apenas quando tudo está pronto)
```

### 6. Fallbacks de Navegação Corrigidos

**Antes:**
- `window.location.href = '/auth/login'` não funcionava com hash routing

**Agora:**
- `window.location.hash = '#/auth/login'` usa hash corretamente

## Diferenças Entre Dev e Produção

| Aspecto | Desenvolvimento | Produção |
|---------|----------------|----------|
| Carregamento | HTTP (`localhost:8100`) | Arquivo local (`file://`) |
| Hash inicial | Já vem na URL (`/#/home`) | Definido via `dom-ready` |
| Timing Angular | Mais rápido | Mais lento (arquivos locais) |
| Verificação | Delay simples | Verificação robusta múltipla |

## Arquivos Modificados

- `electron/main.js`: Lógica unificada entre dev e produção
- `src/app/features/auth/services/auth.service.ts`: Fallback de navegação corrigido
- `src/app/app.component.ts`: Verificação de timer antes de iniciar

## Resultado Esperado

A build de produção agora deve se comportar **exatamente** como o desenvolvimento:
- Sem flash da tela de login
- Transição suave entre janelas
- Timer iniciando corretamente
- Navegação funcionando perfeitamente

