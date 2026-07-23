/**
 * GET /api/v1/admin/overview
 * Resumo protegido para futuras telas administrativas e integrações externas.
 */

const { createHandler, success } = require("../../../server/lib/http");
const { adminProfile, countRows } = require("../../../server/lib/supabase");

module.exports = createHandler(async (req, res) => {
  await adminProfile(req);

  const [usuarios, estabelecimentos, agendamentos, ticketsAbertos, avaliacoes] = await Promise.all([
    countRows("perfis"),
    countRows("estabelecimentos"),
    countRows("agendamentos"),
    countRows("tickets_suporte", "status=in.(aberto,em_analise,respondido)"),
    countRows("avaliacoes")
  ]);

  success(res, {
    usuarios,
    estabelecimentos,
    agendamentos,
    ticketsAbertos,
    avaliacoes,
    generatedAt: new Date().toISOString()
  });
}, ["GET"]);
