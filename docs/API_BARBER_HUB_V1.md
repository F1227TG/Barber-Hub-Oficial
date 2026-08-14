# API própria do Barber Hub — Python/FastAPI 1.2

## Objetivo

A API não substitui o Supabase. Ela é a camada de servidor controlada pelo Barber Hub para validação, autenticação de rotas, regras de negócio sensíveis, rate limiting, auditoria e integrações futuras.

```text
Desktop / Mobile / PWA
          ↓ JSON + Bearer
     /api/v1 — FastAPI
          ↓
Supabase Auth + PostgreSQL/PostgREST + RPC
```

## Estrutura

```text
api/index.py                 rotas, erros, request id e logging
backend/config.py            variáveis de ambiente
backend/models.py            contratos Pydantic
backend/security.py          sessão/admin/e-mail confirmado
backend/rate_limit.py        rate limiting distribuído
backend/supabase.py          gateway HTTP assíncrono
backend/services/catalog.py  marketplace/FTS
backend/services/appointments.py agendamentos
backend/services/management.py  estabelecimento/serviços/profissionais sob RLS
backend/services/support.py  suporte
backend/services/admin.py    overview/health/auditoria/recuperação
```

## Endpoints 1.2

| Método | Rota | Acesso | Responsabilidade |
|---|---|---|---|
| GET | `/api/v1/health` | público | estado/runtime/versão |
| GET | `/api/v1/catalog/summary` | público | indicadores agregados |
| GET | `/api/v1/marketplace/search` | público | FTS, filtros, ranking e paginação |
| GET | `/api/v1/marketplace/featured` | público | destaques Barber Hub |
| POST | `/api/v1/appointments` | autenticado | criar agendamento multi-serviço |
| PATCH | `/api/v1/appointments/{id}/status` | dono/admin sob RLS | confirmar/concluir/recusar/cancelar |
| DELETE | `/api/v1/appointments/{id}` | autenticado | cancelar agendamento permitido |
| PATCH | `/api/v1/establishments/{id}` | dono sob RLS | editar dados/configurações do próprio estabelecimento |
| PATCH | `/api/v1/establishments/{id}/status` | dono sob RLS | status Automático/Aberto/Fechado |
| POST | `/api/v1/services` | dono sob RLS | criar serviço com validação Pydantic |
| PATCH | `/api/v1/services/{id}` | dono sob RLS | editar serviço |
| DELETE | `/api/v1/services/{id}` | dono sob RLS | arquivar serviço sem quebrar histórico |
| POST | `/api/v1/professionals` | dono sob RLS | adicionar profissional |
| PATCH | `/api/v1/professionals/{id}` | dono sob RLS | editar profissional |
| DELETE | `/api/v1/professionals/{id}` | dono sob RLS | arquivar profissional sem quebrar histórico |
| GET | `/api/v1/support/tickets` | autenticado | tickets do usuário |
| POST | `/api/v1/support/tickets` | público/autenticado | abrir ticket |
| DELETE | `/api/v1/account` | autenticado | exclusão da própria conta |
| GET | `/api/v1/admin/overview` | admin | totais globais |
| GET | `/api/v1/admin/health` | admin | saúde API/DB/Auth + versão |
| POST | `/api/v1/admin/users/{id}/password-recovery` | admin | recuperação de senha + auditoria |
| GET | `/api/v1/admin/navigation-audit` | admin | estado do mapa interno |

Swagger: `/api/docs`  
OpenAPI executável: `/api/openapi.json`

## Busca do marketplace

Exemplo:

```text
GET /api/v1/marketplace/search?q=degradê+centro&status=aberta&agenda=true&offset=0&limit=24
```

A RPC `buscar_marketplace` usa FTS como mecanismo principal e `ILIKE` como fallback. O backend retorna `items`, `total`, `offset`, `limit`, `has_more` e `search_engine`.

## Respostas

Sucesso:

```json
{"success":true,"data":{}}
```

Erro:

```json
{
  "success": false,
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Revise os dados informados.",
    "details": []
  }
}
```

Cada resposta da API recebe `X-Request-ID` e `X-Barber-Hub-API` quando processada pelo middleware.

## Rate limiting

A migration 15 cria `api_rate_limits` + `consumir_api_rate_limit`. O contador fica no PostgreSQL para funcionar com múltiplas instâncias serverless.

429 inclui `Retry-After` quando disponível.

## Variáveis da Vercel

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
BARBER_HUB_ALLOWED_ORIGINS
BARBER_HUB_PASSWORD_REDIRECT_URL
```

`SUPABASE_SECRET_KEY` é exclusiva do servidor.

## Concorrência

A API usa `async`/`await` e `httpx.AsyncClient`. Para o perfil atual, o principal trabalho é I/O (rede/PostgREST/Auth), portanto concorrência assíncrona é mais apropriada que criar threads por request. Threads/processos devem ser introduzidos apenas para tarefas CPU-bound ou após medição.

## Senhas

Não existe endpoint para exibir senha. A recuperação administrativa envia um fluxo seguro ao e-mail do titular; senhas continuam armazenadas apenas como hash no Supabase Auth.

## Escritas de gestão e dupla validação

As rotas de estabelecimento, serviços e profissionais usam o **token do usuário** ao falar com o PostgREST. Assim, a entrada é validada em Python/Pydantic e o PostgreSQL RLS continua sendo uma segunda barreira de autorização de propriedade. A `SUPABASE_SECRET_KEY` não é usada para contornar RLS nessas rotas. Exclusões de serviço/profissional são arquivamentos lógicos para preservar agendamentos históricos.
