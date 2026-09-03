"""Server-side feature flag evaluation."""

from __future__ import annotations

from typing import Any

from backend.models import FeatureFlagEvaluationRequest
from backend.security import AuthContext
from backend.supabase import gateway


async def evaluate(payload: FeatureFlagEvaluationRequest, auth: AuthContext) -> dict[str, bool]:
    data = await gateway.rest(
        "avaliar_feature_flags_110", method="POST", token=auth.token, rpc=True,
        json={"p_chaves": payload.chaves,
              "p_estabelecimento_id": str(payload.estabelecimento_id) if payload.estabelecimento_id else None},
    ) or {}
    return {str(key): bool(value) for key, value in data.items()}
