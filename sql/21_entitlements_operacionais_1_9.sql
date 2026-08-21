-- Barber Hub 1.9.0: entitlements reais para agenda, CRM, financeiro e equipe.
-- Execute depois de 20_financeiro_comissoes_1_9.sql.

begin;

alter table public.planos
  add column if not exists permite_agenda_avancada boolean not null default false,
  add column if not exists permite_crm boolean not null default false,
  add column if not exists permite_financeiro boolean not null default false,
  add column if not exists permite_comissoes boolean not null default false,
  add column if not exists permite_equipe_acesso boolean not null default false,
  add column if not exists limite_membros_equipe integer not null default 0;

update public.planos set
  permite_agenda_avancada = false,
  permite_crm = false,
  permite_financeiro = false,
  permite_comissoes = false,
  permite_equipe_acesso = false,
  limite_membros_equipe = 0,
  recursos = '["Página pública","Horários e contatos","Status aberto/fechado","Avaliações e reputação","Até 10 publicações","1 profissional"]'::jsonb
where slug = 'gratuito';

update public.planos set
  descricao = 'Agenda profissional, clientes e controle financeiro para organizar o negócio.',
  permite_agenda_avancada = true,
  permite_crm = true,
  permite_financeiro = true,
  permite_comissoes = false,
  permite_equipe_acesso = false,
  limite_membros_equipe = 0,
  recursos = '["Agenda online","Agenda dia e semana","Reagendamento e bloqueios","CRM de clientes","Financeiro básico","Promoções públicas","Relatórios essenciais","Até 50 publicações","2 destaques de portfólio"]'::jsonb
where slug = 'essencial';

update public.planos set
  descricao = 'Equipe, comissões e inteligência operacional para negócios em crescimento.',
  permite_agenda_avancada = true,
  permite_crm = true,
  permite_financeiro = true,
  permite_comissoes = true,
  permite_equipe_acesso = true,
  limite_membros_equipe = 3,
  recursos = '["Até 3 profissionais","Acesso individual da equipe","Agenda individual","CRM com notas internas","Comissões automáticas","Fechamento do dia","Relatórios avançados por profissional","Exportação CSV","Até 150 publicações","3 destaques de portfólio","Prioridade adicional no marketplace"]'::jsonb
where slug = 'profissional';

update public.planos set
  descricao = 'Operação ampliada e base preparada para automação e crescimento orientado por dados.',
  permite_agenda_avancada = true,
  permite_crm = true,
  permite_financeiro = true,
  permite_comissoes = true,
  permite_equipe_acesso = true,
  limite_membros_equipe = 10,
  recursos = '["Até 10 profissionais","Acesso individual da equipe","Agenda individual","CRM com notas internas","Comissões automáticas","Fechamento do dia","Relatórios avançados","Exportação CSV","Até 500 publicações","5 destaques de portfólio","Prioridade máxima no marketplace"]'::jsonb
where slug = 'elite';

create or replace function public.calcular_entitlements_estabelecimento(p_estabelecimento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
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
  select a.* into v_assinatura
  from public.assinaturas a
  where a.estabelecimento_id = p_estabelecimento_id
  limit 1;

  if v_assinatura.id is not null then
    v_status := v_assinatura.status;
    select p.slug, p.nome into v_contratado_slug, v_contratado_nome
    from public.planos p where p.id = v_assinatura.plano_id limit 1;
  end if;

  if v_assinatura.id is not null
     and v_assinatura.status in ('teste','ativa')
     and (v_assinatura.periodo_atual_fim is null or v_assinatura.periodo_atual_fim >= current_date)
  then
    select * into v_efetivo from public.planos
    where id = v_assinatura.plano_id and ativo = true limit 1;
  end if;

  if v_efetivo.id is null then
    select * into v_efetivo from public.planos where slug = 'gratuito' and ativo = true limit 1;
  end if;
  if v_efetivo.id is null then raise exception 'Plano gratuito não configurado.'; end if;
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
    'limite_membros_equipe', (select max(p.limite_membros_equipe) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_agenda', (select bool_or(p.permite_agenda) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_agenda_avancada', (select bool_or(p.permite_agenda_avancada) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_relatorios', (select bool_or(p.permite_relatorios) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_equipe', (select bool_or(p.permite_equipe) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_equipe_acesso', (select bool_or(p.permite_equipe_acesso) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_clientes', (select bool_or(p.permite_clientes) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_crm', (select bool_or(p.permite_crm) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_financeiro', (select bool_or(p.permite_financeiro) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_comissoes', (select bool_or(p.permite_comissoes) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
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

create or replace function private.tem_recurso_operacional_19(
  p_estabelecimento_id uuid,
  p_recurso text
)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_entitlements jsonb;
begin
  if p_recurso not in (
    'permite_agenda_avancada','permite_crm','permite_financeiro',
    'permite_comissoes','permite_equipe_acesso'
  ) then return false; end if;
  v_entitlements := public.calcular_entitlements_estabelecimento(p_estabelecimento_id);
  return coalesce((v_entitlements->>p_recurso)::boolean, false);
end;
$$;

revoke all on function private.tem_recurso_operacional_19(uuid,text) from public, anon;
grant execute on function private.tem_recurso_operacional_19(uuid,text) to authenticated, service_role;

create or replace function public.obter_meus_entitlements(p_estabelecimento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then raise exception 'Autenticação obrigatória.'; end if;
  if not private.pode_operar_estabelecimento_19(p_estabelecimento_id) and not public.is_admin() then
    raise exception 'Sem permissão para consultar este plano.';
  end if;
  return public.calcular_entitlements_estabelecimento(p_estabelecimento_id);
end;
$$;

revoke all on function public.obter_meus_entitlements(uuid) from public, anon;
grant execute on function public.obter_meus_entitlements(uuid) to authenticated, service_role;

create or replace function public.validar_limite_membros_equipe_19()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entitlements jsonb;
  v_limite integer;
  v_total integer;
begin
  if new.status <> 'ativo' then return new; end if;
  perform pg_advisory_xact_lock(hashtextextended(new.estabelecimento_id::text || ':membros-19', 0));
  v_entitlements := public.calcular_entitlements_estabelecimento(new.estabelecimento_id);
  if not coalesce((v_entitlements->>'permite_equipe_acesso')::boolean, false) then
    raise exception 'O plano atual não libera acesso individual da equipe.';
  end if;
  v_limite := greatest(coalesce((v_entitlements->>'limite_membros_equipe')::integer, 0), 0);
  select count(*)::integer into v_total
  from public.estabelecimento_membros m
  where m.estabelecimento_id = new.estabelecimento_id
    and m.status = 'ativo'
    and (tg_op = 'INSERT' or m.id <> new.id);
  if v_total >= v_limite then
    raise exception 'Limite de acessos da equipe atingido para o plano atual.';
  end if;
  return new;
end;
$$;

drop trigger if exists membros_validar_plano_19 on public.estabelecimento_membros;
create trigger membros_validar_plano_19
before insert or update of status, estabelecimento_id
on public.estabelecimento_membros
for each row execute function public.validar_limite_membros_equipe_19();

revoke all on function public.validar_limite_membros_equipe_19() from public, anon, authenticated;

-- Reaplica RLS dos módulos operacionais com entitlement no banco.
drop policy if exists membros_select_operacional on public.estabelecimento_membros;
create policy membros_select_operacional on public.estabelecimento_membros
for select to authenticated
using (
  user_id = (select auth.uid())
  or public.owns_estabelecimento(estabelecimento_id)
  or public.is_admin()
  or (
    private.tem_recurso_operacional_19(estabelecimento_id, 'permite_equipe_acesso')
    and private.papel_no_estabelecimento_19(estabelecimento_id) = 'gerente'
  )
);

drop policy if exists membros_update_gestao on public.estabelecimento_membros;
create policy membros_update_gestao on public.estabelecimento_membros
for update to authenticated
using (
  public.owns_estabelecimento(estabelecimento_id)
  or public.is_admin()
  or (
    private.tem_recurso_operacional_19(estabelecimento_id, 'permite_equipe_acesso')
    and private.papel_no_estabelecimento_19(estabelecimento_id) = 'gerente'
  )
)
with check (
  public.owns_estabelecimento(estabelecimento_id)
  or public.is_admin()
  or (
    private.tem_recurso_operacional_19(estabelecimento_id, 'permite_equipe_acesso')
    and private.papel_no_estabelecimento_19(estabelecimento_id) = 'gerente'
  )
);

drop policy if exists crm_select_equipe on public.clientes_estabelecimento;
create policy crm_select_equipe on public.clientes_estabelecimento
for select to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_crm')
  and private.pode_operar_estabelecimento_19(estabelecimento_id)
);

drop policy if exists crm_update_equipe on public.clientes_estabelecimento;
create policy crm_update_equipe on public.clientes_estabelecimento
for update to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_crm')
  and private.pode_operar_estabelecimento_19(estabelecimento_id)
)
with check (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_crm')
  and private.pode_operar_estabelecimento_19(estabelecimento_id)
);

drop policy if exists lancamentos_select_financeiro on public.lancamentos_financeiros;
create policy lancamentos_select_financeiro on public.lancamentos_financeiros
for select to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_financeiro')
  and (
    private.pode_operar_estabelecimento_19(
      estabelecimento_id,
      array['proprietario','gerente','admin']::text[]
    )
    or profissional_id = private.profissional_vinculado_19(estabelecimento_id)
  )
);

drop policy if exists fechamentos_select_financeiro on public.fechamentos_diarios;
create policy fechamentos_select_financeiro on public.fechamentos_diarios
for select to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_financeiro')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);

drop policy if exists comissao_select_financeiro on public.regras_comissao;
create policy comissao_select_financeiro on public.regras_comissao
for select to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_comissoes')
  and (
    private.pode_operar_estabelecimento_19(
      estabelecimento_id,
      array['proprietario','gerente','admin']::text[]
    )
    or profissional_id = private.profissional_vinculado_19(estabelecimento_id)
  )
);

drop policy if exists comissao_manage_financeiro on public.regras_comissao;
create policy comissao_manage_financeiro on public.regras_comissao
for all to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_comissoes')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
)
with check (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_comissoes')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);

commit;
