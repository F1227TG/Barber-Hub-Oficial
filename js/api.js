/**
 * api.js
 * Camada central de dados do Barber Hub. Consultas públicas usam o Supabase e
 * operações sensíveis priorizam a API própria hospedada na Vercel.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

const BH_ESTABELECIMENTO_SELECT = `
  *,
  estabelecimento_horario_periodos(*),
  horarios_funcionamento(*),
  dias_bloqueados(*),
  profissionais(*,profissional_servicos(servico_id)),
  servicos(*),
  promocoes(*)
`;

const BH_DIAS_CHAVE = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];

/**
 * Normaliza os serviços de um agendamento novo ou antigo.
 * A migration 14 mantém `servico_id` como item principal por compatibilidade,
 * enquanto `agendamento_servicos` contém a seleção completa.
 */
function bhAgendamentoServicos(agendamento) {
  const itens = [...(agendamento?.agendamento_servicos || [])]
    .sort((a, b) => Number(a.ordem || 0) - Number(b.ordem || 0))
    .map(item => ({
      id: item.servico_id || item.servicos?.id || null,
      nome: item.nome_snapshot || item.servicos?.nome || "Serviço",
      preco: Number(item.preco_snapshot ?? item.servicos?.preco ?? 0),
      duracao: Number(item.duracao_min_snapshot ?? item.servicos?.duracao_min ?? 0)
    }));
  if (itens.length) return itens;
  if (agendamento?.servicos) return [{
    id: agendamento.servico_id || agendamento.servicos.id || null,
    nome: agendamento.servicos.nome || "Serviço",
    preco: Number(agendamento.valor || agendamento.servicos.preco || 0),
    duracao: Number(agendamento.servicos.duracao_min || 0)
  }];
  return [];
}

function bhAgendamentoServicosTexto(agendamento, separador = " + ") {
  const nomes = bhAgendamentoServicos(agendamento).map(item => item.nome);
  return nomes.length ? nomes.join(separador) : "Serviço";
}

function bhAgendamentoServicoIds(agendamento) {
  const ids = bhAgendamentoServicos(agendamento).map(item => item.id).filter(Boolean);
  return ids.length ? ids : [agendamento?.servico_id].filter(Boolean);
}

/** Retorna true quando o backend próprio ainda não está disponível no ambiente local. */
function bhBackendPodeUsarFallback(erro) {
  // Segurança 1.6: produção não contorna validações Python/rate limiting quando
  // a API falha. O acesso direto é permitido somente no desenvolvimento local,
  // onde o Live Server pode estar rodando sem a função FastAPI da Vercel.
  const local = ["localhost", "127.0.0.1", "::1", ""].includes(location.hostname) || location.protocol === "file:";
  if (!local) return false;
  return !window.bhBackendApi || [404, 405, 503].includes(Number(erro?.status)) ||
    ["BACKEND_NOT_CONFIGURED", "API_TIMEOUT"].includes(erro?.code) ||
    erro instanceof TypeError;
}

function bhNormalizarEstabelecimento(row) {
  if (!row) return null;
  const horarios = {};
  const horariosPeriodos = {};
  (row.horarios_funcionamento || []).forEach(item => {
    horarios[BH_DIAS_CHAVE[item.dia_semana]] = item.aberto
      ? { abre: bhHoraCurta(item.abre), fecha: bhHoraCurta(item.fecha), id: item.id }
      : null;
  });
  (row.estabelecimento_horario_periodos || [])
    .filter(item => item.ativo !== false)
    .sort((a, b) => Number(a.dia_semana) - Number(b.dia_semana) || Number(a.ordem) - Number(b.ordem))
    .forEach(item => {
      const dia = BH_DIAS_CHAVE[item.dia_semana];
      horariosPeriodos[dia] ||= [];
      horariosPeriodos[dia].push({
        id: item.id,
        abre: bhHoraCurta(item.abre),
        fecha: bhHoraCurta(item.fecha),
        fechaDiaSeguinte: Boolean(item.fecha_dia_seguinte),
        ordem: Number(item.ordem || 1)
      });
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
    horariosPeriodos,
    horariosRows: (row.horarios_funcionamento || []).sort((a, b) => a.dia_semana - b.dia_semana),
    diasFechados: (row.dias_bloqueados || []).map(item => ({
      id: item.id,
      data: item.data,
      motivo: item.motivo
    })),
    barbeiros: (row.profissionais || []).map(item => ({
      ...item,
      aceitaAgendamento: item.aceita_agendamento,
      servicosIds: (item.profissional_servicos || []).map(vinculo => vinculo.servico_id).filter(Boolean),
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

/**
 * Busca paginada do marketplace. Em produção prioriza FTS pela API Python;
 * no Live Server local usa uma consulta limitada ao Supabase como fallback.
 */
async function bhBuscarMarketplace({ busca = "", tipo = "todos", agenda = null, status = "todos", offset = 0, limit = 24 } = {}) {
  if (window.bhBackendApi?.searchMarketplace) {
    try {
      const result = await window.bhBackendApi.searchMarketplace({ query: busca, tipo, agenda, status, offset, limit });
      return {
        ...result,
        items: (result?.items || []).map(bhNormalizarEstabelecimento)
      };
    } catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] Busca FTS indisponível; usando fallback paginado do Supabase.", erro);
    }
  }

  const client = bhExigirSupabase();
  let query = client
    .from("estabelecimentos")
    .select(BH_ESTABELECIMENTO_SELECT, { count: "exact" })
    .eq("visivel", true)
    .eq("onboarding_concluido", true)
    .order("destaque", { ascending: false })
    .order("avaliacao", { ascending: false })
    .order("created_at", { ascending: false })
    .range(offset, offset + limit - 1);

  if (tipo && tipo !== "todos") query = query.eq("tipo_estabelecimento", tipo);
  if (agenda !== null && agenda !== undefined) query = query.eq("aceita_agendamento", Boolean(agenda));
  if (busca) {
    const seguro = String(busca).replace(/[,%()]/g, " ").trim();
    if (seguro) query = query.or(`nome.ilike.%${seguro}%,cidade.ilike.%${seguro}%,bairro.ilike.%${seguro}%`);
  }

  const { data, error, count } = await query;
  if (error) throw error;
  let items = (data || []).map(bhNormalizarEstabelecimento);
  if (status === "aberta") items = items.filter(item => bhCalcularStatus(item).aberta);
  if (status === "fechada") items = items.filter(item => !bhCalcularStatus(item).aberta);
  return { items, total: Number(count || items.length), offset, limit, has_more: offset + (data || []).length < Number(count || 0), search_engine: "supabase_ilike_fallback" };
}

async function bhBuscarMarketplaceRegional({ busca = "", cidade = "", bairro = "", estado = "", abertoAgora = false, agenda = false, latitude = null, longitude = null, raioKm = null, servico = "", precoMin = null, precoMax = null, avaliacaoMin = null, offset = 0, limit = 24 } = {}) {
  const filtrosExclusivosDaApi = Boolean(servico || precoMin !== null || precoMax !== null || avaliacaoMin !== null || cidade || bairro || estado || latitude !== null || raioKm !== null);
  if (!window.bhBackendApi?.regionalMarketplace) {
    if (filtrosExclusivosDaApi) throw new Error("Os filtros avançados precisam da conexão segura do Barber Hub. Tente novamente em instantes.");
    return bhBuscarMarketplace({ busca, agenda:agenda || null, status:abertoAgora ? "aberta" : "todos", offset, limit });
  }
  try {
    const result = await window.bhBackendApi.regionalMarketplace({ query:busca, city:cidade, neighborhood:bairro, state:estado, openNow:abertoAgora, agenda, latitude, longitude, radiusKm:raioKm, service:servico, minPrice:precoMin, maxPrice:precoMax, minRating:avaliacaoMin, offset, limit });
    return { ...result, items:(result?.items || []).map(bhNormalizarEstabelecimento) };
  } catch (erro) {
    if (!bhBackendPodeUsarFallback(erro)) throw erro;
    if (filtrosExclusivosDaApi) throw new Error("Os filtros avançados estão temporariamente indisponíveis. Nenhum resultado diferente do filtro foi exibido.");
    return bhBuscarMarketplace({ busca, agenda:agenda || null, status:abertoAgora ? "aberta" : "todos", offset, limit });
  }
}

async function bhBuscarDestaquesMarketplace(limit = 6) {
  if (window.bhBackendApi?.featuredMarketplace) {
    try {
      const result = await window.bhBackendApi.featuredMarketplace(limit);
      return (result?.items || []).map(bhNormalizarEstabelecimento);
    } catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
    }
  }
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("estabelecimentos")
    .select(BH_ESTABELECIMENTO_SELECT)
    .eq("visivel", true)
    .eq("onboarding_concluido", true)
    .eq("destaque", true)
    .order("avaliacao", { ascending: false })
    .limit(limit);
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
  if (!data) return null;
  // A configuração `aceita_agendamento` pertence ao estabelecimento, mas a
  // exposição pública depende também do plano efetivo. Isso evita anunciar
  // agenda de assinatura expirada/pausada até que o admin altere outro campo.
  try {
    const { data: agendaEfetiva, error: agendaErro } = await client.rpc("agenda_online_disponivel", { p_estabelecimento_id: data.id });
    if (!agendaErro && typeof agendaEfetiva === "boolean") data.aceita_agendamento = agendaEfetiva;
  } catch (erroAgenda) {
    console.warn("[Barber Hub] Não foi possível validar a agenda do plano.", erroAgenda);
  }
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
  const chaves = Object.keys(dados || {});
  const somenteStatus = chaves.length > 0 && chaves.every(chave => ["status_manual", "motivo_status"].includes(chave));

  if (window.bhBackendApi) {
    try {
      if (somenteStatus && dados.status_manual && window.bhBackendApi.updateEstablishmentStatus) {
        return await window.bhBackendApi.updateEstablishmentStatus(id, dados.status_manual, dados.motivo_status ?? null);
      }
      if (window.bhBackendApi.updateEstablishment) {
        return await window.bhBackendApi.updateEstablishment(id, dados);
      }
    } catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] API de estabelecimento indisponível; usando RLS local.", erro);
    }
  }

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
      servicos(id,nome,preco,duracao_min),
      agendamento_servicos(servico_id,ordem,nome_snapshot,preco_snapshot,duracao_min_snapshot,servicos(id,nome,preco,duracao_min))
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
      servicos(id,nome,preco,duracao_min),
      agendamento_servicos(servico_id,ordem,nome_snapshot,preco_snapshot,duracao_min_snapshot,servicos(id,nome,preco,duracao_min))
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
  const servicosIds = [...new Set(payload.servicosIds || [payload.servicoId].filter(Boolean))];
  if (!servicosIds.length) throw new Error("Selecione pelo menos um serviço.");

  // Produção: a API Python valida a sessão e chama a função transacional.
  if (window.bhBackendApi) {
    try {
      return await window.bhBackendApi.createAppointment({
        estabelecimento_id: payload.estabelecimentoId,
        profissional_id: payload.profissionalId,
        servicos_ids: servicosIds,
        data: payload.data,
        hora_inicio: payload.hora,
        observacao: payload.observacao || null,
        cupom_codigo: payload.cupomCodigo || null
      });
    } catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] API de agendamento indisponível; usando RPC autenticada.", erro);
    }
  }

  // Desenvolvimento estático: fallback temporário para o Supabase.
  const client = bhExigirSupabase();
  const { data, error } = await client.rpc("criar_agendamento_com_cupom_193", {
    p_estabelecimento_id: payload.estabelecimentoId,
    p_profissional_id: payload.profissionalId,
    p_servicos_ids: servicosIds,
    p_data: payload.data,
    p_hora_inicio: payload.hora,
    p_observacao: payload.observacao || null,
    p_cupom_codigo: payload.cupomCodigo || null
  });
  if (error) throw error;
  return data;
}

async function bhCancelarAgendamento(id, motivo = "Cancelado pelo cliente") {
  if (window.bhBackendApi?.cancelAppointment) {
    try {
      return await window.bhBackendApi.cancelAppointment(id, motivo);
    } catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] API de cancelamento indisponível; usando RPC autenticada.", erro);
    }
  }
  const client = bhExigirSupabase();
  const { error } = await client.rpc("cancelar_agendamento", {
    p_agendamento_id: id,
    p_motivo: motivo
  });
  if (error) throw error;
}

async function bhAtualizarStatusAgendamento(id, status, motivo = null) {
  if (window.bhBackendApi?.updateAppointmentStatus) {
    try {
      return await window.bhBackendApi.updateAppointmentStatus(id, status, motivo);
    } catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] API de status indisponível; usando RLS do Supabase.", erro);
    }
  }
  const client = bhExigirSupabase();
  const { error } = await client.from("agendamentos").update({ status }).eq("id", id);
  if (error) throw error;
}

async function bhCriarServico(estabelecimentoId, dados) {
  if (window.bhBackendApi?.createService) {
    try {
      return await window.bhBackendApi.createService({ estabelecimento_id: estabelecimentoId, ...dados });
    } catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] API de serviços indisponível; usando RLS local.", erro);
    }
  }

  const client = bhExigirSupabase();
  const item = { id: crypto.randomUUID(), estabelecimento_id: estabelecimentoId, ...dados };
  const { error } = await client.from("servicos").insert(item);
  if (error) throw error;
  return item;
}

async function bhAtualizarServico(id, dados) {
  if (window.bhBackendApi?.updateService) {
    try { return await window.bhBackendApi.updateService(id, dados); }
    catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] API de serviços indisponível; usando RLS local.", erro);
    }
  }
  const client = bhExigirSupabase();
  const { error } = await client.from("servicos").update(dados).eq("id", id);
  if (error) throw error;
  return { id, ...dados };
}

async function bhExcluirServico(id) {
  if (window.bhBackendApi?.deleteService) {
    try { return await window.bhBackendApi.deleteService(id); }
    catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] API de serviços indisponível; usando arquivamento local.", erro);
    }
  }
  // Arquivamento lógico preserva referências de agendamentos antigos.
  const client = bhExigirSupabase();
  const { error } = await client.from("servicos").update({ ativo: false, publico: false }).eq("id", id);
  if (error) throw error;
  return { id, ativo: false, publico: false };
}

async function bhCriarProfissional(estabelecimentoId, dados) {
  if (window.bhBackendApi?.createProfessional) {
    try {
      return await window.bhBackendApi.createProfessional({ estabelecimento_id: estabelecimentoId, ...dados });
    } catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] API de profissionais indisponível; usando RLS local.", erro);
    }
  }
  const client = bhExigirSupabase();
  const item = { id: crypto.randomUUID(), estabelecimento_id: estabelecimentoId, ...dados };
  const { error } = await client.from("profissionais").insert(item);
  if (error) throw error;
  return item;
}

async function bhAtualizarProfissional(id, dados) {
  if (window.bhBackendApi?.updateProfessional) {
    try { return await window.bhBackendApi.updateProfessional(id, dados); }
    catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] API de profissionais indisponível; usando RLS local.", erro);
    }
  }
  const client = bhExigirSupabase();
  const { error } = await client.from("profissionais").update(dados).eq("id", id);
  if (error) throw error;
  return { id, ...dados };
}

async function bhExcluirProfissional(id) {
  if (window.bhBackendApi?.deleteProfessional) {
    try { return await window.bhBackendApi.deleteProfessional(id); }
    catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] API de profissionais indisponível; usando arquivamento local.", erro);
    }
  }
  // Arquivamento lógico preserva o profissional em atendimentos históricos.
  const client = bhExigirSupabase();
  const { error } = await client.from("profissionais").update({ ativo: false, aceita_agendamento: false }).eq("id", id);
  if (error) throw error;
  return { id, ativo: false, aceita_agendamento: false };
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
  // Produção: usa a API própria para validar e registrar o ticket.
  // Desenvolvimento com Live Server: mantém fallback temporário no Supabase.
  if (window.bhBackendApi) {
    try {
      return await window.bhBackendApi.createSupportTicket(dados);
    } catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] API de suporte indisponível; usando fallback local.", erro);
    }
  }

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

  if (window.bhBackendApi) {
    try {
      return await window.bhBackendApi.listSupportTickets();
    } catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] API de tickets indisponível; usando fallback local.", erro);
    }
  }

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
  if (window.bhBackendApi) {
    try {
      return await window.bhBackendApi.catalogSummary();
    } catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] API de métricas indisponível; usando fallback local.", erro);
    }
  }

  const client = bhExigirSupabase();
  const { data, error } = await client.rpc("metricas_publicas");
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

async function bhAdminResumo() {
  if (window.bhBackendApi?.adminRecords) {
    const nomes = ["perfis","estabelecimentos","agendamentos","tickets","denuncias","avaliacoes"];
    try {
      const paginas = await Promise.all(nomes.map(nome => window.bhBackendApi.adminRecords(nome, { limit: 50 })));
      const dados = { counts: {}, pagination: {} };
      nomes.forEach((nome, indice) => {
        const pagina = paginas[indice] || {};
        dados[nome] = pagina.items || [];
        dados.counts[nome] = Number(pagina.total || 0);
        dados.pagination[nome] = pagina;
      });
      return dados;
    } catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] Paginação administrativa da API indisponível; usando primeira página protegida.", erro);
    }
  }
  const client = bhExigirSupabase();
  const resultados = await Promise.all([
    client.from("perfis").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(50),
    client.from("estabelecimentos").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(50),
    client.from("agendamentos").select(`*, servicos(id,nome,preco,duracao_min), profissionais(nome), estabelecimentos(nome), agendamento_servicos(servico_id,ordem,nome_snapshot,preco_snapshot,duracao_min_snapshot,servicos(id,nome,preco,duracao_min))`, { count: "exact" }).order("created_at", { ascending: false }).limit(50),
    client.from("tickets_suporte").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(50),
    client.from("portfolio_denuncias").select(`
      *,
      perfis(nome,email),
      portfolio_publicacoes(id,titulo,status,estabelecimento_id,estabelecimentos(nome))
    `, { count: "exact" }).order("created_at", { ascending: false }).limit(50),
    client.from("avaliacoes").select(`*, perfis(nome,email), estabelecimentos(nome), agendamentos(data,hora_inicio,servicos(nome),profissionais(nome),agendamento_servicos(ordem,nome_snapshot)), portfolio_publicacoes(id,titulo)`, { count: "exact" }).order("created_at", { ascending: false }).limit(50)
  ]);
  const [perfis, estabelecimentos, agendamentos, tickets, denuncias, avaliacoesResultado] = resultados;
  [perfis, estabelecimentos, agendamentos, tickets, denuncias].forEach(resultado => {
    if (resultado.error) throw resultado.error;
  });
  const avaliacoes = avaliacoesResultado.error ? { data: [], count: 0 } : avaliacoesResultado;
  return {
    perfis: perfis.data || [],
    estabelecimentos: estabelecimentos.data || [],
    agendamentos: agendamentos.data || [],
    tickets: tickets.data || [],
    denuncias: denuncias.data || [],
    avaliacoes: avaliacoes.data || [],
    pagination: {
      perfis: { total: perfis.count || 0, has_more: (perfis.data || []).length < (perfis.count || 0) },
      estabelecimentos: { total: estabelecimentos.count || 0, has_more: (estabelecimentos.data || []).length < (estabelecimentos.count || 0) },
      agendamentos: { total: agendamentos.count || 0, has_more: (agendamentos.data || []).length < (agendamentos.count || 0) },
      tickets: { total: tickets.count || 0, has_more: (tickets.data || []).length < (tickets.count || 0) },
      denuncias: { total: denuncias.count || 0, has_more: (denuncias.data || []).length < (denuncias.count || 0) },
      avaliacoes: { total: avaliacoes.count || 0, has_more: (avaliacoes.data || []).length < (avaliacoes.count || 0) }
    },
    counts: {
      perfis: perfis.count || 0,
      estabelecimentos: estabelecimentos.count || 0,
      agendamentos: agendamentos.count || 0,
      tickets: tickets.count || 0,
      denuncias: denuncias.count || 0,
      avaliacoes: avaliacoes.count || 0
    }
  };
}

async function bhAdminListarAssinaturas() {
  if (window.bhBackendApi?.adminSubscriptions) {
    try { return await window.bhBackendApi.adminSubscriptions(); }
    catch (erro) { if (!bhBackendPodeUsarFallback(erro)) throw erro; }
  }
  const client = bhExigirSupabase();
  const [plans, establishments, profiles, subscriptions] = await Promise.all([
    client.from("planos").select("*").eq("ativo", true).order("ordenacao"),
    client.from("estabelecimentos").select("id,owner_id,nome,cidade,estado,aceita_agendamento,created_at").order("created_at", { ascending: false }).limit(500),
    client.from("perfis").select("id,nome,email,tipo,ativo").limit(1000),
    client.from("assinaturas").select("*,planos(id,slug,nome,ordenacao)").limit(500)
  ]);
  [plans, establishments, profiles, subscriptions].forEach(resultado => { if (resultado.error) throw resultado.error; });
  return { plans: plans.data || [], establishments: establishments.data || [], profiles: profiles.data || [], subscriptions: subscriptions.data || [] };
}

async function bhAdminAtribuirPlano(estabelecimentoId, dados) {
  if (window.bhBackendApi?.adminAssignSubscription) {
    try { return await window.bhBackendApi.adminAssignSubscription(estabelecimentoId, dados); }
    catch (erro) { if (!bhBackendPodeUsarFallback(erro)) throw erro; }
  }
  const client = bhExigirSupabase();
  const { data, error } = await client.rpc("admin_atribuir_plano", {
    p_estabelecimento_id: estabelecimentoId,
    p_plano_slug: dados.plano_slug,
    p_status: dados.status || "ativa",
    p_periodo_fim: dados.periodo_fim || null,
    p_observacoes: dados.observacoes || null
  });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
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
async function bhListarNotificacoes({ somenteNaoLidas = false, tipo = null, offset = 0, limite = 30 } = {}) {
  const perfil = await bhGetPerfil();
  if (!perfil) return [];
  const client = bhExigirSupabase();
  let query = client
    .from("notificacoes")
    .select("*")
    .eq("user_id", perfil.id)
    .order("created_at", { ascending: false })
    .range(offset, offset + limite - 1);
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

async function bhListarPortfolioPublico(estabelecimentoId, { offset = 0, limite = 18 } = {}) {
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
    .order("created_at", { ascending: false })
    .range(offset, offset + limite - 1);
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
// PROMOÇÕES
// ============================================================
async function bhCriarPromocao(payload) {
  if (window.bhBackendApi?.createPromotion) {
    try { return await window.bhBackendApi.createPromotion(payload); }
    catch (erro) { if (!bhBackendPodeUsarFallback(erro)) throw erro; }
  }
  const client = bhExigirSupabase();
  const { data, error } = await client.from("promocoes").insert(payload).select().single();
  if (error) throw error;
  return data;
}

async function bhAtualizarPromocao(id, dados) {
  if (window.bhBackendApi?.updatePromotion) {
    try { return await window.bhBackendApi.updatePromotion(id, dados); }
    catch (erro) { if (!bhBackendPodeUsarFallback(erro)) throw erro; }
  }
  const client = bhExigirSupabase();
  const { data, error } = await client.from("promocoes").update(dados).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

async function bhExcluirPromocao(id) {
  if (window.bhBackendApi?.deletePromotion) {
    try { return await window.bhBackendApi.deletePromotion(id); }
    catch (erro) { if (!bhBackendPodeUsarFallback(erro)) throw erro; }
  }
  return bhAtualizarPromocao(id, { ativo: false });
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

async function bhObterEntitlementsEstabelecimento(estabelecimentoId) {
  if (!estabelecimentoId) return null;
  if (window.bhBackendApi?.getEntitlements) {
    try {
      return await window.bhBackendApi.getEntitlements(estabelecimentoId);
    } catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] Entitlements via API indisponíveis; usando RPC local.", erro);
    }
  }
  const client = bhExigirSupabase();
  const { data, error } = await client.rpc("obter_meus_entitlements", { p_estabelecimento_id: estabelecimentoId });
  if (error) throw error;
  return Array.isArray(data) ? data[0] : data;
}

async function bhObterResumoAssinaturaBarbeiro() {
  const estabelecimento = await bhObterMeuEstabelecimento();
  if (!estabelecimento) return null;

  let assinatura = null;
  try { assinatura = await bhObterMinhaAssinatura(); }
  catch (erro) { console.warn("Assinatura indisponível.", erro); }

  let entitlements = null;
  try { entitlements = await bhObterEntitlementsEstabelecimento(estabelecimento.id); }
  catch (erro) { console.warn("Entitlements indisponíveis; usando fallback gratuito.", erro); }

  const client = bhExigirSupabase();
  const { count: totalPublicacoes } = await client
    .from("portfolio_publicacoes")
    .select("id", { count: "exact", head: true })
    .eq("estabelecimento_id", estabelecimento.id)
    .neq("status", "arquivada");

  const fallback = {
    plano_nome: "Perfil gratuito",
    plano_slug: "gratuito",
    plano_ordenacao: 1,
    limite_profissionais: 1,
    limite_publicacoes: 10,
    limite_destaques_portfolio: 1,
    permite_agenda: false,
    permite_relatorios: false,
    permite_equipe: false,
    permite_clientes: false,
    permite_promocoes: false,
    permite_relatorios_avancados: false,
    permite_exportacao: false,
    permite_agenda_avancada: false,
    permite_crm: false,
    permite_financeiro: false,
    permite_comissoes: false,
    permite_equipe_acesso: false,
    limite_membros_equipe: 0,
    prioridade_marketplace: 0,
    recursos: ["Página pública", "Status aberto/fechado"]
  };
  const efetivo = { ...fallback, ...(entitlements || {}) };

  return {
    assinatura,
    estabelecimento,
    entitlements: efetivo,
    plano: {
      nome: efetivo.plano_nome,
      slug: efetivo.plano_slug,
      ordenacao: efetivo.plano_ordenacao,
      limite_profissionais: efetivo.limite_profissionais,
      limite_publicacoes: efetivo.limite_publicacoes,
      limite_destaques_portfolio: efetivo.limite_destaques_portfolio,
      permite_agenda: efetivo.permite_agenda,
      permite_relatorios: efetivo.permite_relatorios,
      permite_equipe: efetivo.permite_equipe,
      permite_clientes: efetivo.permite_clientes,
      permite_promocoes: efetivo.permite_promocoes,
      permite_relatorios_avancados: efetivo.permite_relatorios_avancados,
      permite_exportacao: efetivo.permite_exportacao,
      permite_agenda_avancada: efetivo.permite_agenda_avancada,
      permite_crm: efetivo.permite_crm,
      permite_financeiro: efetivo.permite_financeiro,
      permite_comissoes: efetivo.permite_comissoes,
      permite_equipe_acesso: efetivo.permite_equipe_acesso,
      limite_membros_equipe: efetivo.limite_membros_equipe,
      prioridade_marketplace: efetivo.prioridade_marketplace,
      recursos: efetivo.recursos || []
    },
    uso: {
      profissionais: (estabelecimento.barbeiros || []).filter(item => item.ativo).length,
      publicacoes: totalPublicacoes || 0,
      promocoes: (estabelecimento.promocoes || []).filter(item => item.ativo).length,
      aceitaAgendamento: Boolean(estabelecimento.aceitaAgendamento)
    }
  };
}

// ============================================================
// BARBER HUB 1.3 — FAVORITOS, AVALIAÇÕES E ADMINISTRAÇÃO
// ============================================================
async function bhEstaFavorito(estabelecimentoId) {
  const perfil = await bhGetPerfil();
  if (!perfil || perfil.tipo !== "cliente") return false;
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("favoritos")
    .select("estabelecimento_id")
    .eq("cliente_id", perfil.id)
    .eq("estabelecimento_id", estabelecimentoId)
    .maybeSingle();
  if (error) throw error;
  return Boolean(data);
}

async function bhAlternarFavorito(estabelecimentoId, favoritoAtual = false) {
  const perfil = await bhGetPerfil();
  if (!perfil || perfil.tipo !== "cliente") throw new Error("Entre com uma conta de cliente para usar favoritos.");
  const client = bhExigirSupabase();
  if (favoritoAtual) {
    const { error } = await client.from("favoritos").delete()
      .eq("cliente_id", perfil.id).eq("estabelecimento_id", estabelecimentoId);
    if (error) throw error;
    return false;
  }
  const { error } = await client.from("favoritos").insert({ cliente_id: perfil.id, estabelecimento_id: estabelecimentoId });
  if (error) throw error;
  return true;
}

async function bhListarFavoritosCliente() {
  const perfil = await bhGetPerfil();
  if (!perfil || perfil.tipo !== "cliente") return [];
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("favoritos")
    .select(`created_at, estabelecimentos(${BH_ESTABELECIMENTO_SELECT})`)
    .eq("cliente_id", perfil.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return (data || []).map(item => bhNormalizarEstabelecimento(item.estabelecimentos)).filter(Boolean);
}

async function bhListarAvaliacoesEstabelecimento(estabelecimentoId, { offset = 0, limite = 20 } = {}) {
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("avaliacoes")
    .select(`*, perfis(nome,avatar_url), agendamentos(servicos(nome),profissionais(nome),agendamento_servicos(ordem,nome_snapshot)), portfolio_publicacoes(id,titulo)`)
    .eq("estabelecimento_id", estabelecimentoId)
    .eq("status", "publicada")
    .order("created_at", { ascending: false })
    .range(offset, offset + limite - 1);
  if (error) throw error;
  return data || [];
}

async function bhListarMinhasAvaliacoes() {
  const perfil = await bhGetPerfil();
  if (!perfil) return [];
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("avaliacoes")
    .select(`*, estabelecimentos(nome,slug), agendamentos(data,hora_inicio,servicos(nome),profissionais(nome),agendamento_servicos(ordem,nome_snapshot)), portfolio_publicacoes(id,titulo)`)
    .eq("cliente_id", perfil.id)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function bhCriarOuAtualizarAvaliacao({ agendamentoId, nota, comentario }) {
  const perfil = await bhGetPerfil();
  if (!perfil || perfil.tipo !== "cliente") throw new Error("Somente clientes podem avaliar atendimentos.");
  const client = bhExigirSupabase();
  const payload = {
    agendamento_id: agendamentoId,
    cliente_id: perfil.id,
    nota: Number(nota),
    comentario: String(comentario || "").trim()
  };
  const { data, error } = await client
    .from("avaliacoes")
    .upsert(payload, { onConflict: "agendamento_id" })
    .select()
    .single();
  if (error) throw error;
  return data;
}


async function bhBuscarMinhaAvaliacaoComunidade(estabelecimentoId, publicacaoId = null) {
  const perfil = await bhGetPerfil();
  if (!perfil || perfil.tipo !== "cliente") return null;
  const client = bhExigirSupabase();
  let query = client
    .from("avaliacoes")
    .select("*")
    .eq("cliente_id", perfil.id)
    .eq("estabelecimento_id", estabelecimentoId)
    .eq("origem", "comunidade");
  query = publicacaoId ? query.eq("publicacao_id", publicacaoId) : query.is("publicacao_id", null);
  const { data, error } = await query.maybeSingle();
  if (error) throw error;
  return data;
}

async function bhCriarOuAtualizarAvaliacaoComunidade({ estabelecimentoId, publicacaoId = null, nota, comentario }) {
  const perfil = await bhGetPerfil();
  if (!perfil || perfil.tipo !== "cliente") throw new Error("Entre com uma conta de cliente para avaliar.");
  const client = bhExigirSupabase();
  const existente = await bhBuscarMinhaAvaliacaoComunidade(estabelecimentoId, publicacaoId);
  const payload = {
    estabelecimento_id: estabelecimentoId,
    publicacao_id: publicacaoId || null,
    cliente_id: perfil.id,
    agendamento_id: null,
    origem: "comunidade",
    verificada: false,
    nota: Number(nota),
    comentario: String(comentario || "").trim()
  };
  const query = existente
    ? client.from("avaliacoes").update({ nota: payload.nota, comentario: payload.comentario }).eq("id", existente.id)
    : client.from("avaliacoes").insert(payload);
  const { data, error } = await query.select().single();
  if (error) throw error;
  return data;
}

async function bhResponderAvaliacao(id, resposta) {
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("avaliacoes")
    .update({ resposta_estabelecimento: String(resposta || "").trim() || null })
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function bhListarAvaliacoesMeuEstabelecimento(estabelecimentoId) {
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("avaliacoes")
    .select(`*, perfis(nome,avatar_url), agendamentos(data,hora_inicio,servicos(nome),profissionais(nome),agendamento_servicos(ordem,nome_snapshot)), portfolio_publicacoes(id,titulo)`)
    .eq("estabelecimento_id", estabelecimentoId)
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data || [];
}

async function bhExcluirMinhaConta(senhaAtual) {
  const perfil = await bhGetPerfil();
  if (!perfil) throw new Error("Sessão não encontrada.");
  const client = bhExigirSupabase();

  // A senha é conferida pelo Supabase Auth; a chave secreta nunca sai do backend.
  const { data: login, error: erroLogin } = await client.auth.signInWithPassword({
    email: perfil.email,
    password: senhaAtual
  });
  if (erroLogin) throw new Error("Senha atual incorreta.");

  if (window.bhBackendApi) {
    try {
      await window.bhBackendApi.deleteAccount("EXCLUIR MINHA CONTA");
      bhPerfilCache = null;
      try { await client.auth.signOut(); } catch (_) {}
      return;
    } catch (erro) {
      if (!bhBackendPodeUsarFallback(erro)) throw erro;
      console.warn("[Barber Hub] API de exclusão indisponível; usando RPC local.", erro);
    }
  }

  // Fallback de desenvolvimento. Em produção, a chamada passa por /api/v1.
  const token = login?.session?.access_token;
  if (!token) throw new Error("Não foi possível renovar sua sessão.");
  const { error } = await client.rpc("excluir_minha_conta");
  if (error) throw error;
  bhPerfilCache = null;
  try { await client.auth.signOut(); } catch (_) {}
}

async function bhAdminAtualizarPerfil(id, dados) {
  const client = bhExigirSupabase();
  const permitido = {};
  ["tipo", "ativo"].forEach(chave => { if (dados[chave] !== undefined) permitido[chave] = dados[chave]; });
  const { data, error } = await client.from("perfis").update(permitido).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

async function bhAdminAtualizarEstabelecimento(id, dados) {
  const client = bhExigirSupabase();
  const permitido = {};
  ["visivel", "verificado", "destaque", "suspenso_pela_moderacao", "suspenso_motivo"].forEach(chave => { if (dados[chave] !== undefined) permitido[chave] = dados[chave]; });
  if (dados.verificado === true) permitido.verificado_em = new Date().toISOString();
  if (dados.verificado === false) permitido.verificado_em = null;
  const perfil = await bhGetPerfil();
  if (dados.verificado !== undefined) permitido.verificado_por = dados.verificado ? perfil?.id : null;
  const { data, error } = await client.from("estabelecimentos").update(permitido).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

async function bhAdminAtualizarAvaliacao(id, dados) {
  const client = bhExigirSupabase();
  const { data, error } = await client.from("avaliacoes").update(dados).eq("id", id).select().single();
  if (error) throw error;
  return data;
}
