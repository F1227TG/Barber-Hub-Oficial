-- Plan the private account check only for authenticated requests. SQL may
-- resolve both operands of AND even when current_user is anonymous.
create or replace function public.validar_acesso_conta()
returns void language plpgsql security invoker set search_path = '' as $$
begin
  if current_user <> 'authenticated' then
    return;
  end if;
  if not private.conta_ativa() then
    raise sqlstate 'PT403' using message = 'ACCOUNT_INACTIVE';
  end if;
end;
$$;
revoke all on function public.validar_acesso_conta() from public;
grant execute on function public.validar_acesso_conta() to anon, authenticated, service_role;
notify pgrst, 'reload schema';
