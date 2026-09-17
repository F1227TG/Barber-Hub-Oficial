-- Agenda online básica gratuita e catálogo comercial em validação.
-- Não altera preços nem interrompe atribuições manuais do administrador.

begin;

alter table public.planos
  add column if not exists estado_comercial text not null default 'desenvolvimento'
  check (estado_comercial in ('desenvolvimento','ativo','pausado'));

update public.planos
set
  estado_comercial = 'desenvolvimento',
  permite_agenda = case when slug = 'gratuito' then true else permite_agenda end,
  descricao = case
    when slug = 'gratuito' then 'Presença no portal e agenda online básica para começar a atender clientes.'
    else descricao
  end,
  recursos = case
    when slug = 'gratuito' then
      '["Página pública","Horários e contatos","Status aberto/fechado","Avaliações e reputação","Até 10 publicações","1 profissional","Agenda online básica"]'::jsonb
    else recursos
  end;

-- O estabelecimento nasce com a agenda desligada. Depois do onboarding, a
-- decisão do barbeiro é respeitada inclusive no plano Gratuito; o banco ainda
-- verifica o entitlement efetivo em qualquer plano futuro.
create or replace function private.validar_estabelecimento_agenda_plano_1112()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_entitlements jsonb;
begin
  if tg_op = 'INSERT' then
    new.aceita_agendamento := false;
    return new;
  end if;

  if coalesce(new.aceita_agendamento, false)
     and old.aceita_agendamento is distinct from true then
    v_entitlements := public.calcular_entitlements_estabelecimento(new.id);
    if not coalesce((v_entitlements->>'permite_agenda')::boolean, false) then
      raise exception 'A agenda online não está disponível na configuração atual.';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function private.validar_estabelecimento_agenda_plano_1112() from public,anon,authenticated;

drop trigger if exists estabelecimentos_validar_agenda_plano on public.estabelecimentos;
create trigger estabelecimentos_validar_agenda_plano
before insert or update of aceita_agendamento on public.estabelecimentos
for each row execute function private.validar_estabelecimento_agenda_plano_1112();

-- Defesa em profundidade: uma inserção direta nunca pode criar agendamento
-- quando o barbeiro desligou a agenda, mesmo que o plano a permita.
create or replace function public.validar_agendamento_plano()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  v_ent jsonb;
  v_est public.estabelecimentos%rowtype;
begin
  select * into v_est
  from public.estabelecimentos
  where id = new.estabelecimento_id;

  if not found
     or not v_est.visivel
     or not v_est.onboarding_concluido
     or v_est.suspenso_pela_moderacao then
    raise exception 'Estabelecimento indisponível para agendamentos.';
  end if;

  if not coalesce(v_est.aceita_agendamento, false) then
    raise exception 'Este estabelecimento não está aceitando agendamentos online.';
  end if;

  v_ent := public.calcular_entitlements_estabelecimento(new.estabelecimento_id);
  if not coalesce((v_ent->>'permite_agenda')::boolean, false) then
    raise exception 'Este estabelecimento não possui agenda online na configuração atual.';
  end if;
  return new;
end;
$$;
revoke all on function public.validar_agendamento_plano() from public,anon,authenticated;

commit;
