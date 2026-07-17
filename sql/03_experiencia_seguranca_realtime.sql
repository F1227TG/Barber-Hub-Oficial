-- Barber Hub Experience 1.0: segurança, índices e realtime
create index if not exists agendamentos_servico_id_idx on public.agendamentos(servico_id);
create index if not exists favoritos_estabelecimento_id_idx on public.favoritos(estabelecimento_id);
create index if not exists profissionais_user_id_idx on public.profissionais(user_id);
create index if not exists profissional_servicos_servico_id_idx on public.profissional_servicos(servico_id);
create index if not exists promocoes_estabelecimento_id_idx on public.promocoes(estabelecimento_id);

alter function public.set_updated_at() set search_path = public;
revoke all on function public.handle_new_user() from public, anon, authenticated;
revoke all on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.criar_estabelecimento_inicial(text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,jsonb,jsonb,text,text,text,text) from anon;
revoke execute on function public.criar_agendamento(uuid,uuid,uuid,date,time,text) from anon;
revoke execute on function public.cancelar_agendamento(uuid,text) from anon;
revoke execute on function public.is_admin() from anon;
revoke execute on function public.owns_estabelecimento(uuid) from anon;
grant execute on function public.criar_estabelecimento_inicial(text,text,text,text,text,text,text,text,text,text,text,text,text,text,boolean,jsonb,jsonb,text,text,text,text) to authenticated;
grant execute on function public.criar_agendamento(uuid,uuid,uuid,date,time,text) to authenticated;
grant execute on function public.cancelar_agendamento(uuid,text) to authenticated;
grant execute on function public.is_admin() to authenticated;
grant execute on function public.owns_estabelecimento(uuid) to authenticated;
grant execute on function public.horarios_ocupados(uuid,date) to anon, authenticated;
grant execute on function public.metricas_publicas() to anon, authenticated;

do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='agendamentos') then
    alter publication supabase_realtime add table public.agendamentos;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='tickets_suporte') then
    alter publication supabase_realtime add table public.tickets_suporte;
  end if;
end $$;
