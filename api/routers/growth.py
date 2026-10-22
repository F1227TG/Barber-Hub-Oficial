"""HTTP contracts for the growth domain."""

from __future__ import annotations

from datetime import date
from fastapi import Depends, Query, Request, status
from fastapi.responses import JSONResponse
from backend.schemas.growth import GoalCreate
from backend.schemas.growth import GoalUpdate
from backend.schemas.growth import OpportunityUpdate
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_user
from backend.services import growth as growth_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.get("/api/v1/growth/insights")
async def growth_insights(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    start: date = Query(),
    end: date = Query(),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "growth-insights", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await growth_service.insights(establishment_id, start, end, auth))


@router.get("/api/v1/growth/opportunities")
async def growth_opportunities(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "growth-opportunities", limit=40, window_seconds=60, identity=auth.user_id)
    return ok(await growth_service.opportunities(establishment_id, auth))


@router.patch("/api/v1/growth/opportunities/{opportunity_id}")
async def update_growth_opportunity(
    opportunity_id: str,
    request: Request,
    payload: OpportunityUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "growth-opportunity-update", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await growth_service.update_opportunity(opportunity_id, payload, auth))


@router.get("/api/v1/growth/goals")
async def growth_goals(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "growth-goals-list", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await growth_service.list_goals(establishment_id, auth))


@router.post("/api/v1/growth/goals", status_code=status.HTTP_201_CREATED)
async def create_growth_goal(
    request: Request,
    payload: GoalCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "growth-goals-create", limit=30, window_seconds=300, identity=auth.user_id)
    return ok(await growth_service.create_goal(payload, auth), status.HTTP_201_CREATED)


@router.patch("/api/v1/growth/goals/{goal_id}")
async def update_growth_goal(
    goal_id: str,
    request: Request,
    payload: GoalUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "growth-goals-update", limit=40, window_seconds=300, identity=auth.user_id)
    return ok(await growth_service.update_goal(goal_id, payload, auth))
