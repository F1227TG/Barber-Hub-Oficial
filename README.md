# Barber Hub — versão 1.6.0

O Barber Hub é um **marketplace digital de serviços** com gestão integrada para barbearias. Clientes descobrem estabelecimentos, verificam disponibilidade, conhecem serviços/equipe e agendam; profissionais administram operação, agenda, portfólio e reputação. Uma plataforma de **The Gamers Tech**.

## Entrega 1.6.0

- marketplace paginado para crescer sem renderizar centenas/milhares de cards de uma vez;
- PostgreSQL Full Text Search (FTS) com ranking e fallback `ILIKE`;
- destaques Barber Hub + resultados ranqueados + botão **Carregar mais**;
- busca e filtros compactos na mesma área;
- cards do catálogo menores e mais objetivos;
- agendamento convertido em **modal** dentro da página do estabelecimento;
- seleção de múltiplos serviços e profissional por cartão/radio com foto;
- interface HTML dedicada em `/mobile/`, compartilhando a mesma lógica/API do desktop;
- PWA iniciado na experiência mobile dedicada;
- tema escuro mais suave e tema claro off-white/bege redesenhado;
- painéis de cliente e profissional organizados por “próxima ação”;
- API Python/FastAPI 1.2 com busca, cancelamento/status de agendamento, gestão validada de estabelecimento/serviços/profissionais, health admin e logs estruturados;
- rate limiting distribuído no PostgreSQL para rotas públicas/sensíveis;
- preparação de confirmação de e-mail e CAPTCHA/Cloudflare Turnstile;
- exclusão de conta com frase `EXCLUIR MINHA CONTA` validada também no backend;
- PRD e mapa técnico atualizados.

## Arquitetura

```text
Desktop HTML ─┐
              ├── JavaScript/serviços compartilhados ──┐
Mobile HTML ──┘                                        │
                                                       ▼
                                              API Python / FastAPI
                                                       │
                   ┌───────────────────────────────────┼─────────────────────┐
                   ▼                                   ▼                     ▼
             Supabase Auth                      PostgreSQL/RPC         Supabase Storage
                                                   + RLS               + Realtime
```

O frontend continua autorizado a fazer leituras simples/seguras diretamente no Supabase quando RLS é suficiente. Regras de negócio e operações sensíveis migram para a API Python.

## Tecnologias

- HTML, CSS e JavaScript vanilla;
- Bootstrap local como camada complementar;
- Python 3.13 + FastAPI + Pydantic + HTTPX assíncrono;
- Supabase Auth, PostgreSQL, Storage, RLS e Realtime;
- Vercel para frontend e função Python;
- PWA com Service Worker e interface `/mobile/`.

## Atualização do banco

Em um projeto já atualizado até a migration 14, execute **antes de publicar a 1.6**:

```text
sql/15_marketplace_fts_api_seguranca.sql
```

Ela adiciona FTS, índices GIN, ranking/paginação do marketplace, rate limiting distribuído e auditoria administrativa mínima.

Em banco novo, execute as migrations `01` → `15` em ordem. Não reaplique a migration `01` sobre produção com dados reais.

## Variáveis da API na Vercel

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
BARBER_HUB_ALLOWED_ORIGINS
BARBER_HUB_PASSWORD_REDIRECT_URL
```

A `SUPABASE_SECRET_KEY` nunca deve aparecer no frontend ou no GitHub.

## E-mail e CAPTCHA

O código já trata signup sem sessão (fluxo de confirmação de e-mail) e possui integração opcional com Turnstile em `js/security.js`.

Para produção:

1. ative **Confirm Email** no Supabase Auth;
2. opcional/recomendado: habilite CAPTCHA (Turnstile/hCaptcha) no Supabase;
3. se usar Turnstile, informe somente a **site key pública** em `js/supabase-config.js` (`BH_TURNSTILE_SITE_KEY`); a secret do CAPTCHA permanece no painel Supabase, nunca no código.

## Desenvolvimento local

```bash
npm install -g vercel
vercel login
vercel link
vercel env pull .env.local
vercel dev
```

Documentação automática:

```text
http://localhost:3000/api/docs
```

## Verificação antes do commit

```bash
npm run check
python scripts/audit_release_1_6.py
```

O relatório de dupla verificação da release fica em `docs/VERIFICACAO_1_6.md`.

## Documentação principal

- `docs/PRD_BARBER_HUB.md` — PRD atualizado com revisão pós-1.6;
- `ARCHITECTURE.md` — arquitetura e limites entre camadas;
- `docs/API_BARBER_HUB_V1.md` — API e configuração;
- `docs/barberhub-api-v1.openapi.yaml` — contrato estático 1.2 (o `/api/openapi.json` é a fonte executável);
- `docs/MAPA_DE_NAVEGACAO.md` — mapa do produto;
- `docs/ATUALIZACAO_1_6.md` — notas e implantação da release;
- `docs/SEGURANCA_1_6.md` — e-mail, CAPTCHA, rate limiting e logs;
- `docs/ANTIGRAVITY.md` — uso do projeto com Google Antigravity.

## Deploy

1. execute a migration 15 no Supabase;
2. confirme as variáveis da Vercel;
3. valide `npm run check`;
4. faça commit/push;
5. valide `/api/v1/health`, `/api/v1/marketplace/search?limit=3` e `/api/docs`.

```bash
git status
git add .
git commit -m "Atualiza Barber Hub para versão 1.6.0"
git push origin main
```
