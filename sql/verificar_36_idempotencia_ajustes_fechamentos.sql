-- Verificação pós-migration 36. Rode em homologação após aplicar a migration.
select
  to_regclass('public.operacoes_financeiras_idempotentes') is not null as registro_idempotencia_ok,
  (
    select count(*) = 2
    from pg_proc p
    where p.oid in (
      to_regprocedure('public.criar_ajuste_financeiro_idempotente_1111(uuid,date,text,numeric,text,text,text,text)'),
      to_regprocedure('public.fechar_dia_financeiro_idempotente_1111(uuid,date,text,text,text)')
    )
  ) as rpcs_idempotentes_ok,
  not has_function_privilege('authenticated', 'public.criar_ajuste_financeiro_19(uuid,date,text,numeric,text,text)', 'EXECUTE')
    and not has_function_privilege('authenticated', 'public.fechar_dia_financeiro_19(uuid,date,text)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.criar_ajuste_financeiro_19(uuid,date,text,numeric,text,text)', 'EXECUTE')
    and not has_function_privilege('service_role', 'public.fechar_dia_financeiro_19(uuid,date,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.criar_ajuste_financeiro_idempotente_1111(uuid,date,text,numeric,text,text,text,text)', 'EXECUTE')
    and has_function_privilege('authenticated', 'public.fechar_dia_financeiro_idempotente_1111(uuid,date,text,text,text)', 'EXECUTE')
    as caminhos_legados_fechados_ok,
  not has_table_privilege('anon', 'public.operacoes_financeiras_idempotentes', 'SELECT')
    and not has_table_privilege('authenticated', 'public.operacoes_financeiras_idempotentes', 'SELECT')
    as tabela_idempotencia_restrita_ok;
