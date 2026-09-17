-- Fecha a divergência entre despesas registradas, resumo e fechamento diário.
-- Requer as migrations 01 a 34. Campos históricos não são recalculados aqui:
-- uma revisão só ocorre quando um operador fecha novamente o respectivo dia.
begin;

alter table public.fechamentos_diarios
  add column if not exists despesas_realizadas numeric(12,2) not null default 0
    check (despesas_realizadas >= 0),
  add column if not exists resultado_operacional numeric(12,2) not null default 0,
  add column if not exists resultado_apos_comissoes numeric(12,2) not null default 0;

-- Contrato do fechamento:
-- receita_liquida = receita_bruta + ajustes_credito - ajustes_debito (legado);
-- resultado_operacional = receita_liquida - despesas_realizadas;
-- resultado_apos_comissoes = resultado_operacional - comissoes.
create or replace function public.fechar_dia_financeiro_19(
  p_estabelecimento_id uuid,
  p_data date,
  p_observacao text default null
)
returns public.fechamentos_diarios
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_fechamento public.fechamentos_diarios%rowtype;
  v_bruta numeric(12,2);
  v_creditos numeric(12,2);
  v_debitos numeric(12,2);
  v_despesas numeric(12,2);
  v_comissoes numeric(12,2);
  v_resultado_operacional numeric(12,2);
  v_resultado_apos_comissoes numeric(12,2);
  v_concluidos integer;
  v_cancelados integer;
  v_faltas integer;
begin
  if not private.tem_recurso_operacional_19(p_estabelecimento_id, 'permite_financeiro')
     or not private.pode_operar_estabelecimento_19(
    p_estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  ) then raise exception 'Sua conta não pode fechar o dia.'; end if;
  if p_data > current_date then raise exception 'Não é possível fechar uma data futura.'; end if;
  perform pg_advisory_xact_lock(hashtextextended(p_estabelecimento_id::text || ':' || p_data::text || ':fechamento', 0));

  select
    coalesce(sum(l.valor_liquido) filter (where l.tipo = 'receita_atendimento' and l.status = 'realizado'), 0),
    coalesce(sum(l.valor_liquido) filter (where l.tipo = 'ajuste' and l.natureza = 'credito' and l.status = 'realizado'), 0),
    coalesce(sum(l.valor_liquido) filter (where l.tipo = 'ajuste' and l.natureza = 'debito' and l.status = 'realizado'), 0),
    coalesce(sum(l.valor_liquido) filter (where l.tipo = 'despesa' and l.natureza = 'debito' and l.status = 'realizado'), 0),
    coalesce(sum(l.comissao_valor) filter (where l.tipo = 'receita_atendimento' and l.status = 'realizado'), 0),
    count(*) filter (where l.tipo = 'receita_atendimento' and l.status = 'realizado')::integer,
    count(*) filter (where l.tipo = 'receita_atendimento' and l.status = 'cancelado')::integer
  into v_bruta, v_creditos, v_debitos, v_despesas, v_comissoes, v_concluidos, v_cancelados
  from public.lancamentos_financeiros l
  where l.estabelecimento_id = p_estabelecimento_id and l.competencia = p_data;

  v_resultado_operacional := v_bruta + v_creditos - v_debitos - v_despesas;
  v_resultado_apos_comissoes := v_resultado_operacional - v_comissoes;

  select count(*)::integer into v_faltas from public.agendamentos a
  where a.estabelecimento_id = p_estabelecimento_id and a.data = p_data and a.status = 'faltou';

  insert into public.fechamentos_diarios(
    estabelecimento_id, data, receita_bruta, ajustes_credito, ajustes_debito,
    receita_liquida, despesas_realizadas, resultado_operacional, resultado_apos_comissoes,
    comissoes, atendimentos_concluidos, cancelamentos, faltas,
    status, revisao, fechado_por, fechado_em, observacao
  ) values (
    p_estabelecimento_id, p_data, v_bruta, v_creditos, v_debitos,
    v_bruta + v_creditos - v_debitos, v_despesas, v_resultado_operacional, v_resultado_apos_comissoes,
    v_comissoes, v_concluidos, v_cancelados, v_faltas,
    'fechado', 1, (select auth.uid()), now(), nullif(trim(coalesce(p_observacao, '')), '')
  )
  on conflict (estabelecimento_id, data) do update
  set receita_bruta = excluded.receita_bruta,
      ajustes_credito = excluded.ajustes_credito,
      ajustes_debito = excluded.ajustes_debito,
      receita_liquida = excluded.receita_liquida,
      despesas_realizadas = excluded.despesas_realizadas,
      resultado_operacional = excluded.resultado_operacional,
      resultado_apos_comissoes = excluded.resultado_apos_comissoes,
      comissoes = excluded.comissoes,
      atendimentos_concluidos = excluded.atendimentos_concluidos,
      cancelamentos = excluded.cancelamentos,
      faltas = excluded.faltas,
      status = 'fechado',
      revisao = public.fechamentos_diarios.revisao + 1,
      fechado_por = (select auth.uid()),
      fechado_em = now(),
      observacao = excluded.observacao,
      updated_at = now()
  returning * into v_fechamento;
  return v_fechamento;
end;
$$;

commit;
