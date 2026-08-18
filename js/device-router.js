/**
 * Direciona telas pequenas para a interface HTML dedicada em /mobile.
 * ?desktop=1 mantém a versão web quando o usuário desejar.
 */
(function routeMobile() {
  if (location.pathname.includes("/mobile/")) return;
  const params = new URLSearchParams(location.search);
  let forceDesktop = false;
  try { forceDesktop = localStorage.getItem("bh_force_desktop") === "1"; } catch (_) {}
  if (params.get("desktop") === "1" || forceDesktop) return;
  const smallScreen = matchMedia("(max-width: 760px)").matches;
  const installed = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (!smallScreen && !installed) return;

  const path = location.pathname;
  const file = path.split("/").pop() || "index.html";
  let target = null;
  // URLs relativas resolvidas pelo navegador funcionam tanto no domínio quanto
  // ao abrir o pacote diretamente por file://. Caminhos iniciados por / quebram
  // no segundo caso porque apontam para file:///mobile/... fora do projeto.
  if (/\/(index\.html)?$/.test(path)) target = new URL("./mobile/index.html", location.href);
  else if (path.includes("/html/")) target = new URL(`../mobile/${file}`, location.href);
  if (!target) return;
  target.search = location.search;
  target.hash = location.hash;
  location.replace(target.href);
})();
