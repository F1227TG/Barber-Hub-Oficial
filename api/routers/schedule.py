"""HTTP contracts for the schedule domain."""

from __future__ import annotations

from datetime import date
from fastapi import Depends, Query, Request, status
from fastapi.responses import JSONResponse
from backend.errors import ApiError
from backend.schemas.schedule import ScheduleBlockCreate
from backend.schemas.schedule import WalkInCreate
from backend.schemas.schedule import OpeningPeriodsReplace
from backend.schemas.schedule import ManualServiceCreate
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_user
from backend.services import schedule as schedule_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.get("/api/v1/schedule/range")
async def schedule_range(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    start: date = Query(),
    end: date = Query(),
    professional_id: str | None = Query(default=None, min_length=36, max_length=36),
    appointment_offset: int = Query(default=0, ge=0, le=10_000),
    block_offset: int = Query(default=0, ge=0, le=10_000),
    limit: int = Query(default=100, ge=1, le=200),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    if end < start or (end - start).days > 31:
        raise ApiError(422, "INVALID_SCHEDULE_RANGE", "Consulte no máximo 32 dias por vez.")
    await enforce_rate_limit(request, "schedule-range", limit=120, window_seconds=60, identity=auth.user_id)
    return ok(await schedule_service.list_range(establishment_id, start, end, professional_id, auth, appointment_offset, block_offset, limit))


@router.post("/api/v1/schedule/walk-ins", status_code=status.HTTP_201_CREATED)
async def create_walk_in(
    request: Request,
    payload: WalkInCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "schedule-walk-in", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await schedule_service.create_walk_in(payload, auth), status.HTTP_201_CREATED)


@router.post("/api/v1/schedule/blocks", status_code=status.HTTP_201_CREATED)
async def create_schedule_block(
    request: Request,
    payload: ScheduleBlockCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "schedule-block-create", limit=60, window_seconds=300, identity=auth.user_id)
    return ok(await schedule_service.create_block(payload, auth), status.HTTP_201_CREATED)


@router.delete("/api/v1/schedule/blocks/{block_id}")
async def delete_schedule_block(
    block_id: str,
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "schedule-block-delete", limit=60, window_seconds=300, identity=auth.user_id)
    return ok(await schedule_service.delete_block(block_id, auth))


@router.get("/api/v1/schedule/opening-periods")
async def schedule_opening_periods(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "opening-periods-list", limit=120, window_seconds=60, identity=auth.user_id)
    return ok(await schedule_service.get_opening_periods(establishment_id, auth))


@router.put("/api/v1/schedule/opening-periods")
async def schedule_replace_opening_periods(
    request: Request,
    payload: OpeningPeriodsReplace,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "opening-periods-write", limit=30, window_seconds=60, identity=auth.user_id)
    return ok(await schedule_service.replace_opening_periods(payload, auth))


@router.post("/api/v1/schedule/manual-services", status_code=status.HTTP_201_CREATED)
async def schedule_manual_service(
    request: Request,
    payload: ManualServiceCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "manual-service-create", limit=45, window_seconds=60, identity=auth.user_id)
    return ok(await schedule_service.create_manual_service(payload, auth), status.HTTP_201_CREATED)
