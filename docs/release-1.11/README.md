# Barber Hub 1.11 — pacote de prontidão operacional

Este diretório transforma o escopo da 1.11 em critérios verificáveis e runbooks de publicação. Ele não registra a release como aprovada: todo teste, configuração externa, backup, migration e decisão de go/no-go precisa ser executado no ambiente-alvo e acompanhado de evidência.

## Estado consolidado em 14 de setembro de 2026

- release: **implementação concluída localmente; homologação externa pendente**;
- ambiente de homologação: **a identificar**;
- projeto Supabase conectado: **`dhkqnfqrfqrpumrjjrcy`**;
- commit e deployment candidatos: **a registrar**;
- migrations gerenciadas: **`20260911132254_conclusao_pos31_1_10_1` e `20260911132328_barberhub_1_11_confiabilidade_privacidade`, aplicadas com sucesso**;
- verificador 33: **todos os controles retornaram `true`**;
- validação local: **99 testes, 27/27 controles V01–V06, 32/32 invariantes 1.9.3 e validadores 1.10/1.10.1/1.11 aprovados**;
- Advisors pós-migration: **revisados e registrados em `ADVISORS_SUPABASE_2026_09_11.md`**;
- responsável técnico, responsável de produto e responsável por privacidade: **a designar**;
- metas preliminares de recuperação: **RPO de 24h e RTO de 8h; ensaio e responsáveis ainda pendentes**;
- gates ainda externos: **Turnstile, proteção contra senhas vazadas quando houver upgrade autorizado, URLs, VAPID/e-mail, contas separadas/RLS, backup/restauração, aprovação jurídica e teste no deployment candidato**.

Relatórios de versões anteriores servem como histórico, mas não aprovam a 1.11. Em especial, resultados de `RELATORIO_VALIDACAO_1_10_1.md`, `ADVISORS_SUPABASE_2026_09_05.md` ou de verificadores antigos devem ser repetidos quando a mudança da 1.11 puder afetá-los.

## Documentos

1. [Matriz de requisitos e critérios de aceite](MATRIZ_REQUISITOS_E_ACEITE.md)
2. [Checklist pré-release e decisão de publicação](CHECKLIST_PRE_RELEASE.md)
3. [Backup e restauração](BACKUP_E_RESTAURACAO.md)
4. [Rollback de deploy e migrations](ROLLBACK_DEPLOY_E_MIGRATIONS.md)
5. [Monitoramento e alertas](MONITORAMENTO_E_ALERTAS.md)
6. [Resposta a incidentes e retenção LGPD](INCIDENTES_E_RETENCAO_LGPD.md)
7. [Teste de perfis, planos e RLS](TESTES_DE_PERFIS_E_RLS.md)
8. [Configuração externa](CONFIGURACAO_EXTERNA.md)
9. [Testes de navegador, dispositivo, rede, PWA e carga](TESTES_NAVEGADOR_DISPOSITIVO_E_CARGA.md)
10. [Credenciais e senhas](CREDENCIAIS_E_SENHAS.md)
11. [Retenção controlada e simulação 1.11.1](RETENCAO_SIMULACAO_1_11_1.md)
12. [Exportação de dados da conta 1.11.1](EXPORTACAO_DE_DADOS_1_11_1.md)
13. [Diagnóstico comercial de assinaturas — setembro de 2026](DIAGNOSTICO_COMERCIAL_ASSINATURAS_2026-09.md)
14. [Advisors do Supabase — 11/09/2026](ADVISORS_SUPABASE_2026_09_11.md)
15. [Relatório final da implementação 1.11.0](RELATORIO_FINAL_1_11_0.md)

## Convenções de evidência

Cada execução deve registrar:

| Campo | Conteúdo obrigatório |
|---|---|
| Estado | Não executado, Aprovado, Reprovado, Bloqueado ou N/A justificado |
| Ambiente | Local, homologação ou produção; inclua o identificador do projeto |
| Versão | Commit, deployment e conjunto de migrations |
| Momento | Data, hora e fuso |
| Executor | Pessoa responsável |
| Cenário | Passos e dados de teste não sensíveis |
| Resultado | Esperado versus observado |
| Evidência | Link para execução, captura, log sanitizado ou consulta salva |
| Defeito | Identificador e severidade, quando houver |

Não inclua tokens, cookies, senhas, chaves, endpoints de Push, dados pessoais reais nem conteúdo integral de requisições na evidência.

## Regras de decisão

- Um requisito só fica **Aprovado** quando o critério de aceite correspondente foi observado no ambiente indicado.
- `N/A` exige motivo, aprovador e confirmação de que o item realmente não se aplica.
- Resultado local não substitui teste no ambiente publicado quando há Auth, RLS, Cron, Turnstile, Web Push, e-mail, cache de PWA ou configuração de domínio.
- Nenhum P0 pode permanecer aberto. P1 só pode ser aceito por exceção escrita, com impacto, mitigação, responsável e prazo.
- Migration aplicada sem backup recuperável, restauração ensaiada ou estratégia de compatibilidade torna a decisão **no-go**.
- Pagamentos permanecem condicionais até existir provedor contratado e integrado. Estrutura de planos, campos financeiros ou seleção de forma de pagamento não provam cobrança real.

## Referências do repositório que devem ser reconfirmadas

Na árvore observada antes da implementação da 1.11:

- a API possui `GET /api/v1/health` e `GET /api/v1/admin/health`;
- respostas incluem `X-Request-ID` e a API emite logs estruturados com rota, status e duração;
- o job Web Push usa `/api/v1/jobs/push/deliver`;
- a configuração lê as variáveis descritas em [Configuração externa](CONFIGURACAO_EXTERNA.md);
- o histórico gerenciado contém, na ordem correta, as migrations `20260911132254_conclusao_pos31_1_10_1` e `20260911132328_barberhub_1_11_confiabilidade_privacidade`;
- a documentação anterior declara que não existe gateway de pagamento integrado.

Esses pontos descrevem a referência encontrada no repositório; não confirmam o estado do deploy nem de serviços externos.
