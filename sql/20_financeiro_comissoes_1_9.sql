-- Barber Hub 1.9.0: financeiro operacional, comissões e fechamento diário.
-- Execute depois de 19_crm_operacional_1_9.sql.

begin;

create table if not exists public.regras_comissao (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  profissional_id uuid references public.profissionais(id) on delete cascade,
  servico_id uuid references public.servicos(id) on delete cascade,
  tipo text not null check (tipo in ('percentual','fixo')),
  valor numeric(10,2) not null check (valor >= 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (tipo <> 'percentual' or valor <= 100),
  unique (estabelecimento_id, profissional_id, servico_id)
);

create index if not exists regras_comissao_estabelecimento_ativo_idx
  on public.regras_comissao(estabelecimento_id, ativo, profissional_id, servico_id);
-- A constraint comum considera NULLs distintos. O índice por expressão impede
-- duas regras padrão (ou duas regras com a mesma combinação opcional).
create unique index if not exists regras_comissao_escopo_unico_idx
  on public.regras_comissao(
    estabelecimento_id,
    coalesce(profissional_id, '00000000-0000-0000-0000-000000000000'::uuid),
    coalesce(servico_id, '00000000-0000-0000-0000-000000000000'::uuid)
  );
create index if not exists regras_comissao_profissional_idx
  on public.regras_comissao(profissional_id) where profissional_id is not null;
create index if not exists regras_comissao_servico_idx
  on public.regras_comissao(servico_id) where servico_id is not null;

drop trigger if exists regras_comissao_updated_at on public.regras_comissao;
create trigger regras_comissao_updated_at
before update on public.regras_comissao
for each row execute function public.set_updated_at();

-- Reutiliza a validação de catálogo criada na migration 18: a regra só pode
-- apontar para profissional/serviço do próprio estabelecimento.
drop trigger if exists comissoes_validar_catalogo_operacional_19 on public.regras_comissao;
create trigger comissoes_validar_catalogo_operacional_19
before insert or update of estabelecimento_id, profissional_id, servico_id on public.regras_comissao
for each row execute function public.validar_catalogo_agendamento_operacional_19();

create table if not exists public.lancamentos_financeiros (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  agendamento_id uuid references public.agendamentos(id) on delete restrict,
  profissional_id uuid references public.profissionais(id) on delete set null,
  competencia date not null,
  tipo text not null check (tipo in ('receita_atendimento','ajuste','estorno')),
  natureza text not null check (natureza in ('credito','debito')),
  status text not null check (status in ('previsto','realizado','cancelado')),
  descricao text not null,
  valor_bruto numeric(12,2) not null default 0 check (valor_bruto >= 0),
  desconto numeric(12,2) not null default 0 check (desconto >= 0),
  valor_liquido numeric(12,2) not null default 0 check (valor_liquido >= 0),
  comissao_valor numeric(12,2) not null default 0 check (comissao_valor >= 0),
  comissao_regra_snapshot jsonb,
  motivo text,
  origem text not null check (origem in ('agendamento','manual','sistema')),
  criado_por uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (desconto <= valor_bruto)
);

create unique index if not exists lancamentos_financeiros_agendamento_unique_idx
  on public.lancamentos_financeiros(agendamento_id)
  where origem = 'agendamento' and agendamento_id is not null;
create index if not exists lancamentos_financeiros_estabelecimento_competencia_idx
  on public.lancamentos_financeiros(estabelecimento_id, competencia desc, id);
create index if not exists lancamentos_financeiros_estabelecimento_status_idx
  on public.lancamentos_financeiros(estabelecimento_id, status, competencia desc);
create index if not exists lancamentos_financeiros_profissional_competencia_idx
  on public.lancamentos_financeiros(profissional_id, competencia desc)
  where profissional_id is not null;

drop trigger if exists lancamentos_financeiros_updated_at on public.lancamentos_financeiros;
create trigger lancamentos_financeiros_updated_at
before update on public.lancamentos_financeiros
for each row execute function public.set_updated_at();

create table if not exists public.fechamentos_diarios (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  data date not null,
  receita_bruta numeric(12,2) not null default 0,
  ajustes_credito numeric(12,2) not null default 0,
  ajustes_debito numeric(12,2) not null default 0,
  receita_liquida numeric(12,2) not null default 0,
  comissoes numeric(12,2) not null default 0,
  atendimentos_concluidos integer not null default 0,
  cancelamentos integer not null default 0,
  faltas integer not null default 0,
  status text not null default 'fechado' check (status in ('fechado','reaberto')),
  revisao integer not null default 1 check (revisao > 0),
  fechado_por uuid not null references public.perfis(id) on delete restrict,
  fechado_em timestamptz not null default now(),
  observacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (estabelecimento_id, data)
);

create index if not exists fechamentos_estabelecimento_data_idx
  on public.fechamentos_diarios(estabelecimento_id, data desc);

drop trigger if exists fechamentos_diarios_updated_at on public.fechamentos_diarios;
create trigger fechamentos_diarios_updated_at
before update on public.fechamentos_diarios
for each row execute function public.set_updated_at();

alter table public.regras_comissao enable row level security;
alter table public.lancamentos_financeiros enable row level security;
alter table public.fechamentos_diarios enable row level security;

drop policy if exists comissao_select_financeiro on public.regras_comissao;
create policy comissao_select_financeiro on public.regras_comissao
for select to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_comissoes')
  and (
  private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
  or profissional_id = private.profissional_vinculado_19(estabelecimento_id)
  )
);

drop policy if exists comissao_manage_financeiro on public.regras_comissao;
create policy comissao_manage_financeiro on public.regras_comissao
for all to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_comissoes')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
)
with check (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_comissoes')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);

drop policy if exists lancamentos_select_financeiro on public.lancamentos_financeiros;
create policy lancamentos_select_financeiro on public.lancamentos_financeiros
for select to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_financeiro')
  and (
  private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
  or profissional_id = private.profissional_vinculado_19(estabelecimento_id)
  )
);

drop policy if exists fechamentos_select_financeiro on public.fechamentos_diarios;
create policy fechamentos_select_financeiro on public.fechamentos_diarios
for select to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_financeiro')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);

grant select, insert, update, delete on public.regras_comissao to authenticated;
grant select on public.lancamentos_financeiros, public.fechamentos_diarios to authenticated;

create or replace function public.calcular_comissao_agendamento_19(p_agendamento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_agendamento public.agendamentos%rowtype;
  v_regra public.regras_comissao%rowtype;
  v_comissao numeric(12,2) := 0;
begin
  select * into v_agendamento from public.agendamentos where id = p_agendamento_id;
  if not found then return jsonb_build_object('valor', 0, 'regra', null); end if;

  select r.* into v_regra
  from public.regras_comissao r
  where r.estabelecimento_id = v_agendamento.estabelecimento_id
    and r.ativo = true
    and (r.profissional_id is null or r.profissional_id = v_agendamento.profissional_id)
    and (r.servico_id is null or r.servico_id = v_agendamento.servico_id)
  order by
    (r.profissional_id is not null)::integer + (r.servico_id is not null)::integer desc,
    r.updated_at desc
  limit 1;

  if found then
    v_comissao := case
      when v_regra.tipo = 'percentual' then round(v_agendamento.valor * v_regra.valor / 100, 2)
      else least(v_regra.valor, v_agendamento.valor)
    end;
    return jsonb_build_object(
      'valor', v_comissao,
      'regra', jsonb_build_object(
        'id', v_regra.id,
        'tipo', v_regra.tipo,
        'valor', v_regra.valor,
        'profissional_id', v_regra.profissional_id,
        'servico_id', v_regra.servico_id
      )
    );
  end if;
  return jsonb_build_object('valor', 0, 'regra', null);
end;
$$;

create or replace function public.sincronizar_financeiro_agendamento_19()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_comissao jsonb;
  v_status text;
begin
  v_comissao := public.calcular_comissao_agendamento_19(new.id);
  v_status := case
    when new.status = 'concluido' then 'realizado'
    when new.status in ('cancelado','recusado','faltou') then 'cancelado'
    else 'previsto'
  end;

  insert into public.lancamentos_financeiros(
    estabelecimento_id, agendamento_id, profissional_id, competencia,
    tipo, natureza, status, descricao, valor_bruto, desconto, valor_liquido,
    comissao_valor, comissao_regra_snapshot, origem, criado_por
  ) values (
    new.estabelecimento_id, new.id, new.profissional_id, new.data,
    'receita_atendimento', 'credito', v_status,
    'Atendimento de ' || coalesce(new.cliente_nome, 'Cliente'),
    new.valor, 0, new.valor,
    coalesce((v_comissao->>'valor')::numeric, 0), v_comissao->'regra',
    'agendamento', auth.uid()
  )
  on conflict (agendamento_id) where origem = 'agendamento' and agendamento_id is not null
  do update set
    profissional_id = excluded.profissional_id,
    competencia = excluded.competencia,
    status = excluded.status,
    descricao = excluded.descricao,
    valor_bruto = excluded.valor_bruto,
    desconto = excluded.desconto,
    valor_liquido = excluded.valor_liquido,
    comissao_valor = excluded.comissao_valor,
    comissao_regra_snapshot = excluded.comissao_regra_snapshot,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists agendamentos_sincronizar_financeiro_19 on public.agendamentos;
create trigger agendamentos_sincronizar_financeiro_19
after insert or update of status, valor, data, profissional_id, servico_id, cliente_nome
on public.agendamentos
for each row execute function public.sincronizar_financeiro_agendamento_19();

-- Backfill equivalente ao gatilho para os atendimentos já existentes.
insert into public.lancamentos_financeiros(
  estabelecimento_id, agendamento_id, profissional_id, competencia,
  tipo, natureza, status, descricao, valor_bruto, desconto, valor_liquido,
  comissao_valor, comissao_regra_snapshot, origem, criado_por
)
select
  a.estabelecimento_id, a.id, a.profissional_id, a.data,
  'receita_atendimento', 'credito',
  case when a.status = 'concluido' then 'realizado'
       when a.status in ('cancelado','recusado','faltou') then 'cancelado'
       else 'previsto' end,
  'Atendimento de ' || coalesce(a.cliente_nome, 'Cliente'),
  a.valor, 0, a.valor,
  coalesce((public.calcular_comissao_agendamento_19(a.id)->>'valor')::numeric, 0),
  public.calcular_comissao_agendamento_19(a.id)->'regra',
  'agendamento', null
from public.agendamentos a
on conflict (agendamento_id) where origem = 'agendamento' and agendamento_id is not null
do update set
  profissional_id = excluded.profissional_id,
  competencia = excluded.competencia,
  status = excluded.status,
  descricao = excluded.descricao,
  valor_bruto = excluded.valor_bruto,
  valor_liquido = excluded.valor_liquido,
  comissao_valor = excluded.comissao_valor,
  comissao_regra_snapshot = excluded.comissao_regra_snapshot,
  updated_at = now();

create or replace function public.resumo_financeiro_19(
  p_estabelecimento_id uuid,
  p_inicio date,
  p_fim date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_resultado jsonb;
begin
  if not private.tem_recurso_operacional_19(p_estabelecimento_id, 'permite_financeiro')
     or not private.pode_operar_estabelecimento_19(
    p_estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  ) then raise exception 'Sua conta não pode acessar o financeiro.'; end if;
  if p_fim < p_inicio or p_fim > p_inicio + 366 then raise exception 'Período inválido.'; end if;

  select jsonb_build_object(
    'previsto', coalesce(sum(case when l.status = 'previsto' and l.natureza = 'credito' then l.valor_liquido else 0 end), 0),
    'realizado', coalesce(sum(case when l.status = 'realizado' and l.natureza = 'credito' then l.valor_liquido else 0 end), 0),
    'debitos', coalesce(sum(case when l.status = 'realizado' and l.natureza = 'debito' then l.valor_liquido else 0 end), 0),
    'comissoes', coalesce(sum(case when l.status = 'realizado' then l.comissao_valor else 0 end), 0),
    'atendimentos', count(*) filter (where l.tipo = 'receita_atendimento' and l.status = 'realizado'),
    'cancelados', count(*) filter (where l.tipo = 'receita_atendimento' and l.status = 'cancelado'),
    'ticket_medio', case
      when count(*) filter (where l.tipo = 'receita_atendimento' and l.status = 'realizado') > 0
      then round(
        sum(l.valor_liquido) filter (where l.tipo = 'receita_atendimento' and l.status = 'realizado')
        / count(*) filter (where l.tipo = 'receita_atendimento' and l.status = 'realizado'), 2
      ) else 0 end,
    'inicio', p_inicio,
    'fim', p_fim
  ) into v_resultado
  from public.lancamentos_financeiros l
  where l.estabelecimento_id = p_estabelecimento_id
    and l.competencia between p_inicio and p_fim;
  return v_resultado;
end;
$$;

create or replace function public.criar_ajuste_financeiro_19(
  p_estabelecimento_id uuid,
  p_competencia date,
  p_natureza text,
  p_valor numeric,
  p_descricao text,
  p_motivo text
)
returns public.lancamentos_financeiros
language plpgsql
security definer
set search_path = ''
as $$
declare v_lancamento public.lancamentos_financeiros%rowtype;
begin
  if not private.tem_recurso_operacional_19(p_estabelecimento_id, 'permite_financeiro')
     or not private.pode_operar_estabelecimento_19(
    p_estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  ) then raise exception 'Sua conta não pode criar ajustes.'; end if;
  if p_natureza not in ('credito','debito') then raise exception 'Natureza inválida.'; end if;
  if p_valor <= 0 or p_valor > 1000000 then raise exception 'Valor inválido.'; end if;
  if char_length(trim(coalesce(p_descricao, ''))) not between 2 and 180 then
    raise exception 'Informe uma descrição válida.';
  end if;
  if char_length(trim(coalesce(p_motivo, ''))) < 3 then raise exception 'Informe o motivo do ajuste.'; end if;
  if char_length(trim(p_motivo)) > 500 then raise exception 'O motivo é muito longo.'; end if;
  insert into public.lancamentos_financeiros(
    estabelecimento_id, competencia, tipo, natureza, status, descricao,
    valor_bruto, valor_liquido, comissao_valor, motivo, origem, criado_por
  ) values (
    p_estabelecimento_id, p_competencia, 'ajuste', p_natureza, 'realizado',
    trim(p_descricao), p_valor, p_valor, 0, trim(p_motivo), 'manual', (select auth.uid())
  ) returning * into v_lancamento;
  return v_lancamento;
end;
$$;

create or replace function public.fechar_dia_financeiro_19(
  p_estabelecimento_id uuid,
  p_data date,
  p_observacao text default null
)
returns public.fechamentos_diarios
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fechamento public.fechamentos_diarios%rowtype;
  v_bruta numeric(12,2);
  v_creditos numeric(12,2);
  v_debitos numeric(12,2);
  v_comissoes numeric(12,2);
  v_concluidos integer;
  v_cancelados integer;
  v_faltas integer;
begin
  if not private.tem_recurso_operacional_19(p_estabelecimento_id, 'permite_financeiro')
     or not private.pode_operar_estabelecimento_19(
    p_estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  ) then raise exception 'Sua conta não pode fechar o dia.'; end if;
  if p_data > current_date then raise exception 'Não é possível fechar uma data futura.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_estabelecimento_id::text || ':' || p_data::text || ':fechamento', 0));

  select
    coalesce(sum(l.valor_liquido) filter (where l.tipo = 'receita_atendimento' and l.status = 'realizado'), 0),
    coalesce(sum(l.valor_liquido) filter (where l.tipo = 'ajuste' and l.natureza = 'credito' and l.status = 'realizado'), 0),
    coalesce(sum(l.valor_liquido) filter (where l.tipo = 'ajuste' and l.natureza = 'debito' and l.status = 'realizado'), 0),
    coalesce(sum(l.comissao_valor) filter (where l.tipo = 'receita_atendimento' and l.status = 'realizado'), 0),
    count(*) filter (where l.tipo = 'receita_atendimento' and l.status = 'realizado')::integer,
    count(*) filter (where l.tipo = 'receita_atendimento' and l.status = 'cancelado')::integer
  into v_bruta, v_creditos, v_debitos, v_comissoes, v_concluidos, v_cancelados
  from public.lancamentos_financeiros l
  where l.estabelecimento_id = p_estabelecimento_id and l.competencia = p_data;

  select count(*)::integer into v_faltas from public.agendamentos a
  where a.estabelecimento_id = p_estabelecimento_id and a.data = p_data and a.status = 'faltou';

  insert into public.fechamentos_diarios(
    estabelecimento_id, data, receita_bruta, ajustes_credito, ajustes_debito,
    receita_liquida, comissoes, atendimentos_concluidos, cancelamentos, faltas,
    status, revisao, fechado_por, fechado_em, observacao
  ) values (
    p_estabelecimento_id, p_data, v_bruta, v_creditos, v_debitos,
    v_bruta + v_creditos - v_debitos, v_comissoes, v_concluidos, v_cancelados,
    v_faltas, 'fechado', 1, (select auth.uid()), now(), nullif(trim(coalesce(p_observacao, '')), '')
  )
  on conflict (estabelecimento_id, data) do update
  set receita_bruta = excluded.receita_bruta,
      ajustes_credito = excluded.ajustes_credito,
      ajustes_debito = excluded.ajustes_debito,
      receita_liquida = excluded.receita_liquida,
      comissoes = excluded.comissoes,
      atendimentos_concluidos = excluded.atendimentos_concluidos,
      cancelamentos = excluded.cancelamentos,
      faltas = excluded.faltas,
      status = 'fechado',
      revisao = public.fechamentos_diarios.revisao + 1,
      fechado_por = (select auth.uid()),
      fechado_em = now(),
      observacao = excluded.observacao,
      updated_at = now()
  returning * into v_fechamento;
  return v_fechamento;
end;
$$;

revoke all on function public.calcular_comissao_agendamento_19(uuid) from public, anon, authenticated;
revoke all on function public.sincronizar_financeiro_agendamento_19() from public, anon, authenticated;
revoke all on function public.resumo_financeiro_19(uuid,date,date) from public, anon;
revoke all on function public.criar_ajuste_financeiro_19(uuid,date,text,numeric,text,text) from public, anon;
revoke all on function public.fechar_dia_financeiro_19(uuid,date,text) from public, anon;
grant execute on function public.resumo_financeiro_19(uuid,date,date) to authenticated, service_role;
grant execute on function public.criar_ajuste_financeiro_19(uuid,date,text,numeric,text,text) to authenticated, service_role;
grant execute on function public.fechar_dia_financeiro_19(uuid,date,text) to authenticated, service_role;

commit;
