-- Verificação pós-migration 40: agenda básica gratuita e oferta em validação.

select
  exists(
    select 1
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'planos'
      and column_name = 'estado_comercial'
      and column_default like '%desenvolvimento%'
  ) as estado_comercial_coluna_ok,
  not exists(
    select 1
    from public.planos
    where ativo and estado_comercial is distinct from 'desenvolvimento'
  ) as catalogo_em_desenvolvimento_ok,
  exists(
    select 1
    from public.planos
    where slug = 'gratuito'
      and ativo
      and permite_agenda
      and recursos ? 'Agenda online básica'
  ) as agenda_basica_gratuita_ok,
  exists(
    select 1
    from pg_trigger t
    join pg_proc p on p.oid = t.tgfoid
    join pg_namespace n on n.oid = p.pronamespace
    where t.tgrelid = 'public.estabelecimentos'::regclass
      and t.tgname = 'estabelecimentos_validar_agenda_plano'
      and not t.tgisinternal
      and n.nspname = 'private'
      and p.proname = 'validar_estabelecimento_agenda_plano_1112'
  ) as ativacao_agenda_controlada_ok,
  coalesce((
    select position('v_est.aceita_agendamento' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    where p.oid = to_regprocedure('public.validar_agendamento_plano()')
  ), false) as agendamento_respeita_decisao_do_barbeiro_ok;
