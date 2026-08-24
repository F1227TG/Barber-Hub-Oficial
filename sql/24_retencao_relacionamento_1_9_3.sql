-- Barber Hub 1.9.3: retenção e relacionamento.
-- Execute depois de 23_advisors_pos_deploy_1_9.sql.

begin;

-- Data opcional para segmentar aniversariantes. A idade não é armazenada,
-- evitando manter um dado derivado que envelhece fora de sincronia.
alter table public.clientes_estabelecimento
  add column if not exists data_nascimento date,
  add column if not exists permite_email_marketing boolean not null default false;

-- ============================================================
-- 1. ENTITLEMENTS DA LINHA 1.9.3
-- ============================================================

alter table public.planos
  add column if not exists permite_lista_espera boolean not null default false,
  add column if not exists permite_recorrencia boolean not null default false,
  add column if not exists permite_fidelidade boolean not null default false,
  add column if not exists permite_cupons boolean not null default false,
  add column if not exists permite_campanhas boolean not null default false,
  add column if not exists permite_lembretes boolean not null default false,
  add column if not exists permite_oportunidades boolean not null default false,
  add column if not exists permite_insights boolean not null default false,
  add column if not exists permite_metas boolean not null default false,
  add column if not exists permite_permissoes_granulares boolean not null default false;

update public.planos set
  permite_lista_espera = false,
  permite_recorrencia = false,
  permite_fidelidade = false,
  permite_cupons = false,
  permite_campanhas = false,
  permite_lembretes = false,
  permite_oportunidades = false,
  permite_insights = false,
  permite_metas = false,
  permite_permissoes_granulares = false
where slug = 'gratuito';

update public.planos set
  permite_lista_espera = false,
  permite_recorrencia = false,
  permite_fidelidade = false,
  permite_cupons = true,
  permite_campanhas = false,
  permite_lembretes = false,
  permite_oportunidades = false,
  permite_insights = false,
  permite_metas = false,
  permite_permissoes_granulares = false
where slug = 'essencial';

update public.planos set
  permite_lista_espera = true,
  permite_recorrencia = true,
  permite_fidelidade = true,
  permite_cupons = true,
  permite_campanhas = false,
  permite_lembretes = true,
  permite_oportunidades = false,
  permite_insights = false,
  permite_metas = true,
  permite_permissoes_granulares = false
where slug = 'profissional';

update public.planos set
  permite_lista_espera = true,
  permite_recorrencia = true,
  permite_fidelidade = true,
  permite_cupons = true,
  permite_campanhas = true,
  permite_lembretes = true,
  permite_oportunidades = true,
  permite_insights = true,
  permite_metas = true,
  permite_permissoes_granulares = true
where slug = 'elite';

create or replace function public.calcular_entitlements_estabelecimento_193(p_estabelecimento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base jsonb;
  v_ordem smallint;
begin
  v_base := public.calcular_entitlements_estabelecimento(p_estabelecimento_id);
  v_ordem := coalesce((v_base->>'plano_ordenacao')::smallint, 0);
  return v_base || jsonb_build_object(
    'permite_lista_espera', (select coalesce(bool_or(p.permite_lista_espera), false) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_recorrencia', (select coalesce(bool_or(p.permite_recorrencia), false) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_fidelidade', (select coalesce(bool_or(p.permite_fidelidade), false) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_cupons', (select coalesce(bool_or(p.permite_cupons), false) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_campanhas', (select coalesce(bool_or(p.permite_campanhas), false) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_lembretes', (select coalesce(bool_or(p.permite_lembretes), false) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_oportunidades', (select coalesce(bool_or(p.permite_oportunidades), false) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_insights', (select coalesce(bool_or(p.permite_insights), false) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_metas', (select coalesce(bool_or(p.permite_metas), false) from public.planos p where p.ativo and p.ordenacao <= v_ordem),
    'permite_permissoes_granulares', (select coalesce(bool_or(p.permite_permissoes_granulares), false) from public.planos p where p.ativo and p.ordenacao <= v_ordem)
  );
end;
$$;

revoke all on function public.calcular_entitlements_estabelecimento_193(uuid) from public, anon, authenticated;
grant execute on function public.calcular_entitlements_estabelecimento_193(uuid) to service_role;

create or replace function private.tem_recurso_193(p_estabelecimento_id uuid, p_recurso text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_entitlements jsonb;
begin
  if p_recurso not in (
    'permite_lista_espera','permite_recorrencia','permite_fidelidade','permite_cupons',
    'permite_campanhas','permite_lembretes','permite_oportunidades','permite_insights',
    'permite_metas','permite_permissoes_granulares'
  ) then return false; end if;
  v_entitlements := public.calcular_entitlements_estabelecimento_193(p_estabelecimento_id);
  return coalesce((v_entitlements->>p_recurso)::boolean, false);
end;
$$;

revoke all on function private.tem_recurso_193(uuid,text) from public, anon;
grant execute on function private.tem_recurso_193(uuid,text) to authenticated, service_role;

create or replace function public.obter_meus_entitlements(p_estabelecimento_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select auth.uid()) is null then raise exception 'Autenticação obrigatória.'; end if;
  if not private.pode_operar_estabelecimento_19(p_estabelecimento_id) and not public.is_admin() then
    raise exception 'Sem permissão para consultar este plano.';
  end if;
  return public.calcular_entitlements_estabelecimento_193(p_estabelecimento_id);
end;
$$;

revoke all on function public.obter_meus_entitlements(uuid) from public, anon;
grant execute on function public.obter_meus_entitlements(uuid) to authenticated, service_role;

-- ============================================================
-- 2. LISTA DE ESPERA
-- ============================================================

create table if not exists public.lista_espera (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  cliente_id uuid not null references public.perfis(id) on delete cascade,
  profissional_id uuid references public.profissionais(id) on delete set null,
  servico_id uuid not null references public.servicos(id) on delete restrict,
  data_inicio date not null,
  data_fim date not null,
  horario_inicio time,
  horario_fim time,
  observacao text,
  status text not null default 'aguardando' check (status in ('aguardando','avisado','agendado','cancelado','expirado')),
  avisado_em timestamptz,
  aviso_expira_em timestamptz,
  criado_por uuid not null references public.perfis(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (data_inicio <= data_fim),
  check (data_fim <= data_inicio + 31),
  check (horario_inicio is null or horario_fim is null or horario_inicio < horario_fim),
  check (char_length(coalesce(observacao, '')) <= 500)
);

create index if not exists lista_espera_estabelecimento_status_data_idx
  on public.lista_espera(estabelecimento_id, status, data_inicio, created_at);
create index if not exists lista_espera_cliente_status_idx
  on public.lista_espera(cliente_id, status, created_at desc);
create unique index if not exists lista_espera_cliente_ativa_unique_idx
  on public.lista_espera(estabelecimento_id, cliente_id, servico_id)
  where status in ('aguardando','avisado');
create index if not exists lista_espera_profissional_idx
  on public.lista_espera(profissional_id) where profissional_id is not null;
create index if not exists lista_espera_servico_idx on public.lista_espera(servico_id);
create index if not exists lista_espera_criado_por_idx on public.lista_espera(criado_por);

drop trigger if exists lista_espera_updated_at on public.lista_espera;
create trigger lista_espera_updated_at before update on public.lista_espera
for each row execute function public.set_updated_at();

alter table public.lista_espera enable row level security;

drop policy if exists lista_espera_select_cliente_equipe on public.lista_espera;
create policy lista_espera_select_cliente_equipe on public.lista_espera
for select to authenticated
using (
  cliente_id = (select auth.uid())
  or (
    private.tem_recurso_193(estabelecimento_id, 'permite_lista_espera')
    and private.pode_operar_estabelecimento_19(estabelecimento_id)
  )
);

grant select on public.lista_espera to authenticated;
revoke insert, update, delete on public.lista_espera from anon, authenticated;

create or replace function public.entrar_lista_espera_193(
  p_estabelecimento_id uuid,
  p_servico_id uuid,
  p_profissional_id uuid,
  p_data_inicio date,
  p_data_fim date,
  p_horario_inicio time default null,
  p_horario_fim time default null,
  p_observacao text default null
)
returns public.lista_espera
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.lista_espera%rowtype;
begin
  if (select auth.uid()) is null then raise exception 'Faça login para entrar na lista de espera.'; end if;
  if not private.tem_recurso_193(p_estabelecimento_id, 'permite_lista_espera') then
    raise exception 'A lista de espera não está disponível neste estabelecimento.';
  end if;
  if p_data_inicio < current_date or p_data_fim < p_data_inicio or p_data_fim > p_data_inicio + 31 then
    raise exception 'Escolha um período futuro de até 32 dias.';
  end if;
  if p_horario_inicio is not null and p_horario_fim is not null and p_horario_inicio >= p_horario_fim then
    raise exception 'A faixa de horário é inválida.';
  end if;
  if not exists (
    select 1 from public.servicos s where s.id = p_servico_id
      and s.estabelecimento_id = p_estabelecimento_id and s.ativo and s.publico
  ) then raise exception 'Serviço indisponível.'; end if;
  if p_profissional_id is not null and not exists (
    select 1 from public.profissionais p where p.id = p_profissional_id
      and p.estabelecimento_id = p_estabelecimento_id and p.ativo and p.aceita_agendamento
  ) then raise exception 'Profissional indisponível.'; end if;

  insert into public.lista_espera(
    estabelecimento_id, cliente_id, profissional_id, servico_id, data_inicio, data_fim,
    horario_inicio, horario_fim, observacao, criado_por
  ) values (
    p_estabelecimento_id, (select auth.uid()), p_profissional_id, p_servico_id,
    p_data_inicio, p_data_fim, p_horario_inicio, p_horario_fim,
    nullif(trim(coalesce(p_observacao, '')), ''), (select auth.uid())
  ) returning * into v_item;
  return v_item;
exception when unique_violation then
  raise exception 'Você já está aguardando uma vaga para este serviço.';
end;
$$;

revoke all on function public.entrar_lista_espera_193(uuid,uuid,uuid,date,date,time,time,text) from public, anon;
grant execute on function public.entrar_lista_espera_193(uuid,uuid,uuid,date,date,time,time,text) to authenticated, service_role;

create or replace function public.atualizar_lista_espera_193(p_item_id uuid, p_status text)
returns public.lista_espera
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.lista_espera%rowtype;
begin
  if p_status not in ('aguardando','avisado','agendado','cancelado','expirado') then
    raise exception 'Status da lista de espera inválido.';
  end if;
  select * into v_item from public.lista_espera where id = p_item_id for update;
  if not found then raise exception 'Item da lista de espera não encontrado.'; end if;
  if v_item.cliente_id = (select auth.uid()) then
    if p_status <> 'cancelado' then raise exception 'O cliente só pode cancelar a própria espera.'; end if;
  elsif not private.pode_operar_estabelecimento_19(v_item.estabelecimento_id) then
    raise exception 'Sua conta não pode alterar esta lista de espera.';
  end if;
  update public.lista_espera set status = p_status where id = p_item_id returning * into v_item;
  return v_item;
end;
$$;

revoke all on function public.atualizar_lista_espera_193(uuid,text) from public, anon;
grant execute on function public.atualizar_lista_espera_193(uuid,text) to authenticated, service_role;

-- ============================================================
-- 3. AGENDAMENTO RECORRENTE
-- ============================================================

create table if not exists public.agendamentos_recorrencias (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  agendamento_origem_id uuid not null references public.agendamentos(id) on delete restrict,
  cliente_id uuid not null references public.perfis(id) on delete restrict,
  profissional_id uuid not null references public.profissionais(id) on delete restrict,
  frequencia text not null check (frequencia in ('semanal','quinzenal','mensal')),
  total_ocorrencias smallint not null check (total_ocorrencias between 2 and 24),
  ocorrencias_criadas smallint not null default 1 check (ocorrencias_criadas between 1 and 24),
  status text not null default 'ativa' check (status in ('ativa','pausada','encerrada','cancelada')),
  criado_por uuid not null references public.perfis(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.agendamentos
  add column if not exists recorrencia_id uuid references public.agendamentos_recorrencias(id) on delete set null,
  add column if not exists recorrencia_sequencia smallint;

do $$
begin
  if exists (
    select 1 from pg_constraint where conname = 'agendamentos_tipo_atendimento_check'
      and conrelid = 'public.agendamentos'::regclass
  ) then alter table public.agendamentos drop constraint agendamentos_tipo_atendimento_check; end if;
  alter table public.agendamentos add constraint agendamentos_tipo_atendimento_check
    check (tipo_atendimento in ('online','encaixe','interno','recorrente'));
exception when duplicate_object then null;
end $$;

create index if not exists agendamentos_recorrencias_estabelecimento_status_idx
  on public.agendamentos_recorrencias(estabelecimento_id, status, created_at desc);
create index if not exists agendamentos_recorrencia_sequencia_idx
  on public.agendamentos(recorrencia_id, recorrencia_sequencia)
  where recorrencia_id is not null;
create index if not exists recorrencias_origem_idx on public.agendamentos_recorrencias(agendamento_origem_id);
create index if not exists recorrencias_cliente_idx on public.agendamentos_recorrencias(cliente_id, created_at desc);
create index if not exists recorrencias_profissional_idx on public.agendamentos_recorrencias(profissional_id);
create index if not exists recorrencias_criado_por_idx on public.agendamentos_recorrencias(criado_por);

drop trigger if exists agendamentos_recorrencias_updated_at on public.agendamentos_recorrencias;
create trigger agendamentos_recorrencias_updated_at before update on public.agendamentos_recorrencias
for each row execute function public.set_updated_at();

alter table public.agendamentos_recorrencias enable row level security;
drop policy if exists recorrencias_select_cliente_equipe on public.agendamentos_recorrencias;
create policy recorrencias_select_cliente_equipe on public.agendamentos_recorrencias
for select to authenticated
using (
  cliente_id = (select auth.uid())
  or (
    private.tem_recurso_193(estabelecimento_id, 'permite_recorrencia')
    and private.pode_operar_estabelecimento_19(estabelecimento_id)
  )
);
grant select on public.agendamentos_recorrencias to authenticated;
revoke insert, update, delete on public.agendamentos_recorrencias from anon, authenticated;

create or replace function public.criar_recorrencia_agendamento_193(
  p_agendamento_id uuid,
  p_frequencia text,
  p_total_ocorrencias smallint
)
returns public.agendamentos_recorrencias
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_origem public.agendamentos%rowtype;
  v_recorrencia public.agendamentos_recorrencias%rowtype;
  v_novo_id uuid;
  v_data date;
  v_sequencia integer;
  v_limite integer;
begin
  if p_frequencia not in ('semanal','quinzenal','mensal') then raise exception 'Frequência inválida.'; end if;
  if p_total_ocorrencias < 2 or p_total_ocorrencias > 24 then raise exception 'Escolha entre 2 e 24 ocorrências.'; end if;
  select * into v_origem from public.agendamentos where id = p_agendamento_id for update;
  if not found then raise exception 'Agendamento de origem não encontrado.'; end if;
  if v_origem.status not in ('pendente','confirmado') then raise exception 'Use um agendamento futuro e ativo como origem.'; end if;
  if not private.tem_recurso_193(v_origem.estabelecimento_id, 'permite_recorrencia') then
    raise exception 'Agendamentos recorrentes não estão disponíveis no plano atual.';
  end if;
  if v_origem.cliente_id is distinct from (select auth.uid())
     and not private.pode_operar_estabelecimento_19(v_origem.estabelecimento_id) then
    raise exception 'Sua conta não pode criar esta recorrência.';
  end if;
  if v_origem.recorrencia_id is not null then raise exception 'Este agendamento já pertence a uma recorrência.'; end if;

  select limite_dias_agendamento into v_limite from public.estabelecimentos where id = v_origem.estabelecimento_id;
  insert into public.agendamentos_recorrencias(
    estabelecimento_id, agendamento_origem_id, cliente_id, profissional_id,
    frequencia, total_ocorrencias, criado_por
  ) values (
    v_origem.estabelecimento_id, v_origem.id, v_origem.cliente_id, v_origem.profissional_id,
    p_frequencia, p_total_ocorrencias, (select auth.uid())
  ) returning * into v_recorrencia;

  update public.agendamentos set recorrencia_id = v_recorrencia.id, recorrencia_sequencia = 1
  where id = v_origem.id;

  for v_sequencia in 2..p_total_ocorrencias loop
    v_data := case p_frequencia
      when 'semanal' then v_origem.data + (7 * (v_sequencia - 1))
      when 'quinzenal' then v_origem.data + (14 * (v_sequencia - 1))
      else (v_origem.data + make_interval(months => v_sequencia - 1))::date
    end;
    if v_data > current_date + greatest(v_limite, 1) then
      raise exception 'A recorrência ultrapassa o limite de antecedência do estabelecimento.';
    end if;
    if not exists (
      select 1 from public.horarios_funcionamento h
      where h.estabelecimento_id = v_origem.estabelecimento_id
        and h.dia_semana = extract(dow from v_data)::smallint and h.aberto
        and v_origem.hora_inicio >= h.abre and v_origem.hora_fim <= h.fecha
    ) then raise exception 'Uma ocorrência cairia fora do horário de funcionamento.'; end if;
    if exists (
      select 1 from public.agenda_bloqueios b
      where b.estabelecimento_id = v_origem.estabelecimento_id
        and (b.profissional_id is null or b.profissional_id = v_origem.profissional_id)
        and ((v_data + v_origem.hora_inicio) at time zone (select timezone from public.estabelecimentos where id = v_origem.estabelecimento_id)) < b.fim
        and ((v_data + v_origem.hora_fim) at time zone (select timezone from public.estabelecimentos where id = v_origem.estabelecimento_id)) > b.inicio
    ) then raise exception 'Uma ocorrência coincide com um bloqueio da agenda.'; end if;

    v_novo_id := gen_random_uuid();
    insert into public.agendamentos(
      id, estabelecimento_id, profissional_id, servico_id, cliente_id, cliente_nome,
      cliente_email, cliente_telefone, data, hora_inicio, hora_fim, status, observacao,
      valor, pagamento_status, origem, tipo_atendimento, recorrencia_id, recorrencia_sequencia
    ) values (
      v_novo_id, v_origem.estabelecimento_id, v_origem.profissional_id, v_origem.servico_id,
      v_origem.cliente_id, v_origem.cliente_nome, v_origem.cliente_email, v_origem.cliente_telefone,
      v_data, v_origem.hora_inicio, v_origem.hora_fim, 'pendente', v_origem.observacao,
      v_origem.valor, 'nao_disponivel', 'recorrencia', 'recorrente', v_recorrencia.id, v_sequencia
    );
    insert into public.agendamento_servicos(
      agendamento_id, servico_id, ordem, nome_snapshot, preco_snapshot, duracao_min_snapshot
    ) select v_novo_id, s.servico_id, s.ordem, s.nome_snapshot, s.preco_snapshot, s.duracao_min_snapshot
      from public.agendamento_servicos s where s.agendamento_id = v_origem.id;
  end loop;

  update public.agendamentos_recorrencias set ocorrencias_criadas = p_total_ocorrencias
  where id = v_recorrencia.id returning * into v_recorrencia;
  return v_recorrencia;
end;
$$;

revoke all on function public.criar_recorrencia_agendamento_193(uuid,text,smallint) from public, anon;
grant execute on function public.criar_recorrencia_agendamento_193(uuid,text,smallint) to authenticated, service_role;

-- ============================================================
-- 4. FIDELIDADE E RECOMPENSAS
-- ============================================================

create table if not exists public.fidelidade_programas (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null unique references public.estabelecimentos(id) on delete cascade,
  nome text not null default 'Clube de fidelidade',
  pontos_por_visita integer not null default 1 check (pontos_por_visita between 0 and 10000),
  reais_por_ponto numeric(10,2) not null default 0 check (reais_por_ponto >= 0),
  validade_dias integer check (validade_dias between 1 and 3650),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fidelidade_recompensas (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references public.fidelidade_programas(id) on delete cascade,
  nome text not null,
  descricao text,
  pontos_necessarios integer not null check (pontos_necessarios > 0),
  estoque integer check (estoque is null or estoque >= 0),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.fidelidade_saldos (
  programa_id uuid not null references public.fidelidade_programas(id) on delete cascade,
  cliente_id uuid not null references public.perfis(id) on delete cascade,
  pontos integer not null default 0 check (pontos >= 0),
  total_creditado integer not null default 0 check (total_creditado >= 0),
  total_resgatado integer not null default 0 check (total_resgatado >= 0),
  updated_at timestamptz not null default now(),
  primary key (programa_id, cliente_id)
);

create table if not exists public.fidelidade_movimentos (
  id uuid primary key default gen_random_uuid(),
  programa_id uuid not null references public.fidelidade_programas(id) on delete cascade,
  cliente_id uuid not null references public.perfis(id) on delete cascade,
  agendamento_id uuid references public.agendamentos(id) on delete set null,
  recompensa_id uuid references public.fidelidade_recompensas(id) on delete set null,
  tipo text not null check (tipo in ('credito','resgate','ajuste','expiracao')),
  pontos integer not null check (pontos <> 0),
  descricao text not null,
  criado_por uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now()
);

create unique index if not exists fidelidade_credito_agendamento_unique_idx
  on public.fidelidade_movimentos(agendamento_id)
  where agendamento_id is not null and tipo = 'credito';
create index if not exists fidelidade_movimentos_cliente_idx
  on public.fidelidade_movimentos(programa_id, cliente_id, created_at desc);
create index if not exists fidelidade_recompensas_programa_idx
  on public.fidelidade_recompensas(programa_id, ativo, pontos_necessarios);
create index if not exists fidelidade_saldos_cliente_idx on public.fidelidade_saldos(cliente_id);
create index if not exists fidelidade_movimentos_agendamento_idx
  on public.fidelidade_movimentos(agendamento_id) where agendamento_id is not null;
create index if not exists fidelidade_movimentos_recompensa_idx
  on public.fidelidade_movimentos(recompensa_id) where recompensa_id is not null;
create index if not exists fidelidade_movimentos_criado_por_idx
  on public.fidelidade_movimentos(criado_por) where criado_por is not null;

drop trigger if exists fidelidade_programas_updated_at on public.fidelidade_programas;
create trigger fidelidade_programas_updated_at before update on public.fidelidade_programas
for each row execute function public.set_updated_at();
drop trigger if exists fidelidade_recompensas_updated_at on public.fidelidade_recompensas;
create trigger fidelidade_recompensas_updated_at before update on public.fidelidade_recompensas
for each row execute function public.set_updated_at();

alter table public.fidelidade_programas enable row level security;
alter table public.fidelidade_recompensas enable row level security;
alter table public.fidelidade_saldos enable row level security;
alter table public.fidelidade_movimentos enable row level security;

drop policy if exists fidelidade_programas_select on public.fidelidade_programas;
create policy fidelidade_programas_select on public.fidelidade_programas for select to authenticated
using (private.tem_recurso_193(estabelecimento_id, 'permite_fidelidade') and (
  private.pode_operar_estabelecimento_19(estabelecimento_id)
  or exists (
    select 1 from public.agendamentos a
    where a.estabelecimento_id = fidelidade_programas.estabelecimento_id
      and a.cliente_id = (select auth.uid())
  )
));
drop policy if exists fidelidade_programas_manage on public.fidelidade_programas;
create policy fidelidade_programas_manage on public.fidelidade_programas for all to authenticated
using (private.tem_recurso_193(estabelecimento_id, 'permite_fidelidade') and private.pode_operar_estabelecimento_19(estabelecimento_id, array['proprietario','gerente','admin']::text[]))
with check (private.tem_recurso_193(estabelecimento_id, 'permite_fidelidade') and private.pode_operar_estabelecimento_19(estabelecimento_id, array['proprietario','gerente','admin']::text[]));
drop policy if exists fidelidade_recompensas_select on public.fidelidade_recompensas;
create policy fidelidade_recompensas_select on public.fidelidade_recompensas for select to authenticated
using (exists (
  select 1 from public.fidelidade_programas p
  where p.id = programa_id
    and private.tem_recurso_193(p.estabelecimento_id, 'permite_fidelidade')
    and (
      private.pode_operar_estabelecimento_19(p.estabelecimento_id)
      or exists (
        select 1 from public.agendamentos a
        where a.estabelecimento_id = p.estabelecimento_id
          and a.cliente_id = (select auth.uid())
      )
    )
));
drop policy if exists fidelidade_recompensas_manage on public.fidelidade_recompensas;
create policy fidelidade_recompensas_manage on public.fidelidade_recompensas for all to authenticated
using (exists (select 1 from public.fidelidade_programas p where p.id = programa_id and private.tem_recurso_193(p.estabelecimento_id, 'permite_fidelidade') and private.pode_operar_estabelecimento_19(p.estabelecimento_id, array['proprietario','gerente','admin']::text[])))
with check (exists (select 1 from public.fidelidade_programas p where p.id = programa_id and private.tem_recurso_193(p.estabelecimento_id, 'permite_fidelidade') and private.pode_operar_estabelecimento_19(p.estabelecimento_id, array['proprietario','gerente','admin']::text[])));
drop policy if exists fidelidade_saldos_select on public.fidelidade_saldos;
create policy fidelidade_saldos_select on public.fidelidade_saldos for select to authenticated
using (cliente_id = (select auth.uid()) or exists (select 1 from public.fidelidade_programas p where p.id = programa_id and private.pode_operar_estabelecimento_19(p.estabelecimento_id)));
drop policy if exists fidelidade_movimentos_select on public.fidelidade_movimentos;
create policy fidelidade_movimentos_select on public.fidelidade_movimentos for select to authenticated
using (cliente_id = (select auth.uid()) or exists (select 1 from public.fidelidade_programas p where p.id = programa_id and private.pode_operar_estabelecimento_19(p.estabelecimento_id)));

grant select, insert, update on public.fidelidade_programas to authenticated;
grant select, insert, update on public.fidelidade_recompensas to authenticated;
grant select on public.fidelidade_saldos, public.fidelidade_movimentos to authenticated;

create or replace function public.creditar_fidelidade_agendamento_193()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_programa public.fidelidade_programas%rowtype; v_pontos integer;
begin
  if new.status <> 'concluido' or old.status = 'concluido' or new.cliente_id is null then return new; end if;
  if not private.tem_recurso_193(new.estabelecimento_id, 'permite_fidelidade') then return new; end if;
  select * into v_programa from public.fidelidade_programas p
  where p.estabelecimento_id = new.estabelecimento_id and p.ativo limit 1;
  if not found then return new; end if;
  v_pontos := greatest(v_programa.pontos_por_visita, 0)
    + case when v_programa.reais_por_ponto > 0 then floor(new.valor / v_programa.reais_por_ponto)::integer else 0 end;
  if v_pontos <= 0 then return new; end if;
  insert into public.fidelidade_movimentos(programa_id, cliente_id, agendamento_id, tipo, pontos, descricao)
  values (v_programa.id, new.cliente_id, new.id, 'credito', v_pontos, 'Pontos do atendimento concluído')
  on conflict (agendamento_id) where agendamento_id is not null and tipo = 'credito' do nothing;
  if found then
    insert into public.fidelidade_saldos(programa_id, cliente_id, pontos, total_creditado)
    values (v_programa.id, new.cliente_id, v_pontos, v_pontos)
    on conflict (programa_id, cliente_id) do update
    set pontos = public.fidelidade_saldos.pontos + excluded.pontos,
        total_creditado = public.fidelidade_saldos.total_creditado + excluded.total_creditado,
        updated_at = now();
  end if;
  return new;
end;
$$;

drop trigger if exists agendamentos_creditar_fidelidade_193 on public.agendamentos;
create trigger agendamentos_creditar_fidelidade_193 after update of status on public.agendamentos
for each row execute function public.creditar_fidelidade_agendamento_193();
revoke all on function public.creditar_fidelidade_agendamento_193() from public, anon, authenticated;

create or replace function public.resgatar_recompensa_193(p_recompensa_id uuid, p_cliente_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_recompensa public.fidelidade_recompensas%rowtype; v_programa public.fidelidade_programas%rowtype; v_saldo integer;
begin
  select * into v_recompensa from public.fidelidade_recompensas where id = p_recompensa_id and ativo for update;
  if not found then raise exception 'Recompensa indisponível.'; end if;
  select * into v_programa from public.fidelidade_programas where id = v_recompensa.programa_id and ativo;
  if not found or not private.tem_recurso_193(v_programa.estabelecimento_id, 'permite_fidelidade') then
    raise exception 'Programa de fidelidade indisponível.';
  end if;
  if p_cliente_id is distinct from (select auth.uid())
     and not private.pode_operar_estabelecimento_19(v_programa.estabelecimento_id) then
    raise exception 'Sua conta não pode resgatar esta recompensa.';
  end if;
  select pontos into v_saldo from public.fidelidade_saldos
  where programa_id = v_programa.id and cliente_id = p_cliente_id for update;
  if coalesce(v_saldo, 0) < v_recompensa.pontos_necessarios then raise exception 'Saldo de pontos insuficiente.'; end if;
  if v_recompensa.estoque is not null and v_recompensa.estoque <= 0 then raise exception 'Recompensa esgotada.'; end if;
  update public.fidelidade_saldos set
    pontos = pontos - v_recompensa.pontos_necessarios,
    total_resgatado = total_resgatado + v_recompensa.pontos_necessarios,
    updated_at = now()
  where programa_id = v_programa.id and cliente_id = p_cliente_id;
  update public.fidelidade_recompensas set estoque = case when estoque is null then null else estoque - 1 end
  where id = v_recompensa.id;
  insert into public.fidelidade_movimentos(programa_id, cliente_id, recompensa_id, tipo, pontos, descricao, criado_por)
  values (v_programa.id, p_cliente_id, v_recompensa.id, 'resgate', -v_recompensa.pontos_necessarios,
    'Resgate: ' || v_recompensa.nome, (select auth.uid()));
  return jsonb_build_object('recompensa_id', v_recompensa.id, 'pontos_usados', v_recompensa.pontos_necessarios,
    'saldo', v_saldo - v_recompensa.pontos_necessarios);
end;
$$;

revoke all on function public.resgatar_recompensa_193(uuid,uuid) from public, anon;
grant execute on function public.resgatar_recompensa_193(uuid,uuid) to authenticated, service_role;

-- ============================================================
-- 5. CUPONS COM VALIDAÇÃO E RESGATE TRANSACIONAL
-- ============================================================

create table if not exists public.cupons (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  codigo text not null,
  nome text not null,
  tipo_desconto text not null check (tipo_desconto in ('percentual','fixo')),
  valor_desconto numeric(10,2) not null check (valor_desconto > 0),
  desconto_maximo numeric(10,2) check (desconto_maximo is null or desconto_maximo > 0),
  valor_minimo numeric(10,2) not null default 0 check (valor_minimo >= 0),
  limite_total integer check (limite_total is null or limite_total > 0),
  limite_por_cliente integer not null default 1 check (limite_por_cliente between 1 and 100),
  inicia_em timestamptz not null default now(),
  termina_em timestamptz,
  ativo boolean not null default true,
  criado_por uuid not null references public.perfis(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (termina_em is null or termina_em > inicia_em),
  check (tipo_desconto <> 'percentual' or valor_desconto <= 100)
);

create unique index if not exists cupons_estabelecimento_codigo_unique_idx
  on public.cupons(estabelecimento_id, lower(codigo));
create index if not exists cupons_estabelecimento_ativo_periodo_idx
  on public.cupons(estabelecimento_id, ativo, inicia_em, termina_em);

create table if not exists public.cupom_usos (
  id uuid primary key default gen_random_uuid(),
  cupom_id uuid not null references public.cupons(id) on delete restrict,
  cliente_id uuid not null references public.perfis(id) on delete restrict,
  agendamento_id uuid not null unique references public.agendamentos(id) on delete restrict,
  subtotal numeric(10,2) not null check (subtotal >= 0),
  desconto numeric(10,2) not null check (desconto >= 0),
  total numeric(10,2) not null check (total >= 0),
  created_at timestamptz not null default now()
);
create index if not exists cupom_usos_cupom_cliente_idx on public.cupom_usos(cupom_id, cliente_id, created_at desc);
create index if not exists cupom_usos_cliente_idx on public.cupom_usos(cliente_id, created_at desc);

drop trigger if exists cupons_updated_at on public.cupons;
create trigger cupons_updated_at before update on public.cupons
for each row execute function public.set_updated_at();

alter table public.cupons enable row level security;
alter table public.cupom_usos enable row level security;

drop policy if exists cupons_manage_equipe on public.cupons;
create policy cupons_manage_equipe on public.cupons for all to authenticated
using (private.tem_recurso_193(estabelecimento_id, 'permite_cupons') and private.pode_operar_estabelecimento_19(estabelecimento_id, array['proprietario','gerente','admin']::text[]))
with check (private.tem_recurso_193(estabelecimento_id, 'permite_cupons') and private.pode_operar_estabelecimento_19(estabelecimento_id, array['proprietario','gerente','admin']::text[]));
drop policy if exists cupom_usos_select_cliente_equipe on public.cupom_usos;
create policy cupom_usos_select_cliente_equipe on public.cupom_usos for select to authenticated
using (cliente_id = (select auth.uid()) or exists (select 1 from public.cupons c where c.id = cupom_id and private.pode_operar_estabelecimento_19(c.estabelecimento_id)));

grant select, insert, update on public.cupons to authenticated;
grant select on public.cupom_usos to authenticated;
revoke insert, update, delete on public.cupom_usos from anon, authenticated;

create or replace function public.aplicar_cupom_agendamento_193(p_agendamento_id uuid, p_codigo text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_agendamento public.agendamentos%rowtype; v_cupom public.cupons%rowtype; v_total_usos integer; v_usos_cliente integer; v_desconto numeric(10,2);
begin
  select * into v_agendamento from public.agendamentos where id = p_agendamento_id for update;
  if not found then raise exception 'Agendamento não encontrado.'; end if;
  if v_agendamento.cliente_id is distinct from (select auth.uid())
     and not private.pode_operar_estabelecimento_19(v_agendamento.estabelecimento_id) then
    raise exception 'Sua conta não pode aplicar cupom neste agendamento.';
  end if;
  if v_agendamento.status not in ('pendente','confirmado') then raise exception 'O cupom só pode ser aplicado a um agendamento ativo.'; end if;
  if not private.tem_recurso_193(v_agendamento.estabelecimento_id, 'permite_cupons') then raise exception 'Cupons não estão disponíveis neste estabelecimento.'; end if;
  select * into v_cupom from public.cupons c where c.estabelecimento_id = v_agendamento.estabelecimento_id
    and lower(c.codigo) = lower(trim(p_codigo)) and c.ativo for update;
  if not found or v_cupom.inicia_em > now() or (v_cupom.termina_em is not null and v_cupom.termina_em < now()) then raise exception 'Cupom inválido ou expirado.'; end if;
  if v_agendamento.valor < v_cupom.valor_minimo then raise exception 'O valor mínimo deste cupom não foi atingido.'; end if;
  select count(*)::integer into v_total_usos from public.cupom_usos where cupom_id = v_cupom.id;
  select count(*)::integer into v_usos_cliente from public.cupom_usos where cupom_id = v_cupom.id and cliente_id = v_agendamento.cliente_id;
  if v_cupom.limite_total is not null and v_total_usos >= v_cupom.limite_total then raise exception 'O limite total deste cupom foi atingido.'; end if;
  if v_usos_cliente >= v_cupom.limite_por_cliente then raise exception 'Você já utilizou este cupom o número máximo de vezes.'; end if;
  v_desconto := case v_cupom.tipo_desconto when 'percentual' then round(v_agendamento.valor * v_cupom.valor_desconto / 100, 2) else v_cupom.valor_desconto end;
  if v_cupom.desconto_maximo is not null then v_desconto := least(v_desconto, v_cupom.desconto_maximo); end if;
  v_desconto := least(greatest(v_desconto, 0), v_agendamento.valor);
  insert into public.cupom_usos(cupom_id, cliente_id, agendamento_id, subtotal, desconto, total)
  values (v_cupom.id, v_agendamento.cliente_id, v_agendamento.id, v_agendamento.valor, v_desconto, v_agendamento.valor - v_desconto);
  update public.agendamentos set valor = valor - v_desconto where id = v_agendamento.id;
  return jsonb_build_object('cupom_id', v_cupom.id, 'codigo', v_cupom.codigo, 'subtotal', v_agendamento.valor,
    'desconto', v_desconto, 'total', v_agendamento.valor - v_desconto);
exception when unique_violation then raise exception 'Este agendamento já possui um cupom.';
end;
$$;

revoke all on function public.aplicar_cupom_agendamento_193(uuid,text) from public, anon;
grant execute on function public.aplicar_cupom_agendamento_193(uuid,text) to authenticated, service_role;

create or replace function public.criar_agendamento_com_cupom_193(
  p_estabelecimento_id uuid,
  p_profissional_id uuid,
  p_servicos_ids uuid[],
  p_data date,
  p_hora_inicio time,
  p_observacao text default null,
  p_cupom_codigo text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare v_id uuid;
begin
  v_id := public.criar_agendamento_multisservico(
    p_estabelecimento_id, p_profissional_id, p_servicos_ids, p_data, p_hora_inicio, p_observacao
  );
  if nullif(trim(coalesce(p_cupom_codigo, '')), '') is not null then
    perform public.aplicar_cupom_agendamento_193(v_id, p_cupom_codigo);
  end if;
  return v_id;
end;
$$;

revoke all on function public.criar_agendamento_com_cupom_193(uuid,uuid,uuid[],date,time,text,text) from public, anon;
grant execute on function public.criar_agendamento_com_cupom_193(uuid,uuid,uuid[],date,time,text,text) to authenticated, service_role;

-- ============================================================
-- 6. CAMPANHAS E FILA DE LEMBRETES
-- ============================================================

create table if not exists public.campanhas (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  nome text not null,
  segmento text not null check (segmento in ('todos','novo','recorrente','em_risco','inativo','aniversariante')),
  canal text not null check (canal in ('interno','email','whatsapp')),
  assunto text,
  mensagem text not null,
  agendada_para timestamptz not null,
  status text not null default 'agendada' check (status in ('rascunho','agendada','processando','concluida','cancelada')),
  criado_por uuid not null references public.perfis(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (char_length(mensagem) between 5 and 1000)
);

create table if not exists public.campanha_destinatarios (
  id uuid primary key default gen_random_uuid(),
  campanha_id uuid not null references public.campanhas(id) on delete cascade,
  relacionamento_id uuid not null references public.clientes_estabelecimento(id) on delete cascade,
  cliente_id uuid references public.perfis(id) on delete set null,
  nome text not null,
  destino text,
  status text not null default 'pendente' check (status in ('pendente','enviado','falhou','ignorado','cancelado')),
  erro text,
  enviado_em timestamptz,
  created_at timestamptz not null default now(),
  unique (campanha_id, relacionamento_id)
);

create table if not exists public.automacoes_mensagens (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  cliente_id uuid references public.perfis(id) on delete set null,
  relacionamento_id uuid references public.clientes_estabelecimento(id) on delete cascade,
  agendamento_id uuid references public.agendamentos(id) on delete cascade,
  campanha_id uuid references public.campanhas(id) on delete cascade,
  destinatario_id uuid references public.campanha_destinatarios(id) on delete cascade,
  tipo text not null check (tipo in ('lembrete_24h','lembrete_2h','avaliacao','campanha','vaga_lista_espera')),
  canal text not null check (canal in ('interno','email','whatsapp')),
  destino text,
  titulo text not null,
  mensagem text not null,
  dados jsonb not null default '{}'::jsonb,
  agendada_para timestamptz not null,
  status text not null default 'pendente' check (status in ('pendente','processando','enviada','falhou','cancelada')),
  tentativas smallint not null default 0 check (tentativas between 0 and 20),
  ultimo_erro text,
  processada_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists campanhas_estabelecimento_status_idx on public.campanhas(estabelecimento_id, status, agendada_para desc);
create index if not exists automacoes_pendentes_idx on public.automacoes_mensagens(status, agendada_para, id) where status = 'pendente';
create index if not exists automacoes_retry_idx on public.automacoes_mensagens(processada_em, id)
  where status = 'falhou' and tentativas < 3;
create unique index if not exists automacoes_agendamento_tipo_unique_idx
  on public.automacoes_mensagens(agendamento_id, tipo, canal)
  where agendamento_id is not null and status <> 'cancelada';
create unique index if not exists automacoes_destinatario_unique_idx
  on public.automacoes_mensagens(destinatario_id)
  where destinatario_id is not null and status <> 'cancelada';
create index if not exists campanhas_criado_por_idx on public.campanhas(criado_por);
create index if not exists campanha_destinatarios_cliente_idx
  on public.campanha_destinatarios(cliente_id) where cliente_id is not null;
create index if not exists campanha_destinatarios_relacionamento_idx
  on public.campanha_destinatarios(relacionamento_id);
create index if not exists automacoes_relacionamento_idx
  on public.automacoes_mensagens(relacionamento_id) where relacionamento_id is not null;
create index if not exists automacoes_campanha_idx
  on public.automacoes_mensagens(campanha_id) where campanha_id is not null;

drop trigger if exists campanhas_updated_at on public.campanhas;
create trigger campanhas_updated_at before update on public.campanhas for each row execute function public.set_updated_at();
drop trigger if exists automacoes_mensagens_updated_at on public.automacoes_mensagens;
create trigger automacoes_mensagens_updated_at before update on public.automacoes_mensagens for each row execute function public.set_updated_at();

alter table public.campanhas enable row level security;
alter table public.campanha_destinatarios enable row level security;
alter table public.automacoes_mensagens enable row level security;

drop policy if exists campanhas_select_equipe on public.campanhas;
create policy campanhas_select_equipe on public.campanhas for select to authenticated
using (private.tem_recurso_193(estabelecimento_id, 'permite_campanhas') and private.pode_operar_estabelecimento_19(estabelecimento_id));
drop policy if exists campanha_destinatarios_select_equipe on public.campanha_destinatarios;
create policy campanha_destinatarios_select_equipe on public.campanha_destinatarios for select to authenticated
using (exists (select 1 from public.campanhas c where c.id = campanha_id and private.pode_operar_estabelecimento_19(c.estabelecimento_id)));
drop policy if exists automacoes_select_equipe on public.automacoes_mensagens;
create policy automacoes_select_equipe on public.automacoes_mensagens for select to authenticated
using (private.pode_operar_estabelecimento_19(estabelecimento_id));

grant select on public.campanhas, public.campanha_destinatarios, public.automacoes_mensagens to authenticated;
revoke insert, update, delete on public.campanhas, public.campanha_destinatarios, public.automacoes_mensagens from anon, authenticated;

create or replace function public.criar_campanha_193(
  p_estabelecimento_id uuid,
  p_nome text,
  p_segmento text,
  p_canal text,
  p_assunto text,
  p_mensagem text,
  p_agendada_para timestamptz
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare v_campanha_id uuid; v_total integer;
begin
  if not private.tem_recurso_193(p_estabelecimento_id, 'permite_campanhas')
     or not private.pode_operar_estabelecimento_19(p_estabelecimento_id, array['proprietario','gerente','admin']::text[]) then
    raise exception 'Campanhas estão disponíveis no plano Elite para a gestão.';
  end if;
  if p_segmento not in ('todos','novo','recorrente','em_risco','inativo','aniversariante') then raise exception 'Segmento inválido.'; end if;
  if p_canal not in ('interno','email','whatsapp') then raise exception 'Canal inválido.'; end if;
  if char_length(trim(coalesce(p_nome, ''))) < 3 or char_length(trim(coalesce(p_mensagem, ''))) < 5 then raise exception 'Informe nome e mensagem da campanha.'; end if;
  if p_agendada_para < now() - interval '5 minutes' then raise exception 'Escolha um horário atual ou futuro.'; end if;
  insert into public.campanhas(estabelecimento_id,nome,segmento,canal,assunto,mensagem,agendada_para,status,criado_por)
  values (p_estabelecimento_id,trim(p_nome),p_segmento,p_canal,nullif(trim(coalesce(p_assunto,'')),''),trim(p_mensagem),p_agendada_para,'agendada',(select auth.uid()))
  returning id into v_campanha_id;

  insert into public.campanha_destinatarios(campanha_id,relacionamento_id,cliente_id,nome,destino,status)
  select v_campanha_id,c.id,c.cliente_id,c.nome,
    case p_canal when 'email' then c.email when 'whatsapp' then c.telefone else c.cliente_id::text end,
    case when p_canal = 'interno' and c.cliente_id is null then 'ignorado'
         when p_canal = 'email' and not c.permite_email_marketing then 'ignorado'
         when p_canal = 'whatsapp' and not c.permite_whatsapp then 'ignorado'
         when p_canal in ('email','whatsapp') and nullif(case p_canal when 'email' then c.email else c.telefone end,'') is null then 'ignorado'
         else 'pendente' end
  from public.clientes_estabelecimento c
  where c.estabelecimento_id = p_estabelecimento_id
    and (
      p_segmento = 'todos'
      or c.segmento = p_segmento
      or (
        p_segmento = 'aniversariante'
        and c.data_nascimento is not null
        and extract(month from c.data_nascimento) = extract(month from p_agendada_para at time zone 'America/Sao_Paulo')
      )
    );

  insert into public.automacoes_mensagens(
    estabelecimento_id,cliente_id,relacionamento_id,campanha_id,destinatario_id,tipo,canal,destino,titulo,mensagem,agendada_para
  ) select p_estabelecimento_id,d.cliente_id,d.relacionamento_id,v_campanha_id,d.id,'campanha',p_canal,d.destino,
    coalesce(nullif(trim(coalesce(p_assunto,'')),''),trim(p_nome)),trim(p_mensagem),p_agendada_para
  from public.campanha_destinatarios d where d.campanha_id = v_campanha_id and d.status = 'pendente';
  get diagnostics v_total = row_count;
  return jsonb_build_object('id',v_campanha_id,'destinatarios',v_total,'status','agendada');
end;
$$;

revoke all on function public.criar_campanha_193(uuid,text,text,text,text,text,timestamptz) from public, anon;
grant execute on function public.criar_campanha_193(uuid,text,text,text,text,text,timestamptz) to authenticated, service_role;

create or replace function public.preparar_lembretes_193()
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_total integer := 0; v_inseridos integer;
begin
  insert into public.automacoes_mensagens(estabelecimento_id,cliente_id,agendamento_id,tipo,canal,titulo,mensagem,dados,agendada_para)
  select a.estabelecimento_id,a.cliente_id,a.id,'lembrete_24h','interno','Seu atendimento é amanhã',
    'Você tem um atendimento em ' || e.nome || ' amanhã às ' || to_char(a.hora_inicio,'HH24:MI') || '.',
    jsonb_build_object('agendamento_id',a.id),a.inicio_previsto - interval '24 hours'
  from public.agendamentos a join public.estabelecimentos e on e.id = a.estabelecimento_id
  where a.status in ('pendente','confirmado') and a.inicio_previsto between now() + interval '23 hours' and now() + interval '25 hours'
    and private.tem_recurso_193(a.estabelecimento_id,'permite_lembretes')
  on conflict (agendamento_id,tipo,canal) where agendamento_id is not null and status <> 'cancelada' do nothing;
  get diagnostics v_inseridos = row_count; v_total := v_total + v_inseridos;

  insert into public.automacoes_mensagens(estabelecimento_id,cliente_id,agendamento_id,tipo,canal,titulo,mensagem,dados,agendada_para)
  select a.estabelecimento_id,a.cliente_id,a.id,'lembrete_2h','interno','Seu atendimento está próximo',
    'Seu horário em ' || e.nome || ' começa às ' || to_char(a.hora_inicio,'HH24:MI') || '.',
    jsonb_build_object('agendamento_id',a.id),a.inicio_previsto - interval '2 hours'
  from public.agendamentos a join public.estabelecimentos e on e.id = a.estabelecimento_id
  where a.status in ('pendente','confirmado') and a.inicio_previsto between now() + interval '90 minutes' and now() + interval '150 minutes'
    and private.tem_recurso_193(a.estabelecimento_id,'permite_lembretes')
  on conflict (agendamento_id,tipo,canal) where agendamento_id is not null and status <> 'cancelada' do nothing;
  get diagnostics v_inseridos = row_count; v_total := v_total + v_inseridos;

  insert into public.automacoes_mensagens(estabelecimento_id,cliente_id,agendamento_id,tipo,canal,titulo,mensagem,dados,agendada_para)
  select a.estabelecimento_id,a.cliente_id,a.id,'avaliacao','interno','Como foi seu atendimento?',
    'Conte como foi sua experiência em ' || e.nome || '. Sua avaliação ajuda outros clientes.',
    jsonb_build_object('agendamento_id',a.id),greatest(a.fim_previsto + interval '30 minutes',now())
  from public.agendamentos a join public.estabelecimentos e on e.id = a.estabelecimento_id
  where a.status = 'concluido' and a.fim_previsto > now() - interval '7 days'
    and not exists (select 1 from public.avaliacoes av where av.agendamento_id = a.id)
  on conflict (agendamento_id,tipo,canal) where agendamento_id is not null and status <> 'cancelada' do nothing;
  get diagnostics v_inseridos = row_count; v_total := v_total + v_inseridos;
  return v_total;
end;
$$;

revoke all on function public.preparar_lembretes_193() from public, anon, authenticated;
grant execute on function public.preparar_lembretes_193() to service_role;

create or replace function public.processar_automacoes_internas_193(p_limite integer default 100)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.automacoes_mensagens%rowtype; v_total integer := 0;
begin
  for v_item in
    select * from public.automacoes_mensagens
    where (
      status = 'pendente'
      or (status = 'falhou' and tentativas < 3 and processada_em <= now() - interval '5 minutes')
    )
      and canal = 'interno' and agendada_para <= now() and cliente_id is not null
    order by agendada_para,id for update skip locked limit least(greatest(coalesce(p_limite,100),1),500)
  loop
    update public.automacoes_mensagens
      set status='processando',tentativas=tentativas+1,ultimo_erro=null
      where id=v_item.id;
    begin
      perform public.criar_notificacao_interna(
        v_item.cliente_id,
        case when v_item.tipo = 'avaliacao' then 'avaliacao' when v_item.tipo like 'lembrete_%' then 'agendamento' else 'sistema' end,
        left(v_item.titulo,100),left(v_item.mensagem,500),
        case when v_item.tipo = 'avaliacao' then 'html/cliente.html#historico' else 'html/cliente.html' end,
        v_item.dados
      );
      update public.automacoes_mensagens
        set status='enviada',processada_em=now()
        where id=v_item.id;
      if v_item.destinatario_id is not null then
        update public.campanha_destinatarios
          set status='enviado',enviado_em=now(),erro=null
          where id=v_item.destinatario_id;
      end if;
      v_total := v_total + 1;
    exception when others then
      update public.automacoes_mensagens
        set status='falhou',ultimo_erro=left(sqlerrm,500),processada_em=now()
        where id=v_item.id;
      if v_item.destinatario_id is not null then
        update public.campanha_destinatarios
          set status='falhou',erro=left(sqlerrm,500)
          where id=v_item.destinatario_id;
      end if;
    end;
  end loop;
  update public.campanhas c set status='concluida'
  where c.status in ('agendada','processando') and not exists (
    select 1 from public.automacoes_mensagens a where a.campanha_id=c.id and a.status in ('pendente','processando')
  );
  return v_total;
end;
$$;

revoke all on function public.processar_automacoes_internas_193(integer) from public, anon, authenticated;
grant execute on function public.processar_automacoes_internas_193(integer) to service_role;

create or replace function public.avisar_lista_espera_193()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare v_item public.lista_espera%rowtype; v_estabelecimento text;
begin
  if old.status not in ('pendente','confirmado') or new.status not in ('cancelado','recusado') then return new; end if;
  if not private.tem_recurso_193(new.estabelecimento_id,'permite_lista_espera') then return new; end if;
  select * into v_item from public.lista_espera l
  where l.estabelecimento_id=new.estabelecimento_id and l.status='aguardando'
    and new.data between l.data_inicio and l.data_fim
    and (l.profissional_id is null or l.profissional_id=new.profissional_id)
    and (l.servico_id=new.servico_id or exists (select 1 from public.agendamento_servicos s where s.agendamento_id=new.id and s.servico_id=l.servico_id))
    and (l.horario_inicio is null or new.hora_inicio>=l.horario_inicio)
    and (l.horario_fim is null or new.hora_fim<=l.horario_fim)
  order by l.created_at,l.id for update skip locked limit 1;
  if not found then return new; end if;
  select nome into v_estabelecimento from public.estabelecimentos where id=new.estabelecimento_id;
  update public.lista_espera set status='avisado',avisado_em=now(),aviso_expira_em=now()+interval '2 hours' where id=v_item.id;
  perform public.criar_notificacao_interna(v_item.cliente_id,'agendamento','Uma vaga ficou disponível',
    'Surgiu uma vaga em '||coalesce(v_estabelecimento,'um estabelecimento')||' para '||to_char(new.data,'DD/MM')||' às '||to_char(new.hora_inicio,'HH24:MI')||'.',
    'html/barbearia.html?id='||new.estabelecimento_id::text||'&agendar=1',jsonb_build_object('lista_espera_id',v_item.id,'agendamento_liberado_id',new.id));
  return new;
end;
$$;

drop trigger if exists agendamentos_avisar_lista_espera_193 on public.agendamentos;
create trigger agendamentos_avisar_lista_espera_193 after update of status on public.agendamentos
for each row execute function public.avisar_lista_espera_193();
revoke all on function public.avisar_lista_espera_193() from public, anon, authenticated;

commit;
