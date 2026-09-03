/** Internal navigation map now verifies the protected API endpoint in real time. */
document.addEventListener("DOMContentLoaded", async () => {
  const profile = await window.bhRequireAuth?.(["admin"]);
  if (!profile) return;
  document.body.classList.remove("auth-pending");
  marcarMenuAtivo("admin");
  const badge = document.querySelector("[data-navigation-audit-status]");
  try {
    if (!window.bhBackendApi?.navigationAudit) throw new Error("API indisponível");
    const data = await window.bhBackendApi.navigationAudit();
    if (badge) {
      badge.textContent = data?.status === "available" ? "API conectada" : "Verificar";
      badge.className = `map-status ${data?.status === "available" ? "ok" : "partial"}`;
    }
  } catch (_) {
    if (badge) { badge.textContent = "API indisponível"; badge.className = "map-status partial"; }
  }
});
