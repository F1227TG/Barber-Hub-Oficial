/**
 * GET  /api/v1/support/tickets  -> lista tickets do usuário autenticado.
 * POST /api/v1/support/tickets  -> abre um ticket validado pelo backend.
 */

const crypto = require("node:crypto");
const {
  ApiError,
  clientIp,
  createHandler,
  email,
  enumValue,
  readJson,
  success,
  text
} = require("../../../server/lib/http");
const { authenticatedUser, request } = require("../../../server/lib/supabase");

const CATEGORIES = ["duvida", "suporte", "cadastro", "financeiro", "sugestao", "outro"];
const PRIORITIES = ["baixa", "normal", "alta", "urgente"];

async function listTickets(req, res) {
  const { user } = await authenticatedUser(req, true);
  const query = `/rest/v1/tickets_suporte?user_id=eq.${encodeURIComponent(user.id)}&select=*&order=created_at.desc&limit=100`;
  const { data } = await request(query, { admin: true });
  success(res, Array.isArray(data) ? data : []);
}

async function createTicket(req, res) {
  const body = await readJson(req);

  // Campo invisível: bots simples costumam preenchê-lo. Usuários reais não.
  if (String(body.website || "").trim()) {
    throw new ApiError(422, "SPAM_DETECTED", "Não foi possível validar o envio.");
  }

  const auth = await authenticatedUser(req, false);
  const payload = {
    id: crypto.randomUUID(),
    user_id: auth.user?.id || null,
    nome: text(body.nome, { min: 2, max: 120, field: "o nome" }),
    email: email(body.email),
    categoria: enumValue(body.categoria, CATEGORIES, "duvida", "A categoria"),
    prioridade: enumValue(body.prioridade, PRIORITIES, "normal", "A prioridade"),
    assunto: text(body.assunto, { min: 5, max: 160, field: "o assunto" }),
    mensagem: text(body.mensagem, { min: 15, max: 4000, field: "a mensagem" })
  };

  // Evita envios duplicados acidentais ou automações simples em sequência.
  const since = new Date(Date.now() - 60_000).toISOString();
  const duplicateQuery = `/rest/v1/tickets_suporte?email=eq.${encodeURIComponent(payload.email)}&created_at=gte.${encodeURIComponent(since)}&select=id&limit=1`;
  const { data: recentTickets } = await request(duplicateQuery, { admin: true });
  if (Array.isArray(recentTickets) && recentTickets.length) {
    throw new ApiError(429, "RATE_LIMITED", "Aguarde um minuto antes de enviar outro ticket.");
  }

  const { data } = await request("/rest/v1/tickets_suporte", {
    method: "POST",
    admin: true,
    body: payload,
    headers: { Prefer: "return=representation" }
  });

  console.info("[Barber Hub API] ticket", {
    id: payload.id,
    category: payload.categoria,
    authenticated: Boolean(auth.user),
    ip: clientIp(req)
  });

  success(res, Array.isArray(data) ? data[0] : payload, 201);
}

module.exports = createHandler(async (req, res) => {
  if (req.method === "GET") return listTickets(req, res);
  return createTicket(req, res);
}, ["GET", "POST"]);
