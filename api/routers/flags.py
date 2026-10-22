"""HTTP contracts for the flags domain."""

from __future__ import annotations

from fastapi import Depends, Request
from fastapi.responses import JSONResponse
from backend.schemas.flags import FeatureFlagEvaluationRequest
from backend.rate_limit import enforce as enforce_rate_limit
from backend.security import AuthContext, require_user
from backend.services import flags as flag_service
from fastapi import APIRouter
from api.routers.responses import ok

router = APIRouter()


@router.post("/api/v1/features/evaluate")
async def evaluate_features(
    request: Request,
    payload: FeatureFlagEvaluationRequest,
    auth: AuthContext = Depends(require_user),
) -> JSONResponse:
    await enforce_rate_limit(request, "feature-evaluate", limit=120, window_seconds=60, identity=auth.user_id)
    return ok(await flag_service.evaluate(payload, auth))
