-- ============================================================
-- BARBER HUB - BANCO COMPLETO PARA SUPABASE
-- Execute este arquivo inteiro no SQL Editor de um projeto novo.
-- ============================================================

create extension if not exists pgcrypto;
create extension if not exists unaccent;
create extension if not exists btree_gist;

-- Limpeza segura para permitir reinstalação durante o desenvolvimento.
drop trigger if exists on_auth_user_created on auth.users;

drop table if exists public.favoritos cascade;
drop table if exists public.tickets_suporte cascade;
drop table if exists public.promocoes cascade;
drop table if exists public.agendamentos cascade;
drop table if exists public.profissional_servicos cascade;
drop table if exists public.servicos cascade;
drop table if exists public.profissionais cascade;
drop table if exists public.dias_bloqueados cascade;
drop table if exists public.horarios_funcionamento cascade;
drop table if exists public.estabelecimentos cascade;
drop table if exists public.perfis cascade;

drop function if exists public.metricas_publicas();
drop function if exists public.horarios_ocupados(uuid,date);
drop function if exists public.cancelar_agendamento(uuid,text);
drop function if exists public.criar_agendamento(uuid,uuid,uuid,date,time,text);
drop function if exists public.criar_estabelecimento_inicial(text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,jsonb,jsonb,text,text,text,text);
drop function if exists public.owns_estabelecimento(uuid);
drop function if exists public.is_admin();
drop function if exists public.handle_new_user();
drop function if exists public.set_updated_at();
drop function if exists public.slugify(text);

-- ============================================================
-- FUNÇÕES GERAIS
-- ============================================================

create or replace function public.set_updated_at()
returns trigger
language plpgsql
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

create or replace function public.slugify(valor text)
returns text
language sql
immutable
strict
set search_path = public
as $$
  select trim(both '-' from regexp_replace(lower(unaccent(valor)), '[^a-z0-9]+', '-', 'g'));
$$;

-- ============================================================
-- PERFIS E AUTENTICAÇÃO
-- ============================================================

create table public.perfis (
  id uuid primary key references auth.users(id) on delete cascade,
  nome text not null,
  email text not null,
  telefone text,
  tipo text not null default 'cliente' check (tipo in ('cliente','barbeiro','admin')),
  avatar_url text,
  onboarding_concluido boolean not null default false,
  acessibilidade jsonb not null default '{"fonte":"normal","alto_contraste":false,"reduzir_movimento":false}'::jsonb,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger perfis_updated_at
before update on public.perfis
for each row execute function public.set_updated_at();

create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_tipo text;
begin
  v_tipo := case
    when new.raw_user_meta_data ->> 'tipo' = 'barbeiro' then 'barbeiro'
    else 'cliente'
  end;

  insert into public.perfis (id, nome, email, telefone, tipo, onboarding_concluido)
  values (
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    new.email,
    nullif(trim(new.raw_user_meta_data ->> 'telefone'), ''),
    v_tipo,
    v_tipo = 'cliente'
  );
  return new;
end;
$$;

create trigger on_auth_user_created
after insert on auth.users
for each row execute function public.handle_new_user();

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.perfis
    where id = auth.uid() and tipo = 'admin' and ativo = true
  );
$$;

-- ============================================================
-- ESTABELECIMENTOS
-- tipo_estabelecimento já prepara Barber Hub + futura Beauty Hub.
-- ============================================================

create table public.estabelecimentos (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null unique references public.perfis(id) on delete cascade,
  tipo_estabelecimento text not null default 'barbearia' check (tipo_estabelecimento in ('barbearia','salao')),
  nome text not null,
  slug text not null unique,
  descricao text not null default '',
  email_publico text,
  telefone text,
  whatsapp text,
  instagram text,
  website text,
  cep text,
  cidade text not null,
  estado char(2) not null default 'MG',
  bairro text not null,
  endereco text not null,
  numero text,
  complemento text,
  foto_url text,
  capa_url text,
  status_manual text not null default 'automatico' check (status_manual in ('automatico','aberto','fechado')),
  motivo_status text,
  aceita_agendamento boolean not null default true,
  visivel boolean not null default true,
  onboarding_concluido boolean not null default false,
  avaliacao numeric(2,1) not null default 5.0 check (avaliacao between 0 and 5),
  intervalo_slots_min integer not null default 30 check (intervalo_slots_min between 10 and 180),
  antecedencia_min_horas integer not null default 1 check (antecedencia_min_horas between 0 and 168),
  limite_dias_agendamento integer not null default 30 check (limite_dias_agendamento between 1 and 365),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index estabelecimentos_tipo_idx on public.estabelecimentos(tipo_estabelecimento);
create index estabelecimentos_local_idx on public.estabelecimentos(cidade,bairro);
create index estabelecimentos_visivel_idx on public.estabelecimentos(visivel,onboarding_concluido);

create trigger estabelecimentos_updated_at
before update on public.estabelecimentos
for each row execute function public.set_updated_at();

create or replace function public.owns_estabelecimento(p_estabelecimento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select exists (
    select 1 from public.estabelecimentos
    where id = p_estabelecimento_id and owner_id = auth.uid()
  );
$$;

create table public.horarios_funcionamento (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  dia_semana smallint not null check (dia_semana between 0 and 6),
  aberto boolean not null default true,
  abre time,
  fecha time,
  intervalo_inicio time,
  intervalo_fim time,
  created_at timestamptz not null default now(),
  unique(estabelecimento_id,dia_semana),
  check (
    aberto = false
    or (abre is not null and fecha is not null and abre < fecha)
  )
);

create table public.dias_bloqueados (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  data date not null,
  motivo text,
  created_at timestamptz not null default now(),
  unique(estabelecimento_id,data)
);

create table public.profissionais (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  user_id uuid references public.perfis(id) on delete set null,
  nome text not null,
  email text,
  telefone text,
  especialidade text,
  bio text,
  avatar_url text,
  ativo boolean not null default true,
  aceita_agendamento boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index profissionais_estabelecimento_idx on public.profissionais(estabelecimento_id,ativo);
create trigger profissionais_updated_at
before update on public.profissionais
for each row execute function public.set_updated_at();

create table public.servicos (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  nome text not null,
  categoria text not null default 'Serviço',
  descricao text not null default '',
  preco numeric(10,2) not null check (preco >= 0),
  duracao_min integer not null check (duracao_min between 5 and 480),
  ativo boolean not null default true,
  publico boolean not null default true,
  destaque boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index servicos_estabelecimento_idx on public.servicos(estabelecimento_id,ativo);
create trigger servicos_updated_at
before update on public.servicos
for each row execute function public.set_updated_at();

create table public.profissional_servicos (
  profissional_id uuid not null references public.profissionais(id) on delete cascade,
  servico_id uuid not null references public.servicos(id) on delete cascade,
  primary key(profissional_id,servico_id)
);

create table public.agendamentos (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  profissional_id uuid not null references public.profissionais(id) on delete restrict,
  servico_id uuid not null references public.servicos(id) on delete restrict,
  cliente_id uuid not null references public.perfis(id) on delete restrict,
  cliente_nome text not null,
  cliente_email text not null,
  cliente_telefone text,
  data date not null,
  hora_inicio time not null,
  hora_fim time not null,
  status text not null default 'pendente' check (status in ('pendente','confirmado','concluido','cancelado','recusado')),
  observacao text,
  valor numeric(10,2) not null default 0,
  pagamento_status text not null default 'nao_disponivel' check (pagamento_status in ('nao_disponivel','pendente','pago','estornado')),
  cancelamento_motivo text,
  origem text not null default 'web',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (hora_inicio < hora_fim)
);

create index agendamentos_cliente_idx on public.agendamentos(cliente_id,data);
create index agendamentos_estabelecimento_idx on public.agendamentos(estabelecimento_id,data);
create index agendamentos_profissional_idx on public.agendamentos(profissional_id,data);

alter table public.agendamentos
add constraint agendamentos_sem_sobreposicao
exclude using gist (
  profissional_id with =,
  data with =,
  int4range(
    floor(extract(epoch from hora_inicio) / 60)::integer,
    floor(extract(epoch from hora_fim) / 60)::integer,
    '[)'
  ) with &&
)
where (status in ('pendente','confirmado','concluido'));

create trigger agendamentos_updated_at
before update on public.agendamentos
for each row execute function public.set_updated_at();

create table public.promocoes (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  titulo text not null,
  descricao text not null,
  codigo text,
  desconto_percentual numeric(5,2),
  inicia_em date,
  termina_em date,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger promocoes_updated_at
before update on public.promocoes
for each row execute function public.set_updated_at();

create table public.favoritos (
  cliente_id uuid not null references public.perfis(id) on delete cascade,
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(cliente_id,estabelecimento_id)
);

create table public.tickets_suporte (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.perfis(id) on delete set null,
  nome text not null,
  email text not null,
  categoria text not null default 'duvida' check (categoria in ('duvida','suporte','cadastro','financeiro','sugestao','outro')),
  assunto text not null,
  mensagem text not null,
  prioridade text not null default 'normal' check (prioridade in ('baixa','normal','alta','urgente')),
  status text not null default 'aberto' check (status in ('aberto','em_atendimento','respondido','fechado')),
  resposta text,
  respondido_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index tickets_user_idx on public.tickets_suporte(user_id,created_at desc);
create index tickets_status_idx on public.tickets_suporte(status,prioridade);
create trigger tickets_updated_at
before update on public.tickets_suporte
for each row execute function public.set_updated_at();

-- ============================================================
-- RPC: ONBOARDING DO PROFISSIONAL
-- Cria estabelecimento, horários, profissional principal e serviço inicial.
-- ============================================================

create or replace function public.criar_estabelecimento_inicial(
  p_tipo_estabelecimento text,
  p_nome text,
  p_descricao text,
  p_email_publico text,
  p_telefone text,
  p_whatsapp text,
  p_instagram text,
  p_cep text,
  p_cidade text,
  p_estado text,
  p_bairro text,
  p_endereco text,
  p_numero text,
  p_complemento text,
  p_aceita_agendamento boolean,
  p_horarios jsonb,
  p_servico jsonb,
  p_profissional_nome text,
  p_profissional_especialidade text,
  p_foto_url text,
  p_capa_url text
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estabelecimento_id uuid;
  v_slug text;
  v_tipo_perfil text;
begin
  if auth.uid() is null then
    raise exception 'Você precisa estar autenticado.';
  end if;

  select tipo into v_tipo_perfil from public.perfis where id = auth.uid();
  if v_tipo_perfil not in ('barbeiro','admin') then
    raise exception 'Somente profissionais podem cadastrar estabelecimentos.';
  end if;

  if exists(select 1 from public.estabelecimentos where owner_id = auth.uid()) then
    raise exception 'Você já possui um estabelecimento cadastrado.';
  end if;

  if p_tipo_estabelecimento not in ('barbearia','salao') then
    raise exception 'Tipo de estabelecimento inválido.';
  end if;

  v_slug := public.slugify(p_nome) || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,7);

  insert into public.estabelecimentos (
    owner_id,tipo_estabelecimento,nome,slug,descricao,email_publico,telefone,whatsapp,instagram,
    cep,cidade,estado,bairro,endereco,numero,complemento,aceita_agendamento,
    foto_url,capa_url,onboarding_concluido,visivel
  ) values (
    auth.uid(),p_tipo_estabelecimento,trim(p_nome),v_slug,coalesce(p_descricao,''),p_email_publico,
    p_telefone,p_whatsapp,p_instagram,p_cep,trim(p_cidade),upper(coalesce(p_estado,'MG')),
    trim(p_bairro),trim(p_endereco),p_numero,p_complemento,coalesce(p_aceita_agendamento,true),
    p_foto_url,p_capa_url,true,true
  ) returning id into v_estabelecimento_id;

  insert into public.horarios_funcionamento (estabelecimento_id,dia_semana,aberto,abre,fecha)
  select
    v_estabelecimento_id,
    x.dia_semana,
    x.aberto,
    case when x.aberto then x.abre::time else null end,
    case when x.aberto then x.fecha::time else null end
  from jsonb_to_recordset(coalesce(p_horarios,'[]'::jsonb))
    as x(dia_semana smallint, aberto boolean, abre text, fecha text);

  if not exists(select 1 from public.horarios_funcionamento where estabelecimento_id=v_estabelecimento_id) then
    insert into public.horarios_funcionamento(estabelecimento_id,dia_semana,aberto,abre,fecha)
    values
      (v_estabelecimento_id,0,false,null,null),
      (v_estabelecimento_id,1,true,'08:00','18:00'),
      (v_estabelecimento_id,2,true,'08:00','18:00'),
      (v_estabelecimento_id,3,true,'08:00','18:00'),
      (v_estabelecimento_id,4,true,'08:00','18:00'),
      (v_estabelecimento_id,5,true,'08:00','18:00'),
      (v_estabelecimento_id,6,true,'08:00','13:00');
  end if;

  insert into public.profissionais (
    estabelecimento_id,user_id,nome,email,telefone,especialidade,ativo,aceita_agendamento
  )
  select v_estabelecimento_id,auth.uid(),coalesce(nullif(trim(p_profissional_nome),''),p.nome),p.email,p.telefone,
         coalesce(nullif(trim(p_profissional_especialidade),''),'Profissional principal'),true,true
  from public.perfis p where p.id=auth.uid();

  if nullif(trim(coalesce(p_servico->>'nome','')), '') is not null then
    insert into public.servicos(estabelecimento_id,nome,categoria,descricao,preco,duracao_min,ativo,publico,destaque)
    values (
      v_estabelecimento_id,
      trim(p_servico->>'nome'),
      coalesce(nullif(trim(p_servico->>'categoria'),''),'Serviço'),
      coalesce(p_servico->>'descricao',''),
      greatest(coalesce((p_servico->>'preco')::numeric,0),0),
      greatest(coalesce((p_servico->>'duracao_min')::integer,30),5),
      true,true,true
    );
  end if;

  update public.perfis set onboarding_concluido=true where id=auth.uid();
  return v_estabelecimento_id;
end;
$$;

-- ============================================================
-- RPC: AGENDA
-- ============================================================

create or replace function public.horarios_ocupados(p_profissional_id uuid, p_data date)
returns table(hora_inicio time, hora_fim time)
language sql
stable
security definer
set search_path = public
as $$
  select a.hora_inicio,a.hora_fim
  from public.agendamentos a
  join public.profissionais p on p.id=a.profissional_id
  join public.estabelecimentos e on e.id=p.estabelecimento_id
  where a.profissional_id=p_profissional_id
    and a.data=p_data
    and a.status in ('pendente','confirmado','concluido')
    and p.ativo=true
    and e.visivel=true
    and e.onboarding_concluido=true
  order by a.hora_inicio;
$$;

create or replace function public.criar_agendamento(
  p_estabelecimento_id uuid,
  p_profissional_id uuid,
  p_servico_id uuid,
  p_data date,
  p_hora_inicio time,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_est public.estabelecimentos%rowtype;
  v_serv public.servicos%rowtype;
  v_prof public.profissionais%rowtype;
  v_perfil public.perfis%rowtype;
  v_email text;
  v_hora_fim time;
  v_dia smallint;
  v_horario public.horarios_funcionamento%rowtype;
  v_id uuid;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_agora time := (now() at time zone 'America/Sao_Paulo')::time;
begin
  if auth.uid() is null then
    raise exception 'Faça login para agendar.';
  end if;

  select * into v_perfil from public.perfis where id=auth.uid() and ativo=true;
  if not found then raise exception 'Perfil não encontrado ou inativo.'; end if;
  select email into v_email from auth.users where id=auth.uid();

  select * into v_est from public.estabelecimentos
  where id=p_estabelecimento_id and visivel=true and onboarding_concluido=true;
  if not found then raise exception 'Estabelecimento indisponível.'; end if;
  if not v_est.aceita_agendamento then raise exception 'Este estabelecimento não aceita agendamento online.'; end if;
  if v_est.status_manual='fechado' then raise exception 'O estabelecimento está fechado manualmente.'; end if;

  if p_data < v_hoje then raise exception 'Não é possível agendar uma data passada.'; end if;
  if p_data > v_hoje + v_est.limite_dias_agendamento then raise exception 'Data acima do limite permitido para agendamento.'; end if;

  if exists(select 1 from public.dias_bloqueados where estabelecimento_id=v_est.id and data=p_data) then
    raise exception 'A data escolhida está bloqueada.';
  end if;

  v_dia := extract(dow from p_data)::smallint;
  select * into v_horario from public.horarios_funcionamento
  where estabelecimento_id=v_est.id and dia_semana=v_dia and aberto=true;
  if not found then raise exception 'O estabelecimento não funciona neste dia.'; end if;

  select * into v_serv from public.servicos
  where id=p_servico_id and estabelecimento_id=v_est.id and ativo=true and publico=true;
  if not found then raise exception 'Serviço indisponível.'; end if;

  select * into v_prof from public.profissionais
  where id=p_profissional_id and estabelecimento_id=v_est.id and ativo=true and aceita_agendamento=true;
  if not found then raise exception 'Profissional indisponível.'; end if;

  v_hora_fim := p_hora_inicio + make_interval(mins => v_serv.duracao_min);
  if p_hora_inicio < v_horario.abre or v_hora_fim > v_horario.fecha then
    raise exception 'Horário fora do funcionamento cadastrado.';
  end if;

  if p_data=v_hoje and p_hora_inicio < (v_agora + make_interval(hours => v_est.antecedencia_min_horas))::time then
    raise exception 'O horário não respeita a antecedência mínima.';
  end if;

  if exists(
    select 1 from public.agendamentos a
    where a.profissional_id=v_prof.id and a.data=p_data
      and a.status in ('pendente','confirmado','concluido')
      and p_hora_inicio < a.hora_fim and v_hora_fim > a.hora_inicio
  ) then
    raise exception 'Este horário acabou de ser ocupado. Escolha outra opção.';
  end if;

  insert into public.agendamentos(
    estabelecimento_id,profissional_id,servico_id,cliente_id,
    cliente_nome,cliente_email,cliente_telefone,data,hora_inicio,hora_fim,
    observacao,valor,status
  ) values (
    v_est.id,v_prof.id,v_serv.id,auth.uid(),v_perfil.nome,coalesce(v_email,v_perfil.email),v_perfil.telefone,
    p_data,p_hora_inicio,v_hora_fim,nullif(trim(coalesce(p_observacao,'')),''),v_serv.preco,'pendente'
  ) returning id into v_id;

  return v_id;
end;
$$;

create or replace function public.cancelar_agendamento(p_agendamento_id uuid, p_motivo text default null)
returns void
language plpgsql
security definer
set search_path = public
as $$
begin
  update public.agendamentos
  set status='cancelado',cancelamento_motivo=nullif(trim(coalesce(p_motivo,'')),''),updated_at=now()
  where id=p_agendamento_id and cliente_id=auth.uid() and status in ('pendente','confirmado');

  if not found then
    raise exception 'Agendamento não encontrado ou não pode mais ser cancelado.';
  end if;
end;
$$;

create or replace function public.metricas_publicas()
returns table(estabelecimentos bigint, com_agenda bigint, barbearias bigint, saloes bigint)
language sql
stable
security definer
set search_path = public
as $$
  select
    count(*)::bigint,
    count(*) filter(where aceita_agendamento)::bigint,
    count(*) filter(where tipo_estabelecimento='barbearia')::bigint,
    count(*) filter(where tipo_estabelecimento='salao')::bigint
  from public.estabelecimentos
  where visivel=true and onboarding_concluido=true;
$$;

-- ============================================================
-- RLS
-- ============================================================

alter table public.perfis enable row level security;
alter table public.estabelecimentos enable row level security;
alter table public.horarios_funcionamento enable row level security;
alter table public.dias_bloqueados enable row level security;
alter table public.profissionais enable row level security;
alter table public.servicos enable row level security;
alter table public.profissional_servicos enable row level security;
alter table public.agendamentos enable row level security;
alter table public.promocoes enable row level security;
alter table public.favoritos enable row level security;
alter table public.tickets_suporte enable row level security;

-- Perfis
create policy perfis_select_proprio_admin on public.perfis
for select to authenticated
using (id=auth.uid() or public.is_admin());

create policy perfis_update_proprio_admin on public.perfis
for update to authenticated
using (id=auth.uid() or public.is_admin())
with check (id=auth.uid() or public.is_admin());

-- Estabelecimentos públicos e gestão do proprietário/admin
create policy estabelecimentos_select_publico on public.estabelecimentos
for select to anon,authenticated
using (visivel=true and onboarding_concluido=true or owner_id=auth.uid() or public.is_admin());

create policy estabelecimentos_insert_owner on public.estabelecimentos
for insert to authenticated
with check (owner_id=auth.uid() and exists(select 1 from public.perfis where id=auth.uid() and tipo='barbeiro') or public.is_admin());

create policy estabelecimentos_update_owner on public.estabelecimentos
for update to authenticated
using (owner_id=auth.uid() or public.is_admin())
with check (owner_id=auth.uid() or public.is_admin());

create policy estabelecimentos_delete_owner on public.estabelecimentos
for delete to authenticated
using (owner_id=auth.uid() or public.is_admin());

-- Tabelas filhas: leitura pública quando o estabelecimento está visível; gestão pelo dono/admin.
create policy horarios_select_publico on public.horarios_funcionamento
for select to anon,authenticated
using (exists(select 1 from public.estabelecimentos e where e.id=estabelecimento_id and (e.visivel and e.onboarding_concluido or e.owner_id=auth.uid() or public.is_admin())));
create policy horarios_manage_owner on public.horarios_funcionamento
for all to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin())
with check (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());

create policy bloqueios_select_publico on public.dias_bloqueados
for select to anon,authenticated
using (exists(select 1 from public.estabelecimentos e where e.id=estabelecimento_id and (e.visivel and e.onboarding_concluido or e.owner_id=auth.uid() or public.is_admin())));
create policy bloqueios_manage_owner on public.dias_bloqueados
for all to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin())
with check (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());

create policy profissionais_select_publico on public.profissionais
for select to anon,authenticated
using ((ativo=true and exists(select 1 from public.estabelecimentos e where e.id=estabelecimento_id and e.visivel and e.onboarding_concluido)) or public.owns_estabelecimento(estabelecimento_id) or public.is_admin());
create policy profissionais_manage_owner on public.profissionais
for all to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin())
with check (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());

create policy servicos_select_publico on public.servicos
for select to anon,authenticated
using ((ativo=true and publico=true and exists(select 1 from public.estabelecimentos e where e.id=estabelecimento_id and e.visivel and e.onboarding_concluido)) or public.owns_estabelecimento(estabelecimento_id) or public.is_admin());
create policy servicos_manage_owner on public.servicos
for all to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin())
with check (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());

create policy profissional_servicos_select on public.profissional_servicos
for select to anon,authenticated using (true);
create policy profissional_servicos_manage on public.profissional_servicos
for all to authenticated
using (exists(select 1 from public.profissionais p where p.id=profissional_id and (public.owns_estabelecimento(p.estabelecimento_id) or public.is_admin())))
with check (exists(select 1 from public.profissionais p where p.id=profissional_id and (public.owns_estabelecimento(p.estabelecimento_id) or public.is_admin())));

create policy promocoes_select_publico on public.promocoes
for select to anon,authenticated
using ((ativo=true and exists(select 1 from public.estabelecimentos e where e.id=estabelecimento_id and e.visivel and e.onboarding_concluido)) or public.owns_estabelecimento(estabelecimento_id) or public.is_admin());
create policy promocoes_manage_owner on public.promocoes
for all to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin())
with check (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());

-- Agenda: cliente vê a própria; dono vê a agenda do estabelecimento; admin vê tudo.
create policy agendamentos_select_partes on public.agendamentos
for select to authenticated
using (cliente_id=auth.uid() or public.owns_estabelecimento(estabelecimento_id) or public.is_admin());

create policy agendamentos_update_owner_admin on public.agendamentos
for update to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin())
with check (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());

-- Favoritos
create policy favoritos_proprio on public.favoritos
for all to authenticated
using (cliente_id=auth.uid() or public.is_admin())
with check (cliente_id=auth.uid() or public.is_admin());

-- Tickets: anônimo pode abrir; usuário vê os próprios; admin atende todos.
create policy tickets_insert_publico on public.tickets_suporte
for insert to anon,authenticated
with check (user_id is null or user_id=auth.uid());

create policy tickets_select_proprio_admin on public.tickets_suporte
for select to authenticated
using (user_id=auth.uid() or public.is_admin());

create policy tickets_update_admin on public.tickets_suporte
for update to authenticated
using (public.is_admin())
with check (public.is_admin());

-- ============================================================
-- PERMISSÕES DA DATA API
-- ============================================================

revoke all on public.perfis from anon,authenticated;
grant select on public.perfis to authenticated;
grant update (nome,email,telefone,avatar_url,acessibilidade) on public.perfis to authenticated;

grant select on public.estabelecimentos,public.horarios_funcionamento,public.dias_bloqueados,
  public.profissionais,public.servicos,public.profissional_servicos,public.promocoes to anon,authenticated;

grant insert,update,delete on public.estabelecimentos,public.horarios_funcionamento,public.dias_bloqueados,
  public.profissionais,public.servicos,public.profissional_servicos,public.promocoes to authenticated;

grant select on public.agendamentos,public.favoritos,public.tickets_suporte to authenticated;
grant insert,update,delete on public.favoritos to authenticated;
grant update (status,cancelamento_motivo,updated_at) on public.agendamentos to authenticated;
grant insert on public.tickets_suporte to anon,authenticated;
grant update (status,prioridade,resposta,respondido_em,updated_at) on public.tickets_suporte to authenticated;

revoke execute on function public.is_admin() from public;
revoke execute on function public.owns_estabelecimento(uuid) from public;
revoke execute on function public.criar_estabelecimento_inicial(text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,jsonb,jsonb,text,text,text,text) from public;
revoke execute on function public.horarios_ocupados(uuid,date) from public;
revoke execute on function public.criar_agendamento(uuid,uuid,uuid,date,time,text) from public;
revoke execute on function public.cancelar_agendamento(uuid,text) from public;
revoke execute on function public.metricas_publicas() from public;

grant execute on function public.is_admin() to anon,authenticated;
grant execute on function public.owns_estabelecimento(uuid) to authenticated;
grant execute on function public.criar_estabelecimento_inicial(text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,jsonb,jsonb,text,text,text,text) to authenticated;
grant execute on function public.horarios_ocupados(uuid,date) to anon,authenticated;
grant execute on function public.criar_agendamento(uuid,uuid,uuid,date,time,text) to authenticated;
grant execute on function public.cancelar_agendamento(uuid,text) to authenticated;
grant execute on function public.metricas_publicas() to anon,authenticated;

-- ============================================================
-- STORAGE: fotos públicas com upload restrito à pasta do usuário.
-- ============================================================

insert into storage.buckets (id,name,public,file_size_limit,allowed_mime_types)
values (
  'barberhub-public','barberhub-public',true,5242880,
  array['image/jpeg','image/png','image/webp']
)
on conflict (id) do update set
  public=excluded.public,
  file_size_limit=excluded.file_size_limit,
  allowed_mime_types=excluded.allowed_mime_types;

drop policy if exists barberhub_storage_public_read on storage.objects;
create policy barberhub_storage_public_read
on storage.objects for select
to public
using (bucket_id='barberhub-public');

drop policy if exists barberhub_storage_user_insert on storage.objects;
create policy barberhub_storage_user_insert
on storage.objects for insert
to authenticated
with check (
  bucket_id='barberhub-public'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists barberhub_storage_user_update on storage.objects;
create policy barberhub_storage_user_update
on storage.objects for update
to authenticated
using (
  bucket_id='barberhub-public'
  and (storage.foldername(name))[1]=auth.uid()::text
)
with check (
  bucket_id='barberhub-public'
  and (storage.foldername(name))[1]=auth.uid()::text
);

drop policy if exists barberhub_storage_user_delete on storage.objects;
create policy barberhub_storage_user_delete
on storage.objects for delete
to authenticated
using (
  bucket_id='barberhub-public'
  and (storage.foldername(name))[1]=auth.uid()::text
);

-- Banco instalado. Não há usuários demo ou dados fictícios.
