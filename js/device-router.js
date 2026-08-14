/**
 * Direciona telas pequenas para a interface HTML dedicada em /mobile.
 * ?desktop=1 mantém a versão web quando o usuário desejar.
 */
(function routeMobile() {
  if (location.pathname.includes("/mobile/")) return;
  const params = new URLSearchParams(location.search);
  if (params.get("desktop") === "1" || localStorage.getItem("bh_force_desktop") === "1") return;
  const smallScreen = matchMedia("(max-width: 760px)").matches;
  const installed = matchMedia("(display-mode: standalone)").matches || navigator.standalone === true;
  if (!smallScreen && !installed) return;

  const path = location.pathname;
  let target = null;
  if (/\/(index\.html)?$/.test(path)) target = "/mobile/index.html";
  else if (path.includes("/html/")) target = path.replace("/html/", "/mobile/");
  if (!target) return;
  location.replace(`${target}${location.search}${location.hash}`);
})();
