# API própria do Barber Hub — versão 1

A pasta `api/` contém funções de backend publicadas pela Vercel. O Supabase
continua como banco, autenticação e armazenamento, mas o navegador não executa
diretamente as operações mais sensíveis.

## Arquitetura

```text
Site / PWA / futuro aplicativo
            ↓
     /api/v1 (Vercel)
            ↓
 Supabase Auth + PostgreSQL
```

A chave `SUPABASE_SECRET_KEY` — ou a `SUPABASE_SERVICE_ROLE_KEY` legada — existe somente no servidor. Ela nunca deve
ser colocada em `js/`, HTML, GitHub público ou aplicativo Android.

## Endpoints iniciais

| Método | Endpoint | Autenticação | Finalidade |
|---|---|---|---|
| GET | `/api/v1/health` | Não | Estado e versão da API |
| GET | `/api/v1/catalog/summary` | Não | Métricas públicas da página inicial |
| POST | `/api/v1/support/tickets` | Opcional | Criação validada de ticket |
| GET | `/api/v1/support/tickets` | Sim | Histórico do usuário conectado |
| DELETE | `/api/v1/account/delete` | Sim | Exclusão segura da própria conta |
| GET | `/api/v1/admin/overview` | Admin | Resumo protegido da plataforma |

## Variáveis na Vercel

No projeto `barberhuboficial`, abra **Settings → Environment Variables** e crie:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
BARBER_HUB_ALLOWED_ORIGINS (opcional)
```

Marque as três primeiras para Production, Preview e Development conforme o
ambiente usado. Depois, faça um novo deploy.

## Desenvolvimento local

O Live Server entrega apenas arquivos estáticos e não executa a pasta `api/`.
Para testar frontend e backend juntos, use a CLI da Vercel:

```bash
npm install -g vercel
vercel login
vercel link
vercel env pull .env.local
vercel dev
```

Acesse o endereço exibido pelo terminal, normalmente `http://localhost:3000`.

## Respostas padronizadas

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
    "message": "Revise os dados enviados."
  }
}
```

## Próximas rotas

Depois da estabilização do MVP, a API pode receber:

- notificações push;
- moderação administrativa completa;
- lista de espera;
- webhooks de assinatura e pagamento;
- relatórios consolidados;
- upload assinado de arquivos.
