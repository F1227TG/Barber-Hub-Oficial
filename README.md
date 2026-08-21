# Barber Hub — versão 1.8.2

O Barber Hub é um **marketplace digital de serviços** com gestão integrada para barbearias. Clientes descobrem estabelecimentos, verificam disponibilidade, conhecem serviços/equipe e agendam; profissionais administram operação, agenda, portfólio e reputação. Uma plataforma de **The Gamers Tech**.

## Entrega 1.8.2 — Segurança diferencial

A 1.8.2 corrige os achados V01–V05 da auditoria no código e deixa V06 preparado para ativação externa. A direção visual e a experiência mobile premium da 1.8.1 foram preservadas.

- migration `17_correcao_auditoria_seguranca.sql` para moderação, estados de agendamento, limites concorrentes e curtidas derivadas;
- API própria **1.3.1**, com rate limiting completo e configuração pública segura do Turnstile;
- regras puras em `backend/domain` e comando `npm run check:offline`;
- relatório diferencial, verificação pós-migration, decisão de monorepo e roadmap 1.9;
- senhas permanecem somente como hash bcrypt no Supabase Auth, sem cópia pública ou reversão.

Consulte `docs/RELATORIO_SEGURANCA_1_8_2.md` antes de qualquer deploy.


## Refino mobile 1.8 — experiência exclusiva

A interface `/mobile` recebeu uma camada própria de UX: menos texto institucional, navegação mais direta, filtro do marketplace em bottom sheet, conta em formato de hub, editor de imagens com crop/zoom e remoção do CTA de instalação dentro da versão mobile. Detalhes em `docs/REDESIGN_MOBILE_1_8.md`.

## Entrega 1.8.0 — Assinaturas funcionais e valor para o estabelecimento

A 1.8 transforma os planos de apresentação em regras de produto reais. O administrador atribui um plano ao estabelecimento em uma página própria e os **entitlements cumulativos** entram em vigor imediatamente no painel web/mobile, na API e no PostgreSQL.

- nova migration `16_assinaturas_entitlements_beneficios.sql`;
- API própria **1.3.0**;
- página administrativa `admin-assinaturas.html` para atribuir plano, status, validade e observação;
- herança automática: Profissional inclui Essencial; Elite inclui Profissional + Essencial + Gratuito;
- enforcement no banco para agenda online, quantidade de profissionais, portfólio, destaques e promoções;
- assinatura expirada/pausada perde os benefícios pagos sem anunciar agenda ou promoções públicas indevidamente;
- downgrade preserva histórico/dados e desativa somente capacidades que excedem o plano;
- carteira de clientes/CRM no painel a partir de atendimentos reais;
- promoções públicas gerenciáveis pelo estabelecimento;
- relatórios essenciais, relatórios avançados por profissional/serviço e exportação CSV conforme plano;
- prioridade de relevância no marketplace para Profissional/Elite;
- atualização Realtime de assinatura no painel, sem exigir logout/login;
- desktop e `/mobile` compartilham a mesma regra funcional via sincronização automática.

### Matriz efetiva

| Benefício | Gratuito | Essencial | Profissional | Elite |
|---|---:|---:|---:|---:|
| Agenda online | — | ✓ | ✓ | ✓ |
| Carteira de clientes | — | ✓ | ✓ | ✓ |
| Promoções | — | ✓ | ✓ | ✓ |
| Relatórios essenciais | — | ✓ | ✓ | ✓ |
| Profissionais ativos | 1 | 1 | 3 | 10 |
| Portfólio | 10 | 50 | 150 | 500 |
| Destaques de portfólio | 1 | 2 | 3 | 5 |
| Relatórios avançados | — | — | ✓ | ✓ |
| Exportação CSV | — | — | ✓ | ✓ |
| Prioridade marketplace | — | — | adicional | máxima |

> A cobrança automática ainda não foi integrada. A ativação comercial é administrativa, mas os benefícios e limites já são funcionais de ponta a ponta.

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

A 1.8 usa a migration de assinaturas e a 1.8.2 adiciona o endurecimento da auditoria:

```text
sql/16_assinaturas_entitlements_beneficios.sql
sql/17_correcao_auditoria_seguranca.sql
```

Em banco novo, execute as migrations `01` → `17` em ordem. O Supabase conectado foi encontrado somente até a migration 10; portanto, em produção, valide backup/homologação e aplique `11` → `17` em ordem. Não edite nem reaplique migrations antigas sobre dados reais.

## Variáveis da API na Vercel

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
BARBER_HUB_ALLOWED_ORIGINS
BARBER_HUB_PASSWORD_REDIRECT_URL
BARBER_HUB_TURNSTILE_SITE_KEY
```

A `SUPABASE_SECRET_KEY` nunca deve aparecer no frontend ou no GitHub.

## E-mail e CAPTCHA

O código trata signup sem sessão (fluxo de confirmação de e-mail) e possui integração opcional com Turnstile em `js/security.js`.

Para produção:

1. ative **Confirm Email** no Supabase Auth;
2. habilite CAPTCHA no Supabase Auth;
3. informe a **site key pública** em `BARBER_HUB_TURNSTILE_SITE_KEY`; a secret permanece no Supabase Auth/Cloudflare;
4. ative a proteção contra senhas vazadas no Supabase Auth.

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

- `docs/PRD_BARBER_HUB.md` — PRD atual com revisão da 1.8;
- `ARCHITECTURE.md` — arquitetura e limites entre camadas;
- `docs/API_BARBER_HUB_V1.md` — API e configuração;
- `docs/barberhub-api-v1.openapi.yaml` — contrato estático da API 1.3.1;
- `docs/MAPA_DE_NAVEGACAO.md` — mapa web/mobile atualizado;
- `docs/ATUALIZACAO_1_8.md` — notas e ordem de publicação da release 1.8;
- `docs/VERIFICACAO_1_8.md` — verificação técnica da release 1.8;
- `docs/SEGURANCA_1_6.md` — base de e-mail, CAPTCHA, rate limiting e logs;
- `docs/RELATORIO_SEGURANCA_1_8_2.md` — auditoria diferencial V01–V06 e checklist Supabase;
- `docs/DECISAO_REPOSITORIOS_1_8_2.md` — decisão sobre mobile/API e critérios de separação;
- `docs/ROADMAP_1_9_OPERACAO_CRESCIMENTO.md` — próxima fase de produto;
- `docs/ANTIGRAVITY.md` — uso do projeto com Google Antigravity.

## Deploy

1. confirme backup e use homologação;
2. aplique as migrations pendentes `11` → `17` em ordem;
3. execute `sql/verificar_17_correcao_auditoria.sql`;
4. confirme as variáveis da API e o Turnstile no Supabase Auth;
5. execute `npm run check`;
6. publique código 1.8.2/API 1.3.1;
7. valide V01–V06, planos e os fluxos desktop/mobile antes de promover a produção.

```bash
git status
git add .
git commit -m "fix: corrige auditoria de segurança no Barber Hub 1.8.2"
git push origin main
```
