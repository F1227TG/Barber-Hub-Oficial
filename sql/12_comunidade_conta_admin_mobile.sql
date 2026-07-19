-- Barber Hub 1.3.0
-- Comunidade, avaliações verificadas, redes sociais, exclusão de conta e controles administrativos.

-- ============================================================
-- PERFIS: impede elevação de privilégio pelo próprio usuário
-- ============================================================
create or replace function public.proteger_campos_sensiveis_perfil()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if auth.uid() is not null and not public.is_admin() then
    if new.tipo is distinct from old.tipo
       or new.ativo is distinct from old.ativo
       or new.onboarding_concluido is distinct from old.onboarding_concluido then
      raise exception 'Você não pode alterar nível de acesso ou status da própria conta.';
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists perfis_proteger_campos_sensiveis on public.perfis;
create trigger perfis_proteger_campos_sensiveis
before update on public.perfis
for each row execute function public.proteger_campos_sensiveis_perfil();

revoke all on function public.proteger_campos_sensiveis_perfil() from public, anon, authenticated;

-- ============================================================
-- ESTABELECIMENTOS: redes sociais, verificação e moderação
-- ============================================================
alter table public.estabelecimentos add column if not exists tiktok text;
alter table public.estabelecimentos add column if not exists verificado boolean not null default false;
alter table public.estabelecimentos add column if not exists verificado_em timestamptz;
alter table public.estabelecimentos add column if not exists verificado_por uuid references public.perfis(id) on delete set null;
alter table public.estabelecimentos add column if not exists destaque boolean not null default false;
alter table public.estabelecimentos add column if not exists suspenso_motivo text;

create index if not exists estabelecimentos_verificado_idx
on public.estabelecimentos(verificado, destaque, visivel);

-- ============================================================
-- AVALIAÇÕES VERIFICADAS
-- Só existe avaliação quando há atendimento concluído.
-- ============================================================
create table if not exists public.avaliacoes (
  id uuid primary key default gen_random_uuid(),
  agendamento_id uuid not null unique references public.agendamentos(id) on delete cascade,
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  cliente_id uuid references public.perfis(id) on delete set null,
  nota smallint not null check (nota between 1 and 5),
  comentario text not null default '' check (char_length(comentario) <= 1200),
  resposta_estabelecimento text check (char_length(resposta_estabelecimento) <= 1200),
  respondido_em timestamptz,
  status text not null default 'publicada' check (status in ('publicada','em_analise','ocultada')),
  motivo_moderacao text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists avaliacoes_estabelecimento_idx
on public.avaliacoes(estabelecimento_id, status, created_at desc);
create index if not exists avaliacoes_cliente_idx
on public.avaliacoes(cliente_id, created_at desc);

create or replace function public.validar_avaliacao_verificada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_agendamento public.agendamentos%rowtype;
  v_admin boolean := public.is_admin();
  v_owner boolean;
begin
  select * into v_agendamento from public.agendamentos where id = new.agendamento_id;
  if not found then raise exception 'Agendamento não encontrado.'; end if;

  if tg_op = 'INSERT' then
    if v_agendamento.status <> 'concluido' then
      raise exception 'Somente atendimentos concluídos podem ser avaliados.';
    end if;
    if v_agendamento.cliente_id is distinct from auth.uid() and not v_admin then
      raise exception 'Você só pode avaliar seus próprios atendimentos.';
    end if;
    new.cliente_id := v_agendamento.cliente_id;
    new.estabelecimento_id := v_agendamento.estabelecimento_id;
    new.status := 'publicada';
  else
    v_owner := public.owns_estabelecimento(old.estabelecimento_id);
    if not v_admin and auth.uid() = old.cliente_id then
      new.agendamento_id := old.agendamento_id;
      new.estabelecimento_id := old.estabelecimento_id;
      new.cliente_id := old.cliente_id;
      new.resposta_estabelecimento := old.resposta_estabelecimento;
      new.respondido_em := old.respondido_em;
      new.status := old.status;
      new.motivo_moderacao := old.motivo_moderacao;
    elsif not v_admin and v_owner then
      new.agendamento_id := old.agendamento_id;
      new.estabelecimento_id := old.estabelecimento_id;
      new.cliente_id := old.cliente_id;
      new.nota := old.nota;
      new.comentario := old.comentario;
      new.status := old.status;
      new.motivo_moderacao := old.motivo_moderacao;
      if new.resposta_estabelecimento is distinct from old.resposta_estabelecimento then
        new.respondido_em := case when nullif(trim(new.resposta_estabelecimento), '') is null then null else now() end;
      end if;
    elsif not v_admin then
      raise exception 'Você não pode alterar esta avaliação.';
    end if;
  end if;

  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists avaliacoes_validar on public.avaliacoes;
create trigger avaliacoes_validar
before insert or update on public.avaliacoes
for each row execute function public.validar_avaliacao_verificada();

create or replace function public.recalcular_avaliacao_estabelecimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_estabelecimento uuid := coalesce(new.estabelecimento_id, old.estabelecimento_id);
begin
  update public.estabelecimentos
  set avaliacao = coalesce((
    select round(avg(nota)::numeric, 1)
    from public.avaliacoes
    where estabelecimento_id = v_estabelecimento and status = 'publicada'
  ), 0)
  where id = v_estabelecimento;
  return coalesce(new, old);
end;
$$;

drop trigger if exists avaliacoes_recalcular_media on public.avaliacoes;
create trigger avaliacoes_recalcular_media
after insert or update or delete on public.avaliacoes
for each row execute function public.recalcular_avaliacao_estabelecimento();

alter table public.avaliacoes enable row level security;

drop policy if exists avaliacoes_select_publico on public.avaliacoes;
create policy avaliacoes_select_publico on public.avaliacoes
for select to anon, authenticated
using (
  status = 'publicada'
  or cliente_id = auth.uid()
  or public.owns_estabelecimento(estabelecimento_id)
  or public.is_admin()
);

drop policy if exists avaliacoes_insert_cliente on public.avaliacoes;
create policy avaliacoes_insert_cliente on public.avaliacoes
for insert to authenticated
with check (cliente_id = auth.uid() or cliente_id is null);

drop policy if exists avaliacoes_update_partes_admin on public.avaliacoes;
create policy avaliacoes_update_partes_admin on public.avaliacoes
for update to authenticated
using (
  cliente_id = auth.uid()
  or public.owns_estabelecimento(estabelecimento_id)
  or public.is_admin()
)
with check (
  cliente_id = auth.uid()
  or public.owns_estabelecimento(estabelecimento_id)
  or public.is_admin()
);

drop policy if exists avaliacoes_delete_cliente_admin on public.avaliacoes;
create policy avaliacoes_delete_cliente_admin on public.avaliacoes
for delete to authenticated
using (cliente_id = auth.uid() or public.is_admin());

grant select on public.avaliacoes to anon, authenticated;
grant insert, update, delete on public.avaliacoes to authenticated;
revoke all on function public.validar_avaliacao_verificada() from public, anon, authenticated;
revoke all on function public.recalcular_avaliacao_estabelecimento() from public, anon, authenticated;

-- Notificações das avaliações, quando o módulo já estiver instalado.
create or replace function public.notificar_avaliacao_verificada()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
begin
  select owner_id into v_owner from public.estabelecimentos where id = new.estabelecimento_id;

  if tg_op = 'INSERT' and v_owner is not null then
    perform public.criar_notificacao_interna(
      v_owner, 'avaliacao', 'Nova avaliação verificada',
      'Um atendimento concluído recebeu uma nova avaliação.',
      'html/painel.html#avaliacoes', jsonb_build_object('avaliacao_id', new.id)
    );
  elsif tg_op = 'UPDATE'
    and new.resposta_estabelecimento is distinct from old.resposta_estabelecimento
    and new.cliente_id is not null then
    perform public.criar_notificacao_interna(
      new.cliente_id, 'avaliacao', 'A barbearia respondeu sua avaliação',
      'Abra seu histórico para visualizar a resposta.',
      'html/cliente.html#avaliacoes', jsonb_build_object('avaliacao_id', new.id)
    );
  end if;
  return new;
exception when undefined_function then
  return new;
end;
$$;

drop trigger if exists avaliacoes_notificar on public.avaliacoes;
create trigger avaliacoes_notificar
after insert or update on public.avaliacoes
for each row execute function public.notificar_avaliacao_verificada();
revoke all on function public.notificar_avaliacao_verificada() from public, anon, authenticated;

-- ============================================================
-- EXCLUSÃO DA PRÓPRIA CONTA
-- Mantém registros operacionais antigos anonimizados quando necessário.
-- ============================================================
alter table public.agendamentos alter column cliente_id drop not null;
alter table public.agendamentos drop constraint if exists agendamentos_cliente_id_fkey;
alter table public.agendamentos
  add constraint agendamentos_cliente_id_fkey
  foreign key (cliente_id) references public.perfis(id) on delete set null;

create or replace function public.excluir_minha_conta()
returns void
language plpgsql
security definer
set search_path = public, auth, storage
as $$
declare
  v_uid uuid := auth.uid();
  v_tipo text;
  v_admins integer;
begin
  if v_uid is null then raise exception 'Sessão inválida.'; end if;
  select tipo into v_tipo from public.perfis where id = v_uid;
  if v_tipo is null then raise exception 'Perfil não encontrado.'; end if;

  if v_tipo = 'admin' then
    select count(*) into v_admins from public.perfis where tipo = 'admin' and ativo = true;
    if v_admins <= 1 then
      raise exception 'O último administrador ativo não pode excluir a própria conta.';
    end if;
  end if;

  if v_tipo = 'cliente' then
    update public.agendamentos
    set cliente_nome = 'Conta excluída',
        cliente_email = 'conta-excluida@barberhub.local',
        cliente_telefone = null,
        observacao = null
    where cliente_id = v_uid;
  end if;

  delete from storage.objects
  where bucket_id = 'barberhub-public'
    and (owner_id::text = v_uid::text or name like v_uid::text || '/%');

  delete from auth.users where id = v_uid;
end;
$$;

revoke all on function public.excluir_minha_conta() from public, anon;
grant execute on function public.excluir_minha_conta() to authenticated;

-- ============================================================
-- REALTIME
-- ============================================================
do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'avaliacoes'
  ) then
    alter publication supabase_realtime add table public.avaliacoes;
  end if;
end $$;
