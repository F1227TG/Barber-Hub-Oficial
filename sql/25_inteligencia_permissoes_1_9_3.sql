-- Barber Hub 1.9.3: Central de Oportunidades, insights, metas e permissões granulares.
-- Execute depois de 24_retencao_relacionamento_1_9_3.sql.

begin;

-- ============================================================
-- 1. PERMISSÕES CONFIGURÁVEIS SOBRE PADRÕES SEGUROS
-- ============================================================

create table if not exists public.membro_permissoes (
  membro_id uuid not null references public.estabelecimento_membros(id) on delete cascade,
  recurso text not null check (recurso in (
    'agenda','crm','financeiro','equipe','configuracoes','retencao','campanhas','crescimento','metas'
  )),
  permitido boolean not null,
  definido_por uuid not null references public.perfis(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (membro_id, recurso)
);

create index if not exists membro_permissoes_recurso_idx on public.membro_permissoes(recurso, permitido);
create index if not exists membro_permissoes_definido_por_idx on public.membro_permissoes(definido_por);
drop trigger if exists membro_permissoes_updated_at on public.membro_permissoes;
create trigger membro_permissoes_updated_at before update on public.membro_permissoes
for each row execute function public.set_updated_at();

alter table public.membro_permissoes enable row level security;

create or replace function private.pode_executar_acao_193(p_estabelecimento_id uuid, p_recurso text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_papel text; v_membro_id uuid; v_padrao boolean; v_override boolean;
begin
  if p_recurso not in ('agenda','crm','financeiro','equipe','configuracoes','retencao','campanhas','crescimento','metas') then return false; end if;
  v_papel := private.papel_no_estabelecimento_19(p_estabelecimento_id);
  if v_papel in ('proprietario','admin') then return true; end if;
  if v_papel is null then return false; end if;
  v_padrao := case v_papel
    when 'gerente' then p_recurso = any(array['agenda','crm','financeiro','equipe','configuracoes','retencao','campanhas','crescimento','metas']::text[])
    when 'recepcao' then p_recurso = any(array['agenda','crm','retencao']::text[])
    when 'profissional' then p_recurso = any(array['agenda','crm','retencao']::text[])
    else false end;
  if not private.tem_recurso_193(p_estabelecimento_id,'permite_permissoes_granulares') then return v_padrao; end if;
  select m.id into v_membro_id from public.estabelecimento_membros m
  where m.estabelecimento_id=p_estabelecimento_id and m.user_id=(select auth.uid()) and m.status='ativo' limit 1;
  select mp.permitido into v_override from public.membro_permissoes mp
  where mp.membro_id=v_membro_id and mp.recurso=p_recurso;
  return coalesce(v_override,v_padrao);
end;
$$;

revoke all on function private.pode_executar_acao_193(uuid,text) from public, anon;
grant execute on function private.pode_executar_acao_193(uuid,text) to authenticated, service_role;

drop policy if exists membro_permissoes_select on public.membro_permissoes;
create policy membro_permissoes_select on public.membro_permissoes for select to authenticated
using (
  exists (
    select 1 from public.estabelecimento_membros m where m.id=membro_id
      and (m.user_id=(select auth.uid()) or private.pode_executar_acao_193(m.estabelecimento_id,'equipe'))
  )
);
grant select on public.membro_permissoes to authenticated;
revoke insert, update, delete on public.membro_permissoes from anon, authenticated;

create or replace function public.obter_minhas_permissoes_193(p_estabelecimento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Autenticação obrigatória.'; end if;
  if not private.pode_operar_estabelecimento_19(p_estabelecimento_id) and not public.is_admin() then
    raise exception 'Sua conta não pertence a este estabelecimento.';
  end if;
  return jsonb_build_object(
    'papel',private.papel_no_estabelecimento_19(p_estabelecimento_id),
    'granular_ativo',private.tem_recurso_193(p_estabelecimento_id,'permite_permissoes_granulares'),
    'agenda',private.pode_executar_acao_193(p_estabelecimento_id,'agenda'),
    'crm',private.pode_executar_acao_193(p_estabelecimento_id,'crm'),
    'financeiro',private.pode_executar_acao_193(p_estabelecimento_id,'financeiro'),
    'equipe',private.pode_executar_acao_193(p_estabelecimento_id,'equipe'),
    'configuracoes',private.pode_executar_acao_193(p_estabelecimento_id,'configuracoes'),
    'retencao',private.pode_executar_acao_193(p_estabelecimento_id,'retencao'),
    'campanhas',private.pode_executar_acao_193(p_estabelecimento_id,'campanhas'),
    'crescimento',private.pode_executar_acao_193(p_estabelecimento_id,'crescimento'),
    'metas',private.pode_executar_acao_193(p_estabelecimento_id,'metas')
  );
end;
$$;

revoke all on function public.obter_minhas_permissoes_193(uuid) from public, anon;
grant execute on function public.obter_minhas_permissoes_193(uuid) to authenticated, service_role;

create or replace function public.atualizar_permissoes_membro_193(p_membro_id uuid, p_permissoes jsonb)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_membro public.estabelecimento_membros%rowtype; v_chave text; v_valor jsonb;
begin
  select * into v_membro from public.estabelecimento_membros where id=p_membro_id for update;
  if not found then raise exception 'Membro da equipe não encontrado.'; end if;
  if not private.tem_recurso_193(v_membro.estabelecimento_id,'permite_permissoes_granulares') then
    raise exception 'Permissões granulares estão disponíveis no plano Elite.';
  end if;
  if not private.pode_operar_estabelecimento_19(v_membro.estabelecimento_id,array['proprietario','admin']::text[]) then
    raise exception 'Somente proprietário ou administrador pode configurar permissões.';
  end if;
  if v_membro.papel in ('proprietario','admin') then
    raise exception 'O acesso total de proprietário e administrador não pode ser reduzido.';
  end if;
  if p_permissoes is null or jsonb_typeof(p_permissoes)<>'object' then raise exception 'Informe um objeto de permissões.'; end if;
  for v_chave,v_valor in select key,value from jsonb_each(p_permissoes) loop
    if v_chave not in ('agenda','crm','financeiro','equipe','configuracoes','retencao','campanhas','crescimento','metas')
       or jsonb_typeof(v_valor)<>'boolean' then raise exception 'Permissão inválida: %',v_chave; end if;
    insert into public.membro_permissoes(membro_id,recurso,permitido,definido_por)
    values (p_membro_id,v_chave,(v_valor::text)::boolean,(select auth.uid()))
    on conflict (membro_id,recurso) do update set permitido=excluded.permitido,definido_por=excluded.definido_por,updated_at=now();
  end loop;
  return (select coalesce(jsonb_object_agg(mp.recurso,mp.permitido),'{}'::jsonb) from public.membro_permissoes mp where mp.membro_id=p_membro_id);
end;
$$;

revoke all on function public.atualizar_permissoes_membro_193(uuid,jsonb) from public, anon;
grant execute on function public.atualizar_permissoes_membro_193(uuid,jsonb) to authenticated, service_role;

-- Intersecta os entitlements operacionais existentes com as permissões
-- configuradas, mantendo proprietário/admin sempre com acesso total.
create or replace function private.tem_recurso_operacional_19(p_estabelecimento_id uuid,p_recurso text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_entitlements jsonb; v_capacidade text;
begin
  if p_recurso not in ('permite_agenda_avancada','permite_crm','permite_financeiro','permite_comissoes','permite_equipe_acesso') then return false; end if;
  v_entitlements:=public.calcular_entitlements_estabelecimento_193(p_estabelecimento_id);
  if not coalesce((v_entitlements->>p_recurso)::boolean,false) then return false; end if;
  v_capacidade:=case p_recurso when 'permite_agenda_avancada' then 'agenda' when 'permite_crm' then 'crm'
    when 'permite_financeiro' then 'financeiro' when 'permite_comissoes' then 'financeiro' else 'equipe' end;
  return private.pode_executar_acao_193(p_estabelecimento_id,v_capacidade);
end;
$$;

revoke all on function private.tem_recurso_operacional_19(uuid,text) from public, anon;
grant execute on function private.tem_recurso_operacional_19(uuid,text) to authenticated, service_role;

-- ============================================================
-- 2. METAS MENSURÁVEIS
-- ============================================================

create table if not exists public.metas_crescimento (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  profissional_id uuid references public.profissionais(id) on delete cascade,
  tipo text not null check (tipo in ('receita','atendimentos','ticket_medio','novos_clientes','ocupacao')),
  nome text not null,
  valor_alvo numeric(14,2) not null check (valor_alvo > 0),
  periodo_inicio date not null,
  periodo_fim date not null,
  status text not null default 'ativa' check (status in ('ativa','atingida','encerrada','cancelada')),
  criado_por uuid not null references public.perfis(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (periodo_inicio <= periodo_fim),
  check (periodo_fim <= periodo_inicio + 366)
);

create index if not exists metas_estabelecimento_periodo_idx on public.metas_crescimento(estabelecimento_id,status,periodo_inicio,periodo_fim);
create index if not exists metas_profissional_idx on public.metas_crescimento(profissional_id) where profissional_id is not null;
create index if not exists metas_criado_por_idx on public.metas_crescimento(criado_por);
drop trigger if exists metas_crescimento_updated_at on public.metas_crescimento;
create trigger metas_crescimento_updated_at before update on public.metas_crescimento for each row execute function public.set_updated_at();
alter table public.metas_crescimento enable row level security;
drop policy if exists metas_select_equipe on public.metas_crescimento;
create policy metas_select_equipe on public.metas_crescimento for select to authenticated
using (private.tem_recurso_193(estabelecimento_id,'permite_metas') and private.pode_executar_acao_193(estabelecimento_id,'metas'));
drop policy if exists metas_manage_gestao on public.metas_crescimento;
create policy metas_manage_gestao on public.metas_crescimento for all to authenticated
using (private.tem_recurso_193(estabelecimento_id,'permite_metas') and private.pode_executar_acao_193(estabelecimento_id,'metas'))
with check (
  private.tem_recurso_193(estabelecimento_id,'permite_metas')
  and private.pode_executar_acao_193(estabelecimento_id,'metas')
  and (
    profissional_id is null
    or exists (
      select 1 from public.profissionais p
      where p.id = metas_crescimento.profissional_id
        and p.estabelecimento_id = metas_crescimento.estabelecimento_id
    )
  )
);
grant select,insert,update,delete on public.metas_crescimento to authenticated;

create or replace function public.progresso_meta_193(p_meta_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_meta public.metas_crescimento%rowtype; v_atual numeric(14,2):=0; v_capacidade numeric(14,2):=0;
begin
  select * into v_meta from public.metas_crescimento where id=p_meta_id;
  if not found or not private.pode_executar_acao_193(v_meta.estabelecimento_id,'metas') then raise exception 'Meta não encontrada ou sem permissão.'; end if;
  if v_meta.tipo='receita' then
    select coalesce(sum(a.valor),0) into v_atual from public.agendamentos a where a.estabelecimento_id=v_meta.estabelecimento_id and a.status='concluido' and a.data between v_meta.periodo_inicio and v_meta.periodo_fim and (v_meta.profissional_id is null or a.profissional_id=v_meta.profissional_id);
  elsif v_meta.tipo='atendimentos' then
    select count(*) into v_atual from public.agendamentos a where a.estabelecimento_id=v_meta.estabelecimento_id and a.status='concluido' and a.data between v_meta.periodo_inicio and v_meta.periodo_fim and (v_meta.profissional_id is null or a.profissional_id=v_meta.profissional_id);
  elsif v_meta.tipo='ticket_medio' then
    select coalesce(avg(a.valor),0) into v_atual from public.agendamentos a where a.estabelecimento_id=v_meta.estabelecimento_id and a.status='concluido' and a.data between v_meta.periodo_inicio and v_meta.periodo_fim and (v_meta.profissional_id is null or a.profissional_id=v_meta.profissional_id);
  elsif v_meta.tipo='novos_clientes' then
    select count(*) into v_atual
    from public.clientes_estabelecimento c
    where c.estabelecimento_id=v_meta.estabelecimento_id
      and c.primeira_visita_em::date between v_meta.periodo_inicio and v_meta.periodo_fim
      and (
        v_meta.profissional_id is null
        or exists (
          select 1
          from public.agendamentos a
          where a.estabelecimento_id=v_meta.estabelecimento_id
            and a.cliente_id=c.cliente_id
            and a.profissional_id=v_meta.profissional_id
            and a.status='concluido'
            and a.data=c.primeira_visita_em::date
        )
      );
  else
    select coalesce(sum(extract(epoch from (a.hora_fim-a.hora_inicio))/60),0) into v_atual from public.agendamentos a where a.estabelecimento_id=v_meta.estabelecimento_id and a.status in ('pendente','confirmado','concluido') and a.data between v_meta.periodo_inicio and v_meta.periodo_fim and (v_meta.profissional_id is null or a.profissional_id=v_meta.profissional_id);
    select coalesce(sum(extract(epoch from (h.fecha-h.abre))/60),0) * greatest(case when v_meta.profissional_id is null then (select count(*) from public.profissionais p where p.estabelecimento_id=v_meta.estabelecimento_id and p.ativo) else 1 end,1)
    into v_capacidade from generate_series(v_meta.periodo_inicio,v_meta.periodo_fim,'1 day'::interval) d join public.horarios_funcionamento h on h.estabelecimento_id=v_meta.estabelecimento_id and h.dia_semana=extract(dow from d)::smallint and h.aberto;
    v_atual:=case when v_capacidade>0 then round(v_atual*100/v_capacidade,2) else 0 end;
  end if;
  return jsonb_build_object('id',v_meta.id,'tipo',v_meta.tipo,'valor_alvo',v_meta.valor_alvo,'valor_atual',round(v_atual,2),'percentual',least(round(v_atual*100/v_meta.valor_alvo,2),100),'atingida',v_atual>=v_meta.valor_alvo);
end;
$$;

revoke all on function public.progresso_meta_193(uuid) from public, anon;
grant execute on function public.progresso_meta_193(uuid) to authenticated, service_role;

-- ============================================================
-- 3. INSIGHTS E CENTRAL DE OPORTUNIDADES
-- ============================================================

create table if not exists public.oportunidades_crescimento (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  fingerprint text not null,
  tipo text not null check (tipo in ('retencao','ocupacao','lista_espera','avaliacao','faltas','cupom')),
  prioridade text not null check (prioridade in ('alta','media','baixa')),
  titulo text not null,
  descricao text not null,
  acao text not null,
  acao_dados jsonb not null default '{}'::jsonb,
  status text not null default 'aberta' check (status in ('aberta','concluida','ignorada','expirada')),
  detectada_em timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (estabelecimento_id,fingerprint)
);

create table if not exists public.insights_operacionais (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  periodo_inicio date not null,
  periodo_fim date not null,
  dados jsonb not null,
  gerado_em timestamptz not null default now(),
  unique (estabelecimento_id,periodo_inicio,periodo_fim)
);

create index if not exists oportunidades_estabelecimento_status_idx on public.oportunidades_crescimento(estabelecimento_id,status,prioridade,detectada_em desc);
create index if not exists insights_estabelecimento_periodo_idx on public.insights_operacionais(estabelecimento_id,periodo_inicio,periodo_fim);
drop trigger if exists oportunidades_updated_at on public.oportunidades_crescimento;
create trigger oportunidades_updated_at before update on public.oportunidades_crescimento for each row execute function public.set_updated_at();
alter table public.oportunidades_crescimento enable row level security;
alter table public.insights_operacionais enable row level security;
drop policy if exists oportunidades_select_equipe on public.oportunidades_crescimento;
create policy oportunidades_select_equipe on public.oportunidades_crescimento for select to authenticated
using (private.tem_recurso_193(estabelecimento_id,'permite_oportunidades') and private.pode_executar_acao_193(estabelecimento_id,'crescimento'));
drop policy if exists insights_select_equipe on public.insights_operacionais;
create policy insights_select_equipe on public.insights_operacionais for select to authenticated
using (private.tem_recurso_193(estabelecimento_id,'permite_insights') and private.pode_executar_acao_193(estabelecimento_id,'crescimento'));
grant select on public.oportunidades_crescimento,public.insights_operacionais to authenticated;
revoke insert,update,delete on public.oportunidades_crescimento,public.insights_operacionais from anon,authenticated;

create or replace function public.resumo_crescimento_193(p_estabelecimento_id uuid,p_inicio date,p_fim date)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_atendimentos integer; v_receita numeric; v_ticket numeric; v_clientes integer; v_recorrentes integer; v_novos integer; v_faltas integer; v_minutos numeric; v_capacidade numeric; v_servicos jsonb; v_equipe jsonb;
begin
  if p_fim<p_inicio or p_fim>p_inicio+366 then raise exception 'Período inválido.'; end if;
  if not private.tem_recurso_193(p_estabelecimento_id,'permite_insights') or not private.pode_executar_acao_193(p_estabelecimento_id,'crescimento') then raise exception 'Insights estão disponíveis no plano Elite.'; end if;
  select count(*)::integer,coalesce(sum(a.valor),0),coalesce(avg(a.valor),0),count(distinct a.cliente_id)::integer
    into v_atendimentos,v_receita,v_ticket,v_clientes from public.agendamentos a
    where a.estabelecimento_id=p_estabelecimento_id and a.status='concluido' and a.data between p_inicio and p_fim;
  select count(*)::integer into v_recorrentes from public.clientes_estabelecimento c where c.estabelecimento_id=p_estabelecimento_id and c.visitas_concluidas>=2 and c.ultima_visita_em::date between p_inicio and p_fim;
  select count(*)::integer into v_novos from public.clientes_estabelecimento c where c.estabelecimento_id=p_estabelecimento_id and c.primeira_visita_em::date between p_inicio and p_fim;
  select count(*)::integer into v_faltas from public.agendamentos a where a.estabelecimento_id=p_estabelecimento_id and a.status='faltou' and a.data between p_inicio and p_fim;
  select coalesce(sum(extract(epoch from (a.hora_fim-a.hora_inicio))/60),0) into v_minutos from public.agendamentos a where a.estabelecimento_id=p_estabelecimento_id and a.status in ('pendente','confirmado','concluido') and a.data between p_inicio and p_fim;
  select coalesce(sum(extract(epoch from (h.fecha-h.abre))/60),0) * greatest((select count(*) from public.profissionais p where p.estabelecimento_id=p_estabelecimento_id and p.ativo),1)
    into v_capacidade from generate_series(p_inicio,p_fim,'1 day'::interval) d join public.horarios_funcionamento h on h.estabelecimento_id=p_estabelecimento_id and h.dia_semana=extract(dow from d)::smallint and h.aberto;
  select coalesce(jsonb_agg(jsonb_build_object('nome',q.nome,'atendimentos',q.total,'receita',q.receita) order by q.total desc),'[]'::jsonb) into v_servicos from (
    select s.nome,count(*)::integer total,coalesce(sum(i.preco_snapshot),0) receita from public.agendamento_servicos i join public.agendamentos a on a.id=i.agendamento_id join public.servicos s on s.id=i.servico_id
    where a.estabelecimento_id=p_estabelecimento_id and a.status='concluido' and a.data between p_inicio and p_fim group by s.nome order by total desc limit 5
  ) q;
  select coalesce(jsonb_agg(jsonb_build_object('id',q.id,'nome',q.nome,'atendimentos',q.total,'receita',q.receita,'ticket_medio',q.ticket) order by q.receita desc),'[]'::jsonb) into v_equipe from (
    select p.id,p.nome,count(a.id)::integer total,coalesce(sum(a.valor),0) receita,coalesce(avg(a.valor),0) ticket from public.profissionais p left join public.agendamentos a on a.profissional_id=p.id and a.status='concluido' and a.data between p_inicio and p_fim
    where p.estabelecimento_id=p_estabelecimento_id and p.ativo group by p.id,p.nome
  ) q;
  return jsonb_build_object('inicio',p_inicio,'fim',p_fim,'atendimentos',v_atendimentos,'receita',round(v_receita,2),'ticket_medio',round(v_ticket,2),'clientes_atendidos',v_clientes,'clientes_recorrentes',v_recorrentes,'clientes_novos',v_novos,
    'retencao_percentual',case when v_clientes>0 then round(v_recorrentes*100.0/v_clientes,2) else 0 end,
    'faltas',v_faltas,'ocupacao_percentual',case when v_capacidade>0 then least(round(v_minutos*100/v_capacidade,2),100) else 0 end,
    'servicos',v_servicos,'equipe',v_equipe);
end;
$$;

revoke all on function public.resumo_crescimento_193(uuid,date,date) from public, anon;
grant execute on function public.resumo_crescimento_193(uuid,date,date) to authenticated, service_role;

create or replace function public.recalcular_oportunidades_193(p_estabelecimento_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_total integer:=0; v_quantidade integer; v_insight jsonb; v_ocupacao numeric;
begin
  if not private.tem_recurso_193(p_estabelecimento_id,'permite_oportunidades') or not private.pode_executar_acao_193(p_estabelecimento_id,'crescimento') then raise exception 'Central de Oportunidades disponível no plano Elite.'; end if;
  select count(*)::integer into v_quantidade from public.clientes_estabelecimento c where c.estabelecimento_id=p_estabelecimento_id and c.segmento in ('em_risco','inativo');
  if v_quantidade>0 then insert into public.oportunidades_crescimento(estabelecimento_id,fingerprint,tipo,prioridade,titulo,descricao,acao,acao_dados)
    values(p_estabelecimento_id,'clientes-inativos','retencao',case when v_quantidade>=10 then 'alta' else 'media' end,v_quantidade||' clientes podem ser recuperados','Clientes estão há mais de 45 dias sem retornar.','ver_clientes',jsonb_build_object('segmento','inativo','quantidade',v_quantidade))
    on conflict(estabelecimento_id,fingerprint) do update set prioridade=excluded.prioridade,titulo=excluded.titulo,descricao=excluded.descricao,acao_dados=excluded.acao_dados,status='aberta',detectada_em=now(),updated_at=now(); v_total:=v_total+1; end if;
  select count(*)::integer into v_quantidade from public.lista_espera l where l.estabelecimento_id=p_estabelecimento_id and l.status in ('aguardando','avisado');
  if v_quantidade>0 then insert into public.oportunidades_crescimento(estabelecimento_id,fingerprint,tipo,prioridade,titulo,descricao,acao,acao_dados)
    values(p_estabelecimento_id,'lista-espera','lista_espera',case when v_quantidade>=5 then 'alta' else 'media' end,v_quantidade||' clientes aguardam uma vaga','Abra a lista e procure encaixes compatíveis.','abrir_lista_espera',jsonb_build_object('quantidade',v_quantidade))
    on conflict(estabelecimento_id,fingerprint) do update set prioridade=excluded.prioridade,titulo=excluded.titulo,descricao=excluded.descricao,acao_dados=excluded.acao_dados,status='aberta',detectada_em=now(),updated_at=now(); v_total:=v_total+1; end if;
  select count(*)::integer into v_quantidade from public.agendamentos a where a.estabelecimento_id=p_estabelecimento_id and a.status='concluido' and a.fim_previsto>now()-interval '30 days' and not exists(select 1 from public.avaliacoes av where av.agendamento_id=a.id);
  if v_quantidade>0 then insert into public.oportunidades_crescimento(estabelecimento_id,fingerprint,tipo,prioridade,titulo,descricao,acao,acao_dados)
    values(p_estabelecimento_id,'avaliacoes-pendentes','avaliacao','media',v_quantidade||' avaliações podem ser solicitadas','Atendimentos concluídos ainda não receberam avaliação.','solicitar_avaliacoes',jsonb_build_object('quantidade',v_quantidade))
    on conflict(estabelecimento_id,fingerprint) do update set titulo=excluded.titulo,descricao=excluded.descricao,acao_dados=excluded.acao_dados,status='aberta',detectada_em=now(),updated_at=now(); v_total:=v_total+1; end if;
  v_insight:=public.resumo_crescimento_193(p_estabelecimento_id,current_date-27,current_date);
  v_ocupacao:=coalesce((v_insight->>'ocupacao_percentual')::numeric,0);
  if v_ocupacao<45 then insert into public.oportunidades_crescimento(estabelecimento_id,fingerprint,tipo,prioridade,titulo,descricao,acao,acao_dados)
    values(p_estabelecimento_id,'ocupacao-baixa','ocupacao',case when v_ocupacao<25 then 'alta' else 'media' end,'Ocupação em '||round(v_ocupacao,0)||'%','Há espaço para preencher horários com campanhas ou cupons.','criar_campanha',jsonb_build_object('ocupacao',v_ocupacao))
    on conflict(estabelecimento_id,fingerprint) do update set prioridade=excluded.prioridade,titulo=excluded.titulo,descricao=excluded.descricao,acao_dados=excluded.acao_dados,status='aberta',detectada_em=now(),updated_at=now(); v_total:=v_total+1; end if;
  update public.oportunidades_crescimento set status='expirada' where estabelecimento_id=p_estabelecimento_id and status='aberta' and detectada_em<now()-interval '35 days';
  return v_total;
end;
$$;

revoke all on function public.recalcular_oportunidades_193(uuid) from public, anon;
grant execute on function public.recalcular_oportunidades_193(uuid) to authenticated, service_role;

create or replace function public.atualizar_oportunidade_193(p_oportunidade_id uuid,p_status text)
returns public.oportunidades_crescimento
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.oportunidades_crescimento%rowtype;
begin
  if p_status not in ('aberta','concluida','ignorada','expirada') then raise exception 'Status inválido.'; end if;
  select * into v_item from public.oportunidades_crescimento where id=p_oportunidade_id for update;
  if not found or not private.pode_executar_acao_193(v_item.estabelecimento_id,'crescimento') then raise exception 'Oportunidade não encontrada ou sem permissão.'; end if;
  update public.oportunidades_crescimento set status=p_status where id=p_oportunidade_id returning * into v_item;
  return v_item;
end;
$$;

revoke all on function public.atualizar_oportunidade_193(uuid,text) from public, anon;
grant execute on function public.atualizar_oportunidade_193(uuid,text) to authenticated, service_role;

-- Corrige a política de programas sem referência circular entre programa/saldo.
drop policy if exists fidelidade_programas_select on public.fidelidade_programas;
create policy fidelidade_programas_select on public.fidelidade_programas for select to authenticated
using (private.tem_recurso_193(estabelecimento_id,'permite_fidelidade') and (
  private.pode_operar_estabelecimento_19(estabelecimento_id)
  or exists (
    select 1
    from public.agendamentos a
    where a.estabelecimento_id = fidelidade_programas.estabelecimento_id
      and a.cliente_id = (select auth.uid())
  )
));

drop policy if exists fidelidade_recompensas_select on public.fidelidade_recompensas;
create policy fidelidade_recompensas_select on public.fidelidade_recompensas for select to authenticated
using (exists (
  select 1
  from public.fidelidade_programas p
  where p.id = fidelidade_recompensas.programa_id
    and private.tem_recurso_193(p.estabelecimento_id,'permite_fidelidade')
    and (
      private.pode_operar_estabelecimento_19(p.estabelecimento_id)
      or exists (
        select 1
        from public.agendamentos a
        where a.estabelecimento_id = p.estabelecimento_id
          and a.cliente_id = (select auth.uid())
      )
    )
));

commit;
