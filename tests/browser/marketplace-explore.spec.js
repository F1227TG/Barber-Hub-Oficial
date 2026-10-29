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
