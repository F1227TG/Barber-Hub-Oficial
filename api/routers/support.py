"""HTTP contracts for the support domain."""

from __future__ import annotations

from fastapi import Depends, Request, status
from fastapi.responses import JSONResponse
from backend.schemas.support import SupportTicketCreate
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_user
from backend.services import support as support_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.get("/api/v1/support/tickets")
async def list_support_tickets(
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "support-list", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await support_service.list_for_user(auth))


@router.post("/api/v1/support/tickets", status_code=status.HTTP_201_CREATED)
async def create_support_ticket(
    request: Request,
    payload: SupportTicketCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "support-create", limit=6, window_seconds=600, identity=auth.user_id)
    result = await support_service.create(payload, auth, request)
    return ok(result, status.HTTP_201_CREATED)
