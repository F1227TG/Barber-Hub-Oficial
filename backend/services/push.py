"""Web Push subscriptions and preferences; delivery keeps internal notifications as fallback."""

from __future__ import annotations

import hashlib
import json
from datetime import datetime, timedelta, timezone
from zoneinfo import ZoneInfo
from typing import Any

from backend.config import settings
from backend.errors import ApiError
from backend.models import PushPreferencesUpdate, PushSubscriptionCreate
from backend.security import AuthContext
from backend.services.access import model_payload
from backend.supabase import gateway
from backend.services.flags import require_enabled


async def config() -> dict[str, Any]:
    return {"supported": bool(settings.vapid_public_key), "vapid_public_key": settings.vapid_public_key or None}


async def subscribe(payload: PushSubscriptionCreate, auth: AuthContext) -> dict[str, Any]:
    await require_enabled("notificacoes.web_push", auth, str(payload.estabelecimento_id) if payload.estabelecimento_id else None)
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


def _inside_quiet_hours(start: str | None, end: str | None) -> bool:
    if not start or not end:
        return False
    now = datetime.now(ZoneInfo("America/Sao_Paulo")).time().replace(tzinfo=None)
    start_time, end_time = datetime.strptime(start[:5], "%H:%M").time(), datetime.strptime(end[:5], "%H:%M").time()
    return start_time <= now < end_time if start_time < end_time else now >= start_time or now < end_time


async def _mark(delivery_id: str, data: dict[str, Any]) -> None:
    await gateway.rest("push_entregas", method="PATCH", admin=True, params={"id": f"eq.{delivery_id}"},
                       json=data, headers={"Prefer": "return=minimal"})


async def deliver_pending(limit: int = 50) -> dict[str, int]:
    """Deliver one bounded queue batch. Safe for a protected scheduled request."""
    if not settings.vapid_private_key or not settings.vapid_subject:
        raise ApiError(503, "PUSH_DELIVERY_NOT_CONFIGURED", "O envio de avisos ainda não foi configurado.")
    from pywebpush import WebPushException, webpush_async

    now = datetime.now(timezone.utc)
    rows = await gateway.rest(
        "reivindicar_entregas_push_1101", method="POST", admin=True, rpc=True,
        json={"p_limite": min(max(limit, 1), 100)},
    ) or []
    result = {"examined": len(rows), "sent": 0, "retry": 0, "discarded": 0, "quiet": 0}
    for item in rows:
        subscriptions = await gateway.rest("push_assinaturas", admin=True, params={"id": f"eq.{item['assinatura_id']}", "ativa": "eq.true", "select": "id,user_id,estabelecimento_id,endpoint,p256dh,auth_secret", "limit": "1"}) or []
        notifications = await gateway.rest("notificacoes", admin=True, params={"id": f"eq.{item['notificacao_id']}", "select": "titulo,mensagem,url,dados", "limit": "1"}) or []
        if not subscriptions or not notifications:
            await _mark(str(item["id"]), {"status": "descartada", "erro_codigo": "SOURCE_MISSING"}); result["discarded"] += 1; continue
        subscription, notification = subscriptions[0], notifications[0]
        pref_params = {"user_id": f"eq.{subscription['user_id']}", "select": "horario_silencioso_inicio,horario_silencioso_fim", "limit": "1"}
        pref_params["estabelecimento_id"] = f"eq.{subscription['estabelecimento_id']}" if subscription.get("estabelecimento_id") else "is.null"
        preferences = await gateway.rest("push_preferencias", admin=True, params=pref_params) or []
        preference = preferences[0] if preferences else {}
        if _inside_quiet_hours(preference.get("horario_silencioso_inicio"), preference.get("horario_silencioso_fim")):
            await _mark(str(item["id"]), {"status": "pendente", "tentativas": max(int(item.get("tentativas") or 1) - 1, 0), "proxima_tentativa_em": (now + timedelta(minutes=30)).isoformat()}); result["quiet"] += 1; continue
        attempts = int(item.get("tentativas") or 1)
        try:
            await webpush_async(subscription_info={"endpoint": subscription["endpoint"], "keys": {"p256dh": subscription["p256dh"], "auth": subscription["auth_secret"]}},
                data=json.dumps({"title": notification["titulo"], "body": notification["mensagem"], "url": notification.get("url") or "/html/notificacoes.html", "data": notification.get("dados") or {}}, ensure_ascii=False),
                vapid_private_key=settings.vapid_private_key, vapid_claims={"sub": settings.vapid_subject}, ttl=86400, timeout=12)
            await _mark(str(item["id"]), {"status": "enviada", "tentativas": attempts, "erro_codigo": None}); result["sent"] += 1
            await gateway.rest("push_assinaturas", method="PATCH", admin=True, params={"id": f"eq.{subscription['id']}"}, json={"ultimo_sucesso_em": now.isoformat()}, headers={"Prefer": "return=minimal"})
        except WebPushException as exc:
            code = getattr(getattr(exc, "response", None), "status_code", None)
            terminal = code in (404, 410) or attempts >= 5
            await _mark(str(item["id"]), {"status": "descartada" if terminal else "falhou", "tentativas": attempts,
                "erro_codigo": f"PUSH_{code or 'FAILED'}", "proxima_tentativa_em": (now + timedelta(minutes=min(2 ** attempts, 60))).isoformat()})
            if code in (404, 410):
                await gateway.rest("push_assinaturas", method="PATCH", admin=True, params={"id": f"eq.{subscription['id']}"}, json={"ativa": False}, headers={"Prefer": "return=minimal"})
            else:
                await gateway.rest("push_assinaturas", method="PATCH", admin=True, params={"id": f"eq.{subscription['id']}"}, json={"ultima_falha_em": now.isoformat()}, headers={"Prefer": "return=minimal"})
            result["discarded" if terminal else "retry"] += 1
    return result
