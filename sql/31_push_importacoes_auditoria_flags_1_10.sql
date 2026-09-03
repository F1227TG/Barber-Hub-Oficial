-- Barber Hub 1.10.0: push opt-in, importações, auditoria operacional e feature flags.
-- Execute depois de 30_localizacao_biblioteca_marketplace_1_10.sql.

begin;

-- ============================================================
-- 1. FEATURE FLAGS COM KILL SWITCH E ALVOS CONTROLADOS
-- ============================================================

create table if not exists public.feature_flags (
  id uuid primary key default gen_random_uuid(),
  chave text not null unique check (chave ~ '^[a-z0-9][a-z0-9_.-]{1,79}$'),
  nome text not null check (char_length(trim(nome)) between 2 and 120),
  descricao text not null default '',
  habilitada_padrao boolean not null default false,
  kill_switch boolean not null default false,
  experimental boolean not null default true,
  updated_by uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.feature_flag_alvos (
  id uuid primary key default gen_random_uuid(),
  feature_flag_id uuid not null references public.feature_flags(id) on delete cascade,
  estabelecimento_id uuid references public.estabelecimentos(id) on delete cascade,
  user_id uuid references public.perfis(id) on delete cascade,
  plano_slug text,
  cidade text,
  estado char(2),
  habilitada boolean not null,
  expira_em timestamptz,
  definido_por uuid references public.perfis(id) on delete set null,
  created_at timestamptz not null default now(),
  check (num_nonnulls(estabelecimento_id,user_id,plano_slug,cidade) = 1),
  check (estado is null or estado ~ '^[A-Z]{2}$')
);

create index if not exists feature_flag_alvos_flag_idx
  on public.feature_flag_alvos(feature_flag_id, habilitada, expira_em);
create index if not exists feature_flag_alvos_estabelecimento_idx
  on public.feature_flag_alvos(estabelecimento_id, feature_flag_id) where estabelecimento_id is not null;
create index if not exists feature_flag_alvos_user_idx
  on public.feature_flag_alvos(user_id, feature_flag_id) where user_id is not null;

drop trigger if exists feature_flags_updated_at on public.feature_flags;
create trigger feature_flags_updated_at before update on public.feature_flags
for each row execute function public.set_updated_at();

insert into public.feature_flags(chave,nome,descricao,habilitada_padrao,experimental)
values
 ('operacao.atendimento_manual','Atendimento manual','Registro rápido de atendimentos de balcão, WhatsApp, telefone e outros canais.',true,false),
 ('operacao.multiplos_periodos','Múltiplos períodos','Mais de um intervalo de funcionamento por dia.',true,false),
 ('financeiro.despesas','Gastos e resultado','Registro de gastos e cálculo de resultado estimado por período.',true,false),
 ('marketplace.regional','Marketplace regional','Distância, raio e descoberta por região.',true,false),
 ('perfil.biblioteca_capas','Biblioteca de capas','Capas oficiais reutilizáveis do Barber Hub.',true,false),
 ('dados.importacao','Importação de dados','Prévia e importação segura de clientes e serviços.',true,false),
 ('notificacoes.web_push','Notificações no dispositivo','Web Push com autorização explícita e fallback interno.',true,true),
 ('operacao.auditoria','Auditoria operacional','Histórico autorizado das mudanças operacionais.',true,false)
on conflict (chave) do update set nome=excluded.nome, descricao=excluded.descricao;

alter table public.feature_flags enable row level security;
alter table public.feature_flag_alvos enable row level security;
drop policy if exists feature_flags_select_auth_110 on public.feature_flags;
drop policy if exists feature_flags_admin_110 on public.feature_flags;
create policy feature_flags_admin_110 on public.feature_flags for all to authenticated
using (public.is_admin()) with check (public.is_admin());
drop policy if exists feature_flag_alvos_select_110 on public.feature_flag_alvos;
drop policy if exists feature_flag_alvos_admin_110 on public.feature_flag_alvos;
create policy feature_flag_alvos_admin_110 on public.feature_flag_alvos for all to authenticated
using (public.is_admin()) with check (public.is_admin());
revoke all on public.feature_flags, public.feature_flag_alvos from public, anon, authenticated;
grant select,insert,update,delete on public.feature_flags, public.feature_flag_alvos to authenticated;

create or replace function public.avaliar_feature_flags_110(
  p_chaves text[], p_estabelecimento_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare v_resultado jsonb := '{}'::jsonb; v_chave text; v_flag record;
  v_user uuid := (select auth.uid()); v_plano text; v_cidade text; v_estado text; v_valor boolean;
begin
  if coalesce(cardinality(p_chaves),0) < 1 or cardinality(p_chaves) > 50 then
    raise exception 'Informe entre 1 e 50 funcionalidades.';
  end if;
  if p_estabelecimento_id is not null then
    if not public.is_admin() and not private.pode_operar_estabelecimento_19(p_estabelecimento_id) then
      raise exception 'Sua conta não pode avaliar funcionalidades deste estabelecimento.';
    end if;
    select e.cidade,e.estado,coalesce(p.slug,'gratuito')
      into v_cidade,v_estado,v_plano
    from public.estabelecimentos e
    left join public.assinaturas a on a.estabelecimento_id=e.id and a.status in ('ativa','trial')
    left join public.planos p on p.id=a.plano_id
    where e.id=p_estabelecimento_id;
  end if;
  foreach v_chave in array p_chaves loop
    if v_chave !~ '^[a-z0-9][a-z0-9_.-]{1,79}$' then raise exception 'Chave de funcionalidade inválida.'; end if;
    select f.* into v_flag from public.feature_flags f where f.chave=v_chave;
    if not found or v_flag.kill_switch then
      v_resultado := v_resultado || jsonb_build_object(v_chave,false);
      continue;
    end if;
    v_valor := v_flag.habilitada_padrao;
    select a.habilitada into v_valor
    from public.feature_flag_alvos a
    where a.feature_flag_id=v_flag.id and (a.expira_em is null or a.expira_em>now())
      and (
        (v_user is not null and a.user_id=v_user)
        or (p_estabelecimento_id is not null and a.estabelecimento_id=p_estabelecimento_id)
        or (v_plano is not null and a.plano_slug=v_plano)
        or (v_cidade is not null and lower(a.cidade)=lower(v_cidade) and (a.estado is null or a.estado=v_estado))
      )
    order by
      (a.user_id is not null)::int desc,
      (a.estabelecimento_id is not null)::int desc,
      (a.plano_slug is not null)::int desc,
      a.created_at desc
    limit 1;
    v_resultado := v_resultado || jsonb_build_object(v_chave,coalesce(v_valor,v_flag.habilitada_padrao));
  end loop;
  return v_resultado;
end;
$$;
revoke all on function public.avaliar_feature_flags_110(text[],uuid) from public, anon;
grant execute on function public.avaliar_feature_flags_110(text[],uuid) to authenticated, service_role;

-- ============================================================
-- 2. WEB PUSH: ASSINATURAS, PREFERÊNCIAS E FILA
-- ============================================================

create table if not exists public.push_assinaturas (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfis(id) on delete cascade,
  estabelecimento_id uuid references public.estabelecimentos(id) on delete cascade,
  endpoint text not null check (endpoint like 'https://%' and char_length(endpoint)<=2048),
  endpoint_hash text not null unique check (endpoint_hash ~ '^[0-9a-f]{64}$'),
  p256dh text not null check (char_length(p256dh) between 16 and 512),
  auth_secret text not null check (char_length(auth_secret) between 8 and 256),
  expiracao timestamptz,
  user_agent text,
  ativa boolean not null default true,
  ultimo_sucesso_em timestamptz,
  ultima_falha_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.push_preferencias (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references public.perfis(id) on delete cascade,
  estabelecimento_id uuid references public.estabelecimentos(id) on delete cascade,
  agendamentos boolean not null default true,
  confirmacoes boolean not null default true,
  cancelamentos boolean not null default true,
  lembretes boolean not null default true,
  lista_espera boolean not null default true,
  oportunidades boolean not null default false,
  campanhas boolean not null default false,
  horario_silencioso_inicio time,
  horario_silencioso_fim time,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((horario_silencioso_inicio is null)=(horario_silencioso_fim is null))
);
create unique index if not exists push_preferencias_escopo_unique_idx
  on public.push_preferencias(user_id,coalesce(estabelecimento_id,'00000000-0000-0000-0000-000000000000'::uuid));

create table if not exists public.push_entregas (
  id uuid primary key default gen_random_uuid(),
  notificacao_id uuid not null references public.notificacoes(id) on delete cascade,
  assinatura_id uuid not null references public.push_assinaturas(id) on delete cascade,
  user_id uuid not null references public.perfis(id) on delete cascade,
  status text not null default 'pendente' check (status in ('pendente','processando','enviada','falhou','descartada')),
  tentativas smallint not null default 0 check (tentativas between 0 and 10),
  proxima_tentativa_em timestamptz not null default now(),
  erro_codigo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique(notificacao_id,assinatura_id)
);
create index if not exists push_entregas_pendentes_idx
  on public.push_entregas(status,proxima_tentativa_em,id) where status in ('pendente','falhou');
create index if not exists push_assinaturas_user_ativas_idx on public.push_assinaturas(user_id,ativa,id);

drop trigger if exists push_assinaturas_updated_at on public.push_assinaturas;
create trigger push_assinaturas_updated_at before update on public.push_assinaturas for each row execute function public.set_updated_at();
drop trigger if exists push_preferencias_updated_at on public.push_preferencias;
create trigger push_preferencias_updated_at before update on public.push_preferencias for each row execute function public.set_updated_at();
drop trigger if exists push_entregas_updated_at on public.push_entregas;
create trigger push_entregas_updated_at before update on public.push_entregas for each row execute function public.set_updated_at();

alter table public.push_assinaturas enable row level security;
alter table public.push_preferencias enable row level security;
alter table public.push_entregas enable row level security;
drop policy if exists push_assinaturas_proprias_110 on public.push_assinaturas;
create policy push_assinaturas_proprias_110 on public.push_assinaturas for all to authenticated
using (user_id=(select auth.uid()) or public.is_admin())
with check (user_id=(select auth.uid()) or public.is_admin());
drop policy if exists push_preferencias_proprias_110 on public.push_preferencias;
create policy push_preferencias_proprias_110 on public.push_preferencias for all to authenticated
using (user_id=(select auth.uid()) or public.is_admin())
with check (user_id=(select auth.uid()) or public.is_admin());
drop policy if exists push_entregas_proprias_110 on public.push_entregas;
create policy push_entregas_proprias_110 on public.push_entregas for select to authenticated
using (user_id=(select auth.uid()) or public.is_admin());
revoke all on public.push_assinaturas,public.push_preferencias,public.push_entregas from public,anon,authenticated;
grant select,insert,update,delete on public.push_assinaturas,public.push_preferencias to authenticated;
grant select on public.push_entregas to authenticated;

create or replace function private.enfileirar_push_110()
returns trigger language plpgsql security definer set search_path='' as $$
begin
  insert into public.push_entregas(notificacao_id,assinatura_id,user_id)
  select new.id,a.id,new.user_id
  from public.push_assinaturas a
  left join public.push_preferencias p on p.user_id=a.user_id
    and p.estabelecimento_id is not distinct from a.estabelecimento_id
  where a.user_id=new.user_id and a.ativa and (a.expiracao is null or a.expiracao>now())
    and case
      when new.tipo='agendamento' and lower(new.titulo) like '%cancel%' then coalesce(p.cancelamentos,true)
      when new.tipo='agendamento' and lower(new.titulo) like '%confirm%' then coalesce(p.confirmacoes,true)
      when new.tipo='agendamento' then coalesce(p.agendamentos,true)
      when new.tipo='sistema' and lower(new.titulo) like '%lembrete%' then coalesce(p.lembretes,true)
      else true
    end
  on conflict(notificacao_id,assinatura_id) do nothing;
  return new;
end;
$$;
drop trigger if exists notificacoes_enfileirar_push_110 on public.notificacoes;
create trigger notificacoes_enfileirar_push_110 after insert on public.notificacoes
for each row execute function private.enfileirar_push_110();
revoke all on function private.enfileirar_push_110() from public,anon,authenticated;

-- ============================================================
-- 3. IMPORTAÇÃO SEGURA COM PRÉVIA E RELATÓRIO
-- ============================================================

create table if not exists public.importacoes_operacionais (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid not null references public.estabelecimentos(id) on delete cascade,
  solicitado_por uuid references public.perfis(id) on delete set null,
  tipo text not null check (tipo in ('clientes','servicos')),
  arquivo_nome text not null check (char_length(arquivo_nome) between 5 and 180),
  formato text not null check (formato in ('csv','xlsx')),
  conteudo_hash text not null check (conteudo_hash ~ '^[0-9a-f]{64}$'),
  status text not null default 'previa' check (status in ('previa','processando','concluida','falhou','cancelada')),
  total_linhas integer not null default 0 check (total_linhas between 0 and 5000),
  validas integer not null default 0 check (validas between 0 and 5000),
  rejeitadas integer not null default 0 check (rejeitadas between 0 and 5000),
  importadas integer not null default 0 check (importadas between 0 and 5000),
  ignoradas integer not null default 0 check (ignoradas between 0 and 5000),
  relatorio jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  processada_em timestamptz,
  unique(estabelecimento_id,tipo,conteudo_hash)
);

-- O histórico da importação permanece, mas deixa de identificar a pessoa
-- quando a conta é excluída. Isso evita bloquear o fluxo de exclusão de conta.
alter table public.importacoes_operacionais alter column solicitado_por drop not null;
alter table public.importacoes_operacionais
  drop constraint if exists importacoes_operacionais_solicitado_por_fkey;
alter table public.importacoes_operacionais
  add constraint importacoes_operacionais_solicitado_por_fkey
  foreign key (solicitado_por) references public.perfis(id) on delete set null;

create table if not exists public.importacao_linhas (
  id uuid primary key default gen_random_uuid(),
  importacao_id uuid not null references public.importacoes_operacionais(id) on delete cascade,
  numero_linha integer not null check (numero_linha between 2 and 5001),
  status text not null check (status in ('valida','rejeitada','importada','ignorada')),
  dados jsonb not null default '{}'::jsonb,
  erros text[] not null default '{}'::text[],
  destino_id uuid,
  created_at timestamptz not null default now(),
  unique(importacao_id,numero_linha),
  check (jsonb_typeof(dados)='object')
);
create index if not exists importacoes_estabelecimento_created_idx
  on public.importacoes_operacionais(estabelecimento_id,created_at desc,id);
create index if not exists importacao_linhas_job_status_idx
  on public.importacao_linhas(importacao_id,status,numero_linha);

alter table public.importacoes_operacionais enable row level security;
alter table public.importacao_linhas enable row level security;
drop policy if exists importacoes_select_110 on public.importacoes_operacionais;
create policy importacoes_select_110 on public.importacoes_operacionais for select to authenticated
using (private.pode_executar_acao_193(estabelecimento_id,'configuracoes'));
drop policy if exists importacoes_insert_110 on public.importacoes_operacionais;
create policy importacoes_insert_110 on public.importacoes_operacionais for insert to authenticated
with check (solicitado_por=(select auth.uid()) and private.pode_executar_acao_193(estabelecimento_id,'configuracoes'));
drop policy if exists importacoes_update_110 on public.importacoes_operacionais;
create policy importacoes_update_110 on public.importacoes_operacionais for update to authenticated
using (solicitado_por=(select auth.uid()) and status='previa')
with check (solicitado_por=(select auth.uid()));
drop policy if exists importacao_linhas_select_110 on public.importacao_linhas;
create policy importacao_linhas_select_110 on public.importacao_linhas for select to authenticated
using (exists(select 1 from public.importacoes_operacionais i where i.id=importacao_id
  and private.pode_executar_acao_193(i.estabelecimento_id,'configuracoes')));
drop policy if exists importacao_linhas_insert_110 on public.importacao_linhas;
create policy importacao_linhas_insert_110 on public.importacao_linhas for insert to authenticated
with check (exists(select 1 from public.importacoes_operacionais i where i.id=importacao_id
  and i.solicitado_por=(select auth.uid()) and i.status='previa'));
revoke all on public.importacoes_operacionais,public.importacao_linhas from public,anon,authenticated;
grant select,insert,update on public.importacoes_operacionais to authenticated;
grant select,insert on public.importacao_linhas to authenticated;

create or replace function public.confirmar_importacao_110(p_importacao_id uuid)
returns jsonb language plpgsql security definer set search_path='' as $$
declare v_job public.importacoes_operacionais%rowtype; v_linha record; v_destino uuid;
  v_importadas integer:=0; v_ignoradas integer:=0;
begin
  select * into v_job from public.importacoes_operacionais where id=p_importacao_id for update;
  if not found or v_job.solicitado_por is distinct from (select auth.uid()) then
    raise exception 'Importação não encontrada.';
  end if;
  if v_job.status='concluida' then return v_job.relatorio; end if;
  if v_job.status<>'previa' then raise exception 'Esta importação não pode ser confirmada.'; end if;
  if not private.pode_executar_acao_193(v_job.estabelecimento_id,'configuracoes') then
    raise exception 'Sua conta não pode importar dados.';
  end if;
  update public.importacoes_operacionais set status='processando' where id=v_job.id;
  for v_linha in select * from public.importacao_linhas
    where importacao_id=v_job.id and status='valida' order by numero_linha for update
  loop
    v_destino:=null;
    if v_job.tipo='clientes' then
      select c.id into v_destino from public.clientes_estabelecimento c
      where c.estabelecimento_id=v_job.estabelecimento_id and (
        (nullif(lower(v_linha.dados->>'email'),'') is not null and c.email_normalizado=lower(v_linha.dados->>'email'))
        or (nullif(regexp_replace(v_linha.dados->>'telefone','[^0-9]','','g'),'') is not null
          and regexp_replace(coalesce(c.telefone,''),'[^0-9]','','g')=regexp_replace(v_linha.dados->>'telefone','[^0-9]','','g'))
      ) limit 1;
      if v_destino is null then
        insert into public.clientes_estabelecimento(estabelecimento_id,nome,email,email_normalizado,telefone,segmento)
        values(v_job.estabelecimento_id,trim(v_linha.dados->>'nome'),nullif(lower(v_linha.dados->>'email'),''),
          nullif(lower(v_linha.dados->>'email'),''),nullif(regexp_replace(v_linha.dados->>'telefone','[^0-9]','','g'),''),'lead')
        returning id into v_destino;
      end if;
    else
      select s.id into v_destino from public.servicos s
      where s.estabelecimento_id=v_job.estabelecimento_id
        and lower(s.nome)=lower(v_linha.dados->>'nome')
        and lower(s.categoria)=lower(coalesce(nullif(v_linha.dados->>'categoria',''),'Serviço')) limit 1;
      if v_destino is null then
        insert into public.servicos(estabelecimento_id,nome,categoria,descricao,preco,duracao_min,ativo,publico)
        values(v_job.estabelecimento_id,trim(v_linha.dados->>'nome'),coalesce(nullif(trim(v_linha.dados->>'categoria'),''),'Serviço'),
          coalesce(v_linha.dados->>'descricao',''),(v_linha.dados->>'preco')::numeric,
          (v_linha.dados->>'duracao_min')::integer,true,true) returning id into v_destino;
      end if;
    end if;
    if v_destino is null then
      update public.importacao_linhas set status='ignorada' where id=v_linha.id;
      v_ignoradas:=v_ignoradas+1;
    elsif exists(select 1 from public.importacao_linhas x where x.id=v_linha.id and x.destino_id is not null) then
      update public.importacao_linhas set status='ignorada' where id=v_linha.id;
      v_ignoradas:=v_ignoradas+1;
    else
      update public.importacao_linhas set status=case when v_destino is not null then 'importada' else 'ignorada' end,
        destino_id=v_destino where id=v_linha.id;
      -- Se o destino já existia, nada foi sobrescrito; ele é contado como ignorado.
      if (v_job.tipo='clientes' and exists(select 1 from public.clientes_estabelecimento c where c.id=v_destino and c.created_at < v_job.created_at))
         or (v_job.tipo='servicos' and exists(select 1 from public.servicos s where s.id=v_destino and s.created_at < v_job.created_at)) then
        update public.importacao_linhas set status='ignorada' where id=v_linha.id;
        v_ignoradas:=v_ignoradas+1;
      else v_importadas:=v_importadas+1; end if;
    end if;
  end loop;
  update public.importacoes_operacionais set status='concluida',processada_em=now(),
    importadas=v_importadas,ignoradas=v_ignoradas,
    relatorio=jsonb_build_object('importadas',v_importadas,'ignoradas',v_ignoradas,'rejeitadas',rejeitadas,'total',total_linhas)
  where id=v_job.id returning relatorio into v_job.relatorio;
  return v_job.relatorio;
exception when others then
  update public.importacoes_operacionais set status='falhou',processada_em=now(),
    relatorio=jsonb_build_object('erro','A importação não pôde ser concluída.') where id=p_importacao_id;
  return jsonb_build_object('status','falhou','erro','A importação não pôde ser concluída.');
end;
$$;
revoke all on function public.confirmar_importacao_110(uuid) from public,anon;
grant execute on function public.confirmar_importacao_110(uuid) to authenticated,service_role;

-- ============================================================
-- 4. AUDITORIA OPERACIONAL IMUTÁVEL E SEM SEGREDOS
-- ============================================================

create table if not exists public.auditoria_operacional (
  id uuid primary key default gen_random_uuid(),
  estabelecimento_id uuid references public.estabelecimentos(id) on delete set null,
  ator_id uuid references public.perfis(id) on delete set null,
  recurso text not null check (recurso in ('agenda','financeiro','horarios','fechamento','importacao','configuracao')),
  acao text not null check (char_length(acao) between 2 and 80),
  entidade text not null check (char_length(entidade) between 2 and 80),
  entidade_id uuid,
  dados_anteriores jsonb,
  dados_novos jsonb,
  motivo text,
  request_id text,
  created_at timestamptz not null default now()
);

-- A trilha é preservada de forma anônima quando o estabelecimento ou o ator
-- é excluído. Cascatas não devem apagar evidências nem impedir a exclusão.
alter table public.auditoria_operacional alter column estabelecimento_id drop not null;
alter table public.auditoria_operacional
  drop constraint if exists auditoria_operacional_estabelecimento_id_fkey;
alter table public.auditoria_operacional
  add constraint auditoria_operacional_estabelecimento_id_fkey
  foreign key (estabelecimento_id) references public.estabelecimentos(id) on delete set null;
create index if not exists auditoria_operacional_estabelecimento_created_idx
  on public.auditoria_operacional(estabelecimento_id,created_at desc,id desc);
create index if not exists auditoria_operacional_entidade_idx
  on public.auditoria_operacional(entidade,entidade_id,created_at desc) where entidade_id is not null;
alter table public.auditoria_operacional enable row level security;
drop policy if exists auditoria_operacional_select_110 on public.auditoria_operacional;
create policy auditoria_operacional_select_110 on public.auditoria_operacional for select to authenticated
using (public.is_admin() or private.pode_executar_acao_193(estabelecimento_id,
  case when recurso='financeiro' or recurso='fechamento' then 'financeiro' else 'configuracoes' end));
revoke all on public.auditoria_operacional from public,anon,authenticated;
grant select on public.auditoria_operacional to authenticated;

create or replace function private.auditar_operacao_110()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_est uuid; v_id uuid; v_antes jsonb; v_depois jsonb; v_recurso text; v_acao text;
begin
  v_est:=coalesce(new.estabelecimento_id,old.estabelecimento_id);
  v_id:=coalesce(new.id,old.id);
  v_acao:=lower(tg_op);
  if tg_table_name='agendamentos' then
    v_recurso:='agenda';
    v_antes:=case when tg_op='INSERT' then null else jsonb_build_object('status',old.status,'data',old.data,'hora_inicio',old.hora_inicio,'hora_fim',old.hora_fim,'valor',old.valor,'forma_pagamento',old.forma_pagamento,'canal_origem',old.canal_origem) end;
    v_depois:=case when tg_op='DELETE' then null else jsonb_build_object('status',new.status,'data',new.data,'hora_inicio',new.hora_inicio,'hora_fim',new.hora_fim,'valor',new.valor,'forma_pagamento',new.forma_pagamento,'canal_origem',new.canal_origem) end;
  elsif tg_table_name='lancamentos_financeiros' then
    v_recurso:='financeiro';
    v_antes:=case when tg_op='INSERT' then null else jsonb_build_object('tipo',old.tipo,'natureza',old.natureza,'status',old.status,'valor_liquido',old.valor_liquido,'categoria',old.categoria,'forma_pagamento',old.forma_pagamento) end;
    v_depois:=case when tg_op='DELETE' then null else jsonb_build_object('tipo',new.tipo,'natureza',new.natureza,'status',new.status,'valor_liquido',new.valor_liquido,'categoria',new.categoria,'forma_pagamento',new.forma_pagamento) end;
  elsif tg_table_name='fechamentos_diarios' then
    v_recurso:='fechamento';
    v_antes:=case when tg_op='INSERT' then null else jsonb_build_object('data',old.data,'status',old.status,'receita_liquida',old.receita_liquida,'ajustes_debito',old.ajustes_debito,'comissoes',old.comissoes) end;
    v_depois:=case when tg_op='DELETE' then null else jsonb_build_object('data',new.data,'status',new.status,'receita_liquida',new.receita_liquida,'ajustes_debito',new.ajustes_debito,'comissoes',new.comissoes) end;
  elsif tg_table_name='estabelecimento_horario_periodos' then
    v_recurso:='horarios';
    v_antes:=case when tg_op='INSERT' then null else jsonb_build_object('dia_semana',old.dia_semana,'abre',old.abre,'fecha',old.fecha,'fecha_dia_seguinte',old.fecha_dia_seguinte,'ativo',old.ativo) end;
    v_depois:=case when tg_op='DELETE' then null else jsonb_build_object('dia_semana',new.dia_semana,'abre',new.abre,'fecha',new.fecha,'fecha_dia_seguinte',new.fecha_dia_seguinte,'ativo',new.ativo) end;
  else return coalesce(new,old); end if;
  if tg_op='UPDATE' and v_antes=v_depois then return new; end if;
  insert into public.auditoria_operacional(estabelecimento_id,ator_id,recurso,acao,entidade,entidade_id,dados_anteriores,dados_novos,motivo,request_id)
  values(v_est,(select auth.uid()),v_recurso,v_acao,tg_table_name,v_id,v_antes,v_depois,
    coalesce(to_jsonb(new)->>'motivo',to_jsonb(new)->>'cancelamento_motivo',to_jsonb(old)->>'motivo',to_jsonb(old)->>'cancelamento_motivo'),
    nullif(nullif(current_setting('request.headers',true),'')::jsonb->>'x-request-id',''));
  return coalesce(new,old);
end;
$$;

drop trigger if exists agendamentos_auditoria_110 on public.agendamentos;
create trigger agendamentos_auditoria_110 after insert or update or delete on public.agendamentos
for each row execute function private.auditar_operacao_110();
drop trigger if exists lancamentos_auditoria_110 on public.lancamentos_financeiros;
create trigger lancamentos_auditoria_110 after insert or update or delete on public.lancamentos_financeiros
for each row execute function private.auditar_operacao_110();
drop trigger if exists fechamentos_auditoria_110 on public.fechamentos_diarios;
create trigger fechamentos_auditoria_110 after insert or update or delete on public.fechamentos_diarios
for each row execute function private.auditar_operacao_110();
drop trigger if exists horario_periodos_auditoria_110 on public.estabelecimento_horario_periodos;
create trigger horario_periodos_auditoria_110 after insert or update or delete on public.estabelecimento_horario_periodos
for each row execute function private.auditar_operacao_110();
revoke all on function private.auditar_operacao_110() from public,anon,authenticated;

-- Auditoria é append-only inclusive para administradores; retenção/exclusão
-- deve ocorrer apenas por rotina controlada de backend, nunca pelo navegador.
create or replace function private.bloquear_mutacao_auditoria_110()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='UPDATE'
     and (new.estabelecimento_id is not distinct from old.estabelecimento_id
       or (old.estabelecimento_id is not null and new.estabelecimento_id is null))
     and (new.ator_id is not distinct from old.ator_id
       or (old.ator_id is not null and new.ator_id is null))
     and (to_jsonb(new)-'estabelecimento_id'-'ator_id')
       = (to_jsonb(old)-'estabelecimento_id'-'ator_id')
     and (new.estabelecimento_id is distinct from old.estabelecimento_id
       or new.ator_id is distinct from old.ator_id) then
    -- Única mutação permitida: anonimização automática de chaves estrangeiras.
    return new;
  end if;
  raise exception 'O histórico operacional é imutável.';
end; $$;
drop trigger if exists auditoria_operacional_imutavel_110 on public.auditoria_operacional;
create trigger auditoria_operacional_imutavel_110 before update or delete on public.auditoria_operacional
for each row execute function private.bloquear_mutacao_auditoria_110();
revoke all on function private.bloquear_mutacao_auditoria_110() from public,anon,authenticated;

-- Completa a paginação por cursor do CRM para clientes ainda sem visita.
-- O cursor usa o id mesmo quando a última visita é nula, evitando repetir a página.
create or replace function public.listar_clientes_crm_19(
  p_estabelecimento_id uuid,
  p_busca text default null,
  p_segmento text default null,
  p_cursor_ultima timestamptz default null,
  p_cursor_id uuid default null,
  p_limite integer default 30
)
returns table (
  id uuid, cliente_id uuid, nome text, email text, telefone text, segmento text,
  total_agendamentos integer, visitas_concluidas integer, cancelamentos integer,
  faltas integer, gasto_total numeric, ticket_medio numeric,
  ultima_visita_em timestamptz, proxima_visita_em timestamptz,
  profissional_preferido text, servico_preferido text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not private.tem_recurso_operacional_19(p_estabelecimento_id, 'permite_crm')
     or not private.pode_operar_estabelecimento_19(p_estabelecimento_id) then
    raise exception 'Sua conta não pode acessar este CRM.';
  end if;
  return query
  select
    c.id, c.cliente_id, c.nome, c.email, c.telefone, c.segmento,
    c.total_agendamentos, c.visitas_concluidas, c.cancelamentos, c.faltas,
    c.gasto_total,
    case when c.visitas_concluidas > 0 then round(c.gasto_total / c.visitas_concluidas, 2) else 0 end,
    c.ultima_visita_em, c.proxima_visita_em, p.nome, s.nome
  from public.clientes_estabelecimento c
  left join public.profissionais p on p.id = c.profissional_preferido_id
  left join public.servicos s on s.id = c.servico_preferido_id
  where c.estabelecimento_id = p_estabelecimento_id
    and (p_segmento is null or p_segmento = '' or c.segmento = p_segmento)
    and (
      p_busca is null or trim(p_busca) = ''
      or c.nome ilike '%' || trim(p_busca) || '%'
      or coalesce(c.email, '') ilike '%' || trim(p_busca) || '%'
      or coalesce(c.telefone, '') ilike '%' || trim(p_busca) || '%'
    )
    and (
      p_cursor_id is null
      or (coalesce(c.ultima_visita_em, '-infinity'::timestamptz), c.id)
         < (coalesce(p_cursor_ultima, '-infinity'::timestamptz), p_cursor_id)
    )
  order by c.ultima_visita_em desc nulls last, c.id desc
  limit greatest(1, least(coalesce(p_limite, 30), 60));
end;
$$;
revoke all on function public.listar_clientes_crm_19(uuid,text,text,timestamptz,uuid,integer) from public,anon;
grant execute on function public.listar_clientes_crm_19(uuid,text,text,timestamptz,uuid,integer) to authenticated,service_role;

commit;
