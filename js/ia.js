function bhGerarSlots(estabelecimento, dataISO, duracao = 30) {
  if (!estabelecimento || !dataISO || dataISO < bhHojeISO()) return [];
  if (!estabelecimento.aceitaAgendamento || estabelecimento.statusManual === "fechado") return [];
  if ((estabelecimento.diasFechados || []).some(item => item.data === dataISO)) return [];

  const data = new Date(`${dataISO}T00:00:00`);
  const horario = estabelecimento.horarios?.[BH_DIAS[data.getDay()]];
  if (!horario) return [];

  const intervalo = Number(estabelecimento.intervaloSlots || 30);
  const inicio = bhMinutos(horario.abre);
  const fim = bhMinutos(horario.fecha);
  const agora = new Date();
  const limiteAgora = agora.getHours() * 60 + agora.getMinutes() + Number(estabelecimento.antecedenciaHoras || 1) * 60;
  const lista = [];

  for (let minutos = inicio; minutos + duracao <= fim; minutos += intervalo) {
    if (dataISO === bhHojeISO() && minutos < limiteAgora) continue;
    lista.push(bhHoraDeMinutos(minutos));
  }
  return lista;
}

function bhSlotsComDisponibilidade(estabelecimento, dataISO, duracao, ocupados = []) {
  return bhGerarSlots(estabelecimento, dataISO, duracao).map(horario => {
    const inicio = bhMinutos(horario);
    const fim = inicio + Number(duracao || 30);
    const conflito = ocupados.some(item => inicio < bhMinutos(item.fim) && fim > bhMinutos(item.inicio));
    return { horario, disponivel: !conflito };
  });
}

function bhSugerirHorario(slots) {
  const livres = (slots || []).filter(item => item.disponivel);
  const preferidos = ["09:00", "10:00", "15:00", "16:00"];
  return livres.find(item => preferidos.includes(item.horario)) || livres[0] || null;
}

function bhAnalisarAgendamentos(agendamentos = []) {
  const ativos = agendamentos.filter(item => !["cancelado", "recusado"].includes(item.status));
  const contagemServicos = {};
  const contagemHoras = {};
  const contagemDias = {};

  ativos.forEach(item => {
    const servico = item.servicos?.nome || item.servico_nome || "Serviço";
    const hora = bhHoraCurta(item.hora_inicio);
    const dia = item.data;
    contagemServicos[servico] = (contagemServicos[servico] || 0) + 1;
    contagemHoras[hora] = (contagemHoras[hora] || 0) + 1;
    contagemDias[dia] = (contagemDias[dia] || 0) + 1;
  });

  const topo = objeto => Object.entries(objeto).sort((a, b) => b[1] - a[1])[0] || null;
  return {
    servicoMaisUsado: topo(contagemServicos),
    horarioMaisUsado: topo(contagemHoras),
    diaMaisUsado: topo(contagemDias),
    contagemServicos,
    contagemHoras,
    total: ativos.length
  };
}

function bhRecomendacaoPainel(agendamentos = [], servicos = []) {
  const analise = bhAnalisarAgendamentos(agendamentos);
  if (!analise.total) {
    return {
      titulo: "Primeiros dados em construção",
      texto: "Quando os primeiros atendimentos forem registrados, o Barber Hub vai identificar horários fortes, serviços populares e oportunidades de promoção."
    };
  }
  if (analise.servicoMaisUsado) {
    return {
      titulo: "Serviço em destaque",
      texto: `${analise.servicoMaisUsado[0]} lidera com ${analise.servicoMaisUsado[1]} agendamento(s). Considere criar um combo ou destacar esse serviço na página pública.`
    };
  }
  const poucoUsado = servicos.find(servico => servico.ativo);
  return {
    titulo: "Sugestão inteligente",
    texto: poucoUsado ? `Experimente divulgar ${poucoUsado.nome} em um dia de menor movimento.` : "Cadastre serviços para receber recomendações."
  };
}
