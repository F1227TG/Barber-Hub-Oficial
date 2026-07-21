-- Barber Hub 1.3.1 — migration corrigida
-- Modais, avaliações da comunidade e avaliações vinculadas a publicações.
-- Execute após a migration 12_comunidade_conta_admin_mobile.sql.
-- Correção: pausa o gatilho de validação durante a conversão das avaliações existentes.

begin;

alter table public.avaliacoes
  alter column agendamento_id drop not null;

alter table public.avaliacoes
  add column if not exists publicacao_id uuid references public.portfolio_publicacoes(id) on delete cascade,
  add column if not exists origem text not null default 'agendamento',
  add column if not exists verificada boolean not null default false;

-- A migration 12 já possui um gatilho que protege alterações nas avaliações.
-- Durante a conversão dos registros antigos, ele precisa ser pausado temporariamente.
do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.avaliacoes'::regclass
      and tgname = 'avaliacoes_validar'
      and not tgisinternal
  ) then
    alter table public.avaliacoes disable trigger avaliacoes_validar;
  end if;
end
$$;

update public.avaliacoes
set origem = 'agendamento',
    verificada = true
where agendamento_id is not null;

do $$
begin
  if exists (
    select 1
    from pg_trigger
    where tgrelid = 'public.avaliacoes'::regclass
      and tgname = 'avaliacoes_validar'
      and not tgisinternal
  ) then
    alter table public.avaliacoes enable trigger avaliacoes_validar;
  end if;
end
$$;

alter table public.avaliacoes
  drop constraint if exists avaliacoes_origem_check;
alter table public.avaliacoes
  add constraint avaliacoes_origem_check
  check (origem in ('agendamento','comunidade'));

alter table public.avaliacoes
  drop constraint if exists avaliacoes_origem_integridade_check;
alter table public.avaliacoes
  add constraint avaliacoes_origem_integridade_check
  check (
    (origem = 'agendamento' and agendamento_id is not null and publicacao_id is null and verificada = true)
    or
    (origem = 'comunidade' and agendamento_id is null and verificada = false)
  );

create index if not exists avaliacoes_publicacao_idx
  on public.avaliacoes(publicacao_id, status, created_at desc)
  where publicacao_id is not null;

create unique index if not exists avaliacoes_comunidade_estabelecimento_unq
  on public.avaliacoes(cliente_id, estabelecimento_id)
  where origem = 'comunidade' and publicacao_id is null;

create unique index if not exists avaliacoes_comunidade_publicacao_unq
  on public.avaliacoes(cliente_id, publicacao_id)
  where origem = 'comunidade' and publicacao_id is not null;

create or replace function public.validar_avaliacao_verificada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agendamento public.agendamentos%rowtype;
  v_admin boolean := public.is_admin();
  v_owner boolean;
  v_publicacao_estabelecimento uuid;
  v_publicacao_status text;
  v_tipo_perfil text;
begin
  if tg_op = 'INSERT' then
    if new.agendamento_id is not null then
      select * into v_agendamento
      from public.agendamentos
      where id = new.agendamento_id;

      if not found then raise exception 'Agendamento não encontrado.'; end if;
      if v_agendamento.status <> 'concluido' then
        raise exception 'Somente atendimentos concluídos podem ser avaliados como verificados.';
      end if;
      if v_agendamento.cliente_id is distinct from auth.uid() and not v_admin then
        raise exception 'Você só pode avaliar seus próprios atendimentos.';
      end if;

      new.cliente_id := v_agendamento.cliente_id;
      new.estabelecimento_id := v_agendamento.estabelecimento_id;
      new.publicacao_id := null;
      new.origem := 'agendamento';
      new.verificada := true;
    else
      if auth.uid() is null then
        raise exception 'Entre na sua conta para publicar uma avaliação.';
      end if;
      select tipo into v_tipo_perfil from public.perfis where id = auth.uid();
      if v_tipo_perfil is distinct from 'cliente' and not v_admin then
        raise exception 'Somente contas de cliente podem publicar avaliações da comunidade.';
      end if;
      if new.estabelecimento_id is null then
        raise exception 'Estabelecimento não informado.';
      end if;
      if public.owns_estabelecimento(new.estabelecimento_id) and not v_admin then
        raise exception 'O responsável não pode avaliar o próprio estabelecimento.';
      end if;

      new.cliente_id := auth.uid();
      new.agendamento_id := null;
      new.origem := 'comunidade';
      new.verificada := false;

      if new.publicacao_id is not null then
        select estabelecimento_id, status
        into v_publicacao_estabelecimento, v_publicacao_status
        from public.portfolio_publicacoes
        where id = new.publicacao_id;

        if not found then raise exception 'Publicação não encontrada.'; end if;
        if v_publicacao_estabelecimento is distinct from new.estabelecimento_id then
          raise exception 'A publicação não pertence a este estabelecimento.';
        end if;
        if v_publicacao_status <> 'publicada' then
          raise exception 'Esta publicação não está disponível para avaliação.';
        end if;
      end if;
    end if;

    new.status := 'publicada';
    new.resposta_estabelecimento := null;
    new.respondido_em := null;
    new.motivo_moderacao := null;
  else
    v_owner := public.owns_estabelecimento(old.estabelecimento_id);

    if not v_admin and auth.uid() = old.cliente_id then
      new.agendamento_id := old.agendamento_id;
      new.estabelecimento_id := old.estabelecimento_id;
      new.cliente_id := old.cliente_id;
      new.publicacao_id := old.publicacao_id;
      new.origem := old.origem;
      new.verificada := old.verificada;
      new.resposta_estabelecimento := old.resposta_estabelecimento;
      new.respondido_em := old.respondido_em;
      new.status := old.status;
      new.motivo_moderacao := old.motivo_moderacao;
    elsif not v_admin and v_owner then
      new.agendamento_id := old.agendamento_id;
      new.estabelecimento_id := old.estabelecimento_id;
      new.cliente_id := old.cliente_id;
      new.publicacao_id := old.publicacao_id;
      new.origem := old.origem;
      new.verificada := old.verificada;
      new.nota := old.nota;
      new.comentario := old.comentario;
      new.status := old.status;
      new.motivo_moderacao := old.motivo_moderacao;
      if new.resposta_estabelecimento is distinct from old.resposta_estabelecimento then
        new.respondido_em := case when nullif(trim(new.resposta_estabelecimento), '') is null then null else now() end;
      end if;
    elsif not v_admin then
      raise exception 'Você não pode alterar esta avaliação.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

create or replace function public.notificar_avaliacao_verificada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_titulo_publicacao text;
begin
  select owner_id into v_owner
  from public.estabelecimentos
  where id = new.estabelecimento_id;

  if new.publicacao_id is not null then
    select titulo into v_titulo_publicacao
    from public.portfolio_publicacoes
    where id = new.publicacao_id;
  end if;

  if tg_op = 'INSERT' and v_owner is not null then
    perform public.criar_notificacao_interna(
      v_owner,
      'avaliacao',
      case when new.verificada then 'Nova avaliação verificada' else 'Nova avaliação da comunidade' end,
      case
        when new.verificada then 'Um atendimento concluído recebeu uma nova avaliação.'
        when v_titulo_publicacao is not null then 'Um cliente avaliou o trabalho “' || v_titulo_publicacao || '”.'
        else 'Seu estabelecimento recebeu uma avaliação da comunidade.'
      end,
      'html/painel.html#avaliacoes',
      jsonb_build_object('avaliacao_id', new.id, 'verificada', new.verificada, 'publicacao_id', new.publicacao_id)
    );
  elsif tg_op = 'UPDATE'
    and new.resposta_estabelecimento is distinct from old.resposta_estabelecimento
    and new.cliente_id is not null then
    perform public.criar_notificacao_interna(
      new.cliente_id,
      'avaliacao',
      'O estabelecimento respondeu sua avaliação',
      'Abra a página do estabelecimento para visualizar a resposta.',
      'html/barbearia.html?id=' || new.estabelecimento_id::text || '#avaliacoes',
      jsonb_build_object('avaliacao_id', new.id)
    );
  end if;
  return new;
exception when undefined_function then
  return new;
end;
$$;

revoke all on function public.validar_avaliacao_verificada() from public, anon, authenticated;
revoke all on function public.notificar_avaliacao_verificada() from public, anon, authenticated;

commit;
