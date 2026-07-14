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
  const { data, error } = await client
    .from("estabelecimentos")
    .update(dados)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data;
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
  const { data, error } = await client
    .from("servicos")
    .insert({ estabelecimento_id: estabelecimentoId, ...dados })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function bhAtualizarServico(id, dados) {
  const client = bhExigirSupabase();
  const { data, error } = await client.from("servicos").update(dados).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

async function bhExcluirServico(id) {
  const client = bhExigirSupabase();
  const { error } = await client.from("servicos").delete().eq("id", id);
  if (error) throw error;
}

async function bhCriarProfissional(estabelecimentoId, dados) {
  const client = bhExigirSupabase();
  const { data, error } = await client
    .from("profissionais")
    .insert({ estabelecimento_id: estabelecimentoId, ...dados })
    .select()
    .single();
  if (error) throw error;
  return data;
}

async function bhAtualizarProfissional(id, dados) {
  const client = bhExigirSupabase();
  const { data, error } = await client.from("profissionais").update(dados).eq("id", id).select().single();
  if (error) throw error;
  return data;
}

async function bhExcluirProfissional(id) {
  const client = bhExigirSupabase();
  const { error } = await client.from("profissionais").delete().eq("id", id);
  if (error) throw error;
}

async function bhAdicionarDiaBloqueado(estabelecimentoId, data, motivo) {
  const client = bhExigirSupabase();
  const { data: item, error } = await client
    .from("dias_bloqueados")
    .insert({ estabelecimento_id: estabelecimentoId, data, motivo: motivo || null })
    .select()
    .single();
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
  const [perfis, estabelecimentos, agendamentos, tickets] = await Promise.all([
    client.from("perfis").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(100),
    client.from("estabelecimentos").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(100),
    client.from("agendamentos").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(100),
    client.from("tickets_suporte").select("*", { count: "exact" }).order("created_at", { ascending: false }).limit(100)
  ]);
  [perfis, estabelecimentos, agendamentos, tickets].forEach(resultado => {
    if (resultado.error) throw resultado.error;
  });
  return {
    perfis: perfis.data || [],
    estabelecimentos: estabelecimentos.data || [],
    agendamentos: agendamentos.data || [],
    tickets: tickets.data || [],
    counts: {
      perfis: perfis.count || 0,
      estabelecimentos: estabelecimentos.count || 0,
      agendamentos: agendamentos.count || 0,
      tickets: tickets.count || 0
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
