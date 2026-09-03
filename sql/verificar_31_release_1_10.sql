-- Verificador pós-deploy da release 1.10.0. Somente leitura; falha de forma explícita.

do $$
declare v_nome text; v_sem_rls text[]; v_funcao text;
begin
  foreach v_nome in array array[
    'estabelecimento_horario_periodos','biblioteca_capas','feature_flags','feature_flag_alvos',
    'push_assinaturas','push_preferencias','push_entregas','importacoes_operacionais',
    'importacao_linhas','auditoria_operacional'
  ] loop
    if to_regclass('public.'||v_nome) is null then
      raise exception 'Tabela obrigatória ausente: public.%',v_nome;
    end if;
  end loop;

  select array_agg(c.relname order by c.relname) into v_sem_rls
  from pg_class c join pg_namespace n on n.oid=c.relnamespace
  where n.nspname='public' and c.relname=any(array[
    'estabelecimento_horario_periodos','biblioteca_capas','feature_flags','feature_flag_alvos',
    'push_assinaturas','push_preferencias','push_entregas','importacoes_operacionais',
    'importacao_linhas','auditoria_operacional'
  ]) and not c.relrowsecurity;
  if cardinality(v_sem_rls)>0 then raise exception 'RLS desabilitado em: %',array_to_string(v_sem_rls,', '); end if;

  foreach v_funcao in array array[
    'public.obter_periodos_funcionamento_110(uuid)',
    'public.substituir_periodos_funcionamento_110(uuid,jsonb)',
    'public.registrar_atendimento_manual_110(uuid,uuid,uuid,text,integer,uuid,text,text,text,timestamp with time zone,numeric,text,text,text,text,text)',
    'public.registrar_despesa_110(uuid,date,numeric,text,text,text,text,text,text)',
    'public.resumo_financeiro_110(uuid,date,date)',
    'public.atualizar_localizacao_estabelecimento_110(uuid,text,text,text,text,text,text,text,numeric,numeric,text,text,numeric)',
    'public.buscar_marketplace_regional_110(text,text,text,text,boolean,boolean,numeric,numeric,numeric,integer,integer)',
    'public.avaliar_feature_flags_110(text[],uuid)',
    'public.confirmar_importacao_110(uuid)'
  ] loop
    if to_regprocedure(v_funcao) is null then raise exception 'Função obrigatória ausente: %',v_funcao; end if;
  end loop;

  if has_table_privilege('anon','public.feature_flags','select')
     or has_table_privilege('anon','public.feature_flag_alvos','select')
     or has_table_privilege('anon','public.push_assinaturas','select')
     or has_table_privilege('anon','public.push_preferencias','select')
     or has_table_privilege('anon','public.push_entregas','select')
     or has_table_privilege('anon','public.importacoes_operacionais','select')
     or has_table_privilege('anon','public.importacao_linhas','select')
     or has_table_privilege('anon','public.auditoria_operacional','select') then
    raise exception 'Uma tabela interna da 1.10 ainda está acessível para anon.';
  end if;

  if has_function_privilege('anon','public.substituir_periodos_funcionamento_110(uuid,jsonb)','execute')
     or has_function_privilege('anon','public.registrar_atendimento_manual_110(uuid,uuid,uuid,text,integer,uuid,text,text,text,timestamp with time zone,numeric,text,text,text,text,text)','execute')
     or has_function_privilege('anon','public.registrar_despesa_110(uuid,date,numeric,text,text,text,text,text,text)','execute')
     or has_function_privilege('anon','public.confirmar_importacao_110(uuid)','execute') then
    raise exception 'Uma RPC operacional sensível ainda pode ser executada anonimamente.';
  end if;

  if not exists(select 1 from public.biblioteca_capas where ativo) then
    raise exception 'A biblioteca oficial de capas está vazia.';
  end if;
  if exists (
    select 1 from unnest(array[
      'operacao.atendimento_manual','operacao.multiplos_periodos','financeiro.despesas',
      'marketplace.regional','perfil.biblioteca_capas','dados.importacao',
      'notificacoes.web_push','operacao.auditoria'
    ]) obrigatoria(chave)
    where not exists (
      select 1 from public.feature_flags f
      where f.chave=obrigatoria.chave and not f.kill_switch
    )
  ) then
    raise exception 'Flags essenciais da operação real não estão configuradas.';
  end if;

  if exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='auditoria_operacional'
      and column_name='estabelecimento_id' and is_nullable='NO'
  ) then raise exception 'A auditoria não permite anonimização do estabelecimento.'; end if;
  if exists(
    select 1 from information_schema.columns
    where table_schema='public' and table_name='importacoes_operacionais'
      and column_name='solicitado_por' and is_nullable='NO'
  ) then raise exception 'O histórico de importação não permite anonimização do solicitante.'; end if;

  if not exists(select 1 from pg_trigger where tgname='auditoria_operacional_imutavel_110' and tgenabled<>'D') then
    raise exception 'A proteção de imutabilidade da auditoria não está ativa.';
  end if;
  if not exists(select 1 from pg_trigger where tgname='notificacoes_enfileirar_push_110' and tgenabled<>'D') then
    raise exception 'A fila Web Push não está conectada às notificações internas.';
  end if;
end $$;

select 'Barber Hub 1.10.0: estrutura, RLS, privilégios e integrações verificadas.' as resultado;
