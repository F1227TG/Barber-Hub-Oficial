-- Torna ajustes e fechamentos imunes a reenvios de transporte.
-- Requer as migrations 01 a 35. A chave é vinculada à pessoa, estabelecimento,
-- operação e conteúdo normalizado dentro da mesma transação.
begin;

create table if not exists public.operacoes_financeiras_idempotentes (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  criado_por uuid references public.perfis(id) on delete set null,
  operacao text not null check (operacao in ('ajuste', 'fechamento')),
  chave_idempotencia text not null check (
    char_length(chave_idempotencia) between 16 and 100
    and chave_idempotencia ~ '^[A-Za-z0-9._:-]+$'
  ),
  requisicao_hash text not null check (requisicao_hash ~ '^[0-9a-f]{64}$'),
  resposta jsonb not null,
  created_at timestamptz not null default now(),
  unique (estabelecimento_id, criado_por, operacao, chave_idempotencia)
);

alter table public.operacoes_financeiras_idempotentes enable row level security;
revoke all on table public.operacoes_financeiras_idempotentes from public, anon, authenticated;
grant select, insert, update, delete on table public.operacoes_financeiras_idempotentes to service_role;

create index if not exists operacoes_financeiras_idempotentes_replay_idx
  on public.operacoes_financeiras_idempotentes(estabelecimento_id, criado_por, operacao, chave_idempotencia);

create or replace function public.criar_ajuste_financeiro_idempotente_1111(
  p_estabelecimento_id uuid,
  p_competencia date,
  p_natureza text,
  p_valor numeric,
  p_descricao text,
  p_motivo text,
  p_chave_idempotencia text,
  p_idempotencia_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_chave text;
  v_hash text;
  v_existente public.operacoes_financeiras_idempotentes%rowtype;
  v_lancamento public.lancamentos_financeiros%rowtype;
  v_resposta jsonb;
begin
  if v_usuario is null then raise exception 'Autenticação obrigatória.'; end if;
  if not private.tem_recurso_operacional_19(p_estabelecimento_id, 'permite_financeiro')
     or not private.pode_operar_estabelecimento_19(
    p_estabelecimento_id, array['proprietario','gerente','admin']::text[]
  ) then raise exception 'Sua conta não pode criar ajustes.'; end if;
  if p_competencia > current_date + 1 or p_competencia < current_date - 3660 then raise exception 'Data inválida.'; end if;
  if p_natureza not in ('credito','debito') then raise exception 'Natureza inválida.'; end if;
  if p_valor <= 0 or p_valor > 1000000 then raise exception 'Valor inválido.'; end if;
  if char_length(trim(coalesce(p_descricao, ''))) not between 2 and 180 then
    raise exception 'Informe uma descrição válida.';
  end if;
  if char_length(trim(coalesce(p_motivo, ''))) not between 3 and 500 then
    raise exception 'Informe o motivo do ajuste.';
  end if;

  v_chave := nullif(trim(p_chave_idempotencia), '');
  if v_chave is null or char_length(v_chave) not between 16 and 100 or v_chave !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'Chave de idempotência inválida.';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'usuario_id', v_usuario, 'estabelecimento_id', p_estabelecimento_id, 'operacao', 'ajuste',
    'competencia', p_competencia, 'natureza', p_natureza, 'valor', p_valor,
    'descricao', trim(p_descricao), 'motivo', trim(p_motivo)
  )::text, 'utf8'), 'sha256'), 'hex');
  if nullif(lower(trim(coalesce(p_idempotencia_hash, ''))), '') is not null
     and lower(trim(p_idempotencia_hash)) <> v_hash then
    raise exception 'O hash de idempotência não corresponde ao conteúdo do ajuste.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_estabelecimento_id::text || ':' || v_usuario::text || ':ajuste:' || v_chave, 0
  ));
  select * into v_existente
  from public.operacoes_financeiras_idempotentes o
  where o.estabelecimento_id = p_estabelecimento_id
    and o.criado_por = v_usuario
    and o.operacao = 'ajuste'
    and o.chave_idempotencia = v_chave
  for update;
  if found then
    if v_existente.requisicao_hash is distinct from v_hash then
      raise exception 'A chave de idempotência já foi usada com dados diferentes.';
    end if;
    return v_existente.resposta || jsonb_build_object('reutilizado', true);
  end if;

  insert into public.lancamentos_financeiros(
    estabelecimento_id, competencia, tipo, natureza, status, descricao,
    valor_bruto, valor_liquido, comissao_valor, motivo, origem, criado_por,
    categoria, forma_pagamento, canal_origem, chave_idempotencia, idempotencia_hash
  ) values (
    p_estabelecimento_id, p_competencia, 'ajuste', p_natureza, 'realizado', trim(p_descricao),
    p_valor, p_valor, 0, trim(p_motivo), 'manual', v_usuario,
    'ajustes', 'nao_informado', 'interno', v_chave, v_hash
  ) returning * into v_lancamento;

  v_resposta := jsonb_build_object('id', v_lancamento.id, 'status', v_lancamento.status, 'reutilizado', false);
  insert into public.operacoes_financeiras_idempotentes(
    estabelecimento_id, criado_por, operacao, chave_idempotencia, requisicao_hash, resposta
  ) values (p_estabelecimento_id, v_usuario, 'ajuste', v_chave, v_hash, v_resposta);
  return v_resposta;
end;
$$;

create or replace function public.fechar_dia_financeiro_idempotente_1111(
  p_estabelecimento_id uuid,
  p_data date,
  p_observacao text,
  p_chave_idempotencia text,
  p_idempotencia_hash text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_usuario uuid := (select auth.uid());
  v_chave text;
  v_hash text;
  v_existente public.operacoes_financeiras_idempotentes%rowtype;
  v_fechamento public.fechamentos_diarios%rowtype;
  v_resposta jsonb;
begin
  if v_usuario is null then raise exception 'Autenticação obrigatória.'; end if;
  if not private.tem_recurso_operacional_19(p_estabelecimento_id, 'permite_financeiro')
     or not private.pode_operar_estabelecimento_19(
    p_estabelecimento_id, array['proprietario','gerente','admin']::text[]
  ) then raise exception 'Sua conta não pode fechar o dia.'; end if;
  if p_data > current_date then raise exception 'Não é possível fechar uma data futura.'; end if;
  if char_length(trim(coalesce(p_observacao, ''))) > 800 then raise exception 'A observação é muito longa.'; end if;

  v_chave := nullif(trim(p_chave_idempotencia), '');
  if v_chave is null or char_length(v_chave) not between 16 and 100 or v_chave !~ '^[A-Za-z0-9._:-]+$' then
    raise exception 'Chave de idempotência inválida.';
  end if;
  v_hash := encode(extensions.digest(convert_to(jsonb_build_object(
    'usuario_id', v_usuario, 'estabelecimento_id', p_estabelecimento_id, 'operacao', 'fechamento',
    'data', p_data, 'observacao', nullif(trim(coalesce(p_observacao, '')), '')
  )::text, 'utf8'), 'sha256'), 'hex');
  if nullif(lower(trim(coalesce(p_idempotencia_hash, ''))), '') is not null
     and lower(trim(p_idempotencia_hash)) <> v_hash then
    raise exception 'O hash de idempotência não corresponde ao conteúdo do fechamento.';
  end if;

  perform pg_advisory_xact_lock(hashtextextended(
    p_estabelecimento_id::text || ':' || v_usuario::text || ':fechamento:' || v_chave, 0
  ));
  select * into v_existente
  from public.operacoes_financeiras_idempotentes o
  where o.estabelecimento_id = p_estabelecimento_id
    and o.criado_por = v_usuario
    and o.operacao = 'fechamento'
    and o.chave_idempotencia = v_chave
  for update;
  if found then
    if v_existente.requisicao_hash is distinct from v_hash then
      raise exception 'A chave de idempotência já foi usada com dados diferentes.';
    end if;
    return v_existente.resposta || jsonb_build_object('reutilizado', true);
  end if;

  select * into v_fechamento
  from public.fechar_dia_financeiro_19(p_estabelecimento_id, p_data, p_observacao);
  v_resposta := jsonb_build_object(
    'id', v_fechamento.id, 'status', v_fechamento.status,
    'revisao', v_fechamento.revisao, 'reutilizado', false
  );
  insert into public.operacoes_financeiras_idempotentes(
    estabelecimento_id, criado_por, operacao, chave_idempotencia, requisicao_hash, resposta
  ) values (p_estabelecimento_id, v_usuario, 'fechamento', v_chave, v_hash, v_resposta);
  return v_resposta;
end;
$$;

-- As assinaturas antigas não aceitam chave de idempotência; fechá-las impede
-- que clientes em cache mantenham o caminho que duplica lançamentos/revisões.
revoke all on function public.criar_ajuste_financeiro_19(uuid,date,text,numeric,text,text) from public, anon, authenticated, service_role;
revoke all on function public.fechar_dia_financeiro_19(uuid,date,text) from public, anon, authenticated, service_role;
revoke all on function public.criar_ajuste_financeiro_idempotente_1111(uuid,date,text,numeric,text,text,text,text) from public, anon;
revoke all on function public.fechar_dia_financeiro_idempotente_1111(uuid,date,text,text,text) from public, anon;
grant execute on function public.criar_ajuste_financeiro_idempotente_1111(uuid,date,text,numeric,text,text,text,text) to authenticated, service_role;
grant execute on function public.fechar_dia_financeiro_idempotente_1111(uuid,date,text,text,text) to authenticated, service_role;

commit;
