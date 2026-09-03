/** Regressões funcionais, de segurança e mobile da versão 1.10.0. */
const fs = require("node:fs");
const path = require("node:path");
const vm = require("node:vm");

const root = path.resolve(__dirname, "..");
const read = relative => fs.readFileSync(path.join(root, relative), "utf8");
const errors = [];
const check = (condition, message) => { if (!condition) errors.push(message); };

const continuation = read("js/core/continuation.js");
const operation = read("js/features/operation-real-1.10.js");
const panelOperation = read("js/painel-operacao-1.9.js");
const panel = read("html/painel.html");
const publicPage = read("js/barbearia.js");
const statusRules = read("js/status.js");
const portal = read("js/portal.js");
const admin = read("html/admin.html") + read("js/admin.js");
const css = read("css/releases/release-1.10.css");
const sw = read("service-worker.js");
const migration29 = read("sql/29_operacao_real_horarios_atendimentos_1_10.sql").toLowerCase();
const migration30 = read("sql/30_localizacao_biblioteca_marketplace_1_10.sql").toLowerCase();
const migration31 = read("sql/31_push_importacoes_auditoria_flags_1_10.sql").toLowerCase();

const storage = new Map();
const sandbox = {
  window: null,
  URL,
  URLSearchParams,
  Blob,
  Date,
  location: { href:"https://barberhuboficial.vercel.app/html/login.html", search:"" },
  localStorage: { setItem:(key, value) => storage.set(key, value), getItem:key => storage.get(key) || null, removeItem:key => storage.delete(key) }
};
sandbox.window = sandbox;
vm.createContext(sandbox);
vm.runInContext(continuation, sandbox);
check(sandbox.bhContinuation.safeNext("/html/painel.html#agenda") === "/html/painel.html#agenda", "destino interno válido precisa ser preservado");
check(sandbox.bhContinuation.safeNext("https://evil.example/roubo", "/") === "/", "destino externo precisa ser rejeitado");
check(sandbox.bhContinuation.safeNext("//evil.example", null) === null, "URL relativa a protocolo precisa ser rejeitada");
const captured = sandbox.bhContinuation.capture("booking", { date:"2026-09-02", slot:"14:30" }, "/html/barbearia.html?id=1");
check(captured.payload.slot === "14:30" && sandbox.bhContinuation.peek("booking").payload.date === "2026-09-02", "contexto completo da ação precisa sobreviver à autenticação");

sandbox.bhDataISO = date => `${date.getFullYear()}-${String(date.getMonth()+1).padStart(2,"0")}-${String(date.getDate()).padStart(2,"0")}`;
sandbox.bhMinutos = value => { const [h,m] = String(value).split(":").map(Number); return h*60+m; };
sandbox.escapeHTML = value => String(value);
vm.runInContext(statusRules, sandbox);
const schedule = { statusManual:"automatico", diasFechados:[], horarios:{}, horariosPeriodos:{ segunda:[{abre:"08:00",fecha:"12:00"},{abre:"14:00",fecha:"18:00"}] } };
check(!sandbox.bhCalcularStatus(schedule, new Date(2026,8,7,13,0)).aberta, "intervalo entre períodos precisa aparecer fechado");
check(sandbox.bhCalcularStatus(schedule, new Date(2026,8,7,15,0)).aberta, "segundo período do dia precisa aparecer aberto");
check(sandbox.bhHorarioPorDiaLabel(schedule)[1].texto.includes("14:00"), "perfil público precisa listar todos os períodos do dia");

for (const marker of ["replaceOpeningPeriods", "createManualService", "createExpense", "previewImport", "listImports", "subscribePush", "operationalAudit", "evaluateFeatures"]) {
  check(operation.includes(marker), `operação 1.10 não contém ${marker}`);
}
check(operation.includes("data-period-copy") && operation.includes("data-period-copy-apply"), "horários precisam copiar períodos entre dias");
check(panel.includes("finance-presets110") && panel.includes('data-operation110="expense"'), "financeiro mobile precisa oferecer períodos rápidos e gasto");
check(panelOperation.includes("financeMore110") && panelOperation.includes("data-crm-more"), "financeiro e CRM precisam de carregamento progressivo");
check(publicPage.includes("data-portfolio-more") && publicPage.includes("data-reviews-more"), "portfólio e avaliações públicas precisam de carregamento progressivo");
check(portal.includes("bhBuscarMarketplaceRegional") && portal.includes("navigator.geolocation"), "marketplace precisa oferecer filtros regionais e perto de mim");
check(publicPage.includes("openstreetmap.org") && publicPage.includes("Como chegar"), "página pública precisa oferecer mapa e rota");
check(admin.includes("adminReleaseGrid110") && admin.includes("bhAdminRenderRelease110"), "administração precisa mostrar prontidão do lançamento");
check(admin.includes("data-admin-more") && read("js/backend-api.js").includes("adminRecords"), "listas administrativas precisam de paginação progressiva");
check(css.includes("@media(max-width:380px)") && css.includes("admin-release-grid110"), "novos módulos precisam responder em telas compactas");
check(sw.includes("barberhub-v1.10-mobile-r2") && sw.includes("self.addEventListener('push'"), "PWA precisa atualizar cache e receber avisos permitidos");

for (const [name, sql, markers] of [
  ["29", migration29, ["estabelecimento_horario_periodos", "registrar_atendimento_manual_110", "registrar_despesa_110"]],
  ["30", migration30, ["biblioteca_capas", "buscar_marketplace_regional_110", "atualizar_localizacao_estabelecimento_110"]],
  ["31", migration31, ["push_assinaturas", "importacoes_operacionais", "auditoria_operacional", "feature_flags"]]
]) {
  check(sql.includes("begin;") && sql.includes("commit;"), `migration ${name} precisa ser transacional`);
  markers.forEach(marker => check(sql.includes(marker), `migration ${name} não contém ${marker}`));
  check(sql.includes("set search_path = ''") || sql.includes("set search_path=''"), `migration ${name} precisa fixar search_path em funções privilegiadas`);
}
check(migration31.includes("revoke all on function public.confirmar_importacao_110"), "confirmação de importação precisa revogar execução pública");
check(migration29.includes("p_servico_nome text") && migration29.includes("p_duracao_min integer"), "atendimento manual precisa aceitar serviço avulso com duração validada");
check(migration31.includes("única mutação permitida: anonimização"), "auditoria imutável precisa permitir apenas anonimização de vínculos excluídos");
check(read("package.json").includes('"version": "1.10.0"'), "package precisa declarar a versão 1.10.0");

if (errors.length) {
  console.error(`Regressões 1.10 reprovadas:\n- ${errors.join("\n- ")}`);
  process.exit(1);
}
console.log("Regressões Barber Hub 1.10.0 aprovadas.");
