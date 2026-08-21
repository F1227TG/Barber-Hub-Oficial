-- Verificacao somente leitura. Execute depois da migration 17.

with controles as (
  select 'V01 coluna de suspensao' as controle,
         exists (
           select 1 from information_schema.columns
           where table_schema = 'public' and table_name = 'estabelecimentos'
             and column_name = 'suspenso_pela_moderacao'
         ) as ok
  union all
  select 'V01 constraint de visibilidade', exists (
    select 1 from pg_constraint
    where conname = 'estabelecimentos_suspensao_consistente'
      and conrelid = 'public.estabelecimentos'::regclass
  )
  union all
  select 'V01 trigger de campos sensiveis', exists (
    select 1 from pg_trigger
    where tgname = 'estabelecimentos_proteger_campos_sensiveis'
      and tgenabled <> 'D'
  )
  union all
  select 'V02 trigger de transicao', exists (
    select 1 from pg_trigger
    where tgname = 'agendamentos_validar_transicao_status'
      and tgenabled <> 'D'
  )
  union all
  select 'V03 trigger de profissionais', exists (
    select 1 from pg_trigger
    where tgname = 'profissionais_validar_plano'
      and tgenabled <> 'D'
  )
  union all
  select 'V03 trigger de agenda', exists (
    select 1 from pg_trigger
    where tgname = 'agendamentos_validar_plano'
      and tgenabled <> 'D'
  )
  union all
  select 'V04 contador consistente', not exists (
    select 1
    from public.portfolio_publicacoes p
    where p.curtidas_count is distinct from (
      select count(*) from public.portfolio_curtidas c where c.publicacao_id = p.id
    )
  )
  union all
  select 'Triggers sem RPC anonima',
    not has_function_privilege('anon', 'public.proteger_campos_sensiveis_estabelecimento()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.validar_transicao_status_agendamento()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.validar_profissional_limite_plano()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.validar_agendamento_plano()', 'EXECUTE')
    and not has_function_privilege('anon', 'public.validar_portfolio_publicacao()', 'EXECUTE')
)
select controle, case when ok then 'OK' else 'REVISAR' end as resultado
from controles
order by controle;

