-- Verificação pós-migration 34. Execute em homologação antes da promoção.
-- Confirma o desenho da RLS; o roteiro de homologação deve também consultar
-- a vitrine com papéis anon, cliente e operador em dados sintéticos.
select
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'estabelecimento_horario_periodos'
      and policyname = 'horario_periodos_select_publico_1111'
      and roles @> array['anon', 'authenticated']::name[]
      and qual like '%visivel%'
      and qual like '%onboarding_concluido%'
      and qual like '%suspenso_pela_moderacao%'
      and qual not like '%pode_operar_estabelecimento_19%'
  ) as politica_publica_segura_ok,
  exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'estabelecimento_horario_periodos'
      and policyname = 'horario_periodos_select_operacional_1111'
      and roles = array['authenticated']::name[]
      and qual like '%pode_operar_estabelecimento_19%'
  ) as politica_operacional_isolada_ok,
  not exists(
    select 1
    from pg_policies
    where schemaname = 'public'
      and tablename = 'estabelecimento_horario_periodos'
      and policyname = 'horario_periodos_select_publico_110'
  ) as politica_defeituosa_removida_ok,
  not has_schema_privilege('anon', 'private', 'USAGE') as anon_sem_acesso_ao_schema_privado_ok;
