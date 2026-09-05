# Arquitetura do Barber Hub 1.10.1

## Visão geral

```text
Navegador/PWA
├─ desktop: html/*.html
├─ mobile: mobile/*.html
└─ módulos compartilhados: js/ + css/
                │
                ├─ leituras públicas simples sob RLS
                └─ /api/v1/*
                       │
                 FastAPI 1.6.1
                 ├─ autenticação e rate limit
                 ├─ validação Pydantic
                 ├─ regras em backend/domain
                 └─ serviços em backend/services
                       │
                       ▼
                 Supabase
                 ├─ Auth
                 ├─ PostgreSQL + RLS + RPC
                 ├─ Storage
                 └─ Realtime
```

## Fronteiras

### Interface

`html/` contém as páginas canônicas. `mobile/` é gerado por `scripts/sync_mobile_pages.py`, recebe cabeçalho/dock próprios e prioriza tarefas rápidas. JavaScript e CSS são compartilhados para evitar duas implementações divergentes.

Novos módulos ficam em:

- `js/core/`: conectividade, repetição segura e infraestrutura de navegador;
- `js/features/`: recursos isolados da release 1.10;
- `css/releases/`: camadas visuais versionadas sem romper o tema premium escuro/quente e dourado.

### API

`api/index.py` declara as rotas. A regra crítica não deve viver dentro do handler:

- `backend/models.py`: contratos de entrada;
- `backend/security.py`: identidade e autorização base;
- `backend/rate_limit.py`: cotas por rota/identidade;
- `backend/domain/`: funções puras testáveis sem internet;
- `backend/services/`: orquestração e acesso ao Supabase;
- `backend/supabase.py`: gateway HTTP centralizado.

As regras puras cobrem agenda, planos, CRM, finanças, retenção, crescimento, permissões, importação e normalização operacional. Assim, parte relevante da API pode ser validada mesmo sem Supabase disponível.

### Banco

O PostgreSQL é a última barreira de integridade. Validações de interface melhoram a experiência; Pydantic rejeita entradas inválidas; RLS/RPC/constraints impedem acesso e estados proibidos mesmo quando uma chamada é feita fora da interface.

Princípios:

- RLS habilitado em tabelas expostas;
- escrita sensível por RPC transacional;
- `SECURITY DEFINER` com `search_path` vazio e schema explícito;
- execução de funções sensíveis revogada de `anon`;
- idempotência para impedir lançamentos duplicados;
- exclusão lógica quando o histórico precisa permanecer;
- auditoria append-only com anonimização controlada de vínculos apagados;
- paginação e limites máximos nas coleções.

## Fluxos principais

### Marketplace regional

```text
Portal → /marketplace/search ou /regional
       → filtros de serviço/região/distância
       → RPC indexada + limite/paginação
       → cards, mapa OpenStreetMap e rota externa
```

A localização só é solicitada após ação do usuário. A busca textual continua disponível quando a permissão é negada.

### Agendamento e operação

```text
Estabelecimento → serviço → profissional → data/horário → revisão
       │
       ├─ usuário autenticado: cria agendamento por RPC
       └─ login necessário: guarda contexto mínimo local e retoma depois

Painel profissional → agenda/períodos/bloqueios
                    → atendimento manual/avulso
                    → financeiro idempotente
```

O banco impede sobreposição e normaliza origem/meio de pagamento. Serviço avulso recebe nome/duração e é privado no catálogo.

### Retenção e inteligência

Lista de espera, recorrência, fidelidade, cupons, campanhas, oportunidades, insights e metas respeitam o plano efetivo. Permissões granulares combinam papel base e substituições autorizadas do plano Elite.

### Importação

```text
CSV/XLSX → prévia limitada → validação/deduplicação
         → confirmação explícita → gravação/auditoria
         → relatório de aceitas, rejeitadas e motivos
```

Fórmulas são rejeitadas e a mesma importação não deve ser confirmada duas vezes.

### Avisos

Preferências, consentimento e horário silencioso ficam separados da entrega. Notificação interna funciona como fallback. Web Push usa um job autenticado, reivindicação atômica da fila, repetição limitada e desativação de assinaturas expiradas; a entrega externa ainda depende de chaves VAPID e `CRON_SECRET` no deploy.

## Segurança e credenciais

- chave pública pode existir no navegador somente com RLS correto;
- chave privada/service role fica apenas no backend/deploy;
- senha pertence ao Supabase Auth como hash não reversível;
- administrador envia redefinição, nunca visualiza senha;
- CAPTCHA, proteção contra senha vazada e URLs autorizadas dependem do provedor;
- logs, importações e auditoria não armazenam tokens, segredos ou senhas.

## Migrations

Arquivos históricos numerados permanecem em `sql/`; migrations novas gerenciadas pela CLI ficam em `supabase/migrations/`. No ambiente conectado, os objetos 29–31 existem, mas a execução manual não foi registrada no histórico. A 1.10.1 acrescenta `20260904180741_32_conclusao_pos31_1_10_1.sql` e `sql/verificar_32_conclusao_1_10_1.sql`.

## Deploy e reversão

API, frontend e PWA devem ser publicados juntos depois do banco e da homologação. Reversão de código promove o commit anterior; banco com dados reais nunca recebe `DROP` improvisado. Uma correção de banco ganha uma nova migration.

## Decisão de monorepo

Barber Hub web, PWA/mobile e API permanecem no mesmo repositório até existirem ciclos de release ou equipes independentes. Beauty Hub é um produto irmão em repositório próprio. A integração futura ocorre por contrato/pacote versionado, sem copiar segredos ou compartilhar tabelas de produção por conveniência.
