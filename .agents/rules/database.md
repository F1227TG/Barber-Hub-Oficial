# Regra de banco e migrations

Aplicar em `sql/**/*.sql`.

- Migrations devem ser ordenadas, comentadas e executáveis após as anteriores.
- Preferir `create ... if not exists`, `drop policy if exists` e transações.
- Funções `security definer` devem definir `search_path`.
- Revogar execução de `public` e `anon` em operações autenticadas/sensíveis.
- Preservar compatibilidade com dados existentes e fazer backfill quando necessário.
- Não apagar dados de produção sem uma etapa explícita de confirmação e backup.
- RLS deve separar cliente, proprietário do estabelecimento e administrador.
