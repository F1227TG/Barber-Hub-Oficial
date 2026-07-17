-- Permite que o trigger interno atualize somente o contador de curtidas
-- sem conceder ao cliente permissão para editar a publicação.
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
begin
  if tg_op = 'UPDATE'
     and pg_trigger_depth() > 1
     and new.curtidas_count is distinct from old.curtidas_count
     and (to_jsonb(new) - 'curtidas_count' - 'updated_at') = (to_jsonb(old) - 'curtidas_count' - 'updated_at') then
    return new;
  end if;

  if new.autor_id is null then new.autor_id := auth.uid(); end if;

  if not public.is_admin() then
    if auth.uid() is null or new.autor_id <> auth.uid() or not public.owns_estabelecimento(new.estabelecimento_id) then
      raise exception 'Somente o proprietário pode gerenciar esta galeria.';
    end if;
  end if;

  if tg_op = 'INSERT' then
    select count(*) into v_total from public.portfolio_publicacoes
    where estabelecimento_id = new.estabelecimento_id;
    if v_total >= 50 then
      raise exception 'O limite inicial de 50 publicações foi atingido.';
    end if;
  end if;

  new.tags := coalesce((select array_agg(distinct left(trim(tag),30))
    from unnest(coalesce(new.tags,'{}')) tag where nullif(trim(tag),'') is not null),'{}');
  if cardinality(new.tags) > 5 then raise exception 'Use no máximo 5 tags.'; end if;

  if new.destaque then
    select count(*) into v_destaques from public.portfolio_publicacoes
    where estabelecimento_id = new.estabelecimento_id and destaque = true and id <> new.id;
    if v_destaques >= 3 then raise exception 'É permitido destacar no máximo 3 trabalhos.'; end if;
  end if;

  if new.status = 'publicada' then
    if not new.confirmou_autorizacao then
      raise exception 'Confirme a autorização de uso das imagens antes de publicar.';
    end if;
    if new.possui_menor and not new.confirmou_responsavel then
      raise exception 'Confirme a autorização do responsável legal.';
    end if;
    select count(*) into v_midias from public.portfolio_midias where publicacao_id = new.id;
    if v_midias < 1 then raise exception 'Adicione pelo menos uma imagem antes de publicar.'; end if;
    if new.modo = 'antes_depois' and v_midias < 2 then
      raise exception 'O modo antes e depois precisa de pelo menos duas imagens.';
    end if;
    new.autorizado_em := coalesce(new.autorizado_em,now());
  end if;
  return new;
end;
$$;
