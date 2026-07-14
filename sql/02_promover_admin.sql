-- ============================================================
-- PROMOVER SUA CONTA PARA ADMIN
-- 1) Crie o usuário em Authentication > Users ou pelo site.
-- 2) Troque o e-mail abaixo, caso prefira outro.
-- 3) Execute este arquivo no SQL Editor.
-- ============================================================

do $$
declare
  v_email text := 'admin@barberhub.com';
begin
  insert into public.perfis (
    id,nome,email,telefone,tipo,onboarding_concluido,ativo
  )
  select
    u.id,
    coalesce(nullif(trim(u.raw_user_meta_data ->> 'nome'), ''), split_part(u.email,'@',1)),
    u.email,
    nullif(trim(u.raw_user_meta_data ->> 'telefone'), ''),
    'admin',
    true,
    true
  from auth.users u
  where lower(u.email)=lower(v_email)
  on conflict (id) do update set
    nome=excluded.nome,
    email=excluded.email,
    tipo='admin',
    onboarding_concluido=true,
    ativo=true,
    updated_at=now();

  if not found then
    raise exception 'Usuário % não encontrado em Authentication > Users.', v_email;
  end if;
end;
$$;

select id,nome,email,tipo,onboarding_concluido,ativo
from public.perfis
where lower(email)=lower('admin@barberhub.com');
