# Barber Hub 1.9.3 — migrations e preparação do deploy

## Situação do ambiente conectado em 24/08/2026

O histórico remoto chegava apenas ao equivalente da migration 10. As migrations 11–23 foram aplicadas, na ordem, ao projeto `dhkqnfqrfqrpumrjjrcy`. Os verificadores 17, 22 e 23 foram aprovados. As migrations **24 e 25 foram geradas nesta release e ainda precisam ser aplicadas pelo responsável do projeto antes do deploy da API 1.5.0**.

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

### Retenção & Inteligência 1.9.3 — aplicar agora

No Supabase Dashboard, abra **SQL Editor → New query**. Para cada item abaixo, copie o arquivo inteiro, execute e confirme sucesso antes de prosseguir:

1. `24_retencao_relacionamento_1_9_3.sql` — cria lista de espera, recorrências, fidelidade, cupons, campanhas, automações e novos entitlements;
2. `25_inteligencia_permissoes_1_9_3.sql` — cria oportunidades, insights, metas, permissões granulares e integra as permissões às regras operacionais;
3. `verificar_25_release_1_9_3.sql` — valida tabelas, RLS, RPCs, entitlements e `search_path`; não persiste alteração.

Resultado esperado do terceiro arquivo: uma mensagem de validação e **zero linhas** na consulta final. Se houver exceção/linha, não publique e corrija o item informado.

Depois, abra **Database → Migrations** (ou mantenha uma tabela de histórico própria, se o projeto foi iniciado pelo SQL Editor) e registre os nomes 24/25 para impedir reaplicação acidental. Não cole os dois arquivos em uma única execução: assim fica claro em qual etapa ocorreu uma eventual falha.

## Configuração externa obrigatória

- habilitar CAPTCHA/Turnstile no Supabase Auth e configurar as chaves somente nos ambientes autorizados;
- habilitar proteção contra senhas vazadas no provedor de autenticação;
- confirmar URLs de redirecionamento e e-mails de recuperação;
- configurar `SUPABASE_URL`, chave pública no frontend e credenciais privadas somente no backend/deploy;
- manter a RPC distribuída `consumir_api_rate_limit` disponível para todas as instâncias da API;
- habilitar Supabase Cron e agendar `preparar_lembretes_193()` e `processar_automacoes_internas_193(200)`;
- conectar um worker externo para filas `email`/`whatsapp`; o banco não envia esses canais sozinho;
- revisar periodicamente Security Advisor e Performance Advisor;
- validar políticas com contas separadas: cliente, profissional, recepção, gerente, proprietário, admin e usuário sem vínculo.

## Rollback

As migrations priorizam alterações aditivas. O rollback seguro é restaurar o backup ou aplicar um script específico revisado para o ambiente; não remova tabelas operacionais em produção de forma improvisada. Se o deploy da interface falhar após o banco ser atualizado, reverta apenas o código para 1.8.2 — as novas tabelas aditivas podem permanecer sem uso enquanto o problema é investigado.

## Estado dos Advisors

- Performance: nenhum warning após a migration 23; apenas informações de índices ainda sem uso, esperado logo após a criação.
- Security: 37 itens antes da 1.9.3 — proteção contra senhas vazadas pendente; 33 grants de execução em RPCs `SECURITY DEFINER` a revisar (6 `anon`, 27 `authenticated`); `unaccent` e `btree_gist` no schema legado `public`; e `api_rate_limits` sem policy pública porque é fechado ao `service_role`.

As ações manuais restantes estão detalhadas em `docs/CONFIGURACAO_EXTERNA_1_9.md`.
