const { test } = require('node:test');
const assert = require('node:assert/strict');
const vm = require('node:vm');
const fs = require('node:fs');

function client(fetch, options = {}) {
  const context = { fetch, location: { hostname: 'barberhub.test', protocol: 'https:', port: '' },
    navigator: { onLine: true }, AbortController, setTimeout, clearTimeout, URLSearchParams,
    CustomEvent: class { constructor(name, data) { this.name=name; this.detail=data.detail; } },
    crypto: { randomUUID: () => 'test-request-id' }, dispatchEvent() {},
    supabaseClient: { auth: { getSession: async () => ({ data: { session: { access_token: 'user-token' } } }) } },
    ...options };
  context.window=context;
  vm.runInNewContext(fs.readFileSync('js/backend-api.js','utf8'),context);
  return context.bhBackendApi;
}

test('API base URL, token and request ID are centralized', async () => {
  let call;
  const api=client(async (url, init) => { call={url,init}; return { ok:true, json:async()=>({success:true,data:{id:'user'}}) }; },
    { BARBER_HUB_API_BASE_URL:'https://api.example.test/api/v1/' });
  await api.adminUpdateAccount('user/1',{estado_conta:'suspensa'});
  assert.equal(call.url,'https://api.example.test/api/v1/admin/users/user%2F1');
  assert.equal(call.init.method,'PATCH');
  assert.equal(call.init.headers.Authorization,'Bearer user-token');
  assert.equal(call.init.headers['X-Request-ID'],'test-request-id');
  assert.deepEqual(JSON.parse(call.init.body),{estado_conta:'suspensa'});
});

test('sensitive account writes fail without a session before making any request', async () => {
  let calls=0;
  const api=client(async()=>{calls++;},{supabaseClient:null});
  await assert.rejects(api.adminDeleteAccount('user'),error=>error.code==='UNAUTHORIZED');
  assert.equal(calls,0);
});

test('administrative mutations are not retried after an ambiguous failure', async () => {
  let calls=0;
  const api=client(async()=>{calls++;return {ok:false,status:503,headers:{get:()=> 'trace-1'},json:async()=>({error:{code:'UNAVAILABLE',message:'Indisponível'}})};});
  await assert.rejects(api.adminDeleteAccount('user'),error=>error.code==='UNAVAILABLE' && error.requestId==='trace-1');
  assert.equal(calls,1);
});

test('admin profile helper only uses the API and never falls back to browser writes', async()=>{
  const context={window:{bhBackendApi:{adminUpdateAccount:async(id,data)=>({id,...data})}},
    bhExigirSupabase:()=>{throw new Error('Direct database write forbidden');}};
  vm.createContext(context);
  vm.runInContext(fs.readFileSync('js/api.js','utf8'),context);
  const result=await vm.runInContext('bhAdminAtualizarPerfil("user",{ativo:false})',context);
  assert.equal(result.estado_conta,'desativada');
});
