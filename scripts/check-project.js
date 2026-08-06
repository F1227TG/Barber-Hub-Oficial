/**
 * Auditoria local do Barber Hub 1.5.0.
 *
 * Não depende de bibliotecas externas. O script verifica estrutura, referências
 * locais, IDs duplicados, presença da API Python e vazamento acidental de
 * segredos antes do commit.
 */
const fs = require("node:fs");
const path = require("node:path");

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
  "js/product-redesign.js",
  "js/backend-api.js",
  "api/index.py",
  "backend/config.py",
  "backend/security.py",
  "backend/services/appointments.py",
  "sql/14_api_python_agendamento_multisservicos.sql",
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
    const target = path.resolve(path.dirname(file), clean);
    if (!fs.existsSync(target)) {
      errors.push(`${path.relative(root, file)} referencia arquivo inexistente: ${value}`);
    }
  }

  if (!html.includes("product-redesign.css") && !file.endsWith("offline.html")) {
    warnings.push(`${path.relative(root, file)} não carrega product-redesign.css.`);
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

const migration = fs.readFileSync(path.join(root, "sql/14_api_python_agendamento_multisservicos.sql"), "utf8");
for (const expected of ["agendamento_servicos", "criar_agendamento_multisservico", "begin;", "commit;"]) {
  if (!migration.toLowerCase().includes(expected.toLowerCase())) {
    errors.push(`Migration 14 não contém: ${expected}`);
  }
}

if (errors.length) {
  console.error(`\nAuditoria reprovada (${errors.length} problema(s)):\n\n${errors.join("\n\n")}`);
  process.exit(1);
}

console.log(`Barber Hub 1.5.0: ${required.length} arquivos centrais encontrados.`);
console.log(`${htmlFiles.length} páginas HTML verificadas, sem IDs duplicados ou links locais quebrados.`);
console.log("Nenhuma chave secreta foi encontrada nos arquivos públicos auditados.");
if (warnings.length) console.warn(`Avisos (${warnings.length}):\n- ${warnings.join("\n- ")}`);
