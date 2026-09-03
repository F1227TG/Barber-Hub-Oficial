-- Barber Hub 1.9.3: ajustes objetivos apontados pelo Performance Advisor.
-- Execute depois de 26_cron_automacoes_1_9_3.sql.

begin;

create index if not exists automacoes_estabelecimento_idx
  on public.automacoes_mensagens(estabelecimento_id);
create index if not exists automacoes_cliente_idx
  on public.automacoes_mensagens(cliente_id)
  where cliente_id is not null;
create index if not exists cupons_criado_por_idx
  on public.cupons(criado_por);
create index if not exists fidelidade_movimentos_cliente_id_idx
  on public.fidelidade_movimentos(cliente_id);

-- As politicas de gerenciamento anteriores eram FOR ALL e, por isso,
-- duplicavam a politica de SELECT. A separacao abaixo preserva as mesmas
-- condicoes para escrita sem executar duas politicas permissivas na leitura.
drop policy if exists fidelidade_programas_manage on public.fidelidade_programas;
drop policy if exists fidelidade_programas_insert on public.fidelidade_programas;
drop policy if exists fidelidade_programas_update on public.fidelidade_programas;
drop policy if exists fidelidade_programas_delete on public.fidelidade_programas;

create policy fidelidade_programas_insert on public.fidelidade_programas
for insert to authenticated
with check (
  private.tem_recurso_193(estabelecimento_id, 'permite_fidelidade')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);

create policy fidelidade_programas_update on public.fidelidade_programas
for update to authenticated
using (
  private.tem_recurso_193(estabelecimento_id, 'permite_fidelidade')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
)
with check (
  private.tem_recurso_193(estabelecimento_id, 'permite_fidelidade')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);

create policy fidelidade_programas_delete on public.fidelidade_programas
for delete to authenticated
using (
  private.tem_recurso_193(estabelecimento_id, 'permite_fidelidade')
  and private.pode_operar_estabelecimento_19(
    estabelecimento_id,
    array['proprietario','gerente','admin']::text[]
  )
);

drop policy if exists fidelidade_recompensas_manage on public.fidelidade_recompensas;
drop policy if exists fidelidade_recompensas_insert on public.fidelidade_recompensas;
drop policy if exists fidelidade_recompensas_update on public.fidelidade_recompensas;
drop policy if exists fidelidade_recompensas_delete on public.fidelidade_recompensas;

create policy fidelidade_recompensas_insert on public.fidelidade_recompensas
for insert to authenticated
with check (exists (
  select 1
  from public.fidelidade_programas p
  where p.id = fidelidade_recompensas.programa_id
    and private.tem_recurso_193(p.estabelecimento_id, 'permite_fidelidade')
    and private.pode_operar_estabelecimento_19(
      p.estabelecimento_id,
      array['proprietario','gerente','admin']::text[]
    )
));

create policy fidelidade_recompensas_update on public.fidelidade_recompensas
for update to authenticated
using (exists (
  select 1
  from public.fidelidade_programas p
  where p.id = fidelidade_recompensas.programa_id
    and private.tem_recurso_193(p.estabelecimento_id, 'permite_fidelidade')
    and private.pode_operar_estabelecimento_19(
      p.estabelecimento_id,
      array['proprietario','gerente','admin']::text[]
    )
))
with check (exists (
  select 1
  from public.fidelidade_programas p
  where p.id = fidelidade_recompensas.programa_id
    and private.tem_recurso_193(p.estabelecimento_id, 'permite_fidelidade')
    and private.pode_operar_estabelecimento_19(
      p.estabelecimento_id,
      array['proprietario','gerente','admin']::text[]
    )
));

create policy fidelidade_recompensas_delete on public.fidelidade_recompensas
for delete to authenticated
using (exists (
  select 1
  from public.fidelidade_programas p
  where p.id = fidelidade_recompensas.programa_id
    and private.tem_recurso_193(p.estabelecimento_id, 'permite_fidelidade')
    and private.pode_operar_estabelecimento_19(
      p.estabelecimento_id,
      array['proprietario','gerente','admin']::text[]
    )
));

drop policy if exists metas_manage_gestao on public.metas_crescimento;
drop policy if exists metas_insert_gestao on public.metas_crescimento;
drop policy if exists metas_update_gestao on public.metas_crescimento;
drop policy if exists metas_delete_gestao on public.metas_crescimento;

create policy metas_insert_gestao on public.metas_crescimento
for insert to authenticated
with check (
  private.tem_recurso_193(estabelecimento_id, 'permite_metas')
  and private.pode_executar_acao_193(estabelecimento_id, 'metas')
  and (
    profissional_id is null
    or exists (
      select 1
      from public.profissionais p
      where p.id = metas_crescimento.profissional_id
        and p.estabelecimento_id = metas_crescimento.estabelecimento_id
    )
  )
);

create policy metas_update_gestao on public.metas_crescimento
for update to authenticated
using (
  private.tem_recurso_193(estabelecimento_id, 'permite_metas')
  and private.pode_executar_acao_193(estabelecimento_id, 'metas')
)
with check (
  private.tem_recurso_193(estabelecimento_id, 'permite_metas')
  and private.pode_executar_acao_193(estabelecimento_id, 'metas')
  and (
    profissional_id is null
    or exists (
      select 1
      from public.profissionais p
      where p.id = metas_crescimento.profissional_id
        and p.estabelecimento_id = metas_crescimento.estabelecimento_id
    )
  )
);

create policy metas_delete_gestao on public.metas_crescimento
for delete to authenticated
using (
  private.tem_recurso_193(estabelecimento_id, 'permite_metas')
  and private.pode_executar_acao_193(estabelecimento_id, 'metas')
);

commit;
