/** Auditoria 1.8.0: caminhos mobile estáticos + dinâmicos + navegação em JS. */
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js", "utils.js"), "utf8");

function evaluate(pathname) {
  const context = {
    location: { pathname, href: `https://barberhuboficial.vercel.app${pathname}`, protocol: "https:" },
    window: { location: { href: `https://barberhuboficial.vercel.app${pathname}` } },
    URL, URLSearchParams, Date, Intl, console, setTimeout, clearTimeout,
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "utils.js" });
  return context;
}

const cases = [
  ["/index.html", "html/portal.html", "/html/portal.html"],
  ["/html/cliente.html", "html/portal.html", "/html/portal.html"],
  ["/mobile/index.html", "html/portal.html", "/mobile/portal.html"],
  ["/mobile/cliente.html", "html/portal.html", "/mobile/portal.html"],
  ["/mobile/cliente", "html/conta.html", "/mobile/conta.html"],
  ["/mobile/cliente.html", "img/logomarcaTRANSPARENTE.png", "/img/logomarcaTRANSPARENTE.png"],
  ["/mobile/cliente.html", "service-worker.js", "/service-worker.js"],
  ["/mobile/cliente.html", "index.html", "/mobile/index.html"],
  ["/mobile/conta.html", "index.html?conta=excluida", "/mobile/index.html?conta=excluida"],
  ["/mobile/caminho/quebrado", "html/portal.html", "/mobile/portal.html"],
  ["/caminho/quebrado/profundo", "css/global.css", "/css/global.css"],
];

const errors = [];
for (const [pathname, input, expected] of cases) {
  const actual = evaluate(pathname).bhUrl(input);
  if (actual !== expected) errors.push(`${pathname}: bhUrl(${input}) => ${actual}; esperado ${expected}`);
}

const mobileDir = path.join(root, "mobile");
const mobileFiles = fs.readdirSync(mobileDir).filter(name => name.endsWith(".html"));
const mobileNames = new Set(mobileFiles);
const hrefPattern = /href=["']([^"']+)["']/gi;
for (const name of mobileFiles) {
  const html = fs.readFileSync(path.join(mobileDir, name), "utf8");
  if (/href=["']\.\.\/html\//.test(html)) errors.push(`${name}: link estático volta para /html`);
  if (!html.includes("release-1.7.1.css")) errors.push(`${name}: release-1.7.1.css ausente`);
  if (!html.includes("mobile-shell-v1.7.js")) errors.push(`${name}: mobile-shell-v1.7.js ausente`);
  if (!html.includes("mobile-native-v1.7.1.js")) errors.push(`${name}: mobile-native-v1.7.1.js ausente`);

  for (const match of html.matchAll(hrefPattern)) {
    const value = match[1];
    if (!value || value.startsWith("#") || /^(https?:|mailto:|tel:|javascript:|data:)/i.test(value)) continue;
    const clean = value.split(/[?#]/)[0];
    const basename = clean.split("/").pop();
    if (mobileNames.has(basename) && !clean.startsWith("/mobile/")) {
      errors.push(`${name}: destino de página mobile não é absoluto: ${value}`);
    }
    if (clean.startsWith("/mobile/")) {
      const target = path.join(root, clean.replace(/^\//, ""));
      if (!fs.existsSync(target)) errors.push(`${name}: destino mobile inexistente: ${value}`);
    }
  }
}

const jsDir = path.join(root, "js");
for (const file of fs.readdirSync(jsDir).filter(name => name.endsWith(".js"))) {
  const js = fs.readFileSync(path.join(jsDir, file), "utf8");
  if (/location\.(?:href|replace)\s*=\s*["'][^"']+\.html/i.test(js) || /location\.replace\(\s*["'][^"']+\.html/i.test(js)) {
    errors.push(`${file}: navegação HTML direta sem bhUrl()`);
  }
}

const uiSource = fs.readFileSync(path.join(root, "js", "ui.js"), "utf8");
if (/html\/admin\.html#[a-z]/i.test(uiSource)) errors.push("ui.js: navegação principal do admin ainda usa seção como página");
for (const legal of ["html/privacidade.html", "html/termos.html"]) {
  if (!uiSource.includes(legal)) errors.push(`ui.js: link legal ausente no drawer: ${legal}`);
}

const home = fs.readFileSync(path.join(mobileDir, "index.html"), "utf8");
if (!home.includes('href="/mobile/portal.html"')) errors.push("mobile/index.html: CTA Explorar não aponta explicitamente para /mobile/portal.html");
if (!home.includes("product-redesign.js")) errors.push("mobile/index.html: controlador de instalação PWA ausente");

if (errors.length) {
  console.error(`Roteamento mobile reprovado (${errors.length}):\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`Roteamento mobile 1.8.0: ${cases.length} casos dinâmicos + ${mobileFiles.length} páginas + navegação JS aprovados.`);
