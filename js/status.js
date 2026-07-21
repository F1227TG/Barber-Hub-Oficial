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

function bhProximoHorario(estabelecimento, data = new Date()) {
  if (!estabelecimento?.horarios) return null;
  for (let offset = 0; offset <= 7; offset += 1) {
    const teste = new Date(data);
    teste.setDate(data.getDate() + offset);
    const iso = bhDataISO(teste);
    const dia = BH_DIAS[teste.getDay()];
    const horario = estabelecimento.horarios[dia];
    const bloqueado = (estabelecimento.diasFechados || []).some(item => item.data === iso);
    if (!horario || bloqueado) continue;

    if (offset === 0) {
      const agora = data.getHours() * 60 + data.getMinutes();
      if (agora < bhMinutos(horario.abre)) return `Abre hoje às ${horario.abre}.`;
      if (agora < bhMinutos(horario.fecha)) return `Atendimento até ${horario.fecha}.`;
      continue;
    }
    if (offset === 1) return `Reabre amanhã às ${horario.abre}.`;
    return `Reabre ${BH_DIA_LABEL[dia].toLowerCase()} às ${horario.abre}.`;
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

  const dia = BH_DIAS[data.getDay()];
  const horario = estabelecimento.horarios?.[dia];
  if (!horario) {
    return {
      aberta: false,
      classe: "fechada",
      texto: "Fechado",
      detalhe: `${BH_DIA_LABEL[dia]} sem atendimento. ${bhProximoHorario(estabelecimento, data)}`
    };
  }

  const agora = data.getHours() * 60 + data.getMinutes();
  const abre = bhMinutos(horario.abre);
  const fecha = bhMinutos(horario.fecha);
  if (agora >= abre && agora < fecha) {
    return { aberta: true, classe: "aberta", texto: "Aberto agora", detalhe: `Atendimento até ${horario.fecha}.` };
  }
  if (agora < abre) {
    return { aberta: false, classe: "fechada", texto: "Fechado", detalhe: `Abre hoje às ${horario.abre}.` };
  }
  return { aberta: false, classe: "fechada", texto: "Fechado", detalhe: bhProximoHorario(estabelecimento, data) };
}

function bhRenderStatus(estabelecimento) {
  const status = bhCalcularStatus(estabelecimento);
  return `<span class="status ${status.classe}" title="${escapeHTML(status.detalhe)}">${escapeHTML(status.texto)}</span>`;
}

function bhHorarioPorDiaLabel(estabelecimento) {
  return BH_DIAS.map(dia => ({
    dia: BH_DIA_LABEL[dia],
    texto: estabelecimento.horarios?.[dia]
      ? `${estabelecimento.horarios[dia].abre} às ${estabelecimento.horarios[dia].fecha}`
      : "Fechado"
  }));
}
