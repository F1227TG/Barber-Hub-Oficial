-- Barber Hub 1.2: estrutura inicial de planos e assinaturas.
-- Execute após o arquivo 10.

create table if not exists public.planos (
  id uuid primary key default gen_random_uuid(),
  slug text not null unique,
  nome text not null,
  descricao text,
  preco_semanal numeric(10,2) not null default 0,
  preco_mensal numeric(10,2) not null default 0,
  limite_profissionais integer not null default 1,
  limite_publicacoes integer not null default 10,
  permite_agenda boolean not null default false,
  permite_relatorios boolean not null default false,
  permite_equipe boolean not null default false,
  destaque boolean not null default false,
  recursos jsonb not null default '[]'::jsonb,
  ativo boolean not null default true,
  ordenacao smallint not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

drop trigger if exists planos_updated_at on public.planos;
create trigger planos_updated_at
before update on public.planos
for each row execute function public.set_updated_at();

create table if not exists public.assinaturas (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null unique references public.estabelecimentos(id) on delete cascade,
  plano_id uuid not null references public.planos(id),
  status text not null default 'teste' check (status in ('teste','ativa','atrasada','pausada','cancelada','expirada')),
  inicio_em date not null default current_date,
  teste_termina_em date,
  periodo_atual_inicio date,
  periodo_atual_fim date,
  cancelar_ao_final boolean not null default false,
  provedor text,
  referencia_externa text,
  observacoes text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists assinaturas_plano_id_idx on public.assinaturas(plano_id);
create index if not exists assinaturas_status_idx on public.assinaturas(status, periodo_atual_fim);

drop trigger if exists assinaturas_updated_at on public.assinaturas;
create trigger assinaturas_updated_at
before update on public.assinaturas
for each row execute function public.set_updated_at();

insert into public.planos (
  slug,nome,descricao,preco_semanal,preco_mensal,limite_profissionais,limite_publicacoes,
  permite_agenda,permite_relatorios,permite_equipe,destaque,recursos,ordenacao
) values
(
  'gratuito','Perfil gratuito','Presença básica no portal para começar a divulgar a barbearia.',0,0,1,10,
  false,false,false,false,
  '["Página pública","Horários e contatos","Status aberto/fechado","Até 10 publicações","1 profissional"]'::jsonb,1
),
(
  'essencial','Essencial','Plano para barbeiros autônomos com agenda e gestão inicial.',15,49,1,50,
  true,true,false,true,
  '["Agenda online","Histórico de clientes","Até 50 publicações","Relatório semanal","Notificações"]'::jsonb,2
),
(
  'profissional','Profissional','Gestão para pequenas equipes com relatórios e comissão.',29,89,3,150,
  true,true,true,false,
  '["Até 3 profissionais","Relatórios por profissional","Comissões e metas","Até 150 publicações"]'::jsonb,3
),
(
  'elite','Elite','Plano futuro para unidades maiores e recursos avançados.',45,129,10,500,
  true,true,true,false,
  '["Múltiplas unidades","Estoque","Automações","Personalização visual","Destaque máximo no portal"]'::jsonb,4
)
on conflict (slug) do update set
  nome = excluded.nome,
  descricao = excluded.descricao,
  preco_semanal = excluded.preco_semanal,
  preco_mensal = excluded.preco_mensal,
  limite_profissionais = excluded.limite_profissionais,
  limite_publicacoes = excluded.limite_publicacoes,
  permite_agenda = excluded.permite_agenda,
  permite_relatorios = excluded.permite_relatorios,
  permite_equipe = excluded.permite_equipe,
  destaque = excluded.destaque,
  recursos = excluded.recursos,
  ativo = true,
  ordenacao = excluded.ordenacao;

create or replace function public.criar_assinatura_padrao_estabelecimento()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_plano_gratuito uuid;
begin
  select id into v_plano_gratuito from public.planos where slug = 'gratuito' limit 1;
  if v_plano_gratuito is null then
    return new;
  end if;

  insert into public.assinaturas (
    estabelecimento_id,
    plano_id,
    status,
    inicio_em,
    teste_termina_em,
    periodo_atual_inicio,
    periodo_atual_fim,
    observacoes
  ) values (
    new.id,
    v_plano_gratuito,
    'teste',
    current_date,
    current_date + interval '90 days',
    current_date,
    current_date + interval '90 days',
    'Assinatura criada automaticamente no perfil gratuito.'
  )
  on conflict (estabelecimento_id) do nothing;

  return new;
end;
$$;

revoke all on function public.criar_assinatura_padrao_estabelecimento() from public, anon, authenticated;

drop trigger if exists estabelecimentos_assinatura_padrao on public.estabelecimentos;
create trigger estabelecimentos_assinatura_padrao
after insert on public.estabelecimentos
for each row execute function public.criar_assinatura_padrao_estabelecimento();

-- Assinaturas padrão para estabelecimentos já existentes.
insert into public.assinaturas (
  estabelecimento_id,
  plano_id,
  status,
  inicio_em,
  teste_termina_em,
  periodo_atual_inicio,
  periodo_atual_fim,
  observacoes
)
select e.id,
       p.id,
       'teste',
       current_date,
       current_date + interval '90 days',
       current_date,
       current_date + interval '90 days',
       'Assinatura gratuita criada na atualização 1.2.'
from public.estabelecimentos e
cross join lateral (select id from public.planos where slug='gratuito' limit 1) p
left join public.assinaturas a on a.estabelecimento_id = e.id
where a.id is null;

alter table public.planos enable row level security;
alter table public.assinaturas enable row level security;

drop policy if exists planos_select_publico on public.planos;
create policy planos_select_publico on public.planos
for select to anon, authenticated
using (ativo = true or public.is_admin());

drop policy if exists planos_manage_admin on public.planos;
create policy planos_manage_admin on public.planos
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

drop policy if exists assinaturas_select_owner_admin on public.assinaturas;
create policy assinaturas_select_owner_admin on public.assinaturas
for select to authenticated
using (public.owns_estabelecimento(estabelecimento_id) or public.is_admin());

drop policy if exists assinaturas_manage_admin on public.assinaturas;
create policy assinaturas_manage_admin on public.assinaturas
for all to authenticated
using (public.is_admin())
with check (public.is_admin());

grant select on public.planos to anon, authenticated;
grant select on public.assinaturas to authenticated;
grant insert, update, delete on public.assinaturas to authenticated;
