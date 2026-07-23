/**
 * Acesso do backend ao Supabase.
 * A chave secret — ou service_role legada — fica somente nas variáveis protegidas da Vercel.
 */

const { ApiError, bearerToken } = require("./http");

function config() {
  const url = String(process.env.SUPABASE_URL || "").replace(/\/$/, "");
  const anonKey = String(process.env.SUPABASE_PUBLISHABLE_KEY || process.env.SUPABASE_ANON_KEY || "");
  const serviceRoleKey = String(process.env.SUPABASE_SECRET_KEY || process.env.SUPABASE_SERVICE_ROLE_KEY || "");

  if (!url || !anonKey) {
    throw new ApiError(503, "BACKEND_NOT_CONFIGURED", "A API ainda não recebeu as variáveis públicas do Supabase.");
  }

  return { url, anonKey, serviceRoleKey };
}

async function request(path, options = {}) {
  const { url, anonKey, serviceRoleKey } = config();
  const {
    method = "GET",
    body,
    token,
    admin = false,
    headers = {}
  } = options;

  if (admin && !serviceRoleKey) {
    throw new ApiError(503, "BACKEND_NOT_CONFIGURED", "A chave protegida do backend ainda não foi configurada.");
  }

  const apiKey = admin ? serviceRoleKey : anonKey;
  const authorizationHeaders = token
    ? { Authorization: `Bearer ${token}` }
    : apiKey.startsWith("eyJ")
      ? { Authorization: `Bearer ${apiKey}` }
      : {};

  const response = await fetch(`${url}${path}`, {
    method,
    headers: {
      apikey: apiKey,
      ...authorizationHeaders,
      "Content-Type": "application/json",
      ...headers
    },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {})
  });

  const raw = await response.text();
  let data = null;
  if (raw) {
    try { data = JSON.parse(raw); } catch (_) { data = raw; }
  }

  if (!response.ok) {
    const message = data?.message || data?.msg || data?.error_description || "Falha na comunicação com o banco.";
    throw new ApiError(response.status, "SUPABASE_ERROR", message, data);
  }

  return { data, headers: response.headers, status: response.status };
}

async function authenticatedUser(req, required = true) {
  const token = bearerToken(req, required);
  if (!token) return { token: null, user: null };

  try {
    const { data } = await request("/auth/v1/user", { token });
    return { token, user: data };
  } catch (error) {
    if (!required) return { token: null, user: null };
    throw new ApiError(401, "INVALID_SESSION", "Sua sessão expirou. Entre novamente.");
  }
}

async function profile(userId) {
  const query = `/rest/v1/perfis?id=eq.${encodeURIComponent(userId)}&select=id,nome,email,tipo,ativo&limit=1`;
  const { data } = await request(query, { admin: true });
  const item = Array.isArray(data) ? data[0] : null;
  if (!item) throw new ApiError(404, "PROFILE_NOT_FOUND", "Perfil não encontrado.");
  return item;
}

async function adminProfile(req) {
  const auth = await authenticatedUser(req, true);
  const current = await profile(auth.user.id);
  if (!current.ativo || current.tipo !== "admin") {
    throw new ApiError(403, "FORBIDDEN", "Esta operação exige uma conta administrativa ativa.");
  }
  return { ...auth, profile: current };
}

async function countRows(table, filter = "") {
  const suffix = filter ? `&${filter}` : "";
  const { headers } = await request(`/rest/v1/${table}?select=id&limit=1${suffix}`, {
    admin: true,
    headers: { Prefer: "count=exact", Range: "0-0" }
  });
  const contentRange = headers.get("content-range") || "0/0";
  const total = Number(contentRange.split("/").pop());
  return Number.isFinite(total) ? total : 0;
}

module.exports = {
  adminProfile,
  authenticatedUser,
  config,
  countRows,
  profile,
  request
};
