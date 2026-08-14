# Arquitetura do Barber Hub 1.6

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
- `backend/security.py`: autenticação/token, admin e e-mail confirmado;
- `backend/rate_limit.py`: limitação distribuída;
- `backend/services/catalog.py`: marketplace;
- `backend/services/appointments.py`: criar/cancelar/status;
- `backend/services/management.py`: edição de estabelecimento, serviços e profissionais com Pydantic + token do usuário + RLS;
- `backend/services/admin.py`: overview, health, recuperação e auditoria;
- `backend/services/support.py`: tickets;
- `backend/supabase.py`: gateway assíncrono com tratamento de indisponibilidade.

## Banco

A migration 15 adiciona:

- `search_vector` em estabelecimentos/serviços;
- índices GIN;
- `buscar_marketplace`;
- `estabelecimento_aberto_agora`;
- `api_rate_limits` + RPC atômica;
- `auditoria_admin`.

## Segurança por camada

- **Frontend:** UX/validação imediata — nunca é limite de segurança.
- **Python:** valida novamente payload/sessão/regra e aplica rate limit. Operações de gestão usam o token do próprio usuário para manter o RLS como segunda barreira.
- **PostgreSQL:** integridade, RLS, constraints e transações/RPC.
- **Supabase Auth:** login, confirmação de e-mail, recuperação e CAPTCHA.
- **Vercel:** secrets, CSP, HTTPS e execução serverless.
