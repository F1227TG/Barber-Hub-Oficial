"""HTTP contracts for the professionals domain."""

from __future__ import annotations

from fastapi import Depends, Request, status
from fastapi.responses import JSONResponse
from backend.schemas.professionals import ProfessionalCreate
from backend.schemas.professionals import ProfessionalUpdate
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_user
from backend.services import management as management_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.post("/api/v1/professionals", status_code=status.HTTP_201_CREATED)
async def create_professional(
    request: Request,
    payload: ProfessionalCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "professionals-create", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.create_professional(payload, auth), status.HTTP_201_CREATED)


@router.patch("/api/v1/professionals/{professional_id}")
async def update_professional(
    professional_id: str,
    request: Request,
    payload: ProfessionalUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "professionals-update", limit=80, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.update_professional(professional_id, payload, auth))


@router.delete("/api/v1/professionals/{professional_id}")
async def delete_professional(
    professional_id: str,
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "professionals-delete", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.delete_professional(professional_id, auth))
