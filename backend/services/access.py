"""Shared entitlement checks and PostgREST serialization for API services."""

from __future__ import annotations

from datetime import date, datetime, time
from decimal import Decimal
from typing import Any
from uuid import UUID

from backend.errors import ApiError
from backend.security import AuthContext
from backend.supabase import gateway


def json_value(value: Any) -> Any:
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (date, datetime, time)):
        return value.isoformat()
    if isinstance(value, list):
        return [json_value(item) for item in value]
    if isinstance(value, dict):
        return {key: json_value(item) for key, item in value.items()}
    return value


def model_payload(model, *, exclude_unset: bool = True) -> dict[str, Any]:
    return {
        key: json_value(value)
        for key, value in model.model_dump(exclude_unset=exclude_unset).items()
    }


async def entitlements(establishment_id: str, auth: AuthContext) -> dict[str, Any]:
    data = await gateway.rest(
        "obter_meus_entitlements",
        method="POST",
        token=auth.token,
        rpc=True,
        json={"p_estabelecimento_id": establishment_id},
    )
    if isinstance(data, list):
        return data[0] if data else {}
    return data or {}


async def require_feature(
    establishment_id: str,
    auth: AuthContext,
    feature: str,
    message: str,
) -> dict[str, Any]:
    data = await entitlements(establishment_id, auth)
    if not data.get(feature):
        raise ApiError(403, "PLAN_FEATURE_REQUIRED", message)
    capability = {
        "permite_agenda_avancada": "agenda",
        "permite_crm": "crm",
        "permite_financeiro": "financeiro",
        "permite_comissoes": "financeiro",
        "permite_equipe_acesso": "equipe",
        "permite_lista_espera": "retencao",
        "permite_recorrencia": "retencao",
        "permite_fidelidade": "retencao",
        "permite_cupons": "retencao",
        "permite_campanhas": "campanhas",
        "permite_lembretes": "retencao",
        "permite_oportunidades": "crescimento",
        "permite_insights": "crescimento",
        "permite_metas": "metas",
        "permite_permissoes_granulares": "equipe",
    }.get(feature)
    if capability:
        permissions = await gateway.rest(
            "obter_minhas_permissoes_193",
            method="POST",
            token=auth.token,
            rpc=True,
            json={"p_estabelecimento_id": establishment_id},
        ) or {}
        if not permissions.get(capability):
            raise ApiError(403, "TEAM_PERMISSION_REQUIRED", "Seu acesso da equipe não permite usar este recurso.")
    return data


async def first_visible(
    table: str,
    resource_id: str,
    auth: AuthContext,
    *,
    select: str,
    message: str,
) -> dict[str, Any]:
    rows = await gateway.rest(
        table,
        token=auth.token,
        params={"id": f"eq.{resource_id}", "select": select, "limit": "1"},
    )
    if not rows:
        raise ApiError(404, "RESOURCE_NOT_FOUND_OR_FORBIDDEN", message)
    return rows[0]

