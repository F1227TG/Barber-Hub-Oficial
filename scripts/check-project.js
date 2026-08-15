/**
 * Auditoria local do Barber Hub 1.7.2 hotfix.
 *
 * Não depende de bibliotecas externas. O script verifica estrutura, referências
 * locais, IDs duplicados, presença da API Python e vazamento acidental de
 * segredos antes do commit.
 */
const fs = require("node:fs");
const path = require("node:path");
const { spawnSync } = require("node:child_process");

const root = path.resolve(__dirname, "..");
const required = [
  "index.html",
  "html/portal.html",
  "html/barbearia.html",
  "html/agendamento.html",
  "html/cliente.html",
  "html/painel.html",
  "html/admin.html",
  "html/contato.html",
  "html/mapa-sistema.html",
  "css/product-redesign.css",
  "css/release-1.6.css",
  "css/release-1.7.css",
  "css/release-1.7.1.css",
  "js/product-redesign.js",
  "js/booking-modal.js",
  "js/device-router.js",
  "js/mobile-shell-v1.7.js",
  "js/mobile-native-v1.7.1.js",
  "js/backend-api.js",
  "api/index.py",
  "backend/config.py",
  "backend/security.py",
  "backend/services/appointments.py",
  "backend/services/catalog.py",
  "backend/services/management.py",
  "backend/rate_limit.py",
  "sql/14_api_python_agendamento_multisservicos.sql",
  "sql/15_marketplace_fts_api_seguranca.sql",
  "mobile/index.html",
  "mobile/portal.html",
  "docs/PRD_BARBER_HUB.md",
  ".agents/rules/00-project-context.md",
  ".agents/skills/barberhub-release/SKILL.md",
  "ARCHITECTURE.md"
];

const errors = [];
const warnings = [];
const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) errors.push(`Arquivos ausentes:\n- ${missing.join("\n- ")}`);

function walk(directory, extension) {
  const output = [];
  for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
    if ([".git", "node_modules", ".venv", "__pycache__"].includes(entry.name)) continue;
    const full = path.join(directory, entry.name);
    if (entry.isDirectory()) output.push(...walk(full, extension));
    else if (!extension || entry.name.endsWith(extension)) output.push(full);
  }
  return output;
}

const htmlFiles = walk(root, ".html");
const referencePattern = /(?:href|src)=["']([^"']+)["']/gi;
const idPattern = /\sid=["']([^"']+)["']/gi;

for (const file of htmlFiles) {
  const html = fs.readFileSync(file, "utf8");
  const ids = new Map();
  for (const match of html.matchAll(idPattern)) {
    ids.set(match[1], (ids.get(match[1]) || 0) + 1);
  }
  const duplicateIds = [...ids.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  if (duplicateIds.length) {
    errors.push(`${path.relative(root, file)} possui IDs duplicados: ${duplicateIds.join(", ")}`);
  }

  for (const match of html.matchAll(referencePattern)) {
    const value = match[1].trim();
    if (!value || value.startsWith("#") || /^(https?:|mailto:|tel:|data:|javascript:)/i.test(value)) continue;
    const clean = value.split(/[?#]/)[0];
    if (!clean) continue;
    const target = clean.startsWith("/")
      ? path.resolve(root, `.${clean}`)
      : path.resolve(path.dirname(file), clean);
    if (!fs.existsSync(target)) {
      errors.push(`${path.relative(root, file)} referencia arquivo inexistente: ${value}`);
    }
  }

  const rel = path.relative(root, file).replaceAll("\\", "/");
  const minimalPages = new Set(["offline.html", "html/agendamento.html", "mobile/agendamento.html", "mobile/index.html"]);
  if (!html.includes("product-redesign.css") && !minimalPages.has(rel)) {
    warnings.push(`${rel} não carrega product-redesign.css.`);
  }
  if (!html.includes("release-1.6.css") && !rel.endsWith("offline.html")) {
    errors.push(`${rel} não carrega release-1.6.css.`);
  }
  if (!html.includes("release-1.7.css") && !rel.endsWith("offline.html") && !["cadastro.html","listagem.html"].includes(rel)) {
    errors.push(`${rel} não carrega release-1.7.css.`);
  }
  if (!html.includes("release-1.7.1.css") && !rel.endsWith("offline.html") && !["cadastro.html","listagem.html"].includes(rel)) {
    errors.push(`${rel} não carrega release-1.7.1.css.`);
  }
}

// Validação sintática de todos os módulos JavaScript do projeto.
const jsFiles = walk(path.join(root, "js"), ".js");
for (const file of jsFiles) {
  const result = spawnSync(process.execPath, ["--check", file], { encoding: "utf8" });
  if (result.status !== 0) {
    errors.push(`${path.relative(root, file)} possui erro de sintaxe JavaScript: ${result.stderr.trim()}`);
  }
}

const publicFiles = [
  ...walk(path.join(root, "js")),
  ...walk(path.join(root, "html")),
  path.join(root, "index.html")
].filter(file => fs.statSync(file).isFile());
const secretPattern = /(sb_secret_[A-Za-z0-9_-]{12,}|service_role[^\n]{0,30}eyJ[A-Za-z0-9_-]+)/i;
for (const file of publicFiles) {
  const content = fs.readFileSync(file, "utf8");
  if (secretPattern.test(content)) errors.push(`Possível segredo encontrado em ${path.relative(root, file)}.`);
}

const migration14 = fs.readFileSync(path.join(root, "sql/14_api_python_agendamento_multisservicos.sql"), "utf8");
for (const expected of ["agendamento_servicos", "criar_agendamento_multisservico", "begin;", "commit;"]) {
  if (!migration14.toLowerCase().includes(expected.toLowerCase())) errors.push(`Migration 14 não contém: ${expected}`);
}
const migration15 = fs.readFileSync(path.join(root, "sql/15_marketplace_fts_api_seguranca.sql"), "utf8");
for (const expected of ["buscar_marketplace", "websearch_to_tsquery", "using gin", "consumir_api_rate_limit", "auditoria_admin", "commit;"]) {
  if (!migration15.toLowerCase().includes(expected.toLowerCase())) errors.push(`Migration 15 não contém: ${expected}`);
}

if (errors.length) {
  console.error(`\nAuditoria reprovada (${errors.length} problema(s)):\n\n${errors.join("\n\n")}`);
  process.exit(1);
}

console.log(`Barber Hub 1.7.2: ${required.length} arquivos centrais encontrados.`);
console.log(`${htmlFiles.length} páginas HTML verificadas, sem IDs duplicados ou links locais quebrados.`);
console.log(`${jsFiles.length} arquivos JavaScript passaram por node --check.`);
console.log("Nenhuma chave secreta foi encontrada nos arquivos públicos auditados.");
if (warnings.length) console.warn(`Avisos (${warnings.length}):\n- ${warnings.join("\n- ")}`);
