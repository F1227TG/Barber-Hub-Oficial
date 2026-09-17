-- A rotina anterior descartava registros com prazos fixos que nao eram lidos
-- da politica. Ate haver aprovacao juridica/comercial por categoria, o cron
-- continua existindo, mas apenas inventaria e simula: nao apaga nenhum dado.

alter table public.politicas_retencao_dados
  add column if not exists execucao_habilitada boolean not null default false,
  add column if not exists aprovada_em timestamptz,
  add column if not exists aprovada_por uuid references public.perfis(id) on delete set null;

comment on column public.politicas_retencao_dados.execucao_habilitada is
  'So pode ser ativada em migration posterior apos aprovacao documentada por categoria.';

-- Princípio fail-closed: as sementes antigas nao constituem aprovacao.
update public.politicas_retencao_dados
set ativa=false,execucao_habilitada=false,aprovada_em=null,aprovada_por=null;

create table if not exists public.retencao_simulacoes_1111 (
  id uuid primary key default gen_random_uuid(),
  executado_em timestamptz not null default now(),
  origem text not null default 'cron' check (origem in ('cron','manual')),
  resultado jsonb not null default '{}'::jsonb
);
alter table public.retencao_simulacoes_1111 enable row level security;
drop policy if exists retencao_simulacoes_admin_1111 on public.retencao_simulacoes_1111;
create policy retencao_simulacoes_admin_1111 on public.retencao_simulacoes_1111
for select to authenticated using ((select public.is_admin()));
revoke all on table public.retencao_simulacoes_1111 from public,anon,authenticated;
grant select on table public.retencao_simulacoes_1111 to authenticated;
grant select,insert,update,delete on table public.retencao_simulacoes_1111 to service_role;

create or replace function public.simular_retencao_tecnica_1111(p_origem text default 'cron')
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_origem text := lower(trim(coalesce(p_origem,'')));
  v_resultado jsonb;
begin
  if v_origem not in ('cron','manual') then raise exception 'RETENTION_ORIGIN_INVALID'; end if;

  select jsonb_build_object(
    'modo','simulacao',
    'acoes_aplicadas',0,
    'executado_em',now(),
    'recursos',coalesce(jsonb_agg(jsonb_build_object(
      'recurso',p.recurso,
      'prazo_dias',p.retencao_dias,
      'acao_final',p.acao_final,
      'ativa',p.ativa,
      'execucao_habilitada',p.execucao_habilitada,
      'aprovada_em',p.aprovada_em,
      'estado',case when p.ativa and p.execucao_habilitada and p.aprovada_em is not null
                    then 'aguarda_migration_de_aplicacao' else 'requer_aprovacao' end,
      'candidatos',case p.recurso
        when 'fila_email_entregue' then (
          select count(*) from public.fila_emails e
          where e.status in ('enviado','descartado')
            and e.updated_at < now()-make_interval(days=>p.retencao_dias)
        )
        when 'entrega_push_finalizada' then (
          select count(*) from public.push_entregas e
          where e.status in ('enviada','descartada')
            and e.updated_at < now()-make_interval(days=>p.retencao_dias)
        )
        when 'limite_api_expirado' then (
          select count(*) from public.api_rate_limits e
          where e.updated_at < now()-make_interval(days=>p.retencao_dias)
        )
        else null
      end,
      'observacao',case p.recurso
        when 'fila_email_entregue' then 'Mapeado; somente contagem ate aprovacao.'
        when 'entrega_push_finalizada' then 'Mapeado; somente contagem ate aprovacao.'
        when 'limite_api_expirado' then 'Mapeado; somente contagem ate aprovacao.'
        else 'Sem rotina automatica; requer definicao por categoria.'
      end
    ) order by p.recurso),'[]'::jsonb)
  ) into v_resultado
  from public.politicas_retencao_dados p;

  insert into public.retencao_simulacoes_1111(origem,resultado)
  values(v_origem,v_resultado);
  return v_resultado;
end;
$$;
revoke all on function public.simular_retencao_tecnica_1111(text) from public,anon,authenticated;
grant execute on function public.simular_retencao_tecnica_1111(text) to service_role;

-- Mantem o contrato e o cron 1.11, porem troca a acao destrutiva pela
-- simulacao rastreavel. A execucao real exigira uma migration especifica.
create or replace function public.executar_retencao_tecnica_111()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  return public.simular_retencao_tecnica_1111('cron');
end;
$$;
revoke all on function public.executar_retencao_tecnica_111() from public,anon,authenticated;
grant execute on function public.executar_retencao_tecnica_111() to service_role;
