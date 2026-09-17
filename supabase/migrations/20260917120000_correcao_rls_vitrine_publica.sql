-- Corrige a leitura pública de horários sem expor o helper operacional ao anon.
-- Requer as migrations 01 a 33. É aditiva e pode ser reexecutada com segurança.
begin;

drop policy if exists horario_periodos_select_publico_110 on public.estabelecimento_horario_periodos;
drop policy if exists horario_periodos_select_publico_1111 on public.estabelecimento_horario_periodos;
drop policy if exists horario_periodos_select_operacional_1111 on public.estabelecimento_horario_periodos;

-- A política pública não pode depender de helpers no schema private: visitantes
-- não recebem USAGE nesse schema e a avaliação do OR anterior falhava com 42501.
create policy horario_periodos_select_publico_1111
on public.estabelecimento_horario_periodos for select to anon, authenticated
using (
  exists (
    select 1
    from public.estabelecimentos e
    where e.id = estabelecimento_id
      and e.visivel
      and e.onboarding_concluido
      and not e.suspenso_pela_moderacao
  )
);

-- Estabelecimentos em preparação, ocultos ou moderados continuam visíveis
-- exclusivamente para membros autenticados que realmente os operam.
create policy horario_periodos_select_operacional_1111
on public.estabelecimento_horario_periodos for select to authenticated
using (private.pode_operar_estabelecimento_19(estabelecimento_id));

commit;
