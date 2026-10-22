"""HTTP contracts for the marketplace domain."""

from __future__ import annotations

from fastapi import Depends, Query, Request, status
from fastapi.responses import JSONResponse
from backend.errors import ApiError
from backend.schemas.marketplace import PromotionCreate
from backend.schemas.marketplace import PromotionUpdate
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_user
from backend.services import catalog as catalog_service
from backend.services import management as management_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.get("/api/v1/catalog/summary")
async def catalog_summary(request: Request) -> JSONResponse:
    await enforce_rate_limit(request, "catalog-summary", limit=120, window_seconds=60)
    return ok(await catalog_service.summary())


@router.get("/api/v1/marketplace/search")
async def marketplace_search(
    request: Request,
    q: str | None = Query(default=None, max_length=120),
    tipo: str | None = Query(default=None, pattern="^(barbearia|salao|todos)?$"),
    agenda: bool | None = Query(default=None),
    status_filter: str | None = Query(default=None, alias="status", pattern="^(aberta|fechada|todos)?$"),
    offset: int = Query(default=0, ge=0),
    limit: int = Query(default=24, ge=1, le=60),
) -> JSONResponse:
    await enforce_rate_limit(request, "marketplace-search", limit=180, window_seconds=60)
    return ok(await catalog_service.search(
        query=q,
        tipo=tipo,
        agenda=agenda,
        status=status_filter,
        offset=offset,
        limit=limit,
    ))


@router.get("/api/v1/marketplace/featured")
async def marketplace_featured(request: Request, limit: int = Query(default=6, ge=1, le=12)) -> JSONResponse:
    await enforce_rate_limit(request, "marketplace-featured", limit=120, window_seconds=60)
    return ok(await catalog_service.featured(limit))


@router.get("/api/v1/marketplace/regional")
async def marketplace_regional(
    request: Request,
    q: str | None = Query(default=None, max_length=120),
    tipo: str | None = Query(default=None, pattern="^(barbearia|salao|todos)?$"),
    status_filter: str | None = Query(default=None, alias="status", pattern="^(aberta|fechada|todos)?$"),
    city: str | None = Query(default=None, max_length=120),
    neighborhood: str | None = Query(default=None, max_length=120),
    state_filter: str | None = Query(default=None, alias="state", min_length=2, max_length=2),
    open_now: bool | None = Query(default=None),
    agenda: bool | None = Query(default=None),
    latitude: float | None = Query(default=None, ge=-90, le=90),
    longitude: float | None = Query(default=None, ge=-180, le=180),
    radius_km: float | None = Query(default=None, gt=0, le=500),
    service: str | None = Query(default=None, max_length=120),
    min_price: float | None = Query(default=None, ge=0, le=1_000_000),
    max_price: float | None = Query(default=None, ge=0, le=1_000_000),
    min_rating: float | None = Query(default=None, ge=0, le=5),
    offset: int = Query(default=0, ge=0, le=10_000),
    limit: int = Query(default=24, ge=1, le=60),
) -> JSONResponse:
    await enforce_rate_limit(request, "marketplace-regional", limit=180, window_seconds=60)
    if (latitude is None) != (longitude is None):
        raise ApiError(422, "COORDINATE_PAIR_REQUIRED", "Informe latitude e longitude juntas.")
    if min_price is not None and max_price is not None and min_price > max_price:
        raise ApiError(422, "INVALID_PRICE_RANGE", "O preço mínimo não pode superar o máximo.")
    if open_now is True and status_filter == "fechada":
        raise ApiError(422, "INCOMPATIBLE_STATUS_FILTER", "Revise o filtro de funcionamento informado.")
    effective_status = "aberta" if open_now is True and status_filter in (None, "", "todos") else status_filter
    return ok(await catalog_service.regional_search(
        query=q, tipo=tipo, status=effective_status, city=city, neighborhood=neighborhood, state=state_filter,
        agenda=agenda, latitude=latitude, longitude=longitude,
        radius_km=radius_km, service=service, min_price=min_price, max_price=max_price,
        min_rating=min_rating, offset=offset, limit=limit,
    ))


@router.get("/api/v1/catalog/cover-library")
async def catalog_cover_library(request: Request) -> JSONResponse:
    await enforce_rate_limit(request, "cover-library", limit=120, window_seconds=60)
    return ok(await catalog_service.cover_library())


@router.post("/api/v1/promotions", status_code=status.HTTP_201_CREATED)
async def create_promotion(
    request: Request,
    payload: PromotionCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "promotions-create", limit=20, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.create_promotion(payload, auth), status.HTTP_201_CREATED)


@router.patch("/api/v1/promotions/{promotion_id}")
async def update_promotion(
    promotion_id: str,
    request: Request,
    payload: PromotionUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "promotions-update", limit=60, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.update_promotion(promotion_id, payload, auth))


@router.delete("/api/v1/promotions/{promotion_id}")
async def delete_promotion(
    promotion_id: str,
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "promotions-delete", limit=20, window_seconds=300, identity=auth.user_id)
    return ok(await management_service.delete_promotion(promotion_id, auth))
