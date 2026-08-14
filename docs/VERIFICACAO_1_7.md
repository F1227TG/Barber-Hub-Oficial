# Barber Hub 1.7.0 — Relatório de verificação técnica

## Escopo

Verificação executada após as correções de roteamento mobile, sincronização das páginas, navegação, painéis e camada visual da release 1.7.

## Comando principal

```bash
npm run check
```

## Resultado

- 21 páginas `/mobile` geradas a partir das páginas funcionais equivalentes em `/html` e aprovadas no teste de paridade;
- 10 casos dinâmicos de `bhUrl()` aprovados para raiz, `/html`, `/mobile`, assets e Service Worker;
- 22 documentos HTML da pasta `/mobile` auditados contra retorno indevido para `/html`, ausência do CSS 1.7 e ausência do shell 1.7;
- 48 páginas HTML verificadas sem IDs duplicados ou links locais quebrados pela auditoria estrutural;
- 37 arquivos JavaScript aprovados por `node --check`;
- nenhum segredo administrativo detectado nos arquivos públicos auditados;
- validação estrutural Python concluída sem erro;
- 9/9 testes FastAPI aprovados.

## Regressões especificamente cobertas

- `html/conta.html` chamado dentro de uma página mobile resolve para a página irmã mobile;
- assets como a logomarca continuam resolvendo na raiz;
- registro do `service-worker.js` resolve na raiz, não em `/mobile/service-worker.js`;
- páginas mobile sincronizadas não contêm links estáticos `../html/...`;
- navegação principal do admin não contém `admin.html#...` como seções disfarçadas de páginas;
- todas as páginas mobile sincronizadas carregam `release-1.7.css` e `mobile-shell-v1.7.js`.

## Limite da verificação local

Uma tentativa adicional de renderização automatizada com Chromium/Playwright foi bloqueada pela política do ambiente (`ERR_BLOCKED_BY_ADMINISTRATOR`) antes da navegação para o servidor local/arquivo. Portanto, este relatório **não declara validação visual em navegador real**.

Depois do deploy, é obrigatório executar a rodada manual em 360, 390, 412, 768px e desktop, especialmente com sessões reais de cliente, estabelecimento e admin. Essa etapa é necessária para confirmar dados reais, permissões, PWA/Service Worker e comportamento visual final no dispositivo.
