# Histórico de versões

Este arquivo resume entregas. Os critérios de publicação e as evidências completas ficam em `docs/release-1.11/`.

## 1.11.1 — preparação de API independente e autenticação — 2026-10-27

- extrai API, migrations e testes para Barber-Hub-API; troca de tráfego ainda pendente;
- permite gerar distribuição exclusivamente estática com proxy para o backend independente;
- corrige cache de perfil entre contas, continuidade anônima, tratamento de cadastro sem perfil e falhas transitórias;
- impede atualização antecipada do e-mail confirmado e falso sucesso em respostas inválidas da API;
- corrige recuperação padrão para o domínio atual e repetição da configuração CAPTCHA após falha;
- separa atualização dos dados do painel do horário da consulta de saúde, eliminando uma corrida;
- acrescenta regressões de login, cadastro, recuperação e distribuição; detalhes e limites no relatório da etapa.

## Em desenvolvimento — modernização, etapa 2 — 2026-10-22

- registra 50 snapshots das páginas completas em cinco larguras, com temas claro/escuro e painéis de privacidade/filtros;
- adiciona fixtures locais de dados, fontes e ícones, com bloqueio de chamadas inesperadas nos testes;
- extrai nove fontes CSS por responsabilidade, preservando conteúdo/cascata e a URL do bundle 1.11;
- verifica a geração do CSS no pipeline e prepara comparação visual Windows/Chromium no CI;
- documenta evidências, cobertura parcial e retomada em `docs/modernizacao/ETAPA_2.md`; homologação da migration permanece pendente.

## Em desenvolvimento — modernização, etapa 1 — 2026-10-22

- extrai 95 handlers para rotas por domínio e separa contratos Pydantic, preservando os contratos HTTP anteriores;
- introduz ports e adapters para contas e identidade, valida conta ativa e sessão não revogada;
- centraliza mudanças administrativas de perfil na API, com exclusão lógica, restauração e auditoria transacional;
- prepara a migration 20261022155131 e seu verificador, ainda não aplicados no banco remoto;
- adiciona testes de contratos, contas, cliente JavaScript, PostgreSQL em memória e acesso no navegador;
- organiza os comandos de verificação por responsabilidade e registra o ponto de retomada em `docs/modernizacao/ETAPA_1.md`;
- atualiza o identificador de cache PWA para a entrega futura; esta etapa não declara deploy.

## 1.11.0 — 2026-09-14

- conclui conta, privacidade, sessões, exportação e exclusão com prazo de segurança;
- reforça agendamento idempotente, recorrência, lista de espera e bloqueio de autoagendamento;
- consolida CRM, financeiro, retenção, oportunidades, metas e permissões;
- corrige carregamentos infinitos normalizando respostas na fronteira da API;
- melhora conta, painel, agenda, clientes, planos, administração e assinaturas no mobile;
- simplifica suporte e remove termos internos das superfícies comerciais;
- atualiza PWA, mapa de navegação, arquitetura, OpenAPI, migrations e documentação;
- aplica as duas migrations gerenciadas da candidata e aprova o verificador 33;
- amplia a suíte para 99 testes e adiciona regressões da versão 1.11.

## 1.10.1 — 2026-09-05

- concluiu o Planejamento Pós-31 no código;
- ampliou agenda real, marketplace regional, importação, Push, auditoria e feature flags;
- reorganizou módulos em `js/core/` e `js/features/`.

## 1.9.3

- reuniu os escopos 1.9.1 e 1.9.2;
- adicionou lista de espera, recorrência, fidelidade, cupons, campanhas, oportunidades, insights, metas e permissões granulares.

## Histórico anterior

Os registros detalhados das versões 1.8, 1.9 e 1.10 permanecem em `docs/` para rastreabilidade e não substituem o estado canônico da 1.11.
