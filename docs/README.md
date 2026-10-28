# Central de documentação do Barber Hub

Este é o índice canônico da versão **1.11.1**. Documentos de versões anteriores permanecem como histórico; quando houver divergência sobre o estado atual, use primeiro o guia e o diretório `release-1.11/`.

## Comece por aqui

- [`SUPABASE-GOOGLE-2026-10-27.md`](SUPABASE-GOOGLE-2026-10-27.md): preparação do Supabase Beauty e do acesso Google independente nas duas plataformas; configuração externa ainda pendente.

- [`REDESIGN-BARBER-HUB-2026-10-26.md`](REDESIGN-BARBER-HUB-2026-10-26.md): atualização visual compartilhada, home interativa, fontes CSS e limites da validação local.

- [`PLANO_MODERNIZACAO_BARBER_HUB.md`](PLANO_MODERNIZACAO_BARBER_HUB.md): base oficial do planejamento da modernização, registrada em 22/10/2026; define a direção futura, etapas e critérios de conclusão, sem declarar implementação concluída.
- [`modernizacao/ETAPA_1.md`](modernizacao/ETAPA_1.md): execução local da primeira etapa, evidências, limitações e instruções para continuar.
- [`modernizacao/ETAPA_2.md`](modernizacao/ETAPA_2.md): baseline visual, fontes CSS por responsabilidade e ponto atual de retomada.
- [`GUIA_COMPLETO_DO_PROJETO.md`](GUIA_COMPLETO_DO_PROJETO.md): produto, arquitetura, pastas, funcionamento, segurança, testes e publicação.
- [`GUIA_COMPLETO_BARBER_HUB_1_11_0.docx`](GUIA_COMPLETO_BARBER_HUB_1_11_0.docx): edição Word do guia completo da versão atual.
- [`../README.md`](../README.md): visão curta para desenvolver e publicar.
- [`../ARCHITECTURE.md`](../ARCHITECTURE.md): fronteiras entre interface, API e banco.
- [`MAPA_DE_NAVEGACAO.md`](MAPA_DE_NAVEGACAO.md): rotas e áreas da plataforma.
- [`GUIA_DE_CODIGO.md`](GUIA_DE_CODIGO.md): convenções de manutenção.
- [`HANDOFF-CODEX-2026-10-26.md`](HANDOFF-CODEX-2026-10-26.md): contexto completo, estado do Git, validações e próximos passos para retomar o trabalho em outra conta.

## Versão 1.11.0

- [`API-SEPARADA-E-TESTES-2026-10-27.md`](API-SEPARADA-E-TESTES-2026-10-27.md): extração da API, correções de autenticação, testes gerais e pendências de produção.

- [`release-1.11/README.md`](release-1.11/README.md): estado verificado, regras de decisão e índice operacional.
- [`release-1.11/RELATORIO_FINAL_1_11_0.md`](release-1.11/RELATORIO_FINAL_1_11_0.md): tudo que foi implementado, corrigido, testado e o que ainda é externo.
- [`release-1.11/MATRIZ_REQUISITOS_E_ACEITE.md`](release-1.11/MATRIZ_REQUISITOS_E_ACEITE.md): rastreabilidade dos requisitos e critérios de aceite.
- [`release-1.11/CHECKLIST_PRE_RELEASE.md`](release-1.11/CHECKLIST_PRE_RELEASE.md): decisão formal de publicação.
- [`release-1.11/CONFIGURACAO_EXTERNA.md`](release-1.11/CONFIGURACAO_EXTERNA.md): configuração de Auth, e-mail, Push, jobs e ambiente.
- [`release-1.11/TESTES_DE_PERFIS_E_RLS.md`](release-1.11/TESTES_DE_PERFIS_E_RLS.md): homologação por conta, papel e plano.
- [`release-1.11/ADVISORS_SUPABASE_2026_09_11.md`](release-1.11/ADVISORS_SUPABASE_2026_09_11.md): revisão posterior às migrations aplicadas.
- [`MIGRATIONS_DEPLOY_1_10.md`](MIGRATIONS_DEPLOY_1_10.md): estado atual das migrations 32/33, verificador e publicação segura.

## Histórico 1.10.1

- [`ATUALIZACAO_1_10_1.md`](ATUALIZACAO_1_10_1.md): tudo que foi concluído nesta atualização.
- [`RELATORIO_CONCLUSAO_PLANEJAMENTO_POS31_1_10_1.md`](RELATORIO_CONCLUSAO_PLANEJAMENTO_POS31_1_10_1.md): conferência item a item contra o documento de origem.
- [`RELATORIO_VALIDACAO_1_10_1.md`](RELATORIO_VALIDACAO_1_10_1.md): testes automatizados, navegador, Word e estado de release.
- [`RELATORIO_SEGURANCA_1_10.md`](RELATORIO_SEGURANCA_1_10.md): V01–V06, novas proteções e decisão sobre senhas.
- [`ADVISORS_SUPABASE_2026_09_05.md`](ADVISORS_SUPABASE_2026_09_05.md): fotografia real dos Advisors antes da migration 32.
- [`AUDITORIA_SENHAS_BARBER_BEAUTY_1_10_1.md`](AUDITORIA_SENHAS_BARBER_BEAUTY_1_10_1.md): responsabilidade do Auth e comparação com o código local do Beauty Hub.
- [`PILOTO_VALIDACAO_OPERACIONAL.md`](PILOTO_VALIDACAO_OPERACIONAL.md): roteiro e métricas para validar com usuários reais.
- [`ESTRUTURA_PROJETO_1_10_1.md`](ESTRUTURA_PROJETO_1_10_1.md): mapa das pastas e regra de organização.
- [`HOMOLOGACAO_FINAL_1_10.md`](HOMOLOGACAO_FINAL_1_10.md): cenários manuais antes de liberar usuários finais.
- [`DECISAO_REPOSITORIOS_1_10.md`](DECISAO_REPOSITORIOS_1_10.md): monorepo Barber Hub e Beauty Hub separado.
- [`PESQUISA_VALIDACAO_BARBER_BEAUTY_HUB.md`](PESQUISA_VALIDACAO_BARBER_BEAUTY_HUB.md): evidências, limitações e plano de piloto.

## API e banco

- [`API_BARBER_HUB_V1.md`](API_BARBER_HUB_V1.md): endpoints e regras da API FastAPI 1.7.0.
- [`barberhub-api-v1.openapi.yaml`](barberhub-api-v1.openapi.yaml): fotografia estática do contrato; `/api/openapi.json` é a fonte executável.
- [`CONFIGURACAO_SUPABASE.md`](CONFIGURACAO_SUPABASE.md): conceitos e configuração inicial.
- [`CONFIGURACAO_EXTERNA_1_9.md`](CONFIGURACAO_EXTERNA_1_9.md): histórico de CAPTCHA, Auth, URL e Cron ainda útil para a 1.10.
- [`MIGRATIONS_DEPLOY_1_9.md`](MIGRATIONS_DEPLOY_1_9.md): histórico aplicado até a migration 28.

## Produto e pesquisa

- [`DIAGNOSTICO-FEIRA.md`](DIAGNOSTICO-FEIRA.md): diagnóstico inicial, evidências locais, riscos e plano de quatro dias para a feira.

- [`PRD_BARBER_HUB.md`](PRD_BARBER_HUB.md): requisitos funcionais e direção de produto.
- [`MATRIZ_PLANOS_1_9.md`](MATRIZ_PLANOS_1_9.md): base de recursos por plano.
- [`ROADMAP_1_9_OPERACAO_CRESCIMENTO.md`](ROADMAP_1_9_OPERACAO_CRESCIMENTO.md): origem da agenda, CRM, financeiro e retenção.
- [`REDESIGN_MOBILE_1_8.md`](REDESIGN_MOBILE_1_8.md): princípios da experiência mobile.

## Segurança e histórico

O estado atual está consolidado em `release-1.11/RELATORIO_FINAL_1_11_0.md`. Relatórios e notas `1.10.x`, `1.9.x`, `1.8.x` e anteriores registram o que era verdade naquelas versões e não devem ser usados isoladamente para aprovar um deploy atual.

## Regra de organização

As regras abaixo descrevem a estrutura anterior à modernização. Para a evolução planejada, siga o [plano oficial](PLANO_MODERNIZACAO_BARBER_HUB.md): CSS por responsabilidade, API modular e migração gradual, condicionada ao inventário e à baseline. A lista não implica que a migração já ocorreu.

1. entrada da API em `api/index.py`, rotas em `api/routers/`, contratos em `backend/schemas/`, regras em `backend/domain/`, serviços em `backend/services/` e novos adapters em `backend/integrations/`;
2. páginas canônicas em `html/` e espelhos gerados em `mobile/`;
3. estilos novos em `css/releases/`, infraestrutura web em `js/core/` e recursos em `js/features/`;
4. migration/verificador em `sql/`, testes em `tests/` e manutenção em `scripts/`;
5. documentos em `docs/`, imagens oficiais em `img/branding/` e biblioteca em `img/library/`;
6. caches, temporários, credenciais, builds e arquivos sem referência não entram no Git.
