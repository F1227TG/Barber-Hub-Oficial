"""Privacy, account lifecycle and session operations."""

from __future__ import annotations

import hashlib
from datetime import datetime, timezone
from typing import Any

from backend.errors import ApiError
from backend.models import DeleteAccountRequest
from backend.security import AuthContext
from backend.services.access import object_payload, rows_payload
from backend.supabase import gateway


def _one(value: Any) -> dict[str, Any]:
    return object_payload(value, message="Não foi possível carregar os dados da conta agora.")


async def request_deletion(payload: DeleteAccountRequest, auth: AuthContext) -> dict[str, Any]:
    if payload.confirmacao.strip().upper() != "EXCLUIR MINHA CONTA":
        raise ApiError(422, "CONFIRMATION_REQUIRED", "Digite EXCLUIR MINHA CONTA para confirmar a solicitação.")
    if payload.retencao_ciente is not True:
        raise ApiError(422, "RETENTION_ACK_REQUIRED", "Confirme que leu o prazo de cancelamento da solicitação.")
    result = _one(await gateway.rest(
        "solicitar_exclusao_conta_111",
        method="POST",
        token=auth.token,
        rpc=True,
        json={"p_motivo": (payload.motivo or "").strip() or None},
    ))
    return {
        "scheduled": True,
        "scheduled_for": result.get("agendado_para") or result.get("scheduled_for"),
        "grace_period_days": 7,
        "replayed": bool(result.get("reutilizado") or result.get("replayed")),
    }


async def deletion_status(auth: AuthContext) -> dict[str, Any]:
    result = _one(await gateway.rest(
        "status_exclusao_conta_111", method="POST", token=auth.token, rpc=True, json={}
    ))
    status = str(result.get("status") or "none")
    return {
        "status": status,
        "requested_at": result.get("solicitado_em") or result.get("requested_at"),
        "scheduled_for": result.get("agendado_para") or result.get("scheduled_for"),
        "cancelled_at": result.get("cancelado_em") or result.get("cancelled_at"),
        "executed_at": result.get("executado_em") or result.get("executed_at"),
        "can_cancel": status in {"pendente", "agendada", "scheduled"},
    }


async def cancel_deletion(auth: AuthContext) -> dict[str, Any]:
    result = _one(await gateway.rest(
        "cancelar_exclusao_conta_111", method="POST", token=auth.token, rpc=True, json={}
    ))
    database_status = str(result.get("status") or "")
    cancelled = bool(result.get("cancelado") or result.get("cancelled") or database_status == "cancelada")
    return {"cancelled": cancelled, "status": database_status or ("cancelada" if cancelled else "sem_solicitacao")}


async def export_user_data(auth: AuthContext) -> dict[str, Any]:
    result = _one(await gateway.rest(
        "exportar_meus_dados_111", method="POST", token=auth.token, rpc=True, json={}
    ))
    return {
        "format": "barber-hub-account-export",
        "version": "1.0",
        "generated_at": datetime.now(timezone.utc).isoformat(),
        "data": result,
    }


def _mask_ip(value: Any) -> str | None:
    address = str(value or "").strip()
    if not address:
        return None
    if ":" in address:
        groups = address.split(":")
        return ":".join(groups[:3] + ["…"])
    parts = address.split(".")
    return ".".join(parts[:3] + ["xxx"]) if len(parts) == 4 else "Protegido"


def _public_session(row: dict[str, Any], current_session_id: str | None) -> dict[str, Any]:
    raw_id = str(row.get("id") or row.get("session_id") or "")
    opaque_id = hashlib.sha256(raw_id.encode("utf-8")).hexdigest()[:16] if raw_id else None
    user_agent = " ".join(str(row.get("user_agent") or row.get("dispositivo") or "Dispositivo não identificado").split())[:180]
    return {
        "id": opaque_id,
        "current": bool(row.get("atual") or (raw_id and current_session_id and raw_id == current_session_id)),
        "created_at": row.get("created_at") or row.get("criada_em"),
        "updated_at": row.get("updated_at") or row.get("refreshed_at") or row.get("atualizada_em"),
        "expires_at": row.get("expires_at") or row.get("expira_em"),
        "user_agent": user_agent,
        "ip_masked": row.get("ip_masked") or _mask_ip(row.get("ip")),
        "assurance_level": row.get("assurance_level") or row.get("nivel"),
    }


async def list_sessions(auth: AuthContext) -> dict[str, Any]:
    result = await gateway.rest(
        "listar_minhas_sessoes_111", method="POST", token=auth.token, rpc=True, json={}
    )
    if isinstance(result, dict) and isinstance(result.get("sessoes"), list):
        rows = rows_payload({"items": result["sessoes"]})
    else:
        rows = rows_payload(result, message="Não foi possível carregar as sessões conectadas agora.")
    current = str((auth.claims or {}).get("session_id") or "") or None
    items = [_public_session(row, current) for row in rows if isinstance(row, dict)]
    items.sort(key=lambda item: (not item["current"], str(item.get("updated_at") or "")), reverse=False)
    return {"items": items, "can_revoke_others": any(not item["current"] for item in items)}


async def revoke_sessions(auth: AuthContext, *, scope: str) -> dict[str, str | bool]:
    if scope not in {"others", "global"}:
        raise ApiError(422, "INVALID_SESSION_SCOPE", "Escolha um encerramento de sessão válido.")
    await gateway.auth_sign_out(auth.token, scope=scope)
    return {"revoked": True, "scope": scope}
