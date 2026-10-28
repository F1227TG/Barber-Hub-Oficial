-- Administração de contas: alteração + auditoria na mesma transação.
-- Aplicar junto da API correspondente; frontend antigo perderá edição direta de papéis.
begin;

alter table public.perfis add column if not exists estado_conta text;
update public.perfis set estado_conta = case when ativo then 'ativa' else 'desativada' end
where estado_conta is null;
alter table public.perfis alter column estado_conta set default 'ativa';
alter table public.perfis alter column estado_conta set not null;
alter table public.perfis drop constraint if exists perfis_estado_conta_valido;
alter table public.perfis add constraint perfis_estado_conta_valido
check (estado_conta in ('ativa', 'desativada', 'suspensa', 'excluida'));
alter table public.perfis add column if not exists excluido_em timestamptz;

-- O navegador continua podendo editar somente os campos pessoais já existentes.
revoke update, delete on public.perfis from public, anon, authenticated;
grant update (nome, email, telefone, avatar_url, acessibilidade, onboarding_concluido)
on public.perfis to authenticated;

create or replace function private.conta_ativa()
returns boolean language sql stable security definer set search_path = '' as $$
  select auth.uid() is not null and exists (
    select 1 from public.perfis
    where id = (select auth.uid()) and ativo = true and estado_conta = 'ativa'
  ) and exists (
    select 1 from auth.sessions
    where id = nullif(auth.jwt()->>'session_id','')::uuid and user_id = (select auth.uid())
      and (not_after is null or not_after > now())
  );
$$;
revoke all on function private.conta_ativa() from public, anon;
grant execute on function private.conta_ativa() to authenticated, service_role;
grant usage on schema private to authenticated, service_role;

-- Defesa de dados privados para acesso por RLS (inclusive Realtime).
-- Não muda as políticas permissivas: esta condição é adicional às regras de propriedade.
do $$
declare v_table record;
begin
  for v_table in select c.relname from pg_class c join pg_namespace n on n.oid=c.relnamespace
    where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity
  loop
    execute format('drop policy if exists conta_ativa_restritiva on public.%I', v_table.relname);
    execute format('create policy conta_ativa_restritiva on public.%I as restrictive for all to authenticated using ((select private.conta_ativa())) with check ((select private.conta_ativa()))', v_table.relname);
  end loop;
end;
$$;

-- Impede RPCs SECURITY DEFINER de contornarem o bloqueio de uma conta inativa.
-- Preserva um eventual hook anterior em vez de substituí-lo silenciosamente.
do $$
declare v_hook text;
begin
  select split_part(item, '=', 2) into v_hook
  from pg_roles r cross join lateral unnest(r.rolconfig) item
  where r.rolname='authenticator' and item like 'pgrst.db_pre_request=%';
  if v_hook is not null and v_hook <> 'public.validar_acesso_conta' then
    raise exception 'PRE_REQUEST_HOOK_ALREADY_CONFIGURED';
  end if;
end;
$$;

create or replace function public.validar_acesso_conta()
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if current_user = 'authenticated' and not private.conta_ativa() then
    raise sqlstate 'PT403' using message = 'ACCOUNT_INACTIVE';
  end if;
end;
$$;
revoke all on function public.validar_acesso_conta() from public;
grant execute on function public.validar_acesso_conta() to anon, authenticated, service_role;
alter role authenticator set pgrst.db_pre_request = 'public.validar_acesso_conta';

-- Defesa comum a qualquer UPDATE, inclusive jobs antigos que só conhecem ativo.
create or replace function private.proteger_estado_conta()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  if new.id is distinct from old.id then
    raise exception 'INVALID_ACCOUNT_CHANGE';
  end if;
  if new.estado_conta is distinct from old.estado_conta then
    new.ativo := new.estado_conta = 'ativa';
  elsif new.ativo is distinct from old.ativo then
    new.estado_conta := case when new.ativo then 'ativa' else 'desativada' end;
  end if;
  if old.tipo = 'admin' and old.ativo and old.estado_conta = 'ativa'
     and (new.tipo <> 'admin' or not new.ativo or new.estado_conta <> 'ativa') then
    perform pg_advisory_xact_lock(22102026, 1);
    if not exists (select 1 from public.perfis where id <> old.id
                   and tipo = 'admin' and ativo and estado_conta = 'ativa') then
      raise exception 'LAST_ACTIVE_ADMIN';
    end if;
  end if;
  new.excluido_em := case when new.estado_conta = 'excluida'
                         then coalesce(old.excluido_em, now()) else null end;
  return new;
end;
$$;
revoke all on function private.proteger_estado_conta() from public, anon, authenticated;
drop trigger if exists perfis_estado_conta on public.perfis;
create trigger perfis_estado_conta before update on public.perfis
for each row execute function private.proteger_estado_conta();

-- SECURITY DEFINER é restrito à service_role. O ator vem da API após validar JWT;
-- a função revalida o perfil sob lock antes de cada alteração. Não é endpoint de usuário.
create or replace function private.administrar_conta(
  p_actor_id uuid, p_user_id uuid, p_changes jsonb, p_request_id text default null
) returns jsonb language plpgsql security definer set search_path = '' as $$
declare
  v_actor public.perfis%rowtype;
  v_before public.perfis%rowtype;
  v_after public.perfis%rowtype;
begin
  perform pg_advisory_xact_lock(22102026, 1);
  select * into v_actor from public.perfis where id = p_actor_id for update;
  if not found or v_actor.tipo <> 'admin' or not v_actor.ativo or v_actor.estado_conta <> 'ativa' then
    raise exception 'ADMIN_REQUIRED';
  end if;
  if p_actor_id = p_user_id then raise exception 'SELF_ACCOUNT_CHANGE'; end if;
  if p_changes is null or jsonb_typeof(p_changes) <> 'object' or p_changes = '{}'::jsonb
     or p_changes - array['tipo','estado_conta'] <> '{}'::jsonb
     or (p_changes ? 'tipo' and coalesce(p_changes->>'tipo','') not in ('admin','barbeiro','cliente'))
     or (p_changes ? 'estado_conta' and coalesce(p_changes->>'estado_conta','') not in ('ativa','desativada','suspensa','excluida')) then
    raise exception 'INVALID_ACCOUNT_CHANGE';
  end if;
  select * into v_before from public.perfis where id = p_user_id for update;
  if not found then raise exception 'ACCOUNT_NOT_FOUND'; end if;
  update public.perfis set
    tipo = coalesce(p_changes->>'tipo', tipo),
    estado_conta = coalesce(p_changes->>'estado_conta', estado_conta)
  where id = p_user_id returning * into v_after;
  if v_before.tipo is distinct from v_after.tipo or v_before.estado_conta is distinct from v_after.estado_conta then
    insert into public.auditoria_admin (admin_id, acao, alvo_tipo, alvo_id, detalhes, request_id)
    values (p_actor_id,
      case when v_after.estado_conta = 'excluida' then 'account.deleted'
           when v_after.estado_conta = 'ativa' and v_before.estado_conta <> 'ativa' then 'account.restored'
           when v_before.tipo <> v_after.tipo then 'account.role_changed' else 'account.state_changed' end,
      'perfis', p_user_id::text,
      jsonb_build_object('before', jsonb_build_object('tipo', v_before.tipo, 'estado_conta', v_before.estado_conta),
                         'after', jsonb_build_object('tipo', v_after.tipo, 'estado_conta', v_after.estado_conta),
                         'result', 'success'), left(p_request_id,100));
    -- Revoga refresh/sessões. Tokens já emitidos são barrados pela API, RLS e pre-request.
    delete from auth.sessions where user_id = p_user_id;
  end if;
  return jsonb_build_object('id', v_after.id, 'tipo', v_after.tipo, 'ativo', v_after.ativo,
                            'estado_conta', v_after.estado_conta, 'excluido_em', v_after.excluido_em);
end;
$$;
revoke all on function private.administrar_conta(uuid,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function private.administrar_conta(uuid,uuid,jsonb,text) to service_role;

create or replace function public.administrar_conta(
  p_actor_id uuid, p_user_id uuid, p_changes jsonb, p_request_id text default null
) returns jsonb language plpgsql security invoker set search_path = '' as $$
begin
  if current_user <> 'service_role' then raise exception 'ADMIN_REQUIRED'; end if;
  return private.administrar_conta(p_actor_id, p_user_id, p_changes, p_request_id);
end;
$$;
revoke all on function public.administrar_conta(uuid,uuid,jsonb,text) from public, anon, authenticated;
grant execute on function public.administrar_conta(uuid,uuid,jsonb,text) to service_role;

-- Tokens de acesso antigos continuam criptograficamente válidos após revogação.
-- A API consulta esta função usando o session_id de um JWT já verificado pelo Auth.
create or replace function private.sessao_conta_ativa(p_user_id uuid, p_session_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (select 1 from auth.sessions s join public.perfis p on p.id=s.user_id
    where s.id=p_session_id and s.user_id=p_user_id and p.ativo and p.estado_conta='ativa'
      and (s.not_after is null or s.not_after > now()));
$$;
revoke all on function private.sessao_conta_ativa(uuid,uuid) from public, anon, authenticated;
grant execute on function private.sessao_conta_ativa(uuid,uuid) to service_role;
create or replace function public.sessao_conta_ativa(p_user_id uuid, p_session_id uuid)
returns boolean language sql stable security invoker set search_path = '' as $$
  select private.sessao_conta_ativa(p_user_id,p_session_id);
$$;
revoke all on function public.sessao_conta_ativa(uuid,uuid) from public, anon, authenticated;
grant execute on function public.sessao_conta_ativa(uuid,uuid) to service_role;

notify pgrst, 'reload config';
notify pgrst, 'reload schema';
commit;
