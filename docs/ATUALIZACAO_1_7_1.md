# Barber Hub 1.7.1 — Mobile App Polish & Route Hardening

A 1.7.1 é uma correção incremental da 1.7.0, motivada por novos testes em aparelho mobile/PWA.

## Prioridade: navegação

- links entre páginas geradas em `/mobile` passaram a ser absolutos (`/mobile/...`);
- `mobile/index.html` aponta explicitamente para `/mobile/portal.html` no CTA Explorar;
- `mobile-shell-v1.7.js` usa o resolvedor compartilhado `bhUrl()` em todos os destinos;
- redirecionamentos em scripts de agendamento, onboarding, painel, avaliações e conta deixam de usar páginas `.html` relativas e passam pelo resolvedor;
- `mobile-native-v1.7.1.js` normaliza links adicionados em runtime e aplica transição segura entre páginas;
- a auditoria mobile agora valida HTML estático, `bhUrl()` e navegação direta nos módulos JS.

## Movimento e sensação de aplicativo

- View Transitions habilitada como enhancement progressivo para navegação same-origin;
- fallback de saída/entrada com CSS + JS quando a transição entre documentos não estiver disponível;
- microinterações de toque no dock, botões e cards;
- transição de painéis internos preservada;
- toda a camada respeita `prefers-reduced-motion` e a preferência de movimento do próprio Barber Hub.

## Painel/conta no mobile

- KPIs e cards de resumo deixam de ser carrosséis horizontais estreitos e passam a grade 2x2;
- removidos cortes laterais/negative margins nesses grupos;
- textos e botões passam a quebrar linha sem escapar do card;
- status segmentado e command center usam colunas com `minmax(0,1fr)` para evitar overflow;
- tabelas transformadas em cards recebem proteção adicional contra conteúdo longo.

## Drawer

- grupos do drawer possuem contorno, superfície e espaçamento próprios;
- links também mantêm contorno/superfície, evitando elementos soltos no fundo;
- Privacidade, Termos de uso e Sobre o Barber Hub foram adicionados ao drawer para todos os perfis;
- controles de instalação do PWA somem por completo quando o app está em `standalone`, inclusive se o drawer for criado depois do carregamento.

## Home mobile

A home dedicada foi redesenhada com composição mais viva: detalhe barber-pole, marca com tesoura, hero de maior contraste, atalhos em cards, faixa de benefícios e bloco de métricas do ecossistema.

## Planos

Essencial, Profissional e Elite estão explicitamente **Em desenvolvimento**. Apenas o Perfil gratuito permanece apresentando ação utilizável nesta fase.

## Infraestrutura

- frontend/PWA: 1.7.1;
- API: 1.2.0 (sem alteração);
- schema: migration 15 (sem alteração);
- Service Worker: `barberhub-v1.7.1`;
- sem nova migration SQL.
