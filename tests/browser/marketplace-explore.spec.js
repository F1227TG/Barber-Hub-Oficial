const {test,expect}=require('@playwright/test');
const {mountFullPage}=require('./fixtures/full-pages');
for(const width of [360,390,768,1024,1440])for(const theme of ['escuro','claro'])test(`Explorar Barber ${width} ${theme}`,async({page})=>{
 const verify=await mountFullPage(page,{name:'portal',width,theme});
 await expect(page.getByRole('heading',{name:'Seu estilo começa aqui.'})).toBeVisible();
 await page.locator('#marketplace-city').fill('Recife');await page.locator('#marketplace-search-submit').click();
 await expect(page.locator('#marketplace-active-filters')).toContainText('Recife');
 await page.locator('.marketplace-category-grid [data-explore-service="barba"]').click();
 await expect(page.locator('.marketplace-category-grid [data-explore-service="barba"]')).toHaveAttribute('aria-pressed','true');
 await page.locator('#abrirFiltrosMarketplace').click();await expect(page.getByRole('dialog')).toBeVisible();
 await page.keyboard.press('Escape');await expect(page.getByRole('dialog')).toBeHidden();
 await page.evaluate(()=>{document.activeElement?.blur();window.scrollTo(0,0);});
 await expect(page.locator('.marketplace-hero')).toHaveCSS('background-image',/01-banner-principal/);
 await page.screenshot({path:`test-results/explore-barber-${width}-${theme}.png`,fullPage:true});await verify();
});
test('latest city selection is not lost while the previous search is loading',async({page})=>{
 await mountFullPage(page,{name:'portal',width:390});
 const requests=[];
 await page.route('**/api/v1/marketplace/regional?*',async route=>{
  requests.push(new URL(route.request().url()).searchParams.get('city'));
  await new Promise(resolve=>setTimeout(resolve,500));
  await route.fulfill({json:{success:true,data:{items:[],total:0,has_more:false}}});
 });
 await page.locator('#marketplace-city').fill('Recife');await page.locator('#marketplace-search-submit').click();
 await page.locator('#marketplace-city').fill('Natal');await page.locator('#marketplace-search-submit').click();
 await expect(page.locator('#marketplace-active-filters')).toContainText('Natal');
 await expect.poll(()=>requests).toEqual(['Recife','Natal']);
});
