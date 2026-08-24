# Arquitetura do Barber Hub 1.9.3

## Visão geral

```text
                         ┌───────────────────────┐
                         │ Desktop Web (/html)   │
                         └───────────┬───────────┘
                                     │
                         ┌───────────▼───────────┐
                         │ Mobile App (/mobile)  │
                         └───────────┬───────────┘
                                     │
                        módulos JS/serviços comuns
                                     │
                    ┌────────────────┴────────────────┐
                    │                                 │
                    ▼                                 ▼
            API Python/FastAPI                 Supabase sob RLS
            regras sensíveis                  leituras simples,
                    │                         Auth/Storage/Realtime
                    └──────────────┬──────────────────┘
                                   ▼
                         PostgreSQL + RPC + RLS
```

## Separação desktop/mobile

`/mobile/` possui documentos HTML próprios para reduzir poluição e permitir ordem/hierarquia específicas de aplicativo. **A lógica de negócio não é duplicada**: desktop e mobile importam os mesmos módulos `js/api.js`, `js/backend-api.js`, `js/auth.js`, `js/status.js` etc.

O PWA inicia em `/mobile/index.html`. `js/device-router.js` encaminha telas pequenas/standalone para a versão mobile; `?desktop=1` preserva a interface web para depuração.

## Marketplace

```text
Portal
  ↓
GET /api/v1/marketplace/search
  ↓
RPC buscar_marketplace
  ├── FTS em search_vector (GIN)
  ├── serviço + estabelecimento
  ├── fallback ILIKE
  ├── filtros
  ├── ranking
  └── offset/limit
```

Nenhuma tela deve buscar o catálogo inteiro em produção.

## Agendamento

```text
barbearia.html
  ↓ modal
serviços → profissional → data/slot → revisão
  ↓
POST /api/v1/appointments
  ↓
RPC criar_agendamento_multisservico
  ↓
constraint de não sobreposição no PostgreSQL
```

A página `agendamento.html` é apenas compatibilidade/deep-link.

## Backend Python

- `api/index.py`: rotas FastAPI, middleware de request id e logs estruturados;
- `backend/domain/`: regras puras de agendamento, planos, agenda, CRM, finanças, retenção, crescimento e permissões, testáveis sem rede;
- `backend/security.py`: autenticação/token, admin e e-mail confirmado;
- `backend/rate_limit.py`: limitação distribuída;
- `backend/services/catalog.py`: marketplace;
- `backend/services/appointments.py`: criar/cancelar/status;
- `backend/services/schedule.py`: Agenda 2.0 e RPCs transacionais;
- `backend/services/crm.py`: carteira persistente e notas internas;
- `backend/services/finance.py`: resumo, ajustes, comissões e fechamento;
- `backend/services/team.py`: vínculos e papéis operacionais;
- `backend/services/retention.py`: espera, recorrência, fidelidade, cupons, campanhas e lembretes;
- `backend/services/growth.py`: oportunidades, insights, metas e permissões granulares;
- `backend/services/management.py`: edição de estabelecimento, serviços e profissionais com Pydantic + token do usuário + RLS;
- `backend/services/admin.py`: overview, health, recuperação e auditoria;
- `backend/services/support.py`: tickets;
- `backend/supabase.py`: gateway assíncrono com tratamento de indisponibilidade.

## Banco

O schema acumulado até a migration 15 já contém FTS/ranking do marketplace, rate limiting e reforços de segurança. A **migration 16** adiciona a camada comercial funcional:

- colunas de capacidades e limites nos planos;
- `calcular_entitlements_estabelecimento` como resolvedor central cumulativo;
- `agenda_online_disponivel` para refletir plano efetivo na experiência pública;
- `admin_atribuir_plano` para upgrade/downgrade transacional;
- triggers de enforcement para agenda, profissionais, promoções e portfólio;
- policy pública de promoções condicionada ao plano efetivo;
- prioridade de marketplace condicionada à assinatura efetiva;
- assinatura em Realtime para atualização imediata do painel.

A **migration 17** endurece os limites de confiança levantados na auditoria:

- moderação administrativa separada da visibilidade escolhida pelo proprietário;
- máquina de estados de agendamentos no PostgreSQL;
- locks transacionais para limites de plano e validação de reativação;
- contador de curtidas derivado da tabela de curtidas;
- policies públicas que excluem estabelecimentos suspensos.

As **migrations 18–23** adicionam e endurecem a base operacional 1.9:

- agenda por intervalo/profissional, eventos, confirmação, reagendamento e no-show;
- CRM persistente por estabelecimento;
- lançamentos, comissões e fechamento diário;
- papéis de equipe e acesso individual;
  - entitlements operacionais, RLS consolidado e encaixe transacional;
  - índices de FKs, políticas sem duplicação e bloqueio de RPCs exclusivas de gatilho.

As **migrations 24–25** completam a 1.9.3:

- lista de espera, recorrência, fidelidade, cupons, campanhas e filas de automação;
- oportunidades, insights, metas e permissões granulares;
- novos entitlements por plano, RLS, RPCs transacionais, triggers e índices.

As migrations 11–23 estavam aplicadas no ambiente conectado em 24/08/2026 e aprovadas pelos verificadores 17, 22 e 23. As migrations 24/25 ainda precisam ser aplicadas e validadas com `verificar_25_release_1_9_3.sql` antes do deploy da API 1.5.0. A configuração externa restante está em `docs/CONFIGURACAO_EXTERNA_1_9.md`.

## Segurança por camada

- **Frontend:** UX/validação imediata — nunca é limite de segurança.
- **Python:** valida novamente payload/sessão/regra e aplica rate limit. Operações de gestão usam o token do próprio usuário para manter o RLS como segunda barreira.
- **PostgreSQL:** integridade, RLS, constraints e transações/RPC.
- **Supabase Auth:** login, confirmação de e-mail, recuperação e CAPTCHA.
- **Vercel:** secrets, CSP, HTTPS e execução serverless.


## Assinaturas e entitlements (1.8)

A regra comercial deixou de ser apenas metadado de UI. `sql/16_assinaturas_entitlements_beneficios.sql` resolve o plano efetivo e seus benefícios cumulativos, e o PostgreSQL aplica limites críticos. A API 1.3 expõe a leitura de entitlements ao proprietário e a atribuição de plano ao administrador.

```text
Admin → API /admin/.../subscription → RPC admin_atribuir_plano
                                      │
                                      ▼
                         assinaturas + calcular_entitlements
                                      │
                    ┌─────────────────┼──────────────────┐
                    ▼                 ▼                  ▼
               painel/CRM       triggers de limite   ranking marketplace
                    │                 │                  │
                    └──── Realtime ───┴──────────────────┘
```

O frontend pode ocultar/bloquear recursos para UX, mas agenda, equipe, promoções e portfólio têm enforcement no banco. O mobile continua derivado da mesma fonte funcional de `/html`, então não existe uma segunda regra de assinatura.

## Desenvolvimento offline da API

`backend/domain` não importa FastAPI, HTTPX ou Supabase. Serviços orquestram essas regras e o gateway externo fica em `backend/supabase.py`. O comando `npm run check:offline` valida regras críticas mesmo sem credenciais ou conectividade. O monorepo continua sendo a escolha da 1.9.3; uma separação da API/mobile só deve ocorrer quando houver ciclo de deploy e equipe realmente independentes. O Beauty Hub possui um pacote inicial separado, mas ainda não compartilha credenciais, banco ou código de produção.
