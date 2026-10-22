"""HTTP contracts for the establishments domain."""

from __future__ import annotations

from fastapi import Depends, Request, status
from fastapi.responses import JSONResponse
from backend.schemas.establishments import EstablishmentStatusUpdate
from backend.schemas.establishments import EstablishmentUpdate
from backend.schemas.establishments import ServiceCreate
from backend.schemas.establishments import ServiceUpdate
from backend.schemas.establishments import EstablishmentLocationUpdate
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_user
from backend.services import management as management_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.patch("/api/v1/establishments/{establishment_id}")
async def update_establishment(
    establishment_id: str,
    request: Request,
    payload: EstablishmentUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "establishment-update", limit=60, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.update_establishment(establishment_id, payload, auth))


@router.put("/api/v1/establishments/{establishment_id}/location")
async def update_establishment_location(
    establishment_id: str,
    request: Request,
    payload: EstablishmentLocationUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "establishment-location", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.update_location(establishment_id, payload, auth))


@router.patch("/api/v1/establishments/{establishment_id}/status")
async def update_establishment_status(
    establishment_id: str,
    request: Request,
    payload: EstablishmentStatusUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "establishment-status", limit=80, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.update_establishment_status(establishment_id, payload, auth))


@router.get("/api/v1/establishments/{establishment_id}/entitlements")
async def establishment_entitlements(
    establishment_id: str,
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "establishment-entitlements", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await management_service.get_entitlements(establishment_id, auth))


@router.post("/api/v1/services", status_code=status.HTTP_201_CREATED)
async def create_service(
    request: Request,
    payload: ServiceCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "services-create", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.create_service(payload, auth), status.HTTP_201_CREATED)


@router.patch("/api/v1/services/{service_id}")
async def update_service(
    service_id: str,
    request: Request,
    payload: ServiceUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "services-update", limit=80, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.update_service(service_id, payload, auth))


@router.delete("/api/v1/services/{service_id}")
async def delete_service(
    service_id: str,
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "services-delete", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.delete_service(service_id, auth))
