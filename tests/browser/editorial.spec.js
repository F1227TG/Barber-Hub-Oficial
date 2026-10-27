const { test, expect } = require('@playwright/test');
const { mountFullPage } = require('./fixtures/full-pages');

for (const width of [360, 390, 412, 768, 1440]) {
  for (const theme of ['escuro', 'claro']) {
    test(`home editorial ${width} ${theme}`, async ({ page }) => {
      const verify = await mountFullPage(page, { name: 'home', width, theme });
      const client = page.locator('#preview-cliente');
      const business = page.locator('#preview-negocio');
      await expect(client).toBeVisible();
      await expect(business).toBeHidden();
      await page.getByRole('button', { name: 'Para o seu negócio' }).click();
      await expect(business).toBeVisible();
      await expect(client).toBeHidden();
      expect(new URL(await business.locator('a').getAttribute('href'), page.url()).pathname).toBe(width < 768 ? '/mobile/cadastro.html' : '/html/cadastro.html');
      await page.getByRole('button', { name: 'Para o seu estilo' }).focus();
      await page.keyboard.press('Enter');
      await expect(client).toBeVisible();
      await page.emulateMedia({ reducedMotion: 'reduce' });
      await expect(client).toHaveCSS('animation-name', 'none');
      await page.evaluate(() => { document.activeElement?.blur(); window.scrollTo(0, 0); });
      await page.screenshot({ path: `test-results/editorial-home-${width}-${theme}.png`, fullPage: true, animations: 'disabled' });
      await verify();
    });
  }
}

for (const name of ['sobre', 'planos', 'servicos', 'contato', 'privacidade', 'termos', 'beauty-hub', 'cadastro', 'recuperar-senha']) {
  for (const width of [360, 1440]) {
    test(`public layout ${name} ${width}`, async ({ page }) => {
      const verify = await mountFullPage(page, { name, width });
      await expect(page.locator('main')).toBeVisible();
      await expect(page.locator('main')).not.toBeEmpty();
      await verify();
    });
  }
}
