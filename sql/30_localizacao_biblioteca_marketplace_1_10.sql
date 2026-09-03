-- Barber Hub 1.10.0: localização estruturada, biblioteca oficial e marketplace regional.
-- Execute depois de 29_operacao_real_horarios_atendimentos_1_10.sql.

begin;

alter table public.estabelecimentos
  add column if not exists latitude numeric(9,6),
  add column if not exists longitude numeric(9,6),
  add column if not exists precisao_localizacao text,
  add column if not exists codigo_municipio_ibge text,
  add column if not exists raio_atendimento_km numeric(6,2);

alter table public.estabelecimentos drop constraint if exists estabelecimentos_coordenadas_check;
alter table public.estabelecimentos add constraint estabelecimentos_coordenadas_check check (
  (latitude is null and longitude is null)
  or (latitude between -90 and 90 and longitude between -180 and 180)
);
alter table public.estabelecimentos drop constraint if exists estabelecimentos_precisao_localizacao_check;
alter table public.estabelecimentos add constraint estabelecimentos_precisao_localizacao_check check (
  precisao_localizacao is null
  or precisao_localizacao in ('endereco','logradouro','bairro','cidade','manual')
);
alter table public.estabelecimentos drop constraint if exists estabelecimentos_codigo_ibge_check;
alter table public.estabelecimentos add constraint estabelecimentos_codigo_ibge_check check (
  codigo_municipio_ibge is null or codigo_municipio_ibge ~ '^[0-9]{7}$'
);
alter table public.estabelecimentos drop constraint if exists estabelecimentos_raio_check;
alter table public.estabelecimentos add constraint estabelecimentos_raio_check check (
  raio_atendimento_km is null or raio_atendimento_km between 0 and 500
);

create index if not exists estabelecimentos_regiao_publica_idx
  on public.estabelecimentos(upper(estado), lower(cidade), lower(bairro), id)
  where visivel and onboarding_concluido and not suspenso_pela_moderacao;
create index if not exists estabelecimentos_coordenadas_publicas_idx
  on public.estabelecimentos(latitude, longitude, id)
  where latitude is not null and longitude is not null
    and visivel and onboarding_concluido and not suspenso_pela_moderacao;

create table if not exists public.biblioteca_capas (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique check (chave ~ '^[a-z0-9][a-z0-9-]{2,79}$'),
  nome text not null check (char_length(trim(nome)) between 2 and 100),
  estilo text not null check (estilo in ('classico','moderno','premium','claro','escuro')),
  url text not null check (url like '/img/library/%'),
  texto_alternativo text not null check (char_length(trim(texto_alternativo)) between 8 and 240),
  cor_dominante text check (cor_dominante is null or cor_dominante ~ '^#[0-9A-Fa-f]{6}$'),
  origem text not null default 'Barber Hub / The Gamers Tech',
  ativo boolean not null default true,
  ordem smallint not null default 0 check (ordem between 0 and 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists biblioteca_capas_updated_at on public.biblioteca_capas;
create trigger biblioteca_capas_updated_at before update on public.biblioteca_capas
for each row execute function public.set_updated_at();

insert into public.biblioteca_capas(chave,nome,estilo,url,texto_alternativo,cor_dominante,ordem)
values
  ('classico-acolhedor','Clássico acolhedor','classico','/img/library/barbershop-covers/classic-warm.webp','Interior clássico de barbearia com cadeira vazia e iluminação acolhedora.','#2A1C13',10),
  ('moderno-limpo','Moderno e limpo','moderno','/img/library/barbershop-covers/modern-clean.webp','Interior moderno de barbearia com cadeira vazia e bancada organizada.','#655D53',20),
  ('premium-escuro','Premium escuro','premium','/img/library/barbershop-covers/premium-dark.webp','Interior premium de barbearia com cadeira vazia e acabamento escuro.','#211815',30),
  ('claro-natural','Claro e natural','claro','/img/library/barbershop-covers/light-airy.webp','Interior claro de barbearia com cadeira vazia, madeira e luz natural.','#D8CFC1',40),
  ('noturno-contemporaneo','Noturno contemporâneo','escuro','/img/library/barbershop-covers/contemporary-night.webp','Interior contemporâneo escuro de barbearia com cadeira vazia e luz quente.','#171311',50)
on conflict (chave) do update set
  nome=excluded.nome, estilo=excluded.estilo, url=excluded.url,
  texto_alternativo=excluded.texto_alternativo, cor_dominante=excluded.cor_dominante,
  ordem=excluded.ordem, ativo=true;

alter table public.biblioteca_capas enable row level security;
drop policy if exists biblioteca_capas_publicas_110 on public.biblioteca_capas;
create policy biblioteca_capas_publicas_110 on public.biblioteca_capas for select
to anon, authenticated using (ativo or public.is_admin());
drop policy if exists biblioteca_capas_admin_110 on public.biblioteca_capas;
create policy biblioteca_capas_admin_110 on public.biblioteca_capas for all
to authenticated using (public.is_admin()) with check (public.is_admin());
revoke all on table public.biblioteca_capas from public, anon, authenticated;
grant select on table public.biblioteca_capas to anon, authenticated;
grant insert, update, delete on table public.biblioteca_capas to authenticated;

create or replace function private.distancia_km_110(
  p_latitude_a numeric, p_longitude_a numeric,
  p_latitude_b numeric, p_longitude_b numeric
)
returns numeric
language sql
immutable
parallel safe
set search_path = ''
as $$
  select case
    when p_latitude_a is null or p_longitude_a is null
      or p_latitude_b is null or p_longitude_b is null then null
    else round((6371 * 2 * asin(sqrt(
      power(sin(radians((p_latitude_b - p_latitude_a)::double precision) / 2), 2)
      + cos(radians(p_latitude_a::double precision))
      * cos(radians(p_latitude_b::double precision))
      * power(sin(radians((p_longitude_b - p_longitude_a)::double precision) / 2), 2)
    )))::numeric, 2)
  end;
$$;
revoke all on function private.distancia_km_110(numeric,numeric,numeric,numeric) from public, anon, authenticated;

create or replace function public.atualizar_localizacao_estabelecimento_110(
  p_estabelecimento_id uuid,
  p_endereco text,
  p_numero text,
  p_complemento text,
  p_bairro text,
  p_cidade text,
  p_estado text,
  p_cep text,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_precisao text default null,
  p_codigo_ibge text default null,
  p_raio_km numeric default null
)
returns public.estabelecimentos
language plpgsql
security definer
set search_path = ''
as $$
declare v_resultado public.estabelecimentos%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Autenticação obrigatória.'; end if;
  if not private.pode_executar_acao_193(p_estabelecimento_id,'configuracoes') then
    raise exception 'Sua conta não pode alterar a localização.';
  end if;
  if char_length(trim(coalesce(p_endereco,''))) < 2
     or char_length(trim(coalesce(p_bairro,''))) < 2
     or char_length(trim(coalesce(p_cidade,''))) < 2
     or upper(trim(coalesce(p_estado,''))) !~ '^[A-Z]{2}$'
     or regexp_replace(coalesce(p_cep,''),'[^0-9]','','g') !~ '^[0-9]{8}$' then
    raise exception 'Revise endereço, bairro, cidade, estado e CEP.';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Informe latitude e longitude juntas.';
  end if;
  update public.estabelecimentos set
    endereco=trim(p_endereco), numero=nullif(trim(coalesce(p_numero,'')),''),
    complemento=nullif(trim(coalesce(p_complemento,'')),''), bairro=trim(p_bairro),
    cidade=trim(p_cidade), estado=upper(trim(p_estado)),
    cep=regexp_replace(p_cep,'[^0-9]','','g'), latitude=p_latitude,
    longitude=p_longitude, precisao_localizacao=p_precisao,
    codigo_municipio_ibge=p_codigo_ibge, raio_atendimento_km=p_raio_km
  where id=p_estabelecimento_id returning * into v_resultado;
  if not found then raise exception 'Estabelecimento não encontrado.'; end if;
  return v_resultado;
end;
$$;
revoke all on function public.atualizar_localizacao_estabelecimento_110(uuid,text,text,text,text,text,text,text,numeric,numeric,text,text,numeric) from public, anon;
grant execute on function public.atualizar_localizacao_estabelecimento_110(uuid,text,text,text,text,text,text,text,numeric,numeric,text,text,numeric) to authenticated, service_role;

create or replace function public.buscar_marketplace_regional_110(
  p_busca text default null,
  p_cidade text default null,
  p_bairro text default null,
  p_estado text default null,
  p_aberto_agora boolean default false,
  p_com_agenda boolean default false,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_raio_km numeric default null,
  p_offset integer default 0,
  p_limite integer default 24
)
returns table (
  id uuid, nome text, slug text, descricao text, cidade text, estado char(2), bairro text,
  endereco text, numero text, foto_url text, capa_url text, avaliacao numeric,
  aceita_agendamento boolean, verificado boolean, destaque boolean,
  latitude numeric, longitude numeric, distancia_km numeric, aberto boolean, total_resultados bigint
)
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_limite < 1 or p_limite > 60 or p_offset < 0 or p_offset > 10000 then
    raise exception 'Paginação inválida.';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'Informe latitude e longitude juntas.';
  end if;
  if p_raio_km is not null and (p_raio_km <= 0 or p_raio_km > 500) then
    raise exception 'Escolha um raio entre 1 e 500 km.';
  end if;

  return query
  with base as (
    select e.*,
      private.distancia_km_110(p_latitude,p_longitude,e.latitude,e.longitude) as distancia,
      public.estabelecimento_aberto_agora(e.id) as esta_aberto
    from public.estabelecimentos e
    where e.visivel and e.onboarding_concluido and not e.suspenso_pela_moderacao
      and e.tipo_estabelecimento='barbearia'
      and (nullif(trim(coalesce(p_cidade,'')),'') is null or e.cidade ilike trim(p_cidade))
      and (nullif(trim(coalesce(p_bairro,'')),'') is null or e.bairro ilike trim(p_bairro))
      and (nullif(trim(coalesce(p_estado,'')),'') is null or e.estado=upper(trim(p_estado)))
      and (not p_com_agenda or e.aceita_agendamento)
      and (
        nullif(trim(coalesce(p_busca,'')),'') is null
        or e.nome ilike '%'||trim(p_busca)||'%'
        or e.cidade ilike '%'||trim(p_busca)||'%'
        or e.bairro ilike '%'||trim(p_busca)||'%'
        or e.descricao ilike '%'||trim(p_busca)||'%'
        or exists (
          select 1 from public.servicos s
          where s.estabelecimento_id=e.id and s.ativo and s.publico
            and s.nome ilike '%'||trim(p_busca)||'%'
        )
      )
  ), filtrada as (
    select b.*, count(*) over() as total
    from base b
    where (not p_aberto_agora or b.esta_aberto)
      and (p_raio_km is null or b.distancia is not null and b.distancia <= p_raio_km)
  )
  select f.id,f.nome,f.slug,f.descricao,f.cidade,f.estado,f.bairro,f.endereco,f.numero,
    f.foto_url,f.capa_url,f.avaliacao,f.aceita_agendamento,f.verificado,f.destaque,
    f.latitude,f.longitude,f.distancia,f.esta_aberto,f.total
  from filtrada f
  order by
    case when p_latitude is not null then f.distancia end asc nulls last,
    f.destaque desc, f.avaliacao desc, f.nome asc, f.id asc
  offset p_offset limit p_limite;
end;
$$;
revoke all on function public.buscar_marketplace_regional_110(text,text,text,text,boolean,boolean,numeric,numeric,numeric,integer,integer) from public;
grant execute on function public.buscar_marketplace_regional_110(text,text,text,text,boolean,boolean,numeric,numeric,numeric,integer,integer) to anon, authenticated, service_role;

commit;
