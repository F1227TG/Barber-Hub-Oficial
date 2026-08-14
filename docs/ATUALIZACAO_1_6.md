# Barber Hub 1.6.0 — Marketplace & App Architecture

## Escopo entregue

### Marketplace
- FTS PostgreSQL com índices GIN;
- fallback ILIKE;
- ranking inicial por relevância/destaque/agenda/avaliação;
- paginação e `Carregar mais`;
- seção de destaques;
- busca + filtros compactos;
- cards menores.

### Agendamento
- aberto em modal na página do estabelecimento;
- múltiplos serviços;
- seleção de profissional em cards/radio com foto;
- profissional filtrado pela combinação de serviços quando há vínculos cadastrados;
- rota antiga mantida apenas para compatibilidade.

### Mobile
- pasta `/mobile` com HTML próprio;
- app shell e bottom navigation próprios;
- PWA inicia em mobile;
- tabelas convertidas em cards no app;
- página de estabelecimento reorganizada para priorizar agendamento.

### Temas
- escuro mais suave;
- claro redesenhado em off-white/bege, sem branco agressivo;
- novos tokens em `release-1.6.css`.

### Backend
- API 1.2;
- FTS/search/featured;
- cancelamento e status de agendamento;
- edição de estabelecimento, serviços e profissionais validada em Python e autorizada novamente por RLS;
- admin overview/health/navigation audit consumidos pelo frontend;
- logs JSON com request id;
- tratamento 429/503;
- rate limiting distribuído pela migration 15;
- auditoria administrativa mínima.

### Segurança
- backend rejeita sessão sem e-mail confirmado;
- signup preparado para confirmação de e-mail;
- Turnstile opcional preparado;
- exclusão exige `EXCLUIR MINHA CONTA` também no backend.

## Ordem correta de implantação

1. Backup/confirmar banco atual.
2. Executar `sql/15_marketplace_fts_api_seguranca.sql` no Supabase.
3. Confirmar variáveis da Vercel.
4. Fazer commit/push da 1.6.
5. Aguardar deploy Ready.
6. Testar `/api/v1/health`.
7. Testar `/api/v1/marketplace/search?limit=3`.
8. Testar portal e modal de agendamento.
9. Testar cliente/profissional/admin.
10. Ativar Confirm Email no Supabase quando o fluxo de e-mail estiver validado.
11. Configurar CAPTCHA opcional/recomendado.

**Importante:** publicar o código antes da migration 15 faz as rotas de marketplace/rate limit dependerem de funções que ainda não existem. Execute a migration antes do deploy da 1.6.

## Compatibilidade

`html/agendamento.html` e `mobile/agendamento.html` continuam existentes por compatibilidade, mas redirecionam ao perfil do estabelecimento. Não devem voltar aos menus principais.
