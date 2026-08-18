/** Regressão 1.8.0: impede ciclos do observador global sobre mutações de texto. */
const fs = require("node:fs");
const path = require("node:path");

const root = path.join(__dirname, "..");
const source = fs.readFileSync(path.join(root, "js", "product-redesign.js"), "utf8");
const serviceWorker = fs.readFileSync(path.join(root, "service-worker.js"), "utf8");
const errors = [];

if (!source.includes("label.textContent !== labelText")) {
  errors.push("o rótulo do instalador ainda pode ser reescrito sem mudança");
}
if (!source.includes("helper.textContent !== helperText")) {
  errors.push("o texto auxiliar do instalador ainda pode ser reescrito sem mudança");
}
if (!source.includes("record.addedNodes") || !source.includes("Node.ELEMENT_NODE")) {
  errors.push("o observador não filtra mutações para elementos relevantes");
}
if (!serviceWorker.includes("barberhub-v1.8.0-interface-responsive-r3")) {
  errors.push("a revisão do cache não foi atualizada para o hotfix de responsividade");
}

if (errors.length) {
  console.error(`Proteções de responsividade reprovadas:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}

console.log("Proteções contra ciclo de MutationObserver aprovadas.");
