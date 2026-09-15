/**
 * utils.js
 * Funções utilitárias de formatação, validação, escape e estados de carregamento.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

function bhBasePath() {
  const pathname = String(location.pathname || "");
  return pathname.includes("/html/") || pathname.includes("/mobile/") ? ".." : ".";
}

function bhUrl(caminho) {
  const limpo = String(caminho || "").replace(/^\/+/, "");
  const pathname = String(location.pathname || "");
  const mobile = pathname.includes("/mobile/");
  const fileProtocol = String(location.protocol || "") === "file:";

  // Em produção usamos caminhos desde a raiz do domínio. Isso mantém o destino
  // correto até quando a aplicação está renderizando a 404 para uma URL aninhada.
  // file:// conserva caminhos relativos para desenvolvimento local sem servidor.
  if (mobile) {
    const page = limpo.startsWith("html/")
      ? limpo.slice(5)
      : limpo.startsWith("mobile/")
        ? limpo.slice(7)
        : /^index\.html(?:[?#]|$)/.test(limpo)
          ? limpo
          : null;
    if (page) return fileProtocol ? `./${page}` : `/mobile/${page}`;
    return fileProtocol ? `../${limpo}` : `/${limpo}`;
  }

  if (fileProtocol) return `${bhBasePath()}/${limpo}`;
  return `/${limpo}`;
}

function bhAbsoluteUrl(caminho) {
  return new URL(bhUrl(caminho), window.location.href).href;
}

function bhHojeISO() {
  const data = new Date();
  data.setMinutes(data.getMinutes() - data.getTimezoneOffset());
  return data.toISOString().slice(0, 10);
}

function bhDataISO(data = new Date()) {
  const clone = new Date(data);
  clone.setMinutes(clone.getMinutes() - clone.getTimezoneOffset());
  return clone.toISOString().slice(0, 10);
}

function bhFormatarData(dataISO, opcoes = {}) {
  if (!dataISO) return "Data não informada";
  const data = new Date(`${dataISO}T00:00:00`);
  return data.toLocaleDateString("pt-BR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    ...opcoes
  });
}

function bhMoeda(valor) {
  return Number(valor || 0).toLocaleString("pt-BR", {
    style: "currency",
    currency: "BRL"
  });
}

function bhHoraCurta(valor) {
  return String(valor || "").slice(0, 5);
}

function bhMinutos(hora) {
  const [h, m] = bhHoraCurta(hora || "00:00").split(":").map(Number);
  return h * 60 + m;
}

function bhHoraDeMinutos(total) {
  const h = String(Math.floor(total / 60)).padStart(2, "0");
  const m = String(total % 60).padStart(2, "0");
  return `${h}:${m}`;
}

function escapeHTML(texto) {
  return String(texto ?? "").replace(/[&<>'"]/g, caractere => ({
    "&": "&amp;",
    "<": "&lt;",
    ">": "&gt;",
    "'": "&#39;",
    '"': "&quot;"
  })[caractere]);
}

function bhSlug(texto) {
  return String(texto || "")
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/(^-|-$)/g, "");
}

function bhSomenteNumeros(valor) {
  return String(valor || "").replace(/\D/g, "");
}

function bhMascaraTelefone(valor) {
  const digitos = bhSomenteNumeros(valor).slice(0, 11);
  if (digitos.length <= 2) return digitos;
  if (digitos.length <= 6) return `(${digitos.slice(0, 2)}) ${digitos.slice(2)}`;
  if (digitos.length <= 10) return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 6)}-${digitos.slice(6)}`;
  return `(${digitos.slice(0, 2)}) ${digitos.slice(2, 7)}-${digitos.slice(7)}`;
}

function bhMascaraCEP(valor) {
  const digitos = bhSomenteNumeros(valor).slice(0, 8);
  return digitos.length > 5 ? `${digitos.slice(0, 5)}-${digitos.slice(5)}` : digitos;
}

function bhNormalizarCNPJ(valor) {
  return String(valor || "").toUpperCase().replace(/[^A-Z0-9]/g, "").slice(0, 14);
}

function bhMascaraCNPJ(valor) {
  const text = bhNormalizarCNPJ(valor);
  const parts = [text.slice(0, 2), text.slice(2, 5), text.slice(5, 8), text.slice(8, 12), text.slice(12, 14)];
  let result = parts[0];
  if (parts[1]) result += `.${parts[1]}`;
  if (parts[2]) result += `.${parts[2]}`;
  if (parts[3]) result += `/${parts[3]}`;
  if (parts[4]) result += `-${parts[4]}`;
  return result;
}

function bhValidarCNPJ(valor) {
  const text = bhNormalizarCNPJ(valor);
  if (!/^[A-Z0-9]{12}[0-9]{2}$/.test(text) || /^([A-Z0-9])\1{13}$/.test(text)) return false;
  const digit = (base, weights) => {
    const sum = [...base].reduce((total, character, index) => total + (character.charCodeAt(0) - 48) * weights[index], 0);
    const remainder = sum % 11;
    return remainder < 2 ? 0 : 11 - remainder;
  };
  const first = digit(text.slice(0, 12), [5,4,3,2,9,8,7,6,5,4,3,2]);
  const second = digit(`${text.slice(0, 12)}${first}`, [6,5,4,3,2,9,8,7,6,5,4,3,2]);
  return text.endsWith(`${first}${second}`);
}

function bhDebounce(funcao, espera = 250) {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => funcao(...args), espera);
  };
}

function bhSetButtonLoading(botao, carregando, texto = "Aguarde...") {
  if (!botao) return;
  if (carregando) {
    botao.dataset.htmlOriginal = botao.innerHTML;
    botao.disabled = true;
    botao.innerHTML = `<i class="bi bi-arrow-repeat spin"></i> ${escapeHTML(texto)}`;
  } else {
    botao.disabled = false;
    if (botao.dataset.htmlOriginal) botao.innerHTML = botao.dataset.htmlOriginal;
  }
}

function bhErroMensagem(erro, fallback = "Não foi possível concluir a operação.") {
  const codigosApi = {
    RATE_LIMITED: "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
    CAPTCHA_REQUIRED: "Confirme a verificação anti-robô para continuar.",
    EMAIL_NOT_CONFIRMED: "Confirme seu e-mail antes de continuar.",
    INTERNAL_ERROR: "Não foi possível concluir a operação agora. Tente novamente em alguns instantes.",
    INVALID_SESSION: "Sua sessão expirou. Entre novamente para continuar.",
    UNAUTHORIZED: "Entre na conta para continuar.",
    FORBIDDEN: "Sua conta não possui permissão para esta ação.",
    BACKEND_NOT_CONFIGURED: "Este serviço ainda não está disponível neste ambiente.",
    API_TIMEOUT: "O servidor demorou para responder. Tente novamente.",
    UPSTREAM_RATE_LIMITED: "Muitas solicitações foram feitas em pouco tempo. Aguarde e tente novamente.",
    UPSTREAM_UNAVAILABLE: "Os serviços do Barber Hub estão temporariamente indisponíveis. Tente novamente em instantes."
  };
  if (erro?.code && codigosApi[erro.code]) return codigosApi[erro.code];
  if (Number(erro?.status) === 429) return "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.";
  if (Number(erro?.status) === 503) return "O Barber Hub está temporariamente indisponível. Tente novamente em alguns instantes.";

  const mensagem = erro?.message || erro?.error_description || fallback;
  const mapa = [
    ["Invalid login credentials", "E-mail ou senha incorretos."],
    ["Email not confirmed", "Confirme seu e-mail antes de entrar."],
    ["User already registered", "Este e-mail já possui cadastro."],
    ["Password should be at least", "A senha precisa ter no mínimo 8 caracteres, incluindo maiúscula, minúscula, número e caractere especial."],
    ["Password should contain", "A senha precisa incluir maiúscula, minúscula, número e caractere especial."],
    ["password is known to be weak", "Esta senha apareceu em vazamentos conhecidos. Escolha uma senha diferente."],
    ["new row violates row-level security", "Sua conta não tem permissão para esta ação."],
    ["duplicate key value", "Já existe um registro com essas informações."],
    ["agendamentos_sem_sobreposicao", "Este horário já foi ocupado."],
    ["Failed to fetch", "Falha de conexão. Confira sua internet e tente novamente."],
    ["email rate limit exceeded", "Muitas mensagens foram solicitadas em pouco tempo. Aguarde alguns minutos e tente novamente."],
    ["rate limit", "Limite temporário atingido. Aguarde alguns minutos antes de tentar novamente."],
    ["Network request failed", "Sem conexão com o servidor. Verifique a internet."],
    ["JWT expired", "Sua sessão expirou. Entre novamente para continuar."],
    ["violates check constraint", "Uma das informações enviadas é inválida."],
    ["not-null constraint", "Preencha todos os campos obrigatórios."],
    ["permission denied", "Você não tem permissão para realizar esta ação."]
  ];
  const achado = mapa.find(([trecho]) => mensagem.includes(trecho));
  if (achado) return achado[1];

  // Mensagens desconhecidas podem conter nomes de funções, tabelas, políticas
  // ou detalhes do provedor. Só reaproveitamos texto curto que já tenha forma
  // de orientação ao usuário; todo o restante recebe uma resposta neutra.
  const texto = String(mensagem || "").trim();
  const pareceTecnico = /(?:supabase|postgrest|pgrst|postgres|sqlstate|stack|traceback|javascript|typeerror|referenceerror|constraint|schema|relation|column|row-level|\brpc\b|\bjwt\b|\bnull\b|\bundefined\b|\bfunction\b|\bfun(?:ç|c)[aã]o\b|\.js:\d+|[a-z_]{3,}\([^)]*\))/i.test(texto);
  const pareceOrientacao = /^(?:selecione|informe|preencha|escolha|confirme|aguarde|revise|faça|você|sua|seu|não|este|esta|esse|essa|o\s|a\s)/i.test(texto);
  return texto.length <= 220 && pareceOrientacao && !pareceTecnico ? texto : fallback;
}

function bhQueryParam(nome) {
  return new URLSearchParams(location.search).get(nome);
}

function bhNormalizarWhatsApp(valor) {
  const digitos = bhSomenteNumeros(valor);
  if (!digitos) return "";
  return digitos.startsWith("55") ? digitos : `55${digitos}`;
}

const BH_REGRAS_SENHA = Object.freeze([
  Object.freeze({ chave: "tamanho", rotulo: "8 ou mais caracteres", testar: senha => senha.length >= 8 }),
  Object.freeze({ chave: "minuscula", rotulo: "uma letra minúscula", testar: senha => /[a-zà-öø-ÿ]/.test(senha) }),
  Object.freeze({ chave: "maiuscula", rotulo: "uma letra maiúscula", testar: senha => /[A-ZÀ-ÖØ-Þ]/.test(senha) }),
  Object.freeze({ chave: "numero", rotulo: "um número", testar: senha => /\d/.test(senha) }),
  Object.freeze({ chave: "especial", rotulo: "um caractere especial", testar: senha => /[^\p{L}\p{N}\s]/u.test(senha) })
]);

function bhAnalisarSenha(senha = "") {
  const valor = String(senha);
  const regras = BH_REGRAS_SENHA.map(regra => ({
    chave: regra.chave,
    rotulo: regra.rotulo,
    atendida: regra.testar(valor)
  }));
  const pendentes = regras.filter(regra => !regra.atendida);
  return {
    valida: pendentes.length === 0,
    regras,
    pendentes,
    mensagem: pendentes.length
      ? `Inclua ${pendentes.map(regra => regra.rotulo).join(", ")}.`
      : "A senha atende a todos os requisitos."
  };
}
