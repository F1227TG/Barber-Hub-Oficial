/** Browser integration of production auth/client scripts with synthetic identities. */
const { test, expect } = require('@playwright/test');
const fs = require('node:fs');

async function mount(page, { role='cliente', active=true, signedIn=true, area='admin', mobile=false }={}) {
  await page.route('**/*', async route => {
    const url=new URL(route.request().url());
    if (url.hostname !== 'barberhub.test') return route.abort();
    if (url.pathname === '/api/v1/account/profile') {
      return route.fulfill({json: active ? {success:true,data:{id:'fixture-user',tipo:role,ativo:true,estado_conta:'ativa'}}
        : {success:false,error:{code:'ACCOUNT_INACTIVE',message:'Conta inativa'}},status:active?200:403});
    }
    if (url.pathname.startsWith('/js/')) {
      if (!['/js/utils.js','/js/auth.js','/js/backend-api.js'].includes(url.pathname)) return route.abort();
      return route.fulfill({contentType:'text/javascript; charset=utf-8',body:fs.readFileSync('.'+url.pathname,'utf8')});
    }
    if (url.pathname === '/404.html') return route.fulfill({contentType:'text/html',body:fs.readFileSync('404.html','utf8')});
    if (url.pathname.endsWith('/login.html')) return route.fulfill({contentType:'text/html',body:'<h1>Entrar</h1>'});
    return route.fulfill({contentType:'text/html; charset=utf-8',body:`<!doctype html><html lang="pt-BR"><head><meta charset="utf-8"></head><body>
      <script>
      window.supabaseClient={auth:{getSession:async()=>({data:{session:${signedIn?'{user:{id:"fixture-user"},access_token:"fixture-token"}':'null'}}}),onAuthStateChange:()=>{}}};
      window.bhExigirSupabase=()=>window.supabaseClient;
      window.bhSupabasePronto=()=>true;
      window.mostrarToast=()=>{};
      window.bhErroMensagem=e=>e.message;
      </script><script src="/js/utils.js"></script><script src="/js/backend-api.js"></script><script src="/js/auth.js"></script>
      <script>bhRequireAuth([${JSON.stringify(area==='admin'?'admin':'barbeiro')}]).then(profile=>{if(profile)document.body.dataset.authorized='true';});</script>
      </body></html>`});
  });
  await page.goto(`http://barberhub.test/${mobile?'mobile':'html'}/${area==='admin'?'admin':'painel'}.html`);
}

for (const width of [360,390,412,768,1440]) {
  test(`role boundaries at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await mount(page,{role:'cliente',mobile:width<768});
    await expect(page).toHaveURL('http://barberhub.test/404.html');
  });
}
test('barber cannot enter administration',async({page})=>{
  await mount(page,{role:'barbeiro'});
  await expect(page).toHaveURL('http://barberhub.test/404.html');
});
test('admin cannot enter the exclusive professional panel',async({page})=>{
  await mount(page,{role:'admin',area:'professional'});
  await expect(page).toHaveURL('http://barberhub.test/404.html');
});
test('inactive accounts cannot enter a private page',async({page})=>{
  await mount(page,{role:'admin',active:false});
  await expect(page).toHaveURL('http://barberhub.test/404.html');
});
test('active administrator can continue',async({page})=>{
  await mount(page,{role:'admin'});
  await expect(page.locator('body')).toHaveAttribute('data-authorized','true');
});
test('anonymous visitor is sent to login with continuation',async({page})=>{
  await mount(page,{signedIn:false});
  await expect(page).toHaveURL(/\/html\/login\.html\?next=/);
});
