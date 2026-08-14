-- Barber Hub 1.6.0
-- Marketplace: busca FTS + paginação + ranking + rate limiting da API.
-- Execute após a migration 14.

begin;

-- ============================================================
-- 1. FULL TEXT SEARCH
-- ============================================================

alter table public.estabelecimentos
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('portuguese', coalesce(nome, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(cidade, '') || ' ' || coalesce(bairro, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(descricao, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(nome, '') || ' ' || coalesce(cidade, '') || ' ' || coalesce(bairro, '')), 'B')
  ) stored;

alter table public.servicos
  add column if not exists search_vector tsvector generated always as (
    setweight(to_tsvector('portuguese', coalesce(nome, '')), 'A') ||
    setweight(to_tsvector('portuguese', coalesce(categoria, '') || ' ' || coalesce(descricao, '')), 'B') ||
    setweight(to_tsvector('simple', coalesce(nome, '') || ' ' || coalesce(categoria, '')), 'B')
  ) stored;

create index if not exists estabelecimentos_search_vector_idx
  on public.estabelecimentos using gin(search_vector);

create index if not exists servicos_search_vector_idx
  on public.servicos using gin(search_vector);

create index if not exists estabelecimentos_marketplace_rank_idx
  on public.estabelecimentos(destaque desc, avaliacao desc, created_at desc)
  where visivel = true and onboarding_concluido = true;

-- ============================================================
-- 2. STATUS ABERTO/FECHADO NO SERVIDOR
--    Usado para filtros do marketplace sem carregar todo o catálogo.
-- ============================================================

create or replace function public.estabelecimento_aberto_agora(p_estabelecimento_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_est public.estabelecimentos%rowtype;
  v_agora timestamp without time zone := timezone('America/Sao_Paulo', now());
  v_dia smallint;
  v_hora time;
  v_horario public.horarios_funcionamento%rowtype;
begin
  select * into v_est
  from public.estabelecimentos
  where id = p_estabelecimento_id;

  if not found or not v_est.visivel or not v_est.onboarding_concluido then
    return false;
  end if;

  if v_est.status_manual = 'aberto' then
    return true;
  elsif v_est.status_manual = 'fechado' then
    return false;
  end if;

  if exists (
    select 1
    from public.dias_bloqueados d
    where d.estabelecimento_id = p_estabelecimento_id
      and d.data = v_agora::date
  ) then
    return false;
  end if;

  v_dia := extract(dow from v_agora)::smallint;
  v_hora := v_agora::time;

  select * into v_horario
  from public.horarios_funcionamento h
  where h.estabelecimento_id = p_estabelecimento_id
    and h.dia_semana = v_dia
    and h.aberto = true
  limit 1;

  if not found or v_horario.abre is null or v_horario.fecha is null then
    return false;
  end if;

  return v_hora >= v_horario.abre and v_hora < v_horario.fecha;
end;
$$;

revoke all on function public.estabelecimento_aberto_agora(uuid) from public;
grant execute on function public.estabelecimento_aberto_agora(uuid) to anon, authenticated, service_role;

-- ============================================================
-- 3. BUSCA PAGINADA DO MARKETPLACE
--    FTS é a via principal. ILIKE permanece como fallback para prefixos,
--    termos curtos e buscas que não geram um tsquery útil.
-- ============================================================

create or replace function public.buscar_marketplace(
  p_busca text default null,
  p_tipo text default null,
  p_agenda boolean default null,
  p_status text default null,
  p_offset integer default 0,
  p_limit integer default 24,
  p_somente_destaques boolean default false
)
returns table (
  id uuid,
  relevancia real,
  aberto_agora boolean,
  total bigint
)
language sql
stable
security definer
set search_path = public
as $$
  with parametros as (
    select
      nullif(trim(coalesce(p_busca, '')), '') as termo,
      greatest(coalesce(p_offset, 0), 0) as deslocamento,
      least(greatest(coalesce(p_limit, 24), 1), 60) as limite
  ),
  consulta as (
    select
      termo,
      case
        when termo is null then null::tsquery
        else websearch_to_tsquery('portuguese', termo)
      end as q_pt,
      case
        when termo is null then null::tsquery
        else websearch_to_tsquery('simple', termo)
      end as q_simple,
      deslocamento,
      limite
    from parametros
  ),
  base as (
    select
      e.id,
      e.destaque,
      e.avaliacao,
      e.created_at,
      (
        case
          when c.termo is null then 0
          else greatest(
            ts_rank_cd(e.search_vector, c.q_pt),
            ts_rank_cd(e.search_vector, c.q_simple)
          )
        end
        + coalesce((
          select max(greatest(
            ts_rank_cd(s.search_vector, c.q_pt),
            ts_rank_cd(s.search_vector, c.q_simple)
          ))
          from public.servicos s
          where s.estabelecimento_id = e.id
            and s.ativo = true
            and s.publico = true
            and c.termo is not null
            and (s.search_vector @@ c.q_pt or s.search_vector @@ c.q_simple)
        ), 0)
        + case when e.destaque then 0.22 else 0 end
        + case when e.aceita_agendamento then 0.04 else 0 end
        + (coalesce(e.avaliacao, 0)::real * 0.012)
      )::real as relevancia
    from public.estabelecimentos e
    cross join consulta c
    where e.visivel = true
      and e.onboarding_concluido = true
      and (p_tipo is null or p_tipo = '' or p_tipo = 'todos' or e.tipo_estabelecimento = p_tipo)
      and (p_agenda is null or e.aceita_agendamento = p_agenda)
      and (not p_somente_destaques or e.destaque = true)
      and (
        c.termo is null
        or e.search_vector @@ c.q_pt
        or e.search_vector @@ c.q_simple
        or exists (
          select 1
          from public.servicos s
          where s.estabelecimento_id = e.id
            and s.ativo = true
            and s.publico = true
            and (s.search_vector @@ c.q_pt or s.search_vector @@ c.q_simple)
        )
        -- Fallback deliberado: útil para prefixos e pesquisas muito curtas.
        or e.nome ilike '%' || c.termo || '%'
        or e.cidade ilike '%' || c.termo || '%'
        or e.bairro ilike '%' || c.termo || '%'
        or exists (
          select 1
          from public.servicos s
          where s.estabelecimento_id = e.id
            and s.ativo = true
            and s.publico = true
            and (s.nome ilike '%' || c.termo || '%' or s.categoria ilike '%' || c.termo || '%')
        )
      )
  ),
  filtrado as (
    -- O cálculo de aberto/fechado só percorre todo o conjunto quando o usuário
    -- realmente filtra por status. Sem esse filtro, ele é calculado apenas nos
    -- registros da página final, evitando N consultas extras em catálogos grandes.
    select b.*
    from base b
    where p_status is null or p_status = '' or p_status = 'todos'
       or (p_status = 'aberta' and public.estabelecimento_aberto_agora(b.id))
       or (p_status = 'fechada' and not public.estabelecimento_aberto_agora(b.id))
  ),
  contado as (
    select f.*, count(*) over() as total
    from filtrado f
  ),
  paginado as (
    select ctd.*
    from contado ctd
    order by ctd.destaque desc, ctd.relevancia desc, ctd.avaliacao desc, ctd.created_at desc
    offset (select deslocamento from consulta)
    limit (select limite from consulta)
  )
  select
    p.id,
    p.relevancia,
    public.estabelecimento_aberto_agora(p.id) as aberto_agora,
    p.total
  from paginado p
  order by p.destaque desc, p.relevancia desc, p.avaliacao desc, p.created_at desc;
$$;

revoke all on function public.buscar_marketplace(text,text,boolean,text,integer,integer,boolean) from public;
grant execute on function public.buscar_marketplace(text,text,boolean,text,integer,integer,boolean) to anon, authenticated, service_role;

-- ============================================================
-- 4. RATE LIMITING CENTRAL DA API
--    O navegador não possui acesso a esta tabela/função. Apenas service_role.
-- ============================================================

create table if not exists public.api_rate_limits (
  chave text primary key,
  janela_inicio timestamptz not null default now(),
  contador integer not null default 0 check (contador >= 0),
  updated_at timestamptz not null default now()
);

alter table public.api_rate_limits enable row level security;
revoke all on table public.api_rate_limits from anon, authenticated;
grant select, insert, update, delete on table public.api_rate_limits to service_role;

create or replace function public.consumir_api_rate_limit(
  p_chave text,
  p_janela_segundos integer,
  p_limite integer
)
returns table (
  permitido boolean,
  restante integer,
  retry_after integer
)
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agora timestamptz := now();
  v_row public.api_rate_limits%rowtype;
  v_janela interval := make_interval(secs => greatest(p_janela_segundos, 1));
begin
  if p_chave is null or length(trim(p_chave)) < 3 then
    raise exception 'Chave de rate limit inválida.';
  end if;

  insert into public.api_rate_limits(chave, janela_inicio, contador, updated_at)
  values (p_chave, v_agora, 1, v_agora)
  on conflict (chave) do update
  set
    janela_inicio = case
      when public.api_rate_limits.janela_inicio + v_janela <= v_agora then v_agora
      else public.api_rate_limits.janela_inicio
    end,
    contador = case
      when public.api_rate_limits.janela_inicio + v_janela <= v_agora then 1
      else public.api_rate_limits.contador + 1
    end,
    updated_at = v_agora
  returning * into v_row;

  permitido := v_row.contador <= greatest(p_limite, 1);
  restante := greatest(greatest(p_limite, 1) - v_row.contador, 0);
  retry_after := greatest(
    ceil(extract(epoch from ((v_row.janela_inicio + v_janela) - v_agora)))::integer,
    0
  );
  return next;
end;
$$;

revoke all on function public.consumir_api_rate_limit(text,integer,integer) from public, anon, authenticated;
grant execute on function public.consumir_api_rate_limit(text,integer,integer) to service_role;

-- Limpeza de registros antigos pode ser executada por rotina administrativa.
create index if not exists api_rate_limits_updated_idx on public.api_rate_limits(updated_at);

-- ============================================================
-- 5. AUDITORIA ADMINISTRATIVA MÍNIMA
-- ============================================================

create table if not exists public.auditoria_admin (
  id bigint generated always as identity primary key,
  admin_id uuid references public.perfis(id) on delete set null,
  acao text not null,
  alvo_tipo text,
  alvo_id text,
  detalhes jsonb not null default '{}'::jsonb,
  request_id text,
  created_at timestamptz not null default now()
);

alter table public.auditoria_admin enable row level security;
revoke all on table public.auditoria_admin from anon, authenticated;
grant select on table public.auditoria_admin to authenticated;
grant select, insert, update, delete on table public.auditoria_admin to service_role;

drop policy if exists "Admins leem auditoria" on public.auditoria_admin;
create policy "Admins leem auditoria"
on public.auditoria_admin
for select
to authenticated
using (public.is_admin());

do $$
begin
  if to_regclass('public.auditoria_admin_id_seq') is not null then
    execute 'grant usage, select on sequence public.auditoria_admin_id_seq to service_role';
  end if;
end $$;

create index if not exists auditoria_admin_created_idx on public.auditoria_admin(created_at desc);
create index if not exists auditoria_admin_admin_idx on public.auditoria_admin(admin_id, created_at desc);

commit;
