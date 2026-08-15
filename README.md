# Barber Hub — versão 1.7.3

O Barber Hub é um **marketplace digital de serviços** com gestão integrada para barbearias. Clientes descobrem estabelecimentos, verificam disponibilidade, conhecem serviços/equipe e agendam; profissionais administram operação, agenda, portfólio e reputação. Uma plataforma de **The Gamers Tech**.

## Hotfix 1.7.3 — instalação resiliente do Service Worker

- remove a duplicação de `./mobile/index.html` na lista de pré-cache;
- deduplica preventivamente a lista com `Set`, evitando `Cache.addAll(): duplicate requests`;
- substitui o `cache.addAll()` por pré-cache individual tolerante a falhas, para um único asset não impedir a instalação inteira do Service Worker;
- cache PWA atualizado para `barberhub-v1.7.3`;
- mantém a correção 1.7.2 para `Response body is already used`.

## Hotfix 1.7.2 — Service Worker e congelamento visual

- corrige `Response body is already used` no cache runtime do Service Worker;
- cria o clone da resposta antes de devolvê-la ao navegador;
- remove View Transitions cross-document por instabilidade observada em Chromium/PWA;
- preserva animações leves de entrada/saída via CSS/JS;
- adiciona fail-safe para nunca deixar `mobile-nav-leaving` preso;
- força a verificação do Service Worker com `updateViaCache: none`;
- cache PWA atualizado para `barberhub-v1.7.2`.


## Entrega 1.7.1 — Mobile App Polish & Route Hardening

- rotas mobile absolutas e runtime normalizado, com teste específico do CTA Explorar;
- redirecionamentos JS compartilhados passam por `bhUrl()`;
- View Transitions + fallback leve para navegação com sensação de aplicativo;
- KPIs/cards mobile reorganizados em grade, sem cortes/carrossel estreito;
- drawer com cards/contornos e links de Privacidade/Termos/Sobre;
- controles de instalar app somem em PWA standalone;
- home mobile redesenhada com mais identidade;
- Essencial, Profissional e Elite marcados como Em desenvolvimento;
- Service Worker `barberhub-v1.7.1`;
- API 1.2 e migration 15 permanecem inalteradas.

## Entrega 1.7.0 — Mobile Reliability & Visual Refresh

A 1.7 é uma release de confiabilidade e experiência. Ela mantém a arquitetura e as regras de negócio da 1.6/API 1.2 e corrige a camada de navegação/apresentação que estava divergindo entre desktop e mobile.

- correção do resolvedor de URLs para `/mobile/`, eliminando caminhos como `/mobile/html/...` e `/mobile/service-worker.js`;
- páginas mobile derivadas automaticamente da fonte funcional em `/html`, com teste de paridade para impedir que futuras melhorias fiquem só no desktop;
- header mobile completo com tema, notificações e **menu hambúrguer novamente acessível**;
- drawer compartilhado volta a oferecer conta, acessibilidade, instalação do PWA e **logout**;
- dock mobile por perfil reorganizado; no admin, os atalhos principais agora levam apenas a **páginas reais**, não a seções da mesma tela;
- painéis de cliente, estabelecimento e admin receberam novos indicadores rápidos e espaçamentos mais consistentes;
- cards com mídia passaram a usar proporções controladas para reduzir variação de altura/formato por imagem;
- selo de **Verificado** ampliado e reforçado em desktop e mobile;
- nova camada visual `release-1.7.css`, com detalhes discretos inspirados em barbearia sem abandonar a identidade preto/dourado;
- Beauty Hub ganhou identidade visual própria e roadmap de preparação, sem anunciar funcionalidades ainda inexistentes;
- Service Worker atualizado para `barberhub-v1.7.0`, incluindo todas as páginas web/mobile relevantes no precache;
- auditoria de roteamento mobile adicionada ao `npm run check`.

A release 1.6 continua sendo a base funcional de marketplace FTS, agendamento modal multi-serviço, API Python/FastAPI 1.2, rate limiting e segurança. **Não há nova migration de banco na 1.7.**

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

As páginas funcionais em `/html/*.html` são a fonte usada por `scripts/sync_mobile_pages.py` para gerar os equivalentes em `/mobile/*.html`. O shell mobile é específico, mas regras de negócio e módulos JS continuam compartilhados.

## Tecnologias

- HTML, CSS e JavaScript vanilla;
- Bootstrap local como camada complementar;
- Python 3.13 + FastAPI + Pydantic + HTTPX assíncrono;
- Supabase Auth, PostgreSQL, Storage, RLS e Realtime;
- Vercel para frontend e função Python;
- PWA com Service Worker e interface `/mobile/`.

## Banco de dados

A 1.7 **não adiciona migration**. O banco continua no schema acumulado até:

```text
sql/15_marketplace_fts_api_seguranca.sql
```

Em banco novo, execute as migrations `01` → `15` em ordem. Não reaplique migrations antigas sobre produção com dados reais.

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

O código trata signup sem sessão (fluxo de confirmação de e-mail) e possui integração opcional com Turnstile em `js/security.js`.

Para produção:

1. ative **Confirm Email** no Supabase Auth;
2. opcional/recomendado: habilite CAPTCHA no Supabase;
3. se usar Turnstile, informe somente a **site key pública** em `js/supabase-config.js`; a secret permanece no painel Supabase.

## Desenvolvimento local

```bash
npm install -g vercel
vercel login
vercel link
vercel env pull .env.local
vercel dev
```

Documentação automática da API:

```text
http://localhost:3000/api/docs
```

## Sincronização mobile

Depois de alterar uma página em `/html`:

```bash
npm run mobile:sync
```

Antes de commit/deploy, `npm run check` falha se as páginas mobile estiverem fora de sincronia ou se o roteamento conhecido regredir.

## Verificação antes do commit

```bash
npm run check
```

A validação inclui paridade mobile, regressão de URLs, referências locais, sintaxe JS, validação Python e testes FastAPI.

## Documentação principal

- `docs/PRD_BARBER_HUB.md` — PRD atual com revisão da 1.7;
- `ARCHITECTURE.md` — arquitetura e limites entre camadas;
- `docs/API_BARBER_HUB_V1.md` — API e configuração;
- `docs/barberhub-api-v1.openapi.yaml` — contrato estático da API 1.2;
- `docs/MAPA_DE_NAVEGACAO.md` — mapa web/mobile atualizado;
- `docs/ATUALIZACAO_1_7.md` — notas da release 1.7;
- `docs/VERIFICACAO_1_7.md` — verificação técnica da release;
- `docs/SEGURANCA_1_6.md` — base de e-mail, CAPTCHA, rate limiting e logs;
- `docs/ANTIGRAVITY.md` — uso do projeto com Google Antigravity.

## Deploy

1. confirme que produção já possui as migrations `01` → `15`;
2. confirme as variáveis da Vercel;
3. execute `npm run check`;
4. faça commit/push;
5. após o deploy, teste em navegador real/PWA: menu hambúrguer, login/logout, Conta, Cliente, Painel, Admin, Beauty Hub, Explorar e um fluxo de agendamento;
6. valide `/api/v1/health`, `/api/v1/marketplace/search?limit=3` e `/api/docs`.

```bash
git status
git add .
git commit -m "fix: atualiza Barber Hub para versão 1.7.1"
git push origin main
```
