"""Appointment business rules exposed through the Python API."""

from __future__ import annotations

import asyncio

from backend.domain.appointments import can_transition
from backend.domain.operations import normalize_idempotency_key
from backend.errors import ApiError
from backend.models import AppointmentCancelRequest, AppointmentCreate, AppointmentStatusUpdate
from backend.security import AuthContext
from backend.services.access import rows_payload
from backend.supabase import gateway


async def _assert_not_own_establishment(establishment_id: str, auth: AuthContext) -> None:
    """Fail closed before asking PostgreSQL to create a customer booking."""

    owned, linked, member = await asyncio.gather(
        gateway.rest(
            "estabelecimentos",
            admin=True,
            params={"select": "id", "id": f"eq.{establishment_id}", "owner_id": f"eq.{auth.user_id}", "limit": "1"},
        ),
        gateway.rest(
            "profissionais",
            admin=True,
            params={
                "select": "id",
                "estabelecimento_id": f"eq.{establishment_id}",
                "user_id": f"eq.{auth.user_id}",
                "ativo": "eq.true",
                "limit": "1",
            },
        ),
        gateway.rest(
            "estabelecimento_membros",
            admin=True,
            params={
                "select": "id",
                "estabelecimento_id": f"eq.{establishment_id}",
                "user_id": f"eq.{auth.user_id}",
                "status": "eq.ativo",
                "limit": "1",
            },
        ),
    )
    owned = rows_payload(owned, message="Não foi possível validar este agendamento agora.")
    linked = rows_payload(linked, message="Não foi possível validar este agendamento agora.")
    member = rows_payload(member, message="Não foi possível validar este agendamento agora.")
    if owned or linked or member:
        raise ApiError(
            409,
            "SELF_BOOKING_NOT_ALLOWED",
            "Use a agenda profissional para registrar atendimentos no seu próprio estabelecimento.",
        )


async def create(
    payload: AppointmentCreate,
    auth: AuthContext,
    *,
    idempotency_key: str | None = None,
) -> dict[str, object]:
    establishment_id = str(payload.estabelecimento_id)
    await _assert_not_own_establishment(establishment_id, auth)
    key = normalize_idempotency_key(idempotency_key or payload.chave_idempotencia)
    if key is None:
        raise ApiError(
            422,
            "IDEMPOTENCY_KEY_REQUIRED",
            "Atualize esta etapa e tente confirmar o agendamento novamente.",
        )
    appointment_id = await gateway.rest(
        "criar_agendamento_idempotente_111",
        method="POST",
        token=auth.token,
        rpc=True,
        json={
            "p_estabelecimento_id": establishment_id,
            "p_profissional_id": str(payload.profissional_id),
            "p_servicos_ids": [str(item) for item in payload.servicos_ids],
            "p_data": payload.data.isoformat(),
            "p_hora_inicio": payload.hora_inicio.strftime("%H:%M:%S"),
            "p_observacao": payload.observacao,
            "p_cupom_codigo": payload.cupom_codigo,
            "p_chave_idempotencia": key,
        },
    )
    result = appointment_id[0] if isinstance(appointment_id, list) and appointment_id else appointment_id
    if isinstance(result, dict):
        result_id = result.get("id") or result.get("agendamento_id")
        if not result_id:
            raise ApiError(502, "INVALID_BOOKING_RESPONSE", "O agendamento não pôde ser confirmado neste momento.")
        return {
            "id": str(result_id),
            "replayed": bool(result.get("reutilizado") or result.get("replayed")),
            "status": str(result.get("status") or "pendente"),
        }
    if not result:
        raise ApiError(502, "INVALID_BOOKING_RESPONSE", "O agendamento não pôde ser confirmado neste momento.")
    return {"id": str(result), "replayed": False, "status": "pendente"}


async def _visible_appointment(appointment_id: str, auth: AuthContext) -> dict:
    rows = rows_payload(await gateway.rest(
        "agendamentos",
        token=auth.token,
        params={
            "id": f"eq.{appointment_id}",
            "select": "id,status,cliente_id,estabelecimento_id,data,hora_inicio,hora_fim",
            "limit": "1",
        },
    ), message="Não foi possível carregar este agendamento agora.")
    if not rows:
        raise ApiError(404, "APPOINTMENT_NOT_FOUND", "Agendamento não encontrado ou sem permissão de acesso.")
    return rows[0]


async def cancel(appointment_id: str, payload: AppointmentCancelRequest, auth: AuthContext) -> dict[str, str]:
    current = await _visible_appointment(appointment_id, auth)
    if current.get("status") in {"concluido", "cancelado", "recusado"}:
        raise ApiError(409, "INVALID_APPOINTMENT_STATE", "Este agendamento não pode mais ser cancelado.")
    await gateway.rest(
        "cancelar_agendamento",
        method="POST",
        token=auth.token,
        rpc=True,
        json={"p_agendamento_id": appointment_id, "p_motivo": payload.motivo},
    )
    return {"id": appointment_id, "status": "cancelado"}


async def update_status(appointment_id: str, payload: AppointmentStatusUpdate, auth: AuthContext) -> dict[str, str]:
    current = await _visible_appointment(appointment_id, auth)
    previous = str(current.get("status") or "")
    if not can_transition(previous, payload.status):
        raise ApiError(
            409,
            "INVALID_APPOINTMENT_TRANSITION",
            f"Não é possível alterar um agendamento de {previous or 'estado desconhecido'} para {payload.status}.",
        )

    rows = rows_payload(await gateway.rest(
        "agendamentos",
        method="PATCH",
        token=auth.token,
        params={"id": f"eq.{appointment_id}"},
        json={"status": payload.status},
        headers={"Prefer": "return=representation"},
    ), message="Não foi possível confirmar a atualização do agendamento agora.")
    if not rows:
        raise ApiError(403, "APPOINTMENT_UPDATE_FORBIDDEN", "Sua conta não pode alterar este agendamento.")
    return {"id": appointment_id, "status": payload.status}
