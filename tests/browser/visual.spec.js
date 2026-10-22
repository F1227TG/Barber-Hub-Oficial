const { test, expect } = require('@playwright/test');
const { mountFullPage } = require('./fixtures/full-pages');

for (const width of [360, 390, 412, 768, 1440]) {
  for (const name of ['login', 'portal', 'conta', 'admin']) {
    for (const theme of ['escuro', 'claro']) {
      test(`${name} ${width}px ${theme}`, async ({ page }) => {
        const verify = await mountFullPage(page, { name, width, theme });
        await expect(page).toHaveScreenshot(`${name}-${width}-${theme}.png`, {
          fullPage: true, animations: 'disabled',
          mask: name === 'admin' ? [page.locator('#adminHealthApi')] : [],
        });
        await verify();
      });
    }
  }
  test(`account privacy panel ${width}px`, async ({ page }) => {
    const verify = await mountFullPage(page, { name: 'conta', width });
    await page.locator('[data-account-panel="privacidade"]').click();
    await expect(page.locator('#accountConsentsList111')).toBeVisible();
    await expect(page).toHaveScreenshot(`account-privacy-${width}.png`, { fullPage: true, animations: 'disabled' });
    await verify();
  });
  test(`marketplace filters ${width}px`, async ({ page }) => {
    const verify = await mountFullPage(page, { name: 'portal', width });
    await page.locator('#abrirFiltrosMarketplace').click();
    await expect(page.locator('#filtrosMarketplace')).toBeVisible();
    await expect(page).toHaveScreenshot(`marketplace-filters-${width}.png`, { animations: 'disabled' });
    await verify();
  });
}
