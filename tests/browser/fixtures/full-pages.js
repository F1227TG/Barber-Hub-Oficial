/** Real HTML/CSS/JS, synthetic identities and allowlisted data boundaries. No network escapes. */
const fs = require('node:fs');
const path = require('node:path');
const { expect } = require('@playwright/test');
const root = path.resolve(__dirname, '../../..');
const fonts = require('../../fixtures/fonts/manifest.json');
const now = '2026-10-22T15:00:00.000Z';
const id = '10000000-0000-4000-8000-000000000001';

function sdkFixture({ profile, tables }) {
  const session = profile ? { access_token: 'synthetic-visual-token', user: {
    id: profile.id, email: profile.email, email_confirmed_at: '2026-01-01T00:00:00Z',
    user_metadata: {}, app_metadata: {},
  } } : null;
  const unexpected = value => { window.__fixtureErrors.push(value); throw new Error(value); };
  window.__fixtureErrors = [];
  window.supabase = { createClient: () => ({
    auth: {
      getSession: async () => ({ data: { session }, error: null }),
      getUser: async () => ({ data: { user: session?.user || null }, error: null }),
      onAuthStateChange: () => ({ data: { subscription: { unsubscribe() {} } } }),
    },
    from(table) {
      if (!Object.hasOwn(tables, table)) return unexpected(`Unmocked table: ${table}`);
      let single = false;
      const builder = {};
      for (const method of ['select', 'eq', 'is', 'in', 'gte', 'order', 'range', 'limit']) builder[method] = () => builder;
      builder.single = builder.maybeSingle = () => { single = true; return builder; };
      builder.then = (resolve, reject) => Promise.resolve({
        data: single ? tables[table][0] || null : tables[table], count: tables[table].length, error: null,
      }).then(resolve, reject);
      return builder;
    },
    rpc: name => unexpected(`Unmocked RPC: ${name}`),
    channel() { return { on() { return this; }, subscribe() { return this; }, unsubscribe() {} }; },
    removeChannel() {},
  }) };
}

async function mountFullPage(page, { name, width, theme = 'escuro' }) {
  const role = name === 'admin' ? 'admin' : name === 'conta' ? 'cliente' : null;
  const profile = role ? { id, nome: 'Alex Exemplo', email: 'alex@example.test', telefone: '(11) 99999-1234',
    tipo: role, ativo: true, estado_conta: 'ativa', onboarding_concluido: true } : null;
  const people = [profile, { id: '20000000-0000-4000-8000-000000000002', nome: 'Marina Cliente',
    email: 'marina@example.test', tipo: 'cliente', ativo: true, estado_conta: 'ativa', created_at: now },
  { id: '30000000-0000-4000-8000-000000000003', nome: 'Rafael Profissional', email: 'rafael@example.test',
    tipo: 'barbeiro', ativo: false, estado_conta: 'suspensa', created_at: now }].filter(Boolean);
  const shops = ['Barbearia Horizonte', 'Studio Primavera', 'Barbearia Central'].map((nome, i) => ({
    id: `40000000-0000-4000-8000-00000000000${i}`, nome, bairro: 'Centro', cidade: 'São Paulo',
    estado: 'SP', tipoEstabelecimento: i === 1 ? 'salao' : 'barbearia', aberto_agora: i !== 2,
    aceitaAgendamento: true, avaliacao: 4.8, totalAvaliacoes: 24, destaque: i === 0,
    capaUrl: '/img/placeholders/barbearia-01.webp',
    servicos: [{ nome: 'Corte completo', ativo: true, publico: true, preco: 45 }],
  }));
  const tables = { estabelecimentos: [], notificacoes: [], agendamentos: [], tickets_suporte: [], portfolio_denuncias: [],
    consentimentos_usuario: [{ documento: 'Política de privacidade', versao: '1.0', acao: 'aceito', created_at: now }] };
  const endpoints = {
    '/api/v1/catalog/summary': { estabelecimentos: 3, agendamentos: 2 },
    '/api/v1/public-config': { turnstile_site_key: '', captcha_required: false },
    '/api/v1/account/profile': profile,
    '/api/v1/account/sessions': { items: [{ current: true, user_agent: 'Chrome Windows', ip_masked: '192.0.*.*', updated_at: now }], can_revoke_others: false },
    '/api/v1/account/deletion': { status: 'none', can_cancel: false },
    '/api/v1/marketplace/regional': { items: shops, total: shops.length, has_more: false },
    '/api/v1/admin/overview': { usuarios: people.length, estabelecimentos: 0, agendamentos: 0, avaliacoes: 0 },
    '/api/v1/admin/health': { api: { status: 'online' }, database: { status: 'online' }, auth: { status: 'online' }, marketplace: { status: 'online' },
      release: { version: '1.11.0', migrations: { 29: true, 30: true, 31: true }, configuration: {} } },
  };
  for (const resource of ['perfis', 'estabelecimentos', 'agendamentos', 'tickets', 'denuncias', 'avaliacoes']) {
    const items = resource === 'perfis' ? people : [];
    endpoints[`/api/v1/admin/records/${resource}`] = { items, total: items.length, has_more: false };
  }
  const errors = [];
  page.on('pageerror', error => errors.push(error.message));
  await page.setViewportSize({ width, height: 900 });
  await page.clock.setFixedTime(new Date(now));
  await page.addInitScript(({ theme }) => { localStorage.setItem('bh_tema', theme); }, { theme });
  await page.route('**/*', async route => {
    const request = route.request();
    const url = new URL(request.url());
    const font = fonts[url.href];
    if (font) return route.fulfill({ path: path.join(root, 'tests/fixtures/fonts', font.file) });
    if (url.href === 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2') {
      return route.fulfill({ contentType: 'text/javascript; charset=utf-8', body: `(${sdkFixture})(${JSON.stringify({ profile, tables })});` });
    }
    if (url.hostname === 'barberhub.test' && request.method() === 'GET') {
      if (Object.hasOwn(endpoints, url.pathname)) return route.fulfill({ json: { success: true, data: endpoints[url.pathname] } });
      // Resolve only public assets. Tests must never serve config/secrets from the repository.
      if (/^\/(html|mobile|css|js|vendor|img|assets)\//.test(url.pathname) || ['/index.html', '/manifest.webmanifest'].includes(url.pathname)) {
        const target = path.resolve(root, '.' + decodeURIComponent(url.pathname));
        if (target.startsWith(root + path.sep) && fs.existsSync(target) && fs.statSync(target).isFile()) {
          return route.fulfill({ path: target });
        }
      }
    }
    errors.push(`Unmocked request: ${request.method()} ${url.href}`);
    return route.abort();
  });
  await page.goto(name === 'home' ? `http://barberhub.test/${width < 768 ? 'mobile/' : ''}index.html` : `http://barberhub.test/${width < 768 ? 'mobile' : 'html'}/${name}.html`);
  if (!['privacidade', 'termos', 'recuperar-senha'].includes(name) && (name !== 'home' || width >= 768)) await expect(page.locator('#menuPrincipal')).not.toBeEmpty();
  if (name === 'login') await expect(page.locator('#formLogin')).toBeVisible();
  if (name === 'portal') await expect(page.locator('#gridBarbearias [data-marketplace-card]')).toHaveCount(3);
  if (name === 'conta') {
    await expect(page.locator('#contaNome')).toHaveValue('Alex Exemplo');
    await expect(page.locator('.account-session111')).toHaveCount(1);
  }
  if (name === 'admin') {
    await expect(page.locator('#adminNome')).toHaveText('Alex Exemplo');
    await expect(page.locator('#adminUltimaAtualizacao')).toContainText('Atualizado às');
    await expect(page.locator('#adminHealthServices')).toHaveAttribute('data-checked-at', /T/);
    await expect(page.getByText('Marina Cliente', { exact: true })).toHaveCount(1);
  }
  await page.evaluate(async () => {
    await document.fonts.ready;
    await Promise.all([...document.images].map(image => image.decode().catch(() => {})));
  });
  return async () => {
    expect(errors, 'Unexpected page errors or network calls').toEqual([]);
    expect(await page.evaluate(() => window.__fixtureErrors), 'Unexpected SDK calls').toEqual([]);
    const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth);
    expect(overflow, 'No page-level horizontal overflow').toBeLessThanOrEqual(1);
  };
}

module.exports = { mountFullPage };
