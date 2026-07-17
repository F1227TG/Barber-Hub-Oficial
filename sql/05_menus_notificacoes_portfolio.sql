-- Barber Hub 1.1: notificações persistentes, badges e portfólio público.

-- ============================================================
-- NOTIFICAÇÕES
-- ============================================================
create table if not exists public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfis(id) on delete cascade,
  tipo text not null default 'sistema' check (tipo in ('agendamento','avaliacao','suporte','portfolio','sistema')),
  titulo text not null check (char_length(titulo) between 1 and 100),
  mensagem text not null check (char_length(mensagem) between 1 and 500),
  url text,
  dados jsonb not null default '{}'::jsonb,
  lida_em timestamptz,
  created_at timestamptz not null default now()
);
create index if not exists notificacoes_user_nao_lida_idx on public.notificacoes(user_id,lida_em,created_at desc);

alter table public.notificacoes enable row level security;
drop policy if exists notificacoes_select_proprio on public.notificacoes;
create policy notificacoes_select_proprio on public.notificacoes
for select to authenticated
using (user_id = auth.uid() or public.is_admin());
drop policy if exists notificacoes_update_proprio on public.notificacoes;
create policy notificacoes_update_proprio on public.notificacoes
for update to authenticated
using (user_id = auth.uid() or public.is_admin())
with check (user_id = auth.uid() or public.is_admin());
drop policy if exists notificacoes_delete_proprio on public.notificacoes;
create policy notificacoes_delete_proprio on public.notificacoes
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

grant select,update,delete on public.notificacoes to authenticated;
revoke insert on public.notificacoes from anon,authenticated;

create or replace function public.criar_notificacao_interna(
  p_user_id uuid,
  p_tipo text,
  p_titulo text,
  p_mensagem text,
  p_url text default null,
  p_dados jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  if p_user_id is null then return null; end if;
  insert into public.notificacoes(user_id,tipo,titulo,mensagem,url,dados)
  values (p_user_id,p_tipo,p_titulo,p_mensagem,p_url,coalesce(p_dados,'{}'::jsonb))
  returning id into v_id;
  return v_id;
end;
$$;
revoke all on function public.criar_notificacao_interna(uuid,text,text,text,text,jsonb) from public,anon,authenticated;

create or replace function public.notificar_agendamento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_owner uuid;
  v_est_nome text;
  v_servico text;
  v_status_label text;
begin
  select e.owner_id,e.nome into v_owner,v_est_nome
  from public.estabelecimentos e where e.id = new.estabelecimento_id;
  select s.nome into v_servico from public.servicos s where s.id = new.servico_id;

  if tg_op = 'INSERT' then
    perform public.criar_notificacao_interna(
      v_owner,'agendamento','Novo agendamento recebido',
      coalesce(new.cliente_nome,'Um cliente') || ' solicitou ' || coalesce(v_servico,'um serviço') ||
      ' para ' || to_char(new.data,'DD/MM/YYYY') || ' às ' || to_char(new.hora_inicio,'HH24:MI') || '.',
      'html/painel.html#agenda',jsonb_build_object('agendamento_id',new.id,'estabelecimento_id',new.estabelecimento_id)
    );
    perform public.criar_notificacao_interna(
      new.cliente_id,'agendamento','Agendamento enviado',
      'Sua solicitação para ' || coalesce(v_est_nome,'o estabelecimento') || ' foi registrada e aguarda confirmação.',
      'html/cliente.html',jsonb_build_object('agendamento_id',new.id)
    );
  elsif old.status is distinct from new.status then
    v_status_label := case new.status
      when 'confirmado' then 'confirmado'
      when 'concluido' then 'concluído'
      when 'cancelado' then 'cancelado'
      when 'recusado' then 'recusado'
      else new.status end;
    perform public.criar_notificacao_interna(
      new.cliente_id,'agendamento','Agendamento ' || v_status_label,
      'Seu agendamento em ' || coalesce(v_est_nome,'um estabelecimento') || ' foi ' || v_status_label || '.',
      'html/cliente.html',jsonb_build_object('agendamento_id',new.id,'status',new.status)
    );
    if new.status = 'cancelado' then
      perform public.criar_notificacao_interna(
        v_owner,'agendamento','Agendamento cancelado',
        coalesce(new.cliente_nome,'Um cliente') || ' cancelou o atendimento de ' || to_char(new.data,'DD/MM/YYYY') || '.',
        'html/painel.html#agenda',jsonb_build_object('agendamento_id',new.id)
      );
    end if;
  end if;
  return new;
end;
$$;

drop trigger if exists agendamentos_notificar on public.agendamentos;
create trigger agendamentos_notificar
after insert or update of status on public.agendamentos
for each row execute function public.notificar_agendamento();

create or replace function public.notificar_ticket_suporte()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
begin
  if new.user_id is not null and (
    old.status is distinct from new.status or old.resposta is distinct from new.resposta
  ) then
    perform public.criar_notificacao_interna(
      new.user_id,'suporte','Atualização no suporte',
      'O ticket “' || new.assunto || '” recebeu uma atualização.',
      'html/conta.html',jsonb_build_object('ticket_id',new.id,'status',new.status)
    );
  end if;
  return new;
end;
$$;
drop trigger if exists tickets_notificar on public.tickets_suporte;
create trigger tickets_notificar
after update of status,resposta on public.tickets_suporte
for each row execute function public.notificar_ticket_suporte();

-- ============================================================
-- PORTFÓLIO / GALERIA
-- ============================================================
create table if not exists public.portfolio_publicacoes (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  autor_id uuid not null default auth.uid() references public.perfis(id) on delete cascade,
  profissional_id uuid references public.profissionais(id) on delete set null,
  servico_id uuid references public.servicos(id) on delete set null,
  titulo varchar(80) not null,
  descricao varchar(500) not null default '',
  categoria text not null check (categoria in (
    'Corte masculino','Barba','Corte e barba','Degradê / Fade','Freestyle / Desenho',
    'Tratamento capilar','Corte infantil','Antes e depois','Outros'
  )),
  tags text[] not null default '{}',
  modo text not null default 'galeria' check (modo in ('galeria','antes_depois')),
  status text not null default 'rascunho' check (status in ('rascunho','publicada','arquivada','ocultada')),
  destaque boolean not null default false,
  capa_ordem smallint not null default 1 check (capa_ordem between 1 and 5),
  data_trabalho date,
  confirmou_autorizacao boolean not null default false,
  possui_menor boolean not null default false,
  confirmou_responsavel boolean not null default false,
  autorizado_em timestamptz,
  curtidas_count integer not null default 0 check (curtidas_count >= 0),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(tags) <= 5)
);
create index if not exists portfolio_publicacoes_estabelecimento_idx
  on public.portfolio_publicacoes(estabelecimento_id,status,created_at desc);
create index if not exists portfolio_publicacoes_destaque_idx
  on public.portfolio_publicacoes(estabelecimento_id,destaque) where destaque = true;

drop trigger if exists portfolio_publicacoes_updated_at on public.portfolio_publicacoes;
create trigger portfolio_publicacoes_updated_at
before update on public.portfolio_publicacoes
for each row execute function public.set_updated_at();

create table if not exists public.portfolio_midias (
  id uuid primary key default gen_random_uuid(),
  publicacao_id uuid not null references public.portfolio_publicacoes(id) on delete cascade,
  storage_path text not null,
  public_url text not null,
  ordem smallint not null check (ordem between 1 and 5),
  tipo text not null default 'normal' check (tipo in ('normal','antes','depois')),
  texto_alternativo varchar(180) not null default '',
  created_at timestamptz not null default now(),
  unique(publicacao_id,ordem),
  unique(storage_path)
);
create index if not exists portfolio_midias_publicacao_idx on public.portfolio_midias(publicacao_id,ordem);

create table if not exists public.portfolio_curtidas (
  publicacao_id uuid not null references public.portfolio_publicacoes(id) on delete cascade,
  user_id uuid not null references public.perfis(id) on delete cascade,
  created_at timestamptz not null default now(),
  primary key(publicacao_id,user_id)
);
create index if not exists portfolio_curtidas_user_idx on public.portfolio_curtidas(user_id,created_at desc);

create table if not exists public.portfolio_denuncias (
  id uuid primary key default gen_random_uuid(),
  publicacao_id uuid not null references public.portfolio_publicacoes(id) on delete cascade,
  user_id uuid not null references public.perfis(id) on delete cascade,
  motivo text not null check (motivo in ('imagem_sem_autorizacao','conteudo_inadequado','informacao_falsa','spam','outro')),
  detalhes varchar(500),
  status text not null default 'aberta' check (status in ('aberta','analisando','resolvida','rejeitada')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(publicacao_id,user_id)
);
drop trigger if exists portfolio_denuncias_updated_at on public.portfolio_denuncias;
create trigger portfolio_denuncias_updated_at
before update on public.portfolio_denuncias
for each row execute function public.set_updated_at();

create or replace function public.validar_portfolio_publicacao()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_total integer;
  v_destaques integer;
  v_midias integer;
begin
  if new.autor_id is null then new.autor_id := auth.uid(); end if;

  if not public.is_admin() then
    if auth.uid() is null or new.autor_id <> auth.uid() or not public.owns_estabelecimento(new.estabelecimento_id) then
      raise exception 'Somente o proprietário pode gerenciar esta galeria.';
    end if;
  end if;

  if tg_op = 'INSERT' then
    select count(*) into v_total from public.portfolio_publicacoes
    where estabelecimento_id = new.estabelecimento_id;
    if v_total >= 50 then
      raise exception 'O limite inicial de 50 publicações foi atingido.';
    end if;
  end if;

  new.tags := coalesce((select array_agg(distinct left(trim(tag),30))
    from unnest(coalesce(new.tags,'{}')) tag where nullif(trim(tag),'') is not null),'{}');
  if cardinality(new.tags) > 5 then raise exception 'Use no máximo 5 tags.'; end if;

  if new.destaque then
    select count(*) into v_destaques from public.portfolio_publicacoes
    where estabelecimento_id = new.estabelecimento_id and destaque = true and id <> new.id;
    if v_destaques >= 3 then raise exception 'É permitido destacar no máximo 3 trabalhos.'; end if;
  end if;

  if new.status = 'publicada' then
    if not new.confirmou_autorizacao then
      raise exception 'Confirme a autorização de uso das imagens antes de publicar.';
    end if;
    if new.possui_menor and not new.confirmou_responsavel then
      raise exception 'Confirme a autorização do responsável legal.';
    end if;
    select count(*) into v_midias from public.portfolio_midias where publicacao_id = new.id;
    if v_midias < 1 then raise exception 'Adicione pelo menos uma imagem antes de publicar.'; end if;
    if new.modo = 'antes_depois' and v_midias < 2 then
      raise exception 'O modo antes e depois precisa de pelo menos duas imagens.';
    end if;
    new.autorizado_em := coalesce(new.autorizado_em,now());
  end if;
  return new;
end;
$$;
drop trigger if exists portfolio_publicacoes_validar on public.portfolio_publicacoes;
create trigger portfolio_publicacoes_validar
before insert or update on public.portfolio_publicacoes
for each row execute function public.validar_portfolio_publicacao();

create or replace function public.validar_portfolio_midia()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_total integer; v_est uuid;
begin
  select estabelecimento_id into v_est from public.portfolio_publicacoes where id = new.publicacao_id;
  if v_est is null then raise exception 'Publicação não encontrada.'; end if;
  if not public.is_admin() and not public.owns_estabelecimento(v_est) then
    raise exception 'Você não pode alterar estas imagens.';
  end if;
  select count(*) into v_total from public.portfolio_midias where publicacao_id = new.publicacao_id and id <> new.id;
  if v_total >= 5 then raise exception 'Use no máximo 5 imagens por publicação.'; end if;
  return new;
end;
$$;
drop trigger if exists portfolio_midias_validar on public.portfolio_midias;
create trigger portfolio_midias_validar
before insert or update on public.portfolio_midias
for each row execute function public.validar_portfolio_midia();

create or replace function public.atualizar_contador_curtidas()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare v_id uuid;
begin
  v_id := coalesce(new.publicacao_id,old.publicacao_id);
  update public.portfolio_publicacoes p
  set curtidas_count = (select count(*) from public.portfolio_curtidas c where c.publicacao_id = v_id)
  where p.id = v_id;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;
drop trigger if exists portfolio_curtidas_contador on public.portfolio_curtidas;
create trigger portfolio_curtidas_contador
after insert or delete on public.portfolio_curtidas
for each row execute function public.atualizar_contador_curtidas();

-- RLS
alter table public.portfolio_publicacoes enable row level security;
alter table public.portfolio_midias enable row level security;
alter table public.portfolio_curtidas enable row level security;
alter table public.portfolio_denuncias enable row level security;

-- Publicações: visitantes veem apenas as publicadas.
drop policy if exists portfolio_publicacoes_visitante on public.portfolio_publicacoes;
create policy portfolio_publicacoes_visitante on public.portfolio_publicacoes
for select to anon
using (status = 'publicada' and exists (
  select 1 from public.estabelecimentos e
  where e.id = estabelecimento_id and e.visivel and e.onboarding_concluido
));
drop policy if exists portfolio_publicacoes_autenticado on public.portfolio_publicacoes;
create policy portfolio_publicacoes_autenticado on public.portfolio_publicacoes
for select to authenticated
using (
  (status = 'publicada' and exists (
    select 1 from public.estabelecimentos e
    where e.id = estabelecimento_id and e.visivel and e.onboarding_concluido
  )) or public.owns_estabelecimento(estabelecimento_id) or public.is_admin()
);
drop policy if exists portfolio_publicacoes_owner_insert on public.portfolio_publicacoes;
create policy portfolio_publicacoes_owner_insert on public.portfolio_publicacoes
for insert to authenticated
with check ((autor_id = auth.uid() and public.owns_estabelecimento(estabelecimento_id)) or public.is_admin());
drop policy if exists portfolio_publicacoes_owner_update on public.portfolio_publicacoes;
create policy portfolio_publicacoes_owner_update on public.portfolio_publicacoes
for update to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin())
with check ((autor_id = auth.uid() and public.owns_estabelecimento(estabelecimento_id)) or public.is_admin());
drop policy if exists portfolio_publicacoes_owner_delete on public.portfolio_publicacoes;
create policy portfolio_publicacoes_owner_delete on public.portfolio_publicacoes
for delete to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());

-- Mídias seguem a visibilidade da publicação.
drop policy if exists portfolio_midias_visitante on public.portfolio_midias;
create policy portfolio_midias_visitante on public.portfolio_midias
for select to anon
using (exists (
  select 1 from public.portfolio_publicacoes p join public.estabelecimentos e on e.id=p.estabelecimento_id
  where p.id=publicacao_id and p.status='publicada' and e.visivel and e.onboarding_concluido
));
drop policy if exists portfolio_midias_autenticado on public.portfolio_midias;
create policy portfolio_midias_autenticado on public.portfolio_midias
for select to authenticated
using (exists (
  select 1 from public.portfolio_publicacoes p join public.estabelecimentos e on e.id=p.estabelecimento_id
  where p.id=publicacao_id and ((p.status='publicada' and e.visivel and e.onboarding_concluido)
    or public.owns_estabelecimento(p.estabelecimento_id) or public.is_admin())
));
drop policy if exists portfolio_midias_owner_manage on public.portfolio_midias;
create policy portfolio_midias_owner_manage on public.portfolio_midias
for all to authenticated
using (exists (select 1 from public.portfolio_publicacoes p where p.id=publicacao_id and (public.owns_estabelecimento(p.estabelecimento_id) or public.is_admin())))
with check (exists (select 1 from public.portfolio_publicacoes p where p.id=publicacao_id and (public.owns_estabelecimento(p.estabelecimento_id) or public.is_admin())));

-- Curtidas: leitura somente da própria linha; contagem fica na publicação.
drop policy if exists portfolio_curtidas_select_proprio on public.portfolio_curtidas;
create policy portfolio_curtidas_select_proprio on public.portfolio_curtidas
for select to authenticated
using (user_id = auth.uid() or public.is_admin());
drop policy if exists portfolio_curtidas_insert_proprio on public.portfolio_curtidas;
create policy portfolio_curtidas_insert_proprio on public.portfolio_curtidas
for insert to authenticated
with check (
  user_id = auth.uid()
  and exists (select 1 from public.perfis p where p.id=auth.uid() and p.ativo and p.created_at <= now() - interval '7 days')
  and exists (select 1 from public.portfolio_publicacoes pub join public.estabelecimentos e on e.id=pub.estabelecimento_id
    where pub.id=publicacao_id and pub.status='publicada' and e.owner_id <> auth.uid())
);
drop policy if exists portfolio_curtidas_delete_proprio on public.portfolio_curtidas;
create policy portfolio_curtidas_delete_proprio on public.portfolio_curtidas
for delete to authenticated
using (user_id = auth.uid() or public.is_admin());

-- Denúncias.
drop policy if exists portfolio_denuncias_insert_proprio on public.portfolio_denuncias;
create policy portfolio_denuncias_insert_proprio on public.portfolio_denuncias
for insert to authenticated
with check (user_id = auth.uid());
drop policy if exists portfolio_denuncias_select_proprio_admin on public.portfolio_denuncias;
create policy portfolio_denuncias_select_proprio_admin on public.portfolio_denuncias
for select to authenticated
using (user_id = auth.uid() or public.is_admin());
drop policy if exists portfolio_denuncias_update_admin on public.portfolio_denuncias;
create policy portfolio_denuncias_update_admin on public.portfolio_denuncias
for update to authenticated
using (public.is_admin()) with check (public.is_admin());

-- Permissões Data API
grant select on public.portfolio_publicacoes,public.portfolio_midias to anon,authenticated;
grant insert,update,delete on public.portfolio_publicacoes,public.portfolio_midias to authenticated;
grant select,insert,delete on public.portfolio_curtidas to authenticated;
grant select,insert,update on public.portfolio_denuncias to authenticated;

-- Realtime para badges e telas abertas.
do $$
begin
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='notificacoes') then
    alter publication supabase_realtime add table public.notificacoes;
  end if;
  if not exists (select 1 from pg_publication_tables where pubname='supabase_realtime' and schemaname='public' and tablename='portfolio_publicacoes') then
    alter publication supabase_realtime add table public.portfolio_publicacoes;
  end if;
end $$;
