-- Execute apos a migration 20260917150000 em homologacao.
do $$
declare v_funcao text;
begin
  select pg_get_functiondef('public.exportar_meus_dados_111()'::regprocedure) into v_funcao;
  if v_funcao not like '%lista_espera%cliente_id=v_user%'
     or v_funcao not like '%agendamentos_recorrencias%cliente_id=v_user%'
     or v_funcao not like '%fidelidade_saldos%s.cliente_id=v_user%'
     or v_funcao not like '%fidelidade_movimentos%m.cliente_id=v_user%'
     or v_funcao not like '%notificacoes%n.user_id=v_user%'
  then raise exception 'Exportacao nao cobre relacionamentos proprios esperados.'; end if;
  if v_funcao like '%to_jsonb(p) from public.push_assinaturas%'
     or v_funcao like '%''endpoint'',p.endpoint%'
  then raise exception 'Exportacao inclui segredo ou identificador tecnico proibido.'; end if;
  raise notice 'exportacao_dados_conta_ampliada_ok';
end $$;
