# Barber Hub 1.7.0 — Mobile Reliability & Visual Refresh

## Objetivo

Corrigir regressões reais encontradas após a 1.6 na experiência mobile e reduzir a chance de novas divergências entre `/html` e `/mobile`, ao mesmo tempo em que a interface recebe uma revisão visual de cards, painéis, selo verificado e Beauty Hub.

## Correções críticas

### Roteamento mobile / 404

A função `bhUrl()` tratava apenas páginas dentro de `/html/`. Em `/mobile/`, URLs como `html/conta.html`, assets da raiz e o Service Worker podiam ser resolvidos com base incorreta.

A 1.7 diferencia explicitamente três contextos:

- raiz;
- `/html/`;
- `/mobile/`.

Em mobile, destinos `html/*.html` são convertidos para a página irmã em `/mobile/`; assets e infraestrutura continuam apontando para a raiz. O teste `scripts/check-mobile-routing.js` cobre páginas, imagem/logo e `service-worker.js`.

### Página 404 independente da profundidade

A `404.html` passou a usar referências de assets e navegação desde a raiz (`/css/...`, `/js/...`, `/img/...`). Assim, mesmo uma URL inexistente profunda mantém o layout e não tenta carregar CSS dentro da pasta quebrada. O resolvedor dinâmico `bhUrl()` também usa caminhos desde a raiz em HTTP/HTTPS, mantendo `file://` relativo apenas para desenvolvimento local.

### Fonte única das páginas mobile

`scripts/sync_mobile_pages.py` gera os equivalentes de `/mobile` a partir da fonte funcional em `/html`, adicionando apenas:

- `mobile-native`;
- canonical/noindex;
- remoção do `device-router.js`;
- links estáticos mantidos dentro de `/mobile`;
- `mobile-shell-v1.7.js`.

`npm run check` executa o modo `--check`, portanto uma release falha se desktop e mobile divergirem sem sincronização.

### Header e conta no mobile

O shell 1.6 escondia o header web e não oferecia um acionador equivalente para o drawer. A 1.7 restaura no topo:

- alternância de tema;
- notificações;
- botão de menu hambúrguer com alvo de toque adequado.

O botão abre o drawer compartilhado, que contém Conta, recursos de acessibilidade, instalação do app e logout quando autenticado.

### Navegação de administrador

A navegação principal do administrador não usa mais “Negócios/Moderação” como links que apenas rolam para seções da mesma `admin.html`. Os destinos principais são páginas reais: Administração, Mapa do sistema, Notificações, Suporte e Conta. As seções operacionais permanecem dentro do dashboard como conteúdo, não fingem ser páginas independentes.

## Painéis

### Cliente

Foram adicionados indicadores rápidos de Favoritos, Avaliações, Taxa de conclusão e Último atendimento, preservando o command center e o histórico existentes.

### Estabelecimento

Foram adicionados indicadores de Hoje, A confirmar, Equipe ativa e Reputação. Espaçamentos do sidebar, conteúdo e seções foram normalizados; mobile apresenta os indicadores em faixa horizontal compacta.

### Admin

Além dos KPIs e health existentes, a visão geral agora mostra Pendências, Taxa de conclusão, Cobertura verificada e percentual de negócios com Agenda online. Toolbar, tabelas e seções receberam ritmo de espaçamento revisado.

## Visual e mídia

A nova camada `css/release-1.7.css` é aditiva e preserva as regras funcionais.

- padrões de fundo de baixa opacidade inspirados nas faixas de barbearia;
- elemento gráfico discreto em heróis desktop;
- cards de marketplace com alturas previsíveis;
- favoritos com mídia 16:9;
- portfólio com aspect-ratio consistente;
- imagens com `object-fit: cover` para não distorcer cards;
- selo Verificado com maior área, ícone e contraste;
- breakpoints mobile com alvos de toque e espaçamentos revisados.

## Beauty Hub

A página continua explicitamente em preparação. A 1.7 adiciona uma linguagem visual própria (pérola/rose/violeta sobre a base do ecossistema), composição central e cartões de categorias, além de um roadmap que explica a expansão sem anunciar produto concluído.

## PWA

- cache renomeado para `barberhub-v1.7.0`;
- `release-1.7.css` e `mobile-shell-v1.7.js` incluídos;
- precache ampliado para as páginas web/mobile atuais;
- respostas `/api/` continuam fora do cache de conteúdo estático.

## Banco e API

Não há migration 16 e não há quebra de contrato da API. A release mantém:

- schema até migration 15;
- API FastAPI 1.2;
- RLS/Supabase;
- marketplace FTS;
- agendamento multi-serviço;
- rate limiting e validações já existentes.

## Checklist de publicação

1. executar `npm run check`;
2. publicar na Vercel;
3. em Android/PWA e navegador mobile real, validar os botões do header e o drawer;
4. testar Conta e logout para cliente, barbeiro e admin;
5. abrir todos os itens do dock de cada perfil e confirmar ausência de 404;
6. testar Cliente, Painel e Admin em 360, 390, 412, 768px e desktop;
7. testar imagens reais de proporções diferentes nos cards;
8. confirmar atualização do Service Worker/cache para 1.7.
