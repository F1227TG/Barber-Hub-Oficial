"""HTTP contracts for the admin domain."""

from __future__ import annotations

from uuid import UUID
from backend.schemas.admin import AdminAccountUpdate
from backend.services import admin_accounts

from fastapi import Depends, Header, Query, Request
from fastapi.responses import JSONResponse
from backend.errors import ApiError
from backend.schemas.admin import AdminSubscriptionUpdate
from backend.schemas.admin import PasswordRecoveryRequest
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_admin
from backend.domain.operations import choose_idempotency_key
from backend.services import admin as admin_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.patch("/api/v1/admin/users/{user_id}")
async def admin_update_account(user_id: UUID, request: Request, payload: AdminAccountUpdate,
                               auth: AuthContext = Depends(require_admin)) -> JSONResponse:
    await enforce_rate_limit(request, "admin-account-change", limit=30, window_seconds=60, identity=auth.user_id)
    return ok(await admin_accounts.update(str(user_id), payload.model_dump(exclude_unset=True), auth,
                                          request_id=getattr(request.state, "request_id", None)))


@router.delete("/api/v1/admin/users/{user_id}")
async def admin_delete_account(user_id: UUID, request: Request,
                               auth: AuthContext = Depends(require_admin)) -> JSONResponse:
    await enforce_rate_limit(request, "admin-account-change", limit=30, window_seconds=60, identity=auth.user_id)
    return ok(await admin_accounts.update(str(user_id), {"estado_conta": "excluida"}, auth,
                                          request_id=getattr(request.state, "request_id", None)))


@router.post("/api/v1/admin/users/{user_id}/restore")
async def admin_restore_account(user_id: UUID, request: Request,
                                auth: AuthContext = Depends(require_admin)) -> JSONResponse:
    await enforce_rate_limit(request, "admin-account-change", limit=30, window_seconds=60, identity=auth.user_id)
    return ok(await admin_accounts.update(str(user_id), {"estado_conta": "ativa"}, auth,
                                          request_id=getattr(request.state, "request_id", None)))


@router.get("/api/v1/admin/overview")
async def admin_overview(
    request: Request,
    auth: AuthContext = Depends(require_admin),
) -> JSONResponse:
    await enforce_rate_limit(request, "admin-overview", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await admin_service.overview(auth))


@router.get("/api/v1/admin/records/{resource}")
async def admin_records(
    resource: str,
    request: Request,
    offset: int = Query(default=0, ge=0, le=100_000),
    limit: int = Query(default=50, ge=1, le=100),
    q: str | None = Query(default=None, max_length=80),
    status_filter: str | None = Query(default=None, alias="status", max_length=30),
    auth: AuthContext = Depends(require_admin),
) -> JSONResponse:
    await enforce_rate_limit(request, "admin-records", limit=120, window_seconds=60, identity=auth.user_id)
    return ok(await admin_service.list_records(
        resource, auth, offset=offset, limit=limit, query=q, status=status_filter
    ))


@router.get("/api/v1/admin/health")
async def admin_health(
    request: Request,
    auth: AuthContext = Depends(require_admin),
) -> JSONResponse:
    await enforce_rate_limit(request, "admin-health", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await admin_service.health_details(auth))


@router.post("/api/v1/admin/users/{user_id}/password-recovery")
async def admin_password_recovery(
    user_id: str,
    request: Request,
    payload: PasswordRecoveryRequest,
    auth: AuthContext = Depends(require_admin),
) -> JSONResponse:
    await enforce_rate_limit(request, "admin-password-recovery", limit=10, window_seconds=900, identity=auth.user_id)
    result = await admin_service.send_password_recovery(user_id, payload, auth)
    await admin_service.audit_action(
        auth,
        action="password_recovery_requested",
        target_type="user",
        target_id=user_id,
        details={"reason_provided": bool(payload.motivo)},
        request_id=getattr(request.state, "request_id", None),
    )
    return ok(result)


@router.get("/api/v1/admin/subscriptions")
async def admin_subscriptions(
    request: Request,
    auth: AuthContext = Depends(require_admin),
) -> JSONResponse:
    await enforce_rate_limit(request, "admin-subscriptions", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await admin_service.list_subscriptions(auth))


@router.patch("/api/v1/admin/establishments/{establishment_id}/subscription")
async def admin_assign_subscription(
    establishment_id: str,
    request: Request,
    payload: AdminSubscriptionUpdate,
    idempotency_key: str | None = Header(default=None, alias="Idempotency-Key"),
    auth: AuthContext = Depends(require_admin),
) -> JSONResponse:
    await enforce_rate_limit(request, "admin-subscription-update", limit=40, window_seconds=600, identity=auth.user_id)
    try:
        operation_key = choose_idempotency_key(idempotency_key, payload.chave_idempotencia)
    except ValueError as exc:
        raise ApiError(
            409 if idempotency_key and payload.chave_idempotencia else 422,
            "IDEMPOTENCY_KEY_MISMATCH" if idempotency_key and payload.chave_idempotencia else "INVALID_IDEMPOTENCY_KEY",
            str(exc),
        ) from exc
    result = await admin_service.assign_subscription(
        establishment_id,
        payload,
        auth,
        idempotency_key=operation_key,
    )
    await admin_service.audit_action(
        auth,
        action="subscription_changed",
        target_type="establishment",
        target_id=establishment_id,
        details={"plan": payload.plano_slug, "status": payload.status},
        request_id=getattr(request.state, "request_id", None),
    )
    return ok(result)


@router.get("/api/v1/admin/navigation-audit")
async def navigation_audit(
    request: Request,
    auth: AuthContext = Depends(require_admin),
) -> JSONResponse:
    await enforce_rate_limit(request, "admin-navigation-audit", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await admin_service.navigation_audit(auth))
