-- Correcao de exclusao de conta: uma tentativa que ja removeu a identidade
-- Auth precisa continuar executavel ate a conclusao, sem reter o UUID depois
-- dela. Tambem libera agendamentos futuros afetados pela conta removida.

alter table public.solicitacoes_exclusao_conta
  add column if not exists user_id_tecnico uuid;

comment on column public.solicitacoes_exclusao_conta.user_id_tecnico is
  'UUID temporario, exclusivo do worker service_role, apagado na conclusao para permitir retry apos exclusao no Auth.';

-- Solicitações ja abertas preservam a identidade somente durante a execucao.
update public.solicitacoes_exclusao_conta
set user_id_tecnico = user_id
where user_id_tecnico is null
  and user_id is not null
  and status in ('agendada', 'processando', 'falhou');

create index if not exists solicitacoes_exclusao_fila_tecnica_1111_idx
  on public.solicitacoes_exclusao_conta(status, agendado_para, id)
  where user_id_tecnico is not null and status in ('agendada', 'processando', 'falhou');

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
  insert into public.solicitacoes_exclusao_conta(user_id,user_id_tecnico,user_hash,status,agendado_para,motivo)
  values(
    v_user,v_user,encode(extensions.digest(convert_to(v_user::text || ':barberhub-delete','utf8'),'sha256'),'hex'),
    'agendada',v_data,nullif(trim(coalesce(p_motivo,'')),'')
  ) returning id into v_id;
  return jsonb_build_object('id',v_id,'status','agendada','agendado_para',v_data,'reutilizado',false);
end;
$$;
revoke all on function public.solicitar_exclusao_conta_111(text) from public, anon;
grant execute on function public.solicitar_exclusao_conta_111(text) to authenticated, service_role;

create or replace function private.executar_exclusao_conta_111(p_user uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_user is null then raise exception 'USER_REQUIRED'; end if;

  -- Cancelamentos ocorrem antes da anonimização. Os gatilhos existentes criam
  -- os avisos internos usuais e removem os horarios da agenda ocupada.
  update public.agendamentos a
  set status='cancelado',
      cancelamento_motivo='Estabelecimento encerrado pelo titular',
      updated_at=now()
  from public.estabelecimentos e
  where e.owner_id=p_user
    and a.estabelecimento_id=e.id
    and a.status in ('pendente','confirmado')
    and ((a.data+a.hora_inicio) at time zone e.timezone)>now();

  -- A conta tambem pode ser cliente em estabelecimentos de terceiros.
  update public.agendamentos a
  set status='cancelado',
      cancelamento_motivo='Conta do cliente removida',
      updated_at=now()
  from public.estabelecimentos e
  where a.cliente_id=p_user
    and a.estabelecimento_id=e.id
    and a.status in ('pendente','confirmado')
    and ((a.data+a.hora_inicio) at time zone e.timezone)>now();

  -- Quando era profissional, a conta nao deixa compromissos futuros sem
  -- responsavel. Nao ha realocacao automatica: a equipe decide isso depois.
  update public.agendamentos a
  set status='cancelado',
      cancelamento_motivo='Profissional indisponivel por exclusao de conta',
      updated_at=now()
  from public.estabelecimentos e, public.profissionais p
  where p.id=a.profissional_id
    and p.user_id=p_user
    and a.estabelecimento_id=e.id
    and a.status in ('pendente','confirmado')
    and ((a.data+a.hora_inicio) at time zone e.timezone)>now();

  update public.agendamentos set
    cliente_id=null,cliente_nome='Conta removida',cliente_email='conta-removida@barberhub.invalid',
    cliente_telefone=null,observacao=null
  where cliente_id=p_user;
  update public.clientes_estabelecimento set
    cliente_id=null,nome='Conta removida',email=null,email_normalizado=null,telefone=null,
    preferencias=null,tags='{}'::text[],permite_whatsapp=false,
    permite_email_marketing=false,data_nascimento=null
  where cliente_id=p_user;
  update public.avaliacoes set
    cliente_id=null,comentario=case when comentario='' then '' else 'Conteudo removido pelo titular.' end
  where cliente_id=p_user;
  update public.tickets_suporte set user_id=null,nome='Conta removida',email='conta-removida@barberhub.invalid'
  where user_id=p_user;
  update public.profissionais set
    user_id=null,nome='Profissional removido',email=null,telefone=null,bio=null,avatar_url=null,ativo=false
  where user_id=p_user;
  update public.estabelecimentos set
    visivel=false,onboarding_concluido=false,status_manual='fechado',motivo_status='Conta encerrada',
    email_publico=null,telefone=null,whatsapp=null,instagram=null,website=null,
    foto_url=null,capa_url=null,encerrado_em=now(),encerramento_motivo='Exclusao solicitada pelo titular'
  where owner_id=p_user;
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
    where s.user_id_tecnico is not null
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
  returning s.id,s.user_id_tecnico;
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
    where s.id=p_solicitacao_id and s.user_id_tecnico=p_user_id and s.status='processando'
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
  where s.id=p_solicitacao_id and s.user_id_tecnico=p_user_id and s.status='processando'
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
  set status='concluida',executado_em=now(),erro_codigo=null,user_id=null,user_id_tecnico=null
  where id=p_solicitacao_id and status='processando'
  returning id into v_id;
  if v_id is null then raise exception 'DELETE_JOB_INVALID'; end if;
  return jsonb_build_object('id',v_id,'status','concluida');
end;
$$;
revoke all on function public.concluir_exclusao_conta_111(uuid) from public,anon,authenticated;
grant execute on function public.concluir_exclusao_conta_111(uuid) to service_role;
