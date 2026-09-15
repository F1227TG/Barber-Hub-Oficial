-- Verificação pós-migration 33 (Barber Hub 1.11.0).
-- Em produção, o resultado esperado é uma linha com todos os booleanos em
-- true e indices_fk_novos = 9. A checagem do cron é dinâmica para que o
-- arquivo também rode em ambientes locais sem pg_cron, sem erro de análise.

begin;

create temporary table barberhub_cron_111 (
  cron_disponivel boolean not null,
  cron_exclusao_externo_ok boolean not null,
  cron_retencao_ok boolean not null
) on commit drop;

do $$
begin
  if not exists(select 1 from pg_extension where extname = 'pg_cron') then
    insert into barberhub_cron_111 values (false, false, false);
    return;
  end if;

  execute $sql$
    insert into barberhub_cron_111
    select
      true,
      (
        select count(*) = 0
        from cron.job
        where jobname = 'barberhub-exclusoes-conta-111'
      ),
      (
        select count(*) = 1
        from cron.job
        where jobname = 'barberhub-retencao-tecnica-111'
          and active
          and schedule = '41 3 * * *'
          and command = 'select public.executar_retencao_tecnica_111();'
      )
  $sql$;
end;
$$;

select
  to_regclass('public.consentimentos_usuario') is not null as consentimentos_ok,
  to_regclass('public.solicitacoes_exclusao_conta') is not null as exclusao_programada_ok,
  to_regclass('public.fila_emails') is not null as fila_email_ok,
  to_regclass('public.politicas_retencao_dados') is not null as retencao_ok,
  to_regclass('public.assinatura_eventos') is not null as cobranca_neutra_ok,
  exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'estabelecimentos'
      and column_name = 'cnpj'
      and is_nullable = 'YES'
  ) as cnpj_coluna_opcional_ok,
  private.cnpj_valido_111('00.000.000/E08G-12') as cnpj_alfanumerico_ok,
  private.cnpj_valido_111('11.222.333/0001-81') as cnpj_legado_ok,
  not private.cnpj_valido_111('00.000.000/E08G-13') as cnpj_dv_rejeitado_ok,
  not private.cnpj_valido_111('00.000.000/0000-00') as cnpj_uniforme_rejeitado_ok,
  exists(
    select 1
    from pg_constraint
    where conrelid = 'public.estabelecimentos'::regclass
      and conname = 'estabelecimentos_cnpj_111_check'
      and convalidated
  ) as cnpj_constraint_ok,
  exists(
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'estabelecimentos'
      and indexname = 'estabelecimentos_cnpj_111_unique_idx'
  ) as cnpj_unico_ok,
  exists(
    select 1
    from pg_trigger
    where tgrelid = 'public.estabelecimentos'::regclass
      and tgname = 'estabelecimentos_normalizar_cnpj_111'
      and not tgisinternal
  ) as cnpj_trigger_ok,
  has_schema_privilege('authenticated', 'private', 'USAGE')
    and has_schema_privilege('service_role', 'private', 'USAGE')
    and not has_schema_privilege('anon', 'private', 'USAGE')
    as private_schema_grants_ok,
  has_function_privilege('authenticated', 'private.tem_recurso_operacional_19(uuid,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'private.pode_operar_estabelecimento_19(uuid,text[])', 'EXECUTE')
    and has_function_privilege('authenticated', 'private.tem_recurso_193(uuid,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'private.pode_executar_acao_193(uuid,text)', 'EXECUTE')
    as helpers_rls_continuam_acessiveis,
  has_function_privilege('authenticated', 'private.normalizar_cnpj_111(text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'private.cnpj_valido_111(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'private.normalizar_cnpj_111(text)', 'EXECUTE')
    and not has_function_privilege('anon', 'private.cnpj_valido_111(text)', 'EXECUTE')
    as helpers_cnpj_grants_ok,
  (
    select count(*) = 5
    from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'consentimentos_usuario',
        'solicitacoes_exclusao_conta',
        'fila_emails',
        'politicas_retencao_dados',
        'assinatura_eventos'
      )
      and c.relrowsecurity
  ) as rls_novas_tabelas_ok,
  not has_table_privilege('anon', 'public.consentimentos_usuario', 'SELECT')
    and has_table_privilege('authenticated', 'public.consentimentos_usuario', 'SELECT')
    and not has_table_privilege('authenticated', 'public.consentimentos_usuario', 'INSERT')
    and not has_table_privilege('authenticated', 'public.consentimentos_usuario', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.consentimentos_usuario', 'DELETE')
    as consentimentos_imutaveis_ok,
  coalesce((
    select position('public.consentimentos_usuario' in pg_get_functiondef(p.oid)) > 0
      and array_to_string(p.proconfig, ',') like '%search_path=%'
      and array_to_string(p.proconfig, ',') not like '%search_path=public%'
    from pg_proc p
    where p.oid=to_regprocedure('public.handle_new_user()')
  ),false) as consentimentos_cadastro_auth_ok,
  not has_table_privilege('anon', 'public.solicitacoes_exclusao_conta', 'SELECT')
    and has_table_privilege('authenticated', 'public.solicitacoes_exclusao_conta', 'SELECT')
    and not has_table_privilege('authenticated', 'public.solicitacoes_exclusao_conta', 'INSERT')
    and not has_table_privilege('authenticated', 'public.solicitacoes_exclusao_conta', 'UPDATE')
    and not has_table_privilege('authenticated', 'public.solicitacoes_exclusao_conta', 'DELETE')
    as exclusao_tabela_restrita_ok,
  not has_table_privilege('anon', 'public.fila_emails', 'SELECT')
    and not has_table_privilege('authenticated', 'public.fila_emails', 'SELECT')
    and has_table_privilege('service_role', 'public.fila_emails', 'SELECT')
    and has_table_privilege('service_role', 'public.fila_emails', 'INSERT')
    and has_table_privilege('service_role', 'public.fila_emails', 'UPDATE')
    and has_table_privilege('service_role', 'public.fila_emails', 'DELETE')
    as fila_email_grants_ok,
  not has_table_privilege('anon', 'public.assinatura_eventos', 'SELECT')
    and not has_table_privilege('authenticated', 'public.assinatura_eventos', 'SELECT')
    and has_table_privilege('service_role', 'public.assinatura_eventos', 'SELECT')
    and has_table_privilege('service_role', 'public.assinatura_eventos', 'INSERT')
    as assinatura_eventos_grants_ok,
  (
    select count(*) = 3
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'assinatura_eventos'
      and column_name in ('ator_id','origem','chave_idempotencia')
  ) as assinatura_eventos_admin_colunas_ok,
  exists(
    select 1
    from pg_indexes
    where schemaname = 'public'
      and tablename = 'assinatura_eventos'
      and indexname = 'assinatura_eventos_admin_idempotencia_111_idx'
  ) as assinatura_admin_idempotencia_indice_ok,
  not has_function_privilege(
    'anon',
    'public.admin_atribuir_plano_111(uuid,text,text,date,text,text)',
    'EXECUTE'
  )
    and has_function_privilege(
      'authenticated',
      'public.admin_atribuir_plano_111(uuid,text,text,date,text,text)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.admin_atribuir_plano_111(uuid,text,text,date,text,text)',
      'EXECUTE'
    ) as assinatura_admin_rpc_ok,
  coalesce((
    select array_to_string(p.proconfig, ',') like '%search_path=%'
      and array_to_string(p.proconfig, ',') not like '%search_path=public%'
    from pg_proc p
    where p.oid = to_regprocedure(
      'public.admin_atribuir_plano(uuid,text,text,date,text)'
    )
  ), false)
    and not has_function_privilege(
      'authenticated',
      'public.admin_atribuir_plano(uuid,text,text,date,text)',
      'EXECUTE'
    )
    and has_function_privilege(
      'service_role',
      'public.admin_atribuir_plano(uuid,text,text,date,text)',
      'EXECUTE'
    ) as assinatura_admin_legada_fechada_ok,
  not has_function_privilege('anon', 'public.solicitar_exclusao_conta_111(text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.solicitar_exclusao_conta_111(text)', 'EXECUTE')
    as exclusao_rpc_usuario_ok,
  to_regprocedure('public.excluir_minha_conta()') is null
    as exclusao_imediata_removida_ok,
  to_regprocedure('public.processar_exclusoes_conta_111(integer)') is null
    and not has_function_privilege('authenticated', 'public.reservar_exclusoes_conta_111(integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.reservar_exclusoes_conta_111(integer)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.reservar_exclusoes_conta_111(integer)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.listar_arquivos_conta_exclusao_111(uuid,uuid,integer)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.anonimizar_conta_exclusao_111(uuid,uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.concluir_exclusao_conta_111(uuid)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.falhar_exclusao_conta_111(uuid,text)', 'EXECUTE')
    as worker_exclusao_backend_ok,
  not has_function_privilege('authenticated', 'public.reservar_emails_pendentes_111(integer)', 'EXECUTE')
    and not has_function_privilege('anon', 'public.reservar_emails_pendentes_111(integer)', 'EXECUTE')
    and has_function_privilege('service_role', 'public.reservar_emails_pendentes_111(integer)', 'EXECUTE')
    as worker_email_grants_ok,
  has_function_privilege(
    'authenticated',
    'public.criar_estabelecimento_inicial(text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,jsonb,jsonb,text,text,text,text,text)',
    'EXECUTE'
  )
    and not has_function_privilege(
      'anon',
      'public.criar_estabelecimento_inicial(text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,jsonb,jsonb,text,text,text,text,text)',
      'EXECUTE'
    ) as onboarding_cnpj_grants_ok,
  exists(
    select 1
    from public.planos
    where slug = 'gratuito'
      and ativo
      and not permite_agenda
  )
    and exists(
      select 1
      from pg_trigger t
      join pg_proc p on p.oid = t.tgfoid
      join pg_namespace n on n.oid = p.pronamespace
      where t.tgrelid = 'public.estabelecimentos'::regclass
        and t.tgname = 'estabelecimentos_validar_agenda_plano'
        and not t.tgisinternal
        and (t.tgtype & 2) = 2
        and (t.tgtype & 4) = 4
        and (t.tgtype & 16) = 16
        and n.nspname = 'private'
        and p.proname = 'validar_estabelecimento_agenda_plano_111'
    )
    and to_regprocedure('public.validar_estabelecimento_agenda_plano()') is null
    as onboarding_agenda_entitlement_ok,
  to_regprocedure(
    'public.criar_estabelecimento_inicial(text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,jsonb,jsonb,text,text,text,text)'
  ) is null as onboarding_antigo_removido,
  has_function_privilege(
    'authenticated',
    'public.criar_agendamento_idempotente_111(uuid,uuid,uuid[],date,time without time zone,text,text,text,text)',
    'EXECUTE'
  ) as agendamento_idempotente_aberto,
  has_function_privilege('authenticated','public.listar_meus_estabelecimentos_operados_111()','EXECUTE')
    and not has_function_privilege('anon','public.listar_meus_estabelecimentos_operados_111()','EXECUTE')
    as vinculos_proprios_interface_ok,
  has_function_privilege('authenticated','public.cancelar_recorrencia_agendamento_111(uuid)','EXECUTE')
    and has_function_privilege('service_role','public.cancelar_recorrencia_agendamento_111(uuid)','EXECUTE')
    and not has_function_privilege('anon','public.cancelar_recorrencia_agendamento_111(uuid)','EXECUTE')
    as recorrencia_cancelamento_seguro_ok,
  has_function_privilege(
    'authenticated',
    'public.criar_agendamento(uuid,uuid,uuid,date,time without time zone,text)',
    'EXECUTE'
  )
    and has_function_privilege(
      'authenticated',
      'public.criar_agendamento_multisservico(uuid,uuid,uuid[],date,time without time zone,text)',
      'EXECUTE'
    )
    and has_function_privilege(
      'authenticated',
      'public.criar_agendamento_com_cupom_193(uuid,uuid,uuid[],date,time without time zone,text,text)',
      'EXECUTE'
    ) as agendamentos_legados_compativeis,
  has_function_privilege(
    'anon',
    'public.buscar_marketplace_regional_111(text,text,text,boolean,text,text,text,numeric,numeric,numeric,text,numeric,numeric,numeric,integer,integer)',
    'EXECUTE'
  )
    and has_function_privilege(
      'authenticated',
      'public.buscar_marketplace_regional_111(text,text,text,boolean,text,text,text,numeric,numeric,numeric,text,numeric,numeric,numeric,integer,integer)',
      'EXECUTE'
    ) as marketplace_filtros_combinados_ok,
  exists(
    select 1
    from pg_trigger
    where tgrelid = 'public.agendamentos'::regclass
      and tgname = 'agendamentos_bloquear_autoagendamento_111'
      and not tgisinternal
  )
    and exists(
      select 1
      from pg_trigger
      where tgrelid = 'public.lista_espera'::regclass
        and tgname = 'lista_espera_bloquear_autoagendamento_111'
        and not tgisinternal
    ) as autoagendamento_triggers_ok,
  exists(
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'pgcrypto'
      and n.nspname = 'extensions'
  )
    and to_regprocedure('extensions.digest(bytea,text)') is not null
    as pgcrypto_digest_ok,
  coalesce((
    select array_to_string(p.proconfig, ',') like '%search_path=pg_catalog, extensions%'
      or array_to_string(p.proconfig, ',') like '%search_path=pg_catalog,extensions%'
    from pg_proc p
    where p.oid = to_regprocedure(
      'public.registrar_atendimento_manual_110(uuid,uuid,uuid,text,integer,uuid,text,text,text,timestamp with time zone,numeric,text,text,text,text,text)'
    )
  ), false) as atendimento_manual_search_path_ok,
  coalesce((
    select array_to_string(p.proconfig, ',') like '%search_path=pg_catalog, extensions%'
      or array_to_string(p.proconfig, ',') like '%search_path=pg_catalog,extensions%'
    from pg_proc p
    where p.oid = to_regprocedure(
      'public.registrar_despesa_110(uuid,date,numeric,text,text,text,text,text,text)'
    )
  ), false) as despesa_search_path_ok,
  (
    select count(*)
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'agendamentos_registrado_por_111_idx',
        'auditoria_operacional_ator_111_idx',
        'feature_flag_alvos_definido_por_111_idx',
        'feature_flags_updated_by_111_idx',
        'importacoes_operacionais_solicitado_por_111_idx',
        'push_assinaturas_estabelecimento_111_idx',
        'push_entregas_assinatura_111_idx',
        'push_entregas_user_111_idx',
        'push_preferencias_estabelecimento_111_idx'
      )
  ) as indices_fk_novos,
  (
    select count(*) = 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'biblioteca_capas'
      and 'authenticated' = any(roles)
      and cmd in ('SELECT', 'ALL')
  ) as biblioteca_select_unica_ok,
  exists(
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'unaccent'
      and n.nspname = 'extensions'
  ) as unaccent_fora_public_ok,
  exists(
    select 1
    from pg_extension e
    join pg_namespace n on n.oid = e.extnamespace
    where e.extname = 'btree_gist'
      and n.nspname = 'extensions'
  ) as btree_gist_fora_public_ok,
  cron.cron_disponivel,
  cron.cron_exclusao_externo_ok,
  cron.cron_retencao_ok
from barberhub_cron_111 cron;

commit;
