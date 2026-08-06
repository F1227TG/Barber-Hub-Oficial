-- Barber Hub 1.5.0
-- Agendamento com múltiplos serviços e compatibilidade com registros antigos.
-- Execute depois das migrations 01 a 13.

begin;

-- ============================================================
-- 1. ITENS DO AGENDAMENTO
-- Mantém servico_id em agendamentos como o primeiro serviço para preservar
-- telas, avaliações e integrações antigas. Os demais serviços ficam nesta
-- tabela, junto de snapshots para não alterar o histórico se o catálogo mudar.
-- ============================================================

create table if not exists public.agendamento_servicos (
  agendamento_id uuid not null references public.agendamentos(id) on delete cascade,
  servico_id uuid references public.servicos(id) on delete set null,
  ordem smallint not null check (ordem between 1 and 20),
  nome_snapshot text not null,
  preco_snapshot numeric(10,2) not null check (preco_snapshot >= 0),
  duracao_min_snapshot integer not null check (duracao_min_snapshot between 5 and 1440),
  created_at timestamptz not null default now(),
  primary key (agendamento_id, ordem),
  unique (agendamento_id, servico_id)
);

create index if not exists agendamento_servicos_servico_id_idx
  on public.agendamento_servicos(servico_id);

alter table public.agendamento_servicos enable row level security;

drop policy if exists "Cliente visualiza itens dos próprios agendamentos" on public.agendamento_servicos;
create policy "Cliente visualiza itens dos próprios agendamentos"
on public.agendamento_servicos for select
to authenticated
using (
  exists (
    select 1
    from public.agendamentos a
    where a.id = agendamento_id
      and a.cliente_id = auth.uid()
  )
);

drop policy if exists "Profissional visualiza itens do próprio negócio" on public.agendamento_servicos;
create policy "Profissional visualiza itens do próprio negócio"
on public.agendamento_servicos for select
to authenticated
using (
  exists (
    select 1
    from public.agendamentos a
    where a.id = agendamento_id
      and public.owns_estabelecimento(a.estabelecimento_id)
  )
);

drop policy if exists "Admin visualiza itens dos agendamentos" on public.agendamento_servicos;
create policy "Admin visualiza itens dos agendamentos"
on public.agendamento_servicos for select
to authenticated
using (public.is_admin());

-- Migra agendamentos antigos para a nova relação sem duplicar dados.
insert into public.agendamento_servicos (
  agendamento_id,
  servico_id,
  ordem,
  nome_snapshot,
  preco_snapshot,
  duracao_min_snapshot
)
select
  a.id,
  a.servico_id,
  1,
  coalesce(s.nome, 'Serviço'),
  coalesce(a.valor, s.preco, 0),
  greatest(
    coalesce(s.duracao_min, floor(extract(epoch from (a.hora_fim - a.hora_inicio)) / 60)::integer, 30),
    5
  )
from public.agendamentos a
left join public.servicos s on s.id = a.servico_id
where not exists (
  select 1
  from public.agendamento_servicos ais
  where ais.agendamento_id = a.id
);

-- ============================================================
-- 2. RPC TRANSACIONAL PARA VÁRIOS SERVIÇOS
-- Valida catálogo, profissional, duração total, valor e sobreposição antes de
-- criar o agendamento e seus itens em uma única transação.
-- ============================================================

create or replace function public.criar_agendamento_multisservico(
  p_estabelecimento_id uuid,
  p_profissional_id uuid,
  p_servicos_ids uuid[],
  p_data date,
  p_hora_inicio time,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare
  v_est public.estabelecimentos%rowtype;
  v_prof public.profissionais%rowtype;
  v_perfil public.perfis%rowtype;
  v_horario public.horarios_funcionamento%rowtype;
  v_email text;
  v_id uuid;
  v_primeiro_servico uuid;
  v_duracao_total integer;
  v_valor_total numeric(10,2);
  v_quantidade integer;
  v_hora_fim time;
  v_dia smallint;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_agora time := (now() at time zone 'America/Sao_Paulo')::time;
begin
  if auth.uid() is null then
    raise exception 'Faça login para agendar.';
  end if;

  if p_servicos_ids is null or cardinality(p_servicos_ids) < 1 then
    raise exception 'Selecione pelo menos um serviço.';
  end if;

  if cardinality(p_servicos_ids) > 8 then
    raise exception 'Selecione no máximo 8 serviços por agendamento.';
  end if;

  if cardinality(p_servicos_ids) <> (
    select count(distinct id)::integer from unnest(p_servicos_ids) as x(id)
  ) then
    raise exception 'Não repita o mesmo serviço.';
  end if;

  select * into v_perfil
  from public.perfis
  where id = auth.uid() and ativo = true;
  if not found then
    raise exception 'Perfil não encontrado ou inativo.';
  end if;

  select email into v_email from auth.users where id = auth.uid();

  select * into v_est
  from public.estabelecimentos
  where id = p_estabelecimento_id
    and visivel = true
    and onboarding_concluido = true;
  if not found then raise exception 'Estabelecimento indisponível.'; end if;
  if not v_est.aceita_agendamento then raise exception 'Este estabelecimento não aceita agendamento online.'; end if;
  if v_est.status_manual = 'fechado' then raise exception 'O estabelecimento está fechado manualmente.'; end if;

  if p_data < v_hoje then raise exception 'Não é possível agendar uma data passada.'; end if;
  if p_data > v_hoje + v_est.limite_dias_agendamento then
    raise exception 'Data acima do limite permitido para agendamento.';
  end if;

  if exists (
    select 1 from public.dias_bloqueados
    where estabelecimento_id = v_est.id and data = p_data
  ) then
    raise exception 'A data escolhida está bloqueada.';
  end if;

  v_dia := extract(dow from p_data)::smallint;
  select * into v_horario
  from public.horarios_funcionamento
  where estabelecimento_id = v_est.id
    and dia_semana = v_dia
    and aberto = true;
  if not found then raise exception 'O estabelecimento não funciona neste dia.'; end if;

  select * into v_prof
  from public.profissionais
  where id = p_profissional_id
    and estabelecimento_id = v_est.id
    and ativo = true
    and aceita_agendamento = true;
  if not found then raise exception 'Profissional indisponível.'; end if;

  select
    count(*)::integer,
    sum(s.duracao_min)::integer,
    sum(s.preco)::numeric(10,2)
  into v_quantidade, v_duracao_total, v_valor_total
  from public.servicos s
  where s.id = any(p_servicos_ids)
    and s.estabelecimento_id = v_est.id
    and s.ativo = true
    and s.publico = true;

  if v_quantidade <> cardinality(p_servicos_ids) then
    raise exception 'Um ou mais serviços estão indisponíveis.';
  end if;

  -- Quando o estabelecimento usa atribuição de serviços por profissional,
  -- garante que o profissional escolhido realize todos os itens selecionados.
  if exists (
    select 1 from public.profissional_servicos ps
    where ps.profissional_id = v_prof.id
  ) and exists (
    select 1
    from unnest(p_servicos_ids) as selecionado(id)
    where not exists (
      select 1
      from public.profissional_servicos ps
      where ps.profissional_id = v_prof.id
        and ps.servico_id = selecionado.id
    )
  ) then
    raise exception 'O profissional selecionado não realiza todos os serviços escolhidos.';
  end if;

  select id into v_primeiro_servico
  from unnest(p_servicos_ids) with ordinality as escolhido(id, ordem)
  order by ordem
  limit 1;

  v_hora_fim := p_hora_inicio + make_interval(mins => v_duracao_total);

  if p_hora_inicio < v_horario.abre or v_hora_fim > v_horario.fecha then
    raise exception 'A duração total ultrapassa o horário de funcionamento.';
  end if;

  if p_data = v_hoje
     and p_hora_inicio < (v_agora + make_interval(hours => v_est.antecedencia_min_horas))::time then
    raise exception 'O horário não respeita a antecedência mínima.';
  end if;

  if exists (
    select 1
    from public.agendamentos a
    where a.profissional_id = v_prof.id
      and a.data = p_data
      and a.status in ('pendente','confirmado','concluido')
      and p_hora_inicio < a.hora_fim
      and v_hora_fim > a.hora_inicio
  ) then
    raise exception 'Este horário acabou de ser ocupado. Escolha outra opção.';
  end if;

  insert into public.agendamentos (
    estabelecimento_id,
    profissional_id,
    servico_id,
    cliente_id,
    cliente_nome,
    cliente_email,
    cliente_telefone,
    data,
    hora_inicio,
    hora_fim,
    observacao,
    valor,
    status
  ) values (
    v_est.id,
    v_prof.id,
    v_primeiro_servico,
    auth.uid(),
    v_perfil.nome,
    coalesce(v_email, v_perfil.email),
    v_perfil.telefone,
    p_data,
    p_hora_inicio,
    v_hora_fim,
    nullif(trim(coalesce(p_observacao, '')), ''),
    v_valor_total,
    'pendente'
  ) returning id into v_id;

  insert into public.agendamento_servicos (
    agendamento_id,
    servico_id,
    ordem,
    nome_snapshot,
    preco_snapshot,
    duracao_min_snapshot
  )
  select
    v_id,
    s.id,
    escolhido.ordem::smallint,
    s.nome,
    s.preco,
    s.duracao_min
  from unnest(p_servicos_ids) with ordinality as escolhido(id, ordem)
  join public.servicos s on s.id = escolhido.id
  order by escolhido.ordem;

  return v_id;
end;
$$;

-- Mantém a função antiga para clientes ainda não atualizados.
create or replace function public.criar_agendamento(
  p_estabelecimento_id uuid,
  p_profissional_id uuid,
  p_servico_id uuid,
  p_data date,
  p_hora_inicio time,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
begin
  return public.criar_agendamento_multisservico(
    p_estabelecimento_id,
    p_profissional_id,
    array[p_servico_id],
    p_data,
    p_hora_inicio,
    p_observacao
  );
end;
$$;

revoke all on function public.criar_agendamento_multisservico(uuid,uuid,uuid[],date,time,text) from public, anon;
grant execute on function public.criar_agendamento_multisservico(uuid,uuid,uuid[],date,time,text) to authenticated;

revoke all on function public.criar_agendamento(uuid,uuid,uuid,date,time,text) from public, anon;
grant execute on function public.criar_agendamento(uuid,uuid,uuid,date,time,text) to authenticated;

commit;
