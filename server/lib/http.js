/**
 * Utilitários HTTP compartilhados pela API própria do Barber Hub.
 * Mantém respostas, validações e tratamento de erros consistentes.
 */

class ApiError extends Error {
  constructor(status, code, message, details = null) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

function configureCors(req, res) {
  const origin = req.headers?.origin;
  const allowed = String(process.env.BARBER_HUB_ALLOWED_ORIGINS || "")
    .split(",")
    .map(value => value.trim())
    .filter(Boolean);

  // Chamadas do próprio domínio não precisam de CORS. A lista opcional é
  // usada futuramente pelo aplicativo Capacitor ou por ambientes de preview.
  if (origin && allowed.includes(origin)) {
    res.setHeader("Access-Control-Allow-Origin", origin);
    res.setHeader("Vary", "Origin");
    res.setHeader("Access-Control-Allow-Credentials", "true");
  }

  res.setHeader("Access-Control-Allow-Headers", "Authorization, Content-Type, X-Requested-With");
  res.setHeader("Access-Control-Allow-Methods", "GET, POST, PATCH, DELETE, OPTIONS");
  res.setHeader("Cache-Control", "no-store");
  res.setHeader("X-Content-Type-Options", "nosniff");
}

function sendJson(res, status, payload) {
  res.statusCode = status;
  res.setHeader("Content-Type", "application/json; charset=utf-8");
  res.end(JSON.stringify(payload));
}

function success(res, data = {}, status = 200) {
  sendJson(res, status, { success: true, data });
}

function fail(res, status, code, message, details = null) {
  sendJson(res, status, {
    success: false,
    error: { code, message, ...(details ? { details } : {}) }
  });
}

function allowMethods(req, methods) {
  const method = String(req.method || "GET").toUpperCase();
  if (!methods.includes(method)) {
    throw new ApiError(405, "METHOD_NOT_ALLOWED", "Método não permitido neste endpoint.");
  }
  return method;
}

async function readJson(req, maxBytes = 24_000) {
  if (req.body && typeof req.body === "object" && !Buffer.isBuffer(req.body)) {
    return req.body;
  }

  if (typeof req.body === "string") {
    if (Buffer.byteLength(req.body, "utf8") > maxBytes) {
      throw new ApiError(413, "PAYLOAD_TOO_LARGE", "O conteúdo enviado ultrapassa o limite permitido.");
    }
    try {
      return req.body ? JSON.parse(req.body) : {};
    } catch (_) {
      throw new ApiError(400, "INVALID_JSON", "O corpo da requisição precisa ser um JSON válido.");
    }
  }

  const chunks = [];
  let total = 0;
  for await (const chunk of req) {
    total += chunk.length;
    if (total > maxBytes) {
      throw new ApiError(413, "PAYLOAD_TOO_LARGE", "O conteúdo enviado ultrapassa o limite permitido.");
    }
    chunks.push(chunk);
  }

  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString("utf8"));
  } catch (_) {
    throw new ApiError(400, "INVALID_JSON", "O corpo da requisição precisa ser um JSON válido.");
  }
}

function text(value, { min = 0, max = 500, field = "campo" } = {}) {
  const clean = String(value ?? "").replace(/\s+/g, " ").trim();
  if (clean.length < min) {
    throw new ApiError(422, "VALIDATION_ERROR", `Preencha ${field} corretamente.`);
  }
  if (clean.length > max) {
    throw new ApiError(422, "VALIDATION_ERROR", `${field} ultrapassa o limite de ${max} caracteres.`);
  }
  return clean;
}

function email(value) {
  const clean = text(value, { min: 5, max: 180, field: "o e-mail" }).toLowerCase();
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(clean)) {
    throw new ApiError(422, "INVALID_EMAIL", "Informe um e-mail válido.");
  }
  return clean;
}

function enumValue(value, allowed, fallback, field) {
  const clean = String(value || fallback || "").trim().toLowerCase();
  if (!allowed.includes(clean)) {
    throw new ApiError(422, "VALIDATION_ERROR", `${field} possui um valor inválido.`);
  }
  return clean;
}

function bearerToken(req, required = true) {
  const header = String(req.headers?.authorization || "");
  const match = header.match(/^Bearer\s+(.+)$/i);
  if (!match && required) {
    throw new ApiError(401, "UNAUTHORIZED", "Entre na conta para continuar.");
  }
  return match?.[1] || null;
}

function clientIp(req) {
  const forwarded = String(req.headers?.["x-forwarded-for"] || "").split(",")[0].trim();
  return forwarded || req.socket?.remoteAddress || "unknown";
}

function handleError(res, error) {
  if (error instanceof ApiError) {
    fail(res, error.status, error.code, error.message, error.details);
    return;
  }

  console.error("[Barber Hub API]", error);
  fail(res, 500, "INTERNAL_ERROR", "Não foi possível concluir a operação agora.");
}

function createHandler(handler, methods = ["GET"]) {
  return async function barberHubApiHandler(req, res) {
    configureCors(req, res);
    if (String(req.method).toUpperCase() === "OPTIONS") {
      res.statusCode = 204;
      res.end();
      return;
    }

    try {
      allowMethods(req, methods);
      await handler(req, res);
    } catch (error) {
      handleError(res, error);
    }
  };
}

module.exports = {
  ApiError,
  bearerToken,
  clientIp,
  createHandler,
  email,
  enumValue,
  readJson,
  sendJson,
  success,
  fail,
  text
};
