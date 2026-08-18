# Mapa de navegação do Barber Hub 1.7

O Barber Hub possui duas apresentações da mesma plataforma: web (`/html`) e app mobile (`/mobile`). Regras de negócio, API e scripts de domínio são compartilhados. Na 1.7, as páginas funcionais mobile são sincronizadas a partir das equivalentes web para impedir deriva de recursos.

## Cliente — fluxo principal

```text
Início
  ↓
Explorar
  ├── Destaques
  ├── Busca FTS
  ├── Filtros rápidos
  └── Carregar mais
  ↓
Estabelecimento
  ├── Status
  ├── Serviços
  ├── Profissionais
  ├── Portfólio
  ├── Avaliações
  └── [Agendar]
         ↓ modal
      Serviços
         ↓
      Profissional
         ↓
      Data / horário
         ↓
      Confirmar
  ↓
Minha agenda
  ├── Próximos
  ├── Cancelar
  ├── Histórico
  ├── Avaliar
  └── Agendar novamente
```

## Profissional — fluxo principal

```text
Criar conta profissional
  ↓
Onboarding do estabelecimento
  ↓
Painel
  ├── Operação de hoje
  ├── Hoje / A confirmar / Equipe / Reputação
  ├── Status automático / aberto / fechado
  ├── Agenda
  ├── Serviços
  ├── Profissionais (+ foto)
  ├── Horários e dias bloqueados
  ├── Portfólio
  ├── Avaliações
  ├── Relatórios
  ├── Configuração
  └── Página pública
```

## Administrador

```text
Admin
  ├── Saúde da plataforma (API / DB / Auth / FTS)
  ├── KPIs globais via API
  ├── Pendências / conclusão / verificação / agenda online
  ├── Usuários
  ├── Estabelecimentos
  ├── Agendamentos
  ├── Avaliações
  ├── Moderação
  └── Tickets

Páginas administrativas relacionadas
  ├── Mapa do sistema
  ├── Notificações
  ├── Suporte
  └── Conta
```

> Usuários, Estabelecimentos, Agendamentos, Avaliações, Moderação e Tickets são **seções do dashboard Admin**, não páginas independentes. Por isso não aparecem como destinos da navegação global.

## Navegação web

| Destino | Arquivo | Estado 1.7 | Papel |
|---|---|---|---|
| Início | `index.html` | ✅ | Landing e instalação PWA |
| Explorar | `html/portal.html` | ✅ | Marketplace FTS/paginado |
| Estabelecimento | `html/barbearia.html` | ✅ | Página pública + modal de agendamento |
| Agendamento legado | `html/agendamento.html` | ✅ Compatibilidade | Redireciona para estabelecimento + modal |
| Cliente | `html/cliente.html` | ✅ | Agenda, indicadores, favoritos e histórico |
| Profissional | `html/painel.html` | ✅ | Gestão operacional + indicadores |
| Admin | `html/admin.html` | ✅ | Controle, health e indicadores da plataforma |
| Conta | `html/conta.html` | ✅ | Perfil, senha, exclusão |
| Notificações | `html/notificacoes.html` | ✅ | Inbox in-app |
| Planos | `html/planos.html` | 🟡 Comercial | Sem gateway de cobrança |
| Suporte | `html/contato.html` | ✅ | Tickets via API |
| Sobre | `html/sobre.html` | ✅ | Institucional |
| Beauty Hub | `html/beauty-hub.html` | 🟡 Preparação | Visão e roadmap da expansão |
| Mapa | `html/mapa-sistema.html` | ✅ | Estado técnico + API audit |

## Navegação mobile dedicada

Os equivalentes funcionais ficam em `/mobile/*.html`. O PWA inicia em `/mobile/index.html`. O topo contém tema, notificações e **menu hambúrguer** para o drawer de conta/logout.

### Cliente

```text
Início | Explorar | Agenda | Avisos | Conta
```

### Profissional

```text
Painel | Agenda | Explorar | Avisos | Conta
```

### Administrador

```text
Admin | Mapa | Avisos | Suporte | Conta
```

### Visitante

```text
Início | Explorar | Entrar | Criar | Suporte
```

## Resolução de URLs em `/mobile`

```text
html/portal.html       → /mobile/portal.html
html/conta.html        → /mobile/conta.html
img/...                → /img/...
service-worker.js      → /service-worker.js
index.html             → /mobile/index.html
```

Essas regras são verificadas automaticamente por `scripts/check-mobile-routing.js`.

## Backend/API

```text
/api/v1
├── health
├── catalog/summary
├── marketplace
│   ├── search
│   └── featured
├── appointments
│   ├── POST /
│   ├── PATCH /{id}/status
│   └── DELETE /{id}
├── establishments
│   ├── PATCH /{id}
│   └── PATCH /{id}/status
├── services
│   ├── POST /
│   └── PATCH / DELETE /{id}
├── professionals
│   ├── POST /
│   └── PATCH / DELETE /{id}
├── support/tickets
├── account
└── admin
    ├── overview
    ├── health
    ├── navigation-audit
    └── users/{id}/password-recovery
```

## Regra de navegação atual

O usuário não navega para uma página de “Agendar” como destino principal. Ele escolhe um estabelecimento e abre o fluxo contextual em modal. No admin, a navegação global representa somente destinos distintos; se algo é apenas uma seção interna do dashboard, permanece como seção.


## Barber Hub 1.8 — Assinaturas

- `/html/admin-assinaturas.html` → central administrativa de planos, status, validade e benefícios.
- `/mobile/admin-assinaturas.html` → equivalente mobile gerado da mesma fonte funcional.
- `/html/painel.html#clientes` → carteira de clientes (Essencial+).
- `/html/painel.html#promocoes` → gestão de promoções (Essencial+).
- `/html/painel.html#relatorios` → relatórios essenciais/avançados conforme entitlement.

A navegação admin global aponta para **Assinaturas** como página real, não como âncora de `admin.html`.
