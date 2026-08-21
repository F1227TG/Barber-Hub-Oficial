-- Barber Hub 1.8.2: correcoes da auditoria diferencial V01-V04.
-- Execute apos a migration 16. A migration e aditiva, idempotente e nao remove dados.

begin;

-- ============================================================
-- V01: MODERACAO DE ESTABELECIMENTOS
-- Separa a escolha do proprietario (visivel) da suspensao administrativa.
-- ============================================================

alter table public.estabelecimentos
  add column if not exists suspenso_pela_moderacao boolean not null default false,
  add column if not exists suspenso_em timestamptz,
  add column if not exists suspenso_por uuid references public.perfis(id) on delete set null;

-- Preserva suspensoes legadas que ja tinham motivo e pagina oculta.
update public.estabelecimentos
set suspenso_pela_moderacao = true,
    suspenso_em = coalesce(suspenso_em, updated_at, now())
where nullif(trim(coalesce(suspenso_motivo, '')), '') is not null
  and visivel = false
  and suspenso_pela_moderacao = false;

-- Uma pagina suspensa nunca pode permanecer publica, mesmo por service_role.
update public.estabelecimentos
set visivel = false
where suspenso_pela_moderacao = true and visivel = true;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'estabelecimentos_suspensao_consistente'
      and conrelid = 'public.estabelecimentos'::regclass
  ) then
    alter table public.estabelecimentos
      add constraint estabelecimentos_suspensao_consistente
      check (not suspenso_pela_moderacao or visivel = false);
  end if;
end $$;

create index if not exists estabelecimentos_suspensao_idx
  on public.estabelecimentos(suspenso_pela_moderacao, visivel, onboarding_concluido);

create or replace function public.proteger_campos_sensiveis_estabelecimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_admin boolean := public.is_admin();
  v_recalculo_avaliacao boolean := false;
begin
  if tg_op = 'INSERT' then
    if not v_admin then
      new.verificado := false;
      new.verificado_em := null;
      new.verificado_por := null;
      new.destaque := false;
      new.suspenso_pela_moderacao := false;
      new.suspenso_motivo := null;
      new.suspenso_em := null;
      new.suspenso_por := null;
      new.avaliacao := 0;
    end if;

    if new.suspenso_pela_moderacao then
      new.visivel := false;
      new.suspenso_em := coalesce(new.suspenso_em, now());
      new.suspenso_por := coalesce(new.suspenso_por, auth.uid());
    end if;
    return new;
  end if;

  -- A media e atualizada por recalcular_avaliacao_estabelecimento(). A excecao
  -- aceita somente o UPDATE interno que altera avaliacao/updated_at e nada mais.
  v_recalculo_avaliacao := pg_trigger_depth() > 1
    and new.avaliacao is distinct from old.avaliacao
    and (to_jsonb(new) - 'avaliacao' - 'updated_at') =
        (to_jsonb(old) - 'avaliacao' - 'updated_at');

  if not v_admin then
    new.verificado := old.verificado;
    new.verificado_em := old.verificado_em;
    new.verificado_por := old.verificado_por;
    new.destaque := old.destaque;
    new.suspenso_pela_moderacao := old.suspenso_pela_moderacao;
    new.suspenso_motivo := old.suspenso_motivo;
    new.suspenso_em := old.suspenso_em;
    new.suspenso_por := old.suspenso_por;
    if not v_recalculo_avaliacao then
      new.avaliacao := old.avaliacao;
    end if;

    -- Enquanto houver suspensao administrativa, o proprietario nao consegue
    -- republicar a pagina alterando apenas visivel via PostgREST.
    if old.suspenso_pela_moderacao then
      new.visivel := old.visivel;
    end if;
  end if;

  if v_admin and new.verificado is distinct from old.verificado then
    if new.verificado then
      new.verificado_em := coalesce(new.verificado_em, now());
      new.verificado_por := coalesce(new.verificado_por, auth.uid());
    else
      new.verificado_em := null;
      new.verificado_por := null;
    end if;
  end if;

  if new.suspenso_pela_moderacao then
    new.visivel := false;
    if v_admin and old.suspenso_pela_moderacao is distinct from true then
      new.suspenso_em := coalesce(new.suspenso_em, now());
      new.suspenso_por := coalesce(new.suspenso_por, auth.uid());
      new.suspenso_motivo := coalesce(
        nullif(trim(coalesce(new.suspenso_motivo, '')), ''),
        'Suspenso pela administracao.'
      );
    end if;
  elsif v_admin and old.suspenso_pela_moderacao then
    new.suspenso_motivo := null;
    new.suspenso_em := null;
    new.suspenso_por := null;
  end if;

  return new;
end;
$$;

drop trigger if exists estabelecimentos_proteger_campos_sensiveis on public.estabelecimentos;
create trigger estabelecimentos_proteger_campos_sensiveis
before insert or update on public.estabelecimentos
for each row execute function public.proteger_campos_sensiveis_estabelecimento();

revoke all on function public.proteger_campos_sensiveis_estabelecimento()
  from public, anon, authenticated;

-- Defesa em profundidade para o Data API. O proprietario e o admin continuam
-- vendo a propria linha, inclusive durante ocultacao ou suspensao.
drop policy if exists estabelecimentos_select_publico on public.estabelecimentos;
drop policy if exists estabelecimentos_select_visitante on public.estabelecimentos;
drop policy if exists estabelecimentos_select_autenticado on public.estabelecimentos;

create policy estabelecimentos_select_visitante on public.estabelecimentos
for select to anon
using (
  visivel = true
  and onboarding_concluido = true
  and suspenso_pela_moderacao = false
);

create policy estabelecimentos_select_autenticado on public.estabelecimentos
for select to authenticated
using (
  (
    visivel = true
    and onboarding_concluido = true
    and suspenso_pela_moderacao = false
  )
  or owner_id = (select auth.uid())
  or public.is_admin()
);

-- ============================================================
-- V02: MAQUINA DE ESTADOS DE AGENDAMENTOS NO POSTGRESQL
-- ============================================================

create or replace function public.validar_transicao_status_agendamento()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if new.status is not distinct from old.status then
    return new;
  end if;

  if (old.status = 'pendente' and new.status in ('confirmado', 'recusado', 'cancelado'))
     or (old.status = 'confirmado' and new.status in ('concluido', 'cancelado')) then
    return new;
  end if;

  raise exception 'Transicao de status invalida: % -> %.', old.status, new.status
    using errcode = '23514';
end;
$$;

drop trigger if exists agendamentos_validar_transicao_status on public.agendamentos;
create trigger agendamentos_validar_transicao_status
before update of status on public.agendamentos
for each row execute function public.validar_transicao_status_agendamento();

revoke all on function public.validar_transicao_status_agendamento()
  from public, anon, authenticated;

-- ============================================================
-- V03: LIMITES DE PLANO SEM CONTORNO POR CONCORRENCIA/REATIVACAO
-- ============================================================

create or replace function public.validar_profissional_limite_plano()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ent jsonb;
  v_limite integer;
  v_total integer;
begin
  if new.ativo is not true then return new; end if;
  if tg_op = 'UPDATE' and old.ativo is true then return new; end if;

  -- Serializa alteracoes de capacidade do mesmo estabelecimento para impedir
  -- duas insercoes simultaneas de ultrapassarem o limite apos o mesmo COUNT.
  perform pg_advisory_xact_lock(hashtextextended(new.estabelecimento_id::text, 1801));

  v_ent := public.calcular_entitlements_estabelecimento(new.estabelecimento_id);
  v_limite := greatest(coalesce((v_ent->>'limite_profissionais')::integer, 1), 1);
  select count(*) into v_total
  from public.profissionais
  where estabelecimento_id = new.estabelecimento_id
    and ativo = true
    and id <> new.id;

  if v_total >= v_limite then
    raise exception 'Seu plano permite ate % profissional(is) ativo(s). Faca upgrade para ampliar a equipe.', v_limite;
  end if;
  return new;
end;
$$;

drop trigger if exists profissionais_validar_plano on public.profissionais;
create trigger profissionais_validar_plano
before insert or update of ativo on public.profissionais
for each row execute function public.validar_profissional_limite_plano();

revoke all on function public.validar_profissional_limite_plano()
  from public, anon, authenticated;

-- Agendamentos diretos tambem respeitam plano e suspensao, independentemente
-- da RPC ou da API Python usada pelo cliente.
create or replace function public.validar_agendamento_plano()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ent jsonb;
  v_est public.estabelecimentos%rowtype;
begin
  select * into v_est
  from public.estabelecimentos
  where id = new.estabelecimento_id;

  if not found
     or not v_est.visivel
     or not v_est.onboarding_concluido
     or v_est.suspenso_pela_moderacao then
    raise exception 'Estabelecimento indisponivel para agendamentos.';
  end if;

  v_ent := public.calcular_entitlements_estabelecimento(new.estabelecimento_id);
  if not coalesce((v_ent->>'permite_agenda')::boolean, false) then
    raise exception 'Este estabelecimento nao possui agenda online no plano atual.';
  end if;
  return new;
end;
$$;

drop trigger if exists agendamentos_validar_plano on public.agendamentos;
create trigger agendamentos_validar_plano
before insert on public.agendamentos
for each row execute function public.validar_agendamento_plano();

revoke all on function public.validar_agendamento_plano()
  from public, anon, authenticated;

-- ============================================================
-- V04 + V03: PORTFOLIO, CONTADOR DERIVADO E LIMITES DE REATIVACAO
-- ============================================================

create or replace function public.validar_portfolio_publicacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_destaques integer;
  v_midias integer;
  v_admin boolean := public.is_admin();
  v_ent jsonb;
  v_limite integer;
  v_limite_destaques integer;
begin
  -- O contador interno e a unica escrita aceita para curtidas_count. A funcao
  -- que conta portfolio_curtidas executa como um segundo nivel de trigger.
  if tg_op = 'UPDATE'
     and pg_trigger_depth() > 1
     and new.curtidas_count is distinct from old.curtidas_count
     and (to_jsonb(new) - 'curtidas_count' - 'updated_at') =
         (to_jsonb(old) - 'curtidas_count' - 'updated_at') then
    return new;
  end if;

  if tg_op = 'INSERT' then
    new.curtidas_count := 0;
  else
    -- Ignora qualquer valor enviado por proprietario/admin e ainda corrige
    -- contadores legados divergentes na proxima edicao da publicacao.
    select count(*) into new.curtidas_count
    from public.portfolio_curtidas c
    where c.publicacao_id = new.id;
  end if;

  if new.autor_id is null then new.autor_id := auth.uid(); end if;

  if tg_op = 'UPDATE'
     and old.status = 'ocultada'
     and new.status is distinct from old.status
     and not v_admin then
    raise exception 'Esta publicacao foi ocultada pela moderacao e nao pode ser republicada.';
  end if;
  if new.status = 'ocultada'
     and (tg_op = 'INSERT' or old.status is distinct from new.status)
     and not v_admin then
    raise exception 'Somente a moderacao pode ocultar uma publicacao.';
  end if;

  if not v_admin then
    if auth.uid() is null
       or new.autor_id <> auth.uid()
       or not public.owns_estabelecimento(new.estabelecimento_id) then
      raise exception 'Somente o proprietario pode gerenciar esta galeria.';
    end if;
  end if;

  perform pg_advisory_xact_lock(hashtextextended(new.estabelecimento_id::text, 1802));
  v_ent := public.calcular_entitlements_estabelecimento(new.estabelecimento_id);
  v_limite := greatest(coalesce((v_ent->>'limite_publicacoes')::integer, 10), 1);
  v_limite_destaques := greatest(coalesce((v_ent->>'limite_destaques_portfolio')::integer, 1), 1);

  if tg_op = 'INSERT'
     or (tg_op = 'UPDATE' and old.status = 'arquivada' and new.status <> 'arquivada') then
    select count(*) into v_total
    from public.portfolio_publicacoes
    where estabelecimento_id = new.estabelecimento_id
      and status <> 'arquivada'
      and id <> new.id;
    if v_total >= v_limite then
      raise exception 'Seu plano permite ate % publicacoes. Faca upgrade para ampliar o portfolio.', v_limite;
    end if;
  end if;

  new.tags := coalesce((
    select array_agg(distinct left(trim(tag), 30))
    from unnest(coalesce(new.tags, '{}')) tag
    where nullif(trim(tag), '') is not null
  ), '{}');
  if cardinality(new.tags) > 5 then
    raise exception 'Use no maximo 5 tags.';
  end if;

  if new.destaque then
    select count(*) into v_destaques
    from public.portfolio_publicacoes
    where estabelecimento_id = new.estabelecimento_id
      and destaque = true
      and status <> 'arquivada'
      and id <> new.id;
    if v_destaques >= v_limite_destaques then
      raise exception 'Seu plano permite destacar no maximo % trabalho(s).', v_limite_destaques;
    end if;
  end if;

  if new.status = 'publicada' then
    if not new.confirmou_autorizacao then
      raise exception 'Confirme a autorizacao de uso das imagens antes de publicar.';
    end if;
    if new.possui_menor and not new.confirmou_responsavel then
      raise exception 'Confirme a autorizacao do responsavel legal.';
    end if;
    select count(*) into v_midias
    from public.portfolio_midias
    where publicacao_id = new.id;
    if v_midias < 1 then raise exception 'Adicione pelo menos uma imagem antes de publicar.'; end if;
    if new.modo = 'antes_depois' and v_midias < 2 then
      raise exception 'O modo antes e depois precisa de pelo menos duas imagens.';
    end if;
    new.autorizado_em := coalesce(new.autorizado_em, now());
  end if;

  return new;
end;
$$;

revoke all on function public.validar_portfolio_publicacao()
  from public, anon, authenticated;

-- Corrige imediatamente qualquer contador legado adulterado.
update public.portfolio_publicacoes p
set curtidas_count = (
  select count(*) from public.portfolio_curtidas c where c.publicacao_id = p.id
)
where curtidas_count is distinct from (
  select count(*) from public.portfolio_curtidas c where c.publicacao_id = p.id
);

commit;
