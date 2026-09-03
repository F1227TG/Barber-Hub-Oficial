"""Web Push subscriptions and preferences; delivery keeps internal notifications as fallback."""

from __future__ import annotations

import hashlib
from typing import Any

from backend.config import settings
from backend.errors import ApiError
from backend.models import PushPreferencesUpdate, PushSubscriptionCreate
from backend.security import AuthContext
from backend.services.access import model_payload
from backend.supabase import gateway


async def config() -> dict[str, Any]:
    return {"supported": bool(settings.vapid_public_key), "vapid_public_key": settings.vapid_public_key or None}


async def subscribe(payload: PushSubscriptionCreate, auth: AuthContext) -> dict[str, Any]:
    digest = hashlib.sha256(payload.endpoint.encode("utf-8")).hexdigest()
    rows = await gateway.rest(
        "push_assinaturas", method="POST", token=auth.token,
        params={"on_conflict": "endpoint_hash"},
        json={"user_id": auth.user_id,
              "estabelecimento_id": str(payload.estabelecimento_id) if payload.estabelecimento_id else None,
              "endpoint": payload.endpoint, "endpoint_hash": digest, "p256dh": payload.p256dh,
              "auth_secret": payload.auth, "expiracao": payload.expiracao.isoformat() if payload.expiracao else None,
              "user_agent": payload.user_agent, "ativa": True},
        headers={"Prefer": "resolution=merge-duplicates,return=representation"},
    ) or []
    if not rows:
        raise ApiError(403, "PUSH_SUBSCRIPTION_FORBIDDEN", "Não foi possível ativar notificações neste dispositivo.")
    return {"id": str(rows[0]["id"]), "active": True}


async def unsubscribe(endpoint: str, auth: AuthContext) -> dict[str, bool]:
    digest = hashlib.sha256(endpoint.encode("utf-8")).hexdigest()
    await gateway.rest("push_assinaturas", method="PATCH", token=auth.token,
                       params={"endpoint_hash": f"eq.{digest}"}, json={"ativa": False},
                       headers={"Prefer": "return=minimal"})
    return {"active": False}


async def get_preferences(establishment_id: str | None, auth: AuthContext) -> dict[str, Any]:
    params = {"user_id": f"eq.{auth.user_id}", "select": "*", "limit": "1"}
    params["estabelecimento_id"] = f"eq.{establishment_id}" if establishment_id else "is.null"
    rows = await gateway.rest("push_preferencias", token=auth.token, params=params) or []
    return rows[0] if rows else {
        "estabelecimento_id": establishment_id, "agendamentos": True, "confirmacoes": True,
        "cancelamentos": True, "lembretes": True, "lista_espera": True,
        "oportunidades": False, "campanhas": False,
    }


async def update_preferences(payload: PushPreferencesUpdate, auth: AuthContext) -> dict[str, Any]:
    establishment_id = str(payload.estabelecimento_id) if payload.estabelecimento_id else None
    params = {"user_id": f"eq.{auth.user_id}", "select": "id", "limit": "1",
              "estabelecimento_id": f"eq.{establishment_id}" if establishment_id else "is.null"}
    existing = await gateway.rest("push_preferencias", token=auth.token, params=params) or []
    data = model_payload(payload, exclude_unset=False)
    data.update({"user_id": auth.user_id, "estabelecimento_id": establishment_id})
    if existing:
        rows = await gateway.rest("push_preferencias", method="PATCH", token=auth.token,
                                  params={"id": f"eq.{existing[0]['id']}"}, json=data,
                                  headers={"Prefer": "return=representation"}) or []
    else:
        rows = await gateway.rest("push_preferencias", method="POST", token=auth.token, json=data,
                                  headers={"Prefer": "return=representation"}) or []
    if not rows:
        raise ApiError(403, "PUSH_PREFERENCES_FORBIDDEN", "Não foi possível salvar suas preferências.")
    return rows[0]
