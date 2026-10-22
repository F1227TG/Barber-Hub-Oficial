"""HTTP contracts for the imports domain."""

from __future__ import annotations

from fastapi import Depends, Query, Request, status
from fastapi.responses import JSONResponse
from backend.schemas.imports import ImportPreviewRequest
from backend.schemas.imports import ImportCommitRequest
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_user
from backend.services import imports as import_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.post("/api/v1/imports/preview", status_code=status.HTTP_201_CREATED)
async def preview_import(
    request: Request,
    payload: ImportPreviewRequest,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "imports-preview", limit=8, window_seconds=600, identity=auth.user_id)
    return ok(await import_service.preview(payload, auth), status.HTTP_201_CREATED)


@router.post("/api/v1/imports/{import_id}/commit")
async def commit_import(
    import_id: str,
    request: Request,
    payload: ImportCommitRequest,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "imports-commit", limit=8, window_seconds=600, identity=auth.user_id)
    return ok(await import_service.commit(import_id, auth))


@router.get("/api/v1/imports")
async def list_imports(
    request: Request,
    establishment_id: str = Query(min_length=36, max_length=36),
    offset: int = Query(default=0, ge=0), limit: int = Query(default=20, ge=1, le=50),
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "imports-list", limit=60, window_seconds=60, identity=auth.user_id)
    return ok(await import_service.list_jobs(establishment_id, offset, limit, auth))
