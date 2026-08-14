/**
 * Compatibilidade da antiga página de agendamento.
 * Desde a versão 1.6 o fluxo abre dentro da página do estabelecimento.
 */
document.addEventListener("DOMContentLoaded", () => {
  const params = new URLSearchParams(location.search);
  const id = params.get("barbearia") || params.get("id");
  if (!id) {
    location.replace("portal.html");
    return;
  }
  const next = new URLSearchParams();
  next.set("id", id);
  next.set("agendar", "1");
  ["servico", "servicos", "profissional"].forEach(key => {
    const value = params.get(key);
    if (value) next.set(key, value);
  });
  location.replace(`barbearia.html?${next.toString()}`);
});
