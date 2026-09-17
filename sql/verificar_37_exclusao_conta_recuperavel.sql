-- Execute apos a migration 20260917133000 em homologacao.
do $$
declare
  v_execucao text;
  v_reserva text;
  v_conclusao text;
begin
  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='solicitacoes_exclusao_conta'
      and column_name='user_id_tecnico'
  ) then raise exception 'Identidade tecnica temporaria da exclusao ausente.'; end if;

  select pg_get_functiondef('private.executar_exclusao_conta_111(uuid)'::regprocedure) into v_execucao;
  if v_execucao not like '%Conta do cliente removida%'
     or v_execucao not like '%Profissional indisponivel por exclusao de conta%'
     or v_execucao not like '%permite_email_marketing=false%'
  then raise exception 'Cancelamento ou limpeza de CRM da exclusao incompletos.'; end if;

  select pg_get_functiondef('public.reservar_exclusoes_conta_111(integer)'::regprocedure) into v_reserva;
  if v_reserva not like '%user_id_tecnico is not null%'
     or v_reserva not like '%returning s.id,s.user_id_tecnico%'
  then raise exception 'Fila de exclusao nao esta recuperavel apos Auth.'; end if;

  select pg_get_functiondef('public.concluir_exclusao_conta_111(uuid)'::regprocedure) into v_conclusao;
  if v_conclusao not like '%user_id_tecnico=null%'
  then raise exception 'Identidade tecnica nao e apagada na conclusao.'; end if;

  raise notice 'exclusao_recuperavel_ok';
end $$;
