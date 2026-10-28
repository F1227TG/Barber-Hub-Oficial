const {test}=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const vm=require('node:vm');
const source=fs.readFileSync(require('node:path').join(__dirname,'../../js/core/google-login.js'),'utf8');
function harness(href='https://app.test/html/login.html') {
 const url=new URL(href),store=new Map(),calls=[],messages=[];
 const button={hidden:true,disabled:false,addEventListener(_,fn){this.click=fn;}};
 const window={location:{href,origin:url.origin,pathname:url.pathname,hash:url.hash,replace:value=>calls.push(['replace',value])},history:{replaceState:(_,__,value)=>calls.push(['clean',value])},sessionStorage:{setItem:(k,v)=>store.set(k,v),getItem:k=>store.get(k)||null,removeItem:k=>store.delete(k)}};
 vm.runInNewContext(source,{window,URL,URLSearchParams,Date,JSON,Number});
 const client={auth:{signInWithOAuth:async args=>{calls.push(['oauth',args]);return {};},getSession:async()=>({data:{session:{user:{id:'one'}}}}),getUser:async()=>({data:{user:{id:'one'}}})}};
 const options={enabled:true,button,client,next:'/html/cliente.html?tab=agenda',finish:async next=>next||'/html/cliente.html',report:m=>messages.push(m)};
 return {window,button,store,calls,messages,options};
}
test('Google redirect is same-origin and carries no user data or destination',async()=>{
 const h=harness();await h.window.setupGoogleLogin(h.options);await h.button.click();
 assert.equal(h.calls[0][1].provider,'google');
 assert.equal(h.calls[0][1].options.redirectTo,'https://app.test/html/login.html?oauth=google');
 assert.equal(h.button.disabled,true);
});
test('disabled provider remains hidden and cannot initiate login',async()=>{
 const h=harness();await h.window.setupGoogleLogin({...h.options,enabled:false});await h.button.click();assert.equal(h.calls.length,0);assert.equal(h.button.hidden,true);
});
test('failed provider request allows retry without false success',async()=>{
 const h=harness();h.options.client.auth.signInWithOAuth=async()=>({error:new Error('disabled')});await h.window.setupGoogleLogin(h.options);await h.button.click();assert.equal(h.button.disabled,false);assert.equal(h.messages.length,1);assert.equal(h.store.size,0);
});
test('verified callback restores internal continuation and removes callback parameters',async()=>{
 const h=harness('https://app.test/html/login.html?oauth=google#access_token=synthetic');
 h.store.set('oauth-google-continuation-v1',JSON.stringify({next:'/html/cliente.html?tab=agenda',created:Date.now()}));
 await h.window.setupGoogleLogin(h.options);assert.deepEqual(h.calls,[['clean','/html/login.html'],['replace','/html/cliente.html?tab=agenda']]);assert.equal(h.store.size,0);
});
test('external or expired continuation never redirects offsite',async()=>{
 for(const next of ['https://evil.test','//evil.test','\\evil.test','/html/cliente.html']){
  const h=harness('https://app.test/html/login.html?oauth=google');
  h.store.set('oauth-google-continuation-v1',JSON.stringify({next,created:next.startsWith('/html')?0:Date.now()}));
  await h.window.setupGoogleLogin(h.options);assert.equal(h.calls.at(-1)[1],'/html/cliente.html');
 }
});
test('provider cancellation or unverified user never completes login',async()=>{
 for(const href of ['https://app.test/html/login.html?oauth=google&error=access_denied','https://app.test/html/login.html?oauth=google']){
  const h=harness(href);h.options.client.auth.getUser=async()=>({error:new Error('invalid')});
  await h.window.setupGoogleLogin(h.options);assert.equal(h.calls.some(c=>c[0]==='replace'),false);assert.equal(h.messages.length,1);
 }
});
