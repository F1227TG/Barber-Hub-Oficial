"""Validated establishment, service and professional writes.

These operations deliberately use the caller's Supabase token instead of the
service-role key. Pydantic validates shape/ranges in Python and PostgreSQL RLS
remains a second authorization boundary that proves ownership.
"""

from __future__ import annotations

from decimal import Decimal
from typing import Any
from uuid import UUID

from backend.errors import ApiError
from backend.models import (
    EstablishmentStatusUpdate,
    EstablishmentUpdate,
    ProfessionalCreate,
    ProfessionalUpdate,
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


async def update_establishment(establishment_id: str, payload: EstablishmentUpdate, auth: AuthContext) -> dict[str, Any]:
    data = _payload(payload)
    if not data:
        raise ApiError(422, "EMPTY_UPDATE", "Informe pelo menos um campo para atualizar.")
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
