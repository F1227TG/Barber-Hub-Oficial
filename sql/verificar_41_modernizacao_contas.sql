-- Somente leitura. Executar após aplicar a migration 20261022155131 em homologação.
select
  exists(select 1 from information_schema.columns where table_schema='public'
         and table_name='perfis' and column_name='estado_conta') as estados_conta_presentes,
  not has_column_privilege('authenticated','public.perfis','tipo','UPDATE') as papel_fechado_navegador,
  not has_column_privilege('authenticated','public.perfis','ativo','UPDATE') as status_fechado_navegador,
  not has_column_privilege('authenticated','public.perfis','estado_conta','UPDATE') as estado_fechado_navegador,
  has_column_privilege('authenticated','public.perfis','nome','UPDATE') as edicao_pessoal_preservada,
  not has_function_privilege('authenticated','public.administrar_conta(uuid,uuid,jsonb,text)','EXECUTE') as rpc_fechada_usuario,
  not has_function_privilege('anon','public.administrar_conta(uuid,uuid,jsonb,text)','EXECUTE') as rpc_fechada_anonimo,
  has_function_privilege('service_role','public.administrar_conta(uuid,uuid,jsonb,text)','EXECUTE') as rpc_aberta_backend,
  not has_function_privilege('authenticated','public.sessao_conta_ativa(uuid,uuid)','EXECUTE') as consulta_sessao_privada,
  exists(select 1 from pg_roles r cross join lateral unnest(r.rolconfig) item
         where r.rolname='authenticator' and item='pgrst.db_pre_request=public.validar_acesso_conta') as pre_request_configurado,
  exists(select 1 from pg_trigger where tgrelid='public.perfis'::regclass
         and tgname='perfis_estado_conta' and tgenabled='O') as protecao_ultimo_admin,
  not exists(select 1 from public.perfis where ativo is distinct from (estado_conta='ativa')) as estados_consistentes;

-- Qualquer linha indica uma tabela RLS que precisa do bloqueio adicional.
select c.relname as tabela_sem_bloqueio_conta
from pg_class c join pg_namespace n on n.oid=c.relnamespace
where n.nspname='public' and c.relkind in ('r','p') and c.relrowsecurity
  and not exists(select 1 from pg_policy p where p.polrelid=c.oid
                 and p.polname='conta_ativa_restritiva' and not p.polpermissive);
