# Arquitetura do Barber Hub

## Visão geral

```text
HTML/CSS/JavaScript + PWA
            │
            ├── consultas públicas e Realtime controlados por RLS
            │
            └── /api/v1 (Python/FastAPI)
                       │
                       └── Supabase
                           ├── Auth
                           ├── PostgreSQL + RPC + RLS
                           ├── Storage
                           └── Realtime
```

## Pastas

- `html/`: páginas internas.
- `css/`: base, páginas, mobile e redesign.
- `js/`: interface, autenticação e lógica por página.
- `api/index.py`: entrada FastAPI na Vercel.
- `backend/`: configuração, segurança, modelos e serviços Python.
- `sql/`: schema e migrations.
- `.agents/`: regras e skills para Google Antigravity.
- `docs/`: guias, mapa e notas de release.

## Limite de responsabilidade

- Frontend: experiência e validação imediata.
- API Python: autenticação de rota, validação, operações sensíveis e integrações.
- PostgreSQL/RPC: transações, sobreposição de agenda e integridade.
