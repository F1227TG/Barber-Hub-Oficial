# Barber Hub — regra de contexto permanente

Este repositório contém o Barber Hub, uma plataforma brasileira da The Gamers Tech que combina portal público e gestão de barbearias.

## Objetivo do produto

Priorizar estes fluxos:

1. Cliente cria conta, encontra um estabelecimento, consulta se está aberto e agenda.
2. Profissional configura o negócio, agenda, serviços, equipe, portfólio e status.
3. Administrador controla usuários, negócios, moderação e suporte.

## Stack atual

- HTML sem framework de SPA.
- CSS próprio com Bootstrap local apenas como apoio de componentes.
- JavaScript modular por página.
- API própria em Python/FastAPI (`api/index.py` e `backend/`).
- Supabase para Auth, PostgreSQL, RLS, Storage e Realtime.
- Vercel para site e API.

## Regras obrigatórias

- Nunca colocar `SUPABASE_SECRET_KEY` ou `service_role` em HTML/JS público.
- Nunca tentar exibir senhas. Usar recuperação/redefinição.
- Manter compatibilidade mobile e PWA.
- Não remover RLS nem contornar regras de negócio no frontend.
- Toda alteração de banco deve gerar migration idempotente em `sql/`.
- Atualizar `docs/MAPA_DE_NAVEGACAO.md` quando criar/remover páginas.
- Executar os validadores antes de concluir uma tarefa.

Leia também: @ARCHITECTURE.md e @docs/MAPA_DE_NAVEGACAO.md
