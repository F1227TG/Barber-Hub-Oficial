"""Public catalog endpoints that have completed their service extraction."""

from uuid import UUID

from fastapi import APIRouter, Query, Request
from fastapi.responses import JSONResponse

from api.routers.responses import ok
from backend.rate_limit import enforce as enforce_rate_limit
from backend.services import catalog as catalog_service

router = APIRouter(prefix="/api/v1", tags=["catalog"])


@router.get("/establishments/{establishment_id}/reviews")
async def establishment_reviews(
    establishment_id: UUID,
    request: Request,
    offset: int = Query(default=0, ge=0, le=10_000),
    limit: int = Query(default=10, ge=1, le=30),
) -> JSONResponse:
    await enforce_rate_limit(request, "public-reviews", limit=120, window_seconds=60)
    return ok(await catalog_service.reviews(str(establishment_id), offset=offset, limit=limit))
