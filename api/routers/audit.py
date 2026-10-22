"""HTTP contracts for the audit domain."""

from __future__ import annotations

from fastapi import Depends, Query, Request
from fastapi.responses import JSONResponse
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_user
from backend.services import audit as audit_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.get("/api/v1/audit/operational")
async def operational_audit(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    resource: str | None = Query(default=None, pattern="^(agenda|financeiro|horarios|fechamento|importacao|configuracao|equipe|retencao|campanhas|crescimento|metas)$"),
    offset: int = Query(default=0, ge=0, le=10_000), limit: int = Query(default=30, ge=1, le=100),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "operational-audit", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await audit_service.list_events(establishment_id, resource, offset, limit, auth))
