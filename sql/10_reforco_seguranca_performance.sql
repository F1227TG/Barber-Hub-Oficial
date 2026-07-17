-- Barber Hub 1.1: reforço de segurança e pequenos índices do portfólio.
-- Execute após o arquivo 09.

-- O bucket é público para leitura por URL, então uma policy SELECT ampla não é
-- necessária e permitiria listar todos os nomes de arquivos pela API.
drop policy if exists barberhub_storage_public_read on storage.objects;

-- Funções usadas exclusivamente por triggers não devem ficar expostas como RPC.
revoke all on function public.atualizar_contador_curtidas() from public, anon, authenticated;
revoke all on function public.notificar_agendamento() from public, anon, authenticated;
revoke all on function public.notificar_ticket_suporte() from public, anon, authenticated;
revoke all on function public.validar_portfolio_publicacao() from public, anon, authenticated;
revoke all on function public.validar_portfolio_midia() from public, anon, authenticated;
revoke all on function public.notificar_denuncia_portfolio() from public, anon, authenticated;
revoke all on function public.notificar_resultado_moderacao() from public, anon, authenticated;
revoke all on function public.notificar_autor_denuncia() from public, anon, authenticated;

-- Índices para chaves estrangeiras e telas de administração/filtro.
create index if not exists portfolio_publicacoes_autor_id_idx
  on public.portfolio_publicacoes(autor_id);
create index if not exists portfolio_publicacoes_profissional_id_idx
  on public.portfolio_publicacoes(profissional_id);
create index if not exists portfolio_publicacoes_servico_id_idx
  on public.portfolio_publicacoes(servico_id);
create index if not exists portfolio_denuncias_user_id_idx
  on public.portfolio_denuncias(user_id);
create index if not exists portfolio_denuncias_status_idx
  on public.portfolio_denuncias(status, created_at desc);

-- Remove uma policy ALL que também concorria com a policy SELECT e separa
-- as operações de escrita. A leitura permanece na policy própria.
drop policy if exists portfolio_midias_owner_manage on public.portfolio_midias;
drop policy if exists portfolio_midias_owner_insert on public.portfolio_midias;
drop policy if exists portfolio_midias_owner_update on public.portfolio_midias;
drop policy if exists portfolio_midias_owner_delete on public.portfolio_midias;

create policy portfolio_midias_owner_insert on public.portfolio_midias
for insert to authenticated
with check (exists (
  select 1 from public.portfolio_publicacoes p
  where p.id = publicacao_id
    and (public.owns_estabelecimento(p.estabelecimento_id) or public.is_admin())
));

create policy portfolio_midias_owner_update on public.portfolio_midias
for update to authenticated
using (exists (
  select 1 from public.portfolio_publicacoes p
  where p.id = publicacao_id
    and (public.owns_estabelecimento(p.estabelecimento_id) or public.is_admin())
))
with check (exists (
  select 1 from public.portfolio_publicacoes p
  where p.id = publicacao_id
    and (public.owns_estabelecimento(p.estabelecimento_id) or public.is_admin())
));

create policy portfolio_midias_owner_delete on public.portfolio_midias
for delete to authenticated
using (exists (
  select 1 from public.portfolio_publicacoes p
  where p.id = publicacao_id
    and (public.owns_estabelecimento(p.estabelecimento_id) or public.is_admin())
));

-- Evita reavaliar auth.uid() a cada linha nas políticas mais acessadas da
-- atualização 1.1.
drop policy if exists notificacoes_select_proprio on public.notificacoes;
create policy notificacoes_select_proprio on public.notificacoes
for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists notificacoes_update_proprio on public.notificacoes;
create policy notificacoes_update_proprio on public.notificacoes
for update to authenticated
using (user_id = (select auth.uid()) or public.is_admin())
with check (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists notificacoes_delete_proprio on public.notificacoes;
create policy notificacoes_delete_proprio on public.notificacoes
for delete to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists portfolio_curtidas_select_proprio on public.portfolio_curtidas;
create policy portfolio_curtidas_select_proprio on public.portfolio_curtidas
for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists portfolio_curtidas_insert_proprio on public.portfolio_curtidas;
create policy portfolio_curtidas_insert_proprio on public.portfolio_curtidas
for insert to authenticated
with check (
  user_id = (select auth.uid())
  and exists (
    select 1 from public.perfis p
    where p.id = (select auth.uid())
      and p.ativo
      and p.created_at <= now() - interval '7 days'
  )
  and exists (
    select 1
    from public.portfolio_publicacoes pub
    join public.estabelecimentos e on e.id = pub.estabelecimento_id
    where pub.id = publicacao_id
      and pub.status = 'publicada'
      and e.owner_id <> (select auth.uid())
  )
);

drop policy if exists portfolio_curtidas_delete_proprio on public.portfolio_curtidas;
create policy portfolio_curtidas_delete_proprio on public.portfolio_curtidas
for delete to authenticated
using (user_id = (select auth.uid()) or public.is_admin());

drop policy if exists portfolio_denuncias_insert_proprio on public.portfolio_denuncias;
create policy portfolio_denuncias_insert_proprio on public.portfolio_denuncias
for insert to authenticated
with check (user_id = (select auth.uid()));

drop policy if exists portfolio_denuncias_select_proprio_admin on public.portfolio_denuncias;
create policy portfolio_denuncias_select_proprio_admin on public.portfolio_denuncias
for select to authenticated
using (user_id = (select auth.uid()) or public.is_admin());
