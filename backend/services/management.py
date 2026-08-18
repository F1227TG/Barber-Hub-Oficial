"""Validated establishment, service and professional writes.

These operations deliberately use the caller's Supabase token instead of the
service-role key. Pydantic validates shape/ranges in Python and PostgreSQL RLS
remains a second authorization boundary that proves ownership.
"""

from __future__ import annotations

from datetime import date, time
from decimal import Decimal
from typing import Any
from uuid import UUID

from backend.errors import ApiError
from backend.models import (
    EstablishmentStatusUpdate,
    EstablishmentUpdate,
    ProfessionalCreate,
    ProfessionalUpdate,
    PromotionCreate,
    PromotionUpdate,
    ServiceCreate,
    ServiceUpdate,
)
from backend.security import AuthContext
from backend.supabase import gateway


def _json_value(value: Any) -> Any:
    """Convert Python/Pydantic scalar types to PostgREST-friendly JSON values."""
    if isinstance(value, Decimal):
        return float(value)
    if isinstance(value, UUID):
        return str(value)
    if isinstance(value, (date, time)):
        return value.isoformat()
    if isinstance(value, list):
        return [_json_value(item) for item in value]
    if isinstance(value, dict):
        return {key: _json_value(item) for key, item in value.items()}
    return value


def _payload(model) -> dict[str, Any]:
    """Serialize explicitly provided fields while preserving intentional nulls."""
    raw = model.model_dump(exclude_unset=True)
    return {key: _json_value(value) for key, value in raw.items()}


async def _write(
    table: str,
    *,
    auth: AuthContext,
    method: str,
    params: dict[str, Any] | None = None,
    json: dict[str, Any] | None = None,
    not_found_message: str,
) -> dict[str, Any]:
    rows = await gateway.rest(
        table,
        method=method,
        token=auth.token,
        params=params,
        json=json,
        headers={"Prefer": "return=representation"},
    )
    if not rows:
        raise ApiError(404, "RESOURCE_NOT_FOUND_OR_FORBIDDEN", not_found_message)
    return rows[0] if isinstance(rows, list) else rows


async def get_entitlements(establishment_id: str, auth: AuthContext) -> dict[str, Any]:
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


async def _active_count(table: str, establishment_id: str, auth: AuthContext) -> int:
    response = await gateway.request(
        f"/rest/v1/{table}",
        token=auth.token,
        params={"select": "id", "estabelecimento_id": f"eq.{establishment_id}", "ativo": "eq.true", "limit": "1"},
        headers={"Prefer": "count=exact", "Range": "0-0"},
    )
    content_range = response.headers.get("content-range", "0/0")
    try:
        return int(content_range.rsplit("/", 1)[1])
    except (ValueError, IndexError):
        return 0


async def update_establishment(establishment_id: str, payload: EstablishmentUpdate, auth: AuthContext) -> dict[str, Any]:
    data = _payload(payload)
    if not data:
        raise ApiError(422, "EMPTY_UPDATE", "Informe pelo menos um campo para atualizar.")
    if data.get("aceita_agendamento") is True:
        entitlements = await get_entitlements(establishment_id, auth)
        if not entitlements.get("permite_agenda"):
            raise ApiError(403, "PLAN_FEATURE_REQUIRED", "A agenda online está disponível a partir do plano Essencial.")
    return await _write(
        "estabelecimentos",
        auth=auth,
        method="PATCH",
        params={"id": f"eq.{establishment_id}"},
        json=data,
        not_found_message="Estabelecimento não encontrado ou sem permissão de edição.",
    )


async def update_establishment_status(establishment_id: str, payload: EstablishmentStatusUpdate, auth: AuthContext) -> dict[str, Any]:
    return await _write(
        "estabelecimentos",
        auth=auth,
        method="PATCH",
        params={"id": f"eq.{establishment_id}"},
        json={"status_manual": payload.status, "motivo_status": payload.motivo},
        not_found_message="Estabelecimento não encontrado ou sem permissão para alterar o status.",
    )


async def create_service(payload: ServiceCreate, auth: AuthContext) -> dict[str, Any]:
    return await _write(
        "servicos",
        auth=auth,
        method="POST",
        json=_payload(payload),
        not_found_message="Não foi possível criar o serviço neste estabelecimento.",
    )


async def update_service(service_id: str, payload: ServiceUpdate, auth: AuthContext) -> dict[str, Any]:
    data = _payload(payload)
    if not data:
        raise ApiError(422, "EMPTY_UPDATE", "Informe pelo menos um campo para atualizar.")
    return await _write(
        "servicos",
        auth=auth,
        method="PATCH",
        params={"id": f"eq.{service_id}"},
        json=data,
        not_found_message="Serviço não encontrado ou sem permissão de edição.",
    )


async def delete_service(service_id: str, auth: AuthContext) -> dict[str, Any]:
    # Arquivamento lógico preserva snapshots e referências de agendamentos antigos.
    return await _write(
        "servicos",
        auth=auth,
        method="PATCH",
        params={"id": f"eq.{service_id}"},
        json={"ativo": False, "publico": False},
        not_found_message="Serviço não encontrado ou sem permissão de exclusão.",
    )


async def create_professional(payload: ProfessionalCreate, auth: AuthContext) -> dict[str, Any]:
    establishment_id = str(payload.estabelecimento_id)
    entitlements = await get_entitlements(establishment_id, auth)
    limit = max(int(entitlements.get("limite_profissionais") or 1), 1)
    active = await _active_count("profissionais", establishment_id, auth)
    if active >= limit:
        raise ApiError(403, "PLAN_LIMIT_REACHED", f"Seu plano permite até {limit} profissional(is) ativo(s).")
    return await _write(
        "profissionais",
        auth=auth,
        method="POST",
        json=_payload(payload),
        not_found_message="Não foi possível adicionar o profissional neste estabelecimento.",
    )


async def update_professional(professional_id: str, payload: ProfessionalUpdate, auth: AuthContext) -> dict[str, Any]:
    data = _payload(payload)
    if not data:
        raise ApiError(422, "EMPTY_UPDATE", "Informe pelo menos um campo para atualizar.")
    if data.get("ativo") is True:
        rows = await gateway.rest(
            "profissionais",
            method="GET",
            token=auth.token,
            params={"select": "estabelecimento_id,ativo", "id": f"eq.{professional_id}", "limit": "1"},
        )
        if not rows:
            raise ApiError(404, "RESOURCE_NOT_FOUND_OR_FORBIDDEN", "Profissional não encontrado.")
        if not rows[0].get("ativo"):
            establishment_id = str(rows[0]["estabelecimento_id"])
            entitlements = await get_entitlements(establishment_id, auth)
            limit = max(int(entitlements.get("limite_profissionais") or 1), 1)
            active = await _active_count("profissionais", establishment_id, auth)
            if active >= limit:
                raise ApiError(403, "PLAN_LIMIT_REACHED", f"Seu plano permite até {limit} profissional(is) ativo(s).")
    return await _write(
        "profissionais",
        auth=auth,
        method="PATCH",
        params={"id": f"eq.{professional_id}"},
        json=data,
        not_found_message="Profissional não encontrado ou sem permissão de edição.",
    )


async def delete_professional(professional_id: str, auth: AuthContext) -> dict[str, Any]:
    # Arquivamento lógico evita quebrar o histórico referenciado por agendamentos.
    return await _write(
        "profissionais",
        auth=auth,
        method="PATCH",
        params={"id": f"eq.{professional_id}"},
        json={"ativo": False, "aceita_agendamento": False},
        not_found_message="Profissional não encontrado ou sem permissão de exclusão.",
    )


async def create_promotion(payload: PromotionCreate, auth: AuthContext) -> dict[str, Any]:
    establishment_id = str(payload.estabelecimento_id)
    entitlements = await get_entitlements(establishment_id, auth)
    if not entitlements.get("permite_promocoes"):
        raise ApiError(403, "PLAN_FEATURE_REQUIRED", "Promoções públicas estão disponíveis a partir do plano Essencial.")
    return await _write(
        "promocoes",
        auth=auth,
        method="POST",
        json=_payload(payload),
        not_found_message="Não foi possível criar a promoção neste estabelecimento.",
    )


async def update_promotion(promotion_id: str, payload: PromotionUpdate, auth: AuthContext) -> dict[str, Any]:
    data = _payload(payload)
    if not data:
        raise ApiError(422, "EMPTY_UPDATE", "Informe pelo menos um campo para atualizar.")
    if data.get("ativo") is True:
        rows = await gateway.rest(
            "promocoes",
            method="GET",
            token=auth.token,
            params={"select": "estabelecimento_id", "id": f"eq.{promotion_id}", "limit": "1"},
        )
        if not rows:
            raise ApiError(404, "RESOURCE_NOT_FOUND_OR_FORBIDDEN", "Promoção não encontrada.")
        entitlements = await get_entitlements(str(rows[0]["estabelecimento_id"]), auth)
        if not entitlements.get("permite_promocoes"):
            raise ApiError(403, "PLAN_FEATURE_REQUIRED", "Promoções públicas estão disponíveis a partir do plano Essencial.")
    return await _write(
        "promocoes",
        auth=auth,
        method="PATCH",
        params={"id": f"eq.{promotion_id}"},
        json=data,
        not_found_message="Promoção não encontrada ou sem permissão de edição.",
    )


async def delete_promotion(promotion_id: str, auth: AuthContext) -> dict[str, Any]:
    return await _write(
        "promocoes",
        auth=auth,
        method="PATCH",
        params={"id": f"eq.{promotion_id}"},
        json={"ativo": False},
        not_found_message="Promoção não encontrada ou sem permissão de exclusão.",
    )
