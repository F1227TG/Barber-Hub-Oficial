# Central de documentação do Barber Hub

Este índice é a porta de entrada da documentação. A partir da versão 1.9.3, os documentos são organizados por finalidade para que não seja necessário conhecer o histórico do projeto antes de localizar uma resposta.

## Comece por aqui

- [`GUIA_COMPLETO_DO_PROJETO.md`](GUIA_COMPLETO_DO_PROJETO.md): visão do produto, arquitetura, pastas, Supabase, migrations, API, segurança, desenvolvimento, testes e deploy.
- [`GUIA_COMPLETO_BARBER_HUB_1_9_3.docx`](GUIA_COMPLETO_BARBER_HUB_1_9_3.docx): edição em Word do guia completo, com relatório diferencial V01–V06 no apêndice.
- [`MAPA_DE_NAVEGACAO.md`](MAPA_DE_NAVEGACAO.md): rotas e áreas da plataforma.
- [`PRD_BARBER_HUB.md`](PRD_BARBER_HUB.md): requisitos e direção funcional.
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md): fronteiras técnicas resumidas.
- [`GUIA_DE_CODIGO.md`](GUIA_DE_CODIGO.md): convenções para manutenção.

## Versão atual

- [`ATUALIZACAO_1_9_3.md`](ATUALIZACAO_1_9_3.md): mudanças da release 1.9.3.
- [`VERIFICACAO_1_9_3.md`](VERIFICACAO_1_9_3.md): regressões executadas e limitações.
- [`RELATORIO_SEGURANCA_1_9_3.md`](RELATORIO_SEGURANCA_1_9_3.md): estado V01–V06, senhas e dependências externas.
- [`DECISAO_REPOSITORIOS_1_9_3.md`](DECISAO_REPOSITORIOS_1_9_3.md): por que web, mobile e API continuam juntos e como o Beauty Hub foi preparado separadamente.

## Banco, Supabase e deploy

- [`CONFIGURACAO_SUPABASE.md`](CONFIGURACAO_SUPABASE.md): configuração inicial e conceitos do projeto.
- [`CONFIGURACAO_EXTERNA_1_9.md`](CONFIGURACAO_EXTERNA_1_9.md): controles que não podem ser ativados apenas por código.
- [`MIGRATIONS_DEPLOY_1_9.md`](MIGRATIONS_DEPLOY_1_9.md): migrations já aplicadas e procedimento seguro.
- [`CORRECAO_MIGRATION_13.md`](CORRECAO_MIGRATION_13.md): registro da correção histórica da migration 13.
- [`API_BARBER_HUB_V1.md`](API_BARBER_HUB_V1.md) e [`barberhub-api-v1.openapi.yaml`](barberhub-api-v1.openapi.yaml): API e contrato.

## Produto e planejamento

- [`MATRIZ_PLANOS_1_9.md`](MATRIZ_PLANOS_1_9.md): benefícios e limites por plano.
- [`ROADMAP_1_9_OPERACAO_CRESCIMENTO.md`](ROADMAP_1_9_OPERACAO_CRESCIMENTO.md): agenda, CRM, financeiro e crescimento.
- [`PLANO_RELEASE_1_9.md`](PLANO_RELEASE_1_9.md): planejamento da série 1.9.
- [`REDESIGN_MOBILE_1_8.md`](REDESIGN_MOBILE_1_8.md): princípios da experiência mobile.
- [`ASSETS_BARBER_HUB_1_8_0.md`](ASSETS_BARBER_HUB_1_8_0.md): kit visual mantido em `img/branding`.

## Segurança

- [`RELATORIO_SEGURANCA_1_9_3.md`](RELATORIO_SEGURANCA_1_9_3.md): relatório atual.
- [`RELATORIO_SEGURANCA_1_9_0.md`](RELATORIO_SEGURANCA_1_9_0.md): hardening operacional 1.9.
- [`RELATORIO_SEGURANCA_1_8_2.md`](RELATORIO_SEGURANCA_1_8_2.md): auditoria diferencial original V01–V06.
- [`SEGURANCA_1_6.md`](SEGURANCA_1_6.md): base histórica de CAPTCHA, e-mail e rate limit.

## Histórico

Os arquivos `ATUALIZACAO_*`, `VERIFICACAO_*`, `CORRECOES_*` e `DECISOES_*` preservam decisões de versões anteriores. Os dois relatórios que estavam soltos na raiz foram movidos para [`releases/`](releases/). O histórico continua disponível no Git e não deve voltar a ser copiado para a raiz.

## Regra de manutenção

1. documentação nova entra em `docs/`;
2. relatórios de uma release recebem o número da versão no nome;
3. scripts executáveis ficam em `scripts/`, SQL em `sql/` e testes em `tests/`;
4. arquivos temporários, caches, credenciais e artefatos de build não entram no Git nem no ZIP;
5. ao criar um documento importante, atualize este índice.
