-- Verificação pós-migration do Barber Hub 1.9.3.
-- Execute depois de 24_retencao_relacionamento_1_9_3.sql e
-- 25_inteligencia_permissoes_1_9_3.sql. Não altera dados.

begin;

do $$
declare
  v_tabela text;
  v_funcao text;
  v_sem_rls text[];
begin
  foreach v_tabela in array array[
    'lista_espera','agendamentos_recorrencias','fidelidade_programas',
    'fidelidade_recompensas','fidelidade_saldos','fidelidade_movimentos',
    'cupons','cupom_usos','campanhas','campanha_destinatarios',
    'automacoes_mensagens','membro_permissoes','metas_crescimento',
    'oportunidades_crescimento','insights_operacionais'
  ] loop
    if to_regclass('public.' || v_tabela) is null then
      raise exception 'Tabela obrigatória ausente: public.%', v_tabela;
    end if;
    if not exists (
      select 1 from pg_policies p
      where p.schemaname = 'public' and p.tablename = v_tabela
    ) then
      raise exception 'Tabela pública sem política RLS: public.%', v_tabela;
    end if;
  end loop;

  select array_agg(c.relname order by c.relname)
    into v_sem_rls
  from pg_class c
  join pg_namespace n on n.oid = c.relnamespace
  where n.nspname = 'public'
    and c.relname = any(array[
      'lista_espera','agendamentos_recorrencias','fidelidade_programas',
      'fidelidade_recompensas','fidelidade_saldos','fidelidade_movimentos',
      'cupons','cupom_usos','campanhas','campanha_destinatarios',
      'automacoes_mensagens','membro_permissoes','metas_crescimento',
      'oportunidades_crescimento','insights_operacionais'
    ])
    and not c.relrowsecurity;
  if coalesce(cardinality(v_sem_rls), 0) > 0 then
    raise exception 'RLS desabilitado em: %', array_to_string(v_sem_rls, ', ');
  end if;

  foreach v_funcao in array array[
    'public.entrar_lista_espera_193(uuid,uuid,uuid,date,date,time without time zone,time without time zone,text)',
    'public.criar_recorrencia_agendamento_193(uuid,text,smallint)',
    'public.resgatar_recompensa_193(uuid,uuid)',
    'public.criar_agendamento_com_cupom_193(uuid,uuid,uuid[],date,time without time zone,text,text)',
    'public.criar_campanha_193(uuid,text,text,text,text,text,timestamp with time zone)',
    'public.obter_minhas_permissoes_193(uuid)',
    'public.resumo_crescimento_193(uuid,date,date)',
    'public.recalcular_oportunidades_193(uuid)'
  ] loop
    if to_regprocedure(v_funcao) is null then
      raise exception 'Função obrigatória ausente: %', v_funcao;
    end if;
  end loop;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='clientes_estabelecimento' and column_name='data_nascimento'
  ) then raise exception 'Campo de aniversário do CRM ausente.'; end if;

  if not exists (
    select 1 from information_schema.columns
    where table_schema='public' and table_name='clientes_estabelecimento' and column_name='permite_email_marketing'
  ) then raise exception 'Consentimento de campanhas por e-mail ausente no CRM.'; end if;

  if exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname like '%193%'
      and has_function_privilege('anon', p.oid, 'EXECUTE')
  ) then raise exception 'Existe função RPC 1.9.3 executável anonimamente.'; end if;

  if has_function_privilege('authenticated', 'public.preparar_lembretes_193()', 'EXECUTE')
     or has_function_privilege('authenticated', 'public.processar_automacoes_internas_193(integer)', 'EXECUTE') then
    raise exception 'Workers de lembrete não podem ser executados pelo frontend autenticado.';
  end if;

  if exists (
    select 1 from public.planos
    where slug='gratuito' and (
      permite_lista_espera or permite_recorrencia or permite_fidelidade or permite_cupons
      or permite_campanhas or permite_lembretes or permite_oportunidades or permite_insights
      or permite_metas or permite_permissoes_granulares
    )
  ) then raise exception 'O plano Gratuito recebeu recurso premium indevido.'; end if;

  if not exists (
    select 1 from public.planos where slug='elite'
      and permite_lista_espera and permite_recorrencia and permite_fidelidade and permite_cupons
      and permite_campanhas and permite_lembretes and permite_oportunidades and permite_insights
      and permite_metas and permite_permissoes_granulares
  ) then raise exception 'Entitlements da 1.9.3 não foram ativados no Elite.'; end if;

  raise notice 'Barber Hub 1.9.3: estrutura, RLS, funções e entitlements validados.';
end;
$$;

-- Resultado esperado: nenhum registro.
select n.nspname as schema, p.proname as funcao
from pg_proc p
join pg_namespace n on n.oid=p.pronamespace
where n.nspname in ('public','private')
  and p.proname like '%193%'
  and p.prosecdef
  and coalesce(array_to_string(p.proconfig, ','), '') not like '%search_path=%';

rollback;
