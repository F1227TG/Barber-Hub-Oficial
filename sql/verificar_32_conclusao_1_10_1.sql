-- Verificador pós-deploy da conclusão do planejamento pós-31.
-- Somente leitura: execute depois da migration 32 no SQL Editor do Supabase.

do $$
declare v_function text; v_trigger text;
begin
  foreach v_function in array array[
    'private.funcionalidade_habilitada_1101(text,uuid)',
    'public.funcionalidades_publicas_1101()',
    'public.reivindicar_entregas_push_1101(integer)',
    'public.buscar_marketplace_regional_1101(text,text,text,text,boolean,boolean,numeric,numeric,numeric,text,numeric,numeric,numeric,integer,integer)'
  ] loop
    if to_regprocedure(v_function) is null then
      raise exception 'Função da migration 32 ausente: %',v_function;
    end if;
  end loop;

  foreach v_trigger in array array[
    'periodos_feature_guard_1101','importacoes_feature_guard_1101','push_feature_guard_1101',
    'agendamentos_feature_guard_1101','regras_comissao_auditoria_1101','permissoes_auditoria_1101',
    'metas_auditoria_1101','campanhas_auditoria_1101','estabelecimentos_config_auditoria_1101'
  ] loop
    if not exists(select 1 from pg_trigger where tgname=v_trigger and not tgisinternal and tgenabled<>'D') then
      raise exception 'Trigger da migration 32 ausente ou desativado: %',v_trigger;
    end if;
  end loop;

  if has_function_privilege('anon','public.buscar_marketplace_regional_110(text,text,text,text,boolean,boolean,numeric,numeric,numeric,integer,integer)','execute')
     or has_function_privilege('authenticated','public.buscar_marketplace_regional_110(text,text,text,text,boolean,boolean,numeric,numeric,numeric,integer,integer)','execute') then
    raise exception 'O RPC regional antigo ainda contorna os filtros e o kill switch.';
  end if;
  if not has_function_privilege('anon','public.buscar_marketplace_regional_1101(text,text,text,text,boolean,boolean,numeric,numeric,numeric,text,numeric,numeric,numeric,integer,integer)','execute') then
    raise exception 'O novo marketplace regional não está disponível ao portal público.';
  end if;
  if has_function_privilege('anon','private.funcionalidade_habilitada_1101(text,uuid)','execute') then
    raise exception 'O avaliador interno de funcionalidades está exposto para anon.';
  end if;
  if has_function_privilege('authenticated','public.reivindicar_entregas_push_1101(integer)','execute') then
    raise exception 'Usuários comuns podem retirar itens da fila de push.';
  end if;

  if not exists(select 1 from public.planos where slug='essencial' and permite_recorrencia and permite_lembretes) then
    raise exception 'O plano Essencial ainda diverge dos recursos anunciados.';
  end if;
  if exists(select 1 from public.feature_flags where chave in ('marketplace.regional','perfil.biblioteca_capas') and kill_switch) then
    raise exception 'Uma função pública essencial está desligada; confirme se isso foi intencional.';
  end if;
  if not exists(select 1 from pg_indexes where schemaname='public' and indexname='servicos_publicos_estabelecimento_preco_1101_idx') then
    raise exception 'Índice do filtro de preço ausente.';
  end if;
  if not exists(
    select 1 from pg_constraint c join pg_class t on t.oid=c.conrelid join pg_namespace n on n.oid=t.relnamespace
    where n.nspname='public' and t.relname='auditoria_operacional' and c.contype='c'
      and pg_get_constraintdef(c.oid) like '%metas%'
  ) then raise exception 'A auditoria ainda não aceita todos os novos recursos.'; end if;
end $$;

select 'Barber Hub 1.10.1: migration 32, permissões, flags, auditoria e marketplace verificados.' as resultado;
