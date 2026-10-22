# Plano geral de modernização e evolução do Barber Hub

**Base oficial do planejamento — registrada em 22/10/2026.**

Origem: diretrizes fornecidas pelo responsável pelo projeto nesta data. Este documento consolida essas diretrizes e acrescenta uma sequência operacional com critérios de conclusão. O plano permanece como direção de trabalho; a **execução local parcial** está registrada no [relatório da primeira etapa](modernizacao/ETAPA_1.md). Esse relatório distingue implementação, evidências e pendências de homologação/publicação. Prazos, responsáveis e versão de entrega serão definidos conforme o levantamento.

## Objetivo e contexto

O Barber Hub passará por uma ampla etapa de modernização técnica, estrutural e de segurança. O objetivo não será apenas adicionar funcionalidades, mas reorganizar a base para transformar um sistema desenvolvido progressivamente por versões em uma plataforma organizada, modular, segura, testável e preparada para crescimento comercial.

O produto funciona simultaneamente como **marketplace de serviços e sistema SaaS de gestão para barbearias**. Clientes encontram estabelecimentos, conhecem serviços e profissionais e realizam agendamentos. Barbeiros e proprietários administram agenda, clientes, equipe, CRM, financeiro, assinaturas, promoções, notificações e o negócio.

O princípio central será a **separação clara de responsabilidades**: cada parte terá função específica e localização previsível, facilitando a manutenção por pessoas e a análise por ferramentas e inteligências artificiais.

A modernização deverá preservar as funcionalidades já construídas.

## Como este plano se relaciona com a documentação existente

- Este documento orienta a arquitetura futura e a ordem da modernização.
- O [guia completo](GUIA_COMPLETO_DO_PROJETO.md), a [arquitetura documentada](../ARCHITECTURE.md) e os [registros da versão 1.11](release-1.11/README.md) continuam sendo referências para investigar o estado existente. Suas afirmações deverão ser verificadas durante a auditoria.
- Orientações anteriores para criar CSS por release descrevem a organização anterior. A direção passa a ser organizar por responsabilidade, com migração gradual e validação da cascata.
- O [plano visual 1.12](PLANO_ATUALIZACAO_VISUAL_1_12.md) é uma iniciativa de interface relacionada. Mudanças visuais deliberadas deverão ser distinguidas de regressões causadas pela refatoração.
- A [decisão anterior sobre repositórios](DECISAO_REPOSITORIOS_1_10.md) permanece como histórico. A nova direção é preparar a extração da API, condicionada à independência real entre frontend e backend.
- As árvores de diretórios abaixo são propostas de destino. Não indicam que essas pastas já existem ou autorizam movimentações sem mapear dependências.

## Refatoração e organização geral do repositório

A primeira etapa será auditar a estrutura atual, identificando arquivos de releases, correções, hotfixes e funcionalidades. Será necessário distinguir arquivos com função real, código duplicado, implementações substituídas e candidatos à remoção.

**Nenhum arquivo será excluído apenas por parecer antigo.** Antes de qualquer remoção, serão verificados seus usos e as funcionalidades dependentes, incluindo referências indiretas em carregamento de scripts, estilos, rotas, geração de páginas e ferramentas de manutenção.

A reorganização estabelecerá regras de localização para novos recursos, evitando acumular novamente implementações sem responsabilidade clara. Arquivos de compatibilidade necessários poderão permanecer, identificados como legado.

## Reestruturação completa do CSS

Os estilos hoje distribuídos por arquivos de releases serão gradualmente consolidados por função. A estrutura de destino proposta é:

```text
css/
├── core/
├── components/
├── pages/
├── features/
└── mobile/
```

Botões, formulários, modais, cards, tabelas e navegação terão módulos reutilizáveis. Estilos de páginas serão separados de funcionalidades como agendamento, CRM, financeiro e assinaturas; adaptações mobile terão responsabilidade explícita.

Arquivos como `release-1.7.css`, `release-1.7.1.css`, `release-1.9.css`, `release-1.9.3.css`, `release-1.10.css` e `release-1.11.css` representam o modelo a substituir. Sua existência e seus caminhos efetivos serão confirmados no inventário.

Cada consolidação deverá preservar a ordem necessária da cascata, os temas, os estados dos componentes e a responsividade. Arquivos antigos só serão removidos depois de testes comprovarem a preservação da funcionalidade e da aparência esperada.

## Organização do JavaScript

Autenticação, navegação, cliente de API, componentes de interface e recursos de negócio terão responsabilidades separadas. Os domínios incluem:

- agendamento;
- CRM;
- financeiro;
- assinaturas;
- notificações;
- marketplace;
- administração;
- conta.

A auditoria distinguirá scripts ativos, scripts necessários apenas por compatibilidade e scripts sem uso comprovado. Compatibilidade não será confundida com a implementação principal. Recursos compartilhados entre desktop e mobile deverão evitar duplicação de regras de negócio.

## Modularização da API

A API evoluirá para um **monólito modular**: inicialmente uma aplicação e um backend, com domínios internos delimitados por contratos e responsabilidades próprias.

Uma estrutura possível é:

```text
app/
├── core/
├── modules/
│   ├── accounts/
│   ├── admin/
│   ├── appointments/
│   ├── marketplace/
│   ├── establishments/
│   ├── professionals/
│   ├── schedule/
│   ├── subscriptions/
│   ├── crm/
│   ├── finance/
│   ├── notifications/
│   ├── retention/
│   ├── support/
│   └── audit/
├── integrations/
└── workers/
```

Cada módulo terá rotas, contratos de entrada e saída, regras de negócio e serviços. O arquivo principal ficará responsável apenas por inicializar a aplicação e registrar os módulos. Contratos e schemas serão reorganizados junto dos domínios, preservando o comportamento público durante a migração.

## Preparação para separar a API em outro repositório

A separação física não será imediata. Primeiro serão removidas dependências desnecessárias entre frontend e backend e estabelecido um contrato claro:

```text
Frontend → Barber Hub API → Banco / serviços
```

A direção é que o frontend se comunique com o backend exclusivamente através da API. Dependências atuais do navegador em serviços de infraestrutura deverão ser inventariadas, com tratamento explícito para autenticação, storage e realtime durante a transição.

O cliente central da API será mantido, permitindo trocar a base `/api/v1` por `https://api.barberhuboficial.com.br/api/v1` sem editar cada página. Esse endereço representa o destino proposto, não uma declaração de serviço publicado.

Somente depois da independência lógica será considerada a criação de `Barber-Hub-Web` e `Barber-Hub-API`, com configuração, testes e publicação independentes.

## Desacoplamento do Supabase

Supabase poderá continuar fornecendo infraestrutura, mas as regras de negócio não deverão depender diretamente de suas interfaces específicas. O fluxo conceitual será:

```text
Regra de negócio
      ↓
Service
      ↓
Repository
      ↓
Database Adapter
      ↓
Supabase/PostgreSQL
```

As interfaces de dados isolarão operações específicas do provedor. Banco de dados, autenticação, storage, realtime e jobs serão tratados como capacidades separadas, mesmo que inicialmente tenham o mesmo fornecedor.

O objetivo é permitir substituições futuras sem reescrever as regras de negócio. Migrações de dados e adaptações específicas de infraestrutura ainda precisarão de planejamento próprio.

## Segurança e controle de acesso

Os papéis principais são `admin`, `barbeiro` e `cliente`. Cada usuário terá acesso apenas às áreas e operações destinadas ao seu perfil:

- administrador: recursos administrativos;
- barbeiro: painel profissional e dados autorizados do próprio estabelecimento;
- cliente: sua área e seus próprios dados privados.

Uma tentativa de abrir por URL uma página privada de outro papel poderá apresentar a página 404 do Barber Hub. Esse comportamento será apenas uma decisão de interface. **API e banco deverão rejeitar operações não autorizadas independentemente do frontend.**

A revisão cobrirá IDOR: alterar um identificador de usuário, estabelecimento ou recurso não poderá permitir acesso aos dados de outra pessoa ou organização. A autorização deverá considerar papel, estado da conta e vínculo com o recurso.

## Exclusão lógica e administração de contas

Desativar, alterar ou excluir uma conta administrativamente deverá passar pela API, eliminando alterações administrativas diretas do navegador no banco. A sequência será:

```text
JWT válido
↓
usuário autenticado
↓
administrador ativo
↓
permissão para operação
↓
usuário alvo
↓
regra de negócio
↓
alteração
↓
auditoria
```

A exclusão administrativa será lógica, preservando histórico, auditoria e integridade. Estados propostos: `ativa`, `desativada`, `suspensa` e `excluída`. Sua representação definitiva será definida após analisar os contratos e o banco existentes.

Serão previstas restauração e proteções contra exclusão da própria conta administrativa e remoção do último administrador ativo. Contas excluídas não poderão continuar acessando áreas privadas. A exclusão lógica administrativa deverá ser distinguida dos fluxos de privacidade, retenção e eventual remoção física já existentes.

## Auditoria administrativa

Operações críticas gerarão registros de auditoria, incluindo alteração de papel, desativação, exclusão lógica, restauração, atribuição de assinatura e outras alterações administrativas.

Os registros deverão permitir identificar autor, recurso afetado, momento e resultado da operação. Os detalhes dos registros e seu controle de acesso serão definidos durante a revisão de segurança, evitando incluir credenciais ou dados sensíveis desnecessários.

## Malha lógica de serviços e processamento

Os domínios serão preparados para comunicação por contratos e eventos, sem introduzir dezenas de microsserviços de imediato. Por exemplo:

```text
appointment.created
├── notificação
├── e-mail
├── push
├── CRM
├── retenção
├── métricas
└── auditoria
```

Tarefas secundárias poderão reagir ao evento de forma independente. A requisição não precisará aguardar todas elas. Regras necessárias para confirmar o agendamento permanecerão no caminho transacional; efeitos posteriores deverão preservar consistência e permitir recuperação de falhas.

## Filas, jobs e workers

Workers poderão executar envio de e-mail, notificações push, limpeza de contas, relatórios, importações, manutenção, processamento de imagens e tarefas agendadas.

A indisponibilidade temporária de e-mail não deverá causar perda de um agendamento confirmado. O desenho incluirá retry, backoff, dead-letter queue e idempotência, com critérios verificáveis para tentativas, falhas definitivas e reprocessamento.

Tecnologia de fila, executor e estratégia de publicação confiável de eventos serão decisões posteriores ao inventário da infraestrutura existente.

## Baseline e testes automatizados

Antes de grandes mudanças estruturais, será criada uma **baseline de testes** que registre o comportamento existente. A cobertura deverá abranger testes unitários, integração, API, segurança, banco, frontend, contratos, ponta a ponta, regressão visual, performance e resiliência.

O agendamento será acompanhado da regra isolada à experiência real do usuário. A matriz de autorização incluirá, no mínimo:

- cliente não acessa administração;
- barbeiro não acessa administração;
- administrador não acessa painel exclusivo de barbeiro;
- usuário excluído não acessa áreas privadas;
- cliente não lê dados privados de outro cliente;
- barbeiro não controla estabelecimento de outro barbeiro.

Falhas existentes deverão ser registradas como falhas, sem transformar comportamento inseguro em requisito de preservação. Resultados locais, testes com serviços simulados e evidências de ambiente integrado deverão ser identificados separadamente.

## Interface e regressão visual

As principais páginas serão registradas antes da refatoração em desktop, tablet e mobile. Comparações automatizadas acompanharão cada mudança de CSS e procurarão detectar:

- overflow horizontal;
- elementos desaparecidos;
- espaçamentos inesperados;
- quebra de layouts;
- falhas de responsividade;
- contraste inadequado;
- modais fora da tela.

As capturas deverão usar estados e dados reproduzíveis. Contraste e comportamento interativo também exigirão verificações específicas, além da comparação de imagens. Alterações visuais deliberadas terão justificativa registrada antes da atualização das referências.

## Performance

Serão avaliados marketplace, disponibilidade de horários, criação de agendamento, painel profissional, CRM, financeiro e administração.

As referências deverão registrar cenário, ambiente, volume de dados, concorrência, latência, quantidade de requisições e erros. Metas e limites de regressão serão definidos a partir das medições, sem inventar garantias de desempenho antes da baseline.

## CI e validação automática

Verificações hoje identificadas por release serão reorganizadas pelo comportamento validado. Exemplos de nomes futuros:

```text
check-auth
check-api
check-security
check-routing
check-mobile
check-database
check-admin
check-css
```

A substituição preservará a cobertura existente e as dependências dos comandos antigos até sua migração. O pipeline deverá validar automaticamente os critérios aplicáveis antes de uma alteração ser considerada pronta. Esses nomes são propostas, não comandos já disponíveis.

## Observabilidade

O projeto fortalecerá logs estruturados, request ID, auditoria, monitoramento de erros, métricas, tracing e health checks.

Uma operação deverá poder ser acompanhada por um identificador de correlação entre frontend, API, domínio, banco, evento, worker e push. A observabilidade deverá permitir localizar falhas e acompanhar processamento pendente, repetido ou definitivamente rejeitado.

## Documentação técnica

Será mantido um mapa do projeto explicando onde colocar cada tipo de código, acompanhado de documentação de arquitetura, API, segurança, banco, processamento, deploy, testes, frontend, decisões técnicas e backlog.

Outra pessoa deverá conseguir compreender e manter o projeto sem depender exclusivamente de seu autor. Ferramentas de IA também deverão conseguir localizar o domínio correto antes de propor alterações.

A documentação será atualizada junto de cada etapa e consolidada ao estabilizar a arquitetura.

## Backlog técnico e registro de falhas

Toda falha descoberta em auditoria ou no uso deverá ser registrada, mesmo que sua correção fique para uma etapa posterior. O formato mínimo será:

```text
ID:
Problema:
Evidência e passos para reproduzir:
Impacto:
Gravidade:
Causa provável (ou ainda não determinada):
Arquivos relacionados:
Correção planejada:
Testes necessários:
Dependências:
Responsável:
Estado:
Evidência de conclusão:
```

Estados sugeridos: identificado, em análise, planejado, em execução, em validação e concluído. Hipóteses deverão ser distinguidas de causas comprovadas; conclusão exigirá evidência da correção e da validação.

## Sequência de execução e critérios de conclusão

A tabela operacionaliza a ordem definida neste planejamento. Todas as etapas começaram como planejadas; a evolução parcial e as lacunas estão no [relatório de execução](modernizacao/ETAPA_1.md). Nenhum marco amplo abaixo é declarado integralmente concluído apenas por esse registro.

| Etapa | Entrega | Critério para concluir |
| --- | --- | --- |
| 1. Mapear o estado atual | Inventário de arquivos, dependências, páginas, rotas, serviços, funcionalidades e verificações; backlog inicial | Fluxos críticos rastreados e candidatos a legado ou remoção acompanhados de evidências de uso e dependência |
| 2. Criar a baseline | Testes de caracterização, contratos, matriz de perfis, capturas visuais e registro das lacunas | Execução reproduzível, resultados registrados e falhas existentes explicitadas |
| 3. Reorganizar frontend e CSS | Migração gradual por responsabilidade, cliente de API central e compatibilidade identificada | Cada lote validado funcional e visualmente; nenhuma remoção sem evidência |
| 4. Modularizar API e schemas | Domínios com rotas, contratos, regras e serviços próprios; entrada mínima | Contratos preservados, testes aplicáveis aprovados e dependências entre módulos documentadas |
| 5. Centralizar operações sensíveis e reforçar acesso | Administração pela API, estados de conta, exclusão lógica, auditoria, proteção por papel e recurso | Matriz de autorização e IDOR validada; proteção da própria conta e do último administrador verificada, inclusive sob concorrência |
| 6. Desacoplar dados e infraestrutura | Repositories, adapters e fronteiras de banco, Auth, storage, realtime e jobs | Regras de negócio testáveis sem chamadas diretas ao SDK específico do provedor |
| 7. Introduzir eventos e processamento | Contratos de eventos, filas, jobs e workers | Falhas de serviços secundários, repetição, idempotência, recuperação e dead-letter queue testadas |
| 8. Consolidar operação e qualidade | Testes de carga e resiliência, observabilidade, CI por responsabilidade e documentação completa | Métricas comparáveis, rastreamento de falhas e verificações automáticas demonstrados |
| 9. Avaliar extração da API | Plano de repositórios e publicação independentes | Frontend e backend independentes, contratos verificados e mudança da URL base sem edição de cada página |

A sequência organiza a transformação estrutural. Falhas críticas de segurança descobertas no inventário deverão receber prioridade no backlog, sem aguardar a conclusão de refatorações cosméticas. Cada lote terá escopo pequeno, evidências de validação e caminho de reversão documentado.

O primeiro trabalho de execução será o inventário da etapa 1. A escolha de ferramentas, os prazos e o detalhamento das entregas seguintes deverão usar seus resultados.

## Resultado esperado

Ao final, o Barber Hub deverá ter uma base técnica mais madura, permitindo responder com clareza:

```text
Onde fica esta funcionalidade?
Quem pode executá-la?
Quem protege esses dados?
Qual serviço é responsável?
Como ela é testada?
Como uma falha é monitorada?
Como ela pode ser escalada?
```

O resultado será uma plataforma modular, segura, testável, documentada, observável, escalável e preparada para evolução comercial, preservando as funcionalidades construídas durante o desenvolvimento. A próxima fase será uma reestruturação da base tecnológica para permitir manutenção, auditoria, expansão e operação profissional.
