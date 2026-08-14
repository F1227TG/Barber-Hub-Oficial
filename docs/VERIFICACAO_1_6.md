# Barber Hub 1.6.0 — Relatório de dupla verificação

Este relatório registra duas rodadas de revisão da release 1.6, incluindo uma comparação direta entre o PRD revisado e o escopo solicitado para marketplace, agendamento, mobile, temas, painéis, segurança e API Python.

## Verificação 1 — estrutura + testes + invariantes da release

Executado após a integração das rotas Python de gestão:

```bash
npm run check
python scripts/audit_release_1_6.py
```

Resultado:

- 48 páginas HTML verificadas sem IDs duplicados ou links locais quebrados;
- nenhum segredo administrativo detectado nos arquivos públicos auditados;
- validação estrutural concluída sem erros;
- 9 testes Python/FastAPI aprovados;
- 44/44 invariantes da release aprovadas;
- PRD contém a revisão pós-implementação 1.6 e reflete marketplace FTS, agendamento modal, mobile dedicado, temas, painéis, API 1.2, rate limiting, logs e segurança.

## Verificação 2 — execução limpa + revisão independente do escopo

Antes da segunda rodada, caches Python foram removidos. Foram executados:

```bash
npm run check
python scripts/audit_release_1_6.py
python scripts/verify_scope_1_6.py
```

Resultado final:

- 31 arquivos centrais obrigatórios encontrados;
- 48 páginas HTML válidas na auditoria estrutural;
- 36 arquivos JavaScript passaram por `node --check`;
- 9 testes Python/FastAPI aprovados;
- 44/44 invariantes técnicas da release aprovadas;
- 28/28 requisitos do escopo do usuário aprovados.

## Matriz final do escopo 1.6

| Área | Resultado | Evidência principal |
|---|---|---|
| Pesquisa + filtros compactos | ✅ | `html/portal.html`, `js/portal.js` |
| Cards menores e objetivos | ✅ | `js/portal.js`, `css/release-1.6.css` |
| FTS + GIN + ILIKE fallback | ✅ | `sql/15_marketplace_fts_api_seguranca.sql` |
| Ranking, destaques e paginação | ✅ | migration 15 + API marketplace |
| Carregar mais | ✅ | `js/portal.js` |
| Agendamento como modal | ✅ | `js/booking-modal.js` |
| Multi-serviço | ✅ | modal + API + migration 14 |
| Profissional em radio-card com foto | ✅ | `js/booking-modal.js` |
| Página Agendar removida da navegação | ✅ | rota legada apenas redireciona |
| HTML mobile dedicado | ✅ | 22 páginas em `/mobile/` |
| PWA abre experiência mobile | ✅ | `manifest.webmanifest` |
| Tema escuro suavizado | ✅ | tokens em `css/release-1.6.css` |
| Tema claro redesenhado | ✅ | off-white/bege e tokens próprios |
| Painel cliente reorganizado | ✅ | command center em cliente |
| Painel profissional reorganizado | ✅ | operação de hoje + status rápido |
| Exclusão com frase forte | ✅ | `EXCLUIR MINHA CONTA` no front e backend |
| Cancelamento/status via Python | ✅ | API 1.2 |
| Gestão de estabelecimento via Python | ✅ | Pydantic + token do usuário + RLS |
| CRUD de serviços via Python | ✅ | API 1.2 + RLS |
| CRUD de profissionais via Python | ✅ | API 1.2 + RLS |
| Saúde da API no admin | ✅ | `/api/v1/admin/health` |
| Rate limiting próprio | ✅ | PostgreSQL + FastAPI |
| Mensagens 429/503 | ✅ | gateway Python + frontend |
| Logs mínimos/request id | ✅ | middleware FastAPI |
| Confirmação de e-mail preparada | ✅ | Auth frontend + backend |
| CAPTCHA preparado | ✅ | Turnstile opcional |
| PRD revisado | ✅ | seção 29 do PRD 1.6 |
| Mapa de navegação atualizado | ✅ | web + mobile + API |

## Pontos que dependem do ambiente de produção

Os seguintes itens não podem ser declarados ativos apenas pelo código local:

1. executar a migration 15 no Supabase de produção;
2. habilitar **Confirm Email** no painel Supabase Auth;
3. habilitar CAPTCHA no Supabase e configurar a site key pública, caso a equipe decida ativá-lo agora;
4. publicar a 1.6 na Vercel e confirmar os endpoints no domínio de produção;
5. fazer teste visual/manual em navegador real e Android/PWA após o deploy.

A tentativa de automatizar screenshots com Chromium headless neste ambiente não foi confiável; portanto este relatório não substitui a validação visual em aparelho real.
