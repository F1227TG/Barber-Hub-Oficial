let bhOnboardingStep = 1;
const BH_TOTAL_STEPS = 4;

function bhAtualizarStepper() {
  document.querySelectorAll("[data-step-panel]").forEach(panel => {
    panel.classList.toggle("ativo", Number(panel.dataset.stepPanel) === bhOnboardingStep);
  });
  document.querySelectorAll("[data-step-indicator]").forEach(indicador => {
    const numero = Number(indicador.dataset.stepIndicator);
    indicador.classList.toggle("ativo", numero === bhOnboardingStep);
    indicador.classList.toggle("concluido", numero < bhOnboardingStep);
  });
  document.getElementById("btnVoltarStep").classList.toggle("hidden", bhOnboardingStep === 1);
  document.getElementById("btnAvancarStep").classList.toggle("hidden", bhOnboardingStep === BH_TOTAL_STEPS);
  document.getElementById("btnFinalizarOnboarding").classList.toggle("hidden", bhOnboardingStep !== BH_TOTAL_STEPS);
}

function bhValidarStep(step) {
  const obrigatorios = [...document.querySelectorAll(`[data-step-panel="${step}"] [required]`)];
  let valido = true;
  obrigatorios.forEach(campo => {
    if (!validarCampo(campo)) valido = false;
  });
  if (!valido) mostrarToast("erro", "Etapa incompleta", "Preencha os campos obrigatórios antes de continuar.");
  return valido;
}

function bhColetarHorarios() {
  return [...document.querySelectorAll(".horario-config")].map(row => {
    const dia = Number(row.dataset.dia);
    const aberto = row.querySelector("[data-horario-aberto]").checked;
    return {
      dia_semana: dia,
      aberto,
      abre: aberto ? row.querySelector("[data-horario-abre]").value : null,
      fecha: aberto ? row.querySelector("[data-horario-fecha]").value : null
    };
  });
}

function bhConfigurarPreview(inputId, previewId) {
  const input = document.getElementById(inputId);
  const preview = document.getElementById(previewId);
  input?.addEventListener("change", () => {
    const file = input.files?.[0];
    if (!file) return;
    preview.src = URL.createObjectURL(file);
    preview.classList.remove("hidden");
  });
}

document.addEventListener("DOMContentLoaded", async () => {
  marcarMenuAtivo("cadastro");
  const perfil = await bhRequireAuth(["barbeiro", "admin"]);
  if (!perfil) return;
  if (perfil.tipo === "barbeiro" && perfil.onboarding_concluido) {
    location.href = "painel.html";
    return;
  }

  document.getElementById("profissionalNome").value = perfil.nome || "";
  document.getElementById("emailPublico").value = perfil.email || "";
  document.getElementById("telefone").value = perfil.telefone || "";
  document.getElementById("whatsapp").value = perfil.telefone || "";

  ["telefone", "whatsapp"].forEach(id => {
    const campo = document.getElementById(id);
    campo?.addEventListener("input", () => { campo.value = bhMascaraTelefone(campo.value); });
  });
  const cep = document.getElementById("cep");
  cep?.addEventListener("input", () => { cep.value = bhMascaraCEP(cep.value); });

  document.querySelectorAll("[data-horario-aberto]").forEach(check => {
    check.addEventListener("change", () => {
      const row = check.closest(".horario-config");
      row.classList.toggle("fechado", !check.checked);
      row.querySelectorAll("input[type='time']").forEach(input => { input.disabled = !check.checked; });
    });
  });

  bhConfigurarPreview("fotoArquivo", "fotoPreview");
  bhConfigurarPreview("capaArquivo", "capaPreview");

  document.getElementById("btnAvancarStep").addEventListener("click", () => {
    if (!bhValidarStep(bhOnboardingStep)) return;
    bhOnboardingStep = Math.min(BH_TOTAL_STEPS, bhOnboardingStep + 1);
    bhAtualizarStepper();
    scrollTo({ top: 0, behavior: "smooth" });
  });
  document.getElementById("btnVoltarStep").addEventListener("click", () => {
    bhOnboardingStep = Math.max(1, bhOnboardingStep - 1);
    bhAtualizarStepper();
  });

  document.getElementById("formOnboarding").addEventListener("submit", async evento => {
    evento.preventDefault();
    if (!bhValidarStep(4)) return;
    const botao = document.getElementById("btnFinalizarOnboarding");
    bhSetButtonLoading(botao, true, "Criando seu espaço...");
    try {
      const foto = document.getElementById("fotoArquivo").files?.[0];
      const capa = document.getElementById("capaArquivo").files?.[0];
      const [fotoUrl, capaUrl] = await Promise.all([
        foto ? bhUploadImagem(foto, "estabelecimento/foto") : Promise.resolve(null),
        capa ? bhUploadImagem(capa, "estabelecimento/capa") : Promise.resolve(null)
      ]);
      const payload = {
        tipoEstabelecimento: document.getElementById("tipoEstabelecimento").value,
        nome: document.getElementById("nomeEstabelecimento").value.trim(),
        descricao: document.getElementById("descricao").value.trim(),
        emailPublico: document.getElementById("emailPublico").value.trim(),
        telefone: document.getElementById("telefone").value.trim(),
        whatsapp: document.getElementById("whatsapp").value.trim(),
        instagram: document.getElementById("instagram").value.trim(),
        cep: document.getElementById("cep").value.trim(),
        cidade: document.getElementById("cidade").value.trim(),
        estado: document.getElementById("estado").value.trim(),
        bairro: document.getElementById("bairro").value.trim(),
        endereco: document.getElementById("endereco").value.trim(),
        numero: document.getElementById("numero").value.trim(),
        complemento: document.getElementById("complemento").value.trim(),
        aceitaAgendamento: document.getElementById("aceitaAgendamento").checked,
        horarios: bhColetarHorarios(),
        servico: {
          nome: document.getElementById("servicoNome").value.trim(),
          categoria: document.getElementById("servicoCategoria").value.trim(),
          descricao: document.getElementById("servicoDescricao").value.trim(),
          preco: Number(document.getElementById("servicoPreco").value),
          duracao_min: Number(document.getElementById("servicoDuracao").value)
        },
        profissionalNome: document.getElementById("profissionalNome").value.trim(),
        profissionalEspecialidade: document.getElementById("profissionalEspecialidade").value.trim(),
        fotoUrl,
        capaUrl
      };
      await bhCriarEstabelecimentoInicial(payload);
      mostrarToast("sucesso", "Cadastro concluído", "Sua página e seu painel já estão disponíveis.");
      setTimeout(() => { location.href = "painel.html"; }, 700);
    } catch (erro) {
      mostrarToast("erro", "Não foi possível concluir", bhErroMensagem(erro));
    } finally {
      bhSetButtonLoading(botao, false);
    }
  });
  bhAtualizarStepper();
});
