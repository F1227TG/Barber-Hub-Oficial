"""Server-side feature flag evaluation."""

from __future__ import annotations

from typing import Any

from backend.models import FeatureFlagEvaluationRequest
from backend.errors import ApiError
from backend.security import AuthContext
from backend.supabase import gateway


async def evaluate(payload: FeatureFlagEvaluationRequest, auth: AuthContext) -> dict[str, bool]:
    data = await gateway.rest(
        "avaliar_feature_flags_110", method="POST", token=auth.token, rpc=True,
        json={"p_chaves": payload.chaves,
              "p_estabelecimento_id": str(payload.estabelecimento_id) if payload.estabelecimento_id else None},
    ) or {}
    return {str(key): bool(value) for key, value in data.items()}


async def require_enabled(key: str, auth: AuthContext | None = None, establishment_id: str | None = None) -> None:
    if auth:
        values = await evaluate(FeatureFlagEvaluationRequest(chaves=[key], estabelecimento_id=establishment_id), auth)
    else:
        values = await gateway.rest("funcionalidades_publicas_1101", method="POST", rpc=True, json={}) or {}
    if values.get(key) is not True:
        raise ApiError(403, "FEATURE_DISABLED", "Este recurso está temporariamente indisponível para esta conta.")
