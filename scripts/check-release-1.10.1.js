/** Regressões da conclusão pós-31 — Barber Hub 1.10.1. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

const storage = new Map();
const sandbox = {
  window:null,
  Date,
  crypto:{ randomUUID:() => "00000000-0000-4000-8000-000000000001" },
  sessionStorage:{
    getItem:key => storage.get(key) || null,
    setItem:(key,value) => storage.set(key,value),
    removeItem:key => storage.delete(key),
    key:index => [...storage.keys()][index] || null,
    get length(){ return storage.size; }
  }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(read("js/core/operation-draft.js"), sandbox);
const first = sandbox.bhOperationDraft.begin("user:shop", "expense", { valor:"20" }, { valor:20 });
const repeated = sandbox.bhOperationDraft.begin("user:shop", "expense", { valor:"99" }, { valor:99 });
check(first.chave_idempotencia === repeated.chave_idempotencia && repeated.valor === 20, "reenvio incerto precisa repetir exatamente o payload persistido");
sandbox.bhOperationDraft.release("user:shop", "expense");
const corrected = sandbox.bhOperationDraft.begin("user:shop", "expense", { valor:"25" }, { valor:25 });
check(corrected.chave_idempotencia === first.chave_idempotencia && corrected.valor === 25, "erro conclusivo deve liberar correção preservando a chave do rascunho");

const migration = read("supabase/migrations/20260904180741_32_conclusao_pos31_1_10_1.sql").toLowerCase();
const verifier = read("sql/verificar_32_conclusao_1_10_1.sql").toLowerCase();
const api = read("api/index.py");
const push = read("backend/services/push.py");
const portalApi = read("js/api.js");
const portal = read("js/portal.js") + read("html/portal.html");
const registration = read("js/onboarding.js") + read("html/cadastro-barbearia.html");
const publicPage = read("js/barbearia.js");
const panel = read("html/painel.html");
const sw = read("service-worker.js");
const beauty = read("html/beauty-hub.html");
const releaseCss = read("css/releases/release-1.10.css");
const completionReport = read("docs/RELATORIO_CONCLUSAO_PLANEJAMENTO_POS31_1_10_1.md");
const openapi = read("docs/barberhub-api-v1.openapi.yaml");
const vercel = JSON.parse(read("vercel.json"));

for (const marker of ["funcionalidade_habilitada_1101", "metas_crescimento", "buscar_marketplace_regional_1101", "reivindicar_entregas_push_1101", "for update skip locked", "servicos_publicos_estabelecimento_preco_1101_idx"]) {
  check(migration.includes(marker), `migration 32 não contém ${marker}`);
}
check(!migration.includes("metas_operacionais"), "migration 32 usa nome inexistente para a tabela de metas");
check(migration.includes("revoke execute on function public.buscar_marketplace_regional_110"), "RPC regional antigo precisa ser revogado");
check(verifier.includes("has_function_privilege") && verifier.includes("planos"), "verificador 32 precisa testar privilégios e plano");
check(api.includes('@app.get("/api/v1/jobs/push/deliver")') && api.includes("Bearer "), "Cron precisa usar GET e autenticação Bearer");
check(push.includes("webpush_async") && push.includes("reivindicar_entregas_push_1101") && push.includes("attempts >= 5") && push.includes("horario_silencioso"), "worker push precisa reivindicar, enviar, limitar tentativas e respeitar silêncio");
check(Array.isArray(vercel.crons) && vercel.crons.some(item => item.path.includes("jobs/push/deliver")), "Vercel precisa registrar o agendador de push");
check(portal.includes("filtroServico") && portal.includes("filtroPrecoMin") && portal.includes("filtroAvaliacao"), "portal precisa expor serviço, preço e avaliação");
check(portalApi.includes("Nenhum resultado diferente do filtro foi exibido"), "fallback não pode exibir resultados incompatíveis com filtros avançados");
check(registration.includes("coverLibrary") && registration.includes("data-onboarding-cover"), "cadastro precisa oferecer biblioteca oficial de capas");
check(publicPage.includes('continuation.action === "favorite"') && publicPage.includes('continuation.action === "review"'), "favorito e avaliação precisam retomar depois do login");
check(panel.includes('<option value="metas">Metas</option>'), "histórico precisa filtrar as novas áreas auditadas");
check(sw.includes("barberhub-v1.10.1-mobile-r1") && sw.includes("./js/core/operation-draft.js"), "PWA precisa publicar a correção e proteger rascunhos offline");
check(beauty.includes("css/releases/release-1.10.css") && releaseCss.includes("page-beauty-hub .reveal-ready"), "Beauty Hub precisa carregar a release atual e não ocultar conteúdo por animação");
check(completionReport.includes("Matriz item a item") && completionReport.includes("Entrevistas com barbeiros"), "relatório final precisa comparar o documento sem inventar validação externa");
check(openapi.includes("version: 1.6.1") && openapi.includes("/api/v1/jobs/push/deliver"), "fotografia OpenAPI precisa refletir a API 1.6.1");
check(read("package.json").includes('"version": "1.10.1"') && api.includes('API_VERSION = "1.6.1"'), "versões do frontend e da API não estão alinhadas");
for (const moved of ["js/booking-modal.js", "js/painel-operacao-1.9.js", "js/painel-retencao-1.9.3.js"]) {
  check(!fs.existsSync(path.join(root, moved)), `módulo antigo ainda existe fora da estrutura organizada: ${moved}`);
}

if (errors.length) {
  console.error(`Regressões 1.10.1 reprovadas:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log("Regressões Barber Hub 1.10.1 aprovadas.");
