# Central de documentação do Barber Hub

Este é o índice canônico da versão **1.10.0**. Documentos de versões anteriores permanecem como histórico; quando houver divergência sobre o estado atual, use primeiro os arquivos desta seção.

## Comece por aqui

- [`GUIA_COMPLETO_DO_PROJETO.md`](GUIA_COMPLETO_DO_PROJETO.md): produto, arquitetura, pastas, funcionamento, segurança, testes e publicação.
- [`GUIA_COMPLETO_BARBER_HUB_1_10_0.docx`](GUIA_COMPLETO_BARBER_HUB_1_10_0.docx): edição Word do guia completo da versão atual.
- [`../README.md`](../README.md): visão curta para desenvolver e publicar.
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md): fronteiras entre interface, API e banco.
- [`MAPA_DE_NAVEGACAO.md`](MAPA_DE_NAVEGACAO.md): rotas e áreas da plataforma.
- [`GUIA_DE_CODIGO.md`](GUIA_DE_CODIGO.md): convenções de manutenção.

## Versão 1.10.0

- [`ATUALIZACAO_1_10_0.md`](ATUALIZACAO_1_10_0.md): tudo que mudou.
- [`MIGRATIONS_DEPLOY_1_10.md`](MIGRATIONS_DEPLOY_1_10.md): ordem 29–31, verificador e configuração externa.
- [`RELATORIO_SEGURANCA_1_10.md`](RELATORIO_SEGURANCA_1_10.md): V01–V06, novas proteções e decisão sobre senhas.
- [`HOMOLOGACAO_FINAL_1_10.md`](HOMOLOGACAO_FINAL_1_10.md): cenários manuais antes de liberar usuários finais.
- [`DECISAO_REPOSITORIOS_1_10.md`](DECISAO_REPOSITORIOS_1_10.md): monorepo Barber Hub e Beauty Hub separado.
- [`PESQUISA_VALIDACAO_BARBER_BEAUTY_HUB.md`](PESQUISA_VALIDACAO_BARBER_BEAUTY_HUB.md): evidências, limitações e plano de piloto.

## API e banco

- [`API_BARBER_HUB_V1.md`](API_BARBER_HUB_V1.md): endpoints e regras da API FastAPI 1.6.
- [`barberhub-api-v1.openapi.yaml`](barberhub-api-v1.openapi.yaml): fotografia estática do contrato; `/api/openapi.json` é a fonte executável.
- [`CONFIGURACAO_SUPABASE.md`](CONFIGURACAO_SUPABASE.md): conceitos e configuração inicial.
- [`CONFIGURACAO_EXTERNA_1_9.md`](CONFIGURACAO_EXTERNA_1_9.md): histórico de CAPTCHA, Auth, URL e Cron ainda útil para a 1.10.
- [`MIGRATIONS_DEPLOY_1_9.md`](MIGRATIONS_DEPLOY_1_9.md): histórico aplicado até a migration 28.

## Produto e pesquisa

- [`PRD_BARBER_HUB.md`](PRD_BARBER_HUB.md): requisitos funcionais e direção de produto.
- [`MATRIZ_PLANOS_1_9.md`](MATRIZ_PLANOS_1_9.md): base de recursos por plano.
- [`ROADMAP_1_9_OPERACAO_CRESCIMENTO.md`](ROADMAP_1_9_OPERACAO_CRESCIMENTO.md): origem da agenda, CRM, financeiro e retenção.
- [`REDESIGN_MOBILE_1_8.md`](REDESIGN_MOBILE_1_8.md): princípios da experiência mobile.

## Segurança e histórico

O relatório atual é `RELATORIO_SEGURANCA_1_10.md`. Relatórios e notas `1.9.x`, `1.8.x` e anteriores registram o que era verdade naquelas versões e não devem ser usados isoladamente para aprovar um deploy atual.

## Regra de organização

1. código de entrada da API em `api/`, regras em `backend/domain/` e integrações em `backend/services/`;
2. páginas canônicas em `html/` e espelhos gerados em `mobile/`;
3. estilos novos em `css/releases/`, infraestrutura web em `js/core/` e recursos em `js/features/`;
4. migration/verificador em `sql/`, testes em `tests/` e manutenção em `scripts/`;
5. documentos em `docs/`, imagens oficiais em `img/branding/` e biblioteca em `img/library/`;
6. caches, temporários, credenciais, builds e arquivos sem referência não entram no Git.
