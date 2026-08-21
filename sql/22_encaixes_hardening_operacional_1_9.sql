-- Barber Hub 1.9.0: encaixes e consolidação de RLS dos módulos operacionais.
-- Execute depois de 21_entitlements_operacionais_1_9.sql.

begin;

create or replace function public.criar_bloqueio_agenda_19(
  p_estabelecimento_id uuid,
  p_profissional_id uuid,
  p_inicio timestamptz,
  p_fim timestamptz,
  p_tipo text default 'bloqueio',
  p_motivo text default null
)
returns public.agenda_bloqueios
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_bloqueio public.agenda_bloqueios%rowtype;
  v_timezone text;
  v_data_local date;
begin
  if not private.tem_recurso_operacional_19(p_estabelecimento_id, 'permite_agenda_avancada')
     or not private.pode_operar_estabelecimento_19(p_estabelecimento_id) then
    raise exception 'O plano ou a conta não libera bloqueios.';
  end if;
  if p_tipo not in ('bloqueio','pausa','indisponibilidade') then raise exception 'Tipo de bloqueio inválido.'; end if;
  if p_inicio >= p_fim or p_fim > p_inicio + interval '7 days' then raise exception 'Período de bloqueio inválido.'; end if;
  if p_fim <= now() then raise exception 'Não é possível bloquear um período encerrado.'; end if;
  if char_length(trim(coalesce(p_motivo, ''))) > 300 then raise exception 'O motivo é muito longo.'; end if;
  if private.papel_no_estabelecimento_19(p_estabelecimento_id) = 'profissional'
     and (
       not private.tem_recurso_operacional_19(p_estabelecimento_id, 'permite_equipe_acesso')
       or p_profissional_id is distinct from private.profissional_vinculado_19(p_estabelecimento_id)
     ) then raise exception 'O profissional só pode bloquear a própria agenda.'; end if;
  if p_profissional_id is not null and not exists (
    select 1 from public.profissionais p
    where p.id = p_profissional_id and p.estabelecimento_id = p_estabelecimento_id and p.ativo = true
  ) then raise exception 'Profissional indisponível.'; end if;

  select coalesce(e.timezone, 'America/Sao_Paulo') into v_timezone
  from public.estabelecimentos e where e.id = p_estabelecimento_id;
  v_data_local := (p_inicio at time zone v_timezone)::date;
  if (p_fim at time zone v_timezone)::date <> v_data_local then
    raise exception 'Crie um bloqueio separado para cada dia.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_estabelecimento_id::text || ':todos:' || v_data_local::text, 0
  ));
  if p_profissional_id is not null then
    perform pg_advisory_xact_lock(hashtextextended(
      p_estabelecimento_id::text || ':' || p_profissional_id::text || ':' || v_data_local::text, 0
    ));
  end if;
  if exists (
    select 1 from public.agendamentos a
    where a.estabelecimento_id = p_estabelecimento_id
      and (p_profissional_id is null or a.profissional_id = p_profissional_id)
      and a.status in ('pendente','confirmado')
      and p_inicio < a.fim_previsto and p_fim > a.inicio_previsto
  ) then raise exception 'Há um atendimento ativo dentro deste período.'; end if;
  if exists (
    select 1 from public.agenda_bloqueios b
    where b.estabelecimento_id = p_estabelecimento_id
      and (p_profissional_id is null or b.profissional_id is null or b.profissional_id = p_profissional_id)
      and p_inicio < b.fim and p_fim > b.inicio
  ) then raise exception 'Já existe um bloqueio sobreposto.'; end if;

  insert into public.agenda_bloqueios(
    estabelecimento_id, profissional_id, inicio, fim, tipo, motivo, criado_por
  ) values (
    p_estabelecimento_id, p_profissional_id, p_inicio, p_fim, p_tipo,
    nullif(trim(coalesce(p_motivo, '')), ''), (select auth.uid())
  ) returning * into v_bloqueio;
  return v_bloqueio;
end;
$$;

revoke all on function public.criar_bloqueio_agenda_19(uuid,uuid,timestamptz,timestamptz,text,text)
  from public, anon;
grant execute on function public.criar_bloqueio_agenda_19(uuid,uuid,timestamptz,timestamptz,text,text)
  to authenticated, service_role;

create or replace function public.atualizar_membro_estabelecimento_19(
  p_membro_id uuid,
  p_alteracoes jsonb
)
returns public.estabelecimento_membros
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_atual public.estabelecimento_membros%rowtype;
  v_resultado public.estabelecimento_membros%rowtype;
  v_papel text;
  v_status text;
  v_profissional_id uuid;
begin
  if p_alteracoes is null
     or p_alteracoes = '{}'::jsonb
     or (p_alteracoes - array['papel','status','profissional_id']::text[]) <> '{}'::jsonb then
    raise exception 'Alterações da equipe inválidas.';
  end if;
  select * into v_atual from public.estabelecimento_membros m
  where m.id = p_membro_id for update;
  if not found then raise exception 'Membro da equipe não encontrado.'; end if;
  if not (
    public.owns_estabelecimento(v_atual.estabelecimento_id)
    or public.is_admin()
    or (
      private.tem_recurso_operacional_19(v_atual.estabelecimento_id, 'permite_equipe_acesso')
      and private.papel_no_estabelecimento_19(v_atual.estabelecimento_id) = 'gerente'
    )
  ) then raise exception 'Sua conta não pode alterar este acesso.'; end if;

  v_papel := case when p_alteracoes ? 'papel' then p_alteracoes->>'papel' else v_atual.papel end;
  v_status := case when p_alteracoes ? 'status' then p_alteracoes->>'status' else v_atual.status end;
  v_profissional_id := case
    when p_alteracoes ? 'profissional_id' then nullif(p_alteracoes->>'profissional_id', '')::uuid
    else v_atual.profissional_id
  end;
  if v_papel not in ('gerente','recepcao','profissional') then raise exception 'Papel inválido.'; end if;
  if v_status not in ('ativo','suspenso','removido') then raise exception 'Status inválido.'; end if;
  if v_papel = 'profissional' and v_profissional_id is null then
    raise exception 'Vincule o papel profissional a um cadastro da equipe.';
  end if;
  if v_profissional_id is not null and not exists (
    select 1 from public.profissionais p
    where p.id = v_profissional_id and p.estabelecimento_id = v_atual.estabelecimento_id
  ) then raise exception 'Profissional não pertence ao estabelecimento.'; end if;
  if v_profissional_id is not null and exists (
    select 1 from public.profissionais p
    where p.id = v_profissional_id and p.user_id is not null and p.user_id <> v_atual.user_id
  ) then raise exception 'O profissional já está vinculado a outra conta.'; end if;

  update public.estabelecimento_membros
  set papel = v_papel, status = v_status, profissional_id = v_profissional_id
  where id = p_membro_id
  returning * into v_resultado;

  if v_atual.profissional_id is not null and (
    v_atual.profissional_id is distinct from v_profissional_id or v_status <> 'ativo'
  ) then
    update public.profissionais set user_id = null
    where id = v_atual.profissional_id and user_id = v_atual.user_id;
  end if;
  if v_profissional_id is not null and v_status = 'ativo' then
    update public.profissionais set user_id = v_atual.user_id where id = v_profissional_id;
  end if;
  return v_resultado;
end;
$$;

revoke all on function public.atualizar_membro_estabelecimento_19(uuid,jsonb) from public, anon;
grant execute on function public.atualizar_membro_estabelecimento_19(uuid,jsonb) to authenticated, service_role;
revoke update on public.estabelecimento_membros from authenticated;

create or replace function public.criar_encaixe_operacional_19(
  p_estabelecimento_id uuid,
  p_profissional_id uuid,
  p_servicos_ids uuid[],
  p_cliente_nome text,
  p_cliente_email text,
  p_cliente_telefone text,
  p_data date,
  p_hora_inicio time,
  p_observacao text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_estabelecimento public.estabelecimentos%rowtype;
  v_horario public.horarios_funcionamento%rowtype;
  v_cliente_id uuid;
  v_id uuid;
  v_primeiro_servico uuid;
  v_quantidade integer;
  v_duracao_total integer;
  v_valor_total numeric(10,2);
  v_hora_fim time;
  v_inicio timestamptz;
  v_fim timestamptz;
  v_dia smallint;
begin
  if not private.tem_recurso_operacional_19(p_estabelecimento_id, 'permite_agenda_avancada')
     or not private.pode_operar_estabelecimento_19(p_estabelecimento_id) then
    raise exception 'O plano ou a conta não libera encaixes.';
  end if;
  if private.papel_no_estabelecimento_19(p_estabelecimento_id) = 'profissional'
     and private.profissional_vinculado_19(p_estabelecimento_id) <> p_profissional_id then
    raise exception 'O profissional só pode criar encaixes na própria agenda.';
  end if;
  if p_servicos_ids is null or cardinality(p_servicos_ids) < 1 or cardinality(p_servicos_ids) > 8 then
    raise exception 'Selecione entre 1 e 8 serviços.';
  end if;
  if cardinality(p_servicos_ids) <> (
    select count(distinct id)::integer from unnest(p_servicos_ids) as item(id)
  ) then raise exception 'Não repita o mesmo serviço.'; end if;
  if char_length(trim(coalesce(p_cliente_nome, ''))) < 2 then raise exception 'Informe o nome do cliente.'; end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_estabelecimento_id::text || ':todos:' || p_data::text, 0
  ));
  perform pg_advisory_xact_lock(hashtextextended(
    p_estabelecimento_id::text || ':' || p_profissional_id::text || ':' || p_data::text, 0
  ));
  select * into v_estabelecimento from public.estabelecimentos e
  where e.id = p_estabelecimento_id and e.suspenso_pela_moderacao = false;
  if not found then raise exception 'Estabelecimento indisponível.'; end if;
  if not exists (
    select 1 from public.profissionais p
    where p.id = p_profissional_id and p.estabelecimento_id = p_estabelecimento_id and p.ativo = true
  ) then raise exception 'Profissional indisponível.'; end if;

  select count(*)::integer, sum(s.duracao_min)::integer, sum(s.preco)::numeric(10,2)
  into v_quantidade, v_duracao_total, v_valor_total
  from public.servicos s
  where s.id = any(p_servicos_ids) and s.estabelecimento_id = p_estabelecimento_id and s.ativo = true;
  if v_quantidade <> cardinality(p_servicos_ids) then raise exception 'Um ou mais serviços estão indisponíveis.'; end if;

  select id into v_primeiro_servico
  from unnest(p_servicos_ids) with ordinality as item(id, ordem)
  order by ordem limit 1;
  v_hora_fim := p_hora_inicio + make_interval(mins => v_duracao_total);
  v_dia := extract(dow from p_data)::smallint;
  select * into v_horario from public.horarios_funcionamento h
  where h.estabelecimento_id = p_estabelecimento_id and h.dia_semana = v_dia and h.aberto = true;
  if not found or p_hora_inicio < v_horario.abre or v_hora_fim > v_horario.fecha then
    raise exception 'O encaixe está fora do horário de funcionamento.';
  end if;

  v_inicio := (p_data + p_hora_inicio) at time zone coalesce(v_estabelecimento.timezone, 'America/Sao_Paulo');
  v_fim := (p_data + v_hora_fim) at time zone coalesce(v_estabelecimento.timezone, 'America/Sao_Paulo');
  if v_inicio <= now() - interval '15 minutes' then raise exception 'Escolha um horário atual ou futuro.'; end if;
  if exists (
    select 1 from public.agenda_bloqueios b
    where b.estabelecimento_id = p_estabelecimento_id
      and (b.profissional_id is null or b.profissional_id = p_profissional_id)
      and v_inicio < b.fim and v_fim > b.inicio
  ) then raise exception 'O período escolhido está bloqueado.'; end if;

  if nullif(trim(coalesce(p_cliente_email, '')), '') is not null then
    select p.id into v_cliente_id from public.perfis p
    where lower(p.email) = lower(trim(p_cliente_email)) and p.ativo = true limit 1;
  end if;

  -- O identificador também compõe o e-mail técnico quando o encaixe não tem
  -- e-mail. Assim clientes avulsos diferentes não são colapsados no CRM.
  v_id := gen_random_uuid();

  insert into public.agendamentos(
    id, estabelecimento_id, profissional_id, servico_id, cliente_id,
    cliente_nome, cliente_email, cliente_telefone, data, hora_inicio, hora_fim,
    observacao, valor, status, origem, tipo_atendimento,
    confirmacao_estabelecimento, estabelecimento_confirmado_em
  ) values (
    v_id, p_estabelecimento_id, p_profissional_id, v_primeiro_servico, v_cliente_id,
    trim(p_cliente_nome), coalesce(
      nullif(lower(trim(p_cliente_email)), ''),
      'avulso+' || replace(v_id::text, '-', '') || '@barberhub.local'
    ),
    nullif(trim(coalesce(p_cliente_telefone, '')), ''), p_data, p_hora_inicio, v_hora_fim,
    nullif(trim(coalesce(p_observacao, '')), ''), v_valor_total, 'confirmado', 'painel', 'encaixe',
    'confirmada', now()
  );

  insert into public.agendamento_servicos(
    agendamento_id, servico_id, ordem, nome_snapshot, preco_snapshot, duracao_min_snapshot
  )
  select v_id, s.id, escolhido.ordem::smallint, s.nome, s.preco, s.duracao_min
  from unnest(p_servicos_ids) with ordinality as escolhido(id, ordem)
  join public.servicos s on s.id = escolhido.id
  order by escolhido.ordem;
  return v_id;
end;
$$;

revoke all on function public.criar_encaixe_operacional_19(uuid,uuid,uuid[],text,text,text,date,time,text)
  from public, anon;
grant execute on function public.criar_encaixe_operacional_19(uuid,uuid,uuid[],text,text,text,date,time,text)
  to authenticated, service_role;

-- O proprietário e o admin sempre mantêm acesso. Integrantes da equipe somente
-- operam quando a assinatura efetiva libera acessos individuais.
drop policy if exists agendamentos_select_partes on public.agendamentos;
create policy agendamentos_select_partes on public.agendamentos
for select to authenticated
using (
  cliente_id = (select auth.uid())
  or public.owns_estabelecimento(estabelecimento_id)
  or public.is_admin()
  or (
    private.tem_recurso_operacional_19(estabelecimento_id, 'permite_equipe_acesso')
    and (
      private.papel_no_estabelecimento_19(estabelecimento_id) in ('gerente','recepcao')
      or (
        private.papel_no_estabelecimento_19(estabelecimento_id) = 'profissional'
        and profissional_id = private.profissional_vinculado_19(estabelecimento_id)
      )
    )
  )
);

drop policy if exists agendamentos_update_owner_admin on public.agendamentos;
create policy agendamentos_update_owner_admin on public.agendamentos
for update to authenticated
using (
  public.owns_estabelecimento(estabelecimento_id)
  or public.is_admin()
  or (
    private.tem_recurso_operacional_19(estabelecimento_id, 'permite_equipe_acesso')
    and (
      private.papel_no_estabelecimento_19(estabelecimento_id) in ('gerente','recepcao')
      or (
        private.papel_no_estabelecimento_19(estabelecimento_id) = 'profissional'
        and profissional_id = private.profissional_vinculado_19(estabelecimento_id)
      )
    )
  )
)
with check (
  public.owns_estabelecimento(estabelecimento_id)
  or public.is_admin()
  or (
    private.tem_recurso_operacional_19(estabelecimento_id, 'permite_equipe_acesso')
    and (
      private.papel_no_estabelecimento_19(estabelecimento_id) in ('gerente','recepcao')
      or (
        private.papel_no_estabelecimento_19(estabelecimento_id) = 'profissional'
        and profissional_id = private.profissional_vinculado_19(estabelecimento_id)
      )
    )
  )
);

drop policy if exists agenda_bloqueios_select_equipe on public.agenda_bloqueios;
create policy agenda_bloqueios_select_equipe on public.agenda_bloqueios
for select to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_agenda_avancada')
  and private.pode_operar_estabelecimento_19(estabelecimento_id)
  and (
    private.papel_no_estabelecimento_19(estabelecimento_id) <> 'profissional'
    or profissional_id is null
    or profissional_id = private.profissional_vinculado_19(estabelecimento_id)
  )
);

drop policy if exists agenda_bloqueios_insert_equipe on public.agenda_bloqueios;
create policy agenda_bloqueios_insert_equipe on public.agenda_bloqueios
for insert to authenticated
with check (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_agenda_avancada')
  and criado_por = (select auth.uid())
  and (
    private.pode_operar_estabelecimento_19(
      estabelecimento_id,
      array['proprietario','gerente','recepcao','admin']::text[]
    )
    or (
      private.tem_recurso_operacional_19(estabelecimento_id, 'permite_equipe_acesso')
      and private.papel_no_estabelecimento_19(estabelecimento_id) = 'profissional'
      and profissional_id = private.profissional_vinculado_19(estabelecimento_id)
    )
  )
);

drop policy if exists agenda_bloqueios_delete_equipe on public.agenda_bloqueios;
create policy agenda_bloqueios_delete_equipe on public.agenda_bloqueios
for delete to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_agenda_avancada')
  and (
    private.pode_operar_estabelecimento_19(
      estabelecimento_id,
      array['proprietario','gerente','recepcao','admin']::text[]
    )
    or criado_por = (select auth.uid())
  )
);

drop policy if exists agenda_intervalos_select_equipe on public.agenda_intervalos_recorrentes;
create policy agenda_intervalos_select_equipe on public.agenda_intervalos_recorrentes
for select to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_agenda_avancada')
  and private.pode_operar_estabelecimento_19(estabelecimento_id)
  and (
    private.papel_no_estabelecimento_19(estabelecimento_id) <> 'profissional'
    or profissional_id is null
    or profissional_id = private.profissional_vinculado_19(estabelecimento_id)
  )
);

drop policy if exists agenda_intervalos_manage_gestao on public.agenda_intervalos_recorrentes;
create policy agenda_intervalos_manage_gestao on public.agenda_intervalos_recorrentes
for all to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_agenda_avancada')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
)
with check (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_agenda_avancada')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);

commit;
