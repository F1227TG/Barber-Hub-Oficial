/** Teste de regressão para caminhos gerados por bhUrl() em root/html/mobile. */
const fs = require("node:fs");
const vm = require("node:vm");
const path = require("node:path");

const source = fs.readFileSync(path.join(__dirname, "..", "js", "utils.js"), "utf8");

function evaluate(pathname) {
  const context = {
    location: { pathname, href: `https://barberhuboficial.vercel.app${pathname}`, protocol: "https:" },
    window: { location: { href: `https://barberhuboficial.vercel.app${pathname}` } },
    URL,
    URLSearchParams,
    Date,
    Intl,
    console,
    setTimeout,
    clearTimeout,
  };
  vm.createContext(context);
  vm.runInContext(source, context, { filename: "utils.js" });
  return context;
}

const cases = [
  ["/index.html", "html/portal.html", "/html/portal.html"],
  ["/html/cliente.html", "html/portal.html", "/html/portal.html"],
  ["/mobile/cliente.html", "html/portal.html", "/mobile/portal.html"],
  ["/mobile/cliente.html", "html/conta.html", "/mobile/conta.html"],
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

const mobileDir = path.join(__dirname, "..", "mobile");
const mobileFiles = fs.readdirSync(mobileDir).filter(name => name.endsWith(".html"));
for (const name of mobileFiles) {
  const html = fs.readFileSync(path.join(mobileDir, name), "utf8");
  if (/href=["']\.\.\/html\//.test(html)) errors.push(`${name}: link estático volta para /html em vez de permanecer no mobile`);
  if (!html.includes("release-1.7.css")) errors.push(`${name}: release-1.7.css ausente`);
  if (!html.includes("mobile-shell-v1.7.js")) errors.push(`${name}: mobile-shell-v1.7.js ausente`);
}

const uiSource = fs.readFileSync(path.join(__dirname, "..", "js", "ui.js"), "utf8");
if (/html\/admin\.html#[a-z]/i.test(uiSource)) {
  errors.push("ui.js: navegação principal do admin ainda contém atalhos para seções da própria página");
}

if (errors.length) {
  console.error(`Roteamento mobile reprovado:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log(`Roteamento mobile: ${cases.length} casos dinâmicos + ${mobileFiles.length} páginas estáticas aprovados.`);
