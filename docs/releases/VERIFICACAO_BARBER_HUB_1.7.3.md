# Barber Hub 1.7.3 — verificação do hotfix de Service Worker

## Problema reproduzido

No Chromium, a instalação do Service Worker 1.7.2 falhava com:

`InvalidStateError: Failed to execute 'addAll' on 'Cache': Cache.addAll(): duplicate requests (https://barberhuboficial.vercel.app/mobile/index.html)`

A causa confirmada no código era `./mobile/index.html` presente duas vezes na lista `CORE`.

## Correções 1.7.3

- removida a duplicação de `./mobile/index.html`;
- `CORE` deduplicado preventivamente com `Set`;
- pré-cache alterado de `cache.addAll()` para cache individual com `Promise.allSettled()`;
- falha de um único asset deixa aviso no console, mas não aborta toda a instalação;
- cache atualizado para `barberhub-v1.7.3`;
- mantida a correção 1.7.2 que clona respostas antes de devolvê-las ao navegador.

## Validação executada

`npm run check`

Resultado:

- 21 páginas mobile sincronizadas;
- 11 casos dinâmicos de roteamento + 22 páginas mobile aprovados;
- 48 páginas HTML sem links locais quebrados ou IDs duplicados;
- 38 arquivos JavaScript aprovados por `node --check`;
- validação estrutural sem erros;
- 9/9 testes FastAPI aprovados;
- auditoria específica do Service Worker confirma ausência de duplicatas em `CORE_SOURCE` e proíbe retorno de `cache.addAll(CORE)`.
