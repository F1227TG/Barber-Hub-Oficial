# API própria do Barber Hub — Python/FastAPI

## Objetivo

A API não substitui o Supabase. Ela cria uma camada controlada pelo Barber Hub
para validação, autenticação, operações administrativas, regras transacionais e
integrações futuras.

```text
Frontend / PWA / Capacitor
            ↓ JSON + Bearer token
     /api/v1 — FastAPI
            ↓
 Supabase Auth + PostgREST + RPC
```

## Estrutura

```text
api/index.py                 entrada da Vercel e definição das rotas
backend/config.py            leitura centralizada das variáveis
backend/models.py            contratos validados com Pydantic
backend/security.py          sessão e autorização por perfil
backend/supabase.py          comunicação assíncrona com Supabase
backend/services/            regras de catálogo, agenda, suporte e admin
```

## Endpoints

| Método | Rota | Acesso | Responsabilidade |
|---|---|---|---|
| GET | `/api/v1/health` | público | estado e runtime da API |
| GET | `/api/v1/catalog/summary` | público | indicadores da página inicial |
| POST | `/api/v1/appointments` | autenticado | agendamento com múltiplos serviços |
| GET | `/api/v1/support/tickets` | autenticado | tickets do usuário |
| POST | `/api/v1/support/tickets` | público ou autenticado | ticket validado e limitado |
| DELETE | `/api/v1/account` | autenticado | exclusão da própria conta |
| GET | `/api/v1/admin/overview` | admin | resumo administrativo |
| POST | `/api/v1/admin/users/{id}/password-recovery` | admin | envia recuperação de senha |
| GET | `/api/v1/admin/navigation-audit` | admin | referência do mapa interno |

Swagger UI:

```text
/api/docs
```

OpenAPI JSON:

```text
/api/openapi.json
```

## Respostas

Sucesso:

```json
{
  "success": true,
  "data": {}
}
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

## Variáveis da Vercel

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
BARBER_HUB_ALLOWED_ORIGINS
BARBER_HUB_PASSWORD_REDIRECT_URL
```

`SUPABASE_SECRET_KEY` é exclusiva do servidor. Não a coloque em `js/`, HTML,
manifesto, aplicativo Android ou commit.

## Concorrência

A API usa funções `async` e o cliente HTTP assíncrono `httpx`. Isso atende bem
operações de rede e banco sem criar uma thread por requisição. Threads ou
processos adicionais só devem ser introduzidos quando medição real justificar.

## Senhas

A API não possui endpoint para exibir senhas. O fluxo administrativo envia uma
recuperação ao e-mail cadastrado e registra somente metadados operacionais, sem
armazenar a nova senha.
