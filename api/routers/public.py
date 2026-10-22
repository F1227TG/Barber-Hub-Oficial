"""HTTP contracts for the public domain."""

from __future__ import annotations

from fastapi import Request
from fastapi.responses import JSONResponse
from backend.config import settings
from backend.rate_limit import enforce as enforce_rate_limit
from backend.version import API_VERSION
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.get("/api/v1/health")
async def health() -> JSONResponse:
    return ok({
        "service": "barber-hub-api",
        "runtime": "python-fastapi",
        "version": API_VERSION,
        "status": "ready" if settings.is_configured else "configuration_required",
    })


@router.get("/api/v1/public-config")
async def public_config(request: Request) -> JSONResponse:
    """Expose only browser-safe runtime configuration; secrets never leave the API."""
    await enforce_rate_limit(request, "public-config", limit=120, window_seconds=60)
    return ok({
        "turnstile_site_key": settings.turnstile_site_key or None,
        "captcha_required": bool(settings.turnstile_site_key),
    })
