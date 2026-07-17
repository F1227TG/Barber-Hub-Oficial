const BH_ESTABELECIMENTO_SELECT = `
  *,
  horarios_funcionamento(*),
  dias_bloqueados(*),
  profissionais(*),
  servicos(*),
  promocoes(*)
`;

const BH_DIAS_CHAVE = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

function bhNormalizarEstabelecimento(row) {
  if (!row) return null;
  const horarios = {};
  (row.horarios_funcionamento || []).forEach(item => {
    horarios[BH_DIAS_CHAVE[item.dia_semana]] = item.aberto
      ? { abre: bhHoraCurta(item.abre), fecha: bhHoraCurta(item.fecha), id: item.id }
      : null;
  });

  return {
    ...row,
    ownerId: row.owner_id,
    tipoEstabelecimento: row.tipo_estabelecimento,
    emailPublico: row.email_publico,
    fotoUrl: row.foto_url,
    capaUrl: row.capa_url,
    statusManual: row.status_manual,
    motivoStatus: row.motivo_status,
    aceitaAgendamento: row.aceita_agendamento,
    intervaloSlots: row.intervalo_slots_min,
    antecedenciaHoras: row.antecedencia_min_horas,
    limiteDias: row.limite_dias_agendamento,
    horarios,
    horariosRows: (row.horarios_funcionamento || []).sort((a, b) => a.dia_semana - b.dia_semana),
    diasFechados: (row.dias_bloqueados || []).map(item => ({
      id: item.id,
      data: item.data,
      motivo: item.motivo
    })),
    barbeiros: (row.profissionais || []).map(item => ({
      ...item,
      aceitaAgendamento: item.aceita_agendamento,
      avatar: item.nome.split(" ").map(parte => parte[0]).join("").slice(0, 2).toUpperCase()
    })),
    servicos: (row.servicos || []).map(item => ({
      ...item,
      duracao: item.duracao_min
    })),
    promocoes: row.promocoes || []
  };
}

async function bhListarEstabelecimentos({ tipo = null, busca = null } = {}) {
  const client = bhExigirSupabase();
  let query = client
    .from("estabelecimentos")
    .select(BH_ESTABELECIMENTO_SELECT)
    .eq("visivel", true)
    .eq("onboarding_concluido", true)
    .order("created_at", { ascending: false });

  if (tipo) query = query.eq("tipo_estabelecimento", tipo);
  if (busca) query = query.or(`nome.ilike.%${busca}%,cidade.ilike.%${busca}%,bairro.ilike.%${busca}%`);

  const { data, error } = await query;
  if (error) throw error;
  return (data || []).map(bhNormalizarEstabelecimento);
}

async function bhObterEstabelecimento(idOuSlug) {
  const client = bhExigirSupabase();
  let query = client.from("estabelecimentos").select(BH_ESTABELECIMENTO_SELECT);
  const uuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(String(idOuSlug || ""));
  query = uuid ? query.eq("id", idOuSlug) : query.eq("slug", idOuSlug);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return bhNormalizarEstabelecimento(data);
}

async function bhObterMeuEstabelecimento() {
  const perfil = await bhGetPerfil();
  if (!perfil) return null;
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("estabelecimentos")
    .select(BH_ESTABELECIMENTO_SELECT)
    .eq("owner_id", perfil.id)
    .maybeSingle();
  if (error) throw error;
  return bhNormalizarEstabelecimento(data);
}

async function bhCriarEstabelecimentoInicial(payload) {
  const client = bhExigirSupabase();
  const { data, error } = await client.rpc("criar_estabelecimento_inicial", {
    p_tipo_estabelecimento: payload.tipoEstabelecimento,
    p_nome: payload.nome,
    p_descricao: payload.descricao || "",
    p_email_publico: payload.emailPublico || null,
    p_telefone: payload.telefone || null,
    p_whatsapp: bhNormalizarWhatsApp(payload.whatsapp) || null,
    p_instagram: payload.instagram || null,
    p_cep: payload.cep || null,
    p_cidade: payload.cidade,
    p_estado: payload.estado || "MG",
    p_bairro: payload.bairro,
    p_endereco: payload.endereco,
    p_numero: payload.numero || null,
    p_complemento: payload.complemento || null,
    p_aceita_agendamento: Boolean(payload.aceitaAgendamento),
    p_horarios: payload.horarios,
    p_servico: payload.servico,
    p_profissional_nome: payload.profissionalNome,
    p_profissional_especialidade: payload.profissionalEspecialidade || "Profissional principal",
    p_foto_url: payload.fotoUrl || null,
    p_capa_url: payload.capaUrl || null
  });
  if (error) throw error;
  bhPerfilCache = null;
  return data;
}

async function bhAtualizarEstabelecimento(id, dados) {
  const client = bhExigirSupabase();
  const { error } = await client.from("estabelecimentos").update(dados).eq("id", id);
  if (error) throw error;
  return { id, ...dados };
}

async function bhSalvarHorarios(estabelecimentoId, horarios) {
  const client = bhExigirSupabase();
  const linhas = horarios.map(item => ({
    estabelecimento_id: estabelecimentoId,
    dia_semana: item.dia_semana,
    aberto: Boolean(item.aberto),
    abre: item.aberto ? item.abre : null,
    fecha: item.aberto ? item.fecha : null
  }));
  const { error } = await client
    .from("horarios_funcionamento")
    .upsert(linhas, { onConflict: "estabelecimento_id,dia_semana" });
  if (error) throw error;
}

async function bhUploadImagem(file, pasta = "geral") {
  if (!file) return null;
  if (!file.type.startsWith("image/")) throw new Error("Selecione um arquivo de imagem.");
  if (file.size > 5 * 1024 * 1024) throw new Error("A imagem deve ter no máximo 5 MB.");

  const user = await bhGetAuthUser();
  if (!user) throw new Error("Faça login para enviar imagens.");
  const client = bhExigirSupabase();
  const extensao = (file.name.split(".").pop() || "webp").toLowerCase().replace(/[^a-z0-9]/g, "");
  const caminho = `${user.id}/${bhSlug(pasta)}/${Date.now()}-${crypto.randomUUID()}.${extensao}`;
  const { error } = await client.storage.from("barberhub-public").upload(caminho, file, {
    cacheControl: "3600",
    upsert: false
  });
  if (error) throw error;
  const { data } = client.storage.from("barberhub-public").getPublicUrl(caminho);
  return data.publicUrl;
}

async function bhListarAgendamentosCliente() {
  const perfil = await bhGetPerfil();
  if (!perfil) return [];
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("agendamentos")
    .select(`
      *,
      estabelecimentos(nome,slug,tipo_estabelecimento),
      profissionais(nome),
      servicos(nome,duracao_min)
    `)
    .eq("cliente_id", perfil.id)
    .order("data", { ascending: false })
    .order("hora_inicio", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function bhListarAgendamentosEstabelecimento(estabelecimentoId) {
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("agendamentos")
    .select(`
      *,
      profissionais(nome),
      servicos(nome,duracao_min)
    `)
    .eq("estabelecimento_id", estabelecimentoId)
    .order("data", { ascending: false })
    .order("hora_inicio", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function bhObterHorariosOcupados(profissionalId, data) {
  const client = bhExigirSupabase();
  const { data: linhas, error } = await client.rpc("horarios_ocupados", {
    p_profissional_id: profissionalId,
    p_data: data
  });
  if (error) throw error;
  return (linhas || []).map(item => ({
    inicio: bhHoraCurta(item.hora_inicio),
    fim: bhHoraCurta(item.hora_fim)
  }));
}

async function bhCriarAgendamento(payload) {
  const client = bhExigirSupabase();
  const { data, error } = await client.rpc("criar_agendamento", {
    p_estabelecimento_id: payload.estabelecimentoId,
    p_profissional_id: payload.profissionalId,
    p_servico_id: payload.servicoId,
    p_data: payload.data,
    p_hora_inicio: payload.hora,
    p_observacao: payload.observacao || null
  });
  if (error) throw error;
  return data;
}

async function bhCancelarAgendamento(id, motivo = "Cancelado pelo cliente") {
  const client = bhExigirSupabase();
  const { error } = await client.rpc("cancelar_agendamento", {
    p_agendamento_id: id,
    p_motivo: motivo
  });
  if (error) throw error;
}

async function bhAtualizarStatusAgendamento(id, status) {
  const client = bhExigirSupabase();
  const { error } = await client
    .from("agendamentos")
    .update({ status })
    .eq("id", id);
  if (error) throw error;
}

async function bhCriarServico(estabelecimentoId, dados) {
  const client = bhExigirSupabase();
  // O ID é criado no navegador para não depender do SELECT de retorno do
  // PostgREST. Assim, um serviço salvo não gera uma falsa mensagem de erro
  // caso apenas a leitura de atualização falhe depois da inserção.
  const item = {
    id: crypto.randomUUID(),
    estabelecimento_id: estabelecimentoId,
    ...dados
  };
  const { error } = await client.from("servicos").insert(item);
  if (error) throw error;
  return item;
}

async function bhAtualizarServico(id, dados) {
  const client = bhExigirSupabase();
  const { error } = await client.from("servicos").update(dados).eq("id", id);
  if (error) throw error;
  return { id, ...dados };
}

async function bhExcluirServico(id) {
  const client = bhExigirSupabase();
  const { error } = await client.from("servicos").delete().eq("id", id);
  if (error) throw error;
}

async function bhCriarProfissional(estabelecimentoId, dados) {
  const client = bhExigirSupabase();
  const item = { id: crypto.randomUUID(), estabelecimento_id: estabelecimentoId, ...dados };
  const { error } = await client.from("profissionais").insert(item);
  if (error) throw error;
  return item;
}

async function bhAtualizarProfissional(id, dados) {
  const client = bhExigirSupabase();
  const { error } = await client.from("profissionais").update(dados).eq("id", id);
  if (error) throw error;
  return { id, ...dados };
}

async function bhExcluirProfissional(id) {
  const client = bhExigirSupabase();
  const { error } = await client.from("profissionais").delete().eq("id", id);
  if (error) throw error;
}

async function bhAdicionarDiaBloqueado(estabelecimentoId, data, motivo) {
  const client = bhExigirSupabase();
  const item = { id: crypto.randomUUID(), estabelecimento_id: estabelecimentoId, data, motivo: motivo || null };
  const { error } = await client.from("dias_bloqueados").insert(item);
  if (error) throw error;
  return item;
}

async function bhExcluirDiaBloqueado(id) {
  const client = bhExigirSupabase();
  const { error } = await client.from("dias_bloqueados").delete().eq("id", id);
  if (error) throw error;
}

async function bhCriarTicket(dados) {
  const client = bhExigirSupabase();
  let perfil = null;
  try { perfil = await bhGetPerfil(); } catch (_) { perfil = null; }
  const id = crypto.randomUUID();
  const payload = {
    id,
    user_id: perfil?.id || null,
    nome: dados.nome,
    email: dados.email,
    categoria: dados.categoria || "duvida",
    assunto: dados.assunto,
    mensagem: dados.mensagem,
    prioridade: dados.prioridade || "normal"
  };
  const { error } = await client.from("tickets_suporte").insert(payload);
  if (error) throw error;
  return { id, ...payload };
}

async function bhListarMeusTickets() {
  const perfil = await bhGetPerfil();
  if (!perfil) return [];
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("tickets_suporte")
    .select("*")
    .eq("user_id", perfil.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function bhMetricasPublicas() {
  const client = bhExigirSupabase();
  const { data, error } = await client.rpc("metricas_publicas");
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

async function bhAdminResumo() {
  const client = bhExigirSupabase();
  const [perfis, estabelecimentos, agendamentos, tickets, denuncias] = await Promise.all([
    client.from("perfis").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(100),
    client.from("estabelecimentos").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(100),
    client.from("agendamentos").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(100),
    client.from("tickets_suporte").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(100),
    client.from("portfolio_denuncias").select(`
      *,
      perfis(nome,email),
      portfolio_publicacoes(id,titulo,status,estabelecimento_id,estabelecimentos(nome))
    `, { count: "exact" }).order("created_at", { ascending: false }).limit(100)
  ]);
  [perfis, estabelecimentos, agendamentos, tickets, denuncias].forEach(resultado => {
    if (resultado.error) throw resultado.error;
  });
  return {
    perfis: perfis.data || [],
    estabelecimentos: estabelecimentos.data || [],
    agendamentos: agendamentos.data || [],
    tickets: tickets.data || [],
    denuncias: denuncias.data || [],
    counts: {
      perfis: perfis.count || 0,
      estabelecimentos: estabelecimentos.count || 0,
      agendamentos: agendamentos.count || 0,
      tickets: tickets.count || 0,
      denuncias: denuncias.count || 0
    }
  };
}

async function bhAdminAtualizarTicket(id, dados) {
  const client = bhExigirSupabase();
  const payload = { ...dados };
  if (dados.resposta) payload.respondido_em = new Date().toISOString();
  const { data, error } = await client
    .from("tickets_suporte")
    .update(payload)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function bhAdminAlternarVisibilidade(id, visivel) {
  return bhAtualizarEstabelecimento(id, { visivel });
}

// ============================================================
// NOTIFICAÇÕES E CONTADORES DE NAVEGAÇÃO
// ============================================================
async function bhListarNotificacoes({ somenteNaoLidas = false, tipo = null, limite = 100 } = {}) {
  const perfil = await bhGetPerfil();
  if (!perfil) return [];
  const client = bhExigirSupabase();
  let query = client
    .from("notificacoes")
    .select("*")
    .eq("user_id", perfil.id)
    .order("created_at", { ascending: false })
    .limit(limite);
  if (somenteNaoLidas) query = query.is("lida_em", null);
  if (tipo && tipo !== "todas") query = query.eq("tipo", tipo);
  const { data, error } = await query;
  if (error) throw error;
  return data || [];
}

async function bhContarNotificacoesNaoLidas() {
  const perfil = await bhGetPerfil();
  if (!perfil) return 0;
  const client = bhExigirSupabase();
  const { count, error } = await client
    .from("notificacoes")
    .select("id", { count: "exact", head: true })
    .eq("user_id", perfil.id)
    .is("lida_em", null);
  if (error) throw error;
  return count || 0;
}

async function bhMarcarNotificacaoLida(id) {
  const client = bhExigirSupabase();
  const { error } = await client
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("id", id)
    .is("lida_em", null);
  if (error) throw error;
}

async function bhMarcarTodasNotificacoesLidas() {
  const perfil = await bhGetPerfil();
  if (!perfil) return;
  const client = bhExigirSupabase();
  const { error } = await client
    .from("notificacoes")
    .update({ lida_em: new Date().toISOString() })
    .eq("user_id", perfil.id)
    .is("lida_em", null);
  if (error) throw error;
}

async function bhObterContadoresNavegacao(perfil = null) {
  perfil ||= await bhGetPerfil();
  if (!perfil) return { notificacoes: 0, agenda: 0, tickets: 0, moderacao: 0, aceitaAgendamento: false, estabelecimento: null };
  const client = bhExigirSupabase();
  const resultado = {
    notificacoes: await bhContarNotificacoesNaoLidas(),
    agenda: 0,
    tickets: 0,
    moderacao: 0,
    aceitaAgendamento: false,
    estabelecimento: null
  };

  if (perfil.tipo === "barbeiro") {
    const { data: estabelecimento, error: erroEst } = await client
      .from("estabelecimentos")
      .select("id,slug,nome,aceita_agendamento")
      .eq("owner_id", perfil.id)
      .maybeSingle();
    if (erroEst) throw erroEst;
    resultado.estabelecimento = estabelecimento;
    resultado.aceitaAgendamento = Boolean(estabelecimento?.aceita_agendamento);
    if (estabelecimento) {
      const { count, error } = await client
        .from("agendamentos")
        .select("id", { count: "exact", head: true })
        .eq("estabelecimento_id", estabelecimento.id)
        .eq("status", "pendente");
      if (error) throw error;
      resultado.agenda = count || 0;
    }
  } else if (perfil.tipo === "cliente") {
    const hoje = new Date().toISOString().slice(0, 10);
    const { count, error } = await client
      .from("agendamentos")
      .select("id", { count: "exact", head: true })
      .eq("cliente_id", perfil.id)
      .gte("data", hoje)
      .in("status", ["pendente", "confirmado"]);
    if (error) throw error;
    resultado.agenda = count || 0;
  } else if (perfil.tipo === "admin") {
    const { count, error } = await client
      .from("tickets_suporte")
      .select("id", { count: "exact", head: true })
      .in("status", ["aberto", "em_atendimento"]);
    if (error) throw error;
    resultado.tickets = count || 0;
    const { count: moderacao, error: erroModeracao } = await client
      .from("portfolio_denuncias")
      .select("id", { count: "exact", head: true })
      .in("status", ["aberta", "analisando"]);
    if (erroModeracao) throw erroModeracao;
    resultado.moderacao = moderacao || 0;
  }
  return resultado;
}

// ============================================================
// PORTFÓLIO / GALERIA
// ============================================================
const BH_PORTFOLIO_CATEGORIAS = [
  "Corte masculino", "Barba", "Corte e barba", "Degradê / Fade",
  "Freestyle / Desenho", "Tratamento capilar", "Corte infantil",
  "Antes e depois", "Outros"
];
const BH_PORTFOLIO_MAX_FOTOS = 5;
const BH_PORTFOLIO_MAX_ORIGINAL = 8 * 1024 * 1024;

async function bhListarPortfolioPublico(estabelecimentoId) {
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("portfolio_publicacoes")
    .select(`
      *,
      portfolio_midias(*),
      profissionais(id,nome,especialidade),
      servicos(id,nome,categoria)
    `)
    .eq("estabelecimento_id", estabelecimentoId)
    .eq("status", "publicada")
    .order("destaque", { ascending: false })
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(bhNormalizarPublicacaoPortfolio);
}

async function bhListarMeuPortfolio(estabelecimentoId) {
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("portfolio_publicacoes")
    .select(`
      *,
      portfolio_midias(*),
      profissionais(id,nome,especialidade),
      servicos(id,nome,categoria)
    `)
    .eq("estabelecimento_id", estabelecimentoId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(bhNormalizarPublicacaoPortfolio);
}

function bhNormalizarPublicacaoPortfolio(item) {
  return {
    ...item,
    midias: [...(item.portfolio_midias || [])].sort((a, b) => a.ordem - b.ordem),
    profissional: item.profissionais || null,
    servico: item.servicos || null
  };
}

async function bhComprimirImagemPortfolio(file) {
  if (!file) throw new Error("Selecione uma imagem.");
  if (!/^image\/(jpeg|png|webp)$/i.test(file.type)) throw new Error("Use imagens JPG, PNG ou WebP.");
  if (file.size > BH_PORTFOLIO_MAX_ORIGINAL) throw new Error("Cada imagem original deve ter no máximo 8 MB.");

  let fonte;
  let urlTemporaria = null;
  if (typeof createImageBitmap === "function") {
    fonte = await createImageBitmap(file, { imageOrientation: "from-image" });
  } else {
    urlTemporaria = URL.createObjectURL(file);
    fonte = await new Promise((resolve, reject) => {
      const imagem = new Image();
      imagem.onload = () => resolve(imagem);
      imagem.onerror = () => reject(new Error("Não foi possível abrir esta imagem."));
      imagem.src = urlTemporaria;
    });
  }

  let largura = fonte.width || fonte.naturalWidth;
  let altura = fonte.height || fonte.naturalHeight;
  const maximo = 1600;
  const escala = Math.min(1, maximo / Math.max(largura, altura));
  largura = Math.max(1, Math.round(largura * escala));
  altura = Math.max(1, Math.round(altura * escala));

  let qualidade = .78;
  let blob = null;
  try {
    for (let tentativa = 0; tentativa < 4; tentativa += 1) {
      const canvas = document.createElement("canvas");
      canvas.width = largura;
      canvas.height = altura;
      const contexto = canvas.getContext("2d", { alpha: false });
      if (!contexto) throw new Error("Seu navegador não conseguiu preparar a imagem.");
      contexto.drawImage(fonte, 0, 0, largura, altura);
      blob = await new Promise(resolve => canvas.toBlob(resolve, "image/webp", qualidade));
      if (!blob) throw new Error("Não foi possível processar esta imagem.");
      if (blob.size <= 500 * 1024 || tentativa === 3) break;
      qualidade = Math.max(.58, qualidade - .07);
      largura = Math.max(1, Math.round(largura * .88));
      altura = Math.max(1, Math.round(altura * .88));
    }
  } finally {
    fonte.close?.();
    if (urlTemporaria) URL.revokeObjectURL(urlTemporaria);
  }
  return new File([blob], `${bhSlug(file.name.replace(/\.[^.]+$/, "")) || "trabalho"}.webp`, { type: "image/webp" });
}

async function bhUploadImagemPortfolio(file, estabelecimentoId, publicacaoId) {
  const comprimida = await bhComprimirImagemPortfolio(file);
  const user = await bhGetAuthUser();
  if (!user) throw new Error("Faça login para publicar imagens.");
  const client = bhExigirSupabase();
  const caminho = `${user.id}/portfolio/${estabelecimentoId}/${publicacaoId}/${crypto.randomUUID()}.webp`;
  const { error } = await client.storage.from("barberhub-public").upload(caminho, comprimida, {
    cacheControl: "31536000",
    contentType: "image/webp",
    upsert: false
  });
  if (error) throw error;
  const { data } = client.storage.from("barberhub-public").getPublicUrl(caminho);
  return { storage_path: caminho, public_url: data.publicUrl };
}

async function bhCriarPublicacaoPortfolio(estabelecimentoId, dados, arquivos = []) {
  if (!arquivos.length) throw new Error("Adicione pelo menos uma foto.");
  if (arquivos.length > BH_PORTFOLIO_MAX_FOTOS) throw new Error("Use no máximo 5 fotos por publicação.");
  const perfil = await bhGetPerfil();
  if (!perfil) throw new Error("Sessão não encontrada.");
  const client = bhExigirSupabase();
  const id = crypto.randomUUID();
  const statusFinal = dados.status === "publicada" ? "publicada" : "rascunho";
  const payload = {
    id,
    estabelecimento_id: estabelecimentoId,
    autor_id: perfil.id,
    profissional_id: dados.profissional_id || null,
    servico_id: dados.servico_id || null,
    titulo: dados.titulo,
    descricao: dados.descricao || "",
    categoria: dados.categoria,
    tags: dados.tags || [],
    modo: dados.modo || "galeria",
    status: "rascunho",
    destaque: Boolean(dados.destaque),
    capa_ordem: Number(dados.capa_ordem || 1),
    data_trabalho: dados.data_trabalho || null,
    confirmou_autorizacao: Boolean(dados.confirmou_autorizacao),
    possui_menor: Boolean(dados.possui_menor),
    confirmou_responsavel: Boolean(dados.confirmou_responsavel)
  };
  const enviados = [];
  try {
    const { error: erroPublicacao } = await client.from("portfolio_publicacoes").insert(payload);
    if (erroPublicacao) throw erroPublicacao;
    for (let indice = 0; indice < arquivos.length; indice += 1) {
      const upload = await bhUploadImagemPortfolio(arquivos[indice], estabelecimentoId, id);
      enviados.push(upload.storage_path);
      const tipo = payload.modo === "antes_depois" ? (indice === 0 ? "antes" : indice === 1 ? "depois" : "normal") : "normal";
      const { error } = await client.from("portfolio_midias").insert({
        publicacao_id: id,
        ...upload,
        ordem: indice + 1,
        tipo,
        texto_alternativo: `${dados.titulo} — foto ${indice + 1}`
      });
      if (error) throw error;
    }
    if (statusFinal === "publicada") {
      const { error } = await client.from("portfolio_publicacoes").update({ status: "publicada" }).eq("id", id);
      if (error) throw error;
    }
    return id;
  } catch (erro) {
    if (enviados.length) {
      try { await client.storage.from("barberhub-public").remove(enviados); }
      catch (erroLimpeza) { console.warn("Falha ao limpar uploads incompletos.", erroLimpeza); }
    }
    try { await client.from("portfolio_publicacoes").delete().eq("id", id); }
    catch (erroLimpeza) { console.warn("Falha ao remover rascunho incompleto.", erroLimpeza); }
    throw erro;
  }
}

async function bhAtualizarPublicacaoPortfolio(id, dados) {
  const client = bhExigirSupabase();
  const { error } = await client.from("portfolio_publicacoes").update(dados).eq("id", id);
  if (error) throw error;
}

async function bhAdicionarFotosPortfolio(publicacao, arquivos = []) {
  if (!arquivos.length) return;
  const existentes = publicacao.midias?.length || 0;
  if (existentes + arquivos.length > BH_PORTFOLIO_MAX_FOTOS) throw new Error("A publicação pode ter no máximo 5 fotos.");
  const client = bhExigirSupabase();
  const enviados = [];
  try {
    for (let indice = 0; indice < arquivos.length; indice += 1) {
      const ordem = existentes + indice + 1;
      const upload = await bhUploadImagemPortfolio(arquivos[indice], publicacao.estabelecimento_id, publicacao.id);
      enviados.push(upload.storage_path);
      const tipo = publicacao.modo === "antes_depois" ? (ordem === 1 ? "antes" : ordem === 2 ? "depois" : "normal") : "normal";
      const { error } = await client.from("portfolio_midias").insert({
        publicacao_id: publicacao.id,
        ...upload,
        ordem,
        tipo,
        texto_alternativo: `${publicacao.titulo} — foto ${ordem}`
      });
      if (error) throw error;
    }
  } catch (erro) {
    if (enviados.length) {
      try { await client.from("portfolio_midias").delete().in("storage_path", enviados); }
      catch (erroLimpeza) { console.warn("Falha ao limpar registros de mídia incompletos.", erroLimpeza); }
      try { await client.storage.from("barberhub-public").remove(enviados); }
      catch (erroLimpeza) { console.warn("Falha ao limpar arquivos incompletos.", erroLimpeza); }
    }
    throw erro;
  }
}

async function bhReordenarMidiasPortfolio(publicacaoId, midiasOrdenadas, capaMidiaId = null) {
  const ids = (midiasOrdenadas || []).map(item => typeof item === "string" ? item : item.id);
  if (!ids.length) throw new Error("A publicação precisa manter pelo menos uma imagem.");
  const client = bhExigirSupabase();
  const { error } = await client.rpc("reordenar_midias_portfolio", {
    p_publicacao_id: publicacaoId,
    p_midias: ids,
    p_capa_midia_id: capaMidiaId || ids[0]
  });
  if (error) throw error;
}

async function bhSincronizarTiposMidiaPortfolio(publicacaoId, capaOrdem = 1) {
  const client = bhExigirSupabase();
  const { data: midias, error: erroLeitura } = await client
    .from("portfolio_midias")
    .select("id,ordem")
    .eq("publicacao_id", publicacaoId)
    .order("ordem");
  if (erroLeitura) throw erroLeitura;
  if (!midias?.length) return;
  // A função de reordenação também sincroniza os rótulos antes/depois.
  const capa = midias.find(item => item.ordem === Number(capaOrdem)) || midias[0];
  const { error } = await client.rpc("reordenar_midias_portfolio", {
    p_publicacao_id: publicacaoId,
    p_midias: midias.map(item => item.id),
    p_capa_midia_id: capa.id
  });
  if (error) throw error;
}

async function bhRemoverMidiaPortfolio(midia, publicacao) {
  if (publicacao.status === "publicada" && (publicacao.midias?.length || 0) <= 1) {
    throw new Error("Uma publicação visível precisa manter pelo menos uma foto.");
  }
  const client = bhExigirSupabase();
  const capaAtual = (publicacao.midias || []).find(item => item.ordem === publicacao.capa_ordem)?.id;
  const { error } = await client.from("portfolio_midias").delete().eq("id", midia.id);
  if (error) throw error;
  const restantes = (publicacao.midias || []).filter(item => item.id !== midia.id);
  if (restantes.length) {
    await bhReordenarMidiasPortfolio(publicacao.id, restantes, capaAtual === midia.id ? restantes[0].id : capaAtual);
  }
  const { error: erroStorage } = await client.storage.from("barberhub-public").remove([midia.storage_path]);
  if (erroStorage) console.warn("A mídia saiu da publicação, mas a limpeza do arquivo precisará ser repetida.", erroStorage);
}

async function bhExcluirPublicacaoPortfolio(publicacao) {
  const client = bhExigirSupabase();
  const caminhos = (publicacao.midias || []).map(item => item.storage_path).filter(Boolean);
  const { error } = await client.from("portfolio_publicacoes").delete().eq("id", publicacao.id);
  if (error) throw error;
  if (caminhos.length) {
    const { error: erroStorage } = await client.storage.from("barberhub-public").remove(caminhos);
    if (erroStorage) console.warn("Publicação removida; alguns arquivos podem precisar de limpeza no Storage.", erroStorage);
  }
}

async function bhObterCurtidasMinhas(publicacaoIds = []) {
  const perfil = await bhGetPerfil();
  if (!perfil || !publicacaoIds.length) return new Set();
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("portfolio_curtidas")
    .select("publicacao_id")
    .eq("user_id", perfil.id)
    .in("publicacao_id", publicacaoIds);
  if (error) throw error;
  return new Set((data || []).map(item => item.publicacao_id));
}

async function bhAlternarCurtidaPortfolio(publicacaoId, curtida) {
  const perfil = await bhGetPerfil();
  if (!perfil) throw new Error("Entre na sua conta para curtir.");
  const idadeMs = Date.now() - new Date(perfil.created_at).getTime();
  if (idadeMs < 7 * 24 * 60 * 60 * 1000) throw new Error("Curtidas ficam disponíveis após 7 dias de conta.");
  const client = bhExigirSupabase();
  if (curtida) {
    const { error } = await client.from("portfolio_curtidas").delete().eq("publicacao_id", publicacaoId).eq("user_id", perfil.id);
    if (error) throw error;
    return false;
  }
  const { error } = await client.from("portfolio_curtidas").insert({ publicacao_id: publicacaoId, user_id: perfil.id });
  if (error) throw error;
  return true;
}

async function bhDenunciarPublicacaoPortfolio(publicacaoId, motivo, detalhes = "") {
  const perfil = await bhGetPerfil();
  if (!perfil) throw new Error("Entre na sua conta para denunciar conteúdo.");
  const client = bhExigirSupabase();
  const { error } = await client.from("portfolio_denuncias").insert({
    publicacao_id: publicacaoId,
    user_id: perfil.id,
    motivo,
    detalhes: detalhes || null,
    status: "aberta"
  });
  if (error?.code === "23505") throw new Error("Você já denunciou esta publicação.");
  if (error) throw error;
}

async function bhAdminAtualizarDenunciaPortfolio(id, dados) {
  const client = bhExigirSupabase();
  const { data, error } = await client.from("portfolio_denuncias").update(dados).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

// ============================================================
// PLANOS / ASSINATURAS
// ============================================================
async function bhListarPlanos() {
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("planos")
    .select("*")
    .eq("ativo", true)
    .order("ordenacao", { ascending: true });
  if (error) throw error;
  return data || [];
}

async function bhObterMinhaAssinatura() {
  const perfil = await bhGetPerfil();
  if (!perfil) return null;
  const estabelecimento = await bhObterMeuEstabelecimento();
  if (!estabelecimento) return null;
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("assinaturas")
    .select(`
      *,
      planos(*)
    `)
    .eq("estabelecimento_id", estabelecimento.id)
    .maybeSingle();
  if (error) throw error;
  return data ? { ...data, estabelecimento } : null;
}

async function bhObterResumoAssinaturaBarbeiro() {
  const estabelecimento = await bhObterMeuEstabelecimento();
  if (!estabelecimento) return null;
  let assinatura = null;
  try { assinatura = await bhObterMinhaAssinatura(); }
  catch (erro) { console.warn("Assinatura indisponível, usando plano gratuito como fallback.", erro); }

  const client = bhExigirSupabase();
  const { count: totalPublicacoes } = await client
    .from("portfolio_publicacoes")
    .select("id", { count: "exact", head: true })
    .eq("estabelecimento_id", estabelecimento.id);

  const resumo = assinatura?.planos || {
    nome: "Perfil gratuito",
    slug: "gratuito",
    preco_semanal: 0,
    preco_mensal: 0,
    limite_profissionais: 1,
    limite_publicacoes: 10,
    permite_agenda: false,
    permite_relatorios: false,
    permite_equipe: false
  };

  return {
    assinatura,
    estabelecimento,
    plano: resumo,
    uso: {
      profissionais: estabelecimento.barbeiros?.length || 0,
      publicacoes: totalPublicacoes || 0,
      aceitaAgendamento: Boolean(estabelecimento.aceitaAgendamento)
    }
  };
}
