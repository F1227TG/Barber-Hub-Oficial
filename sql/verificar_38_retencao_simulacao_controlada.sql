-- Execute apos a migration 20260917140000 em homologacao.
do $$
declare
  v_legada text;
  v_simulacao text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='politicas_retencao_dados'
      and column_name in ('execucao_habilitada','aprovada_em','aprovada_por')
    group by table_schema,table_name having count(*)=3
  ) then raise exception 'Controles de aprovacao da retencao ausentes.'; end if;
  if to_regclass('public.retencao_simulacoes_1111') is null then
    raise exception 'Log de simulacao de retencao ausente.';
  end if;

  select pg_get_functiondef('public.executar_retencao_tecnica_111()'::regprocedure) into v_legada;
  select pg_get_functiondef('public.simular_retencao_tecnica_1111(text)'::regprocedure) into v_simulacao;
  if v_legada not like '%simular_retencao_tecnica_1111%'
     or v_legada like '%delete from public.%'
  then raise exception 'Cron de retencao ainda pode executar descarte direto.'; end if;
  if v_simulacao not like '%''modo'',''simulacao''%'
     or v_simulacao not like '%''acoes_aplicadas'',0%'
     or v_simulacao not like '%retencao_simulacoes_1111%'
  then raise exception 'Simulacao de retencao nao esta rastreavel.'; end if;
  if exists(select 1 from public.politicas_retencao_dados where ativa or execucao_habilitada) then
    raise exception 'Nenhuma categoria deve iniciar ativa sem aprovacao posterior.';
  end if;
  raise notice 'retencao_simulacao_controlada_ok';
end $$;
