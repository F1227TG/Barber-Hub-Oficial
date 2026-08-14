"""Distributed API rate limiting backed by PostgreSQL.

Vercel Functions can scale across multiple instances, so an in-memory counter
would not be a reliable security boundary. The counter lives in PostgreSQL and
is consumed atomically through the migration 15 RPC.
"""

from __future__ import annotations

import hashlib
from fastapi import Request

from backend.errors import ApiError
from backend.supabase import gateway


def _client_key(request: Request, scope: str, identity: str | None = None) -> str:
    forwarded = request.headers.get("x-forwarded-for", "")
    ip = forwarded.split(",", 1)[0].strip() or (request.client.host if request.client else "unknown")
    raw = f"{scope}|{identity or 'anonymous'}|{ip}"
    digest = hashlib.sha256(raw.encode("utf-8")).hexdigest()
    return f"{scope}:{digest}"


async def enforce(
    request: Request,
    scope: str,
    *,
    limit: int,
    window_seconds: int,
    identity: str | None = None,
) -> dict[str, int | bool]:
    """Consume one request from a distributed rate-limit bucket."""

    data = await gateway.rest(
        "consumir_api_rate_limit",
        method="POST",
        admin=True,
        rpc=True,
        json={
            "p_chave": _client_key(request, scope, identity),
            "p_janela_segundos": window_seconds,
            "p_limite": limit,
        },
    )
    row = data[0] if isinstance(data, list) and data else (data or {})
    result = {
        "allowed": bool(row.get("permitido", False)),
        "remaining": int(row.get("restante") or 0),
        "retry_after": int(row.get("retry_after") or 0),
    }
    if not result["allowed"]:
        retry = max(result["retry_after"], 1)
        raise ApiError(
            429,
            "RATE_LIMITED",
            "Muitas tentativas em pouco tempo. Aguarde alguns minutos e tente novamente.",
            {"retry_after": retry},
            {"Retry-After": str(retry)},
        )
    return result
