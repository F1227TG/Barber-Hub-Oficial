"""HTTP contracts for the crm domain."""

from __future__ import annotations

from datetime import datetime
from fastapi import Depends, Query, Request, status
from fastapi.responses import JSONResponse
from backend.schemas.crm import CRMClientUpdate
from backend.schemas.crm import CRMNoteCreate
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_user
from backend.services import crm as crm_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.get("/api/v1/crm/clients")
async def list_crm_clients(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    q: str | None = Query(default=None, max_length=120),
    segment: str | None = Query(default=None, pattern="^(lead|novo|recorrente|em_risco|inativo)?$"),
    cursor_last: datetime | None = Query(default=None),
    cursor_id: str | None = Query(default=None, min_length=36, max_length=36),
    limit: int = Query(default=30, ge=1, le=60),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "crm-list", limit=90, window_seconds=60, identity=auth.user_id)
    return ok(await crm_service.list_clients(establishment_id, q, segment, cursor_last, cursor_id, limit, auth))


@router.get("/api/v1/crm/clients/{client_id}")
async def get_crm_client(
    client_id: str,
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "crm-detail", limit=120, window_seconds=60, identity=auth.user_id)
    return ok(await crm_service.get_client(client_id, auth))


@router.patch("/api/v1/crm/clients/{client_id}")
async def update_crm_client(
    client_id: str,
    request: Request,
    payload: CRMClientUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "crm-update", limit=60, window_seconds=300, identity=auth.user_id)
    return ok(await crm_service.update_client(client_id, payload, auth))


@router.post("/api/v1/crm/clients/{client_id}/notes", status_code=status.HTTP_201_CREATED)
async def add_crm_note(
    client_id: str,
    request: Request,
    payload: CRMNoteCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "crm-note-create", limit=60, window_seconds=300, identity=auth.user_id)
    return ok(await crm_service.add_note(client_id, payload, auth), status.HTTP_201_CREATED)
