-- Barber Hub: separa políticas públicas das políticas autenticadas.
-- Evita que visitantes executem funções administrativas durante consultas públicas.

-- ESTABELECIMENTOS
drop policy if exists estabelecimentos_select_publico on public.estabelecimentos;
drop policy if exists estabelecimentos_select_visitante on public.estabelecimentos;
drop policy if exists estabelecimentos_select_autenticado on public.estabelecimentos;
create policy estabelecimentos_select_visitante on public.estabelecimentos
for select to anon
using (visivel = true and onboarding_concluido = true);
create policy estabelecimentos_select_autenticado on public.estabelecimentos
for select to authenticated
using ((visivel = true and onboarding_concluido = true) or owner_id = auth.uid() or public.is_admin());

-- HORÁRIOS
drop policy if exists horarios_select_publico on public.horarios_funcionamento;
drop policy if exists horarios_select_visitante on public.horarios_funcionamento;
drop policy if exists horarios_select_autenticado on public.horarios_funcionamento;
create policy horarios_select_visitante on public.horarios_funcionamento
for select to anon
using (exists (
  select 1 from public.estabelecimentos e
  where e.id = estabelecimento_id and e.visivel and e.onboarding_concluido
));
create policy horarios_select_autenticado on public.horarios_funcionamento
for select to authenticated
using (exists (
  select 1 from public.estabelecimentos e
  where e.id = estabelecimento_id
    and ((e.visivel and e.onboarding_concluido) or e.owner_id = auth.uid() or public.is_admin())
));

-- DIAS BLOQUEADOS
drop policy if exists bloqueios_select_publico on public.dias_bloqueados;
drop policy if exists bloqueios_select_visitante on public.dias_bloqueados;
drop policy if exists bloqueios_select_autenticado on public.dias_bloqueados;
create policy bloqueios_select_visitante on public.dias_bloqueados
for select to anon
using (exists (
  select 1 from public.estabelecimentos e
  where e.id = estabelecimento_id and e.visivel and e.onboarding_concluido
));
create policy bloqueios_select_autenticado on public.dias_bloqueados
for select to authenticated
using (exists (
  select 1 from public.estabelecimentos e
  where e.id = estabelecimento_id
    and ((e.visivel and e.onboarding_concluido) or e.owner_id = auth.uid() or public.is_admin())
));

-- PROFISSIONAIS
drop policy if exists profissionais_select_publico on public.profissionais;
drop policy if exists profissionais_select_visitante on public.profissionais;
drop policy if exists profissionais_select_autenticado on public.profissionais;
create policy profissionais_select_visitante on public.profissionais
for select to anon
using (ativo = true and exists (
  select 1 from public.estabelecimentos e
  where e.id = estabelecimento_id and e.visivel and e.onboarding_concluido
));
create policy profissionais_select_autenticado on public.profissionais
for select to authenticated
using (
  (ativo = true and exists (
    select 1 from public.estabelecimentos e
    where e.id = estabelecimento_id and e.visivel and e.onboarding_concluido
  )) or public.owns_estabelecimento(estabelecimento_id) or public.is_admin()
);

-- SERVIÇOS
drop policy if exists servicos_select_publico on public.servicos;
drop policy if exists servicos_select_visitante on public.servicos;
drop policy if exists servicos_select_autenticado on public.servicos;
create policy servicos_select_visitante on public.servicos
for select to anon
using (ativo = true and publico = true and exists (
  select 1 from public.estabelecimentos e
  where e.id = estabelecimento_id and e.visivel and e.onboarding_concluido
));
create policy servicos_select_autenticado on public.servicos
for select to authenticated
using (
  (ativo = true and publico = true and exists (
    select 1 from public.estabelecimentos e
    where e.id = estabelecimento_id and e.visivel and e.onboarding_concluido
  )) or public.owns_estabelecimento(estabelecimento_id) or public.is_admin()
);

-- PROMOÇÕES
drop policy if exists promocoes_select_publico on public.promocoes;
drop policy if exists promocoes_select_visitante on public.promocoes;
drop policy if exists promocoes_select_autenticado on public.promocoes;
create policy promocoes_select_visitante on public.promocoes
for select to anon
using (ativo = true and exists (
  select 1 from public.estabelecimentos e
  where e.id = estabelecimento_id and e.visivel and e.onboarding_concluido
));
create policy promocoes_select_autenticado on public.promocoes
for select to authenticated
using (
  (ativo = true and exists (
    select 1 from public.estabelecimentos e
    where e.id = estabelecimento_id and e.visivel and e.onboarding_concluido
  )) or public.owns_estabelecimento(estabelecimento_id) or public.is_admin()
);
