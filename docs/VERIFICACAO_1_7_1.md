# Barber Hub 1.7.1 — Verificação técnica

## Auditoria executada

```bash
npm run check
```

Resultado:

- 21 páginas funcionais `/mobile` sincronizadas com `/html`;
- 11 casos dinâmicos de `bhUrl()` aprovados;
- 22 páginas mobile auditadas, incluindo destinos estáticos e runtime mobile;
- navegações JS para páginas verificadas para evitar `.html` relativo fora do resolvedor;
- 34 arquivos centrais obrigatórios encontrados;
- 48 páginas HTML sem IDs duplicados ou referências locais inexistentes;
- 38 arquivos JavaScript aprovados em `node --check`;
- validação estrutural Python sem erros;
- nenhum segredo administrativo detectado nos arquivos públicos;
- 9/9 testes FastAPI aprovados.

## Pontos conferidos por regra de regressão

- CTA **Explorar agora** da home aponta explicitamente para `/mobile/portal.html`;
- cada link de página presente no HTML mobile usa destino `/mobile/...`;
- `release-1.7.1.css`, `mobile-shell-v1.7.js` e `mobile-native-v1.7.1.js` estão presentes nas páginas mobile;
- Privacidade e Termos de uso estão presentes no drawer;
- a Home carrega o controlador de instalação do PWA;
- `service-worker.js` usa cache `barberhub-v1.7.1`.

## Validação visual automatizada

Foi tentada navegação com Chromium/Playwright em `localhost` e `file://`, porém a política deste ambiente bloqueou a navegação com `ERR_BLOCKED_BY_ADMINISTRATOR` antes da renderização. Portanto a revisão visual final continua necessária no deploy real, especialmente em 360, 390 e 412 px e no modo PWA standalone.
