# Barber Hub 1.9 — Plano de produto, engenharia e publicação

## Objetivo da linha 1.9

A linha 1.9 transforma o Barber Hub de um marketplace com painel operacional inicial em um sistema usado diariamente pelo estabelecimento. A sequência de valor permanece:

**Agenda → Cliente → Dinheiro → Retenção**

A identidade premium escura/quente e dourada permanece inalterada. A evolução visual da 1.9 deve reutilizar os componentes e tokens atuais, priorizando no mobile poucas ações de alto valor em vez de comprimir o painel desktop.

## Diagnóstico da base 1.8.2

| Área | O que já existe | Lacuna para a 1.9 |
|---|---|---|
| Agenda | Agendamento multisserviço, conflito no PostgreSQL, status e lista operacional | Falta visão dia/semana, bloqueio por intervalo/profissional, encaixe, reagendamento transacional, confirmação, no-show e histórico de eventos |
| Clientes | Carteira calculada no navegador a partir dos agendamentos | Falta ficha persistente por estabelecimento, preferências, notas internas, indicadores de retorno e segmentação de inativos |
| Financeiro | Faturamento e ticket calculados a partir dos atendimentos | Falta separar previsto/realizado, comissões, lançamentos, fechamento idempotente e trilha de ajustes |
| Equipe | Cadastro de profissionais e campo opcional `user_id` | Falta convite/vínculo de conta, acesso à agenda individual e papéis básicos de equipe |
| Retenção | Promoções públicas e notificações internas | Falta lista de espera, recorrência, fidelidade, lembretes, campanhas e solicitação de avaliação orientada por evento |
| Crescimento | Relatórios simples e avançados derivados no frontend | Falta cálculo consolidado, metas, ocupação, retenção, oportunidades acionáveis e explicação dos insights |
| API | FastAPI 1.3.1 com serviços separados e domínio offline inicial | Faltam módulos de agenda 2.0, CRM, financeiro, equipe e paginação/contratos próprios para as novas áreas |
| Manutenção | Arquitetura vanilla compartilhada e validadores de release | `js/painel.js` e `js/api.js` concentram responsabilidades demais e precisam ser divididos por domínio sem trocar a stack |

## Pré-requisito obrigatório antes da 1.9

Em 20/08/2026, o projeto Supabase conectado registrava migrations somente até o equivalente à migration 10. As migrations locais 11–17 ainda precisam ser aplicadas, em ordem, antes de qualquer migration da 1.9:

1. planos e assinaturas;
2. comunidade/conta/admin mobile;
3. modais/status/avaliações;
4. API Python e agendamento multisserviço;
5. busca FTS, API e reforços;
6. entitlements e benefícios;
7. correções diferenciais V01–V04.

Depois da aplicação, executar `sql/verificar_17_correcao_auditoria.sql` e repetir os Security e Performance Advisors. A produção também precisa de CAPTCHA/Turnstile, proteção contra senhas vazadas e variáveis seguras no ambiente de deploy. Código versionado não ativa essas opções externas automaticamente.

Até essa validação terminar, a segurança 1.8.2 deve ser descrita como **corrigida no código e pendente de ativação completa no ambiente online**.

## Escopo recomendado para a 1.9.0

A 1.9.0 deve entregar uma operação completa e coerente. Itens de automação e inteligência entram nas atualizações seguintes para não misturar três projetos grandes em um único deploy de alto risco.

### 1. Agenda profissional 2.0

- visão por dia e por semana, com filtro de profissional;
- criação manual de atendimento/encaixe pelo estabelecimento;
- bloqueio por intervalo, profissional ou estabelecimento inteiro;
- intervalos recorrentes de trabalho e pausa;
- reagendamento transacional, preservando origem e histórico;
- confirmação pelo cliente e pelo estabelecimento;
- registro explícito de no-show;
- ações rápidas no mobile: novo atendimento, bloquear horário, confirmar e concluir;
- histórico imutável de alterações relevantes do atendimento;
- mensagem preparada de WhatsApp para confirmação, lembrete manual e retorno.

### 2. CRM 2.0

- ficha do relacionamento entre cliente e estabelecimento;
- total de visitas, última visita, gasto total, ticket médio e próxima visita;
- serviços mais usados e profissional preferido;
- preferências e notas internas separadas de dados públicos;
- contagem de cancelamentos e no-shows;
- segmentos: novos, recorrentes, em risco e inativos;
- busca, filtros e paginação pela API;
- histórico derivado de snapshots do atendimento, não do catálogo mutável.

### 3. Financeiro e comissões

- resumo de receita prevista, realizada, cancelada e ajustada;
- regra de comissão percentual ou valor fixo por profissional/serviço;
- snapshot da regra de comissão no momento da conclusão;
- extrato de lançamentos gerados por eventos do atendimento;
- ajustes manuais com motivo e autoria, sem apagar o lançamento original;
- fechamento do dia idempotente com receita, cancelamentos, no-shows e comissões;
- desempenho por profissional e serviço;
- exportação CSV usando dados consolidados pela API.

### 4. Equipe e acesso operacional básico

- convite ou vínculo seguro entre uma conta e um registro de profissional;
- papéis iniciais: proprietário, gerente, recepção e profissional;
- agenda individual para o profissional vinculado;
- acesso mínimo necessário por papel, aplicado na API e no RLS;
- trilha de auditoria para convite, vínculo, mudança de papel e remoção.

Permissões totalmente personalizáveis continuam reservadas à 1.9.3/Elite. A 1.9.0 precisa apenas dos papéis necessários para a operação segura.

### 5. Ajustes de produto que acompanham os módulos

- navegação profissional mobile: `Painel | Agenda | Clientes | Financeiro | Mais`;
- painel “Hoje” com próximo cliente, pendências, previsão e ações rápidas;
- atualização da história comercial dos planos e dos entitlements reais;
- atualização de privacidade e termos para notas internas, dados financeiros e comunicação;
- estados vazios, carregamento, erro, indisponibilidade e acesso bloqueado por plano;
- acessibilidade por teclado, foco, labels e alvos de toque de pelo menos 44 px;
- fuso horário explícito por estabelecimento, inicialmente `America/Sao_Paulo`.

## Organização técnica da 1.9.0

### Banco e migrations propostas

As migrations devem permanecer idempotentes e ser aplicadas após a 17.

| Migration | Responsabilidade |
|---|---|
| 18 | Base operacional: vínculos de equipe, papéis, blocos de agenda, eventos e campos de confirmação/reagendamento/no-show |
| 19 | CRM por estabelecimento: relacionamento, preferências, notas internas, segmentos e índices |
| 20 | Financeiro: regras de comissão, snapshots, lançamentos, ajustes e fechamentos |
| 21 | Entitlements 1.9 e adaptação segura dos planos existentes |
| 22 | Consolidação de RLS, permissões de funções, índices e correções apontadas pelos Advisors |

Princípios obrigatórios:

- RLS em toda tabela exposta;
- políticas por proprietário, membro autorizado, cliente e administrador;
- nenhuma autorização baseada em `user_metadata` editável;
- funções privilegiadas com execução revogada por padrão e `search_path` explícito;
- ações críticas transacionais no PostgreSQL/RPC;
- nenhuma senha duplicada em tabela pública. A autenticação continua no Supabase Auth, com hash não reversível e fluxo de recuperação.

### Domínio e API Python 1.4.0

Criar módulos menores preservando FastAPI e o gateway Supabase atuais:

```text
backend/domain/
├── schedule.py
├── crm.py
├── finance.py
└── permissions.py

backend/services/
├── schedule.py
├── crm.py
├── finance.py
└── team.py
```

Contratos novos em `/api/v1`:

```text
/schedule
├── GET  /range
├── POST /walk-ins
├── POST /blocks
├── PATCH /appointments/{id}/reschedule
├── PATCH /appointments/{id}/confirmation
└── PATCH /appointments/{id}/no-show

/crm/clients
├── GET  /
├── GET  /{id}
├── PATCH /{id}
└── POST /{id}/notes

/finance
├── GET  /summary
├── GET  /entries
├── POST /adjustments
├── GET  /commissions
└── POST /closings

/team
├── GET   /members
├── POST  /members
└── PATCH /members/{id}
```

As regras de cálculo, transição, comissão, classificação de cliente e permissões devem ser testáveis offline. A API valida o payload e a sessão; o PostgreSQL confirma integridade, autorização e concorrência.

### Frontend sem mudança de arquitetura

Continuar com HTML/CSS/JavaScript modular, sem introduzir SPA ou novo framework. Na 1.9.0 a nova operação fica isolada em uma camada compatível:

```text
js/painel-operacao-1.9.js
├── agenda
├── CRM
├── financeiro
└── acessos da equipe

js/backend-api.js
└── contratos HTTP compartilhados
```

`js/api.js` permanece como camada de compatibilidade durante a migração. Desktop e mobile continuam compartilhando regras e serviços; somente a composição visual e a ordem de navegação são específicas. Não há justificativa para separar repositórios na 1.9.

## Atualização posterior da linha 1.9

### 1.9.3 — Retenção & Inteligência

A 1.9.3 reúne os escopos antes chamados de 1.9.1 e 1.9.2. O desenvolvimento foi concluído no código e aguarda migrations 24/25, verificação e configuração externa antes do deploy.

**Retorno e relacionamento**

- lista de espera e aviso de vaga;
- agendamento recorrente;
- programa de fidelidade e recompensas;
- cupons com regras de validade e uso;
- campanhas segmentadas;
- lembretes automáticos por provedor externo;
- solicitação de avaliação após conclusão.

**Crescimento orientado a ação**

- Central de Oportunidades;
- insights de ocupação, ticket, recorrência e serviços;
- metas do negócio e da equipe;
- desempenho comparativo da equipe;
- recuperação de clientes inativos;
- permissões granulares configuráveis para o plano Elite.

## Itens deliberadamente fora da 1.9.0

- gateway de pagamento automático dos planos;
- aplicativo nativo em outro repositório;
- migração obrigatória da API para FastAPI Cloud;
- envio automático de WhatsApp sem provedor, consentimento e política definidos;
- inteligência generativa para recomendações;
- senha visível ou descriptografável em qualquer painel.

O FastAPI Cloud pode receber a API futuramente, mas a 1.9 deve primeiro estabilizar os contratos e a observabilidade. A API atual na Vercel continua válida enquanto atender disponibilidade e tempo de resposta.

## Qualidade e testes de regressão

### Banco

- migrations aplicadas em ambiente de teste antes da produção;
- testes de RLS para cliente, profissional, recepção, gerente, proprietário, admin e usuário sem vínculo;
- concorrência em reagendamento, encaixe, limite de plano e fechamento;
- idempotência de fechamento e geração de lançamentos;
- Advisors de segurança e performance revisados após cada migration.

### Domínio/API

- transições de agenda e confirmação/no-show;
- cálculo de duração, conflito e bloqueios;
- cálculo de comissão percentual/fixa e arredondamento;
- classificação de cliente e inatividade;
- autorização por papel;
- paginação, filtros, limites, rate limit e falhas do Supabase;
- OpenAPI e documentação atualizados.

### Interface/PWA

- fluxos completos de proprietário e profissional em desktop e mobile;
- larguras 360, 390, 412, 768 e desktop;
- sincronização mobile, rotas, manifesto, cache e modo offline;
- foco, teclado, leitores de tela e estados de erro;
- nenhum cálculo financeiro ou limite de plano confiado somente ao navegador.

## Pacote que deve acompanhar a 1.9.0

- código fonte versionado como 1.9.0;
- API versionada como 1.4.0;
- migrations 18–22 e verificadores SQL;
- OpenAPI atualizado;
- mapa de navegação atualizado;
- relatório de atualização da release;
- relatório de migrations/configurações pendentes;
- matriz de entitlements por plano;
- checklist de rollback e backup;
- resultados dos testes e Advisors;
- ZIP sem `.env`, chaves, `.git` ou dependências locais.

## Ordem de implementação

1. modelar migrations 18–22 e testes de RLS sem alterar o ambiente online;
2. implementar domínio offline de agenda, permissões, CRM e financeiro;
3. publicar contratos e serviços da API 1.4.0;
4. modularizar o painel e conectar a agenda 2.0;
5. conectar CRM, financeiro/comissões e equipe;
6. ajustar mobile, planos, privacidade, termos e documentação;
7. executar regressão completa do pacote local;
8. aplicar e verificar a base 11–17 em ambiente controlado;
9. aplicar 18–22, executar Advisors, testar rollback e só então fazer deploy monitorado.

## Critérios de aceite da 1.9.0

A release só está pronta quando:

- a agenda dia/semana não permite conflito nem violação de bloqueio;
- todo reagendamento possui histórico e é atômico;
- um profissional vinculado enxerga apenas o que seu papel permite;
- CRM e financeiro não dependem de recomputação no navegador;
- comissão e fechamento são reproduzíveis e auditáveis;
- desktop e mobile concluem os fluxos prioritários;
- migrations, RLS, API, PWA e testes passam no pipeline;
- pendências externas estão configuradas e verificadas no ambiente alvo.
