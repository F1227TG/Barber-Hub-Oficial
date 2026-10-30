-- Unknown duration is not a zero-minute appointment or an invented estimate.
alter table public.servicos alter column duracao_min drop not null;

-- A mixed selection must not silently discard services without a duration.
do $$
declare f record; definition text;
begin
 for f in select p.oid from pg_proc p join pg_namespace n on n.oid=p.pronamespace
 where n.nspname='public' and p.proname in ('criar_agendamento_multisservico','criar_encaixe_operacional_19','criar_agendamento_idempotente_111')
 loop
  definition:=pg_get_functiondef(f.oid);
  definition:=replace(definition,'sum(s.duracao_min)::integer','(case when count(s.duracao_min)=count(*) then sum(s.duracao_min) else null end)::integer');
  definition:=replace(definition,'if v_quantidade <> cardinality(p_servicos_ids)', 'if v_duracao_total is null or v_quantidade <> cardinality(p_servicos_ids)');
  execute definition;
 end loop;
end $$;
