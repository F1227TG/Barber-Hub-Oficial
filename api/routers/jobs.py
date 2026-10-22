"""HTTP contracts for the jobs domain."""

from __future__ import annotations

import hmac
from fastapi import Header, Query, Request
from fastapi.responses import JSONResponse
from backend.config import settings
from backend.errors import ApiError
from backend.rate_limit import enforce as enforce_rate_limit
from backend.services import push as push_service
from backend.services import email_delivery as email_service
from backend.services import maintenance as maintenance_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


def _valid_job_secret(supplied: str | None) -> bool:
    """Accept Vercel Cron and an optional external scheduler independently."""

    if not supplied:
        return False
    configured = tuple(secret for secret in (settings.cron_secret, settings.jobs_secret) if secret)
    return bool(configured) and any(hmac.compare_digest(supplied, secret) for secret in configured)


@router.get("/api/v1/jobs/push/deliver")
@router.post("/api/v1/jobs/push/deliver")
async def deliver_push_job(
    request: Request,
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_jobs_secret: str | None = Header(default=None, alias="X-Jobs-Secret"),
    limit: int = Query(default=50, ge=1, le=100),
) -> JSONResponse:
    bearer = authorization[7:] if authorization and authorization.startswith("Bearer ") else None
    supplied = bearer or x_jobs_secret
    if not _valid_job_secret(supplied):
        raise ApiError(401, "JOB_UNAUTHORIZED", "Tarefa não autorizada.")
    await enforce_rate_limit(request, "push-delivery-job", limit=12, window_seconds=60, identity="push-worker")
    return ok(await push_service.deliver_pending(limit))


@router.get("/api/v1/jobs/email/deliver")
@router.post("/api/v1/jobs/email/deliver")
async def deliver_email_job(
    request: Request,
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_jobs_secret: str | None = Header(default=None, alias="X-Jobs-Secret"),
    limit: int = Query(default=30, ge=1, le=100),
) -> JSONResponse:
    bearer = authorization[7:] if authorization and authorization.startswith("Bearer ") else None
    supplied = bearer or x_jobs_secret
    if not _valid_job_secret(supplied):
        raise ApiError(401, "JOB_UNAUTHORIZED", "Tarefa não autorizada.")
    await enforce_rate_limit(request, "email-delivery-job", limit=12, window_seconds=60, identity="email-worker")
    return ok(await email_service.deliver_pending(limit))


@router.get("/api/v1/jobs/maintenance/run")
@router.post("/api/v1/jobs/maintenance/run")
async def run_maintenance_job(
    request: Request,
    authorization: str | None = Header(default=None, alias="Authorization"),
    x_jobs_secret: str | None = Header(default=None, alias="X-Jobs-Secret"),
    email_limit: int = Query(default=30, ge=1, le=100),
    deletion_limit: int = Query(default=5, ge=1, le=20),
) -> JSONResponse:
    """Run account deletion and e-mail work in the second Hobby cron slot."""

    bearer = authorization[7:] if authorization and authorization.startswith("Bearer ") else None
    supplied = bearer or x_jobs_secret
    if not _valid_job_secret(supplied):
        raise ApiError(401, "JOB_UNAUTHORIZED", "Tarefa não autorizada.")
    await enforce_rate_limit(request, "maintenance-job", limit=12, window_seconds=60, identity="maintenance-worker")
    return ok(await maintenance_service.run(email_limit=email_limit, deletion_limit=deletion_limit))
