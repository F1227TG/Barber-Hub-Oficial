-- Verificação pós-migration 35. Execute em homologação com dados sintéticos.
select
  (
    select count(*) = 3
    from information_schema.columns
    where table_schema = 'public'
      and table_name = 'fechamentos_diarios'
      and column_name in ('despesas_realizadas', 'resultado_operacional', 'resultado_apos_comissoes')
  ) as colunas_de_reconciliacao_ok,
  coalesce((
    select position('''despesa''' in pg_get_functiondef(p.oid)) > 0
      and position('resultado_operacional' in pg_get_functiondef(p.oid)) > 0
      and position('resultado_apos_comissoes' in pg_get_functiondef(p.oid)) > 0
    from pg_proc p
    where p.oid = to_regprocedure('public.fechar_dia_financeiro_19(uuid,date,text)')
  ), false) as fechamento_inclui_despesas_e_comissoes_ok;
