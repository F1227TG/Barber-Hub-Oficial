-- Barber Hub 1.9.0: agenda profissional, equipe operacional e trilha de eventos.
-- Execute depois de 17_correcao_auditoria_seguranca.sql.

begin;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- Implementação fail-closed temporária. A migration 21 substitui esta função
-- pelo resolvedor real de entitlements antes de liberar os módulos.
create or replace function private.tem_recurso_operacional_19(
  p_estabelecimento_id uuid,
  p_recurso text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$ select false $$;
revoke all on function private.tem_recurso_operacional_19(uuid,text) from public, anon;
grant execute on function private.tem_recurso_operacional_19(uuid,text) to authenticated, service_role;

alter table public.estabelecimentos
  add column if not exists timezone text not null default 'America/Sao_Paulo';

-- ============================================================
-- 1. EQUIPE COM CONTA E PAPEL OPERACIONAL
-- ============================================================

create table if not exists public.estabelecimento_membros (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  user_id uuid not null references public.perfis(id) on delete cascade,
  profissional_id uuid references public.profissionais(id) on delete set null,
  papel text not null check (papel in ('gerente','recepcao','profissional')),
  status text not null default 'ativo' check (status in ('ativo','suspenso','removido')),
  convidado_por uuid references public.perfis(id) on delete set null,
  aceito_em timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (papel <> 'profissional' or profissional_id is not null),
  unique (estabelecimento_id, user_id),
  unique (profissional_id)
);

create index if not exists estabelecimento_membros_user_status_idx
  on public.estabelecimento_membros(user_id, status, estabelecimento_id);
create index if not exists estabelecimento_membros_estabelecimento_status_idx
  on public.estabelecimento_membros(estabelecimento_id, status, papel);

drop trigger if exists estabelecimento_membros_updated_at on public.estabelecimento_membros;
create trigger estabelecimento_membros_updated_at
before update on public.estabelecimento_membros
for each row execute function public.set_updated_at();

create or replace function private.papel_no_estabelecimento_19(p_estabelecimento_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when (select auth.uid()) is null then null
    when exists (
      select 1 from public.perfis p
      where p.id = (select auth.uid()) and p.tipo = 'admin' and p.ativo = true
    ) then 'admin'
    when exists (
      select 1 from public.estabelecimentos e
      where e.id = p_estabelecimento_id and e.owner_id = (select auth.uid())
    ) then 'proprietario'
    else (
      select m.papel
      from public.estabelecimento_membros m
      where m.estabelecimento_id = p_estabelecimento_id
        and m.user_id = (select auth.uid())
        and m.status = 'ativo'
      limit 1
    )
  end;
$$;

create or replace function private.pode_operar_estabelecimento_19(
  p_estabelecimento_id uuid,
  p_papeis text[] default array['proprietario','gerente','recepcao','profissional','admin']::text[]
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(private.papel_no_estabelecimento_19(p_estabelecimento_id) = any(p_papeis), false);
$$;

create or replace function private.profissional_vinculado_19(p_estabelecimento_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select m.profissional_id
  from public.estabelecimento_membros m
  where m.estabelecimento_id = p_estabelecimento_id
    and m.user_id = (select auth.uid())
    and m.status = 'ativo'
    and m.papel = 'profissional'
  limit 1;
$$;

revoke all on function private.papel_no_estabelecimento_19(uuid) from public, anon;
revoke all on function private.pode_operar_estabelecimento_19(uuid,text[]) from public, anon;
revoke all on function private.profissional_vinculado_19(uuid) from public, anon;
grant execute on function private.papel_no_estabelecimento_19(uuid) to authenticated, service_role;
grant execute on function private.pode_operar_estabelecimento_19(uuid,text[]) to authenticated, service_role;
grant execute on function private.profissional_vinculado_19(uuid) to authenticated, service_role;

alter table public.estabelecimento_membros enable row level security;

drop policy if exists membros_select_operacional on public.estabelecimento_membros;
create policy membros_select_operacional on public.estabelecimento_membros
for select to authenticated
using (
  user_id = (select auth.uid())
  or private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);

drop policy if exists membros_update_gestao on public.estabelecimento_membros;
create policy membros_update_gestao on public.estabelecimento_membros
for update to authenticated
using (
  private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
)
with check (
  private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);

grant select, update on public.estabelecimento_membros to authenticated;

-- ============================================================
-- 2. BLOCOS E INTERVALOS DA AGENDA
-- ============================================================

create table if not exists public.agenda_bloqueios (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  profissional_id uuid references public.profissionais(id) on delete cascade,
  inicio timestamptz not null,
  fim timestamptz not null,
  tipo text not null default 'bloqueio' check (tipo in ('bloqueio','pausa','indisponibilidade')),
  motivo text,
  criado_por uuid not null references public.perfis(id) on delete restrict,
  created_at timestamptz not null default now(),
  check (inicio < fim)
);

create index if not exists agenda_bloqueios_estabelecimento_periodo_idx
  on public.agenda_bloqueios(estabelecimento_id, inicio, fim);
create index if not exists agenda_bloqueios_profissional_periodo_idx
  on public.agenda_bloqueios(profissional_id, inicio, fim)
  where profissional_id is not null;

create table if not exists public.agenda_intervalos_recorrentes (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  profissional_id uuid references public.profissionais(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  inicio time not null,
  fim time not null,
  tipo text not null check (tipo in ('disponivel','pausa')),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (inicio < fim),
  unique (estabelecimento_id, profissional_id, dia_semana, inicio, fim, tipo)
);

create index if not exists agenda_intervalos_estabelecimento_dia_idx
  on public.agenda_intervalos_recorrentes(estabelecimento_id, dia_semana, ativo);
create index if not exists agenda_intervalos_profissional_dia_idx
  on public.agenda_intervalos_recorrentes(profissional_id, dia_semana, ativo)
  where profissional_id is not null;

drop trigger if exists agenda_intervalos_updated_at on public.agenda_intervalos_recorrentes;
create trigger agenda_intervalos_updated_at
before update on public.agenda_intervalos_recorrentes
for each row execute function public.set_updated_at();

-- A FK isolada garante que o profissional existe, mas não que pertence ao
-- mesmo estabelecimento. O gatilho impede referências cruzadas entre tenants.
create or replace function public.validar_profissional_estabelecimento_operacional_19()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profissional_id is not null and not exists (
    select 1 from public.profissionais p
    where p.id = new.profissional_id and p.estabelecimento_id = new.estabelecimento_id
  ) then
    raise exception 'O profissional não pertence ao estabelecimento.' using errcode = '23503';
  end if;
  return new;
end;
$$;

drop trigger if exists membros_validar_profissional_estabelecimento_19 on public.estabelecimento_membros;
create trigger membros_validar_profissional_estabelecimento_19
before insert or update of estabelecimento_id, profissional_id on public.estabelecimento_membros
for each row execute function public.validar_profissional_estabelecimento_operacional_19();

drop trigger if exists bloqueios_validar_profissional_estabelecimento_19 on public.agenda_bloqueios;
create trigger bloqueios_validar_profissional_estabelecimento_19
before insert or update of estabelecimento_id, profissional_id on public.agenda_bloqueios
for each row execute function public.validar_profissional_estabelecimento_operacional_19();

drop trigger if exists intervalos_validar_profissional_estabelecimento_19 on public.agenda_intervalos_recorrentes;
create trigger intervalos_validar_profissional_estabelecimento_19
before insert or update of estabelecimento_id, profissional_id on public.agenda_intervalos_recorrentes
for each row execute function public.validar_profissional_estabelecimento_operacional_19();

revoke all on function public.validar_profissional_estabelecimento_operacional_19() from public, anon, authenticated;

alter table public.agenda_bloqueios enable row level security;
alter table public.agenda_intervalos_recorrentes enable row level security;

drop policy if exists agenda_bloqueios_select_equipe on public.agenda_bloqueios;
create policy agenda_bloqueios_select_equipe on public.agenda_bloqueios
for select to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_agenda_avancada')
  and private.pode_operar_estabelecimento_19(estabelecimento_id)
);

drop policy if exists agenda_bloqueios_insert_equipe on public.agenda_bloqueios;
create policy agenda_bloqueios_insert_equipe on public.agenda_bloqueios
for insert to authenticated
with check (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_agenda_avancada')
  and criado_por = (select auth.uid())
  and (
    private.pode_operar_estabelecimento_19(
      estabelecimento_id,
      array['proprietario','gerente','recepcao','admin']::text[]
    )
    or (
      private.papel_no_estabelecimento_19(estabelecimento_id) = 'profissional'
      and profissional_id = private.profissional_vinculado_19(estabelecimento_id)
    )
  )
);

drop policy if exists agenda_bloqueios_delete_equipe on public.agenda_bloqueios;
create policy agenda_bloqueios_delete_equipe on public.agenda_bloqueios
for delete to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_agenda_avancada')
  and (
  private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','recepcao','admin']::text[]
  )
  or criado_por = (select auth.uid())
  )
);

drop policy if exists agenda_intervalos_select_equipe on public.agenda_intervalos_recorrentes;
create policy agenda_intervalos_select_equipe on public.agenda_intervalos_recorrentes
for select to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_agenda_avancada')
  and private.pode_operar_estabelecimento_19(estabelecimento_id)
);

drop policy if exists agenda_intervalos_manage_gestao on public.agenda_intervalos_recorrentes;
create policy agenda_intervalos_manage_gestao on public.agenda_intervalos_recorrentes
for all to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_agenda_avancada')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
)
with check (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_agenda_avancada')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);

grant select, insert, delete on public.agenda_bloqueios to authenticated;
grant select, insert, update, delete on public.agenda_intervalos_recorrentes to authenticated;

-- ============================================================
-- 3. AGENDAMENTO 2.0 E EVENTOS IMUTAVEIS
-- ============================================================

alter table public.agendamentos
  alter column cliente_id drop not null,
  add column if not exists inicio_previsto timestamptz,
  add column if not exists fim_previsto timestamptz,
  add column if not exists confirmacao_cliente text not null default 'pendente',
  add column if not exists confirmacao_estabelecimento text not null default 'pendente',
  add column if not exists cliente_confirmado_em timestamptz,
  add column if not exists estabelecimento_confirmado_em timestamptz,
  add column if not exists no_show_em timestamptz,
  add column if not exists no_show_registrado_por uuid references public.perfis(id) on delete set null,
  add column if not exists reagendamentos_quantidade smallint not null default 0,
  add column if not exists profissional_nome_snapshot text,
  add column if not exists tipo_atendimento text not null default 'online';

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'agendamentos_confirmacao_cliente_check'
      and conrelid = 'public.agendamentos'::regclass
  ) then
    alter table public.agendamentos add constraint agendamentos_confirmacao_cliente_check
      check (confirmacao_cliente in ('pendente','confirmada','recusada'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'agendamentos_confirmacao_estabelecimento_check'
      and conrelid = 'public.agendamentos'::regclass
  ) then
    alter table public.agendamentos add constraint agendamentos_confirmacao_estabelecimento_check
      check (confirmacao_estabelecimento in ('pendente','confirmada','recusada'));
  end if;
  if not exists (
    select 1 from pg_constraint
    where conname = 'agendamentos_tipo_atendimento_check'
      and conrelid = 'public.agendamentos'::regclass
  ) then
    alter table public.agendamentos add constraint agendamentos_tipo_atendimento_check
      check (tipo_atendimento in ('online','encaixe','interno'));
  end if;
end $$;

alter table public.agendamentos drop constraint if exists agendamentos_status_check;
alter table public.agendamentos add constraint agendamentos_status_check
  check (status in ('pendente','confirmado','concluido','cancelado','recusado','faltou'));

create index if not exists agendamentos_estabelecimento_inicio_idx
  on public.agendamentos(estabelecimento_id, inicio_previsto, id);
create index if not exists agendamentos_profissional_inicio_ativos_idx
  on public.agendamentos(profissional_id, inicio_previsto)
  where status in ('pendente','confirmado');

create or replace function public.validar_catalogo_agendamento_operacional_19()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.profissional_id is not null and not exists (
    select 1 from public.profissionais p
    where p.id = new.profissional_id and p.estabelecimento_id = new.estabelecimento_id
  ) then raise exception 'O profissional não pertence ao estabelecimento.' using errcode = '23503'; end if;
  if new.servico_id is not null and not exists (
    select 1 from public.servicos s
    where s.id = new.servico_id and s.estabelecimento_id = new.estabelecimento_id
  ) then raise exception 'O serviço não pertence ao estabelecimento.' using errcode = '23503'; end if;
  return new;
end;
$$;

drop trigger if exists agendamentos_validar_catalogo_operacional_19 on public.agendamentos;
create trigger agendamentos_validar_catalogo_operacional_19
before insert or update of estabelecimento_id, profissional_id, servico_id on public.agendamentos
for each row execute function public.validar_catalogo_agendamento_operacional_19();

revoke all on function public.validar_catalogo_agendamento_operacional_19() from public, anon, authenticated;

do $$
begin
  if exists (
    select 1 from public.agendamentos a
    left join public.profissionais p on p.id = a.profissional_id
    left join public.servicos s on s.id = a.servico_id
    where p.id is null or p.estabelecimento_id <> a.estabelecimento_id
       or (a.servico_id is not null and (s.id is null or s.estabelecimento_id <> a.estabelecimento_id))
  ) then
    raise exception 'Existem agendamentos com referências cruzadas; corrija-os antes da migration 18.';
  end if;
end $$;

create table if not exists public.agendamento_eventos (
  id bigint generated always as identity primary key,
  agendamento_id uuid not null references public.agendamentos(id) on delete cascade,
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  ator_id uuid references public.perfis(id) on delete set null,
  tipo text not null check (tipo in ('criado','status','reagendado','confirmacao','no_show','observacao')),
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists agendamento_eventos_agendamento_created_idx
  on public.agendamento_eventos(agendamento_id, created_at, id);
create index if not exists agendamento_eventos_estabelecimento_created_idx
  on public.agendamento_eventos(estabelecimento_id, created_at, id);

alter table public.agendamento_eventos enable row level security;

drop policy if exists agendamento_eventos_select_partes on public.agendamento_eventos;
create policy agendamento_eventos_select_partes on public.agendamento_eventos
for select to authenticated
using (
  exists (
    select 1 from public.agendamentos a
    where a.id = agendamento_id
      and (
        a.cliente_id = (select auth.uid())
        or private.pode_operar_estabelecimento_19(a.estabelecimento_id)
      )
  )
);

grant select on public.agendamento_eventos to authenticated;

create or replace function public.sincronizar_agendamento_operacional_19()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_timezone text;
begin
  select coalesce(e.timezone, 'America/Sao_Paulo') into v_timezone
  from public.estabelecimentos e where e.id = new.estabelecimento_id;

  new.inicio_previsto := (new.data + new.hora_inicio) at time zone v_timezone;
  new.fim_previsto := (new.data + new.hora_fim) at time zone v_timezone;

  if new.profissional_nome_snapshot is null then
    select p.nome into new.profissional_nome_snapshot
    from public.profissionais p where p.id = new.profissional_id;
  end if;
  return new;
end;
$$;

drop trigger if exists agendamentos_sincronizar_operacional_19 on public.agendamentos;
create trigger agendamentos_sincronizar_operacional_19
before insert or update of estabelecimento_id, profissional_id, data, hora_inicio, hora_fim
on public.agendamentos
for each row execute function public.sincronizar_agendamento_operacional_19();

update public.agendamentos a
set inicio_previsto = (a.data + a.hora_inicio) at time zone coalesce(e.timezone, 'America/Sao_Paulo'),
    fim_previsto = (a.data + a.hora_fim) at time zone coalesce(e.timezone, 'America/Sao_Paulo'),
    profissional_nome_snapshot = coalesce(a.profissional_nome_snapshot, p.nome)
from public.estabelecimentos e, public.profissionais p
where e.id = a.estabelecimento_id
  and p.id = a.profissional_id
  and (a.inicio_previsto is null or a.fim_previsto is null or a.profissional_nome_snapshot is null);

alter table public.agendamentos
  alter column inicio_previsto set not null,
  alter column fim_previsto set not null;

create or replace function public.registrar_evento_agendamento_19()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    insert into public.agendamento_eventos(agendamento_id, estabelecimento_id, ator_id, tipo, dados)
    values (
      new.id,
      new.estabelecimento_id,
      auth.uid(),
      'criado',
      jsonb_build_object('status', new.status, 'inicio', new.inicio_previsto, 'origem', new.tipo_atendimento)
    );
    return new;
  end if;

  if new.status is distinct from old.status then
    insert into public.agendamento_eventos(agendamento_id, estabelecimento_id, ator_id, tipo, dados)
    values (new.id, new.estabelecimento_id, auth.uid(), 'status', jsonb_build_object('de', old.status, 'para', new.status));
  end if;
  if new.inicio_previsto is distinct from old.inicio_previsto
     or new.profissional_id is distinct from old.profissional_id then
    insert into public.agendamento_eventos(agendamento_id, estabelecimento_id, ator_id, tipo, dados)
    values (
      new.id,
      new.estabelecimento_id,
      auth.uid(),
      'reagendado',
      jsonb_build_object(
        'inicio_anterior', old.inicio_previsto,
        'inicio_novo', new.inicio_previsto,
        'profissional_anterior', old.profissional_id,
        'profissional_novo', new.profissional_id
      )
    );
  end if;
  if new.confirmacao_cliente is distinct from old.confirmacao_cliente
     or new.confirmacao_estabelecimento is distinct from old.confirmacao_estabelecimento then
    insert into public.agendamento_eventos(agendamento_id, estabelecimento_id, ator_id, tipo, dados)
    values (
      new.id,
      new.estabelecimento_id,
      auth.uid(),
      'confirmacao',
      jsonb_build_object(
        'cliente', new.confirmacao_cliente,
        'estabelecimento', new.confirmacao_estabelecimento
      )
    );
  end if;
  if new.no_show_em is distinct from old.no_show_em and new.no_show_em is not null then
    insert into public.agendamento_eventos(agendamento_id, estabelecimento_id, ator_id, tipo, dados)
    values (new.id, new.estabelecimento_id, auth.uid(), 'no_show', jsonb_build_object('registrado_em', new.no_show_em));
  end if;
  return new;
end;
$$;

drop trigger if exists agendamentos_registrar_evento_19 on public.agendamentos;
create trigger agendamentos_registrar_evento_19
after insert or update on public.agendamentos
for each row execute function public.registrar_evento_agendamento_19();

revoke all on function public.sincronizar_agendamento_operacional_19() from public, anon, authenticated;
revoke all on function public.registrar_evento_agendamento_19() from public, anon, authenticated;

create or replace function public.validar_transicao_status_agendamento()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is not distinct from old.status then return new; end if;
  if (old.status = 'pendente' and new.status in ('confirmado','recusado','cancelado'))
     or (old.status = 'confirmado' and new.status in ('concluido','cancelado','faltou')) then
    return new;
  end if;
  raise exception 'Transicao de status invalida: % -> %.', old.status, new.status
    using errcode = '23514';
end;
$$;

revoke all on function public.validar_transicao_status_agendamento() from public, anon, authenticated;

drop policy if exists agendamentos_select_partes on public.agendamentos;
create policy agendamentos_select_partes on public.agendamentos
for select to authenticated
using (
  cliente_id = (select auth.uid())
  or private.pode_operar_estabelecimento_19(estabelecimento_id)
  or public.is_admin()
);

drop policy if exists agendamentos_update_owner_admin on public.agendamentos;
create policy agendamentos_update_owner_admin on public.agendamentos
for update to authenticated
using (
  public.is_admin()
  or private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','recepcao','admin']::text[]
  )
  or (
    private.papel_no_estabelecimento_19(estabelecimento_id) = 'profissional'
    and profissional_id = private.profissional_vinculado_19(estabelecimento_id)
  )
)
with check (
  public.is_admin()
  or private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','recepcao','admin']::text[]
  )
  or (
    private.papel_no_estabelecimento_19(estabelecimento_id) = 'profissional'
    and profissional_id = private.profissional_vinculado_19(estabelecimento_id)
  )
);

drop policy if exists "Cliente visualiza itens dos próprios agendamentos" on public.agendamento_servicos;
drop policy if exists "Profissional visualiza itens do próprio negócio" on public.agendamento_servicos;
drop policy if exists "Admin visualiza itens dos agendamentos" on public.agendamento_servicos;
drop policy if exists agendamento_servicos_select_partes_19 on public.agendamento_servicos;
create policy agendamento_servicos_select_partes_19 on public.agendamento_servicos
for select to authenticated
using (
  exists (
    select 1 from public.agendamentos a
    where a.id = agendamento_id
      and (
        a.cliente_id = (select auth.uid())
        or private.pode_operar_estabelecimento_19(a.estabelecimento_id)
        or public.is_admin()
      )
  )
);

-- ============================================================
-- 4. RPCS TRANSACIONAIS DA AGENDA
-- ============================================================

create or replace function public.reagendar_agendamento_19(
  p_agendamento_id uuid,
  p_profissional_id uuid,
  p_data date,
  p_hora_inicio time
)
returns public.agendamentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agendamento public.agendamentos%rowtype;
  v_estabelecimento public.estabelecimentos%rowtype;
  v_horario public.horarios_funcionamento%rowtype;
  v_duracao interval;
  v_hora_fim time;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_dia smallint;
begin
  if (select auth.uid()) is null then raise exception 'Faça login para continuar.'; end if;
  select * into v_agendamento from public.agendamentos where id = p_agendamento_id for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if v_agendamento.status not in ('pendente','confirmado') then
    raise exception 'Somente agendamentos pendentes ou confirmados podem ser reagendados.';
  end if;
  if not private.tem_recurso_operacional_19(v_agendamento.estabelecimento_id, 'permite_agenda_avancada')
     or not private.pode_operar_estabelecimento_19(v_agendamento.estabelecimento_id) then
    raise exception 'Sua conta não pode reagendar este atendimento.';
  end if;
  if private.papel_no_estabelecimento_19(v_agendamento.estabelecimento_id) = 'profissional'
     and (
       private.profissional_vinculado_19(v_agendamento.estabelecimento_id) <> v_agendamento.profissional_id
       or private.profissional_vinculado_19(v_agendamento.estabelecimento_id) <> p_profissional_id
     ) then
    raise exception 'O profissional só pode reagendar a própria agenda.';
  end if;

  -- Ordem global → profissional também é usada por encaixes e bloqueios,
  -- evitando corrida e deadlock entre as três operações.
  perform pg_advisory_xact_lock(hashtextextended(
    v_agendamento.estabelecimento_id::text || ':todos:' || p_data::text, 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    v_agendamento.estabelecimento_id::text || ':' || p_profissional_id::text || ':' || p_data::text, 0
  ));
  select * into v_estabelecimento from public.estabelecimentos where id = v_agendamento.estabelecimento_id;
  if not exists (
    select 1 from public.profissionais p
    where p.id = p_profissional_id and p.estabelecimento_id = v_agendamento.estabelecimento_id and p.ativo
  ) then raise exception 'Profissional indisponível.'; end if;

  v_duracao := v_agendamento.hora_fim - v_agendamento.hora_inicio;
  v_hora_fim := p_hora_inicio + v_duracao;
  v_dia := extract(dow from p_data)::smallint;
  select * into v_horario from public.horarios_funcionamento h
  where h.estabelecimento_id = v_agendamento.estabelecimento_id
    and h.dia_semana = v_dia and h.aberto = true;
  if not found or p_hora_inicio < v_horario.abre or v_hora_fim > v_horario.fecha then
    raise exception 'O novo horário está fora do funcionamento.';
  end if;
  v_inicio := (p_data + p_hora_inicio) at time zone coalesce(v_estabelecimento.timezone, 'America/Sao_Paulo');
  v_fim := (p_data + v_hora_fim) at time zone coalesce(v_estabelecimento.timezone, 'America/Sao_Paulo');
  if v_inicio <= now() then raise exception 'Escolha um horário futuro.'; end if;

  if exists (
    select 1 from public.agenda_bloqueios b
    where b.estabelecimento_id = v_agendamento.estabelecimento_id
      and (b.profissional_id is null or b.profissional_id = p_profissional_id)
      and v_inicio < b.fim and v_fim > b.inicio
  ) then raise exception 'O período escolhido está bloqueado.'; end if;

  update public.agendamentos
  set profissional_id = p_profissional_id,
      data = p_data,
      hora_inicio = p_hora_inicio,
      hora_fim = v_hora_fim,
      reagendamentos_quantidade = reagendamentos_quantidade + 1,
      confirmacao_cliente = 'pendente',
      confirmacao_estabelecimento = 'confirmada',
      estabelecimento_confirmado_em = now()
  where id = p_agendamento_id
  returning * into v_agendamento;
  return v_agendamento;
end;
$$;

create or replace function public.registrar_confirmacao_agendamento_19(
  p_agendamento_id uuid,
  p_origem text,
  p_confirmacao text
)
returns public.agendamentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agendamento public.agendamentos%rowtype;
begin
  if p_origem not in ('cliente','estabelecimento') then raise exception 'Origem inválida.'; end if;
  if p_confirmacao not in ('confirmada','recusada') then raise exception 'Confirmação inválida.'; end if;
  select * into v_agendamento from public.agendamentos where id = p_agendamento_id for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if v_agendamento.status not in ('pendente','confirmado') then raise exception 'O atendimento não aceita confirmação.'; end if;

  if p_origem = 'cliente' then
    if v_agendamento.cliente_id is distinct from (select auth.uid()) then
      raise exception 'Somente o cliente pode confirmar sua presença.';
    end if;
    update public.agendamentos
    set confirmacao_cliente = p_confirmacao,
        cliente_confirmado_em = case when p_confirmacao = 'confirmada' then now() else null end
    where id = p_agendamento_id returning * into v_agendamento;
  else
    if not private.pode_operar_estabelecimento_19(v_agendamento.estabelecimento_id) then
      raise exception 'Sua conta não pode confirmar este atendimento.';
    end if;
    if private.papel_no_estabelecimento_19(v_agendamento.estabelecimento_id) = 'profissional'
       and private.profissional_vinculado_19(v_agendamento.estabelecimento_id) <> v_agendamento.profissional_id then
      raise exception 'O profissional só pode confirmar a própria agenda.';
    end if;
    update public.agendamentos
    set confirmacao_estabelecimento = p_confirmacao,
        estabelecimento_confirmado_em = case when p_confirmacao = 'confirmada' then now() else null end
    where id = p_agendamento_id returning * into v_agendamento;
  end if;
  return v_agendamento;
end;
$$;

create or replace function public.registrar_no_show_agendamento_19(p_agendamento_id uuid)
returns public.agendamentos
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_agendamento public.agendamentos%rowtype;
begin
  select * into v_agendamento from public.agendamentos where id = p_agendamento_id for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if v_agendamento.status <> 'confirmado' then raise exception 'Apenas atendimentos confirmados podem registrar falta.'; end if;
  if now() < v_agendamento.inicio_previsto then raise exception 'A falta só pode ser registrada após o horário marcado.'; end if;
  if not private.tem_recurso_operacional_19(v_agendamento.estabelecimento_id, 'permite_agenda_avancada')
     or not private.pode_operar_estabelecimento_19(v_agendamento.estabelecimento_id) then
    raise exception 'Sua conta não pode registrar a falta.';
  end if;
  if private.papel_no_estabelecimento_19(v_agendamento.estabelecimento_id) = 'profissional'
     and private.profissional_vinculado_19(v_agendamento.estabelecimento_id) <> v_agendamento.profissional_id then
    raise exception 'O profissional só pode alterar a própria agenda.';
  end if;
  update public.agendamentos
  set status = 'faltou', no_show_em = now(), no_show_registrado_por = (select auth.uid())
  where id = p_agendamento_id returning * into v_agendamento;
  return v_agendamento;
end;
$$;

create or replace function public.vincular_membro_estabelecimento_19(
  p_estabelecimento_id uuid,
  p_email text,
  p_papel text,
  p_profissional_id uuid default null
)
returns public.estabelecimento_membros
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
  v_profissional_anterior uuid;
  v_membro public.estabelecimento_membros%rowtype;
begin
  if not private.tem_recurso_operacional_19(p_estabelecimento_id, 'permite_equipe_acesso')
     or not private.pode_operar_estabelecimento_19(
    p_estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  ) then raise exception 'Sua conta não pode gerenciar a equipe.'; end if;
  if p_papel not in ('gerente','recepcao','profissional') then raise exception 'Papel inválido.'; end if;
  if p_papel = 'profissional' and p_profissional_id is null then
    raise exception 'Vincule o papel profissional a um cadastro da equipe.';
  end if;
  select p.id into v_user_id from public.perfis p
  where lower(p.email) = lower(trim(p_email)) and p.ativo = true limit 1;
  if v_user_id is null then raise exception 'A pessoa precisa criar uma conta no Barber Hub antes do vínculo.'; end if;
  if exists (
    select 1 from public.estabelecimentos e
    where e.id = p_estabelecimento_id and e.owner_id = v_user_id
  ) then raise exception 'O proprietário já possui acesso total.'; end if;
  if p_profissional_id is not null and not exists (
    select 1 from public.profissionais p
    where p.id = p_profissional_id and p.estabelecimento_id = p_estabelecimento_id
  ) then raise exception 'Profissional não pertence ao estabelecimento.'; end if;
  if p_profissional_id is not null and exists (
    select 1 from public.profissionais p
    where p.id = p_profissional_id and p.user_id is not null and p.user_id <> v_user_id
  ) then raise exception 'O profissional já está vinculado a outra conta.'; end if;

  select m.profissional_id into v_profissional_anterior
  from public.estabelecimento_membros m
  where m.estabelecimento_id = p_estabelecimento_id and m.user_id = v_user_id;

  insert into public.estabelecimento_membros(
    estabelecimento_id, user_id, profissional_id, papel, status, convidado_por, aceito_em
  ) values (
    p_estabelecimento_id, v_user_id, p_profissional_id, p_papel, 'ativo', (select auth.uid()), now()
  )
  on conflict (estabelecimento_id, user_id) do update
  set profissional_id = excluded.profissional_id,
      papel = excluded.papel,
      status = 'ativo',
      convidado_por = (select auth.uid()),
      aceito_em = now(),
      updated_at = now()
  returning * into v_membro;

  if v_profissional_anterior is not null and v_profissional_anterior is distinct from p_profissional_id then
    update public.profissionais set user_id = null
    where id = v_profissional_anterior and user_id = v_user_id;
  end if;
  if p_profissional_id is not null then
    update public.profissionais set user_id = v_user_id where id = p_profissional_id;
  end if;
  return v_membro;
end;
$$;

revoke all on function public.reagendar_agendamento_19(uuid,uuid,date,time) from public, anon;
revoke all on function public.registrar_confirmacao_agendamento_19(uuid,text,text) from public, anon;
revoke all on function public.registrar_no_show_agendamento_19(uuid) from public, anon;
revoke all on function public.vincular_membro_estabelecimento_19(uuid,text,text,uuid) from public, anon;
grant execute on function public.reagendar_agendamento_19(uuid,uuid,date,time) to authenticated, service_role;
grant execute on function public.registrar_confirmacao_agendamento_19(uuid,text,text) to authenticated, service_role;
grant execute on function public.registrar_no_show_agendamento_19(uuid) to authenticated, service_role;
grant execute on function public.vincular_membro_estabelecimento_19(uuid,text,text,uuid) to authenticated, service_role;

-- Realtime é usado somente para refletir mudanças autorizadas pelo RLS.
do $$
begin
  if exists (select 1 from pg_publication where pubname = 'supabase_realtime')
     and not exists (
       select 1 from pg_publication_tables
       where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'agenda_bloqueios'
     ) then
    alter publication supabase_realtime add table public.agenda_bloqueios;
  end if;
end $$;

commit;
