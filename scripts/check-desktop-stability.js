/** Barber Hub 1.7.4 — regressões de estabilidade desktop/PWA. */
const fs = require("node:fs");
const path = require("node:path");
const root = path.resolve(__dirname, "..");
const read = file => fs.readFileSync(path.join(root, file), "utf8");
const errors = [];
const sw = read("service-worker.js");
const ui = read("js/ui.js");
const home = read("js/home.js");
const api = read("js/api.js");
const mobileApp = read("js/mobile-app.js");
const css = read("css/release-1.7.4.css");
if (!sw.includes("barberhub-v1.7.4")) errors.push("cache PWA não está em 1.7.4");
if (!sw.includes("for (const asset of CORE)")) errors.push("pré-cache deixou de ser sequencial");
if (/Promise\.(?:all|allSettled)\s*\(\s*CORE\.map/.test(sw)) errors.push("pré-cache paralelo massivo voltou ao Service Worker");
if (sw.includes("cache.addAll(CORE)")) errors.push("cache.addAll(CORE) voltou ao Service Worker");
if (!sw.includes("const copy = response.clone()")) errors.push("clone seguro da Response ausente");
if (ui.includes("reg.update()") || ui.includes("reg=>reg.update")) errors.push("registro do SW voltou a forçar update em cada página");
if (!ui.includes("requestIdleCallback")) errors.push("registro do SW não está diferido para idle");
if (!home.includes("bhListarStatusEstabelecimentos()")) errors.push("home voltou a usar catálogo pesado para status");
if (home.includes("bhListarEstabelecimentos()")) errors.push("home ainda baixa catálogo completo");
if (!api.includes("async function bhListarStatusEstabelecimentos")) errors.push("consulta leve de status ausente");
if (!mobileApp.includes("max-width: 900px")) errors.push("mobile-app.js voltou a iniciar no desktop largo");
if (!css.includes("backdrop-filter: none !important")) errors.push("fallback de repaint do header desktop ausente");
if (errors.length) { console.error("Estabilidade desktop reprovada:\n- " + errors.join("\n- ")); process.exit(1); }
console.log("Estabilidade desktop/PWA 1.7.4: 12 invariantes aprovadas.");
