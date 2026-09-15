"""Liveness and readiness probes for hosting orchestration."""

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from api.routers.responses import ok
from backend.services import system as system_service
from backend.version import API_VERSION

router = APIRouter(prefix="/api/v1/health", tags=["system"])


@router.get("/live")
async def liveness() -> JSONResponse:
    return ok({"service": "barber-hub-api", "status": "alive", "version": API_VERSION})


@router.get("/ready")
async def readiness() -> JSONResponse:
    data = await system_service.readiness()
    data["version"] = API_VERSION
    return ok(data)
