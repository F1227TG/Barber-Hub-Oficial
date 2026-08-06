# Mapa de navegação do Barber Hub 1.5

Este documento registra a responsabilidade de cada página e seu estado. A versão visual está em `html/mapa-sistema.html`.

## Fluxo principal do cliente

```text
Criar conta / Entrar
        ↓
Explorar estabelecimentos
        ↓
Ver status, serviços e avaliações
        ↓
Selecionar vários serviços
        ↓
Escolher profissional, data e horário
        ↓
Acompanhar, concluir e avaliar
```

## Fluxo principal do profissional

```text
Criar conta profissional
        ↓
Cadastrar estabelecimento
        ↓
Configurar serviços, equipe e horários
        ↓
Controlar status aberto/fechado/automático
        ↓
Receber e atualizar agendamentos
        ↓
Publicar portfólio e acompanhar métricas
```

## Páginas públicas

| Página | Arquivo | Estado | Responsabilidade |
|---|---|---|---|
| Início | `index.html` | Funcional | Apresentação, instalação PWA e atalhos principais |
| Explorar | `html/portal.html` | Funcional | Busca e filtros do catálogo |
| Estabelecimento | `html/barbearia.html` | Funcional | Página pública completa |
| Agendamento | `html/agendamento.html` | Requer migration 14 | Reserva com múltiplos serviços |
| Planos | `html/planos.html` | Comercial | Apresentação, sem cobrança real |
| Suporte | `html/contato.html` | API Python | Tickets e histórico |
| Sobre | `html/sobre.html` | Institucional | Objetivo e The Gamers Tech |

## Áreas autenticadas

| Perfil | Página principal | Funções |
|---|---|---|
| Cliente | `html/cliente.html` | Agenda, histórico, favoritos e avaliações |
| Profissional | `html/painel.html` | Operação, catálogo, equipe, portfólio e relatórios |
| Administrador | `html/admin.html` | Usuários, negócios, moderação e suporte |

## Backend

| Camada | Local | Papel |
|---|---|---|
| API FastAPI | `api/index.py`, `backend/` | Validação e operações sensíveis |
| Cliente da API | `js/backend-api.js` | Comunicação do navegador com `/api/v1` |
| Banco/RPC | `sql/` | Transações e regras de integridade |
| Supabase Auth | Externo | Cadastro, sessão e recuperação de senha |
| Vercel | Externo | Site estático e API Python |
