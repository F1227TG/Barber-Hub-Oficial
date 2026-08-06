# Barber Hub — versão 1.5.0

O Barber Hub conecta clientes e barbearias em uma única plataforma: descoberta,
status de funcionamento, agendamento, avaliações, presença digital e gestão.
É uma plataforma de **The Gamers Tech**.

## Entrega 1.5.0

- redesign orientado às tarefas principais de clientes e profissionais;
- chamada de instalação do PWA em destaque na página inicial;
- agendamento sem repetir dados já presentes na conta;
- seleção de até oito serviços no mesmo horário;
- duração e valor totais calculados automaticamente;
- API própria em Python com FastAPI;
- recuperação segura de senha iniciada pelo administrador;
- mapa visual de páginas, fluxos e responsabilidades;
- regras e skills locais para Google Antigravity;
- auditoria local de links, IDs, estrutura e segredos.

## Arquitetura

```text
Navegador / PWA / futuro app Android
                 │
                 ├── consultas públicas e Realtime autorizados
                 │
                 ▼
        Barber Hub API — FastAPI
                 │
                 ▼
 Supabase Auth + PostgreSQL + Storage
```

O Supabase continua sendo banco e provedor de autenticação. A API Python
centraliza operações sensíveis e regras que não devem ficar no navegador.

## Tecnologias

- HTML, CSS e JavaScript;
- Bootstrap local, usado de forma complementar;
- Python 3.13 e FastAPI;
- Supabase Auth, PostgreSQL, Storage, RLS e Realtime;
- Vercel para frontend e funções Python;
- PWA com Service Worker e manifesto.

## Configuração da API

Crie as seguintes variáveis na Vercel:

```text
SUPABASE_URL
SUPABASE_PUBLISHABLE_KEY
SUPABASE_SECRET_KEY
BARBER_HUB_ALLOWED_ORIGINS
BARBER_HUB_PASSWORD_REDIRECT_URL
```

A chave secreta nunca deve aparecer em HTML, JavaScript, repositório ou
aplicativo. Use `.env.example` como modelo, sem preencher valores reais nele.

## Banco de dados

Em um banco já atualizado até a versão 1.4.1, execute somente:

```text
sql/14_api_python_agendamento_multisservicos.sql
```

Em um projeto novo, execute as migrations de `01` a `14`, em ordem. A migration
`01` recria a estrutura principal e não deve ser reaplicada sobre produção com
dados reais.

## Desenvolvimento local

O Live Server executa somente os arquivos estáticos. Para testar frontend e API
juntos:

```bash
npm install -g vercel
vercel login
vercel link
vercel env pull .env.local
vercel dev
```

Documentação automática da API durante o desenvolvimento:

```text
http://localhost:3000/api/docs
```

## Verificação antes do commit

```bash
npm run check
```

O comando verifica JavaScript/estrutura do projeto e compila os módulos Python.
O roteiro funcional está em `docs/TESTES_INTEGRACAO.md`.

## Documentação principal

- `ARCHITECTURE.md`: arquitetura e limites entre camadas;
- `docs/API_BARBER_HUB_V1.md`: endpoints e configuração do backend;
- `docs/MAPA_DE_NAVEGACAO.md`: páginas e fluxos;
- `docs/GUIA_DE_CODIGO.md`: responsabilidade dos arquivos;
- `docs/ANTIGRAVITY.md`: uso seguro do Google Antigravity;
- `docs/ATUALIZACAO_1_5.md`: alterações e roteiro desta versão.

## Senhas e administração

Senhas não são armazenadas de forma legível. O painel administrativo oferece
**Redefinir senha**, que envia ao titular um fluxo de recuperação. Não adicione
funções para revelar, registrar ou enviar senhas em texto puro.

## Deploy

```bash
git status
git add .
git commit -m "Atualiza Barber Hub para versão 1.5.0"
git push origin main
```

Depois do deploy, valide:

```text
/api/v1/health
/api/docs
```
