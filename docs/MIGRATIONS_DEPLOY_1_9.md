# Barber Hub 1.9.3 — migrations e preparação do deploy

## Situação do ambiente conectado em 24/08/2026

O histórico remoto chegava apenas ao equivalente da migration 10. As migrations 11–28 foram aplicadas, na ordem, ao projeto `dhkqnfqrfqrpumrjjrcy`. Os verificadores 17, 22, 23 e 25 foram aprovados. O banco remoto já representa a release 1.9.3.

## Backup e ensaio

1. gere um backup recuperável do banco e confirme o projeto alvo;
2. faça o primeiro ensaio em branch/projeto de homologação;
3. não execute arquivos fora da ordem numérica;
4. se uma migration falhar, interrompa a sequência e investigue antes de continuar;
5. não use `service_role` no navegador e não coloque segredos no repositório.

## Sequência aplicada

### Base 1.8

1. `11_planos_assinaturas.sql`
2. `12_comunidade_conta_admin_mobile.sql`
3. `13_modais_status_avaliacoes_comunidade.sql`
4. `14_api_python_agendamento_multisservicos.sql`
5. `15_marketplace_fts_api_seguranca.sql`
6. `16_assinaturas_entitlements_beneficios.sql`
7. `17_correcao_auditoria_seguranca.sql`
8. executar `verificar_17_correcao_auditoria.sql` — aprovado.

### Operação 1.9

1. `18_agenda_equipe_operacional_1_9.sql`
2. `19_crm_operacional_1_9.sql`
3. `20_financeiro_comissoes_1_9.sql`
4. `21_entitlements_operacionais_1_9.sql`
5. `22_encaixes_hardening_operacional_1_9.sql`
6. executar `verificar_22_operacao_1_9.sql` — aprovado.
7. `23_advisors_pos_deploy_1_9.sql`
8. executar `verificar_23_advisors_pos_deploy_1_9.sql` — aprovado.

O verificador operacional retornou todos os campos booleanos como `true` e `total_tabelas_rls = 9`. A migration 23 removeu warnings de FKs sem índice, `auth.uid()` não inicializado e policies de leitura duplicadas.

### Retenção & Inteligência 1.9.3 — aplicada

1. `24_retencao_relacionamento_1_9_3.sql` — cria lista de espera, recorrências, fidelidade, cupons, campanhas, automações e novos entitlements;
2. `25_inteligencia_permissoes_1_9_3.sql` — cria oportunidades, insights, metas, permissões granulares e integra as permissões às regras operacionais;
3. `26_cron_automacoes_1_9_3.sql` — instala o módulo Cron e agenda os dois workers internos;
4. `27_advisors_release_1_9_3.sql` — adiciona índices de FKs e elimina políticas de leitura permissivas duplicadas;
5. `28_hardening_objetos_1_9_3.sql` — remove privilégios anônimos herdados das tabelas internas;
6. `verificar_25_release_1_9_3.sql` — valida tabelas, RLS, privilégios anônimos, RPCs, entitlements e `search_path`; não persiste alteração.

Resultado confirmado: mensagem de validação e **zero linhas** na consulta final. Os cinco arquivos aparecem no histórico remoto e não devem ser reaplicados.

## Configuração externa obrigatória

- CAPTCHA/Turnstile confirmado como ativo no Supabase Auth;
- proteção contra senhas vazadas pendente porque o projeto está no plano Free;
- Site URL e quatro URLs de redirecionamento confirmadas;
- configurar `SUPABASE_URL`, chave pública no frontend e credenciais privadas somente no backend/deploy;
- manter a RPC distribuída `consumir_api_rate_limit` disponível para todas as instâncias da API;
- Supabase Cron ativo com `preparar_lembretes_193()` e `processar_automacoes_internas_193(200)`; primeiras execuções concluídas com sucesso;
- conectar um worker externo para filas `email`/`whatsapp`; o banco não envia esses canais sozinho;
- revisar periodicamente Security Advisor e Performance Advisor;
- matriz de autorização validada para cliente, profissional, recepção, gerente, proprietário, admin e usuário sem vínculo; manter também testes completos de interface com contas reais.

## Rollback

As migrations priorizam alterações aditivas. O rollback seguro é restaurar o backup ou aplicar um script específico revisado para o ambiente; não remova tabelas operacionais em produção de forma improvisada. Se o deploy da interface falhar após o banco ser atualizado, reverta apenas o código para 1.8.2 — as novas tabelas aditivas podem permanecer sem uso enquanto o problema é investigado.

## Estado dos Advisors

- Performance: **zero warnings** após a migration 27; restam apenas informações de índices ainda sem uso, esperado logo após a criação.
- Security: 50 itens informativos/de revisão — proteção contra senhas vazadas pendente; 6 RPCs públicas intencionais e 40 RPCs autenticadas `SECURITY DEFINER` com autorização interna; `unaccent` e `btree_gist` no schema legado `public`; e `api_rate_limits` sem policy pública porque é fechado ao backend. Nenhuma RPC 1.9.3 é executável por `anon`.

As ações manuais restantes estão detalhadas em `docs/CONFIGURACAO_EXTERNA_1_9.md`.
