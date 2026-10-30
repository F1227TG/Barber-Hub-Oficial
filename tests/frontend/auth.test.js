const {test}=require('node:test');
const assert=require('node:assert/strict');
const vm=require('node:vm');
const fs=require('node:fs');
function fixture(){
 let session={user:{id:'first'},access_token:'test'}, handler, calls=0, cleared=0;
 const context={setTimeout:fn=>{fn();},URL,window:null,bhSupabasePronto:()=>true,
  bhBackendApi:{accountProfile:async()=>{calls++; return {id:session.user.id,tipo:'cliente',ativo:true};}},
  bhContinuation:{clear:()=>cleared++,safeNext:()=>null},bhAbsoluteUrl:p=>'https://barberhub.test/'+p};
 context.supabaseClient={auth:{getSession:async()=>({data:{session}}),onAuthStateChange:fn=>handler=fn,
  updateUser:async()=>({data:{user:{id:'first',email:'old@example.test'}}}),
  signUp:async()=>({data:{session,user:session.user}})}};
 context.bhExigirSupabase=()=>context.supabaseClient; context.window=context;
 vm.createContext(context);vm.runInContext(fs.readFileSync('js/auth.js','utf8'),context);
 return {context,run:s=>vm.runInContext(s,context),event:(e,s)=>handler(e,s),
  switchUser:id=>session=id?{user:{id},access_token:'test'}:null,stats:()=>({calls,cleared})};
}
test('cached profile cannot cross accounts or survive a lost session',async()=>{
 const f=fixture();assert.equal((await f.run('bhGetPerfil()')).id,'first');
 f.switchUser('second');assert.equal((await f.run('bhGetPerfil()')).id,'second');
 f.switchUser(null);assert.equal(await f.run('bhGetPerfil()'),null);
});
test('anonymous startup preserves booking continuation; explicit logout clears it',()=>{
 const f=fixture();f.event('INITIAL_SESSION',null);assert.equal(f.stats().cleared,0);
 f.event('SIGNED_OUT',null);assert.equal(f.stats().cleared,1);
});
test('transient profile outage retries but authorization denial stops immediately',async()=>{
 const f=fixture();let count=0;
 f.context.bhBackendApi.accountProfile=async()=>{if(++count===1)throw {status:503};return {id:'first'}};
 assert.equal((await f.run('bhAguardarPerfil()')).id,'first');assert.equal(count,2);
 count=0;f.context.bhBackendApi.accountProfile=async()=>{count++;throw {status:403,code:'ACCOUNT_INACTIVE'}};
 await assert.rejects(f.run('bhAguardarPerfil()'),e=>e.code==='ACCOUNT_INACTIVE');assert.equal(count,1);
});
test('a pending email change never overwrites the confirmed profile email',async()=>{
 const f=fixture();f.context.supabaseClient.from=()=>{throw new Error('Premature profile write')};
 await f.run('bhAtualizarEmail("pending@example.test")');
});
test('signup with a session but no profile does not report success',async()=>{
 const f=fixture();f.context.bhBackendApi.accountProfile=async()=>null;
 await assert.rejects(f.run('bhRegistrar({nome:"Teste",email:"test@example.test",telefone:"11999999999",senha:"Synthetic123!",tipo:"cliente"})'),/não é necessário repetir/);
});
test('signup profile service failure acknowledges the already created account',async()=>{
 const f=fixture();f.context.bhBackendApi.accountProfile=async()=>{throw {status:503}};
 await assert.rejects(f.run('bhRegistrar({nome:"Teste",email:"test@example.test",telefone:"11999999999",senha:"Synthetic123!",tipo:"cliente"})'),e=>e.code==='ACCOUNT_PROFILE_PENDING' && /não repita/.test(e.message));
});
