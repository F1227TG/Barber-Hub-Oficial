"""Appointment business rules exposed through the Python API."""

from __future__ import annotations

from backend.domain.appointments import can_transition
from backend.errors import ApiError
from backend.models import AppointmentCancelRequest, AppointmentCreate, AppointmentStatusUpdate
from backend.security import AuthContext
from backend.supabase import gateway


async def create(payload: AppointmentCreate, auth: AuthContext) -> dict[str, str]:
    appointment_id = await gateway.rest(
        "criar_agendamento_multisservico",
        method="POST",
        token=auth.token,
        rpc=True,
        json={
            "p_estabelecimento_id": str(payload.estabelecimento_id),
            "p_profissional_id": str(payload.profissional_id),
            "p_servicos_ids": [str(item) for item in payload.servicos_ids],
            "p_data": payload.data.isoformat(),
            "p_hora_inicio": payload.hora_inicio.strftime("%H:%M:%S"),
            "p_observacao": payload.observacao,
        },
    )
    return {"id": str(appointment_id)}


async def _visible_appointment(appointment_id: str, auth: AuthContext) -> dict:
    rows = await gateway.rest(
        "agendamentos",
        token=auth.token,
        params={
            "id": f"eq.{appointment_id}",
            "select": "id,status,cliente_id,estabelecimento_id,data,hora_inicio,hora_fim",
            "limit": "1",
        },
    )
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

    rows = await gateway.rest(
        "agendamentos",
        method="PATCH",
        token=auth.token,
        params={"id": f"eq.{appointment_id}"},
        json={"status": payload.status},
        headers={"Prefer": "return=representation"},
    )
    if not rows:
        raise ApiError(403, "APPOINTMENT_UPDATE_FORBIDDEN", "Sua conta não pode alterar este agendamento.")
    return {"id": appointment_id, "status": payload.status}
