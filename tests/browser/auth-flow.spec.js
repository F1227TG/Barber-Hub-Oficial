const {test,expect}=require('@playwright/test');
const {mountFullPage}=require('./fixtures/full-pages');

async function credentials(page){
 await page.locator('#email').fill('teste@example.test');
 await page.locator('#senha').fill('Synthetic123!');
}
for(const width of [390,1440]){
 test(`login failure allows retry and success opens client area ${width}`,async({page})=>{
  await mountFullPage(page,{name:'login',width});
  await page.evaluate(()=>{
   let calls=0;
   supabaseClient.auth.signInWithPassword=async()=>++calls===1
    ?{error:{message:'Invalid login credentials'}}:{data:{session:{user:{id:'test'}},user:{id:'test'}}};
   supabaseClient.auth.getSession=async()=>({data:{session:{user:{id:'test'},access_token:'synthetic'}}});
  });
  await page.route('**/api/v1/account/profile',r=>r.fulfill({json:{success:true,data:{id:'test',nome:'Teste',tipo:'cliente',ativo:true}}}));
  // The initial continuation is captured on DOMContentLoaded. Default destination is the client area.
  await page.route('**/cliente.html',r=>r.fulfill({contentType:'text/html',body:'<h1>Agenda de teste</h1>'}));
  await credentials(page);await page.locator('#formLogin button[type=submit]').click();
  await expect(page.getByText('E-mail ou senha incorretos.',{exact:true})).toBeVisible();
  await expect(page.locator('#formLogin button[type=submit]')).toBeEnabled();
  await page.locator('#formLogin button[type=submit]').click();
  await expect(page).toHaveURL(/cliente\.html$/);
 });
 test(`signup email confirmation ${width}`,async({page})=>{
  const verify=await mountFullPage(page,{name:'cadastro',width});
  await page.evaluate(()=>{supabaseClient.auth.signUp=async payload=>{
   window.__signup=payload;return {data:{user:{id:'synthetic'},session:null}};
  }});
  await page.locator('#nome').fill('Pessoa Teste');await credentials(page);
  await page.locator('#telefone').fill('11999991234');
  await page.locator('#confirmarSenha').fill('Synthetic123!');
  await page.locator('#termos').check();
  await page.locator('#formCadastro button[type=submit]').click();
  await expect(page.locator('#confirmacaoEmail')).toBeVisible();
  await expect(page.locator('#emailConfirmacao')).toHaveText('teste@example.test');
  const signup=await page.evaluate(()=>window.__signup);
  expect(signup.options.data.tipo).toBe('cliente');
  expect(signup.options.emailRedirectTo).toContain('confirmado=1');
  await verify();
 });
 test(`recovery request keeps a retryable form on provider error ${width}`,async({page})=>{
  await mountFullPage(page,{name:'recuperar-senha',width});
  await page.evaluate(()=>{
   let count=0;supabaseClient.auth.resetPasswordForEmail=async()=>++count===1
    ?{error:{message:'Failed to fetch'}}:{error:null};
  });
  await page.locator('#emailRecuperacao').fill('teste@example.test');
  await page.locator('#formRecuperarSenha button[type=submit]').click();
  await expect(page.getByText('Falha de conexão. Confira sua internet e tente novamente.')).toBeVisible();
  await page.locator('#formRecuperarSenha button[type=submit]').click();
  await expect(page.locator('#recuperacaoEnviada')).toBeVisible();
 });
}
