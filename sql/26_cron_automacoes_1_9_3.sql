-- Barber Hub 1.9.3: agenda os workers internos de lembretes e notificacoes.
-- Execute depois de 25_inteligencia_permissoes_1_9_3.sql.

begin;

create extension if not exists pg_cron with schema pg_catalog;

grant usage on schema cron to postgres;
grant all privileges on all tables in schema cron to postgres;

do $$
declare
  v_job_id bigint;
begin
  select jobid
    into v_job_id
  from cron.job
  where jobname = 'barberhub-preparar-lembretes-193';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'barberhub-preparar-lembretes-193',
    '*/10 * * * *',
    $job$select public.preparar_lembretes_193();$job$
  );

  v_job_id := null;
  select jobid
    into v_job_id
  from cron.job
  where jobname = 'barberhub-processar-internas-193';

  if v_job_id is not null then
    perform cron.unschedule(v_job_id);
  end if;

  perform cron.schedule(
    'barberhub-processar-internas-193',
    '*/5 * * * *',
    $job$select public.processar_automacoes_internas_193(200);$job$
  );
end;
$$;

commit;
