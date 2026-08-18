-- Barber Hub 1.8.0: assinaturas funcionais, herança de benefícios e enforcement.
-- Execute após a migration 15. Esta migration é aditiva e não edita migrations antigas.

begin;

-- ============================================================
-- 1. CAPACIDADES COMERCIAIS DOS PLANOS
-- ============================================================
alter table public.planos
  add column if not exists permite_clientes boolean not null default false,
  add column if not exists permite_promocoes boolean not null default false,
  add column if not exists permite_relatorios_avancados boolean not null default false,
  add column if not exists permite_exportacao boolean not null default false,
  add column if not exists limite_destaques_portfolio integer not null default 1,
  add column if not exists prioridade_marketplace smallint not null default 0;

update public.planos set
  descricao = 'Presença básica no portal para começar a divulgar o negócio.',
  preco_semanal = 0,
  preco_mensal = 0,
  limite_profissionais = 1,
  limite_publicacoes = 10,
  permite_agenda = false,
  permite_relatorios = false,
  permite_equipe = false,
  permite_clientes = false,
  permite_promocoes = false,
  permite_relatorios_avancados = false,
  permite_exportacao = false,
  limite_destaques_portfolio = 1,
  prioridade_marketplace = 0,
  recursos = '["Página pública","Horários e contatos","Status aberto/fechado","Avaliações e reputação","Até 10 publicações","1 profissional"]'::jsonb,
  ordenacao = 1,
  destaque = false,
  ativo = true
where slug = 'gratuito';

update public.planos set
  descricao = 'Agenda, relacionamento e gestão essencial para profissionais autônomos.',
  preco_semanal = 0,
  preco_mensal = 49,
  limite_profissionais = 1,
  limite_publicacoes = 50,
  permite_agenda = true,
  permite_relatorios = true,
  permite_equipe = false,
  permite_clientes = true,
  permite_promocoes = true,
  permite_relatorios_avancados = false,
  permite_exportacao = false,
  limite_destaques_portfolio = 2,
  prioridade_marketplace = 0,
  recursos = '["Agenda online","Carteira de clientes","Promoções públicas","Relatórios essenciais","Até 50 publicações","2 destaques de portfólio"]'::jsonb,
  ordenacao = 2,
  destaque = true,
  ativo = true
where slug = 'essencial';

update public.planos set
  descricao = 'Gestão de equipe e inteligência operacional para barbearias em crescimento.',
  preco_semanal = 0,
  preco_mensal = 89,
  limite_profissionais = 3,
  limite_publicacoes = 150,
  permite_agenda = true,
  permite_relatorios = true,
  permite_equipe = true,
  permite_clientes = true,
  permite_promocoes = true,
  permite_relatorios_avancados = true,
  permite_exportacao = true,
  limite_destaques_portfolio = 3,
  prioridade_marketplace = 1,
  recursos = '["Até 3 profissionais","Relatórios avançados por profissional","Exportação CSV","Até 150 publicações","3 destaques de portfólio","Prioridade adicional no marketplace"]'::jsonb,
  ordenacao = 3,
  destaque = false,
  ativo = true
where slug = 'profissional';

update public.planos set
  descricao = 'Capacidade ampliada, máxima exposição e operação para equipes maiores.',
  preco_semanal = 0,
  preco_mensal = 129,
  limite_profissionais = 10,
  limite_publicacoes = 500,
  permite_agenda = true,
  permite_relatorios = true,
  permite_equipe = true,
  permite_clientes = true,
  permite_promocoes = true,
  permite_relatorios_avancados = true,
  permite_exportacao = true,
  limite_destaques_portfolio = 5,
  prioridade_marketplace = 2,
  recursos = '["Até 10 profissionais","Até 500 publicações","5 destaques de portfólio","Prioridade máxima no marketplace"]'::jsonb,
  ordenacao = 4,
  destaque = false,
  ativo = true
where slug = 'elite';

-- ============================================================
-- 2. RESOLVEDOR CENTRAL DE ENTITLEMENTS
--    Benefícios são cumulativos por ordenação do plano.
-- ============================================================
create or replace function public.calcular_entitlements_estabelecimento(p_estabelecimento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
declare
  v_assinatura public.assinaturas%rowtype;
  v_efetivo public.planos%rowtype;
  v_contratado_slug text;
  v_contratado_nome text;
  v_ordem smallint;
  v_status text := 'gratuita';
  v_recursos jsonb := '[]'::jsonb;
begin
  select a.*
    into v_assinatura
  from public.assinaturas a
  where a.estabelecimento_id = p_estabelecimento_id
  limit 1;

  if v_assinatura.id is not null then
    v_status := v_assinatura.status;
    select p.slug, p.nome
      into v_contratado_slug, v_contratado_nome
    from public.planos p
    where p.id = v_assinatura.plano_id
    limit 1;
  end if;

  if v_assinatura.id is not null
     and v_assinatura.status in ('teste','ativa')
     and (v_assinatura.periodo_atual_fim is null or v_assinatura.periodo_atual_fim >= current_date)
  then
    select * into v_efetivo
    from public.planos
    where id = v_assinatura.plano_id and ativo = true
    limit 1;
  end if;

  if v_efetivo.id is null then
    select * into v_efetivo
    from public.planos
    where slug = 'gratuito' and ativo = true
    limit 1;
  end if;

  if v_efetivo.id is null then
    raise exception 'Plano gratuito não configurado.';
  end if;

  v_ordem := v_efetivo.ordenacao;

  select coalesce(jsonb_agg(recurso order by primeira_ordem, recurso), '[]'::jsonb)
    into v_recursos
  from (
    select recurso, min(p.ordenacao) as primeira_ordem
    from public.planos p
    cross join lateral jsonb_array_elements_text(coalesce(p.recursos, '[]'::jsonb)) as recurso
    where p.ativo = true and p.ordenacao <= v_ordem
    group by recurso
  ) r;

  return jsonb_build_object(
    'assinatura_id', v_assinatura.id,
    'assinatura_status', v_status,
    'assinatura_periodo_fim', v_assinatura.periodo_atual_fim,
    'plano_contratado_slug', v_contratado_slug,
    'plano_contratado_nome', v_contratado_nome,
    'plano_id', v_efetivo.id,
    'plano_slug', v_efetivo.slug,
    'plano_nome', v_efetivo.nome,
    'plano_ordenacao', v_ordem,
    'limite_profissionais', (select max(p.limite_profissionais) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'limite_publicacoes', (select max(p.limite_publicacoes) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'limite_destaques_portfolio', (select max(p.limite_destaques_portfolio) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_agenda', (select bool_or(p.permite_agenda) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_relatorios', (select bool_or(p.permite_relatorios) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_equipe', (select bool_or(p.permite_equipe) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_clientes', (select bool_or(p.permite_clientes) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_promocoes', (select bool_or(p.permite_promocoes) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_relatorios_avancados', (select bool_or(p.permite_relatorios_avancados) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_exportacao', (select bool_or(p.permite_exportacao) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'prioridade_marketplace', (select max(p.prioridade_marketplace) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'recursos', v_recursos
  );
end;
$$;
revoke all on function public.calcular_entitlements_estabelecimento(uuid) from public, anon, authenticated;
grant execute on function public.calcular_entitlements_estabelecimento(uuid) to service_role;


-- Leitura pública mínima usada pelo catálogo/perfil para nunca anunciar agenda
-- quando a assinatura expirou, foi pausada ou perdeu o benefício.
create or replace function public.agenda_online_disponivel(p_estabelecimento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce(e.aceita_agendamento, false)
     and coalesce((public.calcular_entitlements_estabelecimento(e.id)->>'permite_agenda')::boolean, false)
  from public.estabelecimentos e
  where e.id = p_estabelecimento_id
$$;

revoke all on function public.agenda_online_disponivel(uuid) from public;
grant execute on function public.agenda_online_disponivel(uuid) to anon, authenticated, service_role;

-- Promoção é um benefício comercial. Mesmo que uma linha antiga continue com
-- ativo=true, visitantes não devem vê-la quando a assinatura perdeu o recurso.
create or replace function public.promocoes_publicas_disponiveis(p_estabelecimento_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public
as $$
  select coalesce((public.calcular_entitlements_estabelecimento(p_estabelecimento_id)->>'permite_promocoes')::boolean, false)
$$;

revoke all on function public.promocoes_publicas_disponiveis(uuid) from public;
grant execute on function public.promocoes_publicas_disponiveis(uuid) to anon, authenticated, service_role;

-- Separa a leitura pública da leitura do proprietário/admin para que a policy
-- de visitante não dependa de funções de propriedade da conta.
drop policy if exists promocoes_select_publico on public.promocoes;
create policy promocoes_select_publico on public.promocoes
for select to anon, authenticated
using (
  ativo = true
  and public.promocoes_publicas_disponiveis(estabelecimento_id)
  and exists (
    select 1 from public.estabelecimentos e
    where e.id = estabelecimento_id and e.visivel and e.onboarding_concluido
  )
);

drop policy if exists promocoes_select_owner_admin on public.promocoes;
create policy promocoes_select_owner_admin on public.promocoes
for select to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());

create or replace function public.obter_meus_entitlements(p_estabelecimento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = public
as $$
begin
  if auth.uid() is null then
    raise exception 'Autenticação obrigatória.';
  end if;
  if not public.owns_estabelecimento(p_estabelecimento_id) and not public.is_admin() then
    raise exception 'Sem permissão para consultar este plano.';
  end if;
  return public.calcular_entitlements_estabelecimento(p_estabelecimento_id);
end;
$$;

revoke all on function public.obter_meus_entitlements(uuid) from public, anon;
grant execute on function public.obter_meus_entitlements(uuid) to authenticated, service_role;

-- ============================================================
-- 3. ADMIN: ATRIBUIÇÃO IMEDIATA DE PLANO
-- ============================================================
create or replace function public.admin_atribuir_plano(
  p_estabelecimento_id uuid,
  p_plano_slug text,
  p_status text default 'ativa',
  p_periodo_fim date default null,
  p_observacoes text default null
)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano public.planos%rowtype;
  v_antes jsonb;
  v_depois jsonb;
  v_limite integer;
  v_limite_publicacoes integer;
  v_limite_destaques integer;
begin
  if not public.is_admin() then
    raise exception 'Apenas administradores podem alterar assinaturas.';
  end if;
  if p_status not in ('teste','ativa','atrasada','pausada','cancelada','expirada') then
    raise exception 'Status de assinatura inválido.';
  end if;
  if not exists(select 1 from public.estabelecimentos where id = p_estabelecimento_id) then
    raise exception 'Estabelecimento não encontrado.';
  end if;

  select * into v_plano from public.planos where slug = p_plano_slug and ativo = true limit 1;
  if v_plano.id is null then
    raise exception 'Plano não encontrado ou inativo.';
  end if;

  v_antes := public.calcular_entitlements_estabelecimento(p_estabelecimento_id);

  insert into public.assinaturas (
    estabelecimento_id, plano_id, status, inicio_em, teste_termina_em,
    periodo_atual_inicio, periodo_atual_fim, cancelar_ao_final, provedor, observacoes
  ) values (
    p_estabelecimento_id,
    v_plano.id,
    p_status,
    current_date,
    case when p_status = 'teste' then coalesce(p_periodo_fim, current_date + 90) else null end,
    current_date,
    case when p_status = 'teste' then coalesce(p_periodo_fim, current_date + 90) else p_periodo_fim end,
    false,
    'admin_manual',
    nullif(trim(coalesce(p_observacoes,'')), '')
  )
  on conflict (estabelecimento_id) do update set
    plano_id = excluded.plano_id,
    status = excluded.status,
    teste_termina_em = excluded.teste_termina_em,
    periodo_atual_inicio = excluded.periodo_atual_inicio,
    periodo_atual_fim = excluded.periodo_atual_fim,
    cancelar_ao_final = false,
    provedor = 'admin_manual',
    observacoes = excluded.observacoes,
    updated_at = now();

  v_depois := public.calcular_entitlements_estabelecimento(p_estabelecimento_id);

  -- Agenda: ao subir de um plano sem agenda para um com agenda, já fica ativa.
  if coalesce((v_depois->>'permite_agenda')::boolean, false) then
    if not coalesce((v_antes->>'permite_agenda')::boolean, false) then
      update public.estabelecimentos set aceita_agendamento = true where id = p_estabelecimento_id;
    end if;
  else
    update public.estabelecimentos set aceita_agendamento = false where id = p_estabelecimento_id;
  end if;

  -- Downgrade de equipe: não apaga profissionais; apenas inativa o excedente.
  v_limite := greatest(coalesce((v_depois->>'limite_profissionais')::integer, 1), 1);
  with ordenados as (
    select id, row_number() over(order by created_at asc, id asc) as pos
    from public.profissionais
    where estabelecimento_id = p_estabelecimento_id and ativo = true
  )
  update public.profissionais p
     set ativo = false, aceita_agendamento = false
  from ordenados o
  where p.id = o.id and o.pos > v_limite;

  -- Portfólio: preserva dados no downgrade, mas arquiva o excedente para que
  -- o limite represente slots utilizáveis e não apenas um bloqueio futuro.
  v_limite_publicacoes := greatest(coalesce((v_depois->>'limite_publicacoes')::integer, 10), 1);
  with ordenadas as (
    select id, row_number() over(order by created_at desc, id desc) as pos
    from public.portfolio_publicacoes
    where estabelecimento_id = p_estabelecimento_id and status <> 'arquivada'
  )
  update public.portfolio_publicacoes p
     set status = 'arquivada', destaque = false
  from ordenadas o
  where p.id = o.id and o.pos > v_limite_publicacoes;

  v_limite_destaques := greatest(coalesce((v_depois->>'limite_destaques_portfolio')::integer, 1), 1);
  with destaques as (
    select id, row_number() over(order by created_at desc, id desc) as pos
    from public.portfolio_publicacoes
    where estabelecimento_id = p_estabelecimento_id and destaque = true and status <> 'arquivada'
  )
  update public.portfolio_publicacoes p
     set destaque = false
  from destaques d
  where p.id = d.id and d.pos > v_limite_destaques;

  -- Promoções deixam de ficar públicas quando o benefício não pertence ao plano efetivo.
  if not coalesce((v_depois->>'permite_promocoes')::boolean, false) then
    update public.promocoes set ativo = false where estabelecimento_id = p_estabelecimento_id and ativo = true;
  end if;

  return v_depois;
end;
$$;

revoke all on function public.admin_atribuir_plano(uuid,text,text,date,text) from public, anon;
grant execute on function public.admin_atribuir_plano(uuid,text,text,date,text) to authenticated, service_role;

-- ============================================================
-- 4. ENFORCEMENT DOS LIMITES
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

  v_ent := public.calcular_entitlements_estabelecimento(new.estabelecimento_id);
  v_limite := greatest(coalesce((v_ent->>'limite_profissionais')::integer, 1), 1);
  select count(*) into v_total from public.profissionais
  where estabelecimento_id = new.estabelecimento_id and ativo = true and id <> new.id;

  if v_total >= v_limite then
    raise exception 'Seu plano permite até % profissional(is) ativo(s). Faça upgrade para ampliar a equipe.', v_limite;
  end if;
  return new;
end;
$$;

drop trigger if exists profissionais_validar_plano on public.profissionais;
create trigger profissionais_validar_plano
before insert or update of ativo on public.profissionais
for each row execute function public.validar_profissional_limite_plano();

create or replace function public.validar_estabelecimento_agenda_plano()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_ent jsonb;
begin
  if new.aceita_agendamento = true and old.aceita_agendamento is distinct from true then
    v_ent := public.calcular_entitlements_estabelecimento(new.id);
    if not coalesce((v_ent->>'permite_agenda')::boolean, false) then
      raise exception 'A agenda online não está disponível no plano atual.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists estabelecimentos_validar_agenda_plano on public.estabelecimentos;
create trigger estabelecimentos_validar_agenda_plano
before update of aceita_agendamento on public.estabelecimentos
for each row execute function public.validar_estabelecimento_agenda_plano();

create or replace function public.validar_agendamento_plano()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_ent jsonb;
begin
  v_ent := public.calcular_entitlements_estabelecimento(new.estabelecimento_id);
  if not coalesce((v_ent->>'permite_agenda')::boolean, false) then
    raise exception 'Este estabelecimento não possui agenda online no plano atual.';
  end if;
  return new;
end;
$$;

drop trigger if exists agendamentos_validar_plano on public.agendamentos;
create trigger agendamentos_validar_plano
before insert on public.agendamentos
for each row execute function public.validar_agendamento_plano();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'promocoes_periodo_valido' and conrelid = 'public.promocoes'::regclass
  ) then
    alter table public.promocoes
      add constraint promocoes_periodo_valido
      check (termina_em is null or inicia_em is null or termina_em >= inicia_em);
  end if;
end $$;

create or replace function public.validar_promocao_plano()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_ent jsonb;
begin
  if new.ativo = true then
    v_ent := public.calcular_entitlements_estabelecimento(new.estabelecimento_id);
    if not coalesce((v_ent->>'permite_promocoes')::boolean, false) then
      raise exception 'Promoções públicas estão disponíveis a partir do plano Essencial.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists promocoes_validar_plano on public.promocoes;
create trigger promocoes_validar_plano
before insert or update of ativo on public.promocoes
for each row execute function public.validar_promocao_plano();

-- Substitui o limite fixo de 50/3 por limites do plano efetivo.
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
  v_ent jsonb;
  v_limite integer;
  v_limite_destaques integer;
begin
  if new.autor_id is null then new.autor_id := auth.uid(); end if;

  if not public.is_admin() then
    if auth.uid() is null or new.autor_id <> auth.uid() or not public.owns_estabelecimento(new.estabelecimento_id) then
      raise exception 'Somente o proprietário pode gerenciar esta galeria.';
    end if;
  end if;

  v_ent := public.calcular_entitlements_estabelecimento(new.estabelecimento_id);
  v_limite := greatest(coalesce((v_ent->>'limite_publicacoes')::integer, 10), 1);
  v_limite_destaques := greatest(coalesce((v_ent->>'limite_destaques_portfolio')::integer, 1), 1);

  if tg_op = 'INSERT' then
    select count(*) into v_total from public.portfolio_publicacoes where estabelecimento_id = new.estabelecimento_id and status <> 'arquivada';
    if v_total >= v_limite then
      raise exception 'Seu plano permite até % publicações. Faça upgrade para ampliar o portfólio.', v_limite;
    end if;
  end if;

  new.tags := coalesce((select array_agg(distinct left(trim(tag),30))
    from unnest(coalesce(new.tags,'{}')) tag where nullif(trim(tag),'') is not null),'{}');
  if cardinality(new.tags) > 5 then raise exception 'Use no máximo 5 tags.'; end if;

  if new.destaque then
    select count(*) into v_destaques from public.portfolio_publicacoes
    where estabelecimento_id = new.estabelecimento_id and destaque = true and id <> new.id;
    if v_destaques >= v_limite_destaques then
      raise exception 'Seu plano permite destacar no máximo % trabalho(s).', v_limite_destaques;
    end if;
  end if;

  if new.status = 'publicada' then
    if not new.confirmou_autorizacao then raise exception 'Confirme a autorização de uso das imagens antes de publicar.'; end if;
    if new.possui_menor and not new.confirmou_responsavel then raise exception 'Confirme a autorização do responsável legal.'; end if;
    select count(*) into v_midias from public.portfolio_midias where publicacao_id = new.id;
    if v_midias < 1 then raise exception 'Adicione pelo menos uma imagem antes de publicar.'; end if;
    if new.modo = 'antes_depois' and v_midias < 2 then raise exception 'O modo antes e depois precisa de pelo menos duas imagens.'; end if;
    new.autorizado_em := coalesce(new.autorizado_em,now());
  end if;
  return new;
end;
$$;

-- Novos estabelecimentos começam realmente no gratuito, sem agenda online ativa.
create or replace function public.criar_assinatura_padrao_estabelecimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_plano_gratuito uuid;
begin
  select id into v_plano_gratuito from public.planos where slug = 'gratuito' limit 1;
  if v_plano_gratuito is null then return new; end if;

  insert into public.assinaturas (
    estabelecimento_id, plano_id, status, inicio_em, teste_termina_em,
    periodo_atual_inicio, periodo_atual_fim, observacoes
  ) values (
    new.id, v_plano_gratuito, 'ativa', current_date, null,
    current_date, null, 'Assinatura criada automaticamente no perfil gratuito.'
  ) on conflict (estabelecimento_id) do nothing;

  update public.estabelecimentos set aceita_agendamento = false where id = new.id;
  return new;
end;
$$;

-- O gratuito não é mais um teste de 90 dias: normaliza registros legados.
update public.assinaturas a
set status = 'ativa',
    teste_termina_em = null,
    periodo_atual_fim = null,
    observacoes = coalesce(nullif(a.observacoes,''), 'Perfil gratuito permanente.'),
    updated_at = now()
from public.planos p
where a.plano_id = p.id and p.slug = 'gratuito' and a.status = 'teste';

-- Corrige estabelecimentos atualmente no gratuito que herdaram agenda=true de versões antigas.
update public.estabelecimentos e
set aceita_agendamento = false
where exists (
  select 1 from public.assinaturas a
  join public.planos p on p.id = a.plano_id
  where a.estabelecimento_id = e.id
    and p.slug = 'gratuito'
    and a.status in ('teste','ativa')
)
and e.aceita_agendamento = true;

-- Normaliza imediatamente a quantidade de profissionais já ativos. O portfólio
-- legado é ajustado de forma segura na próxima atribuição administrativa de plano.
with ranked as (
  select p.id, row_number() over(partition by p.estabelecimento_id order by p.created_at asc, p.id asc) as pos,
         greatest(coalesce((public.calcular_entitlements_estabelecimento(p.estabelecimento_id)->>'limite_profissionais')::integer,1),1) as limite
  from public.profissionais p where p.ativo = true
)
update public.profissionais p
set ativo = false, aceita_agendamento = false
from ranked r
where p.id = r.id and r.pos > r.limite;

-- Portfólio legado é normalizado na primeira atribuição administrativa de plano;
-- evita disparar o trigger de autoria durante a própria migration sem sessão de usuário.

update public.promocoes p
set ativo = false
where p.ativo = true
  and not coalesce((public.calcular_entitlements_estabelecimento(p.estabelecimento_id)->>'permite_promocoes')::boolean,false);

update public.estabelecimentos e
set aceita_agendamento = false
where e.aceita_agendamento = true
  and not public.agenda_online_disponivel(e.id);

-- ============================================================
-- 5. RANKING: BENEFÍCIO REAL PARA PROFISSIONAL/ELITE
-- ============================================================
drop function if exists public.buscar_marketplace(text,text,boolean,text,integer,integer,boolean);

create function public.buscar_marketplace(
  p_busca text default null,
  p_tipo text default null,
  p_agenda boolean default null,
  p_status text default null,
  p_offset integer default 0,
  p_limit integer default 24,
  p_somente_destaques boolean default false
)
returns table (id uuid, relevancia real, aberto_agora boolean, agenda_disponivel boolean, total bigint)
language sql
stable
security definer
set search_path = public
as $$
  with parametros as (
    select nullif(trim(coalesce(p_busca, '')), '') as termo,
      greatest(coalesce(p_offset, 0), 0) as deslocamento,
      least(greatest(coalesce(p_limit, 24), 1), 60) as limite
  ),
  consulta as (
    select termo,
      case when termo is null then null::tsquery else websearch_to_tsquery('portuguese', termo) end as q_pt,
      case when termo is null then null::tsquery else websearch_to_tsquery('simple', termo) end as q_simple,
      deslocamento, limite
    from parametros
  ),
  base as (
    select e.id, e.destaque, e.avaliacao, e.created_at,
      (
        case when c.termo is null then 0 else greatest(ts_rank_cd(e.search_vector,c.q_pt),ts_rank_cd(e.search_vector,c.q_simple)) end
        + coalesce((select max(greatest(ts_rank_cd(s.search_vector,c.q_pt),ts_rank_cd(s.search_vector,c.q_simple)))
          from public.servicos s where s.estabelecimento_id=e.id and s.ativo=true and s.publico=true and c.termo is not null
            and (s.search_vector @@ c.q_pt or s.search_vector @@ c.q_simple)),0)
        + case when e.destaque then 0.22 else 0 end
        + case when public.agenda_online_disponivel(e.id) then 0.04 else 0 end
        + (coalesce(e.avaliacao,0)::real * 0.012)
        + coalesce((
          select max(p.prioridade_marketplace)::real * 0.035
          from public.assinaturas a
          join public.planos selecionado on selecionado.id = a.plano_id
          join public.planos p on p.ativo = true and p.ordenacao <= selecionado.ordenacao
          where a.estabelecimento_id=e.id
            and a.status in ('teste','ativa')
            and (a.periodo_atual_fim is null or a.periodo_atual_fim >= current_date)
        ),0)
      )::real as relevancia
    from public.estabelecimentos e cross join consulta c
    where e.visivel=true and e.onboarding_concluido=true
      and (p_tipo is null or p_tipo='' or p_tipo='todos' or e.tipo_estabelecimento=p_tipo)
      and (p_agenda is null or public.agenda_online_disponivel(e.id)=p_agenda)
      and (not p_somente_destaques or e.destaque=true)
      and (c.termo is null or e.search_vector @@ c.q_pt or e.search_vector @@ c.q_simple
        or exists(select 1 from public.servicos s where s.estabelecimento_id=e.id and s.ativo=true and s.publico=true and (s.search_vector @@ c.q_pt or s.search_vector @@ c.q_simple))
        or e.nome ilike '%'||c.termo||'%' or e.cidade ilike '%'||c.termo||'%' or e.bairro ilike '%'||c.termo||'%'
        or exists(select 1 from public.servicos s where s.estabelecimento_id=e.id and s.ativo=true and s.publico=true and (s.nome ilike '%'||c.termo||'%' or s.categoria ilike '%'||c.termo||'%')))
  ),
  filtrado as (
    select b.* from base b where p_status is null or p_status='' or p_status='todos'
      or (p_status='aberta' and public.estabelecimento_aberto_agora(b.id))
      or (p_status='fechada' and not public.estabelecimento_aberto_agora(b.id))
  ),
  contado as (select f.*,count(*) over() as total from filtrado f),
  paginado as (
    select ctd.* from contado ctd
    order by ctd.destaque desc,ctd.relevancia desc,ctd.avaliacao desc,ctd.created_at desc
    offset (select deslocamento from consulta) limit (select limite from consulta)
  )
  select p.id,p.relevancia,public.estabelecimento_aberto_agora(p.id),public.agenda_online_disponivel(p.id),p.total
  from paginado p
  order by p.destaque desc,p.relevancia desc,p.avaliacao desc,p.created_at desc;
$$;

revoke all on function public.buscar_marketplace(text,text,boolean,text,integer,integer,boolean) from public;
grant execute on function public.buscar_marketplace(text,text,boolean,text,integer,integer,boolean) to anon,authenticated,service_role;

-- Realtime permite que o painel do estabelecimento perceba upgrade/downgrade sem relogar.
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='assinaturas'
  ) then
    alter publication supabase_realtime add table public.assinaturas;
  end if;
exception when undefined_object then null;
end $$;

commit;
