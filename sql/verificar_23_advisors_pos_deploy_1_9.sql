-- Verificação somente leitura. Execute depois da migration 23.

select
  not has_function_privilege(
    'anon', 'public.validar_estabelecimento_agenda_plano()', 'EXECUTE'
  ) as trigger_agenda_anon_fechado,
  not has_function_privilege(
    'authenticated', 'public.validar_estabelecimento_agenda_plano()', 'EXECUTE'
  ) as trigger_agenda_auth_fechado,
  not has_function_privilege(
    'anon', 'public.validar_promocao_plano()', 'EXECUTE'
  ) as trigger_promocao_anon_fechado,
  (
    select count(*)
    from pg_indexes
    where schemaname = 'public'
      and indexname in (
        'agenda_bloqueios_criado_por_idx',
        'agendamento_eventos_ator_id_idx',
        'agendamentos_no_show_registrado_por_idx',
        'clientes_estabelecimento_cliente_id_idx',
        'estabelecimento_membros_convidado_por_idx',
        'estabelecimentos_suspenso_por_idx',
        'estabelecimentos_verificado_por_idx',
        'fechamentos_diarios_fechado_por_idx',
        'lancamentos_financeiros_criado_por_idx'
      )
  ) = 9 as indices_fk_ok,
  not exists (
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'promocoes'
      and policyname in (
        'promocoes_select_visitante',
        'promocoes_select_autenticado',
        'promocoes_select_publico',
        'promocoes_select_owner_admin'
      )
  ) as politicas_promocoes_legadas_removidas,
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'promocoes'
      and policyname = 'promocoes_select_visitante_23'
  ) as promocao_visitante_com_entitlement_ok,
  exists (
    select 1 from pg_policies
    where schemaname = 'public' and tablename = 'promocoes'
      and policyname = 'promocoes_select_autenticado_23'
  ) as promocao_autenticada_com_entitlement_ok;
