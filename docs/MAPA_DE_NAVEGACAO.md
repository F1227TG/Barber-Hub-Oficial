# Mapa de navegação do Barber Hub 1.6

O Barber Hub possui duas apresentações da mesma plataforma: web (`/html`) e app mobile (`/mobile`). Regras de negócio e API são compartilhadas.

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
  ├── Saúde da plataforma (API / DB / Auth)
  ├── KPIs globais via API
  ├── Usuários
  ├── Estabelecimentos
  ├── Agendamentos
  ├── Avaliações
  ├── Moderação
  ├── Tickets
  └── Mapa do sistema (auditoria via API)
```

## Navegação web

| Destino | Arquivo | Estado 1.6 | Papel |
|---|---|---|---|
| Início | `index.html` | ✅ | Landing e instalação PWA |
| Explorar | `html/portal.html` | ✅ | Marketplace FTS/paginado |
| Estabelecimento | `html/barbearia.html` | ✅ | Página pública + modal de agendamento |
| Agendamento legado | `html/agendamento.html` | ✅ Compatibilidade | Redireciona para estabelecimento + modal |
| Cliente | `html/cliente.html` | ✅ | Agenda, favoritos e histórico |
| Profissional | `html/painel.html` | ✅ | Gestão operacional |
| Admin | `html/admin.html` | ✅ | Controle da plataforma e saúde da API |
| Conta | `html/conta.html` | ✅ | Perfil, senha, exclusão |
| Notificações | `html/notificacoes.html` | ✅ | Inbox in-app |
| Planos | `html/planos.html` | 🟡 Comercial | Sem gateway de cobrança |
| Suporte | `html/contato.html` | ✅ | Tickets via API |
| Sobre | `html/sobre.html` | ✅ | Institucional |
| Mapa | `html/mapa-sistema.html` | ✅ 1.6 | Estado técnico + API audit |

## Navegação mobile dedicada

Os equivalentes ficam em `/mobile/*.html`. O PWA inicia em `/mobile/index.html`.

### Cliente

```text
Início | Explorar | Agenda | Avisos | Conta
```

### Profissional

```text
Painel | Agenda | Serviços | Avisos | Conta
```

### Administrador

```text
Resumo | Negócios | Usuários | Avisos | Conta
```

### Visitante

```text
Início | Explorar | Entrar | Criar | Suporte
```

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

## Regra de navegação da 1.6

O usuário **não navega mais para uma página de “Agendar”** como destino principal. Ele escolhe primeiro um estabelecimento; o agendamento é uma ação contextual daquele perfil.
