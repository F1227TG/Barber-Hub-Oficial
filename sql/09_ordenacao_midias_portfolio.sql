-- Barber Hub 1.1: reordenação segura das imagens do portfólio.

alter table public.portfolio_midias
  drop constraint if exists portfolio_midias_publicacao_id_ordem_key;

alter table public.portfolio_midias
  add constraint portfolio_midias_publicacao_id_ordem_key
  unique (publicacao_id, ordem)
  deferrable initially deferred;

create or replace function public.reordenar_midias_portfolio(
  p_publicacao_id uuid,
  p_midias uuid[],
  p_capa_midia_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estabelecimento uuid;
  v_modo text;
  v_total integer;
  v_id uuid;
  v_pos integer := 0;
  v_capa_ordem integer;
begin
  select estabelecimento_id, modo
    into v_estabelecimento, v_modo
  from public.portfolio_publicacoes
  where id = p_publicacao_id;

  if v_estabelecimento is null then
    raise exception 'Publicação não encontrada.';
  end if;
  if not public.is_admin() and not public.owns_estabelecimento(v_estabelecimento) then
    raise exception 'Você não pode ordenar estas imagens.';
  end if;

  select count(*) into v_total
  from public.portfolio_midias
  where publicacao_id = p_publicacao_id;

  if coalesce(cardinality(p_midias), 0) <> v_total or v_total < 1 or v_total > 5 then
    raise exception 'A lista de imagens está incompleta.';
  end if;
  if (select count(distinct id) from unnest(p_midias) as id) <> v_total then
    raise exception 'A lista contém imagens repetidas.';
  end if;
  if exists (
    select 1
    from unnest(p_midias) as lista(id)
    left join public.portfolio_midias m on m.id = lista.id
    where m.id is null or m.publicacao_id <> p_publicacao_id
  ) then
    raise exception 'Uma das imagens não pertence a esta publicação.';
  end if;

  set constraints portfolio_midias_publicacao_id_ordem_key deferred;
  foreach v_id in array p_midias loop
    v_pos := v_pos + 1;
    update public.portfolio_midias
    set ordem = v_pos,
        tipo = case
          when v_modo = 'antes_depois' and v_pos = 1 then 'antes'
          when v_modo = 'antes_depois' and v_pos = 2 then 'depois'
          else 'normal'
        end
    where id = v_id and publicacao_id = p_publicacao_id;
  end loop;

  v_capa_ordem := array_position(p_midias, p_capa_midia_id);
  update public.portfolio_publicacoes
  set capa_ordem = coalesce(v_capa_ordem, 1)
  where id = p_publicacao_id;
end;
$$;

revoke all on function public.reordenar_midias_portfolio(uuid,uuid[],uuid) from public,anon;
grant execute on function public.reordenar_midias_portfolio(uuid,uuid[],uuid) to authenticated;
