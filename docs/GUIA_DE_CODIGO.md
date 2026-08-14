# Guia de código — Barber Hub 1.7.0

## Princípio central

Cada regra deve existir na camada adequada:

- **HTML desktop (`html/`)**: estrutura web;
- **HTML mobile (`mobile/`)**: estrutura compacta/app-like;
- **CSS**: aparência, temas e componentes;
- **JavaScript de página**: interação/renderização;
- **`js/api.js`**: acesso compartilhado a dados e fallback local;
- **`js/backend-api.js`**: cliente `/api/v1`;
- **Python/FastAPI**: validação confiável, autorização de rota e regras sensíveis;
- **SQL/RPC/RLS**: integridade, atomicidade e segurança de dados.

Desktop e mobile podem ter HTML diferente, mas **não devem duplicar regra de negócio**.

## Estilos

Ordem principal:

1. `css/framework.css` / vendor;
2. `css/global.css`;
3. `css/index.css` ou `css/pages.css`;
4. camadas legadas necessárias (`mobile-app.css`, `release-1.4.1.css`, `product-redesign.css`);
5. **`css/release-1.6.css`**, camada final da release.

A 1.6 redefine tokens de tema. Prefira sempre:

```css
var(--bg)
var(--surface)
var(--surface-2)
var(--text)
var(--muted)
var(--border)
var(--gold)
```

Evite preto/branco puro em novas superfícies. O tema claro usa off-white/bege para reduzir cansaço visual.

## JavaScript compartilhado

- `supabase-config.js`: configuração pública (publishable key/site key opcional de CAPTCHA);
- `supabase-client.js`: SDK Supabase;
- `security.js`: CAPTCHA opcional;
- `backend-api.js`: cliente da API Python;
- `api.js`: operações de domínio/fallback autorizado;
- `auth.js`: sessão/perfil/rotas;
- `ui.js`: tema, drawer e navegação web;
- `device-router.js`: desktop → `/mobile` em tela pequena/PWA;
- `mobile-shell-v1.7.js`: shell exclusivo `/mobile`;
- `booking-modal.js`: fluxo de agendamento contextual;
- arquivos de página (`portal.js`, `cliente.js`, `painel.js`, `admin.js` etc.): estado/render/eventos da tela.

## Marketplace

`portal.js` nunca deve pedir “todos os estabelecimentos”. Use `bhBuscarMarketplace` com `offset`/`limit`.

```text
portal.js
→ backend-api.js
→ GET /api/v1/marketplace/search
→ catalog.py
→ RPC buscar_marketplace
```

FTS é o principal; ILIKE é fallback deliberado.

## Agendamento

A rota visual principal é `barbearia.html` + `booking-modal.js`.

```text
Serviços múltiplos
→ profissionais compatíveis
→ data/slots
→ revisão
→ bhCriarAgendamento
→ API Python
→ RPC transacional
```

`agendamento.html` é somente compatibilidade.

## API Python

- `api/index.py`: rotas, exception handlers, request id e log;
- `backend/models.py`: contratos Pydantic;
- `backend/security.py`: bearer token, admin e e-mail confirmado;
- `backend/rate_limit.py`: rate limiting distribuído;
- `backend/supabase.py`: único gateway HTTP;
- `backend/services/`: regras por domínio.

### Validação

Nunca confie em uma validação que existe somente no JavaScript.

```text
Frontend valida UX
Python valida request/regra
PostgreSQL valida integridade final
```

## Comentários

Comente **intenção, regra e motivo**. Evite comentários que apenas repetem a linha seguinte.

Exemplo útil:

```js
// Sem vínculos cadastrados, o profissional atende todos os serviços;
// com vínculos, precisa atender toda a combinação escolhida.
```

## Release

```bash
npm run check
python scripts/audit_release_1_6.py
```

Antes de publicar 1.6, execute `sql/15_marketplace_fts_api_seguranca.sql`.
