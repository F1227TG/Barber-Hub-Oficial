-- Barber Hub 1.10.1: conclusão do planejamento pós-31.
-- Requer as migrations históricas 01 a 31. Idempotente para reexecução controlada.
begin;

-- O plano anunciado na interface e as regras de produto devem ser os mesmos.
update public.planos set permite_recorrencia=true, permite_lembretes=true where slug='essencial';

-- Avaliação única e privada: respeita plano efetivo, usuário, estabelecimento, cidade e kill switch.
create or replace function private.funcionalidade_habilitada_1101(p_chave text,p_estabelecimento_id uuid default null)
returns boolean language plpgsql stable security definer set search_path='' as $$
declare v_flag public.feature_flags%rowtype; v_user uuid:=(select auth.uid()); v_plano text; v_cidade text; v_estado text; v_alvo boolean;
begin
  select * into v_flag from public.feature_flags where chave=p_chave;
  if not found or v_flag.kill_switch then return false; end if;
  if p_estabelecimento_id is not null then
    select e.cidade,e.estado,public.calcular_entitlements_estabelecimento(e.id)->>'plano_slug'
      into v_cidade,v_estado,v_plano from public.estabelecimentos e where e.id=p_estabelecimento_id;
  end if;
  select a.habilitada into v_alvo from public.feature_flag_alvos a
  where a.feature_flag_id=v_flag.id and (a.expira_em is null or a.expira_em>now()) and (
    (v_user is not null and a.user_id=v_user) or
    (p_estabelecimento_id is not null and a.estabelecimento_id=p_estabelecimento_id) or
    (v_plano is not null and a.plano_slug=v_plano) or
    (v_cidade is not null and lower(a.cidade)=lower(v_cidade) and (a.estado is null or a.estado=v_estado)))
  order by (a.user_id is not null)::int desc,(a.estabelecimento_id is not null)::int desc,
    (a.plano_slug is not null)::int desc,a.created_at desc limit 1;
  return coalesce(v_alvo,v_flag.habilitada_padrao);
end $$;
revoke all on function private.funcionalidade_habilitada_1101(text,uuid) from public,anon,authenticated;

create or replace function public.avaliar_feature_flags_110(p_chaves text[],p_estabelecimento_id uuid default null)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare v_resultado jsonb:='{}'; v_chave text;
begin
  if coalesce(cardinality(p_chaves),0)<1 or cardinality(p_chaves)>50 then raise exception 'Informe entre 1 e 50 funcionalidades.'; end if;
  if p_estabelecimento_id is not null and not public.is_admin()
    and not private.pode_operar_estabelecimento_19(p_estabelecimento_id) then raise exception 'Acesso não autorizado.'; end if;
  foreach v_chave in array p_chaves loop
    if v_chave!~'^[a-z0-9][a-z0-9_.-]{1,79}$' then raise exception 'Chave inválida.'; end if;
    v_resultado:=v_resultado||jsonb_build_object(v_chave,private.funcionalidade_habilitada_1101(v_chave,p_estabelecimento_id));
  end loop;
  return v_resultado;
end $$;
revoke all on function public.avaliar_feature_flags_110(text[],uuid) from public,anon;
grant execute on function public.avaliar_feature_flags_110(text[],uuid) to authenticated,service_role;

create or replace function public.funcionalidades_publicas_1101()
returns jsonb language sql stable security definer set search_path='' as $$
 select jsonb_build_object(
   'marketplace.regional',private.funcionalidade_habilitada_1101('marketplace.regional',null),
   'perfil.biblioteca_capas',private.funcionalidade_habilitada_1101('perfil.biblioteca_capas',null));
$$;
revoke all on function public.funcionalidades_publicas_1101() from public;
grant execute on function public.funcionalidades_publicas_1101() to anon,authenticated,service_role;

-- Defesa final: chamadas diretas ao banco também obedecem ao desligamento emergencial.
create or replace function private.bloquear_feature_desabilitada_1101()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_est uuid:=coalesce(new.estabelecimento_id,old.estabelecimento_id); v_chave text:=tg_argv[0];
begin
  if tg_op='DELETE' then return old; end if;
  if tg_table_name='push_assinaturas' and coalesce((to_jsonb(new)->>'ativa')::boolean,false)=false then return new; end if;
  if not private.funcionalidade_habilitada_1101(v_chave,v_est) then raise exception 'Recurso temporariamente indisponível.'; end if;
  return coalesce(new,old);
end $$;
revoke all on function private.bloquear_feature_desabilitada_1101() from public,anon,authenticated;

drop trigger if exists periodos_feature_guard_1101 on public.estabelecimento_horario_periodos;
create trigger periodos_feature_guard_1101 before insert or update on public.estabelecimento_horario_periodos
for each row execute function private.bloquear_feature_desabilitada_1101('operacao.multiplos_periodos');
drop trigger if exists importacoes_feature_guard_1101 on public.importacoes_operacionais;
create trigger importacoes_feature_guard_1101 before insert or update on public.importacoes_operacionais
for each row execute function private.bloquear_feature_desabilitada_1101('dados.importacao');
drop trigger if exists push_feature_guard_1101 on public.push_assinaturas;
create trigger push_feature_guard_1101 before insert or update or delete on public.push_assinaturas
for each row execute function private.bloquear_feature_desabilitada_1101('notificacoes.web_push');

create or replace function private.bloquear_operacao_especial_1101()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  if new.tipo_atendimento='manual' and not private.funcionalidade_habilitada_1101('operacao.atendimento_manual',new.estabelecimento_id)
    then raise exception 'Atendimento manual temporariamente indisponível.'; end if;
  return new;
end $$;
drop trigger if exists agendamentos_feature_guard_1101 on public.agendamentos;
create trigger agendamentos_feature_guard_1101 before insert or update of tipo_atendimento on public.agendamentos
for each row execute function private.bloquear_operacao_especial_1101();
revoke all on function private.bloquear_operacao_especial_1101() from public,anon,authenticated;

-- Preferências de avisos: cada categoria é respeitada antes de entrar na fila.
create or replace function private.enfileirar_push_110()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.push_entregas(notificacao_id,assinatura_id,user_id)
  select new.id,a.id,new.user_id from public.push_assinaturas a
  left join public.push_preferencias p on p.user_id=a.user_id and p.estabelecimento_id is not distinct from a.estabelecimento_id
  where a.user_id=new.user_id and a.ativa and (a.expiracao is null or a.expiracao>now())
    and private.funcionalidade_habilitada_1101('notificacoes.web_push',a.estabelecimento_id) and case
    when new.tipo='agendamento' and lower(new.titulo) like '%cancel%' then coalesce(p.cancelamentos,true)
    when new.tipo='agendamento' and lower(new.titulo) like '%confirm%' then coalesce(p.confirmacoes,true)
    when new.tipo='agendamento' then coalesce(p.agendamentos,true)
    when lower(new.titulo||' '||coalesce(new.mensagem,'')) like '%lista%espera%' then coalesce(p.lista_espera,true)
    when lower(new.titulo||' '||coalesce(new.mensagem,'')) like '%oportunidade%' then coalesce(p.oportunidades,false)
    when lower(new.titulo||' '||coalesce(new.mensagem,'')) like '%campanha%' then coalesce(p.campanhas,false)
    when lower(new.titulo||' '||coalesce(new.mensagem,'')) like '%lembrete%' then coalesce(p.lembretes,true)
    else true end
  on conflict(notificacao_id,assinatura_id) do nothing;
  return new;
end $$;
revoke all on function private.enfileirar_push_110() from public,anon,authenticated;

-- Retirada atômica da fila: duas instâncias do worker nunca recebem a mesma
-- entrega. Itens abandonados em "processando" voltam a ser elegíveis após 15 min.
create or replace function public.reivindicar_entregas_push_1101(p_limite integer default 50)
returns table(id uuid,notificacao_id uuid,assinatura_id uuid,tentativas smallint)
language plpgsql volatile security definer set search_path='' as $$
begin
  if p_limite<1 or p_limite>100 then raise exception 'Limite inválido.'; end if;
  return query with candidatas as (
    select e.id from public.push_entregas e
    where (e.status in ('pendente','falhou') and e.proxima_tentativa_em<=now())
       or (e.status='processando' and e.updated_at<now()-interval '15 minutes')
    order by e.proxima_tentativa_em,e.id for update skip locked limit p_limite
  ), reivindicadas as (
    update public.push_entregas e set status='processando',tentativas=least(e.tentativas+1,10),updated_at=now()
    from candidatas c where e.id=c.id
    returning e.id,e.notificacao_id,e.assinatura_id,e.tentativas
  ) select r.id,r.notificacao_id,r.assinatura_id,r.tentativas from reivindicadas r;
end $$;
revoke all on function public.reivindicar_entregas_push_1101(integer) from public,anon,authenticated;
grant execute on function public.reivindicar_entregas_push_1101(integer) to service_role;

-- Auditoria cobre regras de comissão, permissões, metas, campanhas e configuração pública.
alter table public.auditoria_operacional drop constraint if exists auditoria_operacional_recurso_check;
alter table public.auditoria_operacional add constraint auditoria_operacional_recurso_check
 check(recurso in ('agenda','financeiro','horarios','fechamento','importacao','configuracao','equipe','retencao','campanhas','crescimento','metas'));

create or replace function private.auditar_configuracao_1101()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_est uuid; v_entity uuid; v_resource text; v_before jsonb; v_after jsonb;
begin
  if tg_table_name='membro_permissoes' then
    select m.estabelecimento_id into v_est from public.estabelecimento_membros m where m.id=coalesce(new.membro_id,old.membro_id);
    v_entity:=coalesce(new.membro_id,old.membro_id); v_resource:='equipe';
  else v_est:=coalesce(new.estabelecimento_id,old.estabelecimento_id); v_entity:=coalesce(new.id,old.id);
    v_resource:=case tg_table_name when 'regras_comissao' then 'financeiro' when 'metas_crescimento' then 'metas'
      when 'campanhas' then 'campanhas' when 'estabelecimentos' then 'configuracao' else 'retencao' end;
  end if;
  v_before:=case when tg_op='INSERT' then null else to_jsonb(old)-'updated_at' end;
  v_after:=case when tg_op='DELETE' then null else to_jsonb(new)-'updated_at' end;
  if tg_op='UPDATE' and v_before=v_after then return new; end if;
  insert into public.auditoria_operacional(estabelecimento_id,ator_id,recurso,acao,entidade,entidade_id,dados_anteriores,dados_novos,request_id)
  values(v_est,(select auth.uid()),v_resource,lower(tg_op),tg_table_name,v_entity,v_before,v_after,
    nullif(nullif(current_setting('request.headers',true),'')::jsonb->>'x-request-id',''));
  return coalesce(new,old);
end $$;
revoke all on function private.auditar_configuracao_1101() from public,anon,authenticated;
drop trigger if exists regras_comissao_auditoria_1101 on public.regras_comissao;
create trigger regras_comissao_auditoria_1101 after insert or update or delete on public.regras_comissao for each row execute function private.auditar_configuracao_1101();
drop trigger if exists permissoes_auditoria_1101 on public.membro_permissoes;
create trigger permissoes_auditoria_1101 after insert or update or delete on public.membro_permissoes for each row execute function private.auditar_configuracao_1101();
drop trigger if exists metas_auditoria_1101 on public.metas_crescimento;
create trigger metas_auditoria_1101 after insert or update or delete on public.metas_crescimento for each row execute function private.auditar_configuracao_1101();
drop trigger if exists campanhas_auditoria_1101 on public.campanhas;
create trigger campanhas_auditoria_1101 after insert or update or delete on public.campanhas for each row execute function private.auditar_configuracao_1101();
drop trigger if exists estabelecimentos_config_auditoria_1101 on public.estabelecimentos;
create trigger estabelecimentos_config_auditoria_1101 after update of aceita_agendamento,status_manual,motivo_status,capa_url,endereco,numero,bairro,cidade,estado,cep,latitude,longitude
on public.estabelecimentos for each row execute function private.auditar_configuracao_1101();

-- Marketplace completo: serviço, preço, avaliação e disponibilidade entram no banco,
-- portanto a paginação e o total continuam corretos.
create or replace function public.buscar_marketplace_regional_1101(
  p_busca text default null,p_cidade text default null,p_bairro text default null,p_estado text default null,
  p_aberto_agora boolean default false,p_com_agenda boolean default false,p_latitude numeric default null,
  p_longitude numeric default null,p_raio_km numeric default null,p_servico text default null,
  p_preco_min numeric default null,p_preco_max numeric default null,p_avaliacao_min numeric default null,
  p_offset integer default 0,p_limite integer default 24)
returns table(id uuid,nome text,slug text,descricao text,cidade text,estado char(2),bairro text,endereco text,
  numero text,foto_url text,capa_url text,avaliacao numeric,aceita_agendamento boolean,verificado boolean,
  destaque boolean,latitude numeric,longitude numeric,distancia_km numeric,aberto boolean,total_resultados bigint)
language plpgsql security definer set search_path='' as $$
begin
  if not private.funcionalidade_habilitada_1101('marketplace.regional',null) then raise exception 'Busca regional temporariamente indisponível.'; end if;
  if p_limite<1 or p_limite>60 or p_offset<0 or p_offset>10000 then raise exception 'Paginação inválida.'; end if;
  if (p_latitude is null)<>(p_longitude is null) then raise exception 'Informe latitude e longitude juntas.'; end if;
  if p_raio_km is not null and (p_raio_km<=0 or p_raio_km>500) then raise exception 'Raio inválido.'; end if;
  if p_preco_min is not null and p_preco_min<0 or p_preco_max is not null and p_preco_max<0
    or p_preco_min is not null and p_preco_max is not null and p_preco_min>p_preco_max then raise exception 'Faixa de preço inválida.'; end if;
  if p_avaliacao_min is not null and (p_avaliacao_min<0 or p_avaliacao_min>5) then raise exception 'Avaliação inválida.'; end if;
  return query with base as (
    select e.*,private.distancia_km_110(p_latitude,p_longitude,e.latitude,e.longitude) distancia,
      public.estabelecimento_aberto_agora(e.id) esta_aberto
    from public.estabelecimentos e where e.visivel and e.onboarding_concluido and not e.suspenso_pela_moderacao
      and e.tipo_estabelecimento='barbearia'
      and (nullif(trim(coalesce(p_cidade,'')),'') is null or e.cidade ilike trim(p_cidade))
      and (nullif(trim(coalesce(p_bairro,'')),'') is null or e.bairro ilike trim(p_bairro))
      and (nullif(trim(coalesce(p_estado,'')),'') is null or e.estado=upper(trim(p_estado)))
      and (not p_com_agenda or e.aceita_agendamento)
      and (p_avaliacao_min is null or coalesce(e.avaliacao,0)>=p_avaliacao_min)
      and (nullif(trim(coalesce(p_busca,'')),'') is null or e.nome ilike '%'||trim(p_busca)||'%'
        or e.cidade ilike '%'||trim(p_busca)||'%' or e.bairro ilike '%'||trim(p_busca)||'%'
        or e.descricao ilike '%'||trim(p_busca)||'%' or exists(select 1 from public.servicos s
          where s.estabelecimento_id=e.id and s.ativo and s.publico and s.nome ilike '%'||trim(p_busca)||'%'))
      and (nullif(trim(coalesce(p_servico,'')),'') is null or exists(select 1 from public.servicos s
        where s.estabelecimento_id=e.id and s.ativo and s.publico and s.nome ilike '%'||trim(p_servico)||'%'))
      and ((p_preco_min is null and p_preco_max is null) or exists(select 1 from public.servicos s
        where s.estabelecimento_id=e.id and s.ativo and s.publico
          and (p_preco_min is null or s.preco>=p_preco_min) and (p_preco_max is null or s.preco<=p_preco_max)))
  ), filtrada as (
    select b.*,count(*) over() total from base b where (not p_aberto_agora or b.esta_aberto)
      and (p_raio_km is null or b.distancia is not null and b.distancia<=p_raio_km)
  ) select f.id,f.nome,f.slug,f.descricao,f.cidade,f.estado,f.bairro,f.endereco,f.numero,f.foto_url,f.capa_url,
      f.avaliacao,f.aceita_agendamento,f.verificado,f.destaque,f.latitude,f.longitude,f.distancia,f.esta_aberto,f.total
    from filtrada f order by case when p_latitude is not null then f.distancia end asc nulls last,
      f.aceita_agendamento desc,f.destaque desc,f.avaliacao desc,f.nome,f.id offset p_offset limit p_limite;
end $$;
revoke all on function public.buscar_marketplace_regional_1101(text,text,text,text,boolean,boolean,numeric,numeric,numeric,text,numeric,numeric,numeric,integer,integer) from public;
grant execute on function public.buscar_marketplace_regional_1101(text,text,text,text,boolean,boolean,numeric,numeric,numeric,text,numeric,numeric,numeric,integer,integer) to anon,authenticated,service_role;
-- O RPC anterior não conhece os filtros nem o kill switch desta revisão.
revoke execute on function public.buscar_marketplace_regional_110(text,text,text,text,boolean,boolean,numeric,numeric,numeric,integer,integer) from anon,authenticated;
grant execute on function public.buscar_marketplace_regional_110(text,text,text,text,boolean,boolean,numeric,numeric,numeric,integer,integer) to service_role;
create index if not exists servicos_publicos_estabelecimento_preco_1101_idx on public.servicos(estabelecimento_id,preco) where ativo and publico;

commit;
