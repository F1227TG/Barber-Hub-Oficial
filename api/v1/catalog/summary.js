/**
 * GET /api/v1/catalog/summary
 * Entrega métricas públicas da plataforma sem expor a consulta do banco ao navegador.
 */

const { createHandler, success } = require("../../../server/lib/http");
const { request } = require("../../../server/lib/supabase");

module.exports = createHandler(async (_req, res) => {
  const { data } = await request("/rest/v1/rpc/metricas_publicas", {
    method: "POST",
    admin: true,
    body: {}
  });

  const summary = Array.isArray(data) ? (data[0] || {}) : (data || {});
  success(res, {
    estabelecimentos: Number(summary.estabelecimentos || 0),
    agendamentos: Number(summary.com_agenda || 0),
    barbearias: Number(summary.barbearias || 0),
    saloes: Number(summary.saloes || 0)
  });
}, ["GET"]);
