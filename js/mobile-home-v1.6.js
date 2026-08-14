document.addEventListener("DOMContentLoaded", async () => {
  try {
    const data = window.bhBackendApi ? await window.bhBackendApi.catalogSummary() : null;
    if (data) {
      document.getElementById("mobileStatPlaces").textContent = data.estabelecimentos ?? "—";
      document.getElementById("mobileStatAgenda").textContent = data.agendamentos ?? "—";
    }
  } catch (_) {}
});
