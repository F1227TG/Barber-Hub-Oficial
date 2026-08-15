# Barber Hub 1.7.4 — verificação de estabilidade desktop

## Problemas identificados no código recebido

1. A Home desktop executava `bhListarEstabelecimentos()` para calcular “abertos agora”. Essa consulta trazia o catálogo completo de todos os estabelecimentos, incluindo profissionais/vínculos, serviços, promoções, horários e dias bloqueados. A Home mobile dedicada não carregava `home.js`, criando uma diferença real de custo entre desktop e mobile.
2. O Service Worker 1.7.3 ainda pré-carregava dezenas de recursos de uma vez e o registro chamava `reg.update()` em toda página. Em redes lentas/proxies isso podia gerar picos de rede/processamento durante a entrada no site.
3. `mobile-app.js` iniciava também em desktop e mantinha um `MutationObserver` de conteúdo dinâmico mesmo sem precisar da camada mobile.
4. Observers compartilhados de tabelas reprocessavam o documento inteiro a cada mutação.
5. O cabeçalho desktop combinava `position: sticky` com `backdrop-filter: blur(18px)` permanente. Essa composição foi removida como defesa contra falhas de repaint do Chromium/GPU.

## Correções 1.7.4

- `bhListarStatusEstabelecimentos()` para a Home, com select mínimo.
- Service Worker `barberhub-v1.7.4`, pré-cache reduzido e sequencial.
- HTML network-first sem cache runtime automático.
- Assets estáticos same-origin como únicos candidatos a cache runtime.
- Registro do SW após `load`/idle, sem `reg.update()` forçado.
- `mobile-app.js` não inicia acima de 900 px.
- MutationObservers processam somente nós/tabelas alterados.
- `release-1.7.4.css` remove blur persistente do header sticky no desktop.
- Script `check-desktop-stability.js` com 12 invariantes de regressão.

## Resultado

`npm run check`:

- 21 páginas mobile sincronizadas;
- 11 casos dinâmicos de roteamento + 22 páginas mobile;
- 12/12 invariantes desktop/PWA;
- 48 páginas HTML válidas;
- 38 arquivos JavaScript aprovados por `node --check`;
- validação estrutural Python sem erros;
- 9/9 testes FastAPI aprovados.

## Limitação da validação visual

O Chromium headless do container não produziu uma sessão gráfica confiável (dependências DBus/ambiente headless), então a confirmação final do repaint deve ser feita no Chrome desktop após o deploy.
