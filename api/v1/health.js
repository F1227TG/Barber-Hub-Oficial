/**
 * GET /api/v1/health
 * Verifica se a API própria está publicada e se recebeu a configuração básica.
 */

const { createHandler, success } = require("../../server/lib/http");

module.exports = createHandler(async (_req, res) => {
  const configured = Boolean(
    process.env.SUPABASE_URL &&
    (process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY) &&
    (process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY)
  );

  success(res, {
    service: "barber-hub-api",
    version: "1.0.0",
    status: configured ? "ready" : "configuration_required",
    timestamp: new Date().toISOString()
  });
}, ["GET"]);
