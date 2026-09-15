"""Service probes used by orchestration without exposing infrastructure."""

from __future__ import annotations

from backend.config import settings
from backend.errors import ApiError
from backend.supabase import gateway


async def readiness() -> dict[str, str]:
    if not settings.is_configured:
        raise ApiError(503, "SERVICE_NOT_READY", "O Barber Hub ainda está iniciando. Tente novamente em instantes.")
    try:
        await gateway.rest("perfis", admin=True, params={"select": "id", "limit": "1"})
    except ApiError as exc:
        raise ApiError(503, "SERVICE_NOT_READY", "O Barber Hub ainda está iniciando. Tente novamente em instantes.") from exc
    return {"service": "barber-hub-api", "status": "ready"}
