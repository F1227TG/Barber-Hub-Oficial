"""HTTP contracts for the notifications domain."""

from __future__ import annotations

from fastapi import Depends, Query, Request, status
from fastapi.responses import JSONResponse
from backend.schemas.notifications import PushSubscriptionCreate
from backend.schemas.notifications import PushUnsubscribeRequest
from backend.schemas.notifications import PushPreferencesUpdate
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_user
from backend.services import push as push_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.get("/api/v1/push/config")
async def push_config(request: Request) -> JSONResponse:
    await enforce_rate_limit(request, "push-config", limit=120, window_seconds=60)
    return ok(await push_service.config())


@router.post("/api/v1/push/subscriptions", status_code=status.HTTP_201_CREATED)
async def push_subscribe(
    request: Request,
    payload: PushSubscriptionCreate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "push-subscribe", limit=12, window_seconds=600, identity=auth.user_id)
    return ok(await push_service.subscribe(payload, auth), status.HTTP_201_CREATED)


@router.delete("/api/v1/push/subscriptions")
async def push_unsubscribe(
    request: Request,
    payload: PushUnsubscribeRequest,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "push-unsubscribe", limit=12, window_seconds=600, identity=auth.user_id)
    return ok(await push_service.unsubscribe(payload.endpoint, auth))


@router.get("/api/v1/push/preferences")
async def push_preferences(
    request: Request,
    establishment_id: str | None = Query(default=None, min_length=36, max_length=36),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "push-preferences", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await push_service.get_preferences(establishment_id, auth))


@router.put("/api/v1/push/preferences")
async def update_push_preferences(
    request: Request,
    payload: PushPreferencesUpdate,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "push-preferences-write", limit=20, window_seconds=300, identity=auth.user_id)
    return ok(await push_service.update_preferences(payload, auth))
