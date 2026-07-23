/**
 * Verificação rápida sem dependências externas.
 * Confirma arquivos centrais da interface e da API antes do commit.
 */
const fs = require("node:fs");
const path = require("node:path");

const root = path.resolve(__dirname, "..");
const required = [
  "index.html",
  "html/contato.html",
  "html/planos.html",
  "css/release-1.4.1.css",
  "js/backend-api.js",
  "api/v1/health.js",
  "api/v1/catalog/summary.js",
  "api/v1/support/tickets.js",
  "api/v1/account/delete.js",
  "api/v1/admin/overview.js"
];

const missing = required.filter(file => !fs.existsSync(path.join(root, file)));
if (missing.length) {
  console.error("Arquivos ausentes:\n- " + missing.join("\n- "));
  process.exit(1);
}

console.log(`Barber Hub 1.4.1: ${required.length} arquivos centrais encontrados.`);
