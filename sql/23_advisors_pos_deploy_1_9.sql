-- Barber Hub 1.9.0: ajustes pós-deploy indicados pelos Advisors do Supabase.
-- Execute depois de 22_encaixes_hardening_operacional_1_9.sql.

begin;

-- Funções usadas exclusivamente por gatilhos não devem ser RPCs públicas.
revoke all on function public.validar_estabelecimento_agenda_plano()
  from public, anon, authenticated;
revoke all on function public.validar_promocao_plano()
  from public, anon, authenticated;

-- PostgreSQL não cria índices automaticamente para o lado referenciador das FKs.
create index if not exists agenda_bloqueios_criado_por_idx
  on public.agenda_bloqueios(criado_por);
create index if not exists agendamento_eventos_ator_id_idx
  on public.agendamento_eventos(ator_id) where ator_id is not null;
create index if not exists agendamentos_no_show_registrado_por_idx
  on public.agendamentos(no_show_registrado_por) where no_show_registrado_por is not null;
create index if not exists clientes_estabelecimento_cliente_id_idx
  on public.clientes_estabelecimento(cliente_id) where cliente_id is not null;
create index if not exists estabelecimento_membros_convidado_por_idx
  on public.estabelecimento_membros(convidado_por) where convidado_por is not null;
create index if not exists estabelecimentos_suspenso_por_idx
  on public.estabelecimentos(suspenso_por) where suspenso_por is not null;
create index if not exists estabelecimentos_verificado_por_idx
  on public.estabelecimentos(verificado_por) where verificado_por is not null;
create index if not exists fechamentos_diarios_fechado_por_idx
  on public.fechamentos_diarios(fechado_por);
create index if not exists lancamentos_financeiros_criado_por_idx
  on public.lancamentos_financeiros(criado_por) where criado_por is not null;

-- Evita reavaliar auth.uid() para cada linha nas políticas apontadas pelo Advisor.
alter policy perfis_select_proprio_admin on public.perfis
  using (id = (select auth.uid()) or public.is_admin());
alter policy perfis_update_proprio_admin on public.perfis
  using (id = (select auth.uid()) or public.is_admin())
  with check (id = (select auth.uid()) or public.is_admin());

alter policy estabelecimentos_insert_owner on public.estabelecimentos
  with check (
    (
      owner_id = (select auth.uid())
      and exists (
        select 1 from public.perfis p
        where p.id = (select auth.uid()) and p.tipo = 'barbeiro'
      )
    )
    or public.is_admin()
  );
alter policy estabelecimentos_update_owner on public.estabelecimentos
  using (owner_id = (select auth.uid()) or public.is_admin())
  with check (owner_id = (select auth.uid()) or public.is_admin());
alter policy estabelecimentos_delete_owner on public.estabelecimentos
  using (owner_id = (select auth.uid()) or public.is_admin());

alter policy favoritos_proprio on public.favoritos
  using (cliente_id = (select auth.uid()) or public.is_admin())
  with check (cliente_id = (select auth.uid()) or public.is_admin());

alter policy tickets_insert_publico on public.tickets_suporte
  with check (user_id is null or user_id = (select auth.uid()));
alter policy tickets_select_proprio_admin on public.tickets_suporte
  using (user_id = (select auth.uid()) or public.is_admin());

alter policy horarios_select_autenticado on public.horarios_funcionamento
  using (
    exists (
      select 1 from public.estabelecimentos e
      where e.id = horarios_funcionamento.estabelecimento_id
        and (
          (e.visivel and e.onboarding_concluido)
          or e.owner_id = (select auth.uid())
          or public.is_admin()
        )
    )
  );
alter policy bloqueios_select_autenticado on public.dias_bloqueados
  using (
    exists (
      select 1 from public.estabelecimentos e
      where e.id = dias_bloqueados.estabelecimento_id
        and (
          (e.visivel and e.onboarding_concluido)
          or e.owner_id = (select auth.uid())
          or public.is_admin()
        )
    )
  );

alter policy portfolio_publicacoes_owner_insert on public.portfolio_publicacoes
  with check (
    (
      autor_id = (select auth.uid())
      and public.owns_estabelecimento(estabelecimento_id)
    )
    or public.is_admin()
  );
alter policy portfolio_publicacoes_owner_update on public.portfolio_publicacoes
  using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin())
  with check (
    (
      autor_id = (select auth.uid())
      and public.owns_estabelecimento(estabelecimento_id)
    )
    or public.is_admin()
  );

alter policy avaliacoes_select_publico on public.avaliacoes
  using (
    status = 'publicada'
    or cliente_id = (select auth.uid())
    or public.owns_estabelecimento(estabelecimento_id)
    or public.is_admin()
  );
alter policy avaliacoes_insert_cliente on public.avaliacoes
  with check (cliente_id = (select auth.uid()) or cliente_id is null);
alter policy avaliacoes_update_partes_admin on public.avaliacoes
  using (
    cliente_id = (select auth.uid())
    or public.owns_estabelecimento(estabelecimento_id)
    or public.is_admin()
  )
  with check (
    cliente_id = (select auth.uid())
    or public.owns_estabelecimento(estabelecimento_id)
    or public.is_admin()
  );
alter policy avaliacoes_delete_cliente_admin on public.avaliacoes
  using (cliente_id = (select auth.uid()) or public.is_admin());

-- Políticas FOR ALL também contam como SELECT. Separam-se as mutações para
-- manter uma única política permissiva de leitura por papel/tabela.
drop policy if exists agenda_intervalos_manage_gestao on public.agenda_intervalos_recorrentes;
create policy agenda_intervalos_insert_gestao on public.agenda_intervalos_recorrentes
for insert to authenticated
with check (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_agenda_avancada')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);
create policy agenda_intervalos_update_gestao on public.agenda_intervalos_recorrentes
for update to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_agenda_avancada')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
)
with check (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_agenda_avancada')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);
create policy agenda_intervalos_delete_gestao on public.agenda_intervalos_recorrentes
for delete to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_agenda_avancada')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);

drop policy if exists assinaturas_manage_admin on public.assinaturas;
create policy assinaturas_insert_admin on public.assinaturas
for insert to authenticated with check (public.is_admin());
create policy assinaturas_update_admin on public.assinaturas
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy assinaturas_delete_admin on public.assinaturas
for delete to authenticated using (public.is_admin());

drop policy if exists planos_manage_admin on public.planos;
create policy planos_insert_admin on public.planos
for insert to authenticated with check (public.is_admin());
create policy planos_update_admin on public.planos
for update to authenticated using (public.is_admin()) with check (public.is_admin());
create policy planos_delete_admin on public.planos
for delete to authenticated using (public.is_admin());

drop policy if exists bloqueios_manage_owner on public.dias_bloqueados;
create policy bloqueios_insert_owner on public.dias_bloqueados
for insert to authenticated
with check (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());
create policy bloqueios_update_owner on public.dias_bloqueados
for update to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin())
with check (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());
create policy bloqueios_delete_owner on public.dias_bloqueados
for delete to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());

drop policy if exists horarios_manage_owner on public.horarios_funcionamento;
create policy horarios_insert_owner on public.horarios_funcionamento
for insert to authenticated
with check (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());
create policy horarios_update_owner on public.horarios_funcionamento
for update to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin())
with check (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());
create policy horarios_delete_owner on public.horarios_funcionamento
for delete to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());

drop policy if exists profissionais_manage_owner on public.profissionais;
create policy profissionais_insert_owner on public.profissionais
for insert to authenticated
with check (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());
create policy profissionais_update_owner on public.profissionais
for update to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin())
with check (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());
create policy profissionais_delete_owner on public.profissionais
for delete to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());

drop policy if exists profissional_servicos_manage on public.profissional_servicos;
create policy profissional_servicos_insert_owner on public.profissional_servicos
for insert to authenticated
with check (
  exists (
    select 1 from public.profissionais p
    where p.id = profissional_servicos.profissional_id
      and (public.owns_estabelecimento(p.estabelecimento_id) or public.is_admin())
  )
);
create policy profissional_servicos_update_owner on public.profissional_servicos
for update to authenticated
using (
  exists (
    select 1 from public.profissionais p
    where p.id = profissional_servicos.profissional_id
      and (public.owns_estabelecimento(p.estabelecimento_id) or public.is_admin())
  )
)
with check (
  exists (
    select 1 from public.profissionais p
    where p.id = profissional_servicos.profissional_id
      and (public.owns_estabelecimento(p.estabelecimento_id) or public.is_admin())
  )
);
create policy profissional_servicos_delete_owner on public.profissional_servicos
for delete to authenticated
using (
  exists (
    select 1 from public.profissionais p
    where p.id = profissional_servicos.profissional_id
      and (public.owns_estabelecimento(p.estabelecimento_id) or public.is_admin())
  )
);

-- Remove leituras legadas que permitiam visualizar promoções sem entitlement.
drop policy if exists promocoes_select_visitante on public.promocoes;
drop policy if exists promocoes_select_autenticado on public.promocoes;
drop policy if exists promocoes_select_publico on public.promocoes;
drop policy if exists promocoes_select_owner_admin on public.promocoes;
drop policy if exists promocoes_manage_owner on public.promocoes;

create policy promocoes_select_visitante_23 on public.promocoes
for select to anon
using (
  ativo = true
  and public.promocoes_publicas_disponiveis(estabelecimento_id)
  and exists (
    select 1 from public.estabelecimentos e
    where e.id = promocoes.estabelecimento_id
      and e.visivel and e.onboarding_concluido
      and e.suspenso_pela_moderacao = false
  )
);
create policy promocoes_select_autenticado_23 on public.promocoes
for select to authenticated
using (
  (
    ativo = true
    and public.promocoes_publicas_disponiveis(estabelecimento_id)
    and exists (
      select 1 from public.estabelecimentos e
      where e.id = promocoes.estabelecimento_id
        and e.visivel and e.onboarding_concluido
        and e.suspenso_pela_moderacao = false
    )
  )
  or public.owns_estabelecimento(estabelecimento_id)
  or public.is_admin()
);
create policy promocoes_insert_owner on public.promocoes
for insert to authenticated
with check (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());
create policy promocoes_update_owner on public.promocoes
for update to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin())
with check (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());
create policy promocoes_delete_owner on public.promocoes
for delete to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());

drop policy if exists comissao_manage_financeiro on public.regras_comissao;
create policy comissao_insert_financeiro on public.regras_comissao
for insert to authenticated
with check (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_comissoes')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);
create policy comissao_update_financeiro on public.regras_comissao
for update to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_comissoes')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
)
with check (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_comissoes')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);
create policy comissao_delete_financeiro on public.regras_comissao
for delete to authenticated
using (
  private.tem_recurso_operacional_19(estabelecimento_id, 'permite_comissoes')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);

drop policy if exists servicos_manage_owner on public.servicos;
create policy servicos_insert_owner on public.servicos
for insert to authenticated
with check (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());
create policy servicos_update_owner on public.servicos
for update to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin())
with check (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());
create policy servicos_delete_owner on public.servicos
for delete to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());

commit;
