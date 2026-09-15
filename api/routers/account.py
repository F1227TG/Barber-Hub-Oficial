"""Account privacy, sessions and delayed deletion endpoints."""

from fastapi import APIRouter, Depends, Request, status
from fastapi.responses import JSONResponse

from api.routers.responses import ok
from backend.rate_limit import enforce as enforce_rate_limit
from backend.schemas.account import DeleteAccountRequest
from backend.security import AuthContext, require_recent_user, require_user
from backend.services import account as account_service

router = APIRouter(prefix="/api/v1/account", tags=["account"])


async def _schedule(request: Request, payload: DeleteAccountRequest, auth: AuthContext) -> JSONResponse:
    await enforce_rate_limit(request, "account-delete", limit=3, window_seconds=900, identity=auth.user_id)
    return ok(await account_service.request_deletion(payload, auth), status.HTTP_202_ACCEPTED)


@router.delete("")
async def delete_account(
    request: Request,
    payload: DeleteAccountRequest,
    auth: AuthContext = Depends(require_recent_user),
) -> JSONResponse:
    """Compatibility route: deletion is now scheduled, never immediate."""
    return await _schedule(request, payload, auth)


@router.get("/deletion")
async def account_deletion_status(
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "account-deletion-status", limit=30, window_seconds=60, identity=auth.user_id)
    return ok(await account_service.deletion_status(auth))


@router.post("/deletion", status_code=status.HTTP_202_ACCEPTED)
async def schedule_account_deletion(
    request: Request,
    payload: DeleteAccountRequest,
    auth: AuthContext = Depends(require_recent_user),
) -> JSONResponse:
    return await _schedule(request, payload, auth)


@router.delete("/deletion")
async def cancel_account_deletion(
    request: Request,
    auth: AuthContext = Depends(require_recent_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "account-deletion-cancel", limit=5, window_seconds=900, identity=auth.user_id)
    return ok(await account_service.cancel_deletion(auth))


@router.get("/export")
async def export_account_data(
    request: Request,
    auth: AuthContext = Depends(require_recent_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "account-export", limit=3, window_seconds=3600, identity=auth.user_id)
    return ok(
        await account_service.export_user_data(auth),
        headers={
            "Cache-Control": "no-store",
            "Content-Disposition": 'attachment; filename="barber-hub-meus-dados.json"',
        },
    )


@router.get("/sessions")
async def account_sessions(
    request: Request,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "account-sessions", limit=20, window_seconds=60, identity=auth.user_id)
    return ok(await account_service.list_sessions(auth))


@router.delete("/sessions/others")
async def revoke_other_sessions(
    request: Request,
    auth: AuthContext = Depends(require_recent_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "account-sessions-revoke", limit=3, window_seconds=900, identity=auth.user_id)
    return ok(await account_service.revoke_sessions(auth, scope="others"))


@router.delete("/sessions")
async def revoke_all_sessions(
    request: Request,
    auth: AuthContext = Depends(require_recent_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "account-sessions-revoke", limit=3, window_seconds=900, identity=auth.user_id)
    return ok(await account_service.revoke_sessions(auth, scope="global"))
