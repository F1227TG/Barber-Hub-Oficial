let bhToastTimer;

function mostrarToast(tipo = "info", titulo = "Barber Hub", mensagem = "") {
  let toast = document.getElementById("toast");
  if (!toast) {
    toast = document.createElement("div");
    toast.id = "toast";
    toast.className = "toast";
    document.body.appendChild(toast);
  }

  const icones = {
    sucesso: "bi-check-circle-fill",
    erro: "bi-x-circle-fill",
    aviso: "bi-exclamation-triangle-fill",
    info: "bi-info-circle-fill"
  };

  clearTimeout(bhToastTimer);
  toast.className = `toast ${tipo}`;
  toast.innerHTML = `
    <i class="bi ${icones[tipo] || icones.info} icone"></i>
    <div><strong>${escapeHTML(titulo)}</strong><p>${escapeHTML(mensagem)}</p></div>
  `;
  requestAnimationFrame(() => toast.classList.add("ativo"));
  bhToastTimer = setTimeout(() => toast.classList.remove("ativo"), 4200);
}
