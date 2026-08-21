-- Barber Hub 1.9.0: CRM persistente por estabelecimento.
-- Execute depois de 18_agenda_equipe_operacional_1_9.sql.

begin;

create table if not exists public.clientes_estabelecimento (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  cliente_id uuid references public.perfis(id) on delete set null,
  nome text not null,
  email text,
  email_normalizado text,
  telefone text,
  preferencias text,
  tags text[] not null default '{}'::text[],
  permite_whatsapp boolean not null default false,
  total_agendamentos integer not null default 0 check (total_agendamentos >= 0),
  visitas_concluidas integer not null default 0 check (visitas_concluidas >= 0),
  cancelamentos integer not null default 0 check (cancelamentos >= 0),
  faltas integer not null default 0 check (faltas >= 0),
  gasto_total numeric(12,2) not null default 0 check (gasto_total >= 0),
  primeira_visita_em timestamptz,
  ultima_visita_em timestamptz,
  proxima_visita_em timestamptz,
  profissional_preferido_id uuid references public.profissionais(id) on delete set null,
  servico_preferido_id uuid references public.servicos(id) on delete set null,
  segmento text not null default 'novo'
    check (segmento in ('lead','novo','recorrente','em_risco','inativo')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create unique index if not exists clientes_estabelecimento_cliente_unique_idx
  on public.clientes_estabelecimento(estabelecimento_id, cliente_id)
  where cliente_id is not null;
create unique index if not exists clientes_estabelecimento_email_avulso_unique_idx
  on public.clientes_estabelecimento(estabelecimento_id, email_normalizado)
  where cliente_id is null and email_normalizado is not null;
create index if not exists clientes_estabelecimento_segmento_ultima_idx
  on public.clientes_estabelecimento(estabelecimento_id, segmento, ultima_visita_em desc, id);
create index if not exists clientes_estabelecimento_nome_idx
  on public.clientes_estabelecimento(estabelecimento_id, lower(nome));
create index if not exists clientes_estabelecimento_profissional_idx
  on public.clientes_estabelecimento(profissional_preferido_id)
  where profissional_preferido_id is not null;
create index if not exists clientes_estabelecimento_servico_idx
  on public.clientes_estabelecimento(servico_preferido_id)
  where servico_preferido_id is not null;

drop trigger if exists clientes_estabelecimento_updated_at on public.clientes_estabelecimento;
create trigger clientes_estabelecimento_updated_at
before update on public.clientes_estabelecimento
for each row execute function public.set_updated_at();

create table if not exists public.cliente_notas (
  id uuid primary key default gen_random_uuid(),
  relacionamento_id uuid not null references public.clientes_estabelecimento(id) on delete cascade,
  autor_id uuid not null references public.perfis(id) on delete restrict,
  conteudo text not null check (char_length(trim(conteudo)) between 2 and 2000),
  arquivada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists cliente_notas_relacionamento_created_idx
  on public.cliente_notas(relacionamento_id, created_at desc, id);
create index if not exists cliente_notas_autor_idx on public.cliente_notas(autor_id);

drop trigger if exists cliente_notas_updated_at on public.cliente_notas;
create trigger cliente_notas_updated_at
before update on public.cliente_notas
for each row execute function public.set_updated_at();

alter table public.clientes_estabelecimento enable row level security;
alter table public.cliente_notas enable row level security;

drop policy if exists crm_select_equipe on public.clientes_estabelecimento;
create policy crm_select_equipe on public.clientes_estabelecimento
for select to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_crm')
  and private.pode_operar_estabelecimento_19(estabelecimento_id)
);

drop policy if exists crm_update_equipe on public.clientes_estabelecimento;
create policy crm_update_equipe on public.clientes_estabelecimento
for update to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_crm')
  and private.pode_operar_estabelecimento_19(estabelecimento_id)
)
with check (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_crm')
  and private.pode_operar_estabelecimento_19(estabelecimento_id)
);

drop policy if exists cliente_notas_select_equipe on public.cliente_notas;
create policy cliente_notas_select_equipe on public.cliente_notas
for select to authenticated
using (
  exists (
    select 1 from public.clientes_estabelecimento c
    where c.id = relacionamento_id
      and private.pode_operar_estabelecimento_19(c.estabelecimento_id)
  )
);

drop policy if exists cliente_notas_insert_equipe on public.cliente_notas;
create policy cliente_notas_insert_equipe on public.cliente_notas
for insert to authenticated
with check (
  autor_id = (select auth.uid())
  and exists (
    select 1 from public.clientes_estabelecimento c
    where c.id = relacionamento_id
      and private.pode_operar_estabelecimento_19(c.estabelecimento_id)
  )
);

drop policy if exists cliente_notas_update_autor_gestao on public.cliente_notas;
create policy cliente_notas_update_autor_gestao on public.cliente_notas
for update to authenticated
using (
  autor_id = (select auth.uid())
  or exists (
    select 1 from public.clientes_estabelecimento c
    where c.id = relacionamento_id
      and private.pode_operar_estabelecimento_19(
        c.estabelecimento_id,
        array['proprietario','gerente','admin']::text[]
      )
  )
)
with check (
  autor_id = (select auth.uid())
  or exists (
    select 1 from public.clientes_estabelecimento c
    where c.id = relacionamento_id
      and private.pode_operar_estabelecimento_19(
        c.estabelecimento_id,
        array['proprietario','gerente','admin']::text[]
      )
  )
);

grant select, update on public.clientes_estabelecimento to authenticated;
grant select, insert, update on public.cliente_notas to authenticated;

-- Recalcula a ficha a partir dos agendamentos. A recomputação torna o gatilho
-- idempotente e evita contagem dupla em reprocessamentos ou mudanças de status.
create or replace function public.recalcular_cliente_crm_19(
  p_estabelecimento_id uuid,
  p_cliente_id uuid,
  p_email text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email_normalizado text := nullif(lower(trim(coalesce(p_email, ''))), '');
  v_relacionamento_id uuid;
  v_nome text;
  v_email text;
  v_telefone text;
  v_total integer;
  v_concluidas integer;
  v_cancelamentos integer;
  v_faltas integer;
  v_gasto numeric(12,2);
  v_primeira timestamptz;
  v_ultima timestamptz;
  v_proxima timestamptz;
  v_profissional uuid;
  v_servico uuid;
  v_segmento text;
begin
  if p_cliente_id is null and v_email_normalizado is null then return null; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_estabelecimento_id::text || ':' || coalesce(p_cliente_id::text, v_email_normalizado), 0));

  select a.cliente_nome, a.cliente_email, a.cliente_telefone
  into v_nome, v_email, v_telefone
  from public.agendamentos a
  where a.estabelecimento_id = p_estabelecimento_id
    and (
      (p_cliente_id is not null and a.cliente_id = p_cliente_id)
      or (p_cliente_id is null and lower(a.cliente_email) = v_email_normalizado)
    )
  order by a.created_at desc
  limit 1;
  if not found then return null; end if;
  if lower(coalesce(v_email, '')) like '%@barberhub.local' then
    v_email := null;
  end if;

  select
    count(*)::integer,
    count(*) filter (where a.status = 'concluido')::integer,
    count(*) filter (where a.status = 'cancelado')::integer,
    count(*) filter (where a.status = 'faltou')::integer,
    coalesce(sum(a.valor) filter (where a.status = 'concluido'), 0)::numeric(12,2),
    min(a.inicio_previsto) filter (where a.status = 'concluido'),
    max(a.inicio_previsto) filter (where a.status = 'concluido'),
    min(a.inicio_previsto) filter (where a.status in ('pendente','confirmado') and a.inicio_previsto >= now())
  into v_total, v_concluidas, v_cancelamentos, v_faltas, v_gasto, v_primeira, v_ultima, v_proxima
  from public.agendamentos a
  where a.estabelecimento_id = p_estabelecimento_id
    and (
      (p_cliente_id is not null and a.cliente_id = p_cliente_id)
      or (p_cliente_id is null and lower(a.cliente_email) = v_email_normalizado)
    );

  select a.profissional_id into v_profissional
  from public.agendamentos a
  where a.estabelecimento_id = p_estabelecimento_id
    and a.status = 'concluido'
    and (
      (p_cliente_id is not null and a.cliente_id = p_cliente_id)
      or (p_cliente_id is null and lower(a.cliente_email) = v_email_normalizado)
    )
  group by a.profissional_id
  order by count(*) desc, max(a.inicio_previsto) desc
  limit 1;

  select a.servico_id into v_servico
  from public.agendamentos a
  where a.estabelecimento_id = p_estabelecimento_id
    and a.status = 'concluido'
    and (
      (p_cliente_id is not null and a.cliente_id = p_cliente_id)
      or (p_cliente_id is null and lower(a.cliente_email) = v_email_normalizado)
    )
  group by a.servico_id
  order by count(*) desc, max(a.inicio_previsto) desc
  limit 1;

  v_segmento := case
    when v_concluidas = 0 then 'lead'
    when v_ultima < now() - interval '90 days' then 'inativo'
    when v_ultima < now() - interval '45 days' then 'em_risco'
    when v_concluidas >= 2 then 'recorrente'
    else 'novo'
  end;

  select c.id into v_relacionamento_id
  from public.clientes_estabelecimento c
  where c.estabelecimento_id = p_estabelecimento_id
    and (
      (p_cliente_id is not null and c.cliente_id = p_cliente_id)
      or (p_cliente_id is null and c.cliente_id is null and c.email_normalizado = v_email_normalizado)
    )
  limit 1;

  if v_relacionamento_id is null then
    insert into public.clientes_estabelecimento(
      estabelecimento_id, cliente_id, nome, email, email_normalizado, telefone,
      total_agendamentos, visitas_concluidas, cancelamentos, faltas, gasto_total,
      primeira_visita_em, ultima_visita_em, proxima_visita_em,
      profissional_preferido_id, servico_preferido_id, segmento
    ) values (
      p_estabelecimento_id, p_cliente_id, coalesce(v_nome, 'Cliente'), v_email,
      v_email_normalizado, v_telefone, v_total, v_concluidas, v_cancelamentos,
      v_faltas, v_gasto, v_primeira, v_ultima, v_proxima, v_profissional, v_servico, v_segmento
    ) returning id into v_relacionamento_id;
  else
    update public.clientes_estabelecimento
    set nome = coalesce(v_nome, nome),
        email = coalesce(v_email, email),
        email_normalizado = coalesce(v_email_normalizado, email_normalizado),
        telefone = coalesce(v_telefone, telefone),
        total_agendamentos = v_total,
        visitas_concluidas = v_concluidas,
        cancelamentos = v_cancelamentos,
        faltas = v_faltas,
        gasto_total = v_gasto,
        primeira_visita_em = v_primeira,
        ultima_visita_em = v_ultima,
        proxima_visita_em = v_proxima,
        profissional_preferido_id = v_profissional,
        servico_preferido_id = v_servico,
        segmento = v_segmento,
        updated_at = now()
    where id = v_relacionamento_id;
  end if;
  return v_relacionamento_id;
end;
$$;

create or replace function public.sincronizar_cliente_crm_agendamento_19()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform public.recalcular_cliente_crm_19(new.estabelecimento_id, new.cliente_id, new.cliente_email);
  if tg_op = 'UPDATE' and (
    old.cliente_id is distinct from new.cliente_id
    or lower(old.cliente_email) is distinct from lower(new.cliente_email)
  ) then
    perform public.recalcular_cliente_crm_19(old.estabelecimento_id, old.cliente_id, old.cliente_email);
  end if;
  return new;
end;
$$;

drop trigger if exists agendamentos_sincronizar_crm_19 on public.agendamentos;
create trigger agendamentos_sincronizar_crm_19
after insert or update of status, cliente_id, cliente_nome, cliente_email, cliente_telefone,
  valor, data, hora_inicio, profissional_id, servico_id
on public.agendamentos
for each row execute function public.sincronizar_cliente_crm_agendamento_19();

-- Backfill seguro dos relacionamentos existentes.
do $$
declare v_identidade record;
begin
  for v_identidade in
    select distinct a.estabelecimento_id, a.cliente_id, lower(a.cliente_email) as email
    from public.agendamentos a
  loop
    perform public.recalcular_cliente_crm_19(
      v_identidade.estabelecimento_id,
      v_identidade.cliente_id,
      v_identidade.email
    );
  end loop;
end $$;

create or replace function public.listar_clientes_crm_19(
  p_estabelecimento_id uuid,
  p_busca text default null,
  p_segmento text default null,
  p_cursor_ultima timestamptz default null,
  p_cursor_id uuid default null,
  p_limite integer default 30
)
returns table (
  id uuid,
  cliente_id uuid,
  nome text,
  email text,
  telefone text,
  segmento text,
  total_agendamentos integer,
  visitas_concluidas integer,
  cancelamentos integer,
  faltas integer,
  gasto_total numeric,
  ticket_medio numeric,
  ultima_visita_em timestamptz,
  proxima_visita_em timestamptz,
  profissional_preferido text,
  servico_preferido text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.tem_recurso_operacional_19(p_estabelecimento_id, 'permite_crm')
     or not private.pode_operar_estabelecimento_19(p_estabelecimento_id) then
    raise exception 'Sua conta não pode acessar este CRM.';
  end if;
  return query
  select
    c.id, c.cliente_id, c.nome, c.email, c.telefone, c.segmento,
    c.total_agendamentos, c.visitas_concluidas, c.cancelamentos, c.faltas,
    c.gasto_total,
    case when c.visitas_concluidas > 0 then round(c.gasto_total / c.visitas_concluidas, 2) else 0 end,
    c.ultima_visita_em, c.proxima_visita_em, p.nome, s.nome
  from public.clientes_estabelecimento c
  left join public.profissionais p on p.id = c.profissional_preferido_id
  left join public.servicos s on s.id = c.servico_preferido_id
  where c.estabelecimento_id = p_estabelecimento_id
    and (p_segmento is null or p_segmento = '' or c.segmento = p_segmento)
    and (
      p_busca is null or trim(p_busca) = ''
      or c.nome ilike '%' || trim(p_busca) || '%'
      or coalesce(c.email, '') ilike '%' || trim(p_busca) || '%'
      or coalesce(c.telefone, '') ilike '%' || trim(p_busca) || '%'
    )
    and (
      p_cursor_ultima is null
      or (coalesce(c.ultima_visita_em, '-infinity'::timestamptz), c.id)
         < (p_cursor_ultima, coalesce(p_cursor_id, 'ffffffff-ffff-ffff-ffff-ffffffffffff'::uuid))
    )
  order by c.ultima_visita_em desc nulls last, c.id desc
  limit greatest(1, least(coalesce(p_limite, 30), 60));
end;
$$;

revoke all on function public.recalcular_cliente_crm_19(uuid,uuid,text) from public, anon, authenticated;
revoke all on function public.sincronizar_cliente_crm_agendamento_19() from public, anon, authenticated;
revoke all on function public.listar_clientes_crm_19(uuid,text,text,timestamptz,uuid,integer) from public, anon;
grant execute on function public.listar_clientes_crm_19(uuid,text,text,timestamptz,uuid,integer)
  to authenticated, service_role;

commit;
