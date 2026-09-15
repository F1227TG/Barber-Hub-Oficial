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


def rows_payload(value: Any, *, message: str = "Não foi possível carregar estas informações agora.") -> list[dict[str, Any]]:
    """Normalize list responses at the provider boundary without hiding bad shapes.

    PostgREST normally returns a JSON array, while gateways and compatibility
    layers may wrap it in ``items``, ``data``, ``rows`` or ``results``. A
    single represented row is accepted only when it carries an ``id``. Any
    other object is an upstream contract error, never an empty business list.
    """

    if value is None:
        return []
    if isinstance(value, list):
        return [item for item in value if isinstance(item, dict)]
    if isinstance(value, dict):
        for key in ("items", "data", "rows", "results"):
            nested = value.get(key)
            if isinstance(nested, list):
                return [item for item in nested if isinstance(item, dict)]
            if isinstance(nested, dict):
                try:
                    return rows_payload(nested, message=message)
                except ApiError:
                    pass
        list_values = [item for item in value.values() if isinstance(item, list)]
        if len(list_values) == 1:
            return [item for item in list_values[0] if isinstance(item, dict)]
        if value.get("id") is not None:
            return [value]
    raise ApiError(502, "UPSTREAM_RESPONSE_INVALID", message)


def object_payload(value: Any, *, message: str = "Não foi possível carregar estas informações agora.") -> dict[str, Any]:
    """Normalize a single JSON object returned directly or through a wrapper."""

    if value is None:
        return {}
    if isinstance(value, list):
        if not value:
            return {}
        if isinstance(value[0], dict):
            return value[0]
    if isinstance(value, dict):
        for key in ("item", "data", "result", "resultado"):
            nested = value.get(key)
            if isinstance(nested, dict):
                return nested
            if isinstance(nested, list):
                return nested[0] if nested and isinstance(nested[0], dict) else {}
        return value
    raise ApiError(502, "UPSTREAM_RESPONSE_INVALID", message)


async def entitlements(establishment_id: str, auth: AuthContext) -> dict[str, Any]:
    data = await gateway.rest(
        "obter_meus_entitlements",
        method="POST",
        token=auth.token,
        rpc=True,
        json={"p_estabelecimento_id": establishment_id},
    )
    return object_payload(data, message="Não foi possível validar os recursos do plano agora.")


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
        permissions = object_payload(await gateway.rest(
            "obter_minhas_permissoes_193",
            method="POST",
            token=auth.token,
            rpc=True,
            json={"p_estabelecimento_id": establishment_id},
        ), message="Não foi possível validar as permissões da equipe agora.")
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
    rows = rows_payload(rows, message="Não foi possível validar o item solicitado agora.")
    if not rows:
        raise ApiError(404, "RESOURCE_NOT_FOUND_OR_FORBIDDEN", message)
    return rows[0]

