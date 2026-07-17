-- Barber Hub 1.1: moderação segura da galeria e avisos relacionados.
-- Impede o proprietário de republicar conteúdo ocultado pelo administrador.

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
begin
  -- Atualização interna feita pelo contador de curtidas.
  if tg_op = 'UPDATE'
     and pg_trigger_depth() > 1
     and new.curtidas_count is distinct from old.curtidas_count
     and (to_jsonb(new) - 'curtidas_count' - 'updated_at') = (to_jsonb(old) - 'curtidas_count' - 'updated_at') then
    return new;
  end if;

  if new.autor_id is null then new.autor_id := auth.uid(); end if;

  if tg_op = 'UPDATE' and old.status = 'ocultada' and new.status is distinct from old.status and not v_admin then
    raise exception 'Esta publicação foi ocultada pela moderação e não pode ser republicada.';
  end if;
  if new.status = 'ocultada' and (tg_op = 'INSERT' or old.status is distinct from new.status) and not v_admin then
    raise exception 'Somente a moderação pode ocultar uma publicação.';
  end if;

  if not v_admin then
    if auth.uid() is null or new.autor_id <> auth.uid() or not public.owns_estabelecimento(new.estabelecimento_id) then
      raise exception 'Somente o proprietário pode gerenciar esta galeria.';
    end if;
  end if;

  if tg_op = 'INSERT' then
    select count(*) into v_total
    from public.portfolio_publicacoes
    where estabelecimento_id = new.estabelecimento_id;
    if v_total >= 50 then
      raise exception 'O limite inicial de 50 publicações foi atingido.';
    end if;
  end if;

  new.tags := coalesce((
    select array_agg(distinct left(trim(tag), 30))
    from unnest(coalesce(new.tags, '{}')) tag
    where nullif(trim(tag), '') is not null
  ), '{}');
  if cardinality(new.tags) > 5 then
    raise exception 'Use no máximo 5 tags.';
  end if;

  if new.destaque then
    select count(*) into v_destaques
    from public.portfolio_publicacoes
    where estabelecimento_id = new.estabelecimento_id
      and destaque = true
      and id <> new.id;
    if v_destaques >= 3 then
      raise exception 'É permitido destacar no máximo 3 trabalhos.';
    end if;
  end if;

  if new.status = 'publicada' then
    if not new.confirmou_autorizacao then
      raise exception 'Confirme a autorização de uso das imagens antes de publicar.';
    end if;
    if new.possui_menor and not new.confirmou_responsavel then
      raise exception 'Confirme a autorização do responsável legal.';
    end if;
    select count(*) into v_midias
    from public.portfolio_midias
    where publicacao_id = new.id;
    if v_midias < 1 then
      raise exception 'Adicione pelo menos uma imagem antes de publicar.';
    end if;
    if new.modo = 'antes_depois' and v_midias < 2 then
      raise exception 'O modo antes e depois precisa de pelo menos duas imagens.';
    end if;
    new.autorizado_em := coalesce(new.autorizado_em, now());
  end if;
  return new;
end;
$$;

create or replace function public.notificar_denuncia_portfolio()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_titulo text;
  v_admin record;
begin
  select titulo into v_titulo
  from public.portfolio_publicacoes
  where id = new.publicacao_id;

  for v_admin in select id from public.perfis where tipo = 'admin' and ativo = true loop
    perform public.criar_notificacao_interna(
      v_admin.id,
      'portfolio',
      'Nova denúncia na galeria',
      'A publicação “' || coalesce(v_titulo, 'Publicação') || '” precisa de análise.',
      'html/admin.html#moderacao',
      jsonb_build_object('denuncia_id', new.id, 'publicacao_id', new.publicacao_id)
    );
  end loop;
  return new;
end;
$$;

drop trigger if exists portfolio_denuncias_notificar_admin on public.portfolio_denuncias;
create trigger portfolio_denuncias_notificar_admin
after insert on public.portfolio_denuncias
for each row execute function public.notificar_denuncia_portfolio();

create or replace function public.notificar_resultado_moderacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_titulo text;
begin
  if old.status is distinct from new.status and new.status = 'ocultada' then
    select e.owner_id, p.titulo into v_owner, v_titulo
    from public.portfolio_publicacoes p
    join public.estabelecimentos e on e.id = p.estabelecimento_id
    where p.id = new.id;

    perform public.criar_notificacao_interna(
      v_owner,
      'portfolio',
      'Publicação ocultada pela moderação',
      'O trabalho “' || coalesce(v_titulo, 'Publicação') || '” foi ocultado após uma análise.',
      'html/painel.html#galeria',
      jsonb_build_object('publicacao_id', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists portfolio_publicacoes_notificar_moderacao on public.portfolio_publicacoes;
create trigger portfolio_publicacoes_notificar_moderacao
after update of status on public.portfolio_publicacoes
for each row execute function public.notificar_resultado_moderacao();

create or replace function public.notificar_autor_denuncia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if old.status is distinct from new.status and new.status in ('resolvida', 'rejeitada') then
    perform public.criar_notificacao_interna(
      new.user_id,
      'portfolio',
      case when new.status = 'resolvida' then 'Denúncia analisada' else 'Denúncia encerrada' end,
      case when new.status = 'resolvida'
        then 'A moderação tomou uma ação sobre o conteúdo denunciado.'
        else 'A denúncia foi analisada e encerrada sem remoção do conteúdo.' end,
      'html/notificacoes.html',
      jsonb_build_object('denuncia_id', new.id, 'status', new.status)
    );
  end if;
  return new;
end;
$$;

drop trigger if exists portfolio_denuncias_notificar_autor on public.portfolio_denuncias;
create trigger portfolio_denuncias_notificar_autor
after update of status on public.portfolio_denuncias
for each row execute function public.notificar_autor_denuncia();
