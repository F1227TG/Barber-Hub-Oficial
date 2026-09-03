-- Barber Hub 1.10.0: operação real, horários em múltiplos períodos e atendimento manual.
-- Execute depois de 28_hardening_objetos_1_9_3.sql.

begin;

-- ============================================================
-- 1. MÚLTIPLOS PERÍODOS DE FUNCIONAMENTO
-- ============================================================

create table if not exists public.estabelecimento_horario_periodos (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  abre time not null,
  fecha time not null,
  fecha_dia_seguinte boolean not null default false,
  ordem smallint not null check (ordem between 1 and 8),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (estabelecimento_id, dia_semana, ordem),
  check (
    (fecha_dia_seguinte = false and abre < fecha)
    or (fecha_dia_seguinte = true and fecha <= abre)
  )
);

create index if not exists horario_periodos_estabelecimento_dia_idx
  on public.estabelecimento_horario_periodos(estabelecimento_id, dia_semana, ordem)
  where ativo = true;

drop trigger if exists horario_periodos_updated_at on public.estabelecimento_horario_periodos;
create trigger horario_periodos_updated_at
before update on public.estabelecimento_horario_periodos
for each row execute function public.set_updated_at();

create or replace function private.validar_horario_periodo_110()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_inicio integer;
  v_fim integer;
  v_outro record;
  v_outro_inicio integer;
  v_outro_fim integer;
  v_deslocamento integer;
begin
  perform pg_advisory_xact_lock(hashtextextended(new.estabelecimento_id::text || ':horarios', 0));

  v_inicio := new.dia_semana * 1440 + floor(extract(epoch from new.abre) / 60)::integer;
  v_fim := new.dia_semana * 1440 + floor(extract(epoch from new.fecha) / 60)::integer
    + case when new.fecha_dia_seguinte then 1440 else 0 end;

  if v_fim <= v_inicio or v_fim - v_inicio > 1440 then
    raise exception 'O período deve ter duração maior que zero e de no máximo 24 horas.';
  end if;

  if tg_op = 'INSERT' and (
    select count(*) from public.estabelecimento_horario_periodos p
    where p.estabelecimento_id = new.estabelecimento_id
      and p.dia_semana = new.dia_semana
  ) >= 8 then
    raise exception 'Cadastre no máximo 8 períodos por dia.';
  end if;

  for v_outro in
    select p.*
    from public.estabelecimento_horario_periodos p
    where p.estabelecimento_id = new.estabelecimento_id
      and p.ativo = true
      and p.id is distinct from new.id
  loop
    v_outro_inicio := v_outro.dia_semana * 1440
      + floor(extract(epoch from v_outro.abre) / 60)::integer;
    v_outro_fim := v_outro.dia_semana * 1440
      + floor(extract(epoch from v_outro.fecha) / 60)::integer
      + case when v_outro.fecha_dia_seguinte then 1440 else 0 end;

    foreach v_deslocamento in array array[-10080, 0, 10080] loop
      if v_inicio < v_outro_fim + v_deslocamento
         and v_outro_inicio + v_deslocamento < v_fim then
        raise exception 'O período informado se sobrepõe a outro horário de funcionamento.';
      end if;
    end loop;
  end loop;
  return new;
end;
$$;

drop trigger if exists horario_periodos_validar_110 on public.estabelecimento_horario_periodos;
create trigger horario_periodos_validar_110
before insert or update of estabelecimento_id, dia_semana, abre, fecha, fecha_dia_seguinte, ativo
on public.estabelecimento_horario_periodos
for each row execute function private.validar_horario_periodo_110();

revoke all on function private.validar_horario_periodo_110() from public, anon, authenticated;

-- Converte os horários legados. Quando havia intervalo, cria dois períodos.
insert into public.estabelecimento_horario_periodos(
  estabelecimento_id, dia_semana, abre, fecha, fecha_dia_seguinte, ordem
)
select h.estabelecimento_id, h.dia_semana, h.abre, h.intervalo_inicio, false, 1
from public.horarios_funcionamento h
where h.aberto and h.abre is not null and h.fecha is not null
  and h.intervalo_inicio is not null and h.intervalo_fim is not null
  and h.abre < h.intervalo_inicio and h.intervalo_inicio <= h.intervalo_fim
  and h.intervalo_fim < h.fecha
on conflict (estabelecimento_id, dia_semana, ordem) do nothing;

insert into public.estabelecimento_horario_periodos(
  estabelecimento_id, dia_semana, abre, fecha, fecha_dia_seguinte, ordem
)
select h.estabelecimento_id, h.dia_semana, h.intervalo_fim, h.fecha, false, 2
from public.horarios_funcionamento h
where h.aberto and h.abre is not null and h.fecha is not null
  and h.intervalo_inicio is not null and h.intervalo_fim is not null
  and h.abre < h.intervalo_inicio and h.intervalo_inicio <= h.intervalo_fim
  and h.intervalo_fim < h.fecha
on conflict (estabelecimento_id, dia_semana, ordem) do nothing;

insert into public.estabelecimento_horario_periodos(
  estabelecimento_id, dia_semana, abre, fecha, fecha_dia_seguinte, ordem
)
select h.estabelecimento_id, h.dia_semana, h.abre, h.fecha, false, 1
from public.horarios_funcionamento h
where h.aberto and h.abre is not null and h.fecha is not null
  and not (
    h.intervalo_inicio is not null and h.intervalo_fim is not null
    and h.abre < h.intervalo_inicio and h.intervalo_inicio <= h.intervalo_fim
    and h.intervalo_fim < h.fecha
  )
on conflict (estabelecimento_id, dia_semana, ordem) do nothing;

-- Mantém a tabela antiga como resumo compatível para clientes ainda não atualizados.
-- A validação final do agendamento sempre usa os períodos reais, portanto um
-- resumo legado que englobe uma pausa não permite reservas dentro da pausa.
create or replace function private.sincronizar_horario_legado_dia_110(
  p_estabelecimento_id uuid,
  p_dia_semana smallint
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_quantidade integer;
  v_abre time;
  v_fecha time;
  v_primeiro_fim time;
  v_segundo_inicio time;
begin
  with efetivos as (
    select p.abre,
      case when p.fecha_dia_seguinte then time '23:59:59.999999' else p.fecha end as fecha
    from public.estabelecimento_horario_periodos p
    where p.estabelecimento_id = p_estabelecimento_id
      and p.dia_semana = p_dia_semana and p.ativo
    union all
    select time '00:00', p.fecha
    from public.estabelecimento_horario_periodos p
    where p.estabelecimento_id = p_estabelecimento_id
      and p.dia_semana = ((p_dia_semana + 6) % 7)::smallint
      and p.ativo and p.fecha_dia_seguinte
  )
  select count(*), min(abre), max(fecha)
    into v_quantidade, v_abre, v_fecha
  from efetivos;

  v_primeiro_fim := null;
  v_segundo_inicio := null;
  if v_quantidade = 2 then
    with efetivos as (
      select p.abre,
        case when p.fecha_dia_seguinte then time '23:59:59.999999' else p.fecha end as fecha
      from public.estabelecimento_horario_periodos p
      where p.estabelecimento_id = p_estabelecimento_id
        and p.dia_semana = p_dia_semana and p.ativo
      union all
      select time '00:00', p.fecha
      from public.estabelecimento_horario_periodos p
      where p.estabelecimento_id = p_estabelecimento_id
        and p.dia_semana = ((p_dia_semana + 6) % 7)::smallint
        and p.ativo and p.fecha_dia_seguinte
    ), ordenados as (
      select e.*, row_number() over(order by e.abre, e.fecha) as posicao from efetivos e
    )
    select max(fecha) filter (where posicao = 1), min(abre) filter (where posicao = 2)
      into v_primeiro_fim, v_segundo_inicio
    from ordenados;
  end if;

  insert into public.horarios_funcionamento(
    estabelecimento_id, dia_semana, aberto, abre, fecha, intervalo_inicio, intervalo_fim
  ) values (
    p_estabelecimento_id, p_dia_semana, v_quantidade > 0, v_abre, v_fecha,
    case when v_quantidade = 2 and v_primeiro_fim < v_segundo_inicio then v_primeiro_fim end,
    case when v_quantidade = 2 and v_primeiro_fim < v_segundo_inicio then v_segundo_inicio end
  )
  on conflict (estabelecimento_id, dia_semana) do update set
    aberto = excluded.aberto,
    abre = excluded.abre,
    fecha = excluded.fecha,
    intervalo_inicio = excluded.intervalo_inicio,
    intervalo_fim = excluded.intervalo_fim;
end;
$$;

create or replace function private.sincronizar_periodos_apos_mutacao_110()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then return coalesce(new, old); end if;
  if tg_op in ('UPDATE','DELETE') then
    perform private.sincronizar_horario_legado_dia_110(old.estabelecimento_id, old.dia_semana);
    perform private.sincronizar_horario_legado_dia_110(old.estabelecimento_id, ((old.dia_semana + 1) % 7)::smallint);
  end if;
  if tg_op in ('INSERT','UPDATE') then
    perform private.sincronizar_horario_legado_dia_110(new.estabelecimento_id, new.dia_semana);
    perform private.sincronizar_horario_legado_dia_110(new.estabelecimento_id, ((new.dia_semana + 1) % 7)::smallint);
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists horario_periodos_sincronizar_legado_110 on public.estabelecimento_horario_periodos;
create trigger horario_periodos_sincronizar_legado_110
after insert or update or delete on public.estabelecimento_horario_periodos
for each row execute function private.sincronizar_periodos_apos_mutacao_110();

create or replace function private.sincronizar_legado_para_periodos_110()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if pg_trigger_depth() > 1 then return coalesce(new, old); end if;
  perform pg_advisory_xact_lock(hashtextextended(coalesce(new.estabelecimento_id, old.estabelecimento_id)::text || ':horarios', 0));
  delete from public.estabelecimento_horario_periodos p
  where p.estabelecimento_id = coalesce(new.estabelecimento_id, old.estabelecimento_id)
    and p.dia_semana = coalesce(new.dia_semana, old.dia_semana);
  if tg_op <> 'DELETE' and new.aberto and new.abre is not null and new.fecha is not null then
    if new.intervalo_inicio is not null and new.intervalo_fim is not null
       and new.abre < new.intervalo_inicio and new.intervalo_inicio <= new.intervalo_fim
       and new.intervalo_fim < new.fecha then
      insert into public.estabelecimento_horario_periodos(
        estabelecimento_id,dia_semana,abre,fecha,ordem
      ) values
        (new.estabelecimento_id,new.dia_semana,new.abre,new.intervalo_inicio,1),
        (new.estabelecimento_id,new.dia_semana,new.intervalo_fim,new.fecha,2);
    else
      insert into public.estabelecimento_horario_periodos(
        estabelecimento_id,dia_semana,abre,fecha,ordem
      ) values (new.estabelecimento_id,new.dia_semana,new.abre,new.fecha,1);
    end if;
  end if;
  return coalesce(new, old);
end;
$$;

drop trigger if exists horarios_legados_sincronizar_periodos_110 on public.horarios_funcionamento;
create trigger horarios_legados_sincronizar_periodos_110
after insert or update of aberto, abre, fecha, intervalo_inicio, intervalo_fim or delete
on public.horarios_funcionamento
for each row execute function private.sincronizar_legado_para_periodos_110();

revoke all on function private.sincronizar_horario_legado_dia_110(uuid,smallint) from public, anon, authenticated;
revoke all on function private.sincronizar_periodos_apos_mutacao_110() from public, anon, authenticated;
revoke all on function private.sincronizar_legado_para_periodos_110() from public, anon, authenticated;

alter table public.estabelecimento_horario_periodos enable row level security;
drop policy if exists horario_periodos_select_publico_110 on public.estabelecimento_horario_periodos;
create policy horario_periodos_select_publico_110
on public.estabelecimento_horario_periodos for select to anon, authenticated
using (
  exists (
    select 1 from public.estabelecimentos e
    where e.id = estabelecimento_id
      and ((e.visivel and e.onboarding_concluido) or private.pode_operar_estabelecimento_19(e.id))
  )
);

revoke all on table public.estabelecimento_horario_periodos from public, anon, authenticated;
grant select on table public.estabelecimento_horario_periodos to anon, authenticated;

create or replace function public.obter_periodos_funcionamento_110(p_estabelecimento_id uuid)
returns setof public.estabelecimento_horario_periodos
language sql
stable
security invoker
set search_path = ''
as $$
  select p.* from public.estabelecimento_horario_periodos p
  where p.estabelecimento_id = p_estabelecimento_id and p.ativo
  order by p.dia_semana, p.ordem, p.abre;
$$;

create or replace function public.substituir_periodos_funcionamento_110(
  p_estabelecimento_id uuid,
  p_periodos jsonb
)
returns setof public.estabelecimento_horario_periodos
language plpgsql
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Autenticação obrigatória.'; end if;
  if not private.pode_executar_acao_193(p_estabelecimento_id, 'configuracoes') then
    raise exception 'Sua conta não pode alterar os horários.';
  end if;
  if p_periodos is null or jsonb_typeof(p_periodos) <> 'array' then
    raise exception 'Envie os períodos em uma lista.';
  end if;
  if jsonb_array_length(p_periodos) > 56 then
    raise exception 'Cadastre no máximo 8 períodos por dia.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_estabelecimento_id::text || ':horarios', 0));
  delete from public.estabelecimento_horario_periodos p where p.estabelecimento_id = p_estabelecimento_id;

  insert into public.estabelecimento_horario_periodos(
    estabelecimento_id, dia_semana, abre, fecha, fecha_dia_seguinte, ordem, ativo
  )
  select
    p_estabelecimento_id,
    (item.valor->>'dia_semana')::smallint,
    (item.valor->>'abre')::time,
    (item.valor->>'fecha')::time,
    coalesce((item.valor->>'fecha_dia_seguinte')::boolean, false),
    coalesce(
      nullif(item.valor->>'ordem','')::smallint,
      row_number() over(
        partition by (item.valor->>'dia_semana')::smallint order by item.posicao
      )::smallint
    ),
    coalesce((item.valor->>'ativo')::boolean, true)
  from jsonb_array_elements(p_periodos) with ordinality as item(valor, posicao);

  return query select p.* from public.estabelecimento_horario_periodos p
  where p.estabelecimento_id = p_estabelecimento_id
  order by p.dia_semana, p.ordem, p.abre;
exception
  when invalid_text_representation or numeric_value_out_of_range then
    raise exception 'Há um dia, horário, ordem ou indicador de meia-noite inválido.';
end;
$$;

revoke all on function public.obter_periodos_funcionamento_110(uuid) from public;
grant execute on function public.obter_periodos_funcionamento_110(uuid) to anon, authenticated, service_role;
revoke all on function public.substituir_periodos_funcionamento_110(uuid,jsonb) from public, anon;
grant execute on function public.substituir_periodos_funcionamento_110(uuid,jsonb) to authenticated, service_role;

create or replace function private.atendimento_dentro_periodo_110(
  p_estabelecimento_id uuid,
  p_data date,
  p_hora_inicio time,
  p_hora_fim time
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  with atendimento as (
    select extract(dow from p_data)::integer * 1440
      + floor(extract(epoch from p_hora_inicio) / 60)::integer as inicio,
      extract(dow from p_data)::integer * 1440
      + floor(extract(epoch from p_hora_fim) / 60)::integer as fim
  ), periodos as (
    select p.dia_semana::integer * 1440
      + floor(extract(epoch from p.abre) / 60)::integer as inicio,
      p.dia_semana::integer * 1440
      + floor(extract(epoch from p.fecha) / 60)::integer
      + case when p.fecha_dia_seguinte then 1440 else 0 end as fim
    from public.estabelecimento_horario_periodos p
    where p.estabelecimento_id = p_estabelecimento_id and p.ativo
  )
  select exists (
    select 1 from atendimento a cross join periodos p cross join unnest(array[-10080,0,10080]) deslocamento
    where a.inicio >= p.inicio + deslocamento
      and a.fim <= p.fim + deslocamento
      and a.fim > a.inicio
  );
$$;

create or replace function private.validar_agendamento_no_funcionamento_110()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.tipo_atendimento = 'manual' and exists (
    select 1 from public.estabelecimentos e
    where e.id = new.estabelecimento_id and e.status_manual = 'aberto'
  ) then return new; end if;
  if not private.atendimento_dentro_periodo_110(
    new.estabelecimento_id, new.data, new.hora_inicio, new.hora_fim
  ) then
    raise exception 'O atendimento está fora dos períodos de funcionamento.';
  end if;
  return new;
end;
$$;

drop trigger if exists agendamentos_validar_funcionamento_110 on public.agendamentos;
create trigger agendamentos_validar_funcionamento_110
before insert or update of estabelecimento_id, data, hora_inicio, hora_fim
on public.agendamentos
for each row execute function private.validar_agendamento_no_funcionamento_110();

revoke all on function private.atendimento_dentro_periodo_110(uuid,date,time,time) from public, anon, authenticated;
revoke all on function private.validar_agendamento_no_funcionamento_110() from public, anon, authenticated;

-- Atualiza o resolvedor usado pelo marketplace existente.
create or replace function public.estabelecimento_aberto_agora(p_estabelecimento_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_est public.estabelecimentos%rowtype;
  v_agora timestamp without time zone;
  v_dia smallint;
  v_hora time;
begin
  select * into v_est from public.estabelecimentos e
  where e.id = p_estabelecimento_id;
  if not found or not v_est.visivel or not v_est.onboarding_concluido then return false; end if;
  if v_est.status_manual = 'aberto' then return true; end if;
  if v_est.status_manual = 'fechado' then return false; end if;
  v_agora := timezone(coalesce(v_est.timezone, 'America/Sao_Paulo'), now());
  if exists (
    select 1 from public.dias_bloqueados d
    where d.estabelecimento_id = p_estabelecimento_id and d.data = v_agora::date
  ) then return false; end if;
  v_dia := extract(dow from v_agora)::smallint;
  v_hora := v_agora::time;
  return exists (
    select 1 from public.estabelecimento_horario_periodos p
    where p.estabelecimento_id = p_estabelecimento_id and p.ativo
      and (
        (p.dia_semana = v_dia and not p.fecha_dia_seguinte and v_hora >= p.abre and v_hora < p.fecha)
        or (p.dia_semana = v_dia and p.fecha_dia_seguinte and v_hora >= p.abre)
        or (p.dia_semana = ((v_dia + 6) % 7)::smallint and p.fecha_dia_seguinte and v_hora < p.fecha)
      )
  );
end;
$$;

revoke all on function public.estabelecimento_aberto_agora(uuid) from public;
grant execute on function public.estabelecimento_aberto_agora(uuid) to anon, authenticated, service_role;

-- ============================================================
-- 2. ATENDIMENTO MANUAL, PAGAMENTO E RETENTATIVA SEGURA
-- ============================================================

alter table public.agendamentos
  alter column cliente_email drop not null,
  add column if not exists canal_origem text not null default 'marketplace',
  add column if not exists forma_pagamento text not null default 'nao_informado',
  add column if not exists pago_em timestamptz,
  add column if not exists registrado_por uuid references public.perfis(id) on delete set null,
  add column if not exists chave_idempotencia text,
  add column if not exists idempotencia_hash text;

update public.agendamentos
set canal_origem = case
  when tipo_atendimento = 'encaixe' or origem = 'painel' then 'presencial'
  when origem = 'recorrencia' then 'marketplace'
  else 'marketplace'
end
where canal_origem = 'marketplace';

alter table public.agendamentos drop constraint if exists agendamentos_tipo_atendimento_check;
alter table public.agendamentos add constraint agendamentos_tipo_atendimento_check
  check (tipo_atendimento in ('online','encaixe','interno','recorrente','manual'));
alter table public.agendamentos add constraint agendamentos_canal_origem_check
  check (canal_origem in ('marketplace','presencial','whatsapp','telefone','outro','interno'));
alter table public.agendamentos add constraint agendamentos_forma_pagamento_check
  check (forma_pagamento in ('nao_informado','dinheiro','pix','cartao_credito','cartao_debito','outro'));
alter table public.agendamentos add constraint agendamentos_chave_idempotencia_check
  check (chave_idempotencia is null or (
    char_length(chave_idempotencia) between 8 and 128
    and chave_idempotencia ~ '^[A-Za-z0-9._:-]+$'
  ));
alter table public.agendamentos add constraint agendamentos_idempotencia_hash_check
  check (idempotencia_hash is null or idempotencia_hash ~ '^[0-9a-f]{64}$');

create unique index if not exists agendamentos_idempotencia_estabelecimento_idx
  on public.agendamentos(estabelecimento_id, chave_idempotencia)
  where chave_idempotencia is not null;
create index if not exists agendamentos_operacao_cursor_idx
  on public.agendamentos(estabelecimento_id, inicio_previsto desc, id desc);
create index if not exists agendamentos_canal_data_idx
  on public.agendamentos(estabelecimento_id, canal_origem, data desc, id desc);

alter table public.lancamentos_financeiros
  add column if not exists categoria text not null default 'outros',
  add column if not exists forma_pagamento text not null default 'nao_informado',
  add column if not exists canal_origem text not null default 'interno',
  add column if not exists chave_idempotencia text,
  add column if not exists idempotencia_hash text;

alter table public.lancamentos_financeiros drop constraint if exists lancamentos_financeiros_tipo_check;
alter table public.lancamentos_financeiros add constraint lancamentos_financeiros_tipo_check
  check (tipo in ('receita_atendimento','ajuste','estorno','despesa'));
alter table public.lancamentos_financeiros add constraint lancamentos_financeiros_categoria_check
  check (char_length(trim(categoria)) between 2 and 60);
alter table public.lancamentos_financeiros add constraint lancamentos_financeiros_forma_pagamento_check
  check (forma_pagamento in ('nao_informado','dinheiro','pix','cartao_credito','cartao_debito','outro'));
alter table public.lancamentos_financeiros add constraint lancamentos_financeiros_canal_origem_check
  check (canal_origem in ('marketplace','presencial','whatsapp','telefone','outro','interno','sistema'));
alter table public.lancamentos_financeiros add constraint lancamentos_financeiros_chave_idempotencia_check
  check (chave_idempotencia is null or (
    char_length(chave_idempotencia) between 8 and 128
    and chave_idempotencia ~ '^[A-Za-z0-9._:-]+$'
  ));
alter table public.lancamentos_financeiros add constraint lancamentos_financeiros_idempotencia_hash_check
  check (idempotencia_hash is null or idempotencia_hash ~ '^[0-9a-f]{64}$');

create unique index if not exists lancamentos_idempotencia_estabelecimento_idx
  on public.lancamentos_financeiros(estabelecimento_id, chave_idempotencia)
  where chave_idempotencia is not null and origem = 'manual';
create index if not exists lancamentos_cursor_110_idx
  on public.lancamentos_financeiros(estabelecimento_id, competencia desc, created_at desc, id desc);
create index if not exists lancamentos_categoria_competencia_110_idx
  on public.lancamentos_financeiros(estabelecimento_id, categoria, competencia desc)
  where status <> 'cancelado';

-- Mantém o lançamento financeiro derivado do atendimento sincronizado com os
-- novos campos. A função continua interna aos gatilhos.
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
    comissao_valor, comissao_regra_snapshot, motivo, origem, criado_por,
    categoria, forma_pagamento, canal_origem, chave_idempotencia, idempotencia_hash
  ) values (
    new.estabelecimento_id, new.id, new.profissional_id, new.data,
    'receita_atendimento', 'credito', v_status,
    'Atendimento de ' || coalesce(nullif(new.cliente_nome,''), 'Cliente'),
    new.valor, 0, new.valor,
    coalesce((v_comissao->>'valor')::numeric, 0), v_comissao->'regra', null,
    'agendamento', coalesce(new.registrado_por, (select auth.uid())),
    'atendimentos', new.forma_pagamento, new.canal_origem,
    new.chave_idempotencia, new.idempotencia_hash
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
    categoria = excluded.categoria,
    forma_pagamento = excluded.forma_pagamento,
    canal_origem = excluded.canal_origem,
    chave_idempotencia = excluded.chave_idempotencia,
    idempotencia_hash = excluded.idempotencia_hash,
    updated_at = now();
  return new;
end;
$$;

drop trigger if exists agendamentos_sincronizar_financeiro_19 on public.agendamentos;
create trigger agendamentos_sincronizar_financeiro_19
after insert or update of status, valor, data, profissional_id, servico_id, cliente_nome,
  forma_pagamento, canal_origem, chave_idempotencia, idempotencia_hash
on public.agendamentos
for each row execute function public.sincronizar_financeiro_agendamento_19();

revoke all on function public.sincronizar_financeiro_agendamento_19() from public, anon, authenticated;

-- Remove a assinatura inicial da prévia da 1.10, que não aceitava serviço avulso.
drop function if exists public.registrar_atendimento_manual_110(uuid,uuid,uuid,uuid,text,text,text,timestamptz,numeric,text,text,text,text,text);

create or replace function public.registrar_atendimento_manual_110(
  p_estabelecimento_id uuid,
  p_profissional_id uuid,
  p_servico_id uuid,
  p_servico_nome text default null,
  p_duracao_min integer default null,
  p_cliente_id uuid default null,
  p_cliente_nome text default null,
  p_cliente_email text default null,
  p_cliente_telefone text default null,
  p_inicio timestamptz default now(),
  p_valor numeric default null,
  p_forma_pagamento text default 'nao_informado',
  p_canal_origem text default 'presencial',
  p_observacao text default null,
  p_chave_idempotencia text default null,
  p_idempotencia_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_est public.estabelecimentos%rowtype;
  v_prof public.profissionais%rowtype;
  v_servico public.servicos%rowtype;
  v_cliente public.perfis%rowtype;
  v_inicio_local timestamp without time zone;
  v_fim_local timestamp without time zone;
  v_agora_local timestamp without time zone;
  v_valor numeric(10,2);
  v_chave text;
  v_hash text;
  v_existente public.agendamentos%rowtype;
  v_id uuid := gen_random_uuid();
begin
  if (select auth.uid()) is null then raise exception 'Autenticação obrigatória.'; end if;
  if not private.pode_executar_acao_193(p_estabelecimento_id, 'agenda') then
    raise exception 'Sua conta não pode registrar atendimentos.';
  end if;
  if p_forma_pagamento not in ('nao_informado','dinheiro','pix','cartao_credito','cartao_debito','outro') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  if p_canal_origem not in ('presencial','whatsapp','telefone','outro','interno') then
    raise exception 'Canal de origem inválido.';
  end if;
  select * into v_est from public.estabelecimentos e where e.id = p_estabelecimento_id;
  if not found then raise exception 'Estabelecimento não encontrado.'; end if;
  if private.papel_no_estabelecimento_19(p_estabelecimento_id) = 'profissional'
     and private.profissional_vinculado_19(p_estabelecimento_id) is distinct from p_profissional_id then
    raise exception 'O profissional só pode registrar atendimentos na própria agenda.';
  end if;
  select * into v_prof from public.profissionais p
  where p.id = p_profissional_id and p.estabelecimento_id = p_estabelecimento_id and p.ativo;
  if not found then raise exception 'Profissional indisponível.'; end if;
  if p_servico_id is null then
    if char_length(trim(coalesce(p_servico_nome,''))) not between 2 and 140 then
      raise exception 'Informe o nome do serviço avulso.';
    end if;
    if p_duracao_min is null or p_duracao_min not between 5 and 480 then
      raise exception 'A duração do serviço avulso deve ficar entre 5 e 480 minutos.';
    end if;
    -- Serializa nomes iguais para que dois toques/requisições não criem duplicatas.
    perform pg_advisory_xact_lock(hashtextextended(
      p_estabelecimento_id::text || ':servico:' || lower(trim(p_servico_nome)), 0
    ));
    select * into v_servico from public.servicos s
    where s.estabelecimento_id = p_estabelecimento_id
      and lower(trim(s.nome)) = lower(trim(p_servico_nome))
    order by s.ativo desc, s.created_at asc
    limit 1;
    if found and not v_servico.ativo then
      raise exception 'Já existe um serviço inativo com esse nome. Ative-o antes de registrar.';
    end if;
    if not found then
      insert into public.servicos(
        estabelecimento_id,nome,categoria,descricao,preco,duracao_min,ativo,publico
      ) values (
        p_estabelecimento_id,trim(p_servico_nome),'Atendimento avulso',
        'Criado no registro rápido de atendimento.',coalesce(p_valor,0),p_duracao_min,true,false
      ) returning * into v_servico;
    end if;
    insert into public.profissional_servicos(profissional_id,servico_id)
    values(p_profissional_id,v_servico.id)
    on conflict do nothing;
  else
    select * into v_servico from public.servicos s
    where s.id = p_servico_id and s.estabelecimento_id = p_estabelecimento_id and s.ativo;
    if not found then raise exception 'Serviço indisponível.'; end if;
  end if;
  if p_cliente_id is not null then
    select * into v_cliente from public.perfis p where p.id = p_cliente_id and p.ativo;
    if not found then raise exception 'Cliente não encontrado ou inativo.'; end if;
  end if;

  v_inicio_local := timezone(coalesce(v_est.timezone,'America/Sao_Paulo'), coalesce(p_inicio,now()));
  v_fim_local := v_inicio_local + make_interval(mins => v_servico.duracao_min);
  v_agora_local := timezone(coalesce(v_est.timezone,'America/Sao_Paulo'), now());
  if v_inicio_local::date < v_agora_local::date - 31 or v_inicio_local::date > v_agora_local::date + 1 then
    raise exception 'O atendimento manual deve estar entre os últimos 31 dias e o próximo dia.';
  end if;
  if v_fim_local::date <> v_inicio_local::date then
    raise exception 'Registre separadamente atendimentos que atravessam a meia-noite.';
  end if;
  if not private.atendimento_dentro_periodo_110(
    p_estabelecimento_id, v_inicio_local::date, v_inicio_local::time, v_fim_local::time
  ) and v_est.status_manual <> 'aberto' then
    raise exception 'O atendimento está fora dos períodos de funcionamento.';
  end if;
  if exists (
    select 1 from public.agenda_bloqueios b
    where b.estabelecimento_id = p_estabelecimento_id
      and (b.profissional_id is null or b.profissional_id = p_profissional_id)
      and coalesce(p_inicio,now()) < b.fim
      and coalesce(p_inicio,now()) + make_interval(mins => v_servico.duracao_min) > b.inicio
  ) then raise exception 'O período está bloqueado na agenda.'; end if;

  v_valor := coalesce(p_valor, v_servico.preco);
  if v_valor < 0 or v_valor > 1000000 then raise exception 'Valor inválido.'; end if;
  if char_length(trim(coalesce(p_observacao,''))) > 1000 then raise exception 'A observação é muito longa.'; end if;
  v_chave := coalesce(nullif(trim(p_chave_idempotencia),''), gen_random_uuid()::text);
  if char_length(v_chave) not between 8 and 128 or v_chave !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'Chave de idempotência inválida.';
  end if;
  v_hash := encode(digest(convert_to(jsonb_build_object(
    'estabelecimento_id',p_estabelecimento_id,'profissional_id',p_profissional_id,
    'servico_id',v_servico.id,'servico_nome',v_servico.nome,'duracao_min',v_servico.duracao_min,
    'cliente_id',p_cliente_id,'cliente_nome',nullif(trim(coalesce(p_cliente_nome,'')),''),
    'inicio',coalesce(p_inicio,now()),'valor',v_valor,'forma_pagamento',p_forma_pagamento,
    'canal_origem',p_canal_origem
  )::text,'utf8'),'sha256'),'hex');
  if nullif(lower(trim(coalesce(p_idempotencia_hash,''))),'') is not null
     and lower(trim(p_idempotencia_hash)) <> v_hash then
    raise exception 'O hash de idempotência não corresponde ao conteúdo do atendimento.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_estabelecimento_id::text || ':manual:' || v_chave,0));
  select * into v_existente from public.agendamentos a
  where a.estabelecimento_id = p_estabelecimento_id and a.chave_idempotencia = v_chave;
  if found then
    if v_existente.idempotencia_hash is distinct from v_hash then
      raise exception 'A chave de idempotência já foi usada com dados diferentes.';
    end if;
    return jsonb_build_object('id',v_existente.id,'reutilizado',true,'status',v_existente.status);
  end if;

  insert into public.agendamentos(
    id, estabelecimento_id, profissional_id, servico_id, cliente_id,
    cliente_nome, cliente_email, cliente_telefone, data, hora_inicio, hora_fim,
    status, observacao, valor, pagamento_status, origem, tipo_atendimento,
    canal_origem, forma_pagamento, pago_em, registrado_por,
    chave_idempotencia, idempotencia_hash,
    confirmacao_cliente, confirmacao_estabelecimento, estabelecimento_confirmado_em
  ) values (
    v_id, p_estabelecimento_id, p_profissional_id, v_servico.id, p_cliente_id,
    coalesce(nullif(trim(coalesce(p_cliente_nome,'')),''), v_cliente.nome, 'Cliente avulso'),
    coalesce(nullif(lower(trim(coalesce(p_cliente_email,''))),''), v_cliente.email),
    coalesce(nullif(trim(coalesce(p_cliente_telefone,'')),''), v_cliente.telefone),
    v_inicio_local::date, v_inicio_local::time, v_fim_local::time,
    'concluido', nullif(trim(coalesce(p_observacao,'')),''), v_valor,
    case when p_forma_pagamento='nao_informado' then 'nao_disponivel' else 'pago' end,
    'manual', 'manual', p_canal_origem, p_forma_pagamento,
    case when p_forma_pagamento='nao_informado' then null else coalesce(p_inicio,now()) end,
    (select auth.uid()), v_chave, v_hash, 'confirmada','confirmada',coalesce(p_inicio,now())
  );

  insert into public.agendamento_servicos(
    agendamento_id, servico_id, ordem, nome_snapshot, preco_snapshot, duracao_min_snapshot
  ) values (v_id,v_servico.id,1,v_servico.nome,v_valor,v_servico.duracao_min);

  return jsonb_build_object('id',v_id,'reutilizado',false,'status','concluido');
end;
$$;

create or replace function public.registrar_despesa_110(
  p_estabelecimento_id uuid,
  p_competencia date,
  p_valor numeric,
  p_categoria text,
  p_descricao text,
  p_forma_pagamento text default 'nao_informado',
  p_observacao text default null,
  p_chave_idempotencia text default null,
  p_idempotencia_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_chave text;
  v_hash text;
  v_existente public.lancamentos_financeiros%rowtype;
  v_id uuid;
begin
  if (select auth.uid()) is null then raise exception 'Autenticação obrigatória.'; end if;
  if not private.pode_executar_acao_193(p_estabelecimento_id,'financeiro')
     or not private.tem_recurso_operacional_19(p_estabelecimento_id,'permite_financeiro') then
    raise exception 'Sua conta não pode registrar despesas.';
  end if;
  if p_competencia > current_date + 1 or p_competencia < current_date - 3660 then raise exception 'Data inválida.'; end if;
  if p_valor <= 0 or p_valor > 1000000 then raise exception 'Valor inválido.'; end if;
  if char_length(trim(coalesce(p_categoria,''))) not between 2 and 60 then raise exception 'Categoria inválida.'; end if;
  if char_length(trim(coalesce(p_descricao,''))) not between 2 and 180 then raise exception 'Descrição inválida.'; end if;
  if char_length(trim(coalesce(p_observacao,''))) > 500 then raise exception 'A observação é muito longa.'; end if;
  if p_forma_pagamento not in ('nao_informado','dinheiro','pix','cartao_credito','cartao_debito','outro') then
    raise exception 'Forma de pagamento inválida.';
  end if;
  v_chave := coalesce(nullif(trim(p_chave_idempotencia),''),gen_random_uuid()::text);
  if char_length(v_chave) not between 8 and 128 or v_chave !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'Chave de idempotência inválida.';
  end if;
  v_hash := encode(digest(convert_to(jsonb_build_object(
    'estabelecimento_id',p_estabelecimento_id,'competencia',p_competencia,'valor',p_valor,
    'categoria',trim(p_categoria),'descricao',trim(p_descricao),'forma_pagamento',p_forma_pagamento
  )::text,'utf8'),'sha256'),'hex');
  if nullif(lower(trim(coalesce(p_idempotencia_hash,''))),'') is not null
     and lower(trim(p_idempotencia_hash)) <> v_hash then
    raise exception 'O hash de idempotência não corresponde ao conteúdo da despesa.';
  end if;
  perform pg_advisory_xact_lock(hashtextextended(p_estabelecimento_id::text || ':despesa:' || v_chave,0));
  select * into v_existente from public.lancamentos_financeiros l
  where l.estabelecimento_id=p_estabelecimento_id and l.chave_idempotencia=v_chave and l.origem='manual';
  if found then
    if v_existente.idempotencia_hash is distinct from v_hash then
      raise exception 'A chave de idempotência já foi usada com dados diferentes.';
    end if;
    return jsonb_build_object('id',v_existente.id,'reutilizado',true,'status',v_existente.status);
  end if;
  insert into public.lancamentos_financeiros(
    estabelecimento_id,competencia,tipo,natureza,status,descricao,valor_bruto,
    valor_liquido,comissao_valor,motivo,origem,criado_por,categoria,
    forma_pagamento,canal_origem,chave_idempotencia,idempotencia_hash
  ) values (
    p_estabelecimento_id,p_competencia,'despesa','debito','realizado',trim(p_descricao),
    p_valor,p_valor,0,nullif(trim(coalesce(p_observacao,'')),''),'manual',(select auth.uid()),
    trim(p_categoria),p_forma_pagamento,'interno',v_chave,v_hash
  ) returning id into v_id;
  return jsonb_build_object('id',v_id,'reutilizado',false,'status','realizado');
end;
$$;

create or replace function public.resumo_financeiro_110(
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
declare v_resultado jsonb;
begin
  if not private.pode_executar_acao_193(p_estabelecimento_id,'financeiro')
     or not private.tem_recurso_operacional_19(p_estabelecimento_id,'permite_financeiro') then
    raise exception 'Sua conta não pode acessar o financeiro.';
  end if;
  if p_fim < p_inicio or p_fim > p_inicio + 366 then raise exception 'Período inválido.'; end if;
  select jsonb_build_object(
    'entradas_realizadas',coalesce(sum(l.valor_liquido) filter(where l.natureza='credito' and l.status='realizado'),0),
    'entradas_previstas',coalesce(sum(l.valor_liquido) filter(where l.natureza='credito' and l.status='previsto'),0),
    'despesas_realizadas',coalesce(sum(l.valor_liquido) filter(where l.natureza='debito' and l.status='realizado'),0),
    'resultado_realizado',coalesce(sum(case when l.status='realizado' then case when l.natureza='credito' then l.valor_liquido else -l.valor_liquido end else 0 end),0),
    'resultado_estimado',coalesce(sum(case when l.status in ('realizado','previsto') then case when l.natureza='credito' then l.valor_liquido else -l.valor_liquido end else 0 end),0),
    'comissoes',coalesce(sum(l.comissao_valor) filter(where l.status='realizado'),0),
    'atendimentos_concluidos',count(*) filter(where l.tipo='receita_atendimento' and l.status='realizado'),
    'ticket_medio',coalesce(
      sum(l.valor_liquido) filter(where l.tipo='receita_atendimento' and l.natureza='credito' and l.status='realizado')
      / nullif(count(*) filter(where l.tipo='receita_atendimento' and l.status='realizado'),0),
      0
    ),
    'inicio',p_inicio,'fim',p_fim
  ) into v_resultado
  from public.lancamentos_financeiros l
  where l.estabelecimento_id=p_estabelecimento_id and l.competencia between p_inicio and p_fim;
  return v_resultado;
end;
$$;

revoke all on function public.registrar_atendimento_manual_110(uuid,uuid,uuid,text,integer,uuid,text,text,text,timestamptz,numeric,text,text,text,text,text) from public, anon;
grant execute on function public.registrar_atendimento_manual_110(uuid,uuid,uuid,text,integer,uuid,text,text,text,timestamptz,numeric,text,text,text,text,text) to authenticated, service_role;
revoke all on function public.registrar_despesa_110(uuid,date,numeric,text,text,text,text,text,text) from public, anon;
grant execute on function public.registrar_despesa_110(uuid,date,numeric,text,text,text,text,text,text) to authenticated, service_role;
revoke all on function public.resumo_financeiro_110(uuid,date,date) from public, anon;
grant execute on function public.resumo_financeiro_110(uuid,date,date) to authenticated, service_role;

commit;
