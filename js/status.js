/**
 * status.js
 * Cálculo do estado aberto, fechado, automático e exceções de horário.
 *
 * Organização: constantes e estado local → funções de renderização →
 * operações assíncronas → eventos e inicialização da página.
 */

const BH_DIAS = ["domingo", "segunda", "terca", "quarta", "quinta", "sexta", "sabado"];
const BH_DIA_LABEL = {
  domingo: "Domingo",
  segunda: "Segunda-feira",
  terca: "Terça-feira",
  quarta: "Quarta-feira",
  quinta: "Quinta-feira",
  sexta: "Sexta-feira",
  sabado: "Sábado"
};

function bhPeriodosDoDia(estabelecimento, dia) {
  const novos = estabelecimento?.horariosPeriodos?.[dia] || [];
  if (novos.length) return novos;
  const legado = estabelecimento?.horarios?.[dia];
  return legado ? [{ ...legado, fechaDiaSeguinte: false, ordem: 1 }] : [];
}

function bhProximoHorario(estabelecimento, data = new Date()) {
  for (let offset = 0; offset <= 7; offset += 1) {
    const teste = new Date(data);
    teste.setDate(data.getDate() + offset);
    const iso = bhDataISO(teste);
    const dia = BH_DIAS[teste.getDay()];
    const periodos = bhPeriodosDoDia(estabelecimento, dia);
    const bloqueado = (estabelecimento.diasFechados || []).some(item => item.data === iso);
    if (!periodos.length || bloqueado) continue;

    if (offset === 0) {
      const agora = data.getHours() * 60 + data.getMinutes();
      const proximo = periodos.find(periodo => bhMinutos(periodo.abre) > agora);
      if (proximo) return `${periodos.indexOf(proximo) ? "Reabre" : "Abre"} hoje às ${proximo.abre}.`;
      continue;
    }
    const primeiro = periodos[0];
    if (offset === 1) return `Reabre amanhã às ${primeiro.abre}.`;
    return `Reabre ${BH_DIA_LABEL[dia].toLowerCase()} às ${primeiro.abre}.`;
  }
  return "Sem próximo horário cadastrado.";
}

function bhCalcularStatus(estabelecimento, data = new Date()) {
  if (!estabelecimento) {
    return { aberta: false, classe: "fechada", texto: "Indisponível", detalhe: "Estabelecimento não encontrado." };
  }

  if (estabelecimento.statusManual === "aberto") {
    const motivo = estabelecimento.motivoStatus || "Aberto manualmente pelo responsável.";
    const antecipado = /antecip/i.test(motivo);
    return {
      aberta: true,
      classe: "aberta",
      texto: antecipado ? "Aberto antecipadamente" : "Aberto agora",
      detalhe: motivo
    };
  }

  if (estabelecimento.statusManual === "fechado") {
    const motivo = estabelecimento.motivoStatus || "Fechado manualmente pelo responsável.";
    const cedo = /mais cedo|antecip/i.test(motivo);
    return {
      aberta: false,
      classe: "fechada",
      texto: cedo ? "Fechado mais cedo" : "Fechado temporariamente",
      detalhe: motivo
    };
  }

  const iso = bhDataISO(data);
  const bloqueio = (estabelecimento.diasFechados || []).find(item => item.data === iso);
  if (bloqueio) {
    return { aberta: false, classe: "fechada", texto: "Fechado hoje", detalhe: bloqueio.motivo || "Data indisponível." };
  }

  const diaIndice = data.getDay();
  const dia = BH_DIAS[diaIndice];
  const periodos = bhPeriodosDoDia(estabelecimento, dia);
  const diaAnterior = BH_DIAS[(diaIndice + 6) % 7];
  const periodoAnterior = bhPeriodosDoDia(estabelecimento, diaAnterior)
    .find(periodo => periodo.fechaDiaSeguinte && data.getHours() * 60 + data.getMinutes() < bhMinutos(periodo.fecha));
  if (!periodos.length && !periodoAnterior) {
    return {
      aberta: false,
      classe: "fechada",
      texto: "Fechado",
      detalhe: `${BH_DIA_LABEL[dia]} sem atendimento. ${bhProximoHorario(estabelecimento, data)}`
    };
  }

  const agora = data.getHours() * 60 + data.getMinutes();
  if (periodoAnterior) return { aberta: true, classe: "aberta", texto: "Aberto agora", detalhe: `Atendimento até ${periodoAnterior.fecha}.` };
  const periodoAtual = periodos.find(periodo => {
    const abre = bhMinutos(periodo.abre);
    const fecha = bhMinutos(periodo.fecha) + (periodo.fechaDiaSeguinte ? 1440 : 0);
    return agora >= abre && agora < fecha;
  });
  if (periodoAtual) return { aberta: true, classe: "aberta", texto: "Aberto agora", detalhe: `Atendimento até ${periodoAtual.fecha}${periodoAtual.fechaDiaSeguinte ? " do dia seguinte" : ""}.` };
  const proximoHoje = periodos.find(periodo => bhMinutos(periodo.abre) > agora);
  if (proximoHoje) return { aberta: false, classe: "fechada", texto: "Fechado", detalhe: `${periodos.indexOf(proximoHoje) ? "Reabre" : "Abre"} hoje às ${proximoHoje.abre}.` };
  return { aberta: false, classe: "fechada", texto: "Fechado", detalhe: bhProximoHorario(estabelecimento, data) };
}

function bhRenderStatus(estabelecimento) {
  const status = bhCalcularStatus(estabelecimento);
  return `<span class="status ${status.classe}" title="${escapeHTML(status.detalhe)}">${escapeHTML(status.texto)}</span>`;
}

function bhHorarioPorDiaLabel(estabelecimento) {
  return BH_DIAS.map(dia => ({
    dia: BH_DIA_LABEL[dia],
    texto: bhPeriodosDoDia(estabelecimento, dia).length
      ? bhPeriodosDoDia(estabelecimento, dia).map(periodo => `${periodo.abre} às ${periodo.fecha}${periodo.fechaDiaSeguinte ? " (+1 dia)" : ""}`).join(" · ")
      : "Fechado"
  }));
}
