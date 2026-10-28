/** Real PostgreSQL semantics in an isolated database; never uses production credentials. */
const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const { PGlite } = require('@electric-sql/pglite');

test('account migration: permissions, soft deletion, audit, rollback and last administrator', async () => {
  const db = new PGlite();
  try {
    await db.exec(`
      create role anon; create role authenticated; create role service_role bypassrls; create role authenticator;
      create schema auth; create schema private;
      create function auth.uid() returns uuid language sql stable as
        $$ select nullif(current_setting('request.jwt.claim.sub', true),'')::uuid $$;
      create function auth.jwt() returns jsonb language sql stable as
        $$ select jsonb_build_object('session_id',current_setting('request.jwt.claim.sub',true)) $$;
      grant usage on schema auth to public;
      create table auth.sessions(id uuid primary key, user_id uuid, not_after timestamptz);
      create table public.perfis(id uuid primary key, tipo text not null, ativo boolean default true,
        nome text, email text, telefone text, avatar_url text, acessibilidade jsonb,
        onboarding_concluido boolean default false);
      alter table public.perfis enable row level security;
      create policy own_profile on public.perfis to authenticated using (id = auth.uid()) with check (id = auth.uid());
      grant select, update, delete on public.perfis to authenticated;
      create table public.auditoria_admin(id bigint generated always as identity, admin_id uuid, acao text,
        alvo_tipo text, alvo_id text, detalhes jsonb, request_id text);
      alter table public.auditoria_admin enable row level security;
      insert into public.perfis(id,tipo,ativo) values
        ('00000000-0000-0000-0000-000000000001','admin',true),
        ('00000000-0000-0000-0000-000000000002','cliente',true),
        ('00000000-0000-0000-0000-000000000003','admin',true);
    `);
    const migration = fs.readFileSync('supabase/migrations/20261028151359_modernizacao_contas_administrativas.sql', 'utf8');
    await db.exec(migration);
    await db.exec(migration); // Idempotence matters for recovery/review tooling.
    const actor = '00000000-0000-0000-0000-000000000001';
    const target = '00000000-0000-0000-0000-000000000002';
    const other = '00000000-0000-0000-0000-000000000003';
    async function administer(who, id, change) {
      await db.exec('set role service_role');
      try {
        return await db.query('select public.administrar_conta($1,$2,$3::jsonb,$4) as result', [who,id,JSON.stringify(change),'sql-test']);
      } finally { await db.exec('reset role'); }
    }
    await assert.rejects(administer(actor, actor, {estado_conta:'excluida'}), /SELF_ACCOUNT_CHANGE/);
    await assert.rejects(administer(target, actor, {tipo:'cliente'}), /ADMIN_REQUIRED/);
    await assert.rejects(administer(actor, target, {tipo:null}), /INVALID_ACCOUNT_CHANGE/);
    await db.query('insert into auth.sessions(id,user_id) values ($1,$2)', [target,target]);
    assert.equal((await db.query('select public.sessao_conta_ativa($1,$2) as active',[target,target])).rows[0].active,true);
    const deleted = await administer(actor, target, {estado_conta:'excluida'});
    assert.equal(deleted.rows[0].result.ativo, false);
    assert.equal((await db.query('select count(*)::int as n from auth.sessions')).rows[0].n, 0);
    assert.equal((await db.query('select acao from public.auditoria_admin')).rows[0].acao, 'account.deleted');
    assert.equal((await db.query('select count(*)::int as n from public.perfis')).rows[0].n, 3);
    await administer(actor, target, {estado_conta:'ativa'});
    assert.equal((await db.query('select public.sessao_conta_ativa($1,$2) as active',[target,target])).rows[0].active,false);
    await administer(actor, other, {tipo:'cliente'});
    await assert.rejects(db.query('update public.perfis set ativo=false where id=$1',[actor]), /LAST_ACTIVE_ADMIN/);
    await db.query('insert into auth.sessions(id,user_id) values ($1,$2)', [target,target]);

    // Authenticated clients cannot change role/status or invoke the service-only function.
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${target}'`);
    await assert.rejects(db.query("update public.perfis set tipo='admin' where id=$1", [target]), /permission denied/);
    await assert.rejects(db.query('select public.administrar_conta($1,$2,$3::jsonb)', [actor,target,'{"tipo":"admin"}']), /permission denied/);
    await db.query("update public.perfis set nome='Nome atualizado' where id=$1", [target]);
    await db.exec('reset role');
    await administer(actor, target, {estado_conta:'suspensa'});
    await db.exec(`set role authenticated; set request.jwt.claim.sub = '${target}'`);
    assert.equal((await db.query('select * from public.perfis')).rows.length, 0);
    await assert.rejects(db.query('select public.validar_acesso_conta()'), /ACCOUNT_INACTIVE/);
    await db.exec('reset role');

    // An audit failure must roll back the account change too.
    await db.exec("alter table public.auditoria_admin add constraint test_audit_failure check (acao <> 'account.restored') not valid");
    await assert.rejects(administer(actor, target, {estado_conta:'ativa'}), /test_audit_failure/);
    assert.equal((await db.query('select estado_conta from public.perfis where id=$1',[target])).rows[0].estado_conta,'suspensa');
  } finally { await db.close(); }
});
