const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {PGlite}=require('@electric-sql/pglite');
test('unknown duration cannot be silently ignored in mixed bookings',async()=>{
 const db=new PGlite();
 try{
  await db.exec(`create table servicos(id uuid primary key,duracao_min integer not null check(duracao_min between 5 and 480));
   create function criar_agendamento_multisservico(p_servicos_ids uuid[]) returns integer language plpgsql as $$
   declare v_quantidade integer;v_duracao_total integer;begin
   select count(*)::integer,sum(s.duracao_min)::integer into v_quantidade,v_duracao_total from servicos s where s.id=any(p_servicos_ids);
   if v_quantidade <> cardinality(p_servicos_ids) then raise exception 'unavailable';end if;
   return v_duracao_total;end $$;`);
  const sql=fs.readFileSync('supabase/migrations/20261030041329_imported_service_durations.sql','utf8');
  await db.exec(sql);await db.exec(sql);
  const known='00000000-0000-4000-8000-000000000001',unknown='00000000-0000-4000-8000-000000000002';
  await db.query('insert into servicos values($1,35),($2,null)',[known,unknown]);
  assert.equal((await db.query('select criar_agendamento_multisservico($1) value',[[known]])).rows[0].value,35);
  for(const ids of [[unknown],[known,unknown]])await assert.rejects(()=>db.query('select criar_agendamento_multisservico($1)',[ids]),/unavailable/);
 }finally{await db.close();}
});
