-- Barber Hub 1.11.0: confiabilidade, privacidade e fechamento para produção.
-- Requer as migrations históricas 01 a 32. Idempotente para reexecução controlada.
begin;

create schema if not exists private;
create schema if not exists extensions;
revoke create on schema private from public, anon, authenticated;
revoke usage on schema private from public, anon;
grant usage on schema private to authenticated, service_role;

-- Hashes de idempotência e anonimização dependem de pgcrypto. Instalações
-- antigas podem tê-la criado em public; a release padroniza o schema antes de
-- qualquer chamada a extensions.digest.
create extension if not exists pgcrypto with schema extensions;
do $$
begin
  if exists(
    select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace
    where e.extname='pgcrypto' and n.nspname<>'extensions'
  ) then
    alter extension pgcrypto set schema extensions;
  end if;
end $$;

-- ============================================================
-- 1. CNPJ ALFANUMÉRICO, NORMALIZAÇÃO E VALIDAÇÃO OFICIAL
-- Os 12 primeiros caracteres aceitam A-Z/0-9; os dois últimos são DVs.
-- O campo permanece opcional até a verificação/comercialização do negócio.
-- ============================================================

create or replace function private.normalizar_cnpj_111(p_cnpj text)
returns text
language sql
immutable
strict
set search_path = ''
as $$
  select nullif(upper(regexp_replace(trim(p_cnpj), '[^A-Za-z0-9]', '', 'g')), '');
$$;

create or replace function private.cnpj_valido_111(p_cnpj text)
returns boolean
language plpgsql
immutable
strict
set search_path = ''
as $$
declare
  v_cnpj text := private.normalizar_cnpj_111(p_cnpj);
  v_pesos_1 integer[] := array[5,4,3,2,9,8,7,6,5,4,3,2];
  v_pesos_2 integer[] := array[6,5,4,3,2,9,8,7,6,5,4,3,2];
  v_soma integer := 0;
  v_resto integer;
  v_dv_1 integer;
  v_dv_2 integer;
  v_indice integer;
  v_valor integer;
begin
  if v_cnpj is null or v_cnpj !~ '^[A-Z0-9]{12}[0-9]{2}$' then return false; end if;
  if v_cnpj = repeat(substr(v_cnpj,1,1),14) then return false; end if;
  for v_indice in 1..12 loop
    v_valor := ascii(substr(v_cnpj, v_indice, 1)) - 48;
    v_soma := v_soma + v_valor * v_pesos_1[v_indice];
  end loop;
  v_resto := v_soma % 11;
  v_dv_1 := case when v_resto in (0,1) then 0 else 11-v_resto end;
  v_soma := 0;
  for v_indice in 1..12 loop
    v_valor := ascii(substr(v_cnpj, v_indice, 1)) - 48;
    v_soma := v_soma + v_valor * v_pesos_2[v_indice];
  end loop;
  v_soma := v_soma + v_dv_1 * v_pesos_2[13];
  v_resto := v_soma % 11;
  v_dv_2 := case when v_resto in (0,1) then 0 else 11-v_resto end;
  return right(v_cnpj, 2) = v_dv_1::text || v_dv_2::text;
end;
$$;

create or replace function private.normalizar_cnpj_estabelecimento_111()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  new.cnpj := private.normalizar_cnpj_111(new.cnpj);
  return new;
end;
$$;

revoke all on function private.normalizar_cnpj_111(text) from public, anon, authenticated;
revoke all on function private.cnpj_valido_111(text) from public, anon, authenticated;
revoke all on function private.normalizar_cnpj_estabelecimento_111() from public, anon, authenticated;
grant execute on function private.normalizar_cnpj_111(text) to authenticated, service_role;
grant execute on function private.cnpj_valido_111(text) to authenticated, service_role;

alter table public.estabelecimentos add column if not exists cnpj text;
alter table public.estabelecimentos drop constraint if exists estabelecimentos_cnpj_111_check;
alter table public.estabelecimentos add constraint estabelecimentos_cnpj_111_check
  check (cnpj is null or private.cnpj_valido_111(cnpj));
create unique index if not exists estabelecimentos_cnpj_111_unique_idx
  on public.estabelecimentos(cnpj) where cnpj is not null;
drop trigger if exists estabelecimentos_normalizar_cnpj_111 on public.estabelecimentos;
create trigger estabelecimentos_normalizar_cnpj_111
before insert or update of cnpj on public.estabelecimentos
for each row execute function private.normalizar_cnpj_estabelecimento_111();

-- Mantém o onboarding atômico e passa a aceitar o CNPJ opcional. A assinatura
-- anterior é removida para que o PostgREST não encontre duas RPCs ambíguas.
drop function if exists public.criar_estabelecimento_inicial(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,
  boolean,jsonb,jsonb,text,text,text,text
);

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
  p_capa_url text,
  p_cnpj text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_estabelecimento_id uuid;
  v_slug text;
  v_tipo_perfil text;
begin
  if v_user is null then
    raise exception 'Você precisa estar autenticado.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':onboarding',0));
  select tipo into v_tipo_perfil from public.perfis where id = v_user;
  if v_tipo_perfil not in ('barbeiro','admin') then
    raise exception 'Somente profissionais podem cadastrar estabelecimentos.';
  end if;
  if char_length(trim(coalesce(p_nome,''))) not between 2 and 120 then
    raise exception 'Nome do estabelecimento inválido.';
  end if;
  if exists(select 1 from public.estabelecimentos where owner_id = v_user) then
    raise exception 'Você já possui um estabelecimento cadastrado.';
  end if;
  if p_tipo_estabelecimento not in ('barbearia','salao') then
    raise exception 'Tipo de estabelecimento inválido.';
  end if;
  if private.normalizar_cnpj_111(p_cnpj) is not null
     and not private.cnpj_valido_111(p_cnpj) then
    raise exception 'CNPJ inválido.';
  end if;

  v_slug := public.slugify(p_nome) || '-' || substr(replace(gen_random_uuid()::text,'-',''),1,7);
  insert into public.estabelecimentos (
    owner_id,tipo_estabelecimento,nome,slug,descricao,email_publico,telefone,whatsapp,instagram,
    cep,cidade,estado,bairro,endereco,numero,complemento,aceita_agendamento,
    foto_url,capa_url,cnpj,onboarding_concluido,visivel
  ) values (
    v_user,p_tipo_estabelecimento,trim(p_nome),v_slug,coalesce(p_descricao,''),p_email_publico,
    p_telefone,p_whatsapp,p_instagram,p_cep,trim(p_cidade),upper(coalesce(p_estado,'MG')),
    -- p_aceita_agendamento permanece na assinatura para compatibilidade com
    -- clientes em cache, porém não concede um recurso ausente no plano inicial.
    trim(p_bairro),trim(p_endereco),p_numero,p_complemento,false,
    p_foto_url,p_capa_url,private.normalizar_cnpj_111(p_cnpj),true,true
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
  select v_estabelecimento_id,v_user,coalesce(nullif(trim(p_profissional_nome),''),p.nome),p.email,p.telefone,
         coalesce(nullif(trim(p_profissional_especialidade),''),'Profissional principal'),true,true
  from public.perfis p where p.id=v_user;

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

  update public.perfis set onboarding_concluido=true where id=v_user;
  return v_estabelecimento_id;
end;
$$;

revoke all on function public.criar_estabelecimento_inicial(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,
  boolean,jsonb,jsonb,text,text,text,text,text
) from public, anon;
grant execute on function public.criar_estabelecimento_inicial(
  text,text,text,text,text,text,text,text,text,text,text,text,text,text,
  boolean,jsonb,jsonb,text,text,text,text,text
) to authenticated;

-- Todo estabelecimento nasce no plano de entrada. Como a assinatura padrão só
-- pode ser criada depois que o estabelecimento já possui um id, o INSERT nunca
-- pode ativar a agenda. Alterações posteriores consultam o entitlement efetivo.
create or replace function private.validar_estabelecimento_agenda_plano_111()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entitlements jsonb;
begin
  if tg_op = 'INSERT' then
    new.aceita_agendamento := false;
    return new;
  end if;

  if coalesce(new.aceita_agendamento, false)
     and old.aceita_agendamento is distinct from true then
    v_entitlements := public.calcular_entitlements_estabelecimento(new.id);
    if not coalesce((v_entitlements->>'permite_agenda')::boolean, false) then
      raise exception 'A agenda online não está disponível no plano atual.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.validar_estabelecimento_agenda_plano_111() from public,anon,authenticated;

drop trigger if exists estabelecimentos_validar_agenda_plano on public.estabelecimentos;
create trigger estabelecimentos_validar_agenda_plano
before insert or update of aceita_agendamento on public.estabelecimentos
for each row execute function private.validar_estabelecimento_agenda_plano_111();

drop function if exists public.validar_estabelecimento_agenda_plano();

-- ============================================================
-- 2. CONSENTIMENTOS VERSIONADOS E IMUTÁVEIS
-- Termos/privacidade e marketing possuem finalidades independentes.
-- ============================================================

create table if not exists public.consentimentos_usuario (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.perfis(id) on delete set null,
  user_hash text not null check (user_hash ~ '^[0-9a-f]{64}$'),
  finalidade text not null check (finalidade in ('termos','privacidade','marketing')),
  documento text not null check (char_length(trim(documento)) between 2 and 80),
  versao text not null check (versao ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([.-][A-Za-z0-9]+)?$'),
  acao text not null check (acao in ('aceito','revogado')),
  origem text not null default 'web' check (origem in ('web','pwa','mobile','suporte','administrativo')),
  request_id text check (request_id is null or char_length(request_id) between 8 and 128),
  user_agent text check (user_agent is null or char_length(user_agent) <= 500),
  created_at timestamptz not null default now()
);
create index if not exists consentimentos_usuario_user_created_idx
  on public.consentimentos_usuario(user_id, created_at desc, id) where user_id is not null;
create index if not exists consentimentos_usuario_hash_created_idx
  on public.consentimentos_usuario(user_hash, created_at desc, id);

alter table public.consentimentos_usuario enable row level security;
drop policy if exists consentimentos_select_proprios_111 on public.consentimentos_usuario;
create policy consentimentos_select_proprios_111 on public.consentimentos_usuario
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));
revoke all on table public.consentimentos_usuario from public, anon, authenticated;
grant select on table public.consentimentos_usuario to authenticated;

create or replace function public.registrar_consentimento_111(
  p_finalidade text,
  p_documento text,
  p_versao text,
  p_aceito boolean,
  p_origem text default 'web',
  p_request_id text default null,
  p_user_agent text default null
)
returns uuid
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if p_finalidade not in ('termos','privacidade','marketing') then raise exception 'CONSENT_PURPOSE_INVALID'; end if;
  if char_length(trim(coalesce(p_documento,''))) not between 2 and 80 then raise exception 'CONSENT_DOCUMENT_INVALID'; end if;
  if trim(coalesce(p_versao,'')) !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([.-][A-Za-z0-9]+)?$' then
    raise exception 'CONSENT_VERSION_INVALID';
  end if;
  if coalesce(p_origem,'') not in ('web','pwa','mobile','suporte','administrativo') then raise exception 'CONSENT_SOURCE_INVALID'; end if;
  insert into public.consentimentos_usuario(
    user_id,user_hash,finalidade,documento,versao,acao,origem,request_id,user_agent
  ) values (
    v_user,
    encode(extensions.digest(convert_to(v_user::text || ':barberhub-consent','utf8'),'sha256'),'hex'),
    p_finalidade,trim(p_documento),trim(p_versao),case when p_aceito then 'aceito' else 'revogado' end,
    p_origem,nullif(trim(coalesce(p_request_id,'')),''),left(nullif(trim(coalesce(p_user_agent,'')),''),500)
  ) returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.registrar_consentimento_111(text,text,text,boolean,text,text,text) from public, anon;
grant execute on function public.registrar_consentimento_111(text,text,text,boolean,text,text,text) to authenticated, service_role;

-- O aceite nasce junto com a identidade, inclusive quando a confirmação de
-- e-mail impede que o navegador receba uma sessão imediatamente. A data usada
-- é a do servidor; metadados do cliente informam apenas a escolha e a versão.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tipo text;
  v_versao_termos text;
  v_versao_privacidade text;
  v_hash text;
begin
  v_tipo := case when new.raw_user_meta_data->>'tipo' = 'barbeiro' then 'barbeiro' else 'cliente' end;
  insert into public.perfis(id,nome,email,telefone,tipo,onboarding_concluido)
  values(
    new.id,
    coalesce(nullif(trim(new.raw_user_meta_data->>'nome'),''),split_part(new.email,'@',1)),
    new.email,
    nullif(trim(new.raw_user_meta_data->>'telefone'),''),
    v_tipo,
    v_tipo='cliente'
  );

  v_versao_termos := nullif(trim(new.raw_user_meta_data->>'aceite_termos_versao'),'');
  v_versao_privacidade := nullif(trim(new.raw_user_meta_data->>'aceite_privacidade_versao'),'');
  -- Compatibilidade temporária com a versão mensal usada por clientes em cache.
  if v_versao_termos='2026-09' then v_versao_termos:='2026-09-11'; end if;
  if v_versao_privacidade='2026-09' then v_versao_privacidade:='2026-09-11'; end if;
  v_hash := encode(extensions.digest(convert_to(new.id::text || ':barberhub-consent','utf8'),'sha256'),'hex');

  if v_versao_termos ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([.-][A-Za-z0-9]+)?$' then
    insert into public.consentimentos_usuario(user_id,user_hash,finalidade,documento,versao,acao,origem,created_at)
    values(new.id,v_hash,'termos','Termos de uso',v_versao_termos,'aceito','web',coalesce(new.created_at,now()));
  end if;
  if v_versao_privacidade ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([.-][A-Za-z0-9]+)?$' then
    insert into public.consentimentos_usuario(user_id,user_hash,finalidade,documento,versao,acao,origem,created_at)
    values(new.id,v_hash,'privacidade','Política de privacidade',v_versao_privacidade,'aceito','web',coalesce(new.created_at,now()));
    if lower(coalesce(new.raw_user_meta_data->>'marketing_aceito','false'))='true' then
      insert into public.consentimentos_usuario(user_id,user_hash,finalidade,documento,versao,acao,origem,created_at)
      values(new.id,v_hash,'marketing','Comunicações e ofertas',v_versao_privacidade,'aceito','web',coalesce(new.created_at,now()));
    end if;
  end if;
  return new;
end;
$$;
revoke all on function public.handle_new_user() from public,anon,authenticated;

-- Recupera a trilha dos cadastros feitos antes desta tabela existir. O horário
-- de criação do Auth é a evidência confiável; linhas já existentes não duplicam.
with fontes as (
  select u.id,u.created_at,
    case when u.raw_user_meta_data->>'aceite_termos_versao'='2026-09' then '2026-09-11'
      else u.raw_user_meta_data->>'aceite_termos_versao' end as versao
  from auth.users u
)
insert into public.consentimentos_usuario(user_id,user_hash,finalidade,documento,versao,acao,origem,created_at)
select f.id,encode(extensions.digest(convert_to(f.id::text || ':barberhub-consent','utf8'),'sha256'),'hex'),
  'termos','Termos de uso',f.versao,'aceito','web',f.created_at
from fontes f
where f.versao ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([.-][A-Za-z0-9]+)?$'
  and exists(select 1 from public.perfis p where p.id=f.id)
  and not exists(select 1 from public.consentimentos_usuario c where c.user_id=f.id and c.finalidade='termos' and c.versao=f.versao and c.acao='aceito');

with fontes as (
  select u.id,u.created_at,u.raw_user_meta_data,
    case when u.raw_user_meta_data->>'aceite_privacidade_versao'='2026-09' then '2026-09-11'
      else u.raw_user_meta_data->>'aceite_privacidade_versao' end as versao
  from auth.users u
)
insert into public.consentimentos_usuario(user_id,user_hash,finalidade,documento,versao,acao,origem,created_at)
select f.id,encode(extensions.digest(convert_to(f.id::text || ':barberhub-consent','utf8'),'sha256'),'hex'),
  finalidade,documento,f.versao,'aceito','web',f.created_at
from fontes f
cross join lateral (values ('privacidade','Política de privacidade'),('marketing','Comunicações e ofertas')) v(finalidade,documento)
where f.versao ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}([.-][A-Za-z0-9]+)?$'
  and exists(select 1 from public.perfis p where p.id=f.id)
  and (v.finalidade='privacidade' or lower(coalesce(f.raw_user_meta_data->>'marketing_aceito','false'))='true')
  and not exists(select 1 from public.consentimentos_usuario c where c.user_id=f.id and c.finalidade=v.finalidade and c.versao=f.versao and c.acao='aceito');

-- ============================================================
-- 3. EXCLUSÃO REVERSÍVEL POR SETE DIAS E RETENÇÃO MÍNIMA
-- Referências de autoria operacional são preservadas sem bloquear a remoção
-- da identidade. O estabelecimento fica encerrado e invisível, não órfão ativo.
-- ============================================================

alter table public.estabelecimentos drop constraint if exists estabelecimentos_owner_id_fkey;
alter table public.estabelecimentos alter column owner_id drop not null;
alter table public.estabelecimentos add constraint estabelecimentos_owner_id_fkey
  foreign key (owner_id) references public.perfis(id) on delete set null;
alter table public.estabelecimentos
  add column if not exists encerrado_em timestamptz,
  add column if not exists encerramento_motivo text;

alter table public.agenda_bloqueios drop constraint if exists agenda_bloqueios_criado_por_fkey;
alter table public.agenda_bloqueios alter column criado_por drop not null;
alter table public.agenda_bloqueios add constraint agenda_bloqueios_criado_por_fkey
  foreign key (criado_por) references public.perfis(id) on delete set null;

alter table public.fechamentos_diarios drop constraint if exists fechamentos_diarios_fechado_por_fkey;
alter table public.fechamentos_diarios alter column fechado_por drop not null;
alter table public.fechamentos_diarios add constraint fechamentos_diarios_fechado_por_fkey
  foreign key (fechado_por) references public.perfis(id) on delete set null;

alter table public.lista_espera drop constraint if exists lista_espera_criado_por_fkey;
alter table public.lista_espera alter column criado_por drop not null;
alter table public.lista_espera add constraint lista_espera_criado_por_fkey
  foreign key (criado_por) references public.perfis(id) on delete set null;

alter table public.agendamentos_recorrencias drop constraint if exists agendamentos_recorrencias_cliente_id_fkey;
alter table public.agendamentos_recorrencias alter column cliente_id drop not null;
alter table public.agendamentos_recorrencias add constraint agendamentos_recorrencias_cliente_id_fkey
  foreign key (cliente_id) references public.perfis(id) on delete set null;
alter table public.agendamentos_recorrencias drop constraint if exists agendamentos_recorrencias_criado_por_fkey;
alter table public.agendamentos_recorrencias alter column criado_por drop not null;
alter table public.agendamentos_recorrencias add constraint agendamentos_recorrencias_criado_por_fkey
  foreign key (criado_por) references public.perfis(id) on delete set null;

alter table public.cupons drop constraint if exists cupons_criado_por_fkey;
alter table public.cupons alter column criado_por drop not null;
alter table public.cupons add constraint cupons_criado_por_fkey
  foreign key (criado_por) references public.perfis(id) on delete set null;
alter table public.cupom_usos drop constraint if exists cupom_usos_cliente_id_fkey;
alter table public.cupom_usos alter column cliente_id drop not null;
alter table public.cupom_usos add constraint cupom_usos_cliente_id_fkey
  foreign key (cliente_id) references public.perfis(id) on delete set null;

alter table public.campanhas drop constraint if exists campanhas_criado_por_fkey;
alter table public.campanhas alter column criado_por drop not null;
alter table public.campanhas add constraint campanhas_criado_por_fkey
  foreign key (criado_por) references public.perfis(id) on delete set null;
alter table public.membro_permissoes drop constraint if exists membro_permissoes_definido_por_fkey;
alter table public.membro_permissoes alter column definido_por drop not null;
alter table public.membro_permissoes add constraint membro_permissoes_definido_por_fkey
  foreign key (definido_por) references public.perfis(id) on delete set null;
alter table public.metas_crescimento drop constraint if exists metas_crescimento_criado_por_fkey;
alter table public.metas_crescimento alter column criado_por drop not null;
alter table public.metas_crescimento add constraint metas_crescimento_criado_por_fkey
  foreign key (criado_por) references public.perfis(id) on delete set null;
alter table public.cliente_notas drop constraint if exists cliente_notas_autor_id_fkey;
alter table public.cliente_notas alter column autor_id drop not null;
alter table public.cliente_notas add constraint cliente_notas_autor_id_fkey
  foreign key (autor_id) references public.perfis(id) on delete set null;

create table if not exists public.solicitacoes_exclusao_conta (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.perfis(id) on delete set null,
  user_hash text not null check (user_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'agendada'
    check (status in ('agendada','cancelada','processando','concluida','falhou')),
  solicitado_em timestamptz not null default now(),
  agendado_para timestamptz not null default (now() + interval '7 days'),
  cancelado_em timestamptz,
  executado_em timestamptz,
  motivo text check (motivo is null or char_length(motivo) <= 500),
  tentativas smallint not null default 0 check (tentativas between 0 and 10),
  erro_codigo text check (erro_codigo is null or char_length(erro_codigo) <= 80),
  updated_at timestamptz not null default now(),
  check (agendado_para >= solicitado_em + interval '7 days')
);
create unique index if not exists solicitacoes_exclusao_user_ativa_111_idx
  on public.solicitacoes_exclusao_conta(user_id)
  where user_id is not null and status in ('agendada','processando');
create index if not exists solicitacoes_exclusao_fila_111_idx
  on public.solicitacoes_exclusao_conta(status, agendado_para, id)
  where status in ('agendada','falhou');
drop trigger if exists solicitacoes_exclusao_updated_at_111 on public.solicitacoes_exclusao_conta;
create trigger solicitacoes_exclusao_updated_at_111
before update on public.solicitacoes_exclusao_conta
for each row execute function public.set_updated_at();

alter table public.solicitacoes_exclusao_conta enable row level security;
drop policy if exists solicitacoes_exclusao_select_proprias_111 on public.solicitacoes_exclusao_conta;
create policy solicitacoes_exclusao_select_proprias_111 on public.solicitacoes_exclusao_conta
for select to authenticated
using (user_id = (select auth.uid()) or (select public.is_admin()));
revoke all on table public.solicitacoes_exclusao_conta from public, anon, authenticated;
grant select on table public.solicitacoes_exclusao_conta to authenticated;

create or replace function private.autenticacao_recente_111()
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce((
    select max(to_timestamp((metodo->>'timestamp')::double precision)) >= now()-interval '10 minutes'
    from jsonb_array_elements(coalesce((select auth.jwt())->'amr','[]'::jsonb)) metodo
    where metodo->>'method' in ('password','otp','totp','webauthn','sso/saml','oauth','recovery','reauthentication')
      and metodo->>'timestamp' ~ '^[0-9]+$'
  ),false);
$$;
revoke all on function private.autenticacao_recente_111() from public, anon, authenticated;

create or replace function public.solicitar_exclusao_conta_111(p_motivo text default null)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_tipo text;
  v_id uuid;
  v_data timestamptz;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if not private.autenticacao_recente_111() then raise exception 'RECENT_AUTH_REQUIRED'; end if;
  if char_length(coalesce(p_motivo,'')) > 500 then raise exception 'DELETE_REASON_TOO_LONG'; end if;
  perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':delete-account',0));
  select tipo into v_tipo from public.perfis where id=v_user and ativo for update;
  if not found then raise exception 'PROFILE_NOT_FOUND'; end if;
  if v_tipo='admin' and (select count(*) from public.perfis where tipo='admin' and ativo) <= 1 then
    raise exception 'LAST_ACTIVE_ADMIN';
  end if;
  select id,agendado_para into v_id,v_data from public.solicitacoes_exclusao_conta
  where user_id=v_user and status in ('agendada','processando') order by solicitado_em desc limit 1;
  if found then
    return jsonb_build_object('id',v_id,'status','agendada','agendado_para',v_data,'reutilizado',true);
  end if;
  v_data := now()+interval '7 days';
  insert into public.solicitacoes_exclusao_conta(user_id,user_hash,status,agendado_para,motivo)
  values(
    v_user,encode(extensions.digest(convert_to(v_user::text || ':barberhub-delete','utf8'),'sha256'),'hex'),
    'agendada',v_data,nullif(trim(coalesce(p_motivo,'')),'')
  ) returning id into v_id;
  return jsonb_build_object('id',v_id,'status','agendada','agendado_para',v_data,'reutilizado',false);
end;
$$;

create or replace function public.cancelar_exclusao_conta_111()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_user uuid := (select auth.uid()); v_id uuid;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  update public.solicitacoes_exclusao_conta
  set status='cancelada',cancelado_em=now(),erro_codigo=null
  where user_id=v_user and status='agendada'
  returning id into v_id;
  if v_id is null then return jsonb_build_object('status','sem_solicitacao'); end if;
  return jsonb_build_object('id',v_id,'status','cancelada');
end;
$$;

create or replace function public.status_exclusao_conta_111()
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce((
    select jsonb_build_object(
      'id',s.id,'status',s.status,'solicitado_em',s.solicitado_em,
      'agendado_para',s.agendado_para,'cancelado_em',s.cancelado_em,
      'executado_em',s.executado_em
    ) from public.solicitacoes_exclusao_conta s
    where s.user_id=(select auth.uid()) order by s.solicitado_em desc limit 1
  ),jsonb_build_object('status','sem_solicitacao'));
$$;

revoke all on function public.solicitar_exclusao_conta_111(text) from public, anon;
revoke all on function public.cancelar_exclusao_conta_111() from public, anon;
revoke all on function public.status_exclusao_conta_111() from public, anon;
grant execute on function public.solicitar_exclusao_conta_111(text) to authenticated, service_role;
grant execute on function public.cancelar_exclusao_conta_111() to authenticated, service_role;
grant execute on function public.status_exclusao_conta_111() to authenticated, service_role;

create or replace function private.executar_exclusao_conta_111(p_user uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_user is null then raise exception 'USER_REQUIRED'; end if;

  -- Antes da identidade do proprietário ser removida, libera a agenda e cria
  -- os avisos usuais para os clientes por meio do gatilho de status existente.
  update public.agendamentos a
  set status='cancelado',
      cancelamento_motivo='Estabelecimento encerrado pelo titular',
      updated_at=now()
  from public.estabelecimentos e
  where e.owner_id=p_user
    and a.estabelecimento_id=e.id
    and a.status in ('pendente','confirmado')
    and ((a.data+a.hora_inicio) at time zone e.timezone)>now();

  update public.agendamentos set
    cliente_id=null,cliente_nome='Conta removida',cliente_email='conta-removida@barberhub.invalid',
    cliente_telefone=null,observacao=null
  where cliente_id=p_user;
  update public.clientes_estabelecimento set
    cliente_id=null,nome='Conta removida',email=null,email_normalizado=null,telefone=null,
    preferencias=null,tags='{}'::text[],permite_whatsapp=false
  where cliente_id=p_user;
  update public.avaliacoes set
    cliente_id=null,comentario=case when comentario='' then '' else 'Conteúdo removido pelo titular.' end
  where cliente_id=p_user;
  update public.tickets_suporte set user_id=null,nome='Conta removida',email='conta-removida@barberhub.invalid'
  where user_id=p_user;
  update public.profissionais set
    user_id=null,nome='Profissional removido',email=null,telefone=null,bio=null,avatar_url=null,ativo=false
  where user_id=p_user;
  update public.estabelecimentos set
    visivel=false,onboarding_concluido=false,status_manual='fechado',motivo_status='Conta encerrada',
    email_publico=null,telefone=null,whatsapp=null,instagram=null,website=null,
    foto_url=null,capa_url=null,encerrado_em=now(),encerramento_motivo='Exclusão solicitada pelo titular'
  where owner_id=p_user;

  -- Arquivos e identidade Auth são removidos pelo worker da API. O schema
  -- storage é somente leitura: apagar suas linhas por SQL deixaria objetos
  -- físicos órfãos no provedor.
end;
$$;
revoke all on function private.executar_exclusao_conta_111(uuid) from public, anon, authenticated;

create or replace function public.reservar_exclusoes_conta_111(p_limite integer default 10)
returns table(solicitacao_id uuid,user_id uuid)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_limite is null or p_limite not between 1 and 50 then raise exception 'LIMIT_INVALID'; end if;
  return query
  with candidatas as (
    select s.id
    from public.solicitacoes_exclusao_conta s
    where s.user_id is not null
      and s.tentativas<10
      and (
        (s.status in ('agendada','falhou') and s.agendado_para<=now())
        or (s.status='processando' and s.updated_at<now()-interval '30 minutes')
      )
    order by s.agendado_para,s.id
    for update skip locked
    limit p_limite
  )
  update public.solicitacoes_exclusao_conta s
  set status='processando',tentativas=s.tentativas+1,erro_codigo=null
  from candidatas c
  where s.id=c.id
  returning s.id,s.user_id;
end;
$$;
revoke all on function public.reservar_exclusoes_conta_111(integer) from public,anon,authenticated;
grant execute on function public.reservar_exclusoes_conta_111(integer) to service_role;

create or replace function public.listar_arquivos_conta_exclusao_111(
  p_solicitacao_id uuid,p_user_id uuid,p_limite integer default 100
)
returns table(bucket_id text,nome text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_limite is null or p_limite not between 1 and 100 then raise exception 'LIMIT_INVALID'; end if;
  if not exists(
    select 1 from public.solicitacoes_exclusao_conta s
    where s.id=p_solicitacao_id and s.user_id=p_user_id and s.status='processando'
  ) then raise exception 'DELETE_JOB_INVALID'; end if;
  return query
  select o.bucket_id::text,o.name::text
  from storage.objects o
  where o.owner_id::text=p_user_id::text or o.name like p_user_id::text || '/%'
  order by o.bucket_id,o.name
  limit p_limite;
end;
$$;
revoke all on function public.listar_arquivos_conta_exclusao_111(uuid,uuid,integer) from public,anon,authenticated;
grant execute on function public.listar_arquivos_conta_exclusao_111(uuid,uuid,integer) to service_role;

create or replace function public.anonimizar_conta_exclusao_111(
  p_solicitacao_id uuid,p_user_id uuid
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  perform 1 from public.solicitacoes_exclusao_conta s
  where s.id=p_solicitacao_id and s.user_id=p_user_id and s.status='processando'
  for update;
  if not found then raise exception 'DELETE_JOB_INVALID'; end if;
  perform private.executar_exclusao_conta_111(p_user_id);
  return jsonb_build_object('anonimizada',true);
end;
$$;
revoke all on function public.anonimizar_conta_exclusao_111(uuid,uuid) from public,anon,authenticated;
grant execute on function public.anonimizar_conta_exclusao_111(uuid,uuid) to service_role;

create or replace function public.concluir_exclusao_conta_111(p_solicitacao_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  update public.solicitacoes_exclusao_conta
  set status='concluida',executado_em=now(),erro_codigo=null,user_id=null
  where id=p_solicitacao_id and status='processando'
  returning id into v_id;
  if v_id is null then raise exception 'DELETE_JOB_INVALID'; end if;
  return jsonb_build_object('id',v_id,'status','concluida');
end;
$$;
revoke all on function public.concluir_exclusao_conta_111(uuid) from public,anon,authenticated;
grant execute on function public.concluir_exclusao_conta_111(uuid) to service_role;

create or replace function public.falhar_exclusao_conta_111(p_solicitacao_id uuid,p_erro_codigo text)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  update public.solicitacoes_exclusao_conta
  set status='falhou',erro_codigo=left(coalesce(nullif(trim(p_erro_codigo),''),'WORKER_ERROR'),80)
  where id=p_solicitacao_id and status='processando'
  returning id into v_id;
  if v_id is null then raise exception 'DELETE_JOB_INVALID'; end if;
  return jsonb_build_object('id',v_id,'status','falhou');
end;
$$;
revoke all on function public.falhar_exclusao_conta_111(uuid,text) from public,anon,authenticated;
grant execute on function public.falhar_exclusao_conta_111(uuid,text) to service_role;

drop function if exists public.processar_exclusoes_conta_111(integer);

-- A exclusão imediata antiga apagava metadados do Storage diretamente por SQL.
-- Ela é removida por completo: todo encerramento passa pelo prazo de segurança
-- e pelo worker que usa as APIs oficiais de Storage e Auth.
drop function if exists public.excluir_minha_conta();

-- ============================================================
-- 4. PORTABILIDADE DE DADOS E SESSÕES DA PRÓPRIA CONTA
-- A exportação nunca inclui senha, hash de senha, token ou segredo de push.
-- ============================================================

create or replace function public.exportar_meus_dados_111()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user uuid := (select auth.uid());
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  return jsonb_build_object(
    'gerado_em',now(),
    'perfil',(select to_jsonb(p)-'acessibilidade' from public.perfis p where p.id=v_user),
    'acessibilidade',(select p.acessibilidade from public.perfis p where p.id=v_user),
    'estabelecimentos',coalesce((
      select jsonb_agg(to_jsonb(e)-'search_vector' order by e.created_at)
      from public.estabelecimentos e where e.owner_id=v_user
    ),'[]'::jsonb),
    'vinculos_equipe',coalesce((
      select jsonb_agg(jsonb_build_object(
        'estabelecimento_id',m.estabelecimento_id,'papel',m.papel,'status',m.status,
        'aceito_em',m.aceito_em,'created_at',m.created_at
      ) order by m.created_at) from public.estabelecimento_membros m where m.user_id=v_user
    ),'[]'::jsonb),
    'agendamentos',coalesce((
      select jsonb_agg(to_jsonb(a)-'idempotencia_hash'-'chave_idempotencia' order by a.created_at)
      from public.agendamentos a where a.cliente_id=v_user
    ),'[]'::jsonb),
    'favoritos',coalesce((
      select jsonb_agg(to_jsonb(f) order by f.created_at) from public.favoritos f where f.cliente_id=v_user
    ),'[]'::jsonb),
    'avaliacoes',coalesce((
      select jsonb_agg(to_jsonb(a) order by a.created_at) from public.avaliacoes a where a.cliente_id=v_user
    ),'[]'::jsonb),
    'suporte',coalesce((
      select jsonb_agg(to_jsonb(t) order by t.created_at) from public.tickets_suporte t where t.user_id=v_user
    ),'[]'::jsonb),
    'consentimentos',coalesce((
      select jsonb_agg(to_jsonb(c)-'user_hash' order by c.created_at)
      from public.consentimentos_usuario c where c.user_id=v_user
    ),'[]'::jsonb),
    'preferencias_de_avisos',coalesce((
      select jsonb_agg(to_jsonb(p) order by p.created_at) from public.push_preferencias p where p.user_id=v_user
    ),'[]'::jsonb),
    'resumo_atividade_profissional',coalesce((
      select jsonb_agg(jsonb_build_object(
        'profissional_id',p.id,'estabelecimento_id',p.estabelecimento_id,
        'atendimentos',(select count(*) from public.agendamentos a where a.profissional_id=p.id)
      ) order by p.created_at) from public.profissionais p where p.user_id=v_user
    ),'[]'::jsonb)
  );
end;
$$;
revoke all on function public.exportar_meus_dados_111() from public, anon;
grant execute on function public.exportar_meus_dados_111() to authenticated, service_role;

create or replace function public.listar_minhas_sessoes_111()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_user uuid := (select auth.uid()); v_current text := (select auth.jwt())->>'session_id';
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',s.id,
      'atual',s.id::text=v_current,
      'criada_em',to_jsonb(s)->>'created_at',
      'atualizada_em',to_jsonb(s)->>'updated_at',
      'expira_em',to_jsonb(s)->>'not_after',
      'dispositivo',coalesce(to_jsonb(s)->>'user_agent','Dispositivo não identificado'),
      'ip',case
        when coalesce(to_jsonb(s)->>'ip','') ~ '^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$'
          then regexp_replace(to_jsonb(s)->>'ip','^([0-9]+\.[0-9]+)\.[0-9]+\.[0-9]+$','\1.*.*')
        when nullif(to_jsonb(s)->>'ip','') is not null
          then left(to_jsonb(s)->>'ip',8)||':*'
        else null end,
      'nivel',to_jsonb(s)->>'aal'
    ) order by coalesce(to_jsonb(s)->>'updated_at',to_jsonb(s)->>'created_at') desc)
    from auth.sessions s where s.user_id=v_user
  ),'[]'::jsonb);
end;
$$;
revoke all on function public.listar_minhas_sessoes_111() from public, anon;
grant execute on function public.listar_minhas_sessoes_111() to authenticated, service_role;

-- ============================================================
-- 5. AGENDAMENTO IDEMPOTENTE, CONCORRÊNCIA E AUTOAGENDAMENTO
-- O visitante monta o pedido antes do login; a gravação final é autenticada.
-- ============================================================

create or replace function private.usuario_opera_estabelecimento_111(p_user uuid,p_estabelecimento uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_user is not null and exists(
    select 1 from public.estabelecimentos e where e.id=p_estabelecimento and e.owner_id=p_user
    union all
    select 1 from public.profissionais p
      where p.estabelecimento_id=p_estabelecimento and p.user_id=p_user and p.ativo
    union all
    select 1 from public.estabelecimento_membros m
      where m.estabelecimento_id=p_estabelecimento and m.user_id=p_user and m.status='ativo'
  );
$$;
revoke all on function private.usuario_opera_estabelecimento_111(uuid,uuid) from public, anon, authenticated;

-- A interface pode consultar todos os próprios vínculos em uma única chamada,
-- sem receber dados da equipe nem depender de esconder ações somente no CSS.
create or replace function public.listar_meus_estabelecimentos_operados_111()
returns table(estabelecimento_id uuid)
language sql
stable
security definer
set search_path = ''
as $$
  select distinct vinculo.estabelecimento_id
  from (
    select e.id as estabelecimento_id
    from public.estabelecimentos e
    where e.owner_id=(select auth.uid())
    union all
    select p.estabelecimento_id
    from public.profissionais p
    where p.user_id=(select auth.uid()) and p.ativo
    union all
    select m.estabelecimento_id
    from public.estabelecimento_membros m
    where m.user_id=(select auth.uid()) and m.status='ativo'
  ) vinculo
  where (select auth.uid()) is not null;
$$;
revoke all on function public.listar_meus_estabelecimentos_operados_111() from public,anon;
grant execute on function public.listar_meus_estabelecimentos_operados_111() to authenticated,service_role;

create or replace function private.bloquear_autoagendamento_111()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.cliente_id is not null
     and new.cliente_id=(select auth.uid())
     and private.usuario_opera_estabelecimento_111(new.cliente_id,new.estabelecimento_id) then
    raise exception 'OWN_ESTABLISHMENT_BOOKING_FORBIDDEN';
  end if;
  return new;
end;
$$;
revoke all on function private.bloquear_autoagendamento_111() from public, anon, authenticated;

drop trigger if exists agendamentos_bloquear_autoagendamento_111 on public.agendamentos;
create trigger agendamentos_bloquear_autoagendamento_111
before insert or update of cliente_id,estabelecimento_id on public.agendamentos
for each row execute function private.bloquear_autoagendamento_111();
drop trigger if exists lista_espera_bloquear_autoagendamento_111 on public.lista_espera;
create trigger lista_espera_bloquear_autoagendamento_111
before insert or update of cliente_id,estabelecimento_id on public.lista_espera
for each row execute function private.bloquear_autoagendamento_111();

create or replace function public.criar_agendamento_idempotente_111(
  p_estabelecimento_id uuid,
  p_profissional_id uuid,
  p_servicos_ids uuid[],
  p_data date,
  p_hora_inicio time,
  p_observacao text default null,
  p_cupom_codigo text default null,
  p_chave_idempotencia text default null,
  p_idempotencia_hash text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_chave text := nullif(trim(coalesce(p_chave_idempotencia,'')),'');
  v_hash text;
  v_existente public.agendamentos%rowtype;
  v_id uuid;
  v_timezone text;
  v_duracao integer;
  v_inicio timestamptz;
  v_fim timestamptz;
begin
  if v_user is null then raise exception 'AUTH_REQUIRED'; end if;
  if v_chave is null or char_length(v_chave) not between 8 and 128
     or v_chave !~ '^[A-Za-z0-9._:-]+$' then raise exception 'IDEMPOTENCY_KEY_INVALID'; end if;
  if p_servicos_ids is null or cardinality(p_servicos_ids)<1 or cardinality(p_servicos_ids)>8 then
    raise exception 'SERVICES_INVALID';
  end if;
  if private.usuario_opera_estabelecimento_111(v_user,p_estabelecimento_id) then
    raise exception 'OWN_ESTABLISHMENT_BOOKING_FORBIDDEN';
  end if;

  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'user_id',v_user,'estabelecimento_id',p_estabelecimento_id,'profissional_id',p_profissional_id,
    'servicos_ids',p_servicos_ids,'data',p_data,'hora_inicio',p_hora_inicio,
    'observacao',nullif(trim(coalesce(p_observacao,'')),''),
    'cupom_codigo',nullif(lower(trim(coalesce(p_cupom_codigo,''))),'')
  )::text,'utf8'),'sha256'),'hex');
  if nullif(trim(coalesce(p_idempotencia_hash,'')),'') is not null
     and lower(trim(p_idempotencia_hash))<>v_hash then raise exception 'IDEMPOTENCY_HASH_MISMATCH'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_estabelecimento_id::text || ':' || v_user::text || ':booking:' || v_chave,0
  ));
  select * into v_existente from public.agendamentos a
  where a.estabelecimento_id=p_estabelecimento_id and a.chave_idempotencia=v_chave;
  if found then
    if v_existente.cliente_id is distinct from v_user or v_existente.idempotencia_hash is distinct from v_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return jsonb_build_object('id',v_existente.id,'reutilizado',true,'status',v_existente.status);
  end if;

  select e.timezone into v_timezone from public.estabelecimentos e where e.id=p_estabelecimento_id;
  select sum(s.duracao_min)::integer into v_duracao from public.servicos s
  where s.id=any(p_servicos_ids) and s.estabelecimento_id=p_estabelecimento_id and s.ativo and s.publico;
  if v_timezone is null or v_duracao is null then raise exception 'BOOKING_RESOURCE_UNAVAILABLE'; end if;
  v_inicio := (p_data+p_hora_inicio) at time zone v_timezone;
  v_fim := v_inicio+make_interval(mins=>v_duracao);
  if exists(
    select 1 from public.agenda_bloqueios b
    where b.estabelecimento_id=p_estabelecimento_id
      and (b.profissional_id is null or b.profissional_id=p_profissional_id)
      and v_inicio<b.fim and v_fim>b.inicio
  ) then raise exception 'SLOT_BLOCKED'; end if;

  begin
    v_id:=public.criar_agendamento_com_cupom_193(
      p_estabelecimento_id,p_profissional_id,p_servicos_ids,p_data,p_hora_inicio,p_observacao,p_cupom_codigo
    );
  exception when exclusion_violation or unique_violation then
    raise exception 'SLOT_CONFLICT';
  end;
  update public.agendamentos set
    chave_idempotencia=v_chave,idempotencia_hash=v_hash,canal_origem='marketplace'
  where id=v_id;
  return jsonb_build_object('id',v_id,'reutilizado',false,'status','pendente');
end;
$$;
revoke all on function public.criar_agendamento_idempotente_111(uuid,uuid,uuid[],date,time,text,text,text,text) from public, anon;
grant execute on function public.criar_agendamento_idempotente_111(uuid,uuid,uuid[],date,time,text,text,text,text) to authenticated, service_role;

-- Clientes novos usam a porta 111. As assinaturas antigas ficam disponíveis
-- durante esta release de compatibilidade para não quebrar uma PWA em cache;
-- os triggers de identidade acima continuam bloqueando autoagendamento nelas.
grant execute on function public.criar_agendamento(uuid,uuid,uuid,date,time,text) to authenticated, service_role;
grant execute on function public.criar_agendamento_multisservico(uuid,uuid,uuid[],date,time,text) to authenticated, service_role;
grant execute on function public.criar_agendamento_com_cupom_193(uuid,uuid,uuid[],date,time,text,text) to authenticated, service_role;

-- RPCs idempotentes da 1.10 usam digest sem qualificação e search_path vazio.
-- O caminho fica fechado nos schemas confiáveis e resolve pgcrypto de forma
-- reproduzível depois de sua movimentação para extensions.
do $$
begin
  if to_regprocedure('public.registrar_atendimento_manual_110(uuid,uuid,uuid,text,integer,uuid,text,text,text,timestamp with time zone,numeric,text,text,text,text,text)') is not null then
    alter function public.registrar_atendimento_manual_110(uuid,uuid,uuid,text,integer,uuid,text,text,text,timestamp with time zone,numeric,text,text,text,text,text)
      set search_path = pg_catalog, extensions;
  end if;
  if to_regprocedure('public.registrar_despesa_110(uuid,date,numeric,text,text,text,text,text,text)') is not null then
    alter function public.registrar_despesa_110(uuid,date,numeric,text,text,text,text,text,text)
      set search_path = pg_catalog, extensions;
  end if;
end $$;

-- Uma única consulta regional combina todos os filtros exibidos pelo portal.
-- Tipo, funcionamento e agenda são tri-state (null = qualquer valor), e a
-- agenda retornada usa o entitlement efetivo em vez da configuração isolada.
create or replace function public.buscar_marketplace_regional_111(
  p_busca text default null,
  p_tipo text default null,
  p_status text default null,
  p_agenda boolean default null,
  p_cidade text default null,
  p_bairro text default null,
  p_estado text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_raio_km numeric default null,
  p_servico text default null,
  p_preco_min numeric default null,
  p_preco_max numeric default null,
  p_avaliacao_min numeric default null,
  p_offset integer default 0,
  p_limite integer default 24
)
returns table(
  id uuid,nome text,slug text,descricao text,cidade text,estado char(2),bairro text,endereco text,
  numero text,foto_url text,capa_url text,avaliacao numeric,aceita_agendamento boolean,
  verificado boolean,destaque boolean,latitude numeric,longitude numeric,distancia_km numeric,
  aberto boolean,total_resultados bigint
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.funcionalidade_habilitada_1101('marketplace.regional',null) then
    raise exception 'MARKETPLACE_REGIONAL_DISABLED';
  end if;
  if coalesce(p_tipo,'') not in ('','todos','barbearia','salao') then
    raise exception 'ESTABLISHMENT_TYPE_INVALID';
  end if;
  if coalesce(p_status,'') not in ('','todos','aberta','fechada') then
    raise exception 'OPEN_STATUS_INVALID';
  end if;
  if p_limite is null or p_offset is null
     or p_limite not between 1 and 60 or p_offset not between 0 and 10000 then
    raise exception 'PAGINATION_INVALID';
  end if;
  if char_length(coalesce(p_busca,''))>120
     or char_length(coalesce(p_cidade,''))>120
     or char_length(coalesce(p_bairro,''))>120
     or char_length(coalesce(p_estado,''))>2
     or char_length(coalesce(p_servico,''))>120 then
    raise exception 'SEARCH_FILTER_TOO_LONG';
  end if;
  if (p_latitude is null) <> (p_longitude is null) then
    raise exception 'COORDINATE_PAIR_REQUIRED';
  end if;
  if p_latitude is not null and (
       p_latitude::text='NaN' or p_longitude::text='NaN'
       or p_latitude not between -90 and 90
       or p_longitude not between -180 and 180
     ) then
    raise exception 'COORDINATE_INVALID';
  end if;
  if p_raio_km is not null and p_latitude is null then
    raise exception 'COORDINATE_PAIR_REQUIRED';
  end if;
  if p_raio_km is not null and p_raio_km not between 0.001 and 500 then
    raise exception 'RADIUS_INVALID';
  end if;
  if p_preco_min is not null and (p_preco_min::text='NaN' or p_preco_min < 0 or p_preco_min>1000000)
     or p_preco_max is not null and (p_preco_max::text='NaN' or p_preco_max < 0 or p_preco_max>1000000)
     or p_preco_min is not null and p_preco_max is not null and p_preco_min > p_preco_max then
    raise exception 'PRICE_RANGE_INVALID';
  end if;
  if p_avaliacao_min is not null and p_avaliacao_min not between 0 and 5 then
    raise exception 'RATING_INVALID';
  end if;

  return query
  with base as (
    select
      e.*,
      private.distancia_km_110(p_latitude,p_longitude,e.latitude,e.longitude) as distancia,
      public.estabelecimento_aberto_agora(e.id) as esta_aberto,
      public.agenda_online_disponivel(e.id) as agenda_disponivel
    from public.estabelecimentos e
    where e.visivel
      and e.onboarding_concluido
      and not e.suspenso_pela_moderacao
      and (nullif(p_tipo,'') is null or p_tipo='todos' or e.tipo_estabelecimento=p_tipo)
      and (nullif(trim(coalesce(p_cidade,'')),'') is null or e.cidade ilike trim(p_cidade))
      and (nullif(trim(coalesce(p_bairro,'')),'') is null or e.bairro ilike trim(p_bairro))
      and (nullif(trim(coalesce(p_estado,'')),'') is null or e.estado=upper(trim(p_estado)))
      and (p_avaliacao_min is null or coalesce(e.avaliacao,0)>=p_avaliacao_min)
      and (
        nullif(trim(coalesce(p_busca,'')),'') is null
        or e.nome ilike '%'||trim(p_busca)||'%'
        or e.cidade ilike '%'||trim(p_busca)||'%'
        or e.bairro ilike '%'||trim(p_busca)||'%'
        or e.descricao ilike '%'||trim(p_busca)||'%'
        or exists(
          select 1 from public.servicos s
          where s.estabelecimento_id=e.id and s.ativo and s.publico
            and (s.nome ilike '%'||trim(p_busca)||'%' or s.categoria ilike '%'||trim(p_busca)||'%')
        )
      )
      and (
        nullif(trim(coalesce(p_servico,'')),'') is null
        or exists(
          select 1 from public.servicos s
          where s.estabelecimento_id=e.id and s.ativo and s.publico
            and (s.nome ilike '%'||trim(p_servico)||'%' or s.categoria ilike '%'||trim(p_servico)||'%')
        )
      )
      and (
        (p_preco_min is null and p_preco_max is null)
        or exists(
          select 1 from public.servicos s
          where s.estabelecimento_id=e.id and s.ativo and s.publico
            and (p_preco_min is null or s.preco>=p_preco_min)
            and (p_preco_max is null or s.preco<=p_preco_max)
        )
      )
  ), filtrada as (
    select b.*,count(*) over() as total
    from base b
    where (p_agenda is null or b.agenda_disponivel=p_agenda)
      and (
        nullif(p_status,'') is null or p_status='todos'
        or (p_status='aberta' and b.esta_aberto)
        or (p_status='fechada' and not b.esta_aberto)
      )
      and (p_raio_km is null or b.distancia is not null and b.distancia<=p_raio_km)
  )
  select
    f.id,f.nome,f.slug,f.descricao,f.cidade,f.estado,f.bairro,f.endereco,f.numero,
    f.foto_url,f.capa_url,f.avaliacao,f.agenda_disponivel,f.verificado,f.destaque,
    f.latitude,f.longitude,f.distancia,f.esta_aberto,f.total
  from filtrada f
  order by case when p_latitude is not null then f.distancia end asc nulls last,
    f.agenda_disponivel desc,f.destaque desc,f.avaliacao desc,f.nome,f.id
  offset p_offset limit p_limite;
end;
$$;
revoke all on function public.buscar_marketplace_regional_111(
  text,text,text,boolean,text,text,text,numeric,numeric,numeric,text,numeric,numeric,numeric,integer,integer
) from public;
grant execute on function public.buscar_marketplace_regional_111(
  text,text,text,boolean,text,text,text,numeric,numeric,numeric,text,numeric,numeric,numeric,integer,integer
) to anon,authenticated,service_role;

create index if not exists avaliacoes_publicas_paginadas_111_idx
  on public.avaliacoes(estabelecimento_id,status,created_at desc,id desc)
  where status='publicada';

-- ============================================================
-- 6. FILA DE E-MAIL TRANSACIONAL COM RETENTATIVA E FALLBACK INTERNO
-- O provedor é opcional e configurado exclusivamente no backend.
-- ============================================================

alter table public.push_preferencias
  add column if not exists email_transacional boolean not null default true,
  add column if not exists email_marketing boolean not null default false;

create table if not exists public.fila_emails (
  id uuid primary key default gen_random_uuid(),
  user_id uuid references public.perfis(id) on delete set null,
  notificacao_id uuid references public.notificacoes(id) on delete set null,
  tipo text not null default 'transacional' check (tipo in ('transacional','seguranca','marketing')),
  destinatario text not null check (destinatario ~* '^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$'),
  assunto text not null check (char_length(trim(assunto)) between 2 and 160),
  html text not null check (char_length(html) between 3 and 50000),
  texto text not null check (char_length(texto) between 2 and 10000),
  status text not null default 'pendente'
    check (status in ('pendente','processando','enviado','falhou','descartado')),
  tentativas smallint not null default 0 check (tentativas between 0 and 10),
  proxima_tentativa_em timestamptz not null default now(),
  bloqueado_em timestamptz,
  enviado_em timestamptz,
  erro_codigo text check (erro_codigo is null or char_length(erro_codigo)<=120),
  provedor_id text check (provedor_id is null or char_length(provedor_id)<=240),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(notificacao_id,destinatario)
);
create index if not exists fila_emails_pendentes_111_idx
  on public.fila_emails(status,proxima_tentativa_em,id)
  where status in ('pendente','falhou','processando');
create index if not exists fila_emails_user_created_111_idx
  on public.fila_emails(user_id,created_at desc) where user_id is not null;
create index if not exists fila_emails_notificacao_111_idx
  on public.fila_emails(notificacao_id) where notificacao_id is not null;
drop trigger if exists fila_emails_updated_at_111 on public.fila_emails;
create trigger fila_emails_updated_at_111 before update on public.fila_emails
for each row execute function public.set_updated_at();
alter table public.fila_emails enable row level security;
revoke all on table public.fila_emails from public,anon,authenticated;
grant select,insert,update,delete on table public.fila_emails to service_role;

create or replace function private.escape_html_111(p_text text)
returns text language sql immutable strict security invoker set search_path='' as $$
  select replace(replace(replace(replace(replace(p_text,'&','&amp;'),'<','&lt;'),'>','&gt;'),'"','&quot;'),'''','&#39;');
$$;
revoke all on function private.escape_html_111(text) from public,anon,authenticated;

create or replace function private.enfileirar_email_notificacao_111()
returns trigger
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_email text; v_marketing boolean:=false; v_permite boolean:=true;
begin
  select lower(trim(p.email)) into v_email from public.perfis p where p.id=new.user_id and p.ativo;
  if v_email is null then return new; end if;
  v_marketing:=new.tipo='sistema' and (
    lower(new.titulo||' '||new.mensagem) like '%campanha%'
    or coalesce(new.dados->>'finalidade','')='marketing'
  );
  select case when v_marketing then coalesce(pp.email_marketing,false)
              else coalesce(pp.email_transacional,true) end
  into v_permite from public.push_preferencias pp
  where pp.user_id=new.user_id and pp.estabelecimento_id is null limit 1;
  if not coalesce(v_permite,not v_marketing) then return new; end if;
  if v_marketing or new.tipo in ('agendamento','suporte','sistema') then
    insert into public.fila_emails(user_id,notificacao_id,tipo,destinatario,assunto,html,texto)
    values(
      new.user_id,new.id,case when v_marketing then 'marketing' when new.tipo='sistema' then 'seguranca' else 'transacional' end,
      v_email,left(new.titulo,160),
      '<p><strong>'||private.escape_html_111(new.titulo)||'</strong></p><p>'||private.escape_html_111(new.mensagem)||'</p>',
      new.titulo||E'\n\n'||new.mensagem
    ) on conflict(notificacao_id,destinatario) do nothing;
  end if;
  return new;
end;
$$;
revoke all on function private.enfileirar_email_notificacao_111() from public,anon,authenticated;
drop trigger if exists notificacoes_enfileirar_email_111 on public.notificacoes;
create trigger notificacoes_enfileirar_email_111
after insert on public.notificacoes for each row execute function private.enfileirar_email_notificacao_111();

create or replace function public.reservar_emails_pendentes_111(p_limite integer default 25)
returns table(id uuid,destinatario text,assunto text,html text,texto text)
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_limite not between 1 and 100 then raise exception 'LIMIT_INVALID'; end if;
  return query with candidatos as (
    select e.id from public.fila_emails e
    where (
      e.status in ('pendente','falhou') and e.proxima_tentativa_em<=now()
    ) or (e.status='processando' and e.bloqueado_em<now()-interval '15 minutes')
    order by e.proxima_tentativa_em,e.id for update skip locked limit p_limite
  ), reservados as (
    update public.fila_emails e set
      status='processando',tentativas=least(e.tentativas+1,10),bloqueado_em=now(),erro_codigo=null
    from candidatos c where e.id=c.id
    returning e.id,e.destinatario,e.assunto,e.html,e.texto
  ) select r.id,r.destinatario,r.assunto,r.html,r.texto from reservados r;
end;
$$;

create or replace function public.finalizar_email_pendente_111(
  p_email_id uuid,p_sucesso boolean,p_erro_codigo text default null,p_provedor_id text default null
)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  update public.fila_emails e set
    status=case when p_sucesso then 'enviado' when e.tentativas>=10 then 'descartado' else 'falhou' end,
    enviado_em=case when p_sucesso then now() else e.enviado_em end,
    bloqueado_em=null,
    erro_codigo=case when p_sucesso then null else left(coalesce(p_erro_codigo,'DELIVERY_FAILED'),120) end,
    provedor_id=case when p_sucesso then left(nullif(trim(coalesce(p_provedor_id,'')),''),240) else e.provedor_id end,
    proxima_tentativa_em=case when p_sucesso then e.proxima_tentativa_em
      else now()+make_interval(mins=>least(1440,(power(2,least(e.tentativas,8))::integer)*5)) end
  where e.id=p_email_id and e.status='processando';
  if not found then raise exception 'EMAIL_NOT_RESERVED'; end if;
end;
$$;
revoke all on function public.reservar_emails_pendentes_111(integer) from public,anon,authenticated;
revoke all on function public.finalizar_email_pendente_111(uuid,boolean,text,text) from public,anon,authenticated;
grant execute on function public.reservar_emails_pendentes_111(integer) to service_role;
grant execute on function public.finalizar_email_pendente_111(uuid,boolean,text,text) to service_role;

-- ============================================================
-- 7. RETENÇÃO EXECUTÁVEL, PREPARAÇÃO DE COBRANÇA E ADVISORS
-- ============================================================

create table if not exists public.politicas_retencao_dados (
  recurso text primary key,
  retencao_dias integer not null check (retencao_dias between 1 and 3650),
  acao_final text not null check (acao_final in ('excluir','anonimizar','revisar')),
  fundamento text not null check (char_length(trim(fundamento)) between 5 and 240),
  ativa boolean not null default true,
  updated_at timestamptz not null default now()
);
insert into public.politicas_retencao_dados(recurso,retencao_dias,acao_final,fundamento)
values
  ('fila_email_entregue',90,'excluir','Registro técnico de entrega após confirmação.'),
  ('entrega_push_finalizada',90,'excluir','Registro técnico de entrega após confirmação ou descarte.'),
  ('limite_api_expirado',2,'excluir','Janela técnica curta para proteção contra abuso.'),
  ('solicitacao_exclusao',730,'anonimizar','Comprovação do atendimento ao pedido do titular.'),
  ('auditoria_operacional',1825,'revisar','Rastreabilidade, segurança e obrigações do negócio.'),
  ('consentimento',1825,'revisar','Comprovação da escolha e da versão apresentada ao titular.')
on conflict(recurso) do update set
  retencao_dias=excluded.retencao_dias,acao_final=excluded.acao_final,
  fundamento=excluded.fundamento,ativa=true,updated_at=now();
alter table public.politicas_retencao_dados enable row level security;
drop policy if exists politicas_retencao_admin_111 on public.politicas_retencao_dados;
create policy politicas_retencao_admin_111 on public.politicas_retencao_dados
for select to authenticated using ((select public.is_admin()));
revoke all on table public.politicas_retencao_dados from public,anon,authenticated;
grant select on table public.politicas_retencao_dados to authenticated;

create or replace function public.executar_retencao_tecnica_111()
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare v_email integer:=0; v_push integer:=0; v_rate integer:=0;
begin
  delete from public.fila_emails
  where status in ('enviado','descartado') and updated_at<now()-interval '90 days';
  get diagnostics v_email=row_count;
  delete from public.push_entregas
  where status in ('enviada','descartada') and updated_at<now()-interval '90 days';
  get diagnostics v_push=row_count;
  delete from public.api_rate_limits where updated_at<now()-interval '2 days';
  get diagnostics v_rate=row_count;
  return jsonb_build_object('emails',v_email,'push',v_push,'limites_api',v_rate,'executado_em',now());
end;
$$;
revoke all on function public.executar_retencao_tecnica_111() from public,anon,authenticated;
grant execute on function public.executar_retencao_tecnica_111() to service_role;

alter table public.assinaturas
  add column if not exists carencia_ate timestamptz,
  add column if not exists ultima_confirmacao_pagamento_em timestamptz,
  add column if not exists proxima_cobranca_em timestamptz,
  add column if not exists falhas_cobranca smallint not null default 0;
alter table public.assinaturas drop constraint if exists assinaturas_provedor_pagamento_111_check;
alter table public.assinaturas add constraint assinaturas_provedor_pagamento_111_check
  check (provedor is null or provedor ~ '^[a-z0-9][a-z0-9_-]{1,39}$');
alter table public.assinaturas drop constraint if exists assinaturas_falhas_cobranca_111_check;
alter table public.assinaturas add constraint assinaturas_falhas_cobranca_111_check
  check (falhas_cobranca between 0 and 20);
create unique index if not exists assinaturas_provedor_externo_111_idx
  on public.assinaturas(provedor,referencia_externa)
  where provedor is not null and referencia_externa is not null;

create table if not exists public.assinatura_eventos (
  id uuid primary key default gen_random_uuid(),
  assinatura_id uuid not null references public.assinaturas(id) on delete cascade,
  ator_id uuid references public.perfis(id) on delete set null,
  origem text not null default 'sistema' check (origem in ('sistema','administracao','provedor')),
  chave_idempotencia text check (chave_idempotencia is null or char_length(chave_idempotencia) between 16 and 100),
  tipo text not null check (tipo in ('criada','ativada','renovada','pagamento_falhou','carencia','cancelamento_solicitado','cancelada','plano_alterado','estornada')),
  provedor_evento_id text,
  dados jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);
alter table public.assinatura_eventos
  add column if not exists ator_id uuid references public.perfis(id) on delete set null,
  add column if not exists origem text not null default 'sistema',
  add column if not exists chave_idempotencia text;
alter table public.assinatura_eventos drop constraint if exists assinatura_eventos_origem_111_check;
alter table public.assinatura_eventos add constraint assinatura_eventos_origem_111_check
  check (origem in ('sistema','administracao','provedor'));
alter table public.assinatura_eventos drop constraint if exists assinatura_eventos_chave_111_check;
alter table public.assinatura_eventos add constraint assinatura_eventos_chave_111_check
  check (chave_idempotencia is null or (
    char_length(chave_idempotencia) between 16 and 100
    and chave_idempotencia ~ '^[A-Za-z0-9._:-]+$'
  ));
create unique index if not exists assinatura_eventos_provedor_unique_111_idx
  on public.assinatura_eventos(provedor_evento_id) where provedor_evento_id is not null;
create unique index if not exists assinatura_eventos_admin_idempotencia_111_idx
  on public.assinatura_eventos(ator_id,chave_idempotencia)
  where origem='administracao' and ator_id is not null and chave_idempotencia is not null;
create index if not exists assinatura_eventos_assinatura_created_111_idx
  on public.assinatura_eventos(assinatura_id,created_at desc,id);
alter table public.assinatura_eventos enable row level security;
revoke all on table public.assinatura_eventos from public,anon,authenticated;
grant select,insert on table public.assinatura_eventos to service_role;

-- Atribuição administrativa confiável: serializa mudanças do mesmo negócio,
-- valida datas e impede eventos duplicados quando a interface repete a mesma
-- solicitação após uma falha de rede. A RPC anterior continua disponível para
-- clientes em cache durante a janela de compatibilidade da API interna.
create or replace function public.admin_atribuir_plano_111(
  p_estabelecimento_id uuid,
  p_plano_slug text,
  p_status text default 'ativa',
  p_periodo_fim date default null,
  p_observacoes text default null,
  p_chave_idempotencia text default null
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_chave text := nullif(trim(coalesce(p_chave_idempotencia,'')),'');
  v_evento public.assinatura_eventos%rowtype;
  v_assinatura public.assinaturas%rowtype;
  v_entitlements jsonb;
  v_antes jsonb;
  v_requisicao_hash text := md5(concat_ws(chr(31),
    p_estabelecimento_id::text,
    coalesce(p_plano_slug,''),
    coalesce(p_status,''),
    coalesce(p_periodo_fim::text,''),
    coalesce(p_observacoes,'')
  ));
begin
  if v_user is null or not public.is_admin() then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if v_chave is not null and (
    char_length(v_chave) not between 16 and 100 or v_chave !~ '^[A-Za-z0-9._:-]+$'
  ) then
    raise exception 'IDEMPOTENCY_KEY_INVALID';
  end if;
  if p_status not in ('teste','ativa','atrasada','pausada','cancelada','expirada') then
    raise exception 'SUBSCRIPTION_STATUS_INVALID';
  end if;
  if p_status in ('teste','ativa') and p_periodo_fim is not null and p_periodo_fim < current_date then
    raise exception 'SUBSCRIPTION_END_DATE_INVALID';
  end if;
  if char_length(coalesce(p_observacoes,'')) > 800 then
    raise exception 'SUBSCRIPTION_NOTE_TOO_LONG';
  end if;

  if v_chave is not null then
    -- A mesma chave não pode atravessar negócios nem representar outro pedido.
    perform pg_advisory_xact_lock(hashtextextended(v_user::text || ':admin-sub:' || v_chave,0));
    select * into v_evento
    from public.assinatura_eventos e
    where e.ator_id=v_user and e.origem='administracao' and e.chave_idempotencia=v_chave
    limit 1;
    if found then
      select * into v_assinatura from public.assinaturas where id=v_evento.assinatura_id;
      if v_assinatura.estabelecimento_id is distinct from p_estabelecimento_id
         or coalesce(v_evento.dados->>'requisicao_hash','') <> v_requisicao_hash then
        raise exception 'IDEMPOTENCY_KEY_REUSED';
      end if;
      return jsonb_build_object(
        'reutilizado',true,
        'assinatura',to_jsonb(v_assinatura),
        'entitlements',public.calcular_entitlements_estabelecimento(p_estabelecimento_id)
      );
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(p_estabelecimento_id::text || ':subscription',0));

  v_antes:=public.calcular_entitlements_estabelecimento(p_estabelecimento_id);
  v_entitlements:=public.admin_atribuir_plano(
    p_estabelecimento_id,p_plano_slug,p_status,p_periodo_fim,p_observacoes
  );
  select * into v_assinatura
  from public.assinaturas where estabelecimento_id=p_estabelecimento_id;

  insert into public.assinatura_eventos(
    assinatura_id,ator_id,origem,chave_idempotencia,tipo,dados
  ) values (
    v_assinatura.id,v_user,'administracao',v_chave,
    case when p_status='cancelada' then 'cancelada'
         when p_status='ativa' then 'ativada'
         else 'plano_alterado' end,
    jsonb_build_object(
      'plano_anterior',v_antes->>'plano_contratado_slug',
      'plano_novo',p_plano_slug,
      'status_anterior',v_antes->>'assinatura_status',
      'status_novo',p_status,
      'periodo_fim',p_periodo_fim,
      'requisicao_hash',v_requisicao_hash
    )
  );

  return jsonb_build_object(
    'reutilizado',false,
    'assinatura',to_jsonb(v_assinatura),
    'entitlements',v_entitlements
  );
end;
$$;
revoke all on function public.admin_atribuir_plano_111(uuid,text,text,date,text,text) from public,anon;
grant execute on function public.admin_atribuir_plano_111(uuid,text,text,date,text,text) to authenticated,service_role;

-- O cliente ou a equipe pode encerrar uma série sem apagar histórico. Apenas
-- horários futuros ainda ativos são liberados; atendimentos concluídos ficam
-- preservados para financeiro, auditoria e avaliações.
create or replace function public.cancelar_recorrencia_agendamento_111(p_recorrencia_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_recorrencia public.agendamentos_recorrencias%rowtype;
  v_cancelados integer := 0;
begin
  if v_user is null then raise exception 'UNAUTHORIZED'; end if;

  select * into v_recorrencia
  from public.agendamentos_recorrencias
  where id=p_recorrencia_id
  for update;
  if not found then raise exception 'RECURRENCE_NOT_FOUND'; end if;
  if v_recorrencia.cliente_id is distinct from v_user
     and not private.pode_operar_estabelecimento_19(v_recorrencia.estabelecimento_id) then
    raise exception 'RECURRENCE_FORBIDDEN';
  end if;
  if v_recorrencia.status not in ('ativa','pausada') then
    raise exception 'RECURRENCE_ALREADY_FINISHED';
  end if;

  update public.agendamentos_recorrencias
  set status='cancelada',updated_at=now()
  where id=p_recorrencia_id;

  update public.agendamentos a
  set status='cancelado',
      cancelamento_motivo='Recorrência encerrada pelo usuário',
      updated_at=now()
  from public.estabelecimentos e
  where a.recorrencia_id=p_recorrencia_id
    and e.id=a.estabelecimento_id
    and a.status in ('pendente','confirmado')
    and ((a.data+a.hora_inicio) at time zone e.timezone) > now();
  get diagnostics v_cancelados = row_count;

  return jsonb_build_object(
    'id',p_recorrencia_id,
    'status','cancelada',
    'agendamentos_cancelados',v_cancelados
  );
end;
$$;
revoke all on function public.cancelar_recorrencia_agendamento_111(uuid) from public,anon;
grant execute on function public.cancelar_recorrencia_agendamento_111(uuid) to authenticated,service_role;

-- A função legada continua durante a janela de cache, agora com resolução de
-- objetos imune a alterações de search_path.
alter function public.admin_atribuir_plano(uuid,text,text,date,text) set search_path = '';
revoke execute on function public.admin_atribuir_plano(uuid,text,text,date,text) from authenticated;
grant execute on function public.admin_atribuir_plano(uuid,text,text,date,text) to service_role;

-- Índices ausentes apontados pelo Performance Advisor em 09/09/2026.
create index if not exists agendamentos_registrado_por_111_idx on public.agendamentos(registrado_por) where registrado_por is not null;
create index if not exists auditoria_operacional_ator_111_idx on public.auditoria_operacional(ator_id) where ator_id is not null;
create index if not exists feature_flag_alvos_definido_por_111_idx on public.feature_flag_alvos(definido_por) where definido_por is not null;
create index if not exists feature_flags_updated_by_111_idx on public.feature_flags(updated_by) where updated_by is not null;
create index if not exists importacoes_operacionais_solicitado_por_111_idx on public.importacoes_operacionais(solicitado_por);
create index if not exists push_assinaturas_estabelecimento_111_idx on public.push_assinaturas(estabelecimento_id) where estabelecimento_id is not null;
create index if not exists push_entregas_assinatura_111_idx on public.push_entregas(assinatura_id);
create index if not exists push_entregas_user_111_idx on public.push_entregas(user_id);
create index if not exists push_preferencias_estabelecimento_111_idx on public.push_preferencias(estabelecimento_id) where estabelecimento_id is not null;

-- Uma única política SELECT evita avaliação duplicada no catálogo de capas.
drop policy if exists biblioteca_capas_publicas_110 on public.biblioteca_capas;
drop policy if exists biblioteca_capas_admin_110 on public.biblioteca_capas;
drop policy if exists biblioteca_capas_admin_insert_111 on public.biblioteca_capas;
drop policy if exists biblioteca_capas_admin_update_111 on public.biblioteca_capas;
drop policy if exists biblioteca_capas_admin_delete_111 on public.biblioteca_capas;
create policy biblioteca_capas_publicas_110 on public.biblioteca_capas
for select to anon,authenticated using (ativo or (select public.is_admin()));
create policy biblioteca_capas_admin_insert_111 on public.biblioteca_capas
for insert to authenticated with check ((select public.is_admin()));
create policy biblioteca_capas_admin_update_111 on public.biblioteca_capas
for update to authenticated using ((select public.is_admin())) with check ((select public.is_admin()));
create policy biblioteca_capas_admin_delete_111 on public.biblioteca_capas
for delete to authenticated using ((select public.is_admin()));

-- As extensões deixam o schema exposto. A função dependente usa caminho explícito.
do $$ begin
  if exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='unaccent' and n.nspname='public') then
    alter extension unaccent set schema extensions;
  end if;
  if exists(select 1 from pg_extension e join pg_namespace n on n.oid=e.extnamespace where e.extname='btree_gist' and n.nspname='public') then
    alter extension btree_gist set schema extensions;
  end if;
end $$;
create or replace function public.slugify(valor text)
returns text language sql immutable strict set search_path='' as $$
  select trim(both '-' from regexp_replace(lower(extensions.unaccent(valor)), '[^a-z0-9]+', '-', 'g'));
$$;

-- pg_cron é opcional em ambientes locais; em produção usa apenas as APIs
-- cron.schedule/cron.unschedule, sem escrita direta em cron.job.
do $$
declare v_job record;
begin
  if exists(select 1 from pg_extension where extname='pg_cron') then
    -- Exclusão exige Storage API + Auth Admin API e portanto roda no worker
    -- protegido do backend, nunca por SQL direto.
    for v_job in select jobid from cron.job where jobname='barberhub-exclusoes-conta-111'
    loop perform cron.unschedule(v_job.jobid); end loop;
    for v_job in select jobid from cron.job where jobname='barberhub-retencao-tecnica-111'
    loop perform cron.unschedule(v_job.jobid); end loop;
    perform cron.schedule('barberhub-retencao-tecnica-111','41 3 * * *',$job$select public.executar_retencao_tecnica_111();$job$);
  end if;
end $$;

-- O gatilho de auditoria passa a incluir a identificação empresarial.
drop trigger if exists estabelecimentos_config_auditoria_1101 on public.estabelecimentos;
create trigger estabelecimentos_config_auditoria_1101
after update of aceita_agendamento,status_manual,motivo_status,capa_url,endereco,numero,bairro,cidade,estado,
  cep,latitude,longitude,cnpj,encerrado_em
on public.estabelecimentos for each row execute function private.auditar_configuracao_1101();

commit;
