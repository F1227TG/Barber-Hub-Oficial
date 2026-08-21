-- Execute depois da migration 22. O resultado esperado é uma linha com todos
-- os campos booleanos em true e total_tabelas_rls = 9.

select
  to_regclass('public.estabelecimento_membros') is not null as membros_ok,
  to_regclass('public.agenda_bloqueios') is not null as bloqueios_ok,
  to_regclass('public.agenda_intervalos_recorrentes') is not null as intervalos_ok,
  to_regclass('public.agendamento_eventos') is not null as eventos_ok,
  to_regclass('public.clientes_estabelecimento') is not null as crm_ok,
  to_regclass('public.cliente_notas') is not null as notas_ok,
  to_regclass('public.regras_comissao') is not null as comissoes_ok,
  to_regclass('public.lancamentos_financeiros') is not null as financeiro_ok,
  to_regclass('public.fechamentos_diarios') is not null as fechamento_ok,
  (
    select count(*) from pg_class c
    join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in (
        'estabelecimento_membros','agenda_bloqueios','agenda_intervalos_recorrentes',
        'agendamento_eventos','clientes_estabelecimento','cliente_notas',
        'lancamentos_financeiros','regras_comissao','fechamentos_diarios'
      )
      and c.relrowsecurity = true
  ) as total_tabelas_rls,
  exists (
    select 1 from information_schema.columns
    where table_schema = 'public' and table_name = 'planos' and column_name = 'permite_financeiro'
  ) as entitlements_ok,
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'reagendar_agendamento_19'
  ) as reagendamento_rpc_ok,
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'fechar_dia_financeiro_19'
  ) as fechamento_rpc_ok,
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'criar_bloqueio_agenda_19'
  ) as bloqueio_rpc_ok,
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'atualizar_membro_estabelecimento_19'
  ) as membro_rpc_ok,
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'regras_comissao_escopo_unico_idx'
  ) as escopo_comissao_unico_ok;
